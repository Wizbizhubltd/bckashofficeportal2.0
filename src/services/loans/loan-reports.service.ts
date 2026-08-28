import { api } from '../../app/api';
import type { LoanReportsFilter, LoanReportsResult } from './loan-reports.types';

/** `loan-reports` tag — backashbackend/src/modules/repayments/loan-reports.controller.ts. */
export const loanReportsService = {
  /** One payload for the whole Loan Reports page — portfolio summary, delinquency, weekly collection trend, and group performance. */
  getReports: (filter?: LoanReportsFilter): Promise<LoanReportsResult> =>
    api.get<LoanReportsResult>('/loan-reports', filter ? { params: filter } : undefined),
};

export * from './loan-reports.types';
