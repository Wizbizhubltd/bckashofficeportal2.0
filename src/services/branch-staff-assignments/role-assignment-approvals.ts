import { branchesService } from '../branches/branches.service';
import { staffService } from '../staff/staff.service';
import { workflowRequestsService } from '../workflow-requests/workflow-requests.service';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';

/**
 * `WorkflowEntityType.BRANCH_ROLE_ASSIGNMENT` — the maker-checker entity type
 * `branchStaffAssignmentsService.assign()` (see branch-staff-assignments.service.ts)
 * proposes into. Unlike BRANCH_MANAGER_ASSIGNMENT this is never filterable by
 * `WorkflowRequestSummary.branchId` — the batch is initiated with
 * `branchId: null` server-side (see BranchStaffRoleAssignmentService.initiateAssignment)
 * because one proposal can cover several branches at once. Filtering by
 * branch or by staff has to happen client-side against the resolved payload
 * instead — see `buildRoleAssignmentProposalRows`.
 */
export const BRANCH_ROLE_ASSIGNMENT_ENTITY_TYPE = 'BRANCH_ROLE_ASSIGNMENT';

export interface RoleAssignmentProposalRow {
  requestId: string;
  staffId: string;
  staffName: string;
  role: string;
  branchIds: string[];
  branchNames: string;
  comments: string | null;
  proposedByName: string;
  proposedAt: string;
  isOwnProposal: boolean;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionComment: string | null;
}

/**
 * Pending/Rejected BRANCH_ROLE_ASSIGNMENT proposals, resolved down to
 * display-ready rows. One `getById` per entry to reach the payload
 * (`{ staffId, branchIds, role, comments }` — see
 * AssignBranchStaffRolePayload) plus one staff-name and N branch-name lookup
 * per entry — same N+1-but-small pattern as BranchDetail.tsx's own
 * `buildManagerProposalRows`. Callers filter the result down to one branch
 * or one staff member themselves (see `RoleAssignmentApprovalsFilter` in
 * useRoleAssignmentApprovals.ts) since the workflow request itself carries
 * neither.
 */
export async function buildRoleAssignmentProposalRows(
  requests: WorkflowRequestSummary[],
  currentUserId: string | undefined,
): Promise<RoleAssignmentProposalRow[]> {
  return Promise.all(
    requests.map(async (entry) => {
      const detail = await workflowRequestsService.getById(entry.id).catch(() => null);
      const payload = (detail?.payload ?? {}) as Record<string, unknown>;
      const staffId = typeof payload.staffId === 'string' ? payload.staffId : undefined;
      const role = typeof payload.role === 'string' ? payload.role : '';
      const comments = typeof payload.comments === 'string' ? payload.comments : null;
      const branchIds = Array.isArray(payload.branchIds)
        ? (payload.branchIds as unknown[]).filter((v): v is string => typeof v === 'string')
        : [];

      const [staffName, branchNames] = await Promise.all([
        staffId
          ? staffService
              .getById(staffId)
              .then((s) => `${s.firstName} ${s.lastName}`.trim() || staffId)
              .catch(() => staffId)
          : Promise.resolve('Unknown staff'),
        Promise.all(branchIds.map((branchId) => branchesService.getById(branchId).then((b) => b.name).catch(() => branchId))),
      ]);

      const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');

      return {
        requestId: entry.id,
        staffId: staffId ?? '',
        staffName,
        role,
        branchIds,
        branchNames: branchNames.join(', ') || '—',
        comments,
        proposedByName: entry.initiatedByName ?? entry.initiatedBy,
        proposedAt: entry.createdAt,
        isOwnProposal: Boolean(currentUserId) && currentUserId === entry.initiatedBy,
        rejectedByName: rejectionStep?.actedByName ?? rejectionStep?.actedBy ?? null,
        rejectedAt: rejectionStep?.actedAt ?? null,
        rejectionComment: rejectionStep?.comment ?? null,
      };
    }),
  );
}
