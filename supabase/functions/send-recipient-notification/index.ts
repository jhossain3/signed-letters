// DISABLED: Early recipient notifications were removed.
// The recipient now receives exactly one email — on the delivery date — via
// the `send-letter-notifications` function. This endpoint is kept as a no-op
// so any stale callers don't fail loudly, but it never sends email.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  console.log("[send-recipient-notification] called but disabled — no email sent");
  return new Response(
    JSON.stringify({ message: "disabled: early recipient notifications removed", skipped: true }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
