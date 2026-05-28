import { useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLetters, CreateLetterInput } from "@/hooks/useLetters";
import {
  clearPhysicalOrderDraft,
  PENDING_PHYSICAL_TRANSACTION_KEY,
} from "@/lib/physicalOrder";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until the webhook (or fallback) links a vault letter to this order. */
export async function waitForPhysicalLetterLink(
  physicalLetterId: string,
  userId: string,
  attempts = 12,
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from("physical_letters")
      .select("letter_id")
      .eq("id", physicalLetterId)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.letter_id) return data.letter_id;
    if (i < attempts - 1) await wait(1000);
  }
  return null;
}

/** Poll until Paddle webhook (or fallback) created a paid physical_letters row. */
export async function waitForPhysicalPaymentConfirmed(
  physicalLetterId: string,
  userId: string,
  attempts = 15,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from("physical_letters")
      .select("payment_status")
      .eq("id", physicalLetterId)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.payment_status === "paid") return true;
    if (i < attempts - 1) await wait(1000);
  }
  return false;
}

async function ensurePhysicalOrderRecord(orderId: string, transactionId?: string): Promise<void> {
  const { data } = await supabase
    .from("physical_letters")
    .select("id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (data?.payment_status === "paid") return;

  const txnId =
    transactionId ?? sessionStorage.getItem(PENDING_PHYSICAL_TRANSACTION_KEY) ?? undefined;

  if (!txnId) {
    throw new Error("Payment not confirmed yet");
  }

  const { error } = await supabase.functions.invoke("complete-physical-order", {
    body: { orderId, transactionId: txnId },
  });
  if (error) throw error;
}

/**
 * After Paddle payment: ensure physical_letters exists (post-payment only), then vault letter.
 */
export const useCompletePhysicalOrder = () => {
  const { user } = useAuth();
  const { addLetter } = useLetters();

  const createVaultLetterFromOrder = useCallback(
    async (physicalLetterId: string, overrides?: Partial<CreateLetterInput>) => {
      if (!user) throw new Error("Not authenticated");

      const { data: order, error } = await supabase
        .from("physical_letters")
        .select(
          "plaintext_title, plaintext_body, plaintext_signature, delivery_date, recipient_name, payment_status",
        )
        .eq("id", physicalLetterId)
        .eq("user_id", user.id)
        .single();

      if (error || !order) throw error ?? new Error("Physical order not found");
      if (order.payment_status !== "paid") {
        throw new Error("Payment not confirmed yet");
      }

      const deliveryIso = order.delivery_date.includes("T")
        ? order.delivery_date
        : `${order.delivery_date}T12:00:00.000Z`;

      const saved = await addLetter({
        title: order.plaintext_title,
        body: order.plaintext_body,
        date: format(new Date(), "MMMM d, yyyy"),
        deliveryDate: deliveryIso,
        signature: order.plaintext_signature,
        recipientName: order.recipient_name,
        recipientType: "myself",
        photos: [],
        isTyped: true,
        type: "sent",
        isPhysical: true,
        quiet: true,
        ...overrides,
      });

      const { error: linkErr } = await supabase
        .from("physical_letters")
        .update({ letter_id: saved.id })
        .eq("id", physicalLetterId)
        .eq("user_id", user.id);

      if (linkErr) throw linkErr;
      return saved.id;
    },
    [user, addLetter],
  );

  const completePhysicalOrder = useCallback(
    async (
      physicalLetterId: string,
      options?: { richLetter?: Partial<CreateLetterInput>; transactionId?: string },
    ) => {
      if (!user) throw new Error("Not authenticated");

      await ensurePhysicalOrderRecord(physicalLetterId, options?.transactionId);

      let letterId = await waitForPhysicalLetterLink(physicalLetterId, user.id);
      if (letterId) {
        clearPhysicalOrderDraft(physicalLetterId);
        return letterId;
      }

      const paid = await waitForPhysicalPaymentConfirmed(physicalLetterId, user.id);
      if (!paid) throw new Error("Payment not confirmed yet");

      const richLetter = options?.richLetter;
      if (richLetter) {
        const saved = await addLetter({
          title: richLetter.title!,
          body: richLetter.body!,
          date: richLetter.date!,
          deliveryDate: richLetter.deliveryDate!,
          signature: richLetter.signature!,
          signatureFont: richLetter.signatureFont,
          recipientEmail: richLetter.recipientEmail,
          recipientName: richLetter.recipientName,
          recipientType: richLetter.recipientType ?? "myself",
          photos: richLetter.photos ?? [],
          isTyped: richLetter.isTyped ?? true,
          type: "sent",
          paperColor: richLetter.paperColor,
          inkColor: richLetter.inkColor,
          isLined: richLetter.isLined,
          isPhysical: true,
          draftId: richLetter.draftId,
          quiet: true,
        });
        letterId = saved.id;
        const { error: linkErr } = await supabase
          .from("physical_letters")
          .update({ letter_id: letterId })
          .eq("id", physicalLetterId)
          .eq("user_id", user.id);
        if (linkErr) throw linkErr;
      } else {
        letterId = await createVaultLetterFromOrder(physicalLetterId);
      }

      clearPhysicalOrderDraft(physicalLetterId);
      return letterId;
    },
    [user, addLetter, createVaultLetterFromOrder],
  );

  return { completePhysicalOrder };
};
