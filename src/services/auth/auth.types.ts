/**
 * Mirrors backashbackend/src/modules/identity — DTOs in, interfaces out.
 * Keep these in lockstep with the backend's `dto/*.dto.ts` and
 * `interfaces/jwt-payload.interface.ts`; nothing here should invent a field
 * the API doesn't actually send.
 */

/** A staff member's level of authority — backend `StaffRole` enum, verbatim. */
export type StaffRole = 'MARKETER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN' | 'APPROVER';

/** A staff member's function in an approval chain — display-only, backend `StaffUserType` enum. */
export type StaffUserType = 'Initiator' | 'Reviewer' | 'Authorizer';

// ---- POST /auth/login ------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

/** What POST /auth/login returns — an OTP challenge, never tokens. */
export interface LoginChallengeResponse {
  challengeId: string;
  expiresAt: string;
  message: string;
}

// ---- POST /auth/login/verify-otp -------------------------------------------

export interface VerifyLoginOtpPayload {
  challengeId: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * `userType` is the Initiator/Reviewer/Authorizer label — display-only.
 * `userLevel` is the actual StaffRole, used to route the staff member to
 * their designated protected area. `mustChangePassword` — every new staff
 * member starts with a system-generated temporary password; when true the
 * frontend should force a POST /auth/change-password prompt before letting
 * them use the app.
 */
export interface AuthenticatedUserDetails {
  id: string;
  firstName: string;
  lastName: string;
  userType: StaffUserType;
  userLevel: StaffRole;
  mustChangePassword: boolean;
}

export interface LoginResult extends AuthTokens {
  userDetails: AuthenticatedUserDetails;
}

// ---- POST /auth/refresh / /auth/logout -------------------------------------

export interface RefreshTokenPayload {
  refreshToken: string;
}

// ---- POST /auth/change-password --------------------------------------------

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ---- POST /auth/forgot-password / /auth/reset-password ---------------------

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}
