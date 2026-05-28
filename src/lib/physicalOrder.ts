/** Client-generated id; becomes physical_letters.id after payment. */
export type PhysicalOrderId = string;

export interface PhysicalOrderDraft {
  senderName: string;
  recipientName: string;
  recipientAddress: string;
  plaintextTitle: string;
  plaintextBody: string;
  plaintextSignature: string;
  deliveryDate: string; // YYYY-MM-DD
  postingDate: string; // YYYY-MM-DD
  paddlePriceId?: string;
}

export interface PhysicalOrderPaddleCustomData {
  physical_order_id: PhysicalOrderId;
  user_id: string;
  sender_name: string;
  recipient_name: string;
  recipient_address: string;
  plaintext_title: string;
  plaintext_body: string;
  plaintext_signature: string;
  delivery_date: string;
  posting_date: string;
  paddle_price_id?: string;
}

export const PENDING_PHYSICAL_ORDER_KEY = "pending_physical_order_id";
export const PENDING_PHYSICAL_TRANSACTION_KEY = "pending_physical_transaction_id";

/** Paddle custom_data is size-limited; keep letter body under this. */
export const MAX_PHYSICAL_ORDER_CUSTOM_DATA_CHARS = 3500;

export function createPhysicalOrderId(): PhysicalOrderId {
  return crypto.randomUUID();
}

export function savePhysicalOrderDraft(orderId: PhysicalOrderId, draft: PhysicalOrderDraft): void {
  sessionStorage.setItem(`physical_order_draft_${orderId}`, JSON.stringify(draft));
}

export function loadPhysicalOrderDraft(orderId: PhysicalOrderId): PhysicalOrderDraft | null {
  const raw = sessionStorage.getItem(`physical_order_draft_${orderId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PhysicalOrderDraft;
  } catch {
    return null;
  }
}

export function clearPhysicalOrderDraft(orderId: PhysicalOrderId): void {
  sessionStorage.removeItem(`physical_order_draft_${orderId}`);
}

export function buildPhysicalOrderCustomData(
  orderId: PhysicalOrderId,
  userId: string,
  draft: PhysicalOrderDraft,
): PhysicalOrderPaddleCustomData {
  return {
    physical_order_id: orderId,
    user_id: userId,
    sender_name: draft.senderName,
    recipient_name: draft.recipientName,
    recipient_address: draft.recipientAddress,
    plaintext_title: draft.plaintextTitle,
    plaintext_body: draft.plaintextBody,
    plaintext_signature: draft.plaintextSignature,
    delivery_date: draft.deliveryDate,
    posting_date: draft.postingDate,
    paddle_price_id: draft.paddlePriceId,
  };
}

export function validatePhysicalOrderCustomDataSize(customData: PhysicalOrderPaddleCustomData): void {
  const size = JSON.stringify(customData).length;
  if (size > MAX_PHYSICAL_ORDER_CUSTOM_DATA_CHARS) {
    throw new Error(
      `Letter is too long to send physically (${size} characters). Shorten the body and try again.`,
    );
  }
}
