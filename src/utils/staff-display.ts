export function toTitleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A short, stable, human-friendly staff id for display — the backend's own
 * id is a full Mongo ObjectId, not something anyone wants to read off a
 * table row. Fixed "BCK" prefix (this deployment is single-organisation —
 * see AuthenticatedUserDetails/the singleton `organisation` module — so
 * there's no longer a per-record organization to derive a prefix from).
 */
export function buildFrontendStaffId(backendId: string): string {
  const idSuffix = backendId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || '0000';
  return `BCK-${idSuffix}`;
}
