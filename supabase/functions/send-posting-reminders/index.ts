import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "yasminshahid1711@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in YYYY-MM-DD format (UTC)
    const today = new Date().toISOString().split("T")[0];

    // Query submissions where posting_date = today
    const { data: submissions, error } = await admin
      .from("event_submissions")
      .select("id, name, recipient_name, recipient_address, event_id")
      .eq("posting_date", today);

    if (error) throw error;

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ message: "No letters to post today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = submissions.length;
    const formattedDate = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Signed Letters <noreply@signedletters.co.uk>",
        to: [ADMIN_EMAIL],
        subject: `Letters to post today — ${formattedDate}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background-color: #faf9f6; color: #1a1a1a;">
            <h1 style="font-size: 22px; margin-bottom: 16px;">📮 Letters to post today</h1>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              You have <strong>${count}</strong> letter${count !== 1 ? "s" : ""} to post today (${formattedDate}).
            </p>
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
              Log in to your admin dashboard to view the details and manage posting.
            </p>
            <a href="https://signed-letters.lovable.app/admin/events"
               style="display: inline-block; padding: 12px 24px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">
              View Admin Dashboard →
            </a>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      throw new Error(`Resend API failed [${emailRes.status}]: ${errBody}`);
    }

    return new Response(
      JSON.stringify({ message: `Reminder sent for ${count} letter(s)` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in send-posting-reminders:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
