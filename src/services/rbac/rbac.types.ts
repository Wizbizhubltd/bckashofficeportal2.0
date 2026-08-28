/**
 * `rbac` tag — backashbackend/src/platform/rbac/rbac.controller.ts. Every
 * route here is SuperAdmin-only (`rbac:manage` capability) except reads that
 * happen to be exposed elsewhere (there are none today — this whole surface
 * is admin-only).
 */
import type { StaffRole } from '../auth/auth.types';

export type ModuleName = 'LOANS' | 'ACCOUNTING' | 'HR';

export interface RoleCapabilities {
  role: StaffRole;
  capabilities: string[];
}

/** PUT /rbac/role-capabilities/:role — overwrites the whole list. */
export interface ReplaceRoleCapabilitiesPayload {
  capabilities: string[];
}

/** POST /rbac/role-capabilities/:role/capabilities — grants one, idempotent. */
export interface AddRoleCapabilityPayload {
  capability: string;
}

export interface StaffModuleAccess {
  staffId: string;
  modules: ModuleName[];
}

/** PUT /rbac/staff-module-access/:staffId — overwrites the whole list. */
export interface UpdateStaffModuleAccessPayload {
  modules: ModuleName[];
}

/**
 * Mirrors backashbackend's WorkflowEntityType (common/enums/workflow.enums.ts)
 * — every entity type a maker-checker chain can be registered against. Purely
 * for building the capability-suggestion list below; the grant/revoke DTOs
 * accept any non-empty string, so this is a convenience, not validation.
 */
const WORKFLOW_ENTITY_TYPES = [
  'STAFF',
  'CUSTOMER',
  'GROUP',
  'GROUP_MEMBERSHIP',
  'LOAN',
  'LOAN_PRODUCT',
  'FEE_DEFINITION',
  'REPAYMENT_RECORD',
  'EARLY_LIQUIDATION',
  'LEAVE_APPLICATION',
  'MANUAL_JOURNAL_ENTRY',
  'SALARY_RECORD',
  'LOAN_CONFIG',
  'REPAYMENT_PENALTY_CONFIG',
  'BRANCH_RULES_CONFIG',
  'BRANCH',
] as const;

/** Mirrors backashbackend's platform/rbac/constants/capabilities.ts flat (non-workflow) capability strings. */
const FLAT_CAPABILITIES = [
  'staff:disable',
  'rbac:manage',
  'org:manage',
  'staff:create-direct',
  'branch:manage_accounts',
  'branch:fund',
  'branch:verify_funding',
  'group:reassign_leadership',
  'loan:disbursement_ops',
  'accounting:manage_accounts',
  'notifications:manage_dispatch',
  'organisation:manage',
  'hr:salary:manage',
  'leave:cancel_approved',
  'hr:leave_types:manage',
] as const;

/**
 * Every capability string the backend currently knows about — mirrors
 * ALL_KNOWN_CAPABILITIES on the backend. Used only to power an autocomplete
 * suggestion list on the "grant a capability" input; the grant/revoke
 * endpoints themselves accept any string, so this list drifting slightly
 * behind the backend's is a UX nuisance, not a correctness issue.
 */
export const KNOWN_CAPABILITIES: readonly string[] = [
  ...WORKFLOW_ENTITY_TYPES.flatMap((entityType) => [
    `workflow:initiate:${entityType}`,
    `workflow:review:${entityType}`,
    `workflow:approve:${entityType}`,
  ]),
  ...FLAT_CAPABILITIES,
];
