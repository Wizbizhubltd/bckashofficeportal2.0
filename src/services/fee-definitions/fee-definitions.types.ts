/**
 * `fee-definitions` tag — backashbackend/src/modules/loan-products/fee-definitions.controller.ts.
 * Create/update are workflow-mediated (Admin-initiated, Admin/SuperAdmin-
 * approved) — same model as loan-products, see that module's own doc
 * comment. There is no delete endpoint: retiring a fee is PATCH-ing
 * `active` to false, still subject to approval.
 */
export type FeeCategory = 'REGISTRATION' | 'FORM' | 'MEMBERSHIP' | 'LATE_REPAYMENT' | 'EARLY_LIQUIDATION' | 'OTHER';
export type FeeTiming = 'PRE_LOAN' | 'DURING_LIFECYCLE';
export type FeeCalcType = 'FIXED' | 'PERCENTAGE';
export type FeePercentageBasis = 'PRINCIPAL' | 'OUTSTANDING' | 'OVERDUE_AMOUNT';
export type FeeAppliesTo = 'PER_MEMBER' | 'PER_GROUP';
export type PenaltyFrequency = 'ONE_TIME' | 'RECURRING';

export interface FeeDefinition {
  id: string;
  name: string;
  category: FeeCategory;
  timing: FeeTiming;
  calcType: FeeCalcType;
  /** Kobo when calcType is FIXED; basis points when PERCENTAGE. */
  value: number;
  percentageOf: FeePercentageBasis | null;
  appliesTo: FeeAppliesTo;
  frequency: PenaltyFrequency;
  recurrenceIntervalDays: number | null;
  maxRecurrences: number | null;
  /** Informational/denormalized — LoanProduct.feeIds is the authoritative link, see LoanProductsService. */
  productIds: string[];
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /fee-definitions — Admin-initiated, workflow-approved. */
export interface CreateFeeDefinitionPayload {
  name: string;
  category: FeeCategory;
  timing: FeeTiming;
  calcType: FeeCalcType;
  value: number;
  percentageOf?: FeePercentageBasis;
  appliesTo: FeeAppliesTo;
  productIds?: string[];
  frequency?: PenaltyFrequency;
  recurrenceIntervalDays?: number;
  maxRecurrences?: number;
}

/** PATCH /fee-definitions/:id — every field optional. */
export type UpdateFeeDefinitionPayload = Partial<CreateFeeDefinitionPayload> & { active?: boolean };
