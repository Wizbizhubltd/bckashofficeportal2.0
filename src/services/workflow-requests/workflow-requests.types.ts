/** `workflow-requests` tag — backashbackend/src/platform/workflow-engine. The generic maker-checker surface every domain module's approval flow feeds into. */
export type WorkflowStatus = 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETURNED_TO_MAKER' | 'CANCELLED';
export type WorkflowStepAction = 'APPROVED' | 'REJECTED' | 'RETURNED';

export interface WorkflowStepSummary {
  order: number;
  requiredCapability: string;
  actedBy: string | null;
  /** Resolved server-side — null for a step nobody has acted on yet, or a staff record that no longer exists. */
  actedByName: string | null;
  action: WorkflowStepAction | null;
  comment: string | null;
  actedAt: string | null;
}

export interface WorkflowRequestSummary {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  initiatedBy: string;
  /** Resolved server-side — null if that staff record no longer exists. */
  initiatedByName: string | null;
  branchId: string | null;
  createdAt: string;
  /** Who acted (approved/rejected/returned) at each step, and their comment — the Rejected tab's "why" comes from here. */
  steps: WorkflowStepSummary[];
}

/**
 * GET /workflow-requests/:id — the one place the proposed payload itself is
 * exposed (list/history endpoints deliberately omit it, see
 * WorkflowRequestSummary — nothing about a generic response should be
 * trusted to know what's sensitive in an arbitrary domain payload). Shape
 * of `payload` depends entirely on `entityType`/`action`.
 */
export interface WorkflowRequestDetail extends WorkflowRequestSummary {
  payload: Record<string, unknown>;
}

/** A comment is required when action is 'RETURNED'. */
export interface ActOnWorkflowPayload {
  action: WorkflowStepAction;
  comment?: string;
}
