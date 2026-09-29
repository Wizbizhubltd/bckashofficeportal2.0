/**
 * Numeric inputs: every field that holds a number keeps text out as it's typed, rather than
 * rejecting it on save. Inputs stay type="text" with an inputMode (type="number" still lets
 * through "e", "+" and "-") and run their value through one of these on change.
 */

/** Digits only — terms, counts, ids, days. */
export function sanitizeWholeNumber(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
}

/** An amount or rate: digits with at most one decimal point and `decimals` places after it. */
export function sanitizeDecimal(value: string, decimals = 2): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const point = cleaned.indexOf('.');
  if (point === -1) return cleaned;
  const whole = cleaned.slice(0, point);
  const fraction = cleaned.slice(point + 1).replace(/\./g, '').slice(0, decimals);
  return `${whole || '0'}.${fraction}`;
}

/** A sanitized input value as a number to send, or null when it's empty. */
export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
