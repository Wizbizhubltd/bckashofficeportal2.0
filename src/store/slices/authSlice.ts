import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Role } from '../../services/auth/role.util';
import type { StaffUserType } from '../../services/auth/auth.types';

export type { Role };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  userType: StaffUserType;
  mustChangePassword: boolean;
  branchId?: string;
  branch?: string;
  avatar: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string; refreshToken: string }>,
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
    },
    clearSession: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;
