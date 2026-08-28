/**
 * `branches/staff-assignments` — backashbackend/src/modules/branches/branch-staff-role-assignment.controller.ts.
 * Many-to-many analogue of branch manager assignment (see branches.service.ts's
 * own doc comment on that): one ADMIN or APPROVER can actively cover many
 * branches at once, and one branch can have many active ADMIN/APPROVER rows.
 * Granting coverage is workflow-mediated (a different Admin/SuperAdmin/
 * Approver must approve — see `assign`); revoking one branch's coverage is a
 * direct action (see `revoke`). Controller has no response DTOs — returns
 * raw Mongoose documents (`_id`, not `id`); `Raw*` are the wire shapes.
 */
export type BranchStaffAssignmentRole = 'ADMIN' | 'APPROVER';

export interface RawBranchStaffRoleAssignment {
  _id: string;
  staffId: string;
  branchId: string;
  role: BranchStaffAssignmentRole;
  startDate: string;
  /** null while this coverage is active. */
  endDate: string | null;
  assignedBy: string;
  approvedBy: string;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchStaffRoleAssignment {
  id: string;
  staffId: string;
  branchId: string;
  role: BranchStaffAssignmentRole;
  startDate: string;
  endDate: string | null;
  assignedBy: string;
  approvedBy: string;
  comments: string | null;
  createdAt: string;
}

/**
 * POST /branches/staff-assignments — requires workflow:initiate:BRANCH_ROLE_ASSIGNMENT.
 * One proposal covers the whole batch of `branchIds`; a single approve/reject
 * decision by a *different* Admin/SuperAdmin/Approver applies to all of them.
 */
export interface AssignBranchStaffRolePayload {
  staffId: string;
  branchIds: string[];
  role: BranchStaffAssignmentRole;
  comments?: string;
}

/** POST /branches/staff-assignments/revoke — requires workflow:approve:BRANCH_ROLE_ASSIGNMENT. Direct/immediate, revokes exactly one branch's coverage. */
export interface RevokeBranchStaffRolePayload {
  staffId: string;
  branchId: string;
  role: BranchStaffAssignmentRole;
  reason?: string;
}
