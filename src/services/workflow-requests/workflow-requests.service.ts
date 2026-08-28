import { api } from '../../app/api';
import type { ActOnWorkflowPayload, WorkflowRequestDetail, WorkflowRequestSummary } from './workflow-requests.types';

/**
 * `workflow-requests` tag — the generic approve/reject/return surface every
 * domain module's `initiate()` call feeds into (Staff onboarding, Customer
 * KYC, Group creation, loan product/fee/salary config changes, ...). One
 * service, not one per entity type.
 */
export const workflowRequestsService = {
  /** Every WorkflowRequest currently awaiting the signed-in staff member, across every entity type. */
  getPending: (): Promise<WorkflowRequestSummary[]> => api.get<WorkflowRequestSummary[]>('/workflow-requests/pending'),

  /**
   * Every still-pending WorkflowRequest for one entity type — unlike
   * `getPending`, this includes the caller's own submissions too, so a
   * maker can confirm their proposal is genuinely pending rather than
   * concluding it vanished. Hide the approve/reject action yourself for
   * entries where `initiatedBy` is the signed-in staff member — `act()`
   * enforces that same rule server-side regardless.
   */
  getPendingByEntityType: (entityType: string): Promise<WorkflowRequestSummary[]> =>
    api.get<WorkflowRequestSummary[]>(`/workflow-requests/pending-all/${encodeURIComponent(entityType)}`),

  /** The Rejected-tab counterpart to `getPendingByEntityType` — every REJECTED request for one entity type. */
  getRejectedByEntityType: (entityType: string): Promise<WorkflowRequestSummary[]> =>
    api.get<WorkflowRequestSummary[]>(`/workflow-requests/rejected-all/${encodeURIComponent(entityType)}`),

  /** Full timeline for one entity, oldest first. */
  getHistory: (entityType: string, entityId: string): Promise<WorkflowRequestSummary[]> =>
    api.get<WorkflowRequestSummary[]>(`/workflow-requests/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/history`),

  /** The one place the proposed payload itself is exposed — see WorkflowRequestDetail's own doc comment. */
  getById: (id: string): Promise<WorkflowRequestDetail> => api.get<WorkflowRequestDetail>(`/workflow-requests/${id}`),

  /** Approve, reject, or return — the caller needs whatever capability the *current* step requires. */
  act: (id: string, payload: ActOnWorkflowPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, ActOnWorkflowPayload>(`/workflow-requests/${id}/act`, payload),

  /** Initiator only — withdraws their own not-yet-approved (or already REJECTED/RETURNED_TO_MAKER) request. Keeps a CANCELLED record. */
  cancel: (id: string): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, undefined>(`/workflow-requests/${id}/cancel`, undefined),

  /** Initiator only, and only while PENDING_REVIEW or REJECTED — permanently removes the request (no record kept). */
  deleteRequest: (id: string): Promise<{ deleted: true }> => api.delete<{ deleted: true }>(`/workflow-requests/${id}`),
};

export * from './workflow-requests.types';
