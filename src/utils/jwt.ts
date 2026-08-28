/**
 * Minimal, dependency-free JWT payload decoder. Does NOT verify the
 * signature — the backend is the only party that ever needs to trust a
 * token's contents. This is purely so the frontend can read claims (e.g.
 * `branchId`, `exp`) that the REST payloads themselves don't always repeat,
 * without pulling in a library for one base64url decode.
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => '%' + char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** `sub`/`role`/`branchId` claims put on every access token — see backend JwtPayload. */
export interface AccessTokenClaims {
  sub: string;
  role: string;
  branchId: string;
  iat?: number;
  exp?: number;
}
