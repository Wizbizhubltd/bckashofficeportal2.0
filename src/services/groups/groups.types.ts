/**
 * `groups` tag — backashbackend/src/modules/groups/groups.controller.ts.
 *
 * Unlike most other modules in this app, GroupsController's GET routes
 * return the raw Mongoose document (no ResponseDto whitelist) — so the wire
 * shape is `_id`, not `id`, and `branchId`/`createdBy` come back as plain
 * ObjectId hex strings (Mongoose's default toJSON). `RawGroup`/
 * `RawGroupMembership` model exactly that; `Group`/`GroupMembership` are the
 * normalized `id`-shaped versions the rest of the app uses, produced by
 * groups.service.ts's own `normalizeGroup`/`normalizeMembership`.
 *
 * There is no `code` or `loanSummary` anywhere on the real Group/
 * GroupMembership schema — loan amounts per member aren't tracked at the
 * group level at all (see loans.types.ts — a loan amount lives on
 * MemberLoanAccount, one per loan a customer actually took). Group does
 * carry `proposedLeaderName`/`meetingDay`/`meetingLocation`/
 * `expectedMemberCount` — free-text/numeric intake fields from the
 * onboarding wizard, all optional and purely informational.
 * `proposedLeaderName` is NOT the real leadership role: `GROUP_HEAD` on
 * GroupMembership is always derived from `proposedMemberCustomerIds` order
 * at approval time, and can disagree with this field — see the backend
 * Group schema's own doc comment.
 */
/** PENDING — a member addition is currently under review/approval; the group is locked (no other member/leadership/edit-privilege changes, and it can't be used to raise a loan) until that addition resolves. Reverts to ACTIVE on approval, rejection, or the addition being withdrawn. */
export type GroupStatus = 'ACTIVE' | 'PENDING' | 'REJECTED';
export type GroupMemberRole = 'GROUP_HEAD' | 'GROUP_HEAD_ASSISTANT' | 'COORDINATOR' | 'MEMBER';
export type GroupEditPrivilegeStatus = 'NONE' | 'PENDING' | 'GRANTED' | 'REJECTED';

/** Same shape/one-shot-consumed rule as Customer's own edit privilege — see GroupEditPrivilege's doc comment on the backend Group schema, minus the signature (no group-level equivalent). */
export interface GroupEditPrivilege {
  status: GroupEditPrivilegeStatus;
  reason: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

export interface RawGroup {
  _id: string;
  name: string;
  branchId: string;
  /** Resolved server-side (GroupsService.resolveBranchNames) — null only if the branch itself no longer exists. */
  branchName: string | null;
  status: GroupStatus;
  createdBy: string;
  proposedLeaderName: string | null;
  meetingDay: string | null;
  meetingLocation: string | null;
  expectedMemberCount: number | null;
  editPrivilege: GroupEditPrivilege;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  branchId: string;
  /** Resolved server-side — see RawGroup's own doc comment. Prefer this over a client-side `branches` redux lookup, which is only ever populated for org:manage-capable roles. */
  branchName: string | null;
  status: GroupStatus;
  createdBy: string;
  proposedLeaderName: string | null;
  meetingDay: string | null;
  meetingLocation: string | null;
  expectedMemberCount: number | null;
  editPrivilege: GroupEditPrivilege;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /groups/:groupId/details — every field optional; only what's present is proposed as a change. Requires a GRANTED edit privilege. */
export interface UpdateGroupDetailsPayload {
  proposedLeaderName?: string;
  meetingDay?: string;
  meetingLocation?: string;
  expectedMemberCount?: number;
}

export interface RawGroupMembership {
  _id: string;
  groupId: string;
  customerId: string;
  role: GroupMemberRole;
  joinedAt: string;
  leftAt: string | null;
  addedBy: string;
  removedBy: string | null;
  removalReason: string | null;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  customerId: string;
  role: GroupMemberRole;
  joinedAt: string;
  leftAt: string | null;
  addedBy: string;
  removedBy: string | null;
  removalReason: string | null;
}

/** GET /groups/:groupId/leadership's raw wire shape — same `_id`-not-`id` reasoning as RawGroup/RawGroupMembership (see that doc comment). Normalized to `GroupLeadership` by groups.service.ts's own `getLeadership`. */
export interface RawGroupLeadership {
  head?: RawGroupMembership;
  assistant?: RawGroupMembership;
  coordinator?: RawGroupMembership;
}

export interface GroupLeadership {
  head?: GroupMembership;
  assistant?: GroupMembership;
  coordinator?: GroupMembership;
}

export interface GroupLoanEligibilityResult {
  eligible: boolean;
  ineligibleMembers: Array<{ customerId: string | null; reason: string }>;
}

/**
 * Row-level scope is enforced server-side, same pattern as
 * ListCustomersFilter: ADMIN/SUPERADMIN/APPROVER see every group
 * (optionally narrowed by branchId); a MANAGER only ever sees their own
 * branch; a MARKETER only sees groups they themselves created.
 */
export interface ListGroupsFilter {
  branchId?: string;
}

export interface InitiateGroupCreationPayload {
  name: string;
  branchId: string;
  /** Order-significant — the first 3 map to Group Head / Assistant / Coordinator. Minimum 3. */
  proposedMemberCustomerIds: string[];
  /** Informational only — see Group's own doc comment for why this isn't the real leadership assignment. */
  proposedLeaderName?: string;
  meetingDay?: string;
  meetingLocation?: string;
  expectedMemberCount?: number;
}

export interface AddGroupMemberPayload {
  customerId: string;
}

export interface RemoveGroupMemberPayload {
  reason: string;
}

export interface ReassignLeadershipPayload {
  newCustomerId: string;
}
