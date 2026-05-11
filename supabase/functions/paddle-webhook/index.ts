// Paddle webhook: verifies signature, marks physical_letters paid, and emails admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paddle-signature",
};

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
      const ok = await verifyPaddleSignature(rawBody, sigHeader, webhookSecret);
      if (!ok) {
        console.warn("[paddle-webhook] ⚠ Invalid signature — rejecting");
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[paddle-webhook] ✓ signature verified");
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

    // physical_letter_id may live on the top-level custom_data, or on an item's
    // price.custom_data, depending on how the checkout was opened.
    let physicalLetterId: string | undefined =
      data?.custom_data?.physical_letter_id ??
      data?.checkout?.custom_data?.physical_letter_id;

    if (!physicalLetterId && Array.isArray(data.items)) {
      for (const item of data.items) {
        const cd = item?.price?.custom_data ?? item?.custom_data;
        if (cd?.physical_letter_id) {
          physicalLetterId = cd.physical_letter_id;
          break;
        }
      }
    }

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
      .select()
      .single();

    if (plErr) {
      console.error("[paddle-webhook] ✗ Failed to update physical_letter:", plErr);
      throw plErr;
    }

    console.log("[paddle-webhook] ✓ Marked physical_letter paid:", pl.id);

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
            subject: `📮 New physical letter paid — post by ${pl.posting_date}`,
            html: `<p>A new physical letter has been paid for.</p>
              <ul>
                <li><strong>Recipient:</strong> ${pl.recipient_name}</li>
                <li><strong>Posting date:</strong> ${pl.posting_date}</li>
                <li><strong>Delivery date:</strong> ${pl.delivery_date}</li>
              </ul>
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

    return new Response(JSON.stringify({ ok: true, physical_letter_id: pl.id }), {
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
