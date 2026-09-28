import axios from 'axios';
import { env } from '../config/env';
import { getDeviceId } from '../config/deviceId';
import apiClient from './apiClient';

/** Talks directly to BCKash.Api's auth endpoints (see BCKash.Api/Controllers/AuthController.cs). */
const authClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

export interface TokenResponse {
  accessToken: string;
  expiresAtUtc: string;
  refreshToken: string;
}

export interface UserData {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  user_class: string | null;
  user_type: string | null;
  mustChangePassword: boolean;
}

export interface OtpVerifyResponse extends TokenResponse {
  userData: UserData;
}

// A login always returns a second-factor challenge now — there is no more direct-to-token
// outcome. `challengeType` is the only thing that tells the two challenge kinds apart, since
// both otherwise serialize to the same {"challengeToken":"..."} shape.
export interface LoginChallengeResponse {
  challengeToken: string;
  challengeType: 'totp' | 'otp';
}

export function isTotpChallenge(response: LoginChallengeResponse): boolean {
  return response.challengeType === 'totp';
}

/** An auth error carrying the API's machine-readable `reason`, when it sent one. */
export interface AuthError extends Error {
  reason?: string;
}

/** The API refuses a super admin here (they belong on the control portal) with this reason. */
export function isWrongPortalError(error: unknown): boolean {
  return (error as AuthError | undefined)?.reason === 'wrong_portal';
}

// The API returns RFC 7807 Problem Details on failure (see FRD §17) — surface its
// `title` as the error message rather than a generic Axios one.
function toFriendlyError(error: unknown): AuthError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { title?: string; reason?: string } | undefined;
    const friendly: AuthError = new Error(data?.title || error.message);
    friendly.reason = data?.reason;
    return friendly;
  }
  return error instanceof Error ? error : new Error('Unexpected error');
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginChallengeResponse> {
    try {
      // `portal` makes the API refuse anyone who belongs on the control portal (super admins).
      const response = await authClient.post<LoginChallengeResponse>('/auth/login', { email, password, portal: 'office' });
      return response.data;
    } catch (error) {
      throw toFriendlyError(error);
    }
  },

  /** Authenticator-app (Google2FA) code — for the small set of staff with EnableGoogle2fa on. */
  async verifyTwoFactor(challengeToken: string, code: string): Promise<TokenResponse> {
    try {
      const response = await authClient.post<TokenResponse>('/auth/login/2fa', { challengeToken, code, deviceId: getDeviceId() });
      return response.data;
    } catch (error) {
      throw toFriendlyError(error);
    }
  },

  /** Emailed/texted one-time code — the default path for everyone without Google2FA enabled. */
  async verifyOtp(challengeToken: string, code: string): Promise<OtpVerifyResponse> {
    try {
      const response = await authClient.post<OtpVerifyResponse>('/auth/login/otp/verify', { challengeToken, code, deviceId: getDeviceId() });
      return response.data;
    } catch (error) {
      throw toFriendlyError(error);
    }
  },

  /** Replaces the signed-in user's password; returns fresh tokens for the same session. apiClient already surfaces the API's error title. */
  async changePassword(currentPassword: string, newPassword: string): Promise<OtpVerifyResponse> {
    const response = await apiClient.post<OtpVerifyResponse>('/auth/password/change', { currentPassword, newPassword });
    return response.data;
  },

  /** Sends a fresh login code and invalidates the old one — the returned token replaces the pending challenge. */
  async resendOtp(challengeToken: string): Promise<LoginChallengeResponse> {
    try {
      const response = await authClient.post<LoginChallengeResponse>('/auth/login/otp/resend', { challengeToken });
      return response.data;
    } catch (error) {
      throw toFriendlyError(error);
    }
  },

  /**
   * Starts a password reset. Always succeeds for a well-formed email — unknown accounts get a
   * decoy challenge — so the UI must not reveal whether the account exists.
   */
  async forgotPassword(email: string): Promise<{ challengeToken: string }> {
    try {
      const response = await authClient.post<{ challengeToken: string }>('/auth/password/forgot', { email });
      return response.data;
    } catch (error) {
      throw toFriendlyError(error);
    }
  },

  /** Completes a reset with the texted code. Ends any signed-in session for the account. */
  async resetPassword(challengeToken: string, code: string, newPassword: string): Promise<void> {
    try {
      await authClient.post('/auth/password/reset', { challengeToken, code, newPassword });
    } catch (error) {
      throw toFriendlyError(error);
    }
  },
};
