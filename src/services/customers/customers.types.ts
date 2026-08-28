/**
 * `customers` tag — backashbackend/src/modules/customers/customer.controller.ts.
 * DRAFT is where a customer actually starts (created the moment BVN
 * verification is confirmed) — creator-only visible until the marketer
 * finishes onboarding details/biometric capture and calls `POST
 * /customers/:id/submit`, which flips it to PENDING_APPROVAL and is the
 * point it becomes visible to Managers/Admins/Approvers at all.
 */
export type CustomerStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'DISABLED';
export type KycStatus = 'INCOMPLETE' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'MISMATCH_FLAGGED';

/** Free-text, non-KYC contact info — no verification concept, never encrypted. */
export interface NextOfKin {
  fullName: string;
  phoneNumber: string;
  relationship: string | null;
}

export interface Guarantor {
  fullName: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  relationship: string | null;
  occupation: string | null;
}

export interface CustomerReference {
  fullName: string;
  phoneNumber: string;
  address: string | null;
  relationship: string | null;
  occupation: string | null;
  yearsKnown: string | null;
}

export type EditPrivilegeStatus = 'NONE' | 'PENDING' | 'GRANTED' | 'REJECTED';

/**
 * Gates editing an ACTIVE (already-approved) customer's profile details.
 * `signatureImageKey` is deliberately never exposed here — fetch a signed
 * URL via `customersService.getEditPrivilegeSignatureUrl` instead, same
 * pattern as biometric/ID document images.
 */
export interface EditPrivilege {
  status: EditPrivilegeStatus;
  reason: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
  address: string | null;
  branchId: string;
  /** Resolved server-side — null only if the branch itself no longer exists. */
  branchName: string | null;
  status: CustomerStatus;
  kycStatus: KycStatus;
  createdBy: string;
  disabledReason: string | null;
  disabledBy: string | null;
  disabledAt: string | null;
  nextOfKin: NextOfKin | null;
  guarantors: Guarantor[];
  reference: CustomerReference | null;
  editPrivilege: EditPrivilege;
  /** The (approved) group this customer currently belongs to, if any — resolved server-side. */
  groupName: string | null;
  createdAt: string;
}

/**
 * GET /customers — row-level scope is enforced server-side, not by these
 * filters: a Manager always sees only their own branch and a Marketer only
 * their own records, regardless of what's passed here. Only
 * Admin/SuperAdmin/Approver can actually use branchId/createdById to narrow
 * a genuinely org-wide view.
 */
export interface ListCustomersFilter {
  branchId?: string;
  createdById?: string;
}

export interface DisableCustomerPayload {
  reason: string;
}

/**
 * "Step 1" — the real BC Kash MFB provider has no OTP/consent step at all
 * (see backend's BvnVerificationAdapter doc comment), just one live BVN
 * lookup. Creates nothing yet — see VerifyBvnResult's own doc comment; the
 * actual Customer record only exists once confirmBvnVerification is called.
 */
export interface VerifyBvnPayload {
  bvn: string;
  branchId: string;
  /** What was typed at intake — held server-side and diffed against the provider's resolved name/phone (see MismatchFlag). Never sent anywhere else. */
  fullName?: string;
  phoneNumber?: string;
}

/**
 * GET /customers/:id/repayment-risk — backashbackend's CustomerRiskService.
 * Live read against the customer's own ACTIVE loan accounts (not dependent
 * on the nightly penalty sweep having already run). NONE = nothing overdue
 * past grace; AMBER = late, within the first missed repayment cycle; RED =
 * more than one full repayment cycle behind. Drives the warning banner on
 * the Customer Detail page.
 */
export interface CustomerRepaymentRisk {
  flag: 'NONE' | 'AMBER' | 'RED';
  daysPastGrace: number | null;
  memberLoanAccountId: string | null;
  message: string | null;
}

export interface MismatchFlag {
  field: string;
  submitted: string;
  providerValue: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: 'KEPT_PROVIDER_VALUE' | 'USED_SUBMITTED_VALUE' | null;
  reason: string | null;
}

/**
 * No Customer is created by verifyBvn itself — `previewId` references a
 * short-lived, server-held record of what the provider resolved (expires at
 * `expiresAt`), which confirmBvnVerification consumes to actually create the
 * record. `resolved` is only for display; the backend never trusts it back
 * from the client.
 */
export interface VerifyBvnResult {
  previewId: string;
  resolved: { firstName: string; lastName: string; phoneNumber: string };
  mismatchFlags: MismatchFlag[];
  expiresAt: string;
}

/**
 * Resolves every currently-unresolved mismatch flag on a customer —
 * `useSubmittedValues: false` keeps the provider's resolved identity
 * (already on the record, no reason needed); `true` overwrites
 * firstName/lastName/phoneNumber with what was submitted and requires
 * `reason`. `fullName`/`phoneNumber` only need to be sent if that field was
 * actually flagged.
 */
export interface ResolveIdentityMismatchPayload {
  useSubmittedValues: boolean;
  fullName?: string;
  phoneNumber?: string;
  reason?: string;
}

export interface ResolveIdentityMismatchResult {
  customer: Customer;
  mismatchFlags: MismatchFlag[];
}

/**
 * "Step 2" — actually creates the Customer + KycRecord from a still-live
 * VerifyBvnResult.previewId. Same useSubmittedValues/fullName/phoneNumber/
 * reason shape as ResolveIdentityMismatchPayload — this is the same choice,
 * just made before creation rather than as a later patch.
 */
export interface ConfirmBvnVerificationPayload {
  previewId: string;
  useSubmittedValues: boolean;
  fullName?: string;
  phoneNumber?: string;
  reason?: string;
}

export interface ConfirmBvnVerificationResult {
  customer: Customer;
  mismatchFlags: MismatchFlag[];
}

export type IdDocumentType = 'NIN' | 'VOTERS_CARD';

export interface UpdateOnboardingDetailsPayload {
  address?: string;
  email?: string;
  nin?: string;
  nextOfKin?: {
    fullName: string;
    phoneNumber: string;
    relationship?: string;
  };
  /** Replaces the whole array on every call — up to 3, not a partial merge. */
  guarantors?: Array<{
    fullName: string;
    phoneNumber: string;
    email?: string;
    address?: string;
    relationship?: string;
    occupation?: string;
  }>;
  reference?: {
    fullName: string;
    phoneNumber: string;
    address?: string;
    relationship?: string;
    occupation?: string;
    yearsKnown?: string;
  };
}

export interface RecordNinPayload {
  nin: string;
}

export interface ManuallyVerifyNinPayload {
  note: string;
}

/** One entry of a customer's audit trail — see backend's CustomerService.getAuditTrail. */
export interface CustomerAuditEntry {
  id: string;
  actorId: string | null;
  /** Resolved server-side — null for a system action, or a staff record that no longer exists. */
  actorName: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

/** A live re-verification of the stored BVN against the provider, for a reviewer/approver to compare against what's on record. */
export interface BvnReviewComparison {
  provider: { firstName: string; lastName: string; phoneNumber: string; dateOfBirth: string };
  onRecord: { firstName: string; lastName: string; phoneNumber: string };
}

/**
 * Presence-only flags — never the actual decrypted value — driving the
 * "uploaded" indicator + eye icon in the KYC & Verification tab. Same view
 * scope as `getById` (not Admin/Approver-only).
 */
export interface CustomerKycCaptureStatus {
  biometricCaptured: boolean;
  idDocumentCaptured: boolean;
  idDocumentType: IdDocumentType | null;
  ninRecorded: boolean;
  ninVerified: boolean;
  bvnVerifiedAt: string | null;
}
