import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user with their own token
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role client to delete all data
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete in order: letters, encryption keys, event submissions, then auth user
    const { error: lettersError } = await serviceClient
      .from("letters")
      .delete()
      .eq("user_id", userId);
    if (lettersError) throw new Error(`Failed to delete letters: ${lettersError.message}`);

    // Also delete letters where user is recipient
    await serviceClient
      .from("letters")
      .delete()
      .eq("recipient_user_id", userId);

    const { error: keysError } = await serviceClient
      .from("user_encryption_keys")
      .delete()
      .eq("user_id", userId);
    if (keysError) throw new Error(`Failed to delete encryption keys: ${keysError.message}`);

    const { error: subsError } = await serviceClient
      .from("event_submissions")
      .delete()
      .eq("user_id", userId);
    if (subsError) throw new Error(`Failed to delete event submissions: ${subsError.message}`);

    // Delete the auth user last
    const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Failed to delete auth user: ${authError.message}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete account" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
