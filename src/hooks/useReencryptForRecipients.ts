import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { decryptLetterFields } from "@/lib/encryption";
import {
  getCachedRsaPrivateKey,
  getCachedRsaPublicKey,
  fetchRecipientRsaPublicKey,
  envelopeEncryptLetter,
} from "@/lib/rsaEncryption";

/**
 * Background hook that handles re-encryption of "someone" letters.
 *
 * Two paths:
 * 1. NEW (RSA/envelope): If both sender and recipient have RSA keys, and the
 *    letter doesn't yet have sender_wrapped_content_key populated, decrypt with
 *    sender's AES key and re-encrypt using envelope encryption (client-side).
 * 2. LEGACY (server-side): For V1 users without RSA keys, call the existing
 *    reencrypt-for-recipient edge function.
 *
 * Skips letters where sender_wrapped_content_key is already populated.
 */
export function useReencryptForRecipients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || hasRun.current) return;

    const reencrypt = async () => {
      // Wait for RSA keys to be cached (they load asynchronously after sign-in)
      let senderRsaPrivateKey = getCachedRsaPrivateKey();
      let senderRsaPublicKey = getCachedRsaPublicKey();

      if (!senderRsaPrivateKey || !senderRsaPublicKey) {
        // Retry up to 5 times with 1s delay for RSA keys to load
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          senderRsaPrivateKey = getCachedRsaPrivateKey();
          senderRsaPublicKey = getCachedRsaPublicKey();
          if (senderRsaPrivateKey && senderRsaPublicKey) break;
        }
        console.log(`[ReEncrypt] After waiting: RSA keys cached: private=${!!senderRsaPrivateKey}, public=${!!senderRsaPublicKey}`);
      }

      try {
        const { data: letters, error } = await supabase
          .from("letters")
          .select("id, recipient_email, recipient_user_id, sender_wrapped_content_key, recipient_encrypted")
          .eq("user_id", user.id)
          .eq("recipient_type", "someone")
          .not("recipient_user_id", "is", null);

        if (error || !letters || letters.length === 0) {
          console.log("[ReEncrypt] No letters found or error:", error);
          return;
        }

        console.log(`[ReEncrypt] Found ${letters.length} 'someone' letters with recipient_user_id set`);

        // Filter to letters that still need processing
        const pendingLetters = letters.filter(
          (l) => !l.sender_wrapped_content_key && !l.recipient_encrypted
        );

        console.log(`[ReEncrypt] ${pendingLetters.length} letters need re-encryption`);
        if (pendingLetters.length === 0) return;

        // Split into RSA-capable and legacy
        const rsaLetterIds: string[] = [];
        const legacyLetterIds: string[] = [];

        if (senderRsaPrivateKey && senderRsaPublicKey) {
          // Check each letter's recipient for RSA capability
          for (const letter of pendingLetters) {
            if (!letter.recipient_email) {
              legacyLetterIds.push(letter.id);
              continue;
            }

            const recipientPubKey = await fetchRecipientRsaPublicKey(letter.recipient_email);
            if (recipientPubKey) {
              rsaLetterIds.push(letter.id);
            } else {
              // Recipient doesn't have RSA keys yet — skip for now
              console.log(`[ReEncrypt] Recipient for letter ${letter.id} doesn't have RSA keys yet, skipping`);
            }
          }
        } else {
          // Sender doesn't have RSA keys — use legacy path for all
          legacyLetterIds.push(...pendingLetters.map((l) => l.id));
        }

        // ── RSA path: client-side envelope re-encryption ──
        if (rsaLetterIds.length > 0 && senderRsaPrivateKey && senderRsaPublicKey) {
          console.log(`[ReEncrypt] Re-encrypting ${rsaLetterIds.length} letters via RSA envelope (client-side)`);

          for (const letterId of rsaLetterIds) {
            try {
              // Fetch the full letter
              const { data: letterRow, error: fetchErr } = await supabase
                .from("letters")
                .select("*")
                .eq("id", letterId)
                .single();

              if (fetchErr || !letterRow) continue;

              // Decrypt with sender's AES master key
              const decrypted = await decryptLetterFields(
                {
                  title: letterRow.title,
                  body: letterRow.body,
                  signature: letterRow.signature,
                  sketchData: letterRow.sketch_data,
                },
                user.id
              );

              // Get recipient's RSA public key
              const recipientPubKey = await fetchRecipientRsaPublicKey(letterRow.recipient_email!);
              if (!recipientPubKey) continue;

              // Envelope encrypt
              const envelope = await envelopeEncryptLetter(
                decrypted,
                senderRsaPublicKey,
                recipientPubKey
              );

              // Update letter in DB
              const { error: updateErr } = await supabase
                .from("letters")
                .update({
                  title: envelope.title,
                  body: envelope.body,
                  signature: envelope.signature,
                  sketch_data: envelope.sketchData,
                  sender_wrapped_content_key: envelope.senderWrappedContentKey,
                  recipient_wrapped_content_key: envelope.recipientWrappedContentKey,
                  recipient_encrypted: true,
                })
                .eq("id", letterId);

              if (updateErr) {
                console.error(`[ReEncrypt] Failed to update letter ${letterId}:`, updateErr);
              } else {
                console.log(`[ReEncrypt] Letter ${letterId} envelope-encrypted successfully`);
              }
            } catch (err) {
              console.error(`[ReEncrypt] Error processing letter ${letterId}:`, err);
            }
          }

          queryClient.invalidateQueries({ queryKey: ["letters", user.id] });
        }

        // ── Legacy path: server-side re-encryption (V1 users only) ──
        if (legacyLetterIds.length > 0 && !senderRsaPublicKey) {
          console.log(`[ReEncrypt] Found ${legacyLetterIds.length} letters for legacy server-side re-encryption`);

          const { data, error: fnError } = await supabase.functions.invoke("reencrypt-for-recipient", {
            body: { letterIds: legacyLetterIds },
          });

          if (fnError) {
            console.error("[ReEncrypt] Edge function error:", fnError);
            return;
          }

          console.log("[ReEncrypt] Legacy result:", data);

          if (data?.reencryptedCount > 0) {
            queryClient.invalidateQueries({ queryKey: ["letters", user.id] });
          }
        }
      } catch (err) {
        console.error("[ReEncrypt] Error in re-encryption check:", err);
      }
    };

    hasRun.current = true;
    reencrypt();
  }, [user, queryClient]);
}
