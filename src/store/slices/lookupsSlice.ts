import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { canManageOrgStructure } from '../../services/auth/role.util';
import { branchesService, type Branch } from '../../services/branches/branches.service';
import { departmentsService, type Department } from '../../services/departments/departments.service';
import { referenceDataService } from '../../services/reference-data/reference-data.service';
import { staffService, type Staff } from '../../services/staff/staff.service';
import { unitsService, type Unit } from '../../services/units/units.service';
import type { RootState } from '../index';

export type LookupOption = {
  id: string;
  name: string;
};

export type DepartmentLookup = {
  id: string;
  name: string;
  status?: 'Active' | 'Inactive';
  staffCount?: number;
  dateCreated?: string;
};

export type RoleLookup = {
  id: string;
  name: string;
  department: string;
  staffCount?: number;
  status?: 'Active' | 'Inactive';
  dateCreated?: string;
};

export type BranchLookup = {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isActive?: boolean;
};

export type BranchManagerLookup = {
  id: string;
  fullName: string;
  email: string;
  userLevel: string;
};

type LookupsState = {
  states: LookupOption[];
  departments: DepartmentLookup[];
  roles: RoleLookup[];
  branches: BranchLookup[];
  branchManagers: BranchManagerLookup[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
};

const initialState: LookupsState = {
  states: [],
  departments: [],
  roles: [],
  branches: [],
  branchManagers: [],
  hydrated: false,
  loading: false,
  error: null,
};

const toDepartmentLookup = (department: Department): DepartmentLookup => ({
  id: department.id,
  name: department.name,
  status: department.active ? 'Active' : 'Inactive',
  staffCount: department.staffCount,
  dateCreated: department.createdAt,
});

// `RoleLookup` here is org-structure "units" (each belongs to a department),
// not the StaffRole enum — see lookupsSlice's history: it originally backed
// a since-removed `/admin/roles` endpoint. Kept as `roles`/`RoleLookup` so
// the pages already consuming this shape (BranchManagement, StaffOnboarding,
// DepartmentsRoles, StaffDetail, ...) don't need a rename in this pass.
const toRoleLookup = (unit: Unit): RoleLookup => ({
  id: unit.id,
  name: unit.name,
  department: unit.departmentName,
  status: unit.active ? 'Active' : 'Inactive',
  staffCount: unit.staffCount,
  dateCreated: unit.createdAt,
});

/**
 * A "Branch Manager" is simply any ACTIVE staff member with role MANAGER —
 * there's no separate flag for it (see StaffRole's own doc comment on the
 * backend: branch operations are exactly what MANAGER is for). Resolved
 * from GET /staff, the same org:manage-gated call departments/units/branches
 * above already make.
 */
const toBranchManagerLookup = (staff: Staff): BranchManagerLookup => ({
  id: staff.id,
  fullName: `${staff.firstName} ${staff.lastName}`.trim(),
  email: staff.email,
  userLevel: staff.role,
});

const toBranchLookup = (branch: Branch): BranchLookup => ({
  id: branch.id,
  name: branch.name,
  code: branch.code,
  address: branch.address ?? undefined,
  isActive: branch.active,
});

/**
 * States are readable by every role (GET /reference-data/states needs only
 * a valid session, no capability). Departments/units/branches/staff are
 * gated server-side by the `org:manage` capability (ADMIN/SUPERADMIN only,
 * see default-role-capabilities.ts) — for every other role this thunk
 * deliberately skips those four calls rather than firing requests that
 * always 403. `branchManagers` is derived client-side from that same staff
 * list (role === MANAGER) — see toBranchManagerLookup's own doc comment.
 */
export const hydrateLookups = createAsyncThunk(
  'lookups/hydrateLookups',
  async (_: void, { getState }) => {
    const role = (getState() as RootState).auth.user?.role;
    const canManageOrg = canManageOrgStructure(role);

    const [statesResult, departmentsResult, unitsResult, branchesResult, staffResult] = await Promise.allSettled([
      referenceDataService.listStates(),
      canManageOrg ? departmentsService.list() : Promise.resolve<Department[]>([]),
      canManageOrg ? unitsService.list() : Promise.resolve<Unit[]>([]),
      canManageOrg ? branchesService.list() : Promise.resolve<Branch[]>([]),
      canManageOrg ? staffService.list() : Promise.resolve<Staff[]>([]),
    ]);

    const staff = staffResult.status === 'fulfilled' ? staffResult.value : [];

    return {
      states: statesResult.status === 'fulfilled' ? statesResult.value : [],
      departments:
        departmentsResult.status === 'fulfilled' ? departmentsResult.value.map(toDepartmentLookup) : [],
      roles: unitsResult.status === 'fulfilled' ? unitsResult.value.map(toRoleLookup) : [],
      branches: branchesResult.status === 'fulfilled' ? branchesResult.value.map(toBranchLookup) : [],
      branchManagers: staff
        .filter((member) => member.role === 'MANAGER' && member.status === 'ACTIVE')
        .map(toBranchManagerLookup),
    };
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as RootState;
      if (state.lookups.loading) {
        return false;
      }
      if (state.lookups.hydrated) {
        return false;
      }
      return true;
    },
  },
);

export const upsertDepartmentScoped = createAsyncThunk<DepartmentLookup, DepartmentLookup>(
  'lookups/upsertDepartmentScoped',
  async (payload) => payload,
);

export const upsertRoleScoped = createAsyncThunk<RoleLookup, RoleLookup>(
  'lookups/upsertRoleScoped',
  async (payload) => payload,
);

export const upsertBranchScoped = createAsyncThunk<BranchLookup, BranchLookup>(
  'lookups/upsertBranchScoped',
  async (payload) => payload,
);

const upsertById = <T extends { id: string }>(items: T[], incoming: T): T[] => {
  const existingIndex = items.findIndex((item) => item.id === incoming.id);
  if (existingIndex === -1) {
    return [...items, incoming];
  }

  const next = [...items];
  next[existingIndex] = incoming;
  return next;
};

const lookupsSlice = createSlice({
  name: 'lookups',
  initialState,
  reducers: {
    setStates(state, action: PayloadAction<LookupOption[]>) {
      state.states = action.payload;
    },
    setDepartments(state, action: PayloadAction<DepartmentLookup[]>) {
      state.departments = action.payload;
    },
    setRoles(state, action: PayloadAction<RoleLookup[]>) {
      state.roles = action.payload;
    },
    setBranches(state, action: PayloadAction<BranchLookup[]>) {
      state.branches = action.payload;
    },
    setBranchManagers(state, action: PayloadAction<BranchManagerLookup[]>) {
      state.branchManagers = action.payload;
    },
    mergeDepartmentInternal(state, action: PayloadAction<DepartmentLookup>) {
      state.departments = upsertById(state.departments, action.payload);
    },
    mergeRoleInternal(state, action: PayloadAction<RoleLookup>) {
      state.roles = upsertById(state.roles, action.payload);
    },
    mergeBranchInternal(state, action: PayloadAction<BranchLookup>) {
      state.branches = upsertById(state.branches, action.payload);
    },
    upsertBranchManager(state, action: PayloadAction<BranchManagerLookup>) {
      state.branchManagers = upsertById(state.branchManagers, action.payload);
    },
    clearLookups(state) {
      state.states = [];
      state.departments = [];
      state.roles = [];
      state.branches = [];
      state.branchManagers = [];
      state.hydrated = false;
      state.loading = false;
      state.error = null;
    },
    markLookupsStale(state) {
      state.hydrated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateLookups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateLookups.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.hydrated = true;
        state.states = action.payload.states;
        state.departments = action.payload.departments;
        state.roles = action.payload.roles;
        state.branches = action.payload.branches;
        state.branchManagers = action.payload.branchManagers;
      })
      .addCase(hydrateLookups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load lookup data';
      })
      .addCase(upsertDepartmentScoped.fulfilled, (state, action) => {
        state.departments = upsertById(state.departments, action.payload);
      })
      .addCase(upsertRoleScoped.fulfilled, (state, action) => {
        state.roles = upsertById(state.roles, action.payload);
      })
      .addCase(upsertBranchScoped.fulfilled, (state, action) => {
        state.branches = upsertById(state.branches, action.payload);
      });
  },
});

export const {
  setStates,
  setDepartments,
  setRoles,
  setBranches,
  setBranchManagers,
  upsertBranchManager,
  clearLookups,
  markLookupsStale,
} = lookupsSlice.actions;

export default lookupsSlice.reducer;
