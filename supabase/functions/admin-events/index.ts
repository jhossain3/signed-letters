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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated and is the admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for bypassing RLS
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (req.method === "GET") {
      if (action === "list-events") {
        // Get all events with submission counts
        const { data: events, error } = await admin
          .from("events")
          .select("*")
          .order("event_date", { ascending: false });
        if (error) throw error;

        // Get submission counts
        const { data: counts, error: countError } = await admin
          .from("event_submissions")
          .select("event_id");
        if (countError) throw countError;

        const countMap: Record<string, number> = {};
        for (const c of counts || []) {
          countMap[c.event_id] = (countMap[c.event_id] || 0) + 1;
        }

        const result = (events || []).map((e: any) => ({
          ...e,
          submission_count: countMap[e.id] || 0,
        }));

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "list-submissions") {
        const eventId = url.searchParams.get("event_id");
        if (!eventId) {
          return new Response(JSON.stringify({ error: "event_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: submissions, error } = await admin
          .from("event_submissions")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false });
        if (error) throw error;

        // Fetch user emails from auth.users
        const userIds = [...new Set((submissions || []).map((s: any) => s.user_id))];
        const emailMap: Record<string, string> = {};
        for (const uid of userIds) {
          const { data: userData } = await admin.auth.admin.getUserById(uid);
          if (userData?.user?.email) {
            emailMap[uid] = userData.user.email;
          }
        }

        const result = (submissions || []).map((s: any) => ({
          ...s,
          user_email: emailMap[s.user_id] || "Unknown",
        }));

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "create-event") {
        const { name, slug, event_date, location } = body;
        if (!name || !slug || !event_date) {
          return new Response(JSON.stringify({ error: "name, slug, event_date required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data, error } = await admin
          .from("events")
          .insert({ name, slug, event_date, location: location || null })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "toggle-active") {
        const { event_id, active } = body;
        const { data, error } = await admin
          .from("events")
          .update({ active })
          .eq("id", event_id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
