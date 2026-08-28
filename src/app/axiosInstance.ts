import axios from 'axios';
import { env } from '../config/env';
import {
  AUTH_ACCESS_TOKEN_STORAGE_KEY,
  AUTH_REFRESH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from '../context/AuthContext';

const axiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // The instance sets a default 'Content-Type: application/json' header
  // above — axios does NOT override an explicitly-set header for FormData
  // bodies, so file uploads (biometric/ID document capture, etc.) would
  // otherwise go out as "application/json" with no multipart boundary at
  // all. The browser/axios needs to set that header itself (it computes the
  // boundary from the FormData), so delete it here whenever the body is a
  // FormData instance.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

// Routes that legitimately return 401 for reasons other than "the access
// token expired" (bad credentials, bad/expired OTP, an already-revoked
// refresh token) — never worth an automatic refresh-and-retry.
const isAuthRoute = (url: string | undefined): boolean => !!url && url.includes('/auth/');

const clearStoredSessionAndRedirect = (): void => {
  localStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);

  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

// Single in-flight refresh shared by every request that races into a 401 at
// once, so a burst of expired requests triggers one POST /auth/refresh, not one per request.
let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const storedRefreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  if (!storedRefreshToken) {
    return null;
  }

  try {
    // Plain axios, not axiosInstance — must not carry the stale Authorization
    // header or re-enter this same response interceptor.
    const response = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${env.apiBaseUrl}/auth/refresh`,
      { refreshToken: storedRefreshToken },
    );

    localStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, response.data.accessToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, response.data.refreshToken);
    return response.data.accessToken;
  } catch {
    return null;
  }
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as
      | (typeof error.config & { _retriedAfterRefresh?: boolean })
      | undefined;
    const status = error?.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retriedAfterRefresh && !isAuthRoute(originalRequest.url)) {
      originalRequest._retriedAfterRefresh = true;
      refreshInFlight = refreshInFlight ?? refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });

      const nextAccessToken = await refreshInFlight;
      if (nextAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return axiosInstance(originalRequest);
      }

      clearStoredSessionAndRedirect();
    }

    // NestJS's ValidationPipe returns `message` as a string array; every
    // other HttpException returns a single string. Normalize both to one string.
    const rawMessage = error?.response?.data?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(' ')
      : rawMessage || error?.message || 'Request failed';

    const normalizedError = new Error(message) as Error & {
      responseData?: unknown;
      status?: number;
    };

    normalizedError.responseData = error?.response?.data;
    normalizedError.status = status;

    return Promise.reject(normalizedError);
  },
);

export default axiosInstance;
