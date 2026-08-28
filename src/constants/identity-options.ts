import type { SelectOption } from '../components/ReusableReactSelect';

/**
 * Shared between StaffOnboarding.tsx (editable) and the profile pages
 * (mostly read-only display) — one place for the Gender/IdentificationType
 * label mapping so the two don't drift.
 */
export const GENDER_OPTIONS: SelectOption[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
];

export const ID_TYPE_OPTIONS: SelectOption[] = [
  { label: 'NIN (National ID)', value: 'NIN' },
  { label: 'International Passport', value: 'Passport' },
  { label: "Driver's License", value: 'DriversLicense' },
  { label: "Voter's Card", value: 'VotersCard' },
];

export const ID_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ID_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * Every role either onboarding path (workflow-mediated or SuperAdmin direct)
 * may ever create or assign — never SUPERADMIN, see the backend's
 * `ONBOARDABLE_STAFF_ROLES`/`OnboardableStaffRole` and
 * `UpdateStaffProfileDto`'s own "never SUPERADMIN via this route either as
 * the new value or the existing one" comment. StaffOnboarding.tsx further
 * filters this down to exclude ADMIN/APPROVER unless the onboarder is
 * Admin/SuperAdmin — see that page's own `staffRoleOptions`.
 */
export const STAFF_ROLE_OPTIONS: SelectOption[] = [
  { label: 'Marketer', value: 'MARKETER' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Approver', value: 'APPROVER' },
];

/**
 * Display-only lookup, unlike STAFF_ROLE_OPTIONS above — covers every
 * StaffRole including SUPERADMIN, since a staff record (e.g. the seeded
 * SuperAdmin's own) can carry that role even though it's never a
 * selectable/assignable option anywhere in the UI.
 */
export const STAFF_ROLE_LABEL: Record<string, string> = {
  ...Object.fromEntries(STAFF_ROLE_OPTIONS.map((option) => [option.value, option.label])),
  SUPERADMIN: 'Super Admin',
};

/**
 * Display-only lookup — backend `StaffStatus` enum. Label strings match
 * StatusBadge's known StatusType values so callers can pass these straight
 * through (see StaffDetail.tsx/HrManager.tsx).
 */
export const STAFF_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  ACTIVE: 'Active',
  DISABLED: 'Suspended',
  REJECTED: 'Rejected',
};

/**
 * Backend `StaffUserType` enum — a staff member's function in an approval
 * chain. Real access control (Initiator/Authorizer RBAC), not just display:
 * Initiator can only ever initiate workflow requests, Authorizer can only
 * ever review/approve them. "Reviewer" is deliberately excluded — it's a
 * legacy value the backend only ever backfills onto a pre-existing record
 * (StaffService.resolveUserType rejects it as a new value outright), never
 * a real choice for a staff member going forward. MARKETER is always forced
 * to Initiator server-side regardless of what's selected here — see
 * StaffOnboarding.tsx's own handling of that.
 */
export const STAFF_USER_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Initiator', value: 'Initiator' },
  { label: 'Authorizer', value: 'Authorizer' },
];

/** Backend `StaffEmploymentType` enum — HR-facing, set/edited after onboarding via PATCH /staff/:id. */
export const EMPLOYMENT_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Full-Time', value: 'FullTime' },
  { label: 'Part-Time', value: 'PartTime' },
  { label: 'Contract', value: 'Contract' },
  { label: 'Internship', value: 'Internship' },
  { label: 'Temporary', value: 'Temporary' },
];
