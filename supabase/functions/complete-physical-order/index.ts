/// <reference types="deno" />
// Fallback when paddle-webhook is delayed: verifies a paid Paddle transaction and creates the order.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mergeCustomData,
  parsePhysicalOrderPayload,
  type PhysicalOrderPayload,
} from "../_shared/physicalOrder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchPaddleTransaction(
  transactionId: string,
): Promise<Record<string, unknown> | null> {
  const environment = (Deno.env.get("PADDLE_ENVIRONMENT") ?? "sandbox").trim();
  const suffix = environment === "production" ? "_LIVE" : "_SANDBOX";
  const apiKey = Deno.env.get(`PADDLE_API_KEY${suffix}`)?.trim();
  if (!apiKey) return null;

  const base =
    environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

  const res = await fetch(`${base}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    console.error("[complete-physical-order] Paddle API error:", res.status, await res.text());
    return null;
  }

  const json = await res.json();
  return (json?.data ?? json) as Record<string, unknown>;
}

async function upsertPaidOrder(
  admin: ReturnType<typeof createClient>,
  transactionId: string,
  payload: PhysicalOrderPayload,
) {
  const { data: existing } = await admin
    .from("physical_letters")
    .select("id, payment_status, letter_id")
    .eq("id", payload.physical_order_id)
    .maybeSingle();

  if (existing?.payment_status === "paid") {
    return existing;
  }

  if (existing) {
    const { data, error } = await admin
      .from("physical_letters")
      .update({
        payment_status: "paid",
        fulfillment_status: "queued",
        paddle_transaction_id: transactionId,
      })
      .eq("id", payload.physical_order_id)
      .select("id, payment_status, letter_id")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("physical_letters")
    .insert({
      id: payload.physical_order_id,
      user_id: payload.user_id,
      letter_id: null,
      sender_name: payload.sender_name,
      recipient_name: payload.recipient_name,
      recipient_address: payload.recipient_address,
      plaintext_title: payload.plaintext_title,
      plaintext_body: payload.plaintext_body,
      plaintext_signature: payload.plaintext_signature,
      delivery_date: payload.delivery_date,
      posting_date: payload.posting_date,
      payment_status: "paid",
      fulfillment_status: "queued",
      paddle_transaction_id: transactionId,
      paddle_price_id: payload.paddle_price_id ?? null,
    })
    .select("id, payment_status, letter_id")
    .single();

  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, transactionId } = await req.json();
    if (!orderId || !transactionId) {
      return new Response(JSON.stringify({ error: "orderId and transactionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await admin
      .from("physical_letters")
      .select("id, payment_status, letter_id")
      .eq("id", orderId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (existing?.payment_status === "paid") {
      return new Response(JSON.stringify({ ok: true, physical_letter_id: existing.id, letter_id: existing.letter_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txn = await fetchPaddleTransaction(transactionId);
    if (!txn) {
      return new Response(JSON.stringify({ error: "Could not verify payment" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = txn.status as string | undefined;
    if (status !== "completed" && status !== "paid") {
      return new Response(JSON.stringify({ error: "Payment not completed" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customData = mergeCustomData(txn);
    const payload = parsePhysicalOrderPayload(customData);
    if (!payload || payload.physical_order_id !== orderId) {
      return new Response(JSON.stringify({ error: "Order mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.user_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = await upsertPaidOrder(admin, transactionId, payload);

    return new Response(
      JSON.stringify({ ok: true, physical_letter_id: row.id, letter_id: row.letter_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[complete-physical-order]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
