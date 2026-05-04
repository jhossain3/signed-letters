// Paddle webhook: verifies signature, marks physical_letters paid, and emails admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paddle-signature",
};

// Paddle signature: header `Paddle-Signature: ts=...;h1=...`
// h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`)
async function verifyPaddleSignature(rawBody: string, sigHeader: string | null, secret: string): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(";").map((p) => p.split("=") as [string, string]));
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
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
  // Constant-time compare
  if (hex.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");

    const rawBody = await req.text();
    const sigHeader = req.headers.get("paddle-signature");

    if (webhookSecret) {
      const ok = await verifyPaddleSignature(rawBody, sigHeader, webhookSecret);
      if (!ok) {
        console.warn("[paddle-webhook] Invalid signature");
        return new Response(JSON.stringify({ error: "invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("[paddle-webhook] PADDLE_WEBHOOK_SECRET not set — skipping verification (dev only)");
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event_type ?? event.alert_name ?? "";
    console.log("[paddle-webhook] event:", eventType);

    // We accept transaction.completed (Paddle Billing v2)
    if (eventType !== "transaction.completed" && eventType !== "transaction.paid") {
      return new Response(JSON.stringify({ message: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = event.data ?? {};
    const customData = data.custom_data ?? {};
    const physicalLetterId: string | undefined = customData.physical_letter_id;
    const transactionId: string = data.id ?? "";

    if (!physicalLetterId) {
      console.warn("[paddle-webhook] No physical_letter_id in custom_data");
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
      console.error("[paddle-webhook] Failed to update physical_letter:", plErr);
      throw plErr;
    }

    // Notify admin
    if (resendApiKey && adminEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
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
      } catch (e) {
        console.error("[paddle-webhook] Resend failed:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[paddle-webhook] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
