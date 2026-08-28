import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  AssignBranchManagerPayload,
  Branch,
  BranchActivityEntry,
  BranchBalance,
  BranchManagerAssignment,
  BranchStats,
  CreateBranchPayload,
  RawBranch,
  RawBranchManagerAssignment,
  UpdateBranchPayload,
} from './branches.types';

const normalizeBranch = (raw: RawBranch): Branch => ({
  id: raw._id,
  name: raw.name,
  code: raw.code,
  address: raw.address,
  phone: raw.phone,
  email: raw.email,
  active: raw.active,
  createdAt: raw.createdAt,
});

const normalizeAssignment = (raw: RawBranchManagerAssignment): BranchManagerAssignment => ({
  id: raw._id,
  branchId: raw.branchId,
  staffId: raw.staffId,
  startDate: raw.startDate,
  endDate: raw.endDate,
  assignedBy: raw.assignedBy,
  approvedBy: raw.approvedBy,
  comments: raw.comments,
});

/**
 * `branches` tag. CRUD is gated by `org:manage` (ADMIN/SUPERADMIN only);
 * manager assignment/history/balance are readable more broadly — see each
 * endpoint's own guard in branches.controller.ts.
 */
export const branchesService = {
  /** Workflow-mediated — Admin/SuperAdmin/Approver-initiated, approved by a *different* Admin/SuperAdmin/Approver. Returns a pending WorkflowRequest, not the branch (it doesn't exist until approved). */
  create: (payload: CreateBranchPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, CreateBranchPayload>('/branches', payload),

  list: async (): Promise<Branch[]> => {
    const raw = await api.get<RawBranch[]>('/branches');
    return raw.map(normalizeBranch);
  },

  getById: async (id: string): Promise<Branch> =>
    normalizeBranch(await api.get<RawBranch>(`/branches/${id}`)),

  update: async (id: string, payload: UpdateBranchPayload): Promise<Branch> =>
    normalizeBranch(await api.patch<RawBranch, UpdateBranchPayload>(`/branches/${id}`, payload)),

  /** Workflow-mediated — a different Admin/SuperAdmin/Approver must approve this before it takes effect. Only MANAGER-role, ACTIVE staff can be proposed. Returns a pending WorkflowRequest, not the assignment itself. */
  assignManager: (
    branchId: string,
    payload: AssignBranchManagerPayload,
  ): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, AssignBranchManagerPayload>(`/branches/${branchId}/manager`, payload),

  getCurrentManager: async (branchId: string): Promise<BranchManagerAssignment | null> => {
    const raw = await api.get<RawBranchManagerAssignment | null>(`/branches/${branchId}/manager`);
    return raw ? normalizeAssignment(raw) : null;
  },

  getManagerHistory: async (branchId: string): Promise<BranchManagerAssignment[]> => {
    const raw = await api.get<RawBranchManagerAssignment[]>(`/branches/${branchId}/manager-history`);
    return raw.map(normalizeAssignment);
  },

  getBalance: (branchId: string): Promise<BranchBalance> =>
    api.get<BranchBalance>(`/branches/${branchId}/balance`),

  /** staffCount/activeLoansCount — see BranchStats' own doc comment. */
  getStats: (branchId: string): Promise<BranchStats> =>
    api.get<BranchStats>(`/branches/${branchId}/stats`),

  /** BRANCH_CREATED/ACTIVATED/DEACTIVATED/DELETED + funding verify/reject history, oldest first. Also the Manager dashboard's "notifications from head office" feed. */
  getActivity: (branchId: string): Promise<BranchActivityEntry[]> =>
    api.get<BranchActivityEntry[]>(`/branches/${branchId}/activity`),

  /** Super Admin/Admin/Approver only — hard-delete. Only a *deactivated* branch with nothing (staff, customers, groups, loans) still referencing it can be deleted. */
  remove: (branchId: string): Promise<{ deleted: true }> =>
    api.delete<{ deleted: true }>(`/branches/${branchId}`),
};

export * from './branches.types';
