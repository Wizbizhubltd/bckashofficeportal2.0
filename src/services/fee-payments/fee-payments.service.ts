import { api } from '../../app/api';
import type { AvailableFeeItem, CustomerFeePaymentItem, RawFeePayment, RecordFeePaymentPayload } from './fee-payments.types';

/** `fee-payments` tag. */
export const feePaymentsService = {
  /** Any authenticated staff member — a customer's full fee payment history, newest first. */
  listForCustomer: (customerId: string): Promise<CustomerFeePaymentItem[]> =>
    api.get<CustomerFeePaymentItem[]>('/fee-payments', { params: { customerId } }),

  /** Any authenticated staff member — every fee a customer could owe, paid or not. See AvailableFeeItem's own doc comment. */
  listAvailableFees: (customerId: string): Promise<AvailableFeeItem[]> =>
    api.get<AvailableFeeItem[]>('/fee-payments/available', { params: { customerId } }),

  /** Requires the loan-disbursement-ops capability — front-desk cash-collection, not maker-checker. */
  record: (payload: RecordFeePaymentPayload): Promise<RawFeePayment> =>
    api.post<RawFeePayment, RecordFeePaymentPayload>('/fee-payments', payload),
};

export * from './fee-payments.types';
