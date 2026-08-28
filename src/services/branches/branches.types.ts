/**
 * `branches` tag — backashbackend/src/modules/branches/branches.controller.ts.
 * Branch/BranchManagerAssignment controllers have no response DTOs, they
 * return raw Mongoose documents (`_id`, not `id`) — `Raw*` are the wire
 * shapes; the non-`Raw` types are what `branches.service.ts` normalizes them
 * into for the rest of the frontend.
 */
export interface RawBranch {
  _id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt?: string;
}

export interface RawBranchManagerAssignment {
  _id: string;
  branchId: string;
  staffId: string;
  startDate: string;
  endDate: string | null;
  assignedBy: string;
  /** Who approved this assignment — see the schema's own doc comment (backend). Always a different staff member than `assignedBy` (maker-checker rule). */
  approvedBy: string;
  /** Free-text note left by the proposer (e.g. why this manager, or why the prior one is being replaced). Not editable after the fact. */
  comments: string | null;
}

export interface BranchManagerAssignment {
  id: string;
  branchId: string;
  staffId: string;
  startDate: string;
  endDate: string | null;
  assignedBy: string;
  approvedBy: string;
  comments: string | null;
}

export interface CreateBranchPayload {
  name: string;
  code: string;
  address?: string;
}

export interface UpdateBranchPayload {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  active?: boolean;
}

export interface AssignBranchManagerPayload {
  staffId: string;
  /** Optional free-text note — e.g. why this manager, or why the current one is being replaced. Shown on the branch's Manager Records history once approved. */
  comments?: string;
}

export interface BranchBalance {
  branchId: string;
  availableAmount: number;
}

/** GET /branches/:id/stats — staffCount is every Staff record with this branchId; activeLoansCount is loans currently DISBURSED. */
export interface BranchStats {
  branchId: string;
  staffCount: number;
  activeLoansCount: number;
}

/**
 * GET /branches/:id/activity — BranchActivityEntryDto on the backend.
 * BRANCH_CREATED/ACTIVATED/DEACTIVATED/DELETED plus the branch's funding
 * verify/reject history, oldest first. Doubles as the Manager dashboard's
 * "notifications from head office" feed.
 */
export interface BranchActivityEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}
