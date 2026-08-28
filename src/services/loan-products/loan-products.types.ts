/**
 * `loan-products` tag — backashbackend/src/modules/loan-products/loan-products.controller.ts.
 * Create/update are workflow-mediated (Admin-initiated, Admin/SuperAdmin-approved
 * — a single-step chain) — neither takes effect immediately, both return a
 * WorkflowRequestSummary, not the product itself. There is no delete
 * endpoint: retiring a product is PATCH-ing `status` to INACTIVE, same as
 * everything else here, still subject to approval.
 *
 * Money is always integer kobo; interestRate/penaltyRule.value (when
 * PERCENTAGE) are always integer basis points (1500 = 15.00%) — never a
 * float, matching the project-wide convention documented on the backend's
 * loan-product.enums.ts.
 */
export type InterestType = 'FLAT' | 'REDUCING';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'REJECTED';
export type FeeCalcType = 'FIXED' | 'PERCENTAGE';
export type PenaltyPercentageBasis = 'PRINCIPAL' | 'OUTSTANDING' | 'OVERDUE_AMOUNT';
export type PenaltyFrequency = 'ONE_TIME' | 'RECURRING';

export interface ApprovalChainStep {
  order: number;
  requiredCapability: string;
}

export interface PenaltyRule {
  calcType: FeeCalcType;
  /** Kobo when calcType is FIXED; basis points when PERCENTAGE. */
  value: number;
  /** Required when calcType is PERCENTAGE. */
  percentageOf: PenaltyPercentageBasis | null;
  gracePeriodDays: number;
  frequency: PenaltyFrequency;
  /** Required when frequency is RECURRING. */
  recurrenceIntervalDays: number | null;
  /** Optional even when RECURRING — null means no cap. */
  maxRecurrences: number | null;
}

export interface LoanProduct {
  id: string;
  name: string;
  /** Annual rate, basis points. */
  interestRate: number;
  interestType: InterestType;
  /** Days, e.g. [14, 30, 60] — 14 is the system-wide floor. */
  tenureOptions: number[];
  minGroupSize: number;
  /** Days per repayment installment — 7 (weekly) is the standard cadence. */
  repaymentPeriodDays: number;
  feeIds: string[];
  approvalChainSteps: ApprovalChainStep[];
  penaltyRule: PenaltyRule;
  status: ProductStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PenaltyRuleInput {
  calcType: FeeCalcType;
  value: number;
  percentageOf?: PenaltyPercentageBasis;
  gracePeriodDays: number;
  frequency: PenaltyFrequency;
  recurrenceIntervalDays?: number;
  maxRecurrences?: number;
}

/** POST /loan-products — Admin-initiated, workflow-approved. `repaymentPeriodDays` defaults to 7 (weekly) server-side when omitted. */
export interface CreateLoanProductPayload {
  name: string;
  interestRate: number;
  interestType: InterestType;
  tenureOptions: number[];
  minGroupSize: number;
  repaymentPeriodDays?: number;
  feeIds: string[];
  approvalChainSteps: ApprovalChainStep[];
  penaltyRule: PenaltyRuleInput;
}

/** PATCH /loan-products/:id — every field optional; only what's present is proposed as a change. */
export type UpdateLoanProductPayload = Partial<CreateLoanProductPayload> & { status?: ProductStatus };
