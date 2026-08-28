import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  CreateLoanProductPayload,
  LoanProduct,
  ProductStatus,
  UpdateLoanProductPayload,
} from './loan-products.types';

/** `loan-products` tag — see loan-products.types.ts's own doc comment for the workflow-mediated create/update model. */
export const loanProductsService = {
  /** Any authenticated staff member. */
  list: (status?: ProductStatus): Promise<LoanProduct[]> =>
    api.get<LoanProduct[]>('/loan-products', status ? { params: { status } } : undefined),

  getById: (id: string): Promise<LoanProduct> => api.get<LoanProduct>(`/loan-products/${id}`),

  /** Admin-initiated — returns a pending WorkflowRequest, not the product (see loan-products.types.ts). */
  create: (payload: CreateLoanProductPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateLoanProductPayload>('/loan-products', payload),

  /** Admin-initiated — returns a pending WorkflowRequest; nothing changes on the live product until approved. */
  update: (id: string, payload: UpdateLoanProductPayload): Promise<WorkflowRequestSummary> =>
    api.patch<WorkflowRequestSummary, UpdateLoanProductPayload>(`/loan-products/${id}`, payload),
};

export * from './loan-products.types';
