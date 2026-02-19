import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://signed-letters.lovable.app";

const generateSenderNudgeHtml = (recipientEmail: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Recipient Has Joined</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #fffcf7 0%, #faf8f5 100%); border-radius: 16px; box-shadow: 0 4px 24px rgba(139, 69, 69, 0.08); overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px 24px; text-align: center;">
              <div style="margin-bottom: 32px;">
                <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="4" y1="16" x2="32" y2="16" stroke="#8b4545" stroke-width="2" stroke-linecap="square"/>
                  <circle cx="36" cy="10" r="4" fill="#8b4545"/>
                </svg>
              </div>
              <h1 style="margin: 0 0 8px; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 500; color: #2d2522; letter-spacing: -0.02em;">
                Your Recipient Has Joined
              </h1>
              <p style="margin: 0; font-size: 15px; color: #7a6f6a; line-height: 1.5;">
                Great news — <strong>${recipientEmail}</strong> has created their account on signed
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #7a6f6a; line-height: 1.6;">
                Open the app to complete the secure delivery of your letter. Once you sign in, your letter will be securely prepared for them to read.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="${APP_URL}/vault" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b4545 0%, #6d3535 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border-radius: 50px; letter-spacing: 0.02em; box-shadow: 0 4px 16px rgba(139, 69, 69, 0.25);">
                Open Your Vault
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center; border-top: 1px solid #ebe5de;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #a09590;">
                This letter was written with intention, sealed with care
              </p>
              <p style="margin: 0; font-size: 12px; color: #c4bbb5;">
                signed • letters for later
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 11px; color: #c4bbb5;">
          You received this because you sent a letter through signed.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

interface NotifyRequest {
  recipientEmail: string;
  senderUserId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase credentials not configured");

    const { recipientEmail, senderUserId }: NotifyRequest = await req.json();
    if (!recipientEmail || !senderUserId) throw new Error("recipientEmail and senderUserId are required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Get sender's email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(senderUserId);
    if (userError || !userData?.user?.email) {
      throw new Error(`Could not find sender email: ${userError?.message}`);
    }

    const senderEmail = userData.user.email;

    // Send nudge email to the sender
    const emailResponse = await resend.emails.send({
      from: "signed <team@notify.signedletter.com>",
      to: [senderEmail],
      subject: `Your recipient ${recipientEmail} has joined signed`,
      html: generateSenderNudgeHtml(recipientEmail),
    });

    console.log(`Sender nudge sent to ${senderEmail} about ${recipientEmail}:`, emailResponse);

    return new Response(
      JSON.stringify({ message: "Sender nudge sent", emailId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in notify-sender-recipient-joined:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
