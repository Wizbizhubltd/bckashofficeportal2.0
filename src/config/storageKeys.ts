// Shared by AuthContext and apiClient so the keys are only spelled out once.
export const ACCESS_TOKEN_KEY = 'bckashAccessToken';
export const REFRESH_TOKEN_KEY = 'bckashRefreshToken';
export const USER_DATA_KEY = 'bckashUserData';
export const PENDING_CHALLENGE_KEY = 'bckashPendingChallengeToken';

// localStorage: one stable id per browser, sent when completing a sign-in. The API allows one
// signed-in device per user, so signing in elsewhere signs this browser out.
export const DEVICE_ID_KEY = 'bckashDeviceId';

// sessionStorage: why the user was just sent back to the login screen, shown there once.
export const SIGNED_OUT_REASON_KEY = 'bckashSignedOutReason';
