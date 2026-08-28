import type { StaffRole } from './auth.types';

/**
 * The app's own casing for `StaffRole` — lowercase/snake_case to match every
 * other role check already written across the frontend (Sidebar, route
 * guards, etc.). Keep this the single place that translates between the
 * backend's enum and the frontend's.
 */
export type Role = 'super_admin' | 'admin' | 'approver' | 'manager' | 'marketer';

export const ALL_ROLES: readonly Role[] = ['super_admin', 'admin', 'approver', 'manager', 'marketer'];

const STAFF_ROLE_TO_ROLE: Record<StaffRole, Role> = {
  SUPERADMIN: 'super_admin',
  ADMIN: 'admin',
  APPROVER: 'approver',
  MANAGER: 'manager',
  MARKETER: 'marketer',
};

export function mapStaffRoleToRole(userLevel: StaffRole): Role {
  return STAFF_ROLE_TO_ROLE[userLevel] ?? 'marketer';
}

/**
 * Where a role lands right after OTP verification. Every role but APPROVER
 * shares the general dashboard (its content adapts per role — see
 * Dashboard.tsx); APPROVER's entire job is clearing the approval queue, so
 * that's their designated landing page instead of a dashboard with nothing
 * for them to do on it.
 */
export const ROLE_HOME_ROUTE: Record<Role, string> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  manager: '/dashboard',
  marketer: '/dashboard',
  approver: '/loan-manager/approvals',
};

export function roleHomeRoute(role: Role | undefined | null): string {
  if (!role) {
    return '/dashboard';
  }
  return ROLE_HOME_ROUTE[role] ?? '/dashboard';
}

/** Roles allowed to list org-structure lookups (departments/units/branches) — see `org:manage` capability. */
export function canManageOrgStructure(role: Role | undefined | null): boolean {
  return role === 'super_admin' || role === 'admin';
}
