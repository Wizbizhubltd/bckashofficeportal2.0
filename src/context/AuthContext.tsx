import { createContext, useContext, useState, type ReactNode } from 'react';
import { decodeJwt } from '../utils/jwt';
import { authApi, isTotpChallenge, type TokenResponse, type UserData } from '../api/authApi';
import { ACCESS_TOKEN_KEY, PENDING_CHALLENGE_KEY, REFRESH_TOKEN_KEY, USER_DATA_KEY } from '../config/storageKeys';

interface AccessTokenClaims {
  sub: string;
  office_id?: string;
  /** "true" while the user must replace a temporary password — the API rejects everything else until then. */
  pwd_change_required?: string;
}

interface AuthContextType {
  userId: string | null;
  user: UserData | null;
  isAuthenticated: boolean;
  pendingChallengeToken: string | null;
  login: (email: string, password: string) => Promise<{ requiresTotp: boolean }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  /** True while the signed-in user is still on a temporary password. */
  mustChangePassword: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function userIdFromToken(accessToken: string): string | null {
  return decodeJwt<AccessTokenClaims>(accessToken)?.sub ?? null;
}

function readUser(): UserData | null {
  const raw = localStorage.getItem(USER_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserData;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [user, setUser] = useState<UserData | null>(() => readUser());
  // Persisted (not plain state) so a page refresh mid-verification doesn't force a fresh
  // sign-in — sessionStorage, not localStorage: only meaningful for the tab that requested it.
  const [pendingChallengeToken, setPendingChallengeToken] = useState<string | null>(() =>
    sessionStorage.getItem(PENDING_CHALLENGE_KEY),
  );

  const storeTokens = (tokens: TokenResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    sessionStorage.removeItem(PENDING_CHALLENGE_KEY);
    setAccessToken(tokens.accessToken);
    setPendingChallengeToken(null);
  };

  const login = async (email: string, password: string): Promise<{ requiresTotp: boolean }> => {
    const response = await authApi.login(email, password);
    sessionStorage.setItem(PENDING_CHALLENGE_KEY, response.challengeToken);
    setPendingChallengeToken(response.challengeToken);
    return { requiresTotp: isTotpChallenge(response) };
  };

  const verifyTwoFactor = async (code: string): Promise<void> => {
    if (!pendingChallengeToken) {
      throw new Error('Login session expired — please sign in again.');
    }

    const tokens = await authApi.verifyTwoFactor(pendingChallengeToken, code);
    storeTokens(tokens);
  };

  const verifyOtp = async (code: string): Promise<void> => {
    if (!pendingChallengeToken) {
      throw new Error('Login session expired — please sign in again.');
    }

    const result = await authApi.verifyOtp(pendingChallengeToken, code);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(result.userData));
    setUser(result.userData);
    storeTokens(result);
  };

  const resendOtp = async (): Promise<void> => {
    if (!pendingChallengeToken) {
      throw new Error('Login session expired — please sign in again.');
    }

    const { challengeToken } = await authApi.resendOtp(pendingChallengeToken);
    sessionStorage.setItem(PENDING_CHALLENGE_KEY, challengeToken);
    setPendingChallengeToken(challengeToken);
  };

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    sessionStorage.removeItem(PENDING_CHALLENGE_KEY);
    setAccessToken(null);
    setUser(null);
    setPendingChallengeToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        userId: accessToken ? userIdFromToken(accessToken) : null,
        user,
        isAuthenticated: !!accessToken,
        pendingChallengeToken,
        login,
        verifyTwoFactor,
        verifyOtp,
        resendOtp,
        // Read from the token rather than stored user data so it also covers the authenticator-app
        // sign-in path, which returns tokens without user data.
        mustChangePassword: accessToken ? decodeJwt<AccessTokenClaims>(accessToken)?.pwd_change_required === 'true' : false,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
