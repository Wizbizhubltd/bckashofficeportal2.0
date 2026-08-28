/**
 * `branch-requests` tag — backashbackend/src/modules/branches/branch-requests.controller.ts.
 * A branch manager's free-form request to head office — "make a request to
 * the head office" from the Manager's own Branch Management tab. Controller
 * has no response DTOs — returns raw Mongoose documents (`_id`, not `id`);
 * `Raw*` are the wire shapes.
 */
export type BranchRequestStatus = 'OPEN' | 'RESOLVED';

export interface RawBranchRequest {
  _id: string;
  branchId: string;
  raisedBy: string;
  subject: string;
  message: string;
  status: BranchRequestStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchRequest {
  id: string;
  branchId: string;
  raisedBy: string;
  subject: string;
  message: string;
  status: BranchRequestStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/** POST /branch-requests — branchId is implied, always the raising Manager's own branch. */
export interface CreateBranchRequestPayload {
  subject: string;
  message: string;
}

export interface ResolveBranchRequestPayload {
  note: string;
}
