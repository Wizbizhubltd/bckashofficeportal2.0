import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  AssignBranchStaffRolePayload,
  BranchStaffAssignmentRole,
  BranchStaffRoleAssignment,
  RawBranchStaffRoleAssignment,
  RevokeBranchStaffRolePayload,
} from './branch-staff-assignments.types';

const normalize = (raw: RawBranchStaffRoleAssignment): BranchStaffRoleAssignment => ({
  id: raw._id,
  staffId: raw.staffId,
  branchId: raw.branchId,
  role: raw.role,
  startDate: raw.startDate,
  endDate: raw.endDate,
  assignedBy: raw.assignedBy,
  approvedBy: raw.approvedBy,
  comments: raw.comments,
  createdAt: raw.createdAt,
});

/** `branches/staff-assignments` tag — see branch-staff-assignments.types.ts's own doc comment. */
export const branchStaffAssignmentsService = {
  /** Requires workflow:initiate:BRANCH_ROLE_ASSIGNMENT. Pending until a different Admin/SuperAdmin/Approver approves — applies to every branchId in the batch at once. */
  assign: (payload: AssignBranchStaffRolePayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, AssignBranchStaffRolePayload>('/branches/staff-assignments', payload),

  /** Requires workflow:approve:BRANCH_ROLE_ASSIGNMENT. Direct/immediate — revokes exactly the one (staffId, branchId, role) coverage row named in the payload. */
  revoke: async (payload: RevokeBranchStaffRolePayload): Promise<BranchStaffRoleAssignment> =>
    normalize(
      await api.post<RawBranchStaffRoleAssignment, RevokeBranchStaffRolePayload>(
        '/branches/staff-assignments/revoke',
        payload,
      ),
    ),

  /** My own current branch coverage — authenticated-only, no capability gate. */
  getMine: async (): Promise<BranchStaffRoleAssignment[]> => {
    const raw = await api.get<RawBranchStaffRoleAssignment[]>('/branches/staff-assignments/me');
    return raw.map(normalize);
  },

  /** A staff member's current branch coverage — requires org:manage. */
  getForStaff: async (staffId: string): Promise<BranchStaffRoleAssignment[]> => {
    const raw = await api.get<RawBranchStaffRoleAssignment[]>(`/branches/staff-assignments/staff/${staffId}`);
    return raw.map(normalize);
  },

  /** Who currently covers this branch — open read, optionally narrowed by role. */
  getForBranch: async (branchId: string, role?: BranchStaffAssignmentRole): Promise<BranchStaffRoleAssignment[]> => {
    const raw = await api.get<RawBranchStaffRoleAssignment[]>(`/branches/${branchId}/staff-assignments`, {
      params: role ? { role } : undefined,
    });
    return raw.map(normalize);
  },
};

export * from './branch-staff-assignments.types';
