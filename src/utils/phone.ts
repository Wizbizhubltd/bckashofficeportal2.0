/** Phone inputs take the local Nigerian form: digits only, at most 11 (e.g. 08031234567). */
export const PHONE_MAX_DIGITS = 11;

/** Strips everything but digits and caps the length — apply to every phone input's value on change. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

/**
 * The server stores numbers as +2348031234567; edit forms show them back in local form
 * (08031234567) so they fit the phone input rules.
 */
export function toLocalPhone(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return sanitizePhoneInput(digits.length > 10 && digits.startsWith('234') ? `0${digits.slice(3)}` : digits);
}
