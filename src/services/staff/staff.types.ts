/**
 * `staff` tag — backashbackend/src/modules/identity/staff.controller.ts.
 * `role`/`userType` mirror `services/auth/auth.types.ts`'s `StaffRole`/
 * `StaffUserType` — kept spelled out here too rather than imported, since
 * this module's DTOs restrict them further (both onboarding paths exclude
 * SUPERADMIN — see ONBOARDABLE_STAFF_ROLES on the backend).
 */
import type { StaffRole, StaffUserType } from '../auth/auth.types';

/** Every role either onboarding path may ever create — never SUPERADMIN, see backend's ONBOARDABLE_STAFF_ROLES/CreateStaffDirectDto. */
export type OnboardableStaffRole = Exclude<StaffRole, 'SUPERADMIN'>;

export type Gender = 'Male' | 'Female';
export type IdentificationType = 'NIN' | 'Passport' | 'DriversLicense' | 'VotersCard';

export interface ResidentialAddress {
  state: string;
  city: string;
  street: string;
}

export interface KycDetails {
  dateOfBirth: string;
  gender: Gender;
  idType: IdentificationType;
  idNumber: string;
}

export interface ContactPerson {
  name: string;
  relationship: string;
  phoneNumber: string;
  address: string;
}

/** Fields shared by both onboarding paths — see Staff schema's own field groups. */
interface StaffOnboardingCommon {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: StaffUserType;
  departmentId: string;
  unitId: string;
  branchId: string;
  moduleAccess: Array<'LOANS' | 'ACCOUNTING' | 'HR'>;
  startDate: string;
  /** Optional — captured now (encrypted immediately) but not marked verified; see POST /staff/verify-bvn-preview and POST /staff/:id/verify-bvn. */
  bvn?: string;
  residentialAddress: ResidentialAddress;
  kyc: KycDetails;
  nextOfKin: ContactPerson;
  reference: ContactPerson;
  /** Optional. Supplying either turns the request into multipart/form-data — see staff.service.ts's onboard/createDirect. */
  passportPhoto?: File;
  idDocument?: File;
}

/** POST /staff/onboard — workflow-mediated, any role in OnboardableStaffRole (never SUPERADMIN). */
export interface InitiateStaffOnboardingPayload extends StaffOnboardingCommon {
  role: OnboardableStaffRole;
}

/** POST /staff/direct — SuperAdmin only, immediate (no approval), MANAGER/ADMIN/APPROVER only (never MARKETER/SUPERADMIN). */
export interface CreateStaffDirectPayload extends StaffOnboardingCommon {
  role: Extract<StaffRole, 'MANAGER' | 'ADMIN' | 'APPROVER'>;
}

export type WorkflowStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED';

/** What POST /staff/onboard returns — a WorkflowRequest summary, not a Staff record (that's only created on approval). */
export interface WorkflowRequestSummary {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  initiatedBy: string;
  branchId: string | null;
  createdAt: string;
}

export type StaffStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'DISABLED' | 'REJECTED';

export type StaffEmploymentType = 'FullTime' | 'PartTime' | 'Contract' | 'Internship' | 'Temporary';

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: StaffRole;
  userType: StaffUserType;
  departmentId: string;
  unitId: string;
  branchId: string;
  moduleAccess: Array<'LOANS' | 'ACCOUNTING' | 'HR'>;
  status: StaffStatus;
  disabledReason: string | null;
  disabledBy: string | null;
  disabledAt: string | null;
  bvnVerified: boolean;
  bvnVerifiedAt: string | null;
  mustChangePassword: boolean;
  startDate: string | null;
  residentialAddress: ResidentialAddress | null;
  kyc: KycDetails | null;
  nextOfKin: ContactPerson | null;
  reference: ContactPerson | null;
  /** Public URLs under the backend's /uploads static mount — see PATCH /staff/:id/documents. */
  passportPhotoUrl: string | null;
  idDocumentUrl: string | null;
  /** HR-facing — not collected at onboarding, set/edited later via PATCH /staff/:id. */
  employmentType: StaffEmploymentType | null;
  salaryGrade: string | null;
  /** Another Staff's id — who this person reports to. Resolve the name client-side against the staff list. */
  managerId: string | null;
  lastLoginAt: string | null;
  /** Manual admin sign-off, no live verification provider behind these three (unlike bvnVerified). */
  ninVerified: boolean;
  guarantorFormVerified: boolean;
  offerLetterVerified: boolean;
  createdAt: string;
}

/**
 * PATCH /staff/:id/documents — both optional, send only what's changing.
 * Not a plain JSON payload: the service method builds a FormData from this
 * (multipart/form-data is the only way to send a file).
 */
export interface UpdateStaffDocumentsPayload {
  passportPhoto?: File;
  idDocument?: File;
}

export interface VerifyBvnPayload {
  bvn: string;
}

/** POST /staff/verify-bvn-preview's response — the provider's resolved identity, nothing persisted. */
export interface BvnPreview {
  bvn: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  phoneNumber: string;
}

export interface DisableStaffPayload {
  reason: string;
}

/**
 * PATCH /staff/me — self-service subset only: everything org-managed
 * (role/department/unit/branch/email/moduleAccess/status) and everything
 * with its own dedicated endpoint (BVN, documents) is out of scope here.
 * Every field optional: send only what's changing.
 */
export interface UpdateOwnProfilePayload {
  phoneNumber?: string;
  residentialAddress?: ResidentialAddress;
  nextOfKin?: ContactPerson;
  reference?: ContactPerson;
}

/**
 * PATCH /staff/:id — an org:manage admin (ADMIN/SUPERADMIN) editing another
 * staff member's record. Every field optional: send only what's changing.
 * Deliberately excludes status (use disable/enable), BVN verification (use
 * verifyBvn), compliance verification (use updateCompliance), and documents
 * (use updateDocuments) — see UpdateStaffProfileDto's own doc comment on
 * the backend. `role` can never be/become SUPERADMIN through this route.
 */
export interface UpdateStaffProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  role?: Exclude<StaffRole, 'SUPERADMIN'>;
  userType?: StaffUserType;
  departmentId?: string;
  unitId?: string;
  branchId?: string;
  employmentType?: StaffEmploymentType;
  salaryGrade?: string;
  /** Another Staff's id — pass '' to clear it. */
  managerId?: string;
  residentialAddress?: ResidentialAddress;
  kyc?: KycDetails;
  nextOfKin?: ContactPerson;
  reference?: ContactPerson;
}

/** PATCH /staff/:id/compliance — manual admin sign-off, no live provider behind any of these three. Every field optional. */
export interface UpdateStaffCompliancePayload {
  ninVerified?: boolean;
  guarantorFormVerified?: boolean;
  offerLetterVerified?: boolean;
}

/** GET /staff/:id/performance — computed fresh on every call, never stale. */
export interface StaffPerformanceSummary {
  customersOnboarded: number;
  activeGroups: number;
  loansRaised: number;
  lastLoginAt: string | null;
}

/** GET /staff/:id/activity — sourced from the real audit trail, newest first. */
export interface StaffActivityEntry {
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
}
