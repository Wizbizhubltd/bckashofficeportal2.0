/** "loan_officer" / "LoanOfficer" → "Loan Officer". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** "Ada Obi Nwosu" → "AO". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/** "Reassigned by Ada Obi · 3 Nov 2026" for a client's or group's marketer — null if never reassigned. */
export function reassignedNote(byName: string | null | undefined, at: string | null | undefined): string | null {
  if (!at) return null;
  const date = new Date(at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Reassigned${byName ? ` by ${byName}` : ''} · ${date}`;
}
