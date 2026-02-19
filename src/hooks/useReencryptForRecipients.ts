import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { decryptValue, encryptValue } from "@/lib/encryption";

/**
 * Background hook that re-encrypts "someone" letters with the recipient's key
 * after the recipient has signed up (recipient_user_id is set).
 * 
 * Runs silently on sender login. Finds letters where:
 * - user_id = current user (sender)
 * - recipient_type = "someone"
 * - recipient_user_id IS NOT NULL (recipient signed up)
 * - recipient_encrypted = false (not yet re-encrypted)
 * 
 * For each, decrypts with sender's key, re-encrypts with recipient's key,
 * and updates the DB row.
 */
export function useReencryptForRecipients() {
  const { user } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || hasRun.current) return;
    hasRun.current = true;

    const reencrypt = async () => {
      try {
        // Find letters needing re-encryption
        const { data: letters, error } = await supabase
          .from("letters")
          .select("id, title, body, signature, sketch_data, recipient_user_id")
          .eq("user_id", user.id)
          .eq("recipient_type", "someone")
          .eq("recipient_encrypted", false)
          .not("recipient_user_id", "is", null);

        if (error || !letters || letters.length === 0) return;

        console.log(`[ReEncrypt] Found ${letters.length} letters to re-encrypt for recipients`);

        for (const letter of letters) {
          try {
            const recipientUserId = letter.recipient_user_id!;

            // Decrypt with sender's key
            const [plainTitle, plainBody, plainSignature, plainSketch] = await Promise.all([
              decryptValue(letter.title, user.id),
              letter.body ? decryptValue(letter.body, user.id) : Promise.resolve(null),
              decryptValue(letter.signature, user.id),
              letter.sketch_data ? decryptValue(letter.sketch_data, user.id) : Promise.resolve(null),
            ]);

            // Re-encrypt with recipient's key
            const [encTitle, encBody, encSignature, encSketch] = await Promise.all([
              encryptValue(plainTitle, recipientUserId),
              plainBody ? encryptValue(plainBody, recipientUserId) : Promise.resolve(null),
              encryptValue(plainSignature, recipientUserId),
              plainSketch ? encryptValue(plainSketch, recipientUserId) : Promise.resolve(null),
            ]);

            // Update the letter with recipient-encrypted content
            const { error: updateError } = await supabase
              .from("letters")
              .update({
                title: encTitle,
                body: encBody,
                signature: encSignature,
                sketch_data: encSketch,
                recipient_encrypted: true,
              })
              .eq("id", letter.id);

            if (updateError) {
              console.error(`[ReEncrypt] Failed to update letter ${letter.id}:`, updateError);
            } else {
              console.log(`[ReEncrypt] Successfully re-encrypted letter ${letter.id} for recipient`);
            }
          } catch (err) {
            console.error(`[ReEncrypt] Error re-encrypting letter ${letter.id}:`, err);
          }
        }
      } catch (err) {
        console.error("[ReEncrypt] Error in re-encryption check:", err);
      }
    };

    reencrypt();
  }, [user]);
}
