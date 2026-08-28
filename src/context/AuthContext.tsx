import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { env } from '../config/env';
import { authService } from '../services/auth/auth.service';
import type { StaffUserType } from '../services/auth/auth.types';
import { mapStaffRoleToRole, type Role } from '../services/auth/role.util';
import { branchesService } from '../services/branches/branches.service';
import { decodeJwt, type AccessTokenClaims } from '../utils/jwt';
import { useAppDispatch } from '../store/hooks';
import { clearLookups, hydrateLookups } from '../store/slices/lookupsSlice';
import {
  clearSession as clearAuthSession,
  setSession as setAuthSession,
} from '../store/slices/authSlice';

export type { Role };

/** What the app actually keeps around after login — see AuthenticatedUserDetails on the backend. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  userType: StaffUserType;
  /** True for a first-login/system-generated password — the app should force a change-password prompt. */
  mustChangePassword: boolean;
  /** Pulled from the access token's own claims (see JwtPayload) — the API's userDetails block doesn't repeat it. */
  branchId?: string;
  branch?: string;
  avatar: string;
}

/** POST /auth/login succeeded — an OTP challenge is now pending, not a session. */
export interface PendingLoginChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  pendingChallenge: PendingLoginChallenge | null;
  login: (email: string, password: string) => Promise<{ success: boolean }>;
  verifyOtp: (code: string) => Promise<{ user: User }>;
  /** Resolves once the post-login prefetch (states/departments/branches) has settled — never throws. */
  hydrateAfterLogin: () => Promise<void>;
  logout: () => void;
  clearPendingChallenge: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTH_ACCESS_TOKEN_STORAGE_KEY = 'userToken';
export const AUTH_REFRESH_TOKEN_STORAGE_KEY = 'userRefreshToken';
export const AUTH_USER_STORAGE_KEY = 'userData';

const getStoredSession = (): { user: User | null; accessToken: string | null; refreshToken: string | null } => {
  const storedAccessToken = localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
  const storedRefreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
  const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

  if (!storedAccessToken || !storedUser) {
    return { user: null, accessToken: null, refreshToken: null };
  }

  try {
    const parsedUser = JSON.parse(storedUser) as User;
    return { user: parsedUser, accessToken: storedAccessToken, refreshToken: storedRefreshToken };
  } catch {
    localStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return { user: null, accessToken: null, refreshToken: null };
  }
};

// Only used when VITE_ENABLE_MOCK_AUTH=true — mirrors the real two-step
// challenge/OTP shape so pages don't need to branch on which mode is active.
const MOCK_OTP = '123456';
const mockUsersByEmail: Record<string, { password: string; user: User }> = {
  'admin@bckash.com': {
    password: 'password123',
    user: {
      id: 'USR-001',
      name: 'Adebayo Johnson',
      email: 'admin@bckash.com',
      role: 'super_admin',
      userType: 'Authorizer',
      mustChangePassword: false,
      branch: 'Head Office',
      avatar: '',
    },
  },
  'manager.ikeja@bckash.com': {
    password: 'password123',
    user: {
      id: 'USR-002',
      name: 'Fatima Abubakar',
      email: 'manager.ikeja@bckash.com',
      role: 'manager',
      userType: 'Reviewer',
      mustChangePassword: false,
      branch: 'Ikeja Branch',
      avatar: '',
    },
  },
  'admin.staff@bckash.com': {
    password: 'password123',
    user: {
      id: 'USR-006',
      name: 'Chinwe Eze',
      email: 'admin.staff@bckash.com',
      role: 'admin',
      userType: 'Authorizer',
      mustChangePassword: false,
      branch: 'Head Office',
      avatar: '',
    },
  },
  'approver@bckash.com': {
    password: 'password123',
    user: {
      id: 'USR-003',
      name: 'Chukwuma Okonkwo',
      email: 'approver@bckash.com',
      role: 'approver',
      userType: 'Authorizer',
      mustChangePassword: false,
      branch: 'Head Office',
      avatar: '',
    },
  },
  'marketer@bckash.com': {
    password: 'password123',
    user: {
      id: 'USR-004',
      name: 'Aisha Bello',
      email: 'marketer@bckash.com',
      role: 'marketer',
      userType: 'Initiator',
      mustChangePassword: false,
      branch: 'Surulere Branch',
      avatar: '',
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [initialSession] = useState(() => getStoredSession());
  const [user, setUser] = useState<User | null>(initialSession.user);
  const [accessToken, setAccessToken] = useState<string | null>(initialSession.accessToken);
  const [refreshToken, setRefreshToken] = useState<string | null>(initialSession.refreshToken);
  const [pendingChallenge, setPendingChallenge] = useState<PendingLoginChallenge | null>(null);

  useEffect(() => {
    if (initialSession.user && initialSession.accessToken) {
      dispatch(
        setAuthSession({
          user: initialSession.user,
          accessToken: initialSession.accessToken,
          refreshToken: initialSession.refreshToken ?? '',
        }),
      );
      // Page refresh, not a fresh login — no "setting things up" screen to hold, just backfill quietly.
      void dispatch(hydrateLookups());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSession = (nextUser: User, tokens: { accessToken: string; refreshToken: string }) => {
    setUser(nextUser);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    setPendingChallenge(null);
    localStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
    localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
    dispatch(setAuthSession({ user: nextUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }));
  };

  const login = async (email: string, password: string): Promise<{ success: boolean }> => {
    const normalizedEmail = email.toLowerCase();

    if (env.enableMockAuth) {
      const entry = mockUsersByEmail[normalizedEmail];
      if (!entry || entry.password !== password) {
        throw new Error('Invalid email or password.');
      }

      setPendingChallenge({
        challengeId: `mock-${normalizedEmail}`,
        email: normalizedEmail,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      return { success: true };
    }

    const challenge = await authService.login({ email: normalizedEmail, password });
    setPendingChallenge({
      challengeId: challenge.challengeId,
      email: normalizedEmail,
      expiresAt: challenge.expiresAt,
    });
    return { success: true };
  };

  const verifyOtp = async (code: string): Promise<{ user: User }> => {
    if (!pendingChallenge) {
      throw new Error('Session expired. Please login again.');
    }

    if (env.enableMockAuth) {
      if (code !== MOCK_OTP) {
        throw new Error('Invalid OTP. Please try again.');
      }

      const entry = mockUsersByEmail[pendingChallenge.email];
      if (!entry) {
        throw new Error('Session expired. Please login again.');
      }

      const mockAccessToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        btoa(JSON.stringify({ sub: entry.user.id, role: entry.user.role, branchId: '' }));
      setSession(entry.user, { accessToken: mockAccessToken, refreshToken: `${mockAccessToken}-refresh` });
      return { user: entry.user };
    }

    const result = await authService.verifyLoginOtp({
      challengeId: pendingChallenge.challengeId,
      code,
    });

    const claims = decodeJwt<AccessTokenClaims>(result.accessToken);

    // Real Staff has no `branch` name of its own on the User object — only
    // the token's `branchId` claim. Resolved here (not left for every page
    // that displays it to look up separately) so `user.branch` — read
    // directly by Sidebar.tsx/Dashboard.tsx — is never "undefined" for a
    // real (non-mock) login. Best-effort: a failed lookup leaves it
    // undefined rather than blocking login, same "prefetch is a
    // convenience" spirit as hydrateAfterLogin below.
    let branchName: string | undefined;
    if (claims?.branchId) {
      // GET /branches/:id needs a bearer token, and the request interceptor
      // reads straight from localStorage — write it now, ahead of
      // setSession's own write below, so this call actually authenticates.
      localStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, result.accessToken);
      branchName = await branchesService
        .getById(claims.branchId)
        .then((branch) => branch.name)
        .catch(() => undefined);
    }

    const nextUser: User = {
      id: result.userDetails.id,
      name: `${result.userDetails.firstName} ${result.userDetails.lastName}`.trim(),
      email: pendingChallenge.email,
      role: mapStaffRoleToRole(result.userDetails.userLevel),
      userType: result.userDetails.userType,
      mustChangePassword: result.userDetails.mustChangePassword,
      branchId: claims?.branchId || undefined,
      branch: branchName,
      avatar: '',
    };

    setSession(nextUser, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    return { user: nextUser };
  };

  const hydrateAfterLogin = async (): Promise<void> => {
    try {
      await dispatch(hydrateLookups()).unwrap();
    } catch {
      // Prefetch is a convenience, not a login precondition — an offline
      // lookups call should never strand the staff member on the loader.
    }
  };

  const logout = () => {
    const outgoingRefreshToken = refreshToken;
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setPendingChallenge(null);
    localStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    dispatch(clearAuthSession());
    dispatch(clearLookups());

    if (outgoingRefreshToken && !env.enableMockAuth) {
      void authService.logout({ refreshToken: outgoingRefreshToken }).catch(() => {
        // Best-effort revoke — the local session is already gone either way.
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        accessToken,
        refreshToken,
        pendingChallenge,
        login,
        verifyOtp,
        hydrateAfterLogin,
        logout,
        clearPendingChallenge: () => setPendingChallenge(null),
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
