import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  CreateFeeDefinitionPayload,
  FeeCategory,
  FeeDefinition,
  UpdateFeeDefinitionPayload,
} from './fee-definitions.types';

/** `fee-definitions` tag — see fee-definitions.types.ts's own doc comment for the workflow-mediated create/update model. */
export const feeDefinitionsService = {
  /** Any authenticated staff member. */
  list: (filter?: { category?: FeeCategory; active?: boolean }): Promise<FeeDefinition[]> =>
    api.get<FeeDefinition[]>('/fee-definitions', filter ? { params: filter } : undefined),

  getById: (id: string): Promise<FeeDefinition> => api.get<FeeDefinition>(`/fee-definitions/${id}`),

  /** Admin-initiated — returns a pending WorkflowRequest, not the fee. */
  create: (payload: CreateFeeDefinitionPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateFeeDefinitionPayload>('/fee-definitions', payload),

  /** Admin-initiated — returns a pending WorkflowRequest; nothing changes on the live fee until approved. */
  update: (id: string, payload: UpdateFeeDefinitionPayload): Promise<WorkflowRequestSummary> =>
    api.patch<WorkflowRequestSummary, UpdateFeeDefinitionPayload>(`/fee-definitions/${id}`, payload),
};

export * from './fee-definitions.types';
