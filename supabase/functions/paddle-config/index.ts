// Returns Paddle publishable config (client token + seller id + price id + environment)
// to the frontend. These values are publishable but we keep them server-side so
// they can be rotated without redeploying the SPA.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const environment = ((Deno.env.get("PADDLE_ENVIRONMENT") ?? "sandbox").trim()) as "sandbox" | "production";
  const suffix = environment === "production" ? "_LIVE" : "_SANDBOX";
  const pick = (name: string) => Deno.env.get(`${name}${suffix}`)?.trim();

  const clientToken = pick("PADDLE_CLIENT_TOKEN");
  const sellerId = Deno.env.get("PADDLE_SELLER_ID")?.trim();
  const priceId = pick("PADDLE_PRICE_ID");

  if (!clientToken || !sellerId || !priceId) {
    return new Response(
      JSON.stringify({ error: "Paddle is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ clientToken, sellerId, priceId, environment }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
