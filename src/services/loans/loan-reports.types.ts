import type { LoanStatus } from './loans.types';

export type { LoanStatus };

/** `GET /loan-reports` — backashbackend/src/modules/repayments/loan-reports.controller.ts.
 * A dedicated `loan-reports` resource, not nested under `/loans` — see that
 * controller's own doc comment for why (route-collision avoidance with
 * `GET /loans/:id`). Row-scoped exactly like `loansService.list`: a
 * Marketer only ever sees their own raised loans reflected here, a Manager
 * only their own branch's, Admin/SuperAdmin/Approver everything (optionally
 * narrowed by `branchId`). */
export interface LoanReportsFilter {
  branchId?: string;
}

export interface LoanReportsPortfolioSummary {
  totalLoans: number;
  byStatus: Record<LoanStatus, number>;
  totalDisbursedKobo: number;
  totalOutstandingKobo: number;
  totalInterestKobo: number;
  totalRepaidKobo: number;
}

export interface LoanReportsDelinquencyRow {
  loanId: string;
  customerId: string;
  customerName: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string | null;
  installmentNumber: number;
  overdueAmountKobo: number;
  penaltyAmountKobo: number;
  daysLateAtApplication: number;
  appliedAt: string;
}

export interface LoanReportsDelinquency {
  totalOverdueAccounts: number;
  totalOverdueAmountKobo: number;
  totalPenaltyAmountKobo: number;
  atRiskGroupCount: number;
  rows: LoanReportsDelinquencyRow[];
}

/** One trailing week's expected-vs-collected totals — see backend buildCollection's own doc comment (a trend report, not a per-installment reconciliation). */
export interface LoanReportsCollectionPeriod {
  periodLabel: string;
  periodStart: string;
  expectedKobo: number;
  collectedKobo: number;
}

export interface LoanReportsGroupPerformanceRow {
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string | null;
  memberCount: number;
  totalLoansRaised: number;
  activeLoansCount: number;
  totalDisbursedKobo: number;
  totalOutstandingKobo: number;
  expectedKobo: number;
  collectedKobo: number;
  /** collectedKobo / expectedKobo * 100, rounded — 100 when nothing has been due yet. */
  repaymentRatePercent: number;
}

export interface LoanReportsResult {
  generatedAt: string;
  portfolioSummary: LoanReportsPortfolioSummary;
  delinquency: LoanReportsDelinquency;
  collection: { weekly: LoanReportsCollectionPeriod[] };
  groupPerformance: LoanReportsGroupPerformanceRow[];
}
