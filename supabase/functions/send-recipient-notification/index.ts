import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";
import { format } from "npm:date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Base URL - email will be appended as a query param
const SIGNUP_BASE_URL = "https://signed-letters.lovable.app/auth";

// Email template for initial notification to external recipients
const generateInitialNotificationHtml = (title: string, deliveryDate: string, recipientEmail: string) => {
  const signupUrl = `${SIGNUP_BASE_URL}?mode=signup&email=${encodeURIComponent(recipientEmail)}`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Someone is Sending You a Letter</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #fffcf7 0%, #faf8f5 100%); border-radius: 16px; box-shadow: 0 4px 24px rgba(139, 69, 69, 0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 48px 40px 24px; text-align: center;">
              <!-- Logo mark -->
              <div style="margin-bottom: 32px;">
                <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="4" y1="16" x2="32" y2="16" stroke="#8b4545" stroke-width="2" stroke-linecap="square"/>
                  <circle cx="36" cy="10" r="4" fill="#8b4545"/>
                </svg>
              </div>
              <h1 style="margin: 0 0 8px; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 500; color: #2d2522; letter-spacing: -0.02em;">
                Someone is Sending You a Letter
              </h1>
              <p style="margin: 0; font-size: 15px; color: #7a6f6a; line-height: 1.5;">
                A heartfelt message is being prepared for you
              </p>
            </td>
          </tr>

          <!-- Envelope illustration - sealed/waiting -->
          <tr>
            <td style="padding: 16px 40px 24px; text-align: center;">
              <div style="display: inline-block; position: relative;">
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Envelope body -->
                  <rect x="10" y="20" width="100" height="55" rx="4" fill="#f5ebe0" stroke="#d4c4b5" stroke-width="1.5"/>
                  <!-- Envelope flap (closed) -->
                  <path d="M10 24 L60 48 L110 24" fill="#ebe1d5" stroke="#d4c4b5" stroke-width="1.5" stroke-linejoin="round"/>
                  <!-- Wax seal -->
                  <circle cx="60" cy="50" r="14" fill="#8b4545"/>
                  <circle cx="60" cy="50" r="10" fill="#a05656"/>
                  <!-- Seal mark -->
                  <line x1="52" y1="50" x2="64" y2="50" stroke="#f5ebe0" stroke-width="1.5" stroke-linecap="square"/>
                  <circle cx="68" cy="47" r="2" fill="#f5ebe0"/>
                  <!-- Clock indicator -->
                  <circle cx="95" cy="25" r="12" fill="#ffffff" stroke="#d4c4b5" stroke-width="1"/>
                  <line x1="95" y1="25" x2="95" y2="19" stroke="#8b4545" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="95" y1="25" x2="100" y2="25" stroke="#8b4545" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </td>
          </tr>

          <!-- Letter title and arrival date -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <div style="background: #ffffff; border: 1px solid #ebe5de; border-radius: 12px; padding: 20px 24px;">
                <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a09590;">
                  Letter Title
                </p>
                <p style="margin: 0 0 16px; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #2d2522; font-style: italic;">
                  "${title}"
                </p>
                <div style="border-top: 1px solid #ebe5de; padding-top: 16px;">
                  <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a09590;">
                    Arrives On
                  </p>
                  <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: #8b4545; font-weight: 500;">
                    ${deliveryDate}
                  </p>
                </div>
              </div>
            </td>
          </tr>

          <!-- Intro text -->
          <tr>
            <td style="padding: 0 40px 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #7a6f6a; line-height: 1.6;">
                Create a free account now so your letter will be waiting in your vault when it arrives.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="${signupUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b4545 0%, #6d3535 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border-radius: 50px; letter-spacing: 0.02em; box-shadow: 0 4px 16px rgba(139, 69, 69, 0.25);">
                Create Your Account
              </a>
            </td>
          </tr>

          <!-- Footer -->
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

        <!-- Unsubscribe -->
        <p style="margin: 24px 0 0; font-size: 11px; color: #c4bbb5;">
          You received this because someone sent you a letter through signed.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// Detect if a title is encrypted (has 'enc:' prefix from client-side encryption)
function getSafeDisplayTitle(title: string): string {
  if (title.startsWith('enc:')) return "A note is waiting for you";
  return title;
}

interface NotificationRequest {
  letterId: string;
  plaintextTitle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const { letterId, plaintextTitle }: NotificationRequest = await req.json();

    if (!letterId) {
      throw new Error("Letter ID is required");
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the letter
    const { data: letter, error: fetchError } = await supabase
      .from("letters")
      .select("id, title, recipient_email, recipient_type, delivery_date, initial_notification_sent")
      .eq("id", letterId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch letter: ${fetchError.message}`);
    }

    if (!letter) {
      throw new Error("Letter not found");
    }

    // Validate this is a letter for someone else
    if (letter.recipient_type !== "someone" || !letter.recipient_email) {
      throw new Error("This letter is not for an external recipient");
    }

    // Check if initial notification was already sent
    if (letter.initial_notification_sent) {
      return new Response(JSON.stringify({ message: "Initial notification already sent", skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format the delivery date
    const deliveryDate = format(new Date(letter.delivery_date), "MMMM d, yyyy");

    // Ensure title is safe to display (not encrypted ciphertext)
    const displayTitle = plaintextTitle || getSafeDisplayTitle(letter.title);

    // Send the initial notification email
    const emailResponse = await resend.emails.send({
      from: "signed <team@notify.signedletter.com>",
      to: [letter.recipient_email],
      subject: `Someone is sending you a letter: "${displayTitle}"`,
      html: generateInitialNotificationHtml(displayTitle, deliveryDate, letter.recipient_email),
    });

    console.log(`Initial notification sent to ${letter.recipient_email} for letter ${letter.id}:`, emailResponse);

    // Mark initial notification as sent
    const { error: updateError } = await supabase
      .from("letters")
      .update({ initial_notification_sent: true })
      .eq("id", letter.id);

    if (updateError) {
      console.error(`Failed to mark initial notification as sent for letter ${letter.id}:`, updateError);
      // Don't throw - the email was sent successfully
    }

    return new Response(
      JSON.stringify({
        message: "Initial notification sent successfully",
        emailId: emailResponse.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-recipient-notification:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
