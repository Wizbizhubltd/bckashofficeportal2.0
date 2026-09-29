function toNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** A whole number of seconds, 0 or more; blank or invalid falls back to the default. */
function toSeconds(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === '') return defaultValue;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

export const env = {
  // BCKash.Api (see BCKash.Api/Properties/launchSettings.json for the local dev port).
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5027/api/v1',
  apiTimeoutMs: toNumber(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
  /** Seconds idle before the user is signed out (0 = never); see IdleLogout. */
  idleTimeoutSeconds: toSeconds(import.meta.env.VITE_IDLE_TIMEOUT_SECONDS, 60),
  /** How many of those seconds the "you'll be signed out" countdown covers. */
  idleWarningSeconds: toSeconds(import.meta.env.VITE_IDLE_WARNING_SECONDS, 30),
};
