/** `repayments` tag — backashbackend/src/modules/repayments/repayments.controller.ts. Workflow-mediated: recording is only the maker step, no balance effect until Manager review + Admin/Approver approval. */
export type RepaymentChannel = 'CASH' | 'BANK_TRANSFER' | 'BANK_DEPOSIT';
export type RepaymentStatus = 'PENDING' | 'APPROVED' | 'UNDER_DISPUTE' | 'REJECTED';

export interface RecordRepaymentPayload {
  memberLoanAccountId: string;
  branchBankAccountId: string;
  channel: RepaymentChannel;
  transactionReference: string;
  amountKobo: number;
  /** ISO date string. */
  paymentDate: string;
}

/** Row-level scope enforced server-side — see backend LoanDetailService.listRepaymentsForActor's own doc comment. */
export interface ListRepaymentsFilter {
  branchId?: string;
  loanId?: string;
  status?: RepaymentStatus;
}

/** `GET /repayments` — one row per real repayment, enriched with group/customer/branch names. */
export interface RepaymentListItem {
  id: string;
  loanId: string;
  groupId: string;
  groupName: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchName: string | null;
  amountKobo: number;
  channel: RepaymentChannel;
  transactionReference: string;
  paymentDate: string;
  status: RepaymentStatus;
  recordedBy: string;
  recordedByName: string | null;
  /** This repayment's own pending review/approval WorkflowRequest, if any — act on it via workflowRequestsService.act, same shape as loans.types.ts's LoanDetailRepayment. */
  pendingWorkflowRequestId: string | null;
  pendingWorkflowStatus: string | null;
}
