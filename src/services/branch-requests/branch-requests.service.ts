import { api } from '../../app/api';
import type {
  BranchRequest,
  CreateBranchRequestPayload,
  RawBranchRequest,
  ResolveBranchRequestPayload,
} from './branch-requests.types';

const normalize = (raw: RawBranchRequest): BranchRequest => ({
  id: raw._id,
  branchId: raw.branchId,
  raisedBy: raw.raisedBy,
  subject: raw.subject,
  message: raw.message,
  status: raw.status,
  resolvedBy: raw.resolvedBy,
  resolvedAt: raw.resolvedAt,
  resolutionNote: raw.resolutionNote,
  createdAt: raw.createdAt,
});

/** `branch-requests` tag — see branch-requests.types.ts's own doc comment. */
export const branchRequestsService = {
  /** Manager only, always about their own branch — enforced server-side, no capability gate. */
  create: async (payload: CreateBranchRequestPayload): Promise<BranchRequest> =>
    normalize(await api.post<RawBranchRequest, CreateBranchRequestPayload>('/branch-requests', payload)),

  /** Row-scoped server-side: Admin/SuperAdmin/Approver see all (optionally filtered by branchId); a Manager sees only their own branch's. */
  list: async (branchId?: string): Promise<BranchRequest[]> => {
    const raw = await api.get<RawBranchRequest[]>('/branch-requests', branchId ? { params: { branchId } } : undefined);
    return raw.map(normalize);
  },

  getById: async (id: string): Promise<BranchRequest> => normalize(await api.get<RawBranchRequest>(`/branch-requests/${id}`)),

  /** Same tier that approves/deletes a branch. */
  resolve: async (id: string, payload: ResolveBranchRequestPayload): Promise<BranchRequest> =>
    normalize(
      await api.post<RawBranchRequest, ResolveBranchRequestPayload>(`/branch-requests/${id}/resolve`, payload),
    ),
};

export * from './branch-requests.types';
