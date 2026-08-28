/**
 * `branch-funding` tag — backashbackend/src/modules/branches/branch-funding.controller.ts.
 * A two-party confirmation, deliberately not routed through the generic
 * workflow engine: head office records a funding amount for a branch
 * (PENDING_VERIFICATION, no balance effect yet), and only that branch's own
 * *current* manager can verify (credits the branch's available balance) or
 * reject it. Controller has no response DTOs — returns raw Mongoose
 * documents (`_id`, not `id`); `Raw*` are the wire shapes.
 */
export type BranchFundingStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';

/** Embedded dispute "slot" on a funding record — see the backend's BranchFundingDisputeDetails own doc comment. One dispute at a time; a new one can only be raised once the previous is resolved. */
export interface BranchFundingDisputeDetails {
  raisedBy: string;
  reason: string;
  raisedAt: string;
  resolution: 'RESOLVED' | 'DISMISSED' | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface RawBranchFunding {
  _id: string;
  branchId: string;
  /** The branch's own bank account this funding was recorded against — must have been that branch's *active* account at record time. */
  bankAccountId: string;
  /** Kobo — integer, never a float (project-wide convention). */
  amount: number;
  fundedAt: string;
  reference: string | null;
  source: 'HEAD_OFFICE';
  status: BranchFundingStatus;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  disputeDetails: BranchFundingDisputeDetails | null;
  lastNudgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchFunding {
  id: string;
  branchId: string;
  bankAccountId: string;
  amount: number;
  fundedAt: string;
  reference: string | null;
  source: 'HEAD_OFFICE';
  status: BranchFundingStatus;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  disputeDetails: BranchFundingDisputeDetails | null;
  lastNudgedAt: string | null;
  createdAt: string;
}

/**
 * POST /branch-funding — requires branch:fund. Pending until the branch's
 * own current manager verifies it. `bankAccountId` must be this branch's
 * currently-*active* account (see branch-bank-accounts.service.ts) — a
 * branch with no active account can't be funded until it has one.
 */
export interface RecordBranchFundingPayload {
  branchId: string;
  bankAccountId: string;
  /** Kobo — integer, never a float. */
  amount: number;
  /** ISO 8601. */
  fundedAt: string;
  reference?: string;
}

/** POST /branch-funding/:id/reject — requires branch:verify_funding, only the branch's own current manager. */
export interface RejectBranchFundingPayload {
  reason: string;
}
