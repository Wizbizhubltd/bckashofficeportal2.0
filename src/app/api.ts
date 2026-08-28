import { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import toast from 'react-hot-toast';

type RootApiErrorPayload = {
  success?: boolean;
  message?: string;
  mustChangePassword?: boolean;
};

type NormalizedApiError = Error & {
  responseData?: unknown;
  status?: number;
};

const extractRootPayload = (value: unknown): RootApiErrorPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as RootApiErrorPayload;
  const hasKnownFlags = typeof source.success === 'boolean' || typeof source.message === 'string';

  return hasKnownFlags ? source : null;
};

const notifyRootError = (payload: RootApiErrorPayload, fallbackMessage: string): string => {
  const message = payload.message?.trim() || fallbackMessage;
  const toastMessage = payload.mustChangePassword
    ? `${message}. Please change your password to continue.`
    : message;

  toast.error(toastMessage);
  return message;
};

const handleResponseData = <TResponse>(data: TResponse): TResponse => {
  const rootPayload = extractRootPayload(data);

  if (rootPayload?.success === false) {
    const message = notifyRootError(rootPayload, 'Request failed');
    throw new Error(message);
  }

  return data;
};

/**
 * `suppressErrorToast` is our own flag, not a real axios option — harmless
 * to pass straight through to axios (unknown config keys are ignored), and
 * plucked off here for handleApiError. Use it for a call site that expects
 * a particular failure as a normal outcome (e.g. GET /organisation 404ing
 * before the singleton has been created yet) and wants to handle it
 * silently instead of a scary toast for something that isn't really an error.
 */
type ApiRequestConfig = AxiosRequestConfig & { suppressErrorToast?: boolean };

const handleApiError = (error: unknown, suppressErrorToast = false): never => {
  const normalizedError = error as NormalizedApiError;
  const rootPayload = extractRootPayload(normalizedError.responseData);

  if (rootPayload?.success === false || rootPayload?.mustChangePassword || rootPayload?.message) {
    const message = rootPayload?.message?.trim() || normalizedError.message || 'Request failed';
    if (!suppressErrorToast) {
      notifyRootError(rootPayload ?? {}, message);
    }
    // A fresh Error, same as before — but `.status`/`.responseData` now
    // survive onto it instead of being silently dropped, so a caller can
    // still tell a 404 apart from any other failure.
    const rethrown = new Error(message) as NormalizedApiError;
    rethrown.status = normalizedError.status;
    rethrown.responseData = normalizedError.responseData;
    throw rethrown;
  }

  if (normalizedError?.message) {
    if (!suppressErrorToast) {
      toast.error(normalizedError.message);
    }
    throw normalizedError;
  }

  if (!suppressErrorToast) {
    toast.error('Request failed');
  }
  throw new Error('Request failed');
};

const executeRequest = async <TResponse>(
  request: Promise<{ data: TResponse }>,
  suppressErrorToast = false,
): Promise<TResponse> => {
  try {
    const response = await request;
    return handleResponseData(response.data);
  } catch (error) {
    return handleApiError(error, suppressErrorToast);
  }
};

export const api = {
  get: async <TResponse = unknown>(url: string, config?: ApiRequestConfig) => {
    return executeRequest(axiosInstance.get<TResponse>(url, config), config?.suppressErrorToast);
  },
  post: async <TResponse = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig
  ) => {
    return executeRequest(axiosInstance.post<TResponse>(url, data, config), config?.suppressErrorToast);
  },
  put: async <TResponse = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig
  ) => {
    return executeRequest(axiosInstance.put<TResponse>(url, data, config), config?.suppressErrorToast);
  },
  patch: async <TResponse = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: ApiRequestConfig
  ) => {
    return executeRequest(axiosInstance.patch<TResponse>(url, data, config), config?.suppressErrorToast);
  },
  delete: async <TResponse = unknown>(url: string, config?: ApiRequestConfig) => {
    return executeRequest(axiosInstance.delete<TResponse>(url, config), config?.suppressErrorToast);
  },
};
