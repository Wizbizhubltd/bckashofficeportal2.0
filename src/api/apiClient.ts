import axios from 'axios';
import { env } from '../config/env';

const ACCESS_TOKEN_KEY = 'bckashAccessToken';

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

    return Promise.reject(normalized);
  },
);

export default apiClient;
