import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(result);
}

async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyData, { name: ALGORITHM, length: KEY_LENGTH }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function decryptValue(encryptedValue: string, key: CryptoKey): Promise<string> {
  if (!encryptedValue || !encryptedValue.startsWith("enc:")) return encryptedValue;
  const combined = Uint8Array.from(atob(encryptedValue.slice(4)), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const encrypted = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

async function encryptValue(value: string, key: CryptoKey): Promise<string> {
  if (!value) return value;
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return "enc:" + uint8ArrayToBase64(combined);
}

interface ReencryptRequest {
  letterIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Supabase credentials not configured");
    }

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderUserId = authUser.id;
    const { letterIds }: ReencryptRequest = await req.json();

    if (!letterIds || letterIds.length === 0) {
      return new Response(JSON.stringify({ message: "No letters to re-encrypt" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to access both sender and recipient keys
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sender's encryption key
    const { data: senderKeyData, error: senderKeyError } = await adminClient
      .from("user_encryption_keys")
      .select("encrypted_key")
      .eq("user_id", senderUserId)
      .single();

    if (senderKeyError || !senderKeyData) {
      throw new Error("Could not fetch sender encryption key");
    }

    const senderKey = await importKey(senderKeyData.encrypted_key);

    let reencryptedCount = 0;
    const errors: string[] = [];

    for (const letterId of letterIds) {
      try {
        // Fetch the letter — verify it belongs to the sender
        const { data: letter, error: letterError } = await adminClient
          .from("letters")
          .select("id, title, body, signature, sketch_data, recipient_user_id, user_id, recipient_encrypted")
          .eq("id", letterId)
          .single();

        if (letterError || !letter) {
          errors.push(`Letter ${letterId}: not found`);
          continue;
        }

        if (letter.user_id !== senderUserId) {
          errors.push(`Letter ${letterId}: not owned by caller`);
          continue;
        }

        if (letter.recipient_encrypted) {
          continue; // Already re-encrypted
        }

        if (!letter.recipient_user_id) {
          errors.push(`Letter ${letterId}: recipient has not signed up yet`);
          continue;
        }

        // Fetch recipient's encryption key
        const { data: recipientKeyData, error: recipientKeyError } = await adminClient
          .from("user_encryption_keys")
          .select("encrypted_key")
          .eq("user_id", letter.recipient_user_id)
          .single();

        if (recipientKeyError || !recipientKeyData) {
          errors.push(`Letter ${letterId}: recipient encryption key not found`);
          continue;
        }

        const recipientKey = await importKey(recipientKeyData.encrypted_key);

        // Decrypt with sender's key
        const plainTitle = await decryptValue(letter.title, senderKey);
        const plainBody = letter.body ? await decryptValue(letter.body, senderKey) : null;
        const plainSignature = await decryptValue(letter.signature, senderKey);
        const plainSketch = letter.sketch_data ? await decryptValue(letter.sketch_data, senderKey) : null;

        // Re-encrypt with recipient's key
        const encTitle = await encryptValue(plainTitle, recipientKey);
        const encBody = plainBody ? await encryptValue(plainBody, recipientKey) : null;
        const encSignature = await encryptValue(plainSignature, recipientKey);
        const encSketch = plainSketch ? await encryptValue(plainSketch, recipientKey) : null;

        // Update the letter
        const { error: updateError } = await adminClient
          .from("letters")
          .update({
            title: encTitle,
            body: encBody,
            signature: encSignature,
            sketch_data: encSketch,
            recipient_encrypted: true,
          })
          .eq("id", letterId);

        if (updateError) {
          errors.push(`Letter ${letterId}: update failed - ${updateError.message}`);
        } else {
          reencryptedCount++;
          console.log(`Successfully re-encrypted letter ${letterId}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Letter ${letterId}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ reencryptedCount, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in reencrypt-for-recipient:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
