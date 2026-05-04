// Single source of truth for physical letter pricing & posting rules.
export const PHYSICAL_LETTER_CONFIG = {
  PRICE_DISPLAY: "£4.99",
  PRICE_AMOUNT_CENTS: 499,
  CURRENCY: "GBP",
  // Number of business days the letter must be posted before delivery_date.
  POSTING_LEAD_BUSINESS_DAYS: 5,
  // Royal Mail typical delivery window (for display only)
  ROYAL_MAIL_MIN_DAYS: 1,
  ROYAL_MAIL_MAX_DAYS: 3,
  // Minimum lead time end-to-end (POSTING_LEAD + small buffer for processing)
  MIN_DELIVERY_LEAD_DAYS: 7,
  ADMIN_DASHBOARD_PATH: "/admin/physical-letters",
};

// Compute posting date by walking back N business days (Mon–Fri) from delivery date.
export function calculatePostingDate(deliveryDate: Date, leadBusinessDays = PHYSICAL_LETTER_CONFIG.POSTING_LEAD_BUSINESS_DAYS): Date {
  const d = new Date(deliveryDate);
  d.setHours(0, 0, 0, 0);
  let remaining = leadBusinessDays;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d;
}

// Earliest acceptable delivery date (today + lead, snapped to next weekday + lead).
export function earliestPhysicalDeliveryDate(): Date {
  // Walk forward POSTING_LEAD business days from "tomorrow" so posting_date >= tomorrow.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  let remaining = PHYSICAL_LETTER_CONFIG.POSTING_LEAD_BUSINESS_DAYS;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d;
}
