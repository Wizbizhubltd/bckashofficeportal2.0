/**
 * Renders a resolved display name alongside the raw id it was resolved
 * from (branch, staff member, ...) — the name is always shown when it's
 * available, the id never disappears even when it isn't (a lookup that
 * hasn't hydrated yet, or a record that no longer exists), so the reader
 * always has something concrete to go on instead of a silent "—".
 */
export function withId(name: string | null | undefined, id: string | null | undefined): string {
  if (!id) return '—';
  return name ? `${name} (${id})` : id;
}
