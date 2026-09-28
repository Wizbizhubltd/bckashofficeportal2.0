import type { LucideIcon } from 'lucide-react';
import { Building2Icon, LandmarkIcon, UserCogIcon, UsersIcon } from 'lucide-react';

/**
 * The user types that sign in to the office portal. Super admins use the control portal only
 * (the API refuses them here), so they have no routes in this app.
 */
export const OFFICE_ROLES = ['director', 'controller', 'manager', 'marketer'] as const;
export type OfficeRole = (typeof OFFICE_ROLES)[number];

export function isOfficeRole(value: string | null | undefined): value is OfficeRole {
  return OFFICE_ROLES.includes(value as OfficeRole);
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  director: 'Director',
  controller: 'Controller',
  manager: 'Manager',
  marketer: 'Marketer',
};

/** Mirrors the API's seniority (UserTypeSlugs.Rank): staff only manage staff ranked below them. */
const ROLE_RANK: Record<string, number> = { super_admin: 5, director: 4, controller: 3, manager: 2, marketer: 1 };

/** The user types a role may onboard or manage — every office user type ranked below it. */
export function rolesBelow(role: OfficeRole): OfficeRole[] {
  return OFFICE_ROLES.filter((other) => ROLE_RANK[other] < ROLE_RANK[role]);
}

export type ModuleKey = 'offices' | 'staff' | 'clients' | 'loans';

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  links: { path: string; label: string }[];
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  offices: {
    key: 'offices',
    label: 'Zones & Offices',
    icon: Building2Icon,
    links: [{ path: '/offices', label: 'My Zones & Offices' }],
  },
  staff: {
    key: 'staff',
    label: 'Staff',
    icon: UserCogIcon,
    links: [
      { path: '/staff', label: 'Staff Directory' },
      { path: '/staff/new', label: 'Onboard Staff' },
    ],
  },
  clients: {
    key: 'clients',
    label: 'Clients',
    icon: UsersIcon,
    links: [
      { path: '/clients', label: 'Clients' },
      { path: '/groups', label: 'Groups' },
    ],
  },
  loans: {
    key: 'loans',
    label: 'Loans',
    icon: LandmarkIcon,
    links: [{ path: '/loan-applications', label: 'Loan Applications' }],
  },
};

/**
 * Modules each role gets by default. A marketer works clients and loans; a manager and a
 * controller (who outranks the manager in the same office) also manage staff; a director
 * additionally oversees every office in the zones a super admin assigned them.
 */
export const ROLE_MODULES: Record<OfficeRole, ModuleKey[]> = {
  director: ['offices', 'staff', 'clients', 'loans'],
  controller: ['staff', 'clients', 'loans'],
  manager: ['staff', 'clients', 'loans'],
  marketer: ['clients', 'loans'],
};

export function roleHome(role: OfficeRole): string {
  return `/${role}`;
}
