import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VAULT_URL = "https://signed-letters.lovable.app/vault";
const SIGNUP_URL = "https://signed-letters.lovable.app/auth";

// Email template for letter author (self-sent letters)
const generateAuthorEmailHtml = (title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Letter Has Arrived</title>
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
                Your Letter Has Arrived
              </h1>
              <p style="margin: 0; font-size: 15px; color: #7a6f6a; line-height: 1.5;">
                The moment you've been waiting for is here
              </p>
            </td>
          </tr>

          <!-- Envelope illustration -->
          <tr>
            <td style="padding: 16px 40px 24px; text-align: center;">
              <div style="display: inline-block; position: relative;">
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Envelope body -->
                  <rect x="10" y="20" width="100" height="55" rx="4" fill="#f5ebe0" stroke="#d4c4b5" stroke-width="1.5"/>
                  <!-- Envelope flap -->
                  <path d="M10 24 L60 48 L110 24" fill="#faf5ef" stroke="#d4c4b5" stroke-width="1.5" stroke-linejoin="round"/>
                  <!-- Wax seal -->
                  <circle cx="60" cy="50" r="14" fill="#8b4545"/>
                  <circle cx="60" cy="50" r="10" fill="#a05656"/>
                  <!-- Seal mark -->
                  <line x1="52" y1="50" x2="64" y2="50" stroke="#f5ebe0" stroke-width="1.5" stroke-linecap="square"/>
                  <circle cx="68" cy="47" r="2" fill="#f5ebe0"/>
                </svg>
              </div>
            </td>
          </tr>

          <!-- Letter title -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <div style="background: #ffffff; border: 1px solid #ebe5de; border-radius: 12px; padding: 20px 24px;">
                <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a09590;">
                  Letter Title
                </p>
                <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #2d2522; font-style: italic;">
                  "${title}"
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="${VAULT_URL}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b4545 0%, #6d3535 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border-radius: 50px; letter-spacing: 0.02em; box-shadow: 0 4px 16px rgba(139, 69, 69, 0.25);">
                Open Your Vault
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
          You received this because you have a letter waiting in your vault.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Email template for external recipients (invitation to view letter)
const generateRecipientEmailHtml = (title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Someone Sent You a Letter</title>
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
                Someone Sent You a Letter
              </h1>
              <p style="margin: 0; font-size: 15px; color: #7a6f6a; line-height: 1.5;">
                A heartfelt message is waiting for you
              </p>
            </td>
          </tr>

          <!-- Envelope illustration -->
          <tr>
            <td style="padding: 16px 40px 24px; text-align: center;">
              <div style="display: inline-block; position: relative;">
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Envelope body -->
                  <rect x="10" y="20" width="100" height="55" rx="4" fill="#f5ebe0" stroke="#d4c4b5" stroke-width="1.5"/>
                  <!-- Envelope flap -->
                  <path d="M10 24 L60 48 L110 24" fill="#faf5ef" stroke="#d4c4b5" stroke-width="1.5" stroke-linejoin="round"/>
                  <!-- Wax seal -->
                  <circle cx="60" cy="50" r="14" fill="#8b4545"/>
                  <circle cx="60" cy="50" r="10" fill="#a05656"/>
                  <!-- Seal mark -->
                  <line x1="52" y1="50" x2="64" y2="50" stroke="#f5ebe0" stroke-width="1.5" stroke-linecap="square"/>
                  <circle cx="68" cy="47" r="2" fill="#f5ebe0"/>
                </svg>
              </div>
            </td>
          </tr>

          <!-- Letter title -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <div style="background: #ffffff; border: 1px solid #ebe5de; border-radius: 12px; padding: 20px 24px;">
                <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #a09590;">
                  Letter Title
                </p>
                <p style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #2d2522; font-style: italic;">
                  "${title}"
                </p>
              </div>
            </td>
          </tr>

          <!-- Intro text -->
          <tr>
            <td style="padding: 0 40px 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #7a6f6a; line-height: 1.6;">
                Create a free account to read your letter and keep it safe in your personal vault.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="${SIGNUP_URL}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b4545 0%, #6d3535 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border-radius: 50px; letter-spacing: 0.02em; box-shadow: 0 4px 16px rgba(139, 69, 69, 0.25);">
                Create Account to Read
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

interface LetterToNotify {
  id: string;
  title: string;
  user_id: string;
  recipient_email: string | null;
  recipient_type: string;
  recipient_user_id: string | null;
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

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get end of today (23:59:59.999) to include all letters scheduled for today
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Find letters that are ready to be opened and haven't been notified
    const { data: letters, error: fetchError } = await supabase
      .from("letters")
      .select("id, title, user_id, recipient_email, recipient_type, recipient_user_id")
      .lte("delivery_date", endOfToday.toISOString())
      .eq("notification_sent", false);

    if (fetchError) {
      throw new Error(`Failed to fetch letters: ${fetchError.message}`);
    }

    if (!letters || letters.length === 0) {
      return new Response(JSON.stringify({ message: "No letters to notify", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${letters.length} letters to notify`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const letter of letters as LetterToNotify[]) {
      try {
        // Determine who to notify based on recipient type
        const isForSomeoneElse = letter.recipient_type === "someone" && letter.recipient_email;
        
        let targetEmail: string;
        let emailHtml: string;
        let emailSubject: string;

        if (isForSomeoneElse) {
          // Letter is for an external recipient
          targetEmail = letter.recipient_email!;
          emailHtml = generateRecipientEmailHtml(letter.title);
          emailSubject = `You've received a letter: "${letter.title}"`;
          console.log(`Sending invitation email to recipient: ${targetEmail}`);
        } else {
          // Letter is for the author (self-sent)
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(letter.user_id);

          if (userError || !userData?.user?.email) {
            console.error(`Could not get email for user ${letter.user_id}:`, userError);
            errors.push(`Letter ${letter.id}: Could not find user email`);
            continue;
          }

          targetEmail = userData.user.email;
          emailHtml = generateAuthorEmailHtml(letter.title);
          emailSubject = `Your letter "${letter.title}" is ready to open`;
        }

        // Send the notification email
        const emailResponse = await resend.emails.send({
          from: "signed <onboarding@resend.dev>", // Replace with your verified domain
          to: [targetEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`Email sent to ${targetEmail} for letter ${letter.id}:`, emailResponse);

        // Mark letter as notified
        const { error: updateError } = await supabase
          .from("letters")
          .update({ notification_sent: true })
          .eq("id", letter.id);

        if (updateError) {
          console.error(`Failed to mark letter ${letter.id} as notified:`, updateError);
          errors.push(`Letter ${letter.id}: Failed to update notification status`);
        } else {
          sentCount++;
        }
      } catch (letterError: unknown) {
        const errorMessage = letterError instanceof Error ? letterError.message : String(letterError);
        console.error(`Error processing letter ${letter.id}:`, letterError);
        errors.push(`Letter ${letter.id}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sentCount} notifications`,
        count: sentCount,
        total: letters.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-letter-notifications:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
