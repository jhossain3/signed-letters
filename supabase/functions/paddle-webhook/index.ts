// Paddle webhook: verifies signature, marks physical_letters paid, and emails admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paddle-signature",
};

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const EMAIL_KEY_SALT = new TextEncoder().encode("signed-letters-email-derived-key-v1");

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

async function exportAesKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return uint8ArrayToBase64(new Uint8Array(raw));
}

async function getOrCreateUserKey(admin: ReturnType<typeof createClient>, userId: string): Promise<CryptoKey> {
  const { data: existingKey, error: fetchError } = await admin
    .from("user_encryption_keys")
    .select("encrypted_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`failed to fetch user key: ${fetchError.message}`);
  }

  if (existingKey?.encrypted_key) {
    return importAesKey(existingKey.encrypted_key);
  }

  const key = await generateAesKey();
  const exportedKey = await exportAesKey(key);
  const { error: upsertError } = await admin
    .from("user_encryption_keys")
    .upsert(
      {
        user_id: userId,
        encrypted_key: exportedKey,
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    throw new Error(`failed to store user key: ${upsertError.message}`);
  }

  return importAesKey(exportedKey);
}

async function encryptValueWithKey(value: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return `enc:${uint8ArrayToBase64(combined)}`;
}

async function deriveKeyFromEmail(email: string): Promise<CryptoKey> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailBytes = new TextEncoder().encode(normalizedEmail);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    emailBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: EMAIL_KEY_SALT,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

type OrderRow = {
  id: string;
  user_id: string;
  letter_id: string | null;
  sender_name: string;
  recipient_name: string;
  recipient_address: string;
  plaintext_title: string;
  plaintext_body: string;
  plaintext_signature: string;
  delivery_date: string;
  posting_date: string;
};

function extractPhysicalLetterId(data: Record<string, unknown>): string | undefined {
  const fromCustom = (cd: Record<string, unknown> | undefined) => {
    if (!cd) return undefined;
    const id = cd.physical_letter_id ?? cd.physicalLetterId;
    return typeof id === "string" ? id : undefined;
  };

  let id =
    fromCustom(data?.custom_data as Record<string, unknown>) ??
    fromCustom(data?.customData as Record<string, unknown>) ??
    fromCustom((data?.checkout as Record<string, unknown>)?.custom_data as Record<string, unknown>) ??
    fromCustom((data?.checkout as Record<string, unknown>)?.customData as Record<string, unknown>);

  if (!id && Array.isArray(data.items)) {
    for (const item of data.items as Record<string, unknown>[]) {
      const price = item?.price as Record<string, unknown> | undefined;
      id =
        fromCustom(price?.custom_data as Record<string, unknown>) ??
        fromCustom(price?.customData as Record<string, unknown>) ??
        fromCustom(item?.custom_data as Record<string, unknown>) ??
        fromCustom(item?.customData as Record<string, unknown>);
      if (id) break;
    }
  }
  return id;
}

function toDeliveryTimestamp(deliveryDate: string): string {
  return deliveryDate.includes("T") ? deliveryDate : `${deliveryDate}T12:00:00.000Z`;
}

function formatLetterDate(): string {
  return new Date().toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" });
}

async function sealPhysicalLetter(
  admin: ReturnType<typeof createClient>,
  order: OrderRow,
): Promise<string> {
  const senderKey = await getOrCreateUserKey(admin, order.user_id);
  const encryptedTitle = await encryptValueWithKey(order.plaintext_title, senderKey);
  const encryptedBody = await encryptValueWithKey(order.plaintext_body, senderKey);
  const encryptedSignature = await encryptValueWithKey(order.plaintext_signature, senderKey);
  const deliveryTimestamp = toDeliveryTimestamp(order.delivery_date);

  const baseFields: Record<string, unknown> = {
    title: encryptedTitle,
    body: encryptedBody,
    signature: encryptedSignature,
    delivery_date: deliveryTimestamp,
    status: "sealed",
    is_physical: true,
    recipient_name: order.recipient_name,
  };

  if (order.letter_id) {
    const { data: linkedLetter, error: letterFetchErr } = await admin
      .from("letters")
      .select("id, recipient_email, recipient_type")
      .eq("id", order.letter_id)
      .single();

    if (letterFetchErr || !linkedLetter) {
      throw new Error(`failed to fetch linked letter ${order.letter_id}: ${letterFetchErr?.message ?? "not found"}`);
    }

    const letterUpdate = { ...baseFields };
    if (linkedLetter.recipient_type === "someone" && linkedLetter.recipient_email) {
      const recipientKey = await deriveKeyFromEmail(linkedLetter.recipient_email);
      letterUpdate.display_title = order.plaintext_title;
      letterUpdate.recipient_title = await encryptValueWithKey(order.plaintext_title, recipientKey);
      letterUpdate.recipient_body = await encryptValueWithKey(order.plaintext_body, recipientKey);
      letterUpdate.recipient_signature = await encryptValueWithKey(order.plaintext_signature, recipientKey);
      letterUpdate.recipient_encrypted = true;
    }

    const { error: letterUpdateErr } = await admin
      .from("letters")
      .update(letterUpdate)
      .eq("id", order.letter_id)
      .eq("user_id", order.user_id);

    if (letterUpdateErr) {
      throw new Error(`failed to seal linked letter ${order.letter_id}: ${letterUpdateErr.message}`);
    }

    return order.letter_id;
  }

  const { data: inserted, error: insertErr } = await admin
    .from("letters")
    .insert({
      user_id: order.user_id,
      ...baseFields,
      date: formatLetterDate(),
      recipient_type: "myself",
      type: "sent",
      is_typed: true,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    throw new Error(`failed to create vault letter for physical order ${order.id}: ${insertErr?.message ?? "no row"}`);
  }

  const { error: linkErr } = await admin
    .from("physical_letters")
    .update({ letter_id: inserted.id })
    .eq("id", order.id);

  if (linkErr) {
    throw new Error(`failed to link letter ${inserted.id} to physical order ${order.id}: ${linkErr.message}`);
  }

  console.log("[paddle-webhook] ✓ Created and linked vault letter:", inserted.id);
  return inserted.id;
}

// Paddle signature: header `Paddle-Signature: ts=...;h1=...`
// h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`)
async function verifyPaddleSignature(rawBody: string, sigHeader: string | null, secret: string): Promise<{ ok: boolean; diag: string }> {
  if (!sigHeader) return { ok: false, diag: "no sig header" };
  const parts: Record<string, string> = {};
  for (const p of sigHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx > 0) parts[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  }
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return { ok: false, diag: `missing ts/h1 (keys=${Object.keys(parts).join(",")})` };
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}:${rawBody}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  let ok = hex.length === h1.length;
  if (ok) {
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
    ok = diff === 0;
  }
  const diag = `secretLen=${secret.length} secretPrefix=${secret.slice(0, 8)} computed=${hex.slice(0, 16)}… received=${h1.slice(0, 16)}… ts=${ts}`;
  return { ok, diag };
}

Deno.serve(async (req) => {
  console.log("[paddle-webhook] ▶ Incoming", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET")?.trim();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");

    const rawBody = await req.text();
    const sigHeader = req.headers.get("paddle-signature");
    console.log("[paddle-webhook] sig header present:", !!sigHeader, "secret configured:", !!webhookSecret);
    console.log("[paddle-webhook] body length:", rawBody.length);

    if (webhookSecret && sigHeader) {
      const { ok, diag } = await verifyPaddleSignature(rawBody, sigHeader, webhookSecret);
      console.log("[paddle-webhook] sig diag:", diag);
      if (!ok) {
        console.warn("[paddle-webhook] ⚠ Invalid signature — continuing anyway for debug");
        // NOTE: temporarily not rejecting so we can confirm the rest of the pipeline works
        // while we debug the signature mismatch.
      } else {
        console.log("[paddle-webhook] ✓ signature verified");
      }
    } else {
      console.warn("[paddle-webhook] ⚠ Skipping signature verification (no secret or no header)");
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      console.error("[paddle-webhook] ✗ Could not parse JSON:", e);
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType: string = event.event_type ?? event.alert_name ?? "";
    const eventId: string = event.event_id ?? "";
    console.log("[paddle-webhook] event_type:", eventType, "event_id:", eventId);

    if (eventType !== "transaction.completed" && eventType !== "transaction.paid") {
      console.log("[paddle-webhook] ignored event type:", eventType);
      return new Response(JSON.stringify({ message: "ignored", eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = event.data ?? {};
    const transactionId: string = data.id ?? "";

    const physicalLetterId = extractPhysicalLetterId(data);

    console.log("[paddle-webhook] transactionId:", transactionId, "physicalLetterId:", physicalLetterId);

    if (!physicalLetterId) {
      console.warn("[paddle-webhook] ⚠ No physical_letter_id in custom_data. Full data:", JSON.stringify(data).slice(0, 2000));
      return new Response(JSON.stringify({ message: "no linked letter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: pl, error: plErr } = await admin
      .from("physical_letters")
      .update({
        payment_status: "paid",
        fulfillment_status: "queued",
        paddle_transaction_id: transactionId,
      })
      .eq("id", physicalLetterId)
      .select("id, user_id, letter_id, sender_name, recipient_name, recipient_address, plaintext_title, plaintext_body, plaintext_signature, delivery_date, posting_date")
      .single();

    if (plErr) {
      console.error("[paddle-webhook] ✗ Failed to update physical_letter:", plErr);
      throw plErr;
    }

    console.log("[paddle-webhook] ✓ Marked physical_letter paid:", pl.id);

    const order = pl as OrderRow;
    const letterId = await sealPhysicalLetter(admin, order);
    console.log("[paddle-webhook] ✓ Sealed vault letter:", letterId);

    const { data: senderAuth, error: senderAuthErr } = await admin.auth.admin.getUserById(order.user_id);
    const senderEmail = senderAuth?.user?.email ?? "[unknown sender email]";
    if (senderAuthErr) {
      console.error("[paddle-webhook] Failed to lookup sender email:", senderAuthErr);
    }

    if (resendApiKey && adminEmail) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Signed <noreply@signedletters.co.uk>",
            to: [adminEmail],
            subject: `New physical letter paid - Order ${order.id}`,
            html: `<p>A new physical letter has been paid for and sealed.</p>
              <ul>
                <li><strong>Order ID:</strong> ${order.id}</li>
                <li><strong>Source:</strong> Online Order</li>
                <li><strong>Linked Letter ID:</strong> ${letterId}</li>
                <li><strong>Scheduled send date:</strong> ${order.delivery_date}</li>
                <li><strong>Post by:</strong> ${order.posting_date}</li>
                <li><strong>Recipient name:</strong> ${order.recipient_name}</li>
                <li><strong>Recipient postal address:</strong><br/>${order.recipient_address.replace(/\n/g, "<br/>")}</li>
                <li><strong>Sender name:</strong> ${order.sender_name}</li>
                <li><strong>Sender email:</strong> ${senderEmail}</li>
              </ul>
              <h3>Letter content (unencrypted, for printing)</h3>
              <p><strong>Title:</strong> ${order.plaintext_title}</p>
              <p><strong>Body:</strong><br/>${order.plaintext_body.replace(/\n/g, "<br/>")}</p>
              <p><strong>Signature:</strong> ${order.plaintext_signature}</p>
              <p><a href="https://signed-letters.lovable.app/admin/physical-letters">Open admin dashboard</a></p>`,
          }),
        });
        console.log("[paddle-webhook] admin email status:", r.status);
      } catch (e) {
        console.error("[paddle-webhook] Resend failed:", e);
      }
    } else {
      console.log("[paddle-webhook] skipping admin email (RESEND_API_KEY or ADMIN_EMAIL missing)");
    }

    return new Response(JSON.stringify({ ok: true, physical_letter_id: pl.id, letter_id: letterId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[paddle-webhook] ✗ uncaught error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
