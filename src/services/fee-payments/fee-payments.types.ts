/** `fee-payments` tag — backashbackend/src/modules/loans/fee-payments.controller.ts. */
export type FeePaymentStatus = 'PENDING' | 'PAID' | 'WAIVED';

/** One fee payment record enriched with the fee/product names it references. */
export interface CustomerFeePaymentItem {
  id: string;
  productId: string;
  productName: string | null;
  feeDefinitionId: string;
  feeName: string | null;
  amountKobo: number;
  status: FeePaymentStatus;
  recordedBy: string | null;
  recordedAt: string | null;
  accountPaidTo: string | null;
  paymentReference: string | null;
  createdAt: string;
}

/**
 * One PRE_LOAN fee a customer could conceivably owe — every active
 * LoanProduct's PRE_LOAN fees, cross-referenced against whatever's already
 * been recorded. `status: 'PENDING'` and `feePaymentId: null` when nothing
 * has been recorded yet — the "Fees & Payments" tab's full list, not just
 * what's already settled.
 */
export interface AvailableFeeItem {
  productId: string;
  productName: string;
  feeDefinitionId: string;
  feeName: string;
  /** null only for a PERCENTAGE fee not based on PRINCIPAL — can't be pre-computed outside of an actual loan application. */
  amountKobo: number | null;
  status: FeePaymentStatus;
  feePaymentId: string | null;
  recordedBy: string | null;
  recordedAt: string | null;
  accountPaidTo: string | null;
  paymentReference: string | null;
}

/**
 * Upserts on (customerId, productId, feeDefinitionId) — recording the same
 * fee twice for the same customer/product overwrites, matching a real
 * front-desk correction ("actually it was waived, not paid").
 * `accountPaidTo`/`paymentReference` only meaningful (and only persisted)
 * when status is PAID.
 */
export interface RecordFeePaymentPayload {
  customerId: string;
  productId: string;
  feeDefinitionId: string;
  amountKobo: number;
  status: 'PAID' | 'WAIVED';
  accountPaidTo?: string;
  paymentReference?: string;
}

/** POST /fee-payments returns the raw FeePayment document, not the enriched CustomerFeePaymentItem shape GET /fee-payments returns. */
export interface RawFeePayment {
  _id: string;
  customerId: string;
  branchId: string;
  productId: string;
  feeDefinitionId: string;
  amountKobo: number;
  status: FeePaymentStatus;
  recordedBy: string | null;
  recordedAt: string | null;
  accountPaidTo: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}
