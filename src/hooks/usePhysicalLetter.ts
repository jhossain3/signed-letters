import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddle } from "@/hooks/usePaddle";
import { calculatePostingDate } from "@/config/physicalLetter";
import {
  buildPhysicalOrderCustomData,
  createPhysicalOrderId,
  PENDING_PHYSICAL_ORDER_KEY,
  PENDING_PHYSICAL_TRANSACTION_KEY,
  PhysicalOrderDraft,
  PhysicalOrderId,
  PhysicalOrderPaddleCustomData,
  savePhysicalOrderDraft,
  validatePhysicalOrderCustomDataSize,
} from "@/lib/physicalOrder";

export interface PhysicalLetterCheckoutInput {
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

  /** Prepare checkout (no DB writes). Returns order id + Paddle custom_data. */
  const preparePhysicalCheckout = useCallback(
    (input: PhysicalLetterCheckoutInput): { orderId: PhysicalOrderId; customData: PhysicalOrderPaddleCustomData } => {
      if (!user) throw new Error("Not authenticated");

      const postingDate = calculatePostingDate(input.deliveryDate);
      const orderId = createPhysicalOrderId();
      const draft: PhysicalOrderDraft = {
        senderName: input.senderName,
        recipientName: input.recipientName,
        recipientAddress: input.recipientAddress,
        plaintextTitle: input.plaintextTitle,
        plaintextBody: input.plaintextBody,
        plaintextSignature: input.plaintextSignature,
        deliveryDate: input.deliveryDate.toISOString().split("T")[0],
        postingDate: postingDate.toISOString().split("T")[0],
        paddlePriceId: config?.priceId,
      };

      const customData = buildPhysicalOrderCustomData(orderId, user.id, draft);
      validatePhysicalOrderCustomDataSize(customData);
      savePhysicalOrderDraft(orderId, draft);

      return { orderId, customData };
    },
    [user, config],
  );

  const openCheckout = useCallback(
    (
      orderId: PhysicalOrderId,
      customData: PhysicalOrderPaddleCustomData,
      customerEmail: string,
      onComplete: (transactionId?: string) => void,
      onClose?: () => void,
    ) => {
      if (!ready || !config || !window.Paddle) {
        throw new Error("Checkout not ready");
      }

      sessionStorage.setItem(PENDING_PHYSICAL_ORDER_KEY, orderId);
      sessionStorage.removeItem(PENDING_PHYSICAL_TRANSACTION_KEY);

      window.Paddle.Checkout.open({
        items: [{ priceId: config.priceId, quantity: 1 }],
        customer: { email: customerEmail },
        customData,
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/vault?physical=success&physical_order_id=${orderId}`,
        },
        eventCallback: (ev: { name?: string; data?: Record<string, unknown> }) => {
          if (ev?.name === "checkout.completed") {
            const transactionId =
              (typeof ev.data?.transaction_id === "string" && ev.data.transaction_id) ||
              (typeof ev.data?.id === "string" && ev.data.id) ||
              undefined;
            if (transactionId) {
              sessionStorage.setItem(PENDING_PHYSICAL_TRANSACTION_KEY, transactionId);
            }
            onComplete(transactionId);
          } else if (ev?.name === "checkout.closed") {
            onClose?.();
          }
        },
      });
    },
    [ready, config],
  );

  return { ready, preparePhysicalCheckout, openCheckout };
};
