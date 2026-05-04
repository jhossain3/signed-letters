// Daily reminder of physical letters that need to be posted today.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];

    const { data: rows, error } = await admin
      .from("physical_letters")
      .select("id, recipient_name, posting_date, delivery_date")
      .eq("payment_status", "paid")
      .eq("fulfillment_status", "queued")
      .lte("posting_date", today);

    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ message: "Nothing to post today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list = rows
      .map((r) => `<li>${r.recipient_name} — post by <strong>${r.posting_date}</strong> (delivery ${r.delivery_date})</li>`)
      .join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Signed <noreply@signedletters.co.uk>",
        to: [adminEmail],
        subject: `📮 ${rows.length} physical letter${rows.length === 1 ? "" : "s"} to post today`,
        html: `<p>You have <strong>${rows.length}</strong> physical letter${rows.length === 1 ? "" : "s"} to post today.</p>
          <ul>${list}</ul>
          <p><a href="https://signed-letters.lovable.app/admin/physical-letters">Open admin dashboard</a></p>`,
      }),
    });

    return new Response(JSON.stringify({ count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[physical-letters-reminder] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
