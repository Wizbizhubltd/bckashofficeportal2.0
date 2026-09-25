import axios from 'axios';
import { env } from '../config/env';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SIGNED_OUT_REASON_KEY, USER_DATA_KEY } from '../config/storageKeys';

/** Authenticated axios instance for BCKash.Api, used by every admin screen. */
const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiError extends Error {
  status?: number;
  responseData?: unknown;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const title = axios.isAxiosError(error) ? (error.response?.data as { title?: string } | undefined)?.title : undefined;
    const normalized: ApiError = new Error(title || (error instanceof Error ? error.message : 'Request failed'));

    if (axios.isAxiosError(error)) {
      normalized.status = error.response?.status;
      normalized.responseData = error.response?.data;
    }

    // Only one device can be signed in at a time: once this account signs in elsewhere, every
    // request from here is rejected. Send the user back to sign in and tell them why.
    const reason = (normalized.responseData as { reason?: string } | undefined)?.reason;
    if (normalized.status === 401 && reason === 'session_replaced' && window.location.pathname !== '/login') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      sessionStorage.setItem(SIGNED_OUT_REASON_KEY, normalized.message);
      window.location.assign('/login');
    }

    return Promise.reject(normalized);
  },
);

export default apiClient;
