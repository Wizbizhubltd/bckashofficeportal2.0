import { api } from '../../app/api';
import type {
  AuthTokens,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginChallengeResponse,
  LoginPayload,
  LoginResult,
  RefreshTokenPayload,
  ResetPasswordPayload,
  VerifyLoginOtpPayload,
} from './auth.types';

/**
 * `auth` tag — backashbackend/src/modules/identity/auth.controller.ts.
 * One method per route, payload/response shapes matching the controller's
 * DTOs exactly. No mapping/normalization here — that belongs in the caller
 * (AuthContext), which decides how the backend's shape becomes the app's
 * `User` model.
 */
export const authService = {
  /** POST /auth/login — step 1 of 2: issues an OTP challenge, never tokens. */
  login: (payload: LoginPayload): Promise<LoginChallengeResponse> =>
    api.post<LoginChallengeResponse, LoginPayload>('/auth/login', payload),

  /** POST /auth/login/verify-otp — step 2 of 2: challenge + code -> tokens + userDetails. */
  verifyLoginOtp: (payload: VerifyLoginOtpPayload): Promise<LoginResult> =>
    api.post<LoginResult, VerifyLoginOtpPayload>('/auth/login/verify-otp', payload),

  /** POST /auth/refresh — exchange a still-valid refresh token for a new pair. */
  refresh: (payload: RefreshTokenPayload): Promise<AuthTokens> =>
    api.post<AuthTokens, RefreshTokenPayload>('/auth/refresh', payload),

  /** POST /auth/logout — revokes the given refresh token. */
  logout: (payload: RefreshTokenPayload): Promise<void> =>
    api.post<void, RefreshTokenPayload>('/auth/logout', payload),

  /** POST /auth/change-password — self-service, requires current password + a live session. */
  changePassword: (payload: ChangePasswordPayload): Promise<void> =>
    api.post<void, ChangePasswordPayload>('/auth/change-password', payload),

  /** POST /auth/forgot-password — step 1 of 2, no login required. */
  forgotPassword: (payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> =>
    api.post<ForgotPasswordResponse, ForgotPasswordPayload>('/auth/forgot-password', payload),

  /** POST /auth/reset-password — step 2 of 2: email + emailed code + newPassword. */
  resetPassword: (payload: ResetPasswordPayload): Promise<void> =>
    api.post<void, ResetPasswordPayload>('/auth/reset-password', payload),
};

export * from './auth.types';
export * from './role.util';
