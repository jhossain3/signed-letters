export type PhysicalOrderPayload = {
  physical_order_id: string;
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
};

export function mergeCustomData(data: Record<string, unknown>): Record<string, unknown> {
  const sources = [
    data?.custom_data,
    data?.customData,
    (data?.checkout as Record<string, unknown> | undefined)?.custom_data,
    (data?.checkout as Record<string, unknown> | undefined)?.customData,
  ];

  if (Array.isArray(data.items)) {
    for (const item of data.items as Record<string, unknown>[]) {
      const price = item?.price as Record<string, unknown> | undefined;
      sources.push(item?.custom_data, item?.customData, price?.custom_data, price?.customData);
    }
  }

  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      Object.assign(merged, source as Record<string, unknown>);
    }
  }
  return merged;
}

export function parsePhysicalOrderPayload(
  customData: Record<string, unknown>,
): PhysicalOrderPayload | null {
  const orderId = customData.physical_order_id ?? customData.physical_orderId;
  const userId = customData.user_id ?? customData.userId;
  if (typeof orderId !== "string" || typeof userId !== "string") return null;

  const str = (key: string, alt?: string) => {
    const v = customData[key] ?? (alt ? customData[alt] : undefined);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const sender_name = str("sender_name", "senderName");
  const recipient_name = str("recipient_name", "recipientName");
  const recipient_address = str("recipient_address", "recipientAddress");
  const plaintext_title = str("plaintext_title", "plaintextTitle");
  const plaintext_body = str("plaintext_body", "plaintextBody");
  const plaintext_signature = str("plaintext_signature", "plaintextSignature");
  const delivery_date = str("delivery_date", "deliveryDate");
  const posting_date = str("posting_date", "postingDate");

  if (
    !sender_name ||
    !recipient_name ||
    !recipient_address ||
    !plaintext_title ||
    !plaintext_body ||
    !plaintext_signature ||
    !delivery_date ||
    !posting_date
  ) {
    return null;
  }

  const paddle_price_id = str("paddle_price_id", "paddlePriceId") ?? undefined;

  return {
    physical_order_id: orderId,
    user_id: userId,
    sender_name,
    recipient_name,
    recipient_address,
    plaintext_title,
    plaintext_body,
    plaintext_signature,
    delivery_date,
    posting_date,
    paddle_price_id,
  };
}

export function extractLegacyPhysicalLetterId(customData: Record<string, unknown>): string | undefined {
  const id = customData.physical_letter_id ?? customData.physicalLetterId;
  return typeof id === "string" ? id : undefined;
}
