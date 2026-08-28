/** `loans` tag — backashbackend/src/modules/loans/loans.controller.ts. */
export type LoanStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'VERIFICATION_IN_PROGRESS'
  | 'VERIFICATION_FAILED'
  | 'DISBURSED'
  | 'REJECTED'
  | 'CLOSED';

export type MemberLoanAccountStatus = 'PENDING' | 'ACTIVE' | 'CLOSED' | 'DEFAULTED';
export type DisbursementChannel = 'TRANSFER' | 'CHEQUE_PICKUP';

/**
 * One customer's slice of one loan, enriched with the parent Loan's/
 * LoanProduct's read-only fields — the flat shape `GET /loans/member-accounts?customerId=`
 * returns (see backashbackend's LoansService.getMemberLoanAccountsForCustomer).
 * There is no per-customer "loan" resource on its own — a Loan is raised for
 * a whole group at once (see RaiseLoanApplicationDto); this is that group
 * loan's per-member share.
 */
export interface CustomerLoanHistoryItem {
  memberLoanAccountId: string;
  loanId: string;
  status: MemberLoanAccountStatus;
  loanStatus: LoanStatus | null;
  principalAmountKobo: number;
  disbursementChannel: DisbursementChannel;
  outstandingBalanceKobo: number | null;
  productId: string | null;
  productName: string | null;
  /** Annual rate, basis points (1500 = 15.00%). */
  interestRateBasisPoints: number | null;
  tenureDays: number | null;
  raisedAt: string | null;
  approvedAt: string | null;
  disbursedAt: string | null;
  maturityDate: string | null;
}

/**
 * One row of the "Group Loans Directory" — `GET /loans`, row-scoped like
 * `GET /groups` (see backashbackend's LoansService.listForActor).
 */
export interface LoanSummary {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string | null;
  productId: string;
  productName: string | null;
  memberCount: number;
  /** Every member's own name, same order as the underlying member accounts — usually just one. */
  memberCustomerNames: string[];
  cumulativeAmountKobo: number;
  /** Sum of every member's outstanding balance — 0 before disbursement. */
  outstandingBalanceKobo: number;
  /** Sum of every member's own interest — real (schedule-derived) once DISBURSED, estimated the same way beforehand. See `interestIsEstimate`. */
  totalInterestKobo: number;
  /** cumulativeAmountKobo + totalInterestKobo. */
  totalRepayableKobo: number;
  /** true until the loan is actually DISBURSED. */
  interestIsEstimate: boolean;
  status: LoanStatus;
  raisedAt: string;
  approvedAt: string | null;
  disbursedAt: string | null;
}

/** Row-level scope is enforced server-side — see LoanSummary's own doc comment. */
export interface ListLoansFilter {
  branchId?: string;
  groupId?: string;
  status?: LoanStatus;
  /** ADMIN/SUPERADMIN/APPROVER only — filters to one marketer's raised loans; ignored for MANAGER/MARKETER (already row-scoped, see GET /loans's own doc comment). */
  raisedBy?: string;
}

/** Required on a MemberLoanRequest iff disbursementChannel is TRANSFER — no bank-lookup provider is wired up, so this is exactly what the marketer typed in at application time. */
export interface BankAccountDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
}

/** `disbursementChannel` is per member, not per loan — see backend's MemberLoanRequestDto's own doc comment. */
export interface MemberLoanRequest {
  customerId: string;
  requestedAmountKobo: number;
  disbursementChannel: DisbursementChannel;
  /** Required iff disbursementChannel is TRANSFER. */
  bankAccountDetails?: BankAccountDetails;
}

/**
 * POST /loans — creates the Loan + every MemberLoanAccount immediately and
 * starts the approval chain. Every `memberLoanRequests` entry must be an
 * ACTIVE member of `groupId` — doesn't have to be every member of the
 * group, just whoever this application is actually for. `consentChallengeId`/
 * `consentCode` come from `loansService.requestConsent` — see its own comment.
 */
export interface RaiseLoanApplicationPayload {
  groupId: string;
  productId: string;
  tenureDays: number;
  memberLoanRequests: MemberLoanRequest[];
  consentChallengeId: string;
  consentCode: string;
  /** Optional, free text — why this loan is being taken. */
  purpose?: string;
}

export interface RaiseLoanApplicationResult {
  loan: { _id: string; status: LoanStatus; cumulativeAmountKobo: number };
  memberLoanAccounts: Array<{ _id: string; customerId: string; principalAmountKobo: number }>;
  workflowRequest: { _id: string; status: string };
  /** Surfaced, never blocked on — the marketer still sees these before/after raising. */
  outstandingPreLoanFees: Array<{ customerId: string; fees: Array<{ feeDefinitionId: string; feeName: string; amountKobo: number | null }> }>;
}

/** POST /loans/consent/request — see LoanConsentService's own doc comment (backend). */
export interface IssuedLoanConsentChallenge {
  challengeId: string;
  expiresAt: string;
}

export type WorkflowStepDisplayStatus = 'APPROVED' | 'REJECTED' | 'RETURNED' | 'PENDING';
export type RepaymentChannel = 'CASH' | 'BANK_TRANSFER' | 'BANK_DEPOSIT';
export type RepaymentStatus = 'PENDING' | 'APPROVED' | 'UNDER_DISPUTE' | 'REJECTED';
export type DisbursementVerificationStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'ESCALATED';

export interface LoanDetailBorrowerVerification {
  status: DisbursementVerificationStatus;
  bvnStatus: 'PASSED' | 'FAILED' | null;
  facialMatchStatus: 'PASSED' | 'FAILED' | null;
  similarityPercent: number | null;
  escalationReason: string | null;
}

export interface LoanDetailBorrower {
  memberLoanAccountId: string;
  customerId: string;
  name: string;
  phoneNumber: string;
  principalAmountKobo: number;
  disbursementChannel: DisbursementChannel;
  bankAccountDetails: BankAccountDetails | null;
  applicantPhotoImageKey: string | null;
  status: MemberLoanAccountStatus;
  outstandingBalanceKobo: number | null;
  kycStatus: string;
  chequeHandedOverAt: string | null;
  verification: LoanDetailBorrowerVerification | null;
}

export interface LoanDetailApprovalStep {
  order: number;
  requiredCapability: string;
  status: WorkflowStepDisplayStatus;
  actedByName: string | null;
  actedAt: string | null;
  comment: string | null;
}

export interface LoanDetailScheduleBorrowerRow {
  customerId: string;
  name: string;
  principalKobo: number;
  interestKobo: number;
  totalDueKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
}

export interface LoanDetailScheduleRow {
  installmentNumber: number;
  dueDate: string;
  principalKobo: number;
  interestKobo: number;
  totalDueKobo: number;
  amountPaidKobo: number;
  balanceKobo: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
  borrowerRows: LoanDetailScheduleBorrowerRow[];
}

export interface LoanDetailRepayment {
  id: string;
  memberLoanAccountId: string;
  customerId: string;
  customerName: string;
  amountKobo: number;
  channel: RepaymentChannel;
  transactionReference: string;
  paymentDate: string;
  status: RepaymentStatus;
  recordedBy: string;
  recordedByName: string | null;
  /** This repayment's own review/approval WorkflowRequest, if one is still pending — act on it via workflowRequestsService.act, same shape as the loan-level pendingWorkflowRequestId above it. */
  pendingWorkflowRequestId: string | null;
  pendingWorkflowStatus: string | null;
}

export interface LoanDetailActivityEntry {
  action: string;
  date: string;
  byName: string;
}

/** One PenaltyCharge applied against a loan's members — see backend PenaltySweepService's own doc comment (applied automatically once an installment goes overdue past its grace period). */
export interface LoanDetailPenaltyCharge {
  id: string;
  memberLoanAccountId: string;
  customerId: string;
  customerName: string;
  scheduleInstallmentNumber: number;
  overdueAmountKobo: number;
  daysLateAtApplication: number;
  penaltyAmountKobo: number;
  appliedAt: string;
}

/** `POST /loans/:loanId/members/:customerId/verify` — see backend LoanVerificationService.initiateMemberVerification's own doc comment. */
export interface DisbursementVerificationResult {
  _id: string;
  status: DisbursementVerificationStatus;
  bvnRecheck: { status: 'PASSED' | 'FAILED'; verifiedAt: string } | null;
  facialMatch: { status: 'PASSED' | 'FAILED'; similarityPercent: number } | null;
  escalationReason: string | null;
}

export type EscalationResolution = 'OVERRIDE_PASS' | 'REJECT_LOAN';

/** `GET /loans/:id/detail` — every real field the Loan Manager detail page needs, assembled server-side (see backashbackend's LoanDetailService's own doc comment). */
export interface LoanDetail {
  id: string;
  status: LoanStatus;
  purpose: string | null;
  tenureDays: number;
  cumulativeAmountKobo: number;
  /** Sum of every member's schedule totalDue — 0 before disbursement. */
  totalRepayableKobo: number;
  totalInterestKobo: number;
  outstandingBalanceKobo: number;
  raisedAt: string;
  approvedAt: string | null;
  disbursedAt: string | null;
  raisedBy: string;
  raisedByName: string;
  group: {
    id: string;
    name: string;
    branchId: string;
    branchName: string | null;
    leaderName: string | null;
    memberCount: number;
  };
  product: {
    id: string;
    name: string;
    /** Annual rate, basis points (1500 = 15.00%). */
    interestRateBasisPoints: number;
    interestType: string;
    tenureOptions: number[];
  };
  /** The pending WorkflowRequest currently driving `approvalWorkflow`, if any — act on it via workflowRequestsService.act. */
  pendingWorkflowRequestId: string | null;
  pendingWorkflowStatus: string | null;
  borrowers: LoanDetailBorrower[];
  approvalWorkflow: LoanDetailApprovalStep[];
  repaymentSchedule: LoanDetailScheduleRow[];
  repayments: LoanDetailRepayment[];
  penalties: LoanDetailPenaltyCharge[];
  activity: LoanDetailActivityEntry[];
}

/** PATCH /loans/:id — raiser only, and only while PENDING_APPROVAL. Every field optional; `memberLoanRequests`, when present, must reference the loan's existing members by customerId (never adds/removes one). */
export interface UpdatePendingLoanApplicationPayload {
  tenureDays?: number;
  purpose?: string;
  memberLoanRequests?: MemberLoanRequest[];
}
