import { api } from '../../app/api';
import type { WorkflowRequestSummary } from '../workflow-requests/workflow-requests.types';
import type {
  AddGroupMemberPayload,
  Group,
  GroupLeadership,
  GroupLoanEligibilityResult,
  GroupMembership,
  GroupMemberRole,
  InitiateGroupCreationPayload,
  ListGroupsFilter,
  RawGroup,
  RawGroupLeadership,
  RawGroupMembership,
  ReassignLeadershipPayload,
  RemoveGroupMemberPayload,
  UpdateGroupDetailsPayload,
} from './groups.types';

const normalizeGroup = (raw: RawGroup): Group => ({
  id: raw._id,
  name: raw.name,
  branchId: raw.branchId,
  branchName: raw.branchName,
  status: raw.status,
  createdBy: raw.createdBy,
  proposedLeaderName: raw.proposedLeaderName,
  meetingDay: raw.meetingDay,
  meetingLocation: raw.meetingLocation,
  expectedMemberCount: raw.expectedMemberCount,
  editPrivilege: raw.editPrivilege,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

const normalizeMembership = (raw: RawGroupMembership): GroupMembership => ({
  id: raw._id,
  groupId: raw.groupId,
  customerId: raw.customerId,
  role: raw.role,
  joinedAt: raw.joinedAt,
  leftAt: raw.leftAt,
  addedBy: raw.addedBy,
  removedBy: raw.removedBy,
  removalReason: raw.removalReason,
});

/** `groups` tag — see groups.types.ts's own doc comment for the raw-document wire shape this normalizes away. */
export const groupsService = {
  /** Any authenticated staff member — row-scoped server-side, see ListGroupsFilter's own doc comment. */
  list: async (filter?: ListGroupsFilter): Promise<Group[]> => {
    const raw = await api.get<RawGroup[]>('/groups', filter ? { params: filter } : undefined);
    return raw.map(normalizeGroup);
  },

  getById: async (groupId: string): Promise<Group> =>
    normalizeGroup(await api.get<RawGroup>(`/groups/${groupId}`)),

  getMembers: async (groupId: string): Promise<GroupMembership[]> => {
    const raw = await api.get<RawGroupMembership[]>(`/groups/${groupId}/members`);
    return raw.map(normalizeMembership);
  },

  /**
   * `/leadership` returns the same raw `_id`-shaped GroupMembership
   * sub-documents as `/members` (see RawGroupLeadership's own doc comment)
   * — without normalizing these too, `head.id`/`assistant.id`/`coordinator.id`
   * were always `undefined`, so GroupDetail.tsx's own `leaderName` could
   * never match a leadership slot back to its row in the (normalized)
   * members list and always fell back to the "Customer xxxxxx" placeholder.
   */
  getLeadership: async (groupId: string): Promise<GroupLeadership> => {
    const raw = await api.get<RawGroupLeadership>(`/groups/${groupId}/leadership`);
    return {
      head: raw.head ? normalizeMembership(raw.head) : undefined,
      assistant: raw.assistant ? normalizeMembership(raw.assistant) : undefined,
      coordinator: raw.coordinator ? normalizeMembership(raw.coordinator) : undefined,
    };
  },

  getEligibility: (groupId: string): Promise<GroupLoanEligibilityResult> =>
    api.get<GroupLoanEligibilityResult>(`/groups/${groupId}/eligibility`),

  /** Workflow-mediated — the Group only exists once approved. */
  create: (payload: InitiateGroupCreationPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, InitiateGroupCreationPayload>('/groups', payload),

  /** Maker only, for a REJECTED proposal — revise whatever was flagged and resend for a fresh review cycle. */
  reviseAndResubmit: (
    workflowRequestId: string,
    payload: InitiateGroupCreationPayload,
  ): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, InitiateGroupCreationPayload>(
      `/groups/requests/${workflowRequestId}/resubmit`,
      payload,
    ),

  /** Maker only, and only while the proposal is still PENDING_REVIEW — edit its details without disturbing the review chain. */
  updateProposal: (
    workflowRequestId: string,
    payload: InitiateGroupCreationPayload,
  ): Promise<WorkflowRequestSummary> =>
    api.patch<WorkflowRequestSummary, InitiateGroupCreationPayload>(
      `/groups/requests/${workflowRequestId}`,
      payload,
    ),

  /** Maker only, and only while PENDING_REVIEW or REJECTED — permanently deletes the proposal and (best-effort) every proposed member Customer still in a deletable state. */
  deleteProposal: (workflowRequestId: string): Promise<{ deleted: true }> =>
    api.delete<{ deleted: true }>(`/groups/requests/${workflowRequestId}`),

  addMember: (groupId: string, payload: AddGroupMemberPayload): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, AddGroupMemberPayload>(`/groups/${groupId}/members`, payload),

  removeMember: (
    groupId: string,
    customerId: string,
    payload: RemoveGroupMemberPayload,
  ): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, RemoveGroupMemberPayload>(
      `/groups/${groupId}/members/${customerId}/remove`,
      payload,
    ),

  reassignLeadership: (
    groupId: string,
    role: GroupMemberRole,
    payload: ReassignLeadershipPayload,
  ): Promise<WorkflowRequestSummary> =>
    api.post<WorkflowRequestSummary, ReassignLeadershipPayload>(
      `/groups/${groupId}/leadership/${role}`,
      payload,
    ),

  /** Creator only, ACTIVE groups only — see GroupEditPrivilege's own doc comment (backend Group schema). */
  requestEditPrivilege: async (groupId: string, reason: string): Promise<Group> =>
    normalizeGroup(await api.post<RawGroup, { reason: string }>(`/groups/${groupId}/edit-privilege/request`, { reason })),

  /** Admin/SuperAdmin/Approver only. */
  decideEditPrivilege: async (groupId: string, approve: boolean, comment?: string): Promise<Group> =>
    normalizeGroup(
      await api.post<RawGroup, { approve: boolean; comment?: string }>(`/groups/${groupId}/edit-privilege/decide`, {
        approve,
        comment,
      }),
    ),

  /** Creator only, and only once edit privilege has been GRANTED — consumed (reset to NONE) on success. */
  updateDetails: async (groupId: string, payload: UpdateGroupDetailsPayload): Promise<Group> =>
    normalizeGroup(await api.patch<RawGroup, UpdateGroupDetailsPayload>(`/groups/${groupId}/details`, payload)),
};

export * from './groups.types';
