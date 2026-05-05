import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddle } from "@/hooks/usePaddle";
import { calculatePostingDate } from "@/config/physicalLetter";

export interface PhysicalLetterDraft {
  letterId: string | null;
  senderName: string;
  recipientName: string;
  recipientAddress: string;
  plaintextTitle: string;
  plaintextBody: string;
  plaintextSignature: string;
  deliveryDate: Date;
}

export const usePhysicalLetter = () => {
  const { user } = useAuth();
  const { ready, config } = usePaddle();

  const createPendingPhysicalLetter = useCallback(
    async (input: PhysicalLetterDraft) => {
      if (!user) throw new Error("Not authenticated");
      const postingDate = calculatePostingDate(input.deliveryDate);
      const { data, error } = await supabase
        .from("physical_letters")
        .insert({
          user_id: user.id,
          letter_id: input.letterId,
          sender_name: input.senderName,
          recipient_name: input.recipientName,
          recipient_address: input.recipientAddress,
          plaintext_title: input.plaintextTitle,
          plaintext_body: input.plaintextBody,
          plaintext_signature: input.plaintextSignature,
          delivery_date: input.deliveryDate.toISOString().split("T")[0],
          posting_date: postingDate.toISOString().split("T")[0],
          payment_status: "pending",
          fulfillment_status: "awaiting_payment",
          paddle_price_id: config?.priceId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    [user, config],
  );

  const openCheckout = useCallback(
    (physicalLetterId: string, customerEmail: string, onComplete: () => void, onClose?: () => void) => {
      if (!ready || !config || !window.Paddle) {
        throw new Error("Checkout not ready");
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: config.priceId, quantity: 1 }],
        customer: { email: customerEmail },
        customData: { physical_letter_id: physicalLetterId },
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/vault?physical=success`,
        },
        eventCallback: (ev: any) => {
          if (ev?.name === "checkout.completed") {
            onComplete();
          } else if (ev?.name === "checkout.closed") {
            onClose?.();
          }
        },
      });
    },
    [ready, config],
  );

  return { ready, createPendingPhysicalLetter, openCheckout };
};
