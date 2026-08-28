import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type { ListRepaymentsFilter, RecordRepaymentPayload, RepaymentListItem } from './repayments.types';

/** `repayments` tag — see repayments.types.ts's own doc comment. */
export const repaymentsService = {
  /** Maker-initiated — returns a pending WorkflowRequest, no balance effect until reviewed + approved. */
  recordRepayment: (payload: RecordRepaymentPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, RecordRepaymentPayload>('/repayments', payload),

  /** Row-scoped like `loansService.list` — see RepaymentListItem's own doc comment. */
  list: (filter?: ListRepaymentsFilter): Promise<RepaymentListItem[]> =>
    api.get<RepaymentListItem[]>('/repayments', filter ? { params: filter } : undefined),
};

export * from './repayments.types';
