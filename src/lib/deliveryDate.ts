import { addDays, addYears } from "date-fns";

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getMinDeliveryDate(allowToday: boolean): Date {
  const today = startOfDay(new Date());
  return allowToday ? today : addDays(today, 1);
}

export function getMaxDeliveryDate(): Date {
  return addYears(startOfDay(new Date()), 20);
}

export function isDeliveryDateInAllowedRange(date: Date, allowToday: boolean): boolean {
  const compareDate = startOfDay(date);
  const minDate = getMinDeliveryDate(allowToday);
  const maxDate = getMaxDeliveryDate();
  return compareDate >= minDate && compareDate <= maxDate;
}
