/**
 * `loan-configurations` / `repayment-penalty-configurations` /
 * `branch-rules-configurations` tags — backashbackend/src/modules/platform-config.
 *
 * Every record here is *versioned*, never edited in place: proposing a
 * change is always workflow-mediated (POST returns a WorkflowRequestSummary,
 * not the record itself), and on approval a brand-new record is created —
 * whichever record was previously ACTIVE (if any) flips to INACTIVE in the
 * same operation, so at most one record is ever ACTIVE. `proposedBy`/
 * `proposedAt`/`approvedBy`/`approvedAt` are stamped on the record itself,
 * so the full "who proposed/approved this, and when" audit trail is a plain
 * field read, not a second lookup.
 *
 * Money is always integer kobo; rates/percentages are always integer basis
 * points (1500 = 15.00%) — same project-wide convention as loan-products.
 */
export type ConfigRecordStatus = 'ACTIVE' | 'INACTIVE';
export type RepaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

interface VersionedConfigFields {
  id: string;
  status: ConfigRecordStatus;
  proposedBy: string;
  proposedAt: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanConfiguration extends VersionedConfigFields {
  /** Annual rate, basis points. */
  interestRate: number;
  maxLoanAmountKobo: number;
  minLoanAmountKobo: number;
  maxTenureMonths: number;
  gracePeriodDays: number;
  maxGroupSize: number;
  minGroupSize: number;
}

export interface CreateLoanConfigurationPayload {
  interestRate: number;
  maxLoanAmountKobo: number;
  minLoanAmountKobo: number;
  maxTenureMonths: number;
  gracePeriodDays: number;
  maxGroupSize: number;
  minGroupSize: number;
}

export interface RepaymentPenaltyConfiguration extends VersionedConfigFields {
  /** Basis points. */
  penaltyRate: number;
  penaltyGracePeriodDays: number;
  /** Basis points. */
  maxPenaltyCap: number;
  autoPenalty: boolean;
  repaymentFrequency: RepaymentFrequency;
}

export interface CreateRepaymentPenaltyConfigurationPayload {
  penaltyRate: number;
  penaltyGracePeriodDays: number;
  maxPenaltyCap: number;
  autoPenalty: boolean;
  repaymentFrequency: RepaymentFrequency;
}

export interface BranchRulesConfiguration extends VersionedConfigFields {
  maxActiveBranches: number;
  defaultFundLimitKobo: number;
  requireManagerApproval: boolean;
  autoDisbursementLimitKobo: number;
}

export interface CreateBranchRulesConfigurationPayload {
  maxActiveBranches: number;
  defaultFundLimitKobo: number;
  requireManagerApproval: boolean;
  autoDisbursementLimitKobo: number;
}
