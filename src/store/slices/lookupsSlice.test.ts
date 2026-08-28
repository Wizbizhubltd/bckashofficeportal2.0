import { describe, expect, it, vi } from 'vitest';
import {
  upsertBranchScoped,
  upsertDepartmentScoped,
  upsertRoleScoped,
  type BranchLookup,
  type DepartmentLookup,
  type RoleLookup,
} from './lookupsSlice';
import type { RootState } from '../index';

// The new backend has no multi-tenant `organizationId` on the staff session
// (see AuthenticatedUserDetails / auth/role.util.ts) — these thunks used to
// stamp one onto every upsert, which no longer applies. They're kept as
// thunks (rather than plain reducers) only so existing dispatch call sites
// don't need to change; today they just pass the payload straight through.
const baseState: RootState = {
  auth: {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'super_admin',
      userType: 'Authorizer',
      mustChangePassword: false,
      avatar: '',
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    isAuthenticated: true,
  },
  lookups: {
    states: [],
    departments: [],
    roles: [],
    branches: [],
    branchManagers: [],
    hydrated: false,
    loading: false,
    error: null,
  },
  ui: {
    isSidebarOpen: true,
    notifications: [],
    theme: 'light',
  },
  finConUi: {
    activeSection: 'overview',
    sectionFilters: {},
    dateRange: {
      from: null,
      to: null,
    },
    searchQuery: '',
    panelState: {
      isCollapsed: false,
    },
  },
} as unknown as RootState;

describe('lookups scoped upsert thunks', () => {
  it('passes the department payload through unchanged', async () => {
    const payload: DepartmentLookup = { id: 'dept-1', name: 'Operations' };

    const action = await upsertDepartmentScoped(payload)(vi.fn(), () => baseState, undefined);

    expect(action.payload).toEqual(payload);
  });

  it('passes the role payload through unchanged', async () => {
    const payload: RoleLookup = { id: 'role-1', name: 'Branch Manager', department: 'Operations' };

    const action = await upsertRoleScoped(payload)(vi.fn(), () => baseState, undefined);

    expect(action.payload).toEqual(payload);
  });

  it('passes the branch payload through unchanged', async () => {
    const payload: BranchLookup = { id: 'branch-1', name: 'Ikeja Branch' };

    const action = await upsertBranchScoped(payload)(vi.fn(), () => baseState, undefined);

    expect(action.payload).toEqual(payload);
  });
});
