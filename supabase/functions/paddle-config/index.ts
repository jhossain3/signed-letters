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

  const clientToken = Deno.env.get("PADDLE_CLIENT_TOKEN");
  const sellerId = Deno.env.get("PADDLE_SELLER_ID");
  const priceId = Deno.env.get("PADDLE_PRICE_ID");
  const environment = (Deno.env.get("PADDLE_ENVIRONMENT") ?? "sandbox") as "sandbox" | "production";

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
