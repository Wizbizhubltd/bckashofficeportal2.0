import axios, { type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SIGNED_OUT_REASON_KEY, USER_DATA_KEY } from '../config/storageKeys';

/** Authenticated axios instance for BCKash.Api, used by every screen. */
const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

export interface ApiError extends Error {
  status?: number;
  responseData?: unknown;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Access tokens live 15 minutes; a client onboarding or a batch of document uploads takes longer.
// A token this close to expiry is renewed before the request goes out, so a slow upload isn't sent,
// rejected and sent again.
const REFRESH_AHEAD_MS = 60_000;

/** Milliseconds until the token's `exp`, or null if it can't be read. */
function msUntilExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='))) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 - Date.now() : null;
  } catch {
    return null;
  }
}

// Refresh tokens are single-use (the API rotates them), so every request that needs a new token at
// the same time waits on this one refresh instead of each spending the token and all but one failing.
let refreshInFlight: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    // Plain axios, not apiClient: a 401 from the refresh call itself must not re-enter the interceptors.
    const response = await axios.post<RefreshResponse>('/auth/refresh', { refreshToken }, { baseURL: env.apiBaseUrl, timeout: env.apiTimeoutMs });
    localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
    return response.data.accessToken;
  } catch {
    // Another tab may have spent the same refresh token a moment earlier — if it stored a new
    // access token, use that rather than signing this tab out.
    const current = localStorage.getItem(ACCESS_TOKEN_KEY);
    return current && localStorage.getItem(REFRESH_TOKEN_KEY) !== refreshToken ? current : null;
  }
}

function signOut(reasonMessage?: string) {
  if (reasonMessage) sessionStorage.setItem(SIGNED_OUT_REASON_KEY, reasonMessage);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  window.location.assign('/login');
}

apiClient.interceptors.request.use(async (config) => {
  let token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    const remaining = msUntilExpiry(token);
    if (remaining !== null && remaining < REFRESH_AHEAD_MS) {
      token = (await refreshOnce()) ?? token;
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const title = axios.isAxiosError(error) ? (error.response?.data as { title?: string } | undefined)?.title : undefined;
    const normalized: ApiError = new Error(title || (error instanceof Error ? error.message : 'Request failed'));
    if (axios.isAxiosError(error)) {
      normalized.status = error.response?.status;
      normalized.responseData = error.response?.data;
    }

    // A 401 here means the access token ran out mid-use (sign-in calls go through authApi's own
    // client and never reach this). Swap in a fresh one with the refresh token and replay the
    // request — staff only go back to the sign-in screen once the session itself is over.
    if (normalized.status === 401 && window.location.pathname !== '/login') {
      // Only one device can be signed in at a time — tell the user why they were signed out.
      const reason = (normalized.responseData as { reason?: string } | undefined)?.reason;
      if (reason === 'session_replaced') {
        signOut(normalized.message);
        return Promise.reject(normalized);
      }

      const config = axios.isAxiosError(error) ? (error.config as RetriableConfig | undefined) : undefined;
      if (config && !config._retried) {
        const token = await refreshOnce();
        if (token) {
          config._retried = true;
          config.headers.Authorization = `Bearer ${token}`;
          return apiClient(config);
        }
      }

      signOut('Your session has ended — please sign in again.');
    }

    return Promise.reject(normalized);
  },
);

export default apiClient;
