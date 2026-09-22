function toNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export const env = {
  // BCKash.Api (see BCKash.Api/Properties/launchSettings.json for the local dev port).
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5027/api',
  apiTimeoutMs: toNumber(import.meta.env.VITE_API_TIMEOUT_MS, 15000),
};
