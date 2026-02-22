import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Background hook that triggers server-side re-encryption of "someone" letters
 * after the recipient has signed up (recipient_user_id is set).
 * 
 * Runs silently on sender login. Finds letters where:
 * - user_id = current user (sender)
 * - recipient_type = "someone"
 * - recipient_user_id IS NOT NULL (recipient signed up)
 * - recipient_encrypted = false (not yet re-encrypted)
 * 
 * Then calls the reencrypt-for-recipient edge function which has service-role
 * access to both sender and recipient encryption keys.
 */
export function useReencryptForRecipients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user || hasRun.current) return;
    hasRun.current = true;

    const reencrypt = async () => {
      try {
        // Find letters needing re-encryption
        const { data: letters, error } = await supabase
          .from("letters")
          .select("id")
          .eq("user_id", user.id)
          .eq("recipient_type", "someone")
          .eq("recipient_encrypted", false)
          .not("recipient_user_id", "is", null);

        if (error || !letters || letters.length === 0) return;

        console.log(`[ReEncrypt] Found ${letters.length} letters to re-encrypt for recipients`);

        const letterIds = letters.map((l) => l.id);

        // Call edge function to perform re-encryption server-side
        const { data, error: fnError } = await supabase.functions.invoke("reencrypt-for-recipient", {
          body: { letterIds },
        });

        if (fnError) {
          console.error("[ReEncrypt] Edge function error:", fnError);
          return;
        }

        console.log("[ReEncrypt] Result:", data);

        if (data?.reencryptedCount > 0) {
          // Invalidate letters query to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["letters", user.id] });
        }
      } catch (err) {
        console.error("[ReEncrypt] Error in re-encryption check:", err);
      }
    };

    reencrypt();
  }, [user, queryClient]);
}
