import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SearchIcon,
  FilterIcon,
  MoreVerticalIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  RotateCcwIcon,
  FlagIcon } from
'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { customersService, type Customer } from '../services/customers/customers.service';
import { groupsService, type InitiateGroupCreationPayload } from '../services/groups/groups.service';
import { staffService, type Staff } from '../services/staff/staff.service';
import {
  workflowRequestsService,
  type WorkflowRequestDetail,
  type WorkflowRequestSummary,
  type WorkflowStatus } from
'../services/workflow-requests/workflow-requests.service';
import { useAppSelector } from '../store/hooks';
import { withId } from '../utils/id-label';
import { toTitleCase } from '../utils/staff-display';

type StatusBadgeValue = React.ComponentProps<typeof StatusBadge>['status'];

const GROUP_ENTITY_TYPE = 'GROUP';
const CUSTOMER_ENTITY_TYPE = 'CUSTOMER';

// DRAFT (still mid-onboarding, not yet submitted) is server-side hidden
// from Manager/Admin/Approver's own list already (see findAllForActor on
// the backend) — only ever shows up here for the marketer who's still
// working on it. A customer's own `status` says PENDING_APPROVAL for two
// distinct real situations once submitted — awaiting a Manager's review,
// or reviewed and awaiting Admin/Approver's final call.
// `customerStatusLabel` below tells those apart using the customer's own
// pending WorkflowRequest (when one exists).
const CUSTOMER_STATUS_LABEL: Record<Customer['status'], StatusBadgeValue> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  // No literal "Disabled" case on StatusBadge — "Suspended" carries the same
  // red-flag styling and reads correctly for a disabled customer.
  DISABLED: 'Suspended',
};

/** Plain-text KYC status for the list — same states CustomerDetail's KYC_STATUS_BADGE badges, worded out. */
const KYC_STATUS_LABEL: Record<Customer['kycStatus'], string> = {
  INCOMPLETE: 'Pending',
  PENDING_VERIFICATION: 'Pending Review',
  VERIFIED: 'BVN Verified',
  MISMATCH_FLAGGED: 'Flagged',
};

const CUSTOMER_STATUS_FILTER_OPTIONS = ['all', 'Draft', 'Active', 'Pending Approval', 'Rejected', 'Suspended'] as const;

type GroupRow = {
  id: string;
  name: string;
  branch: string;
  members: number;
  status: string;
  createdAt: string;
  /** Informational only — the actual GROUP_HEAD role is derived from member order, see groups.types.ts's own doc comment. */
  leader: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  branch: string;
  groupName: string;
  kycStatus: string;
  /** MISMATCH_FLAGGED — what the marketer submitted didn't match the BVN provider's own record. */
  flagged: boolean;
  status: StatusBadgeValue;
};

/** A customer's own PENDING_APPROVAL bucket, split into what's actually happening — see CUSTOMER_STATUS_LABEL's own comment. */
function customerStatusLabel(customer: Customer, pendingWorkflowStatusByCustomerId: Record<string, WorkflowStatus>): StatusBadgeValue {
  if (customer.status !== 'PENDING_APPROVAL') {
    return CUSTOMER_STATUS_LABEL[customer.status];
  }
  // RETURNED_TO_MAKER and "no request yet" both fall back to the umbrella
  // "Pending Approval" label — only a request still sitting in the review
  // step itself reads as "Pending Review". Same bucketing CustomerDetail's
  // own header hint text uses.
  return pendingWorkflowStatusByCustomerId[customer.id] === 'PENDING_REVIEW' ? 'Pending Review' : 'Pending Approval';
}

/**
 * `GET /customers` resolves `branchName`/`groupName` server-side now (see
 * CustomerResponseDto) — `withId` still guards branch display against a
 * branch that's since been deleted (falls back to the raw id rather than a
 * bare "—"); the redux `branches` lookup is only a fallback for the rare
 * case the API's own resolution comes back null despite a live branchId.
 */
function mapCustomerToRow(
  customer: Customer,
  branches: { id: string; name: string }[],
  pendingWorkflowStatusByCustomerId: Record<string, WorkflowStatus>,
): CustomerRow {
  return {
    id: customer.id,
    name: toTitleCase(`${customer.firstName} ${customer.lastName}`.trim()) || 'Unknown Customer',
    phone: customer.phoneNumber || '-',
    branch: withId(customer.branchName ?? branches.find((branch) => branch.id === customer.branchId)?.name, customer.branchId),
    groupName: customer.groupName ?? '—',
    kycStatus: KYC_STATUS_LABEL[customer.kycStatus] ?? toTitleCase(customer.kycStatus.replace(/_/g, ' ')),
    flagged: customer.kycStatus === 'MISMATCH_FLAGGED',
    status: customerStatusLabel(customer, pendingWorkflowStatusByCustomerId),
  };
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

/** A GROUP workflow request's payload shape — see InitiateGroupCreationDto on the backend. */
function pendingGroupSummary(payload: Record<string, unknown>, branches: { id: string; name: string }[]) {
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name : 'Unnamed Group';
  const branchId = typeof payload.branchId === 'string' ? payload.branchId : '';
  const branchName = branches.find((b) => b.id === branchId)?.name ?? '—';
  const memberCount = Array.isArray(payload.proposedMemberCustomerIds) ? payload.proposedMemberCustomerIds.length : 0;
  const leader = typeof payload.proposedLeaderName === 'string' ? payload.proposedLeaderName : '';
  const meetingDay = typeof payload.meetingDay === 'string' ? payload.meetingDay : '';
  const meetingLocation = typeof payload.meetingLocation === 'string' ? payload.meetingLocation : '';
  return { name, branchName, memberCount, leader, meetingDay, meetingLocation };
}

/** The step where a REJECTED request's chain stopped — who and why. */
function rejectionInfo(request: WorkflowRequestSummary): { by: string; comment: string } | null {
  const step = [...request.steps].reverse().find((s) => s.action === 'REJECTED');
  if (!step) return null;
  return { by: step.actedBy ?? '—', comment: step.comment ?? '—' };
}

export function Customers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerDetailsBasePath = '/customers';
  const groupDetailsBasePath = `${customerDetailsBasePath}/groups`;
  const [view, setView] = useState<'groups' | 'customers'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const branches = useAppSelector((state) => state.lookups.branches);
  // customerId -> their own pending WorkflowRequest's status, so the Status
  // column can tell "awaiting review" apart from "awaiting approval" — see
  // customerStatusLabel's own doc comment.
  const [pendingCustomerWorkflowStatus, setPendingCustomerWorkflowStatus] = useState<Record<string, WorkflowStatus>>({});

  const [groupApprovalView, setGroupApprovalView] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [pendingGroupRequests, setPendingGroupRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingGroupDetails, setPendingGroupDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  // requestId -> whether every proposed member is already a fully approved
  // (ACTIVE) Customer — see the effect that populates this for the exact rule.
  const [groupMemberReadiness, setGroupMemberReadiness] = useState<Record<string, { allApproved: boolean }>>({});
  const [isLoadingPendingGroups, setIsLoadingPendingGroups] = useState(false);
  const [rejectedGroupRequests, setRejectedGroupRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedGroupDetails, setRejectedGroupDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejectedGroups, setIsLoadingRejectedGroups] = useState(false);
  const [actingGroupRequestId, setActingGroupRequestId] = useState<string | null>(null);
  const [rejectGroupTargetId, setRejectGroupTargetId] = useState<string | null>(null);
  const [approveGroupTargetId, setApproveGroupTargetId] = useState<string | null>(null);
  const [reviseTargetId, setReviseTargetId] = useState<string | null>(null);
  const [reviseForm, setReviseForm] = useState({ name: '', proposedLeaderName: '', meetingDay: '', meetingLocation: '', expectedMemberCount: '' });
  const [isRevising, setIsRevising] = useState(false);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  // ADMIN/SUPERADMIN/APPROVER see every record (server-side) and may narrow
  // it by branch/marketer here; a MANAGER is locked to their own branch and
  // a MARKETER to their own records regardless of what these send — see
  // ListCustomersFilter's own doc comment. GET /staff (the marketer lookup)
  // is further gated to org:manage, so only super_admin/admin get that one.
  const isAdminTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';
  const canFilterByMarketer = user?.role === 'super_admin' || user?.role === 'admin';
  // A Manager reviews a group proposal (mark-as-reviewed step); Admin/
  // SuperAdmin/Approver give the final approval — see default-role-
  // capabilities.ts's MAKER_ENTITY_TYPES. Server-side capability checks are
  // the real gate; this only decides which buttons to show.
  const isManager = user?.role === 'manager';
  const canActOnGroupRequests = isManager || isAdminTier;
  // Precise per-capability split (Approver holds approve:GROUP but not
  // review:GROUP — see default-role-capabilities.ts) — used to decide which
  // action a given request's *current* step actually admits, not just
  // "some group-approval-ish role". A request still PENDING_REVIEW can only
  // ever be reviewed, never approved outright, regardless of the viewer's
  // tier — see the button logic below.
  const canReviewGroups = isManager || user?.role === 'super_admin' || user?.role === 'admin';
  const canApproveGroups = isAdminTier;

  const [branchFilter, setBranchFilter] = useState('');
  const [marketerFilter, setMarketerFilter] = useState('');
  const [marketers, setMarketers] = useState<Staff[]>([]);

  useEffect(() => {
    if (!canFilterByMarketer) {
      setMarketers([]);
      return;
    }

    let isMounted = true;
    staffService
      .list()
      .then((items) => {
        if (isMounted) {
          setMarketers(items.filter((staff) => staff.role === 'MARKETER'));
        }
      })
      .catch(() => {
        if (isMounted) {
          setMarketers([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canFilterByMarketer]);

  useEffect(() => {
    let isMounted = true;

    const loadCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        const filter = isAdminTier
          ? { branchId: branchFilter || undefined, createdById: marketerFilter || undefined }
          : undefined;
        const items = await customersService.list(filter);

        if (!isMounted) {
          return;
        }

        setRawCustomers(items);
      } catch {
        if (isMounted) {
          setRawCustomers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCustomers(false);
        }
      }
    };

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, [isAdminTier, branchFilter, marketerFilter]);

  const customers = useMemo(
    () => rawCustomers.map((customer) => mapCustomerToRow(customer, branches, pendingCustomerWorkflowStatus)),
    [rawCustomers, branches, pendingCustomerWorkflowStatus],
  );

  const loadApprovedGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const items = await groupsService.list(
        isAdminTier && branchFilter ? { branchId: branchFilter } : undefined,
      );

      const memberLists = await Promise.all(
        items.map((group) =>
          groupsService
            .getMembers(group.id)
            .then((members) => members.filter((m) => !m.leftAt))
            .catch(() => []),
        ),
      );

      setGroups(
        items.map((group, index) => ({
          id: group.id,
          name: group.name,
          branch: withId(group.branchName ?? branches.find((branch) => branch.id === group.branchId)?.name, group.branchId),
          members: memberLists[index]?.length ?? 0,
          status: group.status === 'ACTIVE' ? 'Active' : group.status === 'PENDING' ? 'Pending' : 'Rejected',
          createdAt: formatDisplayDate(group.createdAt),
          leader: group.proposedLeaderName || '—',
        })),
      );
    } catch {
      setGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    void loadApprovedGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, isAdminTier, branchFilter]);

  const loadPendingGroups = async () => {
    setIsLoadingPendingGroups(true);
    try {
      const requests = await workflowRequestsService.getPendingByEntityType(GROUP_ENTITY_TYPE);
      setPendingGroupRequests(requests);
      const detailsList = await Promise.all(
        requests.map((request) => workflowRequestsService.getById(request.id).catch(() => null)),
      );
      const map: Record<string, WorkflowRequestDetail> = {};
      detailsList.forEach((detail) => {
        if (detail) map[detail.id] = detail;
      });
      setPendingGroupDetails(map);
    } catch {
      setPendingGroupRequests([]);
      setPendingGroupDetails({});
    } finally {
      setIsLoadingPendingGroups(false);
    }
  };

  const loadRejectedGroups = async () => {
    setIsLoadingRejectedGroups(true);
    try {
      const requests = await workflowRequestsService.getRejectedByEntityType(GROUP_ENTITY_TYPE);
      setRejectedGroupRequests(requests);
      const detailsList = await Promise.all(
        requests.map((request) => workflowRequestsService.getById(request.id).catch(() => null)),
      );
      const map: Record<string, WorkflowRequestDetail> = {};
      detailsList.forEach((detail) => {
        if (detail) map[detail.id] = detail;
      });
      setRejectedGroupDetails(map);
    } catch {
      setRejectedGroupRequests([]);
      setRejectedGroupDetails({});
    } finally {
      setIsLoadingRejectedGroups(false);
    }
  };

  useEffect(() => {
    void loadPendingGroups();
    void loadRejectedGroups();
  }, []);

  // A group proposal can't meaningfully be reviewed OR approved ahead of its
  // own proposed members — every proposed member must already be a fully
  // APPROVED (ACTIVE) Customer before a group can be marked Reviewed *or*
  // Approved; a member still sitting at Pending Review/Pending Approval (or
  // never even submitted) blocks both steps identically. `allReviewed`
  // mirrors the backend's own PreApprovalValidator for GROUP/CREATE exactly
  // (every proposed member must be CustomerStatus.ACTIVE, full stop) — that's
  // the *final*-approval-step gate the backend already enforces server-side;
  // applying the same bar to the *review* step too is a client-side-only
  // tightening (the backend's own registerPreApprovalValidator only ever
  // runs at final approval, so it doesn't itself gate the review step).
  useEffect(() => {
    if (!canActOnGroupRequests || pendingGroupRequests.length === 0) {
      setGroupMemberReadiness({});
      return;
    }
    let isMounted = true;
    async function isMemberApproved(customerId: string): Promise<boolean> {
      try {
        const customer = await customersService.getById(customerId);
        return customer.status === 'ACTIVE';
      } catch {
        // Outside the viewer's row-level scope, or deleted — treat as not
        // approved rather than silently letting the group proceed regardless.
        return false;
      }
    }

    (async () => {
      const entries = await Promise.all(
        pendingGroupRequests.map(async (request) => {
          const detail = pendingGroupDetails[request.id];
          const memberIds = Array.isArray(detail?.payload.proposedMemberCustomerIds)
            ? (detail.payload.proposedMemberCustomerIds as string[])
            : [];
          if (memberIds.length === 0) {
            // Detail hasn't loaded yet — leave true (server is still the
            // real gate) rather than incorrectly disabling everything while
            // data is still in flight.
            return [request.id, { allApproved: true }] as const;
          }
          const approvals = await Promise.all(memberIds.map(isMemberApproved));
          return [request.id, { allApproved: approvals.every(Boolean) }] as const;
        }),
      );
      if (isMounted) setGroupMemberReadiness(Object.fromEntries(entries));
    })();

    return () => {
      isMounted = false;
    };
  }, [pendingGroupRequests, pendingGroupDetails, canActOnGroupRequests]);

  // Every currently-pending CUSTOMER WorkflowRequest, across every entity —
  // not row-scoped like GET /customers itself, but that's fine here: it's
  // only ever consulted for a customer already visible in `rawCustomers`,
  // whatever entries fall outside that scope are simply never looked up.
  useEffect(() => {
    let isMounted = true;
    workflowRequestsService
      .getPendingByEntityType(CUSTOMER_ENTITY_TYPE)
      .then((requests) => {
        if (!isMounted) return;
        const statusByCustomerId: Record<string, WorkflowStatus> = {};
        requests.forEach((request) => {
          if (request.entityId) {
            statusByCustomerId[request.entityId] = request.status;
          }
        });
        setPendingCustomerWorkflowStatus(statusByCustomerId);
      })
      .catch(() => {
        if (isMounted) setPendingCustomerWorkflowStatus({});
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleGroupWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setRejectGroupTargetId(null);
    setApproveGroupTargetId(null);
    try {
      setActingGroupRequestId(requestId);
      await workflowRequestsService.act(requestId, { action, comment });
      await Promise.all([loadApprovedGroups(), loadPendingGroups(), loadRejectedGroups()]);
      setGroupApprovalView(action === 'APPROVED' ? 'approved' : 'rejected');
      if (action === 'REJECTED') {
        showToast('Group rejected');
      } else {
        // The engine decides whether this was the review step or the final
        // approval — this just picks the right word for the toast.
        showToast(isManager && !isAdminTier ? 'Marked as reviewed' : 'Group approved');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setActingGroupRequestId(null);
    }
  }

  function openReviseModal(request: WorkflowRequestSummary) {
    const detail = rejectedGroupDetails[request.id];
    const summary = detail ? pendingGroupSummary(detail.payload, branches) : null;
    setReviseForm({
      name: summary?.name && summary.name !== 'Unnamed Group' ? summary.name : '',
      proposedLeaderName: summary?.leader ?? '',
      meetingDay: summary?.meetingDay ?? '',
      meetingLocation: summary?.meetingLocation ?? '',
      expectedMemberCount:
        typeof detail?.payload.expectedMemberCount === 'number' ? String(detail.payload.expectedMemberCount) : '',
    });
    setReviseTargetId(request.id);
  }

  async function handleReviseAndResubmit() {
    if (!reviseTargetId) return;
    const detail = rejectedGroupDetails[reviseTargetId];
    const memberIds = Array.isArray(detail?.payload.proposedMemberCustomerIds)
      ? (detail.payload.proposedMemberCustomerIds as string[])
      : [];
    const requestBranchId = typeof detail?.payload.branchId === 'string' ? detail.payload.branchId : '';
    if (!reviseForm.name.trim() || !requestBranchId || memberIds.length === 0) {
      showToast('Missing the original proposal details — cannot resubmit');
      return;
    }
    const payload: InitiateGroupCreationPayload = {
      name: reviseForm.name.trim(),
      branchId: requestBranchId,
      proposedMemberCustomerIds: memberIds,
      proposedLeaderName: reviseForm.proposedLeaderName.trim() || undefined,
      meetingDay: reviseForm.meetingDay.trim() || undefined,
      meetingLocation: reviseForm.meetingLocation.trim() || undefined,
      expectedMemberCount: reviseForm.expectedMemberCount ? Number(reviseForm.expectedMemberCount) : undefined,
    };
    try {
      setIsRevising(true);
      await groupsService.reviseAndResubmit(reviseTargetId, payload);
      await Promise.all([loadPendingGroups(), loadRejectedGroups()]);
      setReviseTargetId(null);
      setGroupApprovalView('pending');
      showToast('Group resubmitted for review');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to resubmit — check that every member is now ACTIVE');
    } finally {
      setIsRevising(false);
    }
  }

  const marketerOptions = useMemo(
    () => marketers.map((staff) => ({ id: staff.id, name: toTitleCase(`${staff.firstName} ${staff.lastName}`.trim()) })),
    [marketers],
  );

  const filteredCustomers = customers.filter((cust) => {
    const matchesSearch =
    !searchQuery.trim() ||
    [cust.name, cust.id, cust.phone, cust.kycStatus, cust.branch, cust.groupName].some((field) =>
    field.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || cust.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
    !searchQuery.trim() ||
    [group.name, group.id, group.branch, group.leader].some((field) =>
    field.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesStatus =
    statusFilter === 'all' || group.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body"
          >
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={rejectGroupTargetId !== null}
        onClose={() => setRejectGroupTargetId(null)}
        onConfirm={(val) => rejectGroupTargetId && void handleGroupWorkflowAction(rejectGroupTargetId, 'REJECTED', val)}
        title="Reject Group Proposal"
        description="Provide a reason for rejecting this group proposal."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Group"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="Provide the reason for rejecting this group..."
        requireInput
      />

      {(() => {
        // Recomputed from the actual target request's own status — not the
        // viewer's role — so the modal never mislabels a review-step action
        // as a final approval (see canReviewGroups/canApproveGroups's own
        // comment above).
        const approveTargetIsReviewStep =
          pendingGroupRequests.find((r) => r.id === approveGroupTargetId)?.status === 'PENDING_REVIEW';
        // Only a Manager may mark a group proposal as reviewed — Admin/
        // SuperAdmin still see the button (canReviewGroups deliberately
        // includes them, e.g. so they can step in if no Manager is
        // available) but the actual confirm action is blocked here rather
        // than silently letting a non-Manager complete the review step.
        const reviewStepBlockedForNonManager = approveTargetIsReviewStep && !isManager;
        // Same member-readiness gate as the row button (see the effect that
        // populates groupMemberReadiness) — kept here too, not just on the
        // button, so the modal's own confirm action can never fire against a
        // not-yet-approved member set even if it was somehow reached.
        const membersNotReady =
          approveGroupTargetId !== null && !(groupMemberReadiness[approveGroupTargetId]?.allApproved ?? true);
        const confirmBlocked = reviewStepBlockedForNonManager || membersNotReady;
        const blockedReason = reviewStepBlockedForNonManager
          ? 'Only a Branch Manager can mark a group proposal as reviewed.'
          : membersNotReady
            ? 'Every proposed member must be fully approved before this group can be reviewed or approved.'
            : undefined;
        return (
      <ConfirmationModal
        isOpen={approveGroupTargetId !== null}
        onClose={() => setApproveGroupTargetId(null)}
        onConfirm={(val) => approveGroupTargetId && void handleGroupWorkflowAction(approveGroupTargetId, 'APPROVED', val)}
        title={approveTargetIsReviewStep ? 'Mark as Reviewed' : 'Approve Group Proposal'}
        description={
          approveTargetIsReviewStep
            ? 'Mark this group proposal as reviewed? This does not approve it — an Admin or Approver still makes the final decision.'
            : 'Approve this group proposal and activate the group?'
        }
        icon={<div className={`w-10 h-10 rounded-lg flex items-center justify-center ${approveTargetIsReviewStep ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}><CheckCircleIcon size={20} /></div>}
        confirmLabel={approveTargetIsReviewStep ? 'Mark as Reviewed' : 'Approve Group'}
        confirmVariant={approveTargetIsReviewStep ? 'blue' : 'primary'}
        inputType="textarea"
        inputLabel={approveTargetIsReviewStep ? 'Review comment (optional)' : 'Comment (optional)'}
        inputPlaceholder="Add any notes for whoever acts on this next..."
        confirmDisabled={confirmBlocked}
        disabledReason={blockedReason}
      />
        );
      })()}

      <AnimatePresence>
        {reviseTargetId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setReviseTargetId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Revise &amp; Resubmit</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                The member list from the original proposal is kept as-is — fix any member's status from their
                profile first if that's what was flagged. Resubmitting starts a fresh review cycle.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={reviseForm.name}
                    onChange={(e) => setReviseForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Leader Name</label>
                  <input
                    type="text"
                    value={reviseForm.proposedLeaderName}
                    onChange={(e) => setReviseForm((f) => ({ ...f, proposedLeaderName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Day</label>
                    <input
                      type="text"
                      value={reviseForm.meetingDay}
                      onChange={(e) => setReviseForm((f) => ({ ...f, meetingDay: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Members</label>
                    <input
                      type="number"
                      min={1}
                      value={reviseForm.expectedMemberCount}
                      onChange={(e) => setReviseForm((f) => ({ ...f, expectedMemberCount: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market / Location</label>
                  <input
                    type="text"
                    value={reviseForm.meetingLocation}
                    onChange={(e) => setReviseForm((f) => ({ ...f, meetingLocation: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setReviseTargetId(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleReviseAndResubmit()}
                  disabled={isRevising}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isRevising ? 'Resubmitting...' : 'Resubmit for Review'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-primary">
            Customers Directory
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage borrowing groups and their members
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => {
                setView('customers');
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'customers' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>

              Customers
            </button>
            <button
              onClick={() => {
                setView('groups');
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'groups' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>

              Groups
            </button>
          </div>
          <div className="relative flex-1 sm:w-64">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
              view === 'customers' ?
              'Search customers...' :
              'Search groups...'
              }
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />

          </div>
          {isAdminTier &&
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">

            <option value="">All Branches</option>
            {branches.map((branch) =>
            <option key={branch.id} value={branch.id}>{branch.name}</option>
            )}
          </select>
          }
          {view === 'customers' && canFilterByMarketer &&
          <select
            value={marketerFilter}
            onChange={(e) => setMarketerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">

            <option value="">All Marketers</option>
            {marketerOptions.map((marketer) =>
            <option key={marketer.id} value={marketer.id}>{marketer.name}</option>
            )}
          </select>
          }
          {view === 'customers' &&
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium">

              <FilterIcon size={16} className="mr-2" /> Filter
              {statusFilter !== 'all' &&
              <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />
              }
            </button>
            {filterOpen &&
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-40">
                {CUSTOMER_STATUS_FILTER_OPTIONS.map(
                (status) =>
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setFilterOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${statusFilter === status ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}>

                      {status === 'all' ? 'All Statuses' : status}
                    </button>

              )}
              </div>
            }
          </div>
          }
        </div>
      </div>

      {view === 'customers' ?
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">KYC Status</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Group Name</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredCustomers.map((cust) =>
              <tr
                key={cust.id}
                onClick={() => navigate(`${customerDetailsBasePath}/${cust.id}`)}
                className="hover:bg-gray-50 transition-colors cursor-pointer">

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-medium text-primary">
                          {cust.name}
                        </p>
                        {cust.flagged && (
                          <span
                            title="Submitted details don't match the BVN provider's record"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200"
                          >
                            <FlagIcon size={10} /> Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{cust.phone}</td>
                    <td className={`px-6 py-4 ${cust.flagged ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{cust.kycStatus}</td>
                    <td className="px-6 py-4 text-gray-600">{cust.branch}</td>
                    <td className="px-6 py-4 text-gray-600">{cust.groupName}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={cust.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                    onClick={(e) => {
                      e.stopPropagation();
                        navigate(`${customerDetailsBasePath}/${cust.id}`);
                    }}
                    className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 transition-colors">

                        <MoreVerticalIcon size={18} />
                      </button>
                    </td>
                  </tr>
              )}
                {!isLoadingCustomers && filteredCustomers.length === 0 &&
              <tr>
                    <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-400 text-sm font-body">

                      No customers match your search.
                    </td>
                  </tr>
              }
                {isLoadingCustomers &&
              <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      Loading customers...
                    </td>
                  </tr>
              }
              </tbody>
            </table>
          </div>
        </div> :

      <div className="space-y-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setGroupApprovalView('approved')}
            className={`px-3 py-1.5 text-sm font-body rounded-md transition-colors ${groupApprovalView === 'approved' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
            Approved
          </button>
          <button
            onClick={() => setGroupApprovalView('pending')}
            className={`px-3 py-1.5 text-sm font-body rounded-md transition-colors flex items-center gap-1.5 ${groupApprovalView === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
            Pending
            {pendingGroupRequests.length > 0 &&
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {pendingGroupRequests.length}
            </span>}
          </button>
          <button
            onClick={() => setGroupApprovalView('rejected')}
            className={`px-3 py-1.5 text-sm font-body rounded-md transition-colors ${groupApprovalView === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
            Rejected
          </button>
        </div>

        {groupApprovalView === 'approved' &&
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                    <th className="px-6 py-4 font-medium">Group Name</th>
                    <th className="px-6 py-4 font-medium">Leader</th>
                    <th className="px-6 py-4 font-medium">Branch</th>
                    <th className="px-6 py-4 font-medium">Members</th>
                    <th className="px-6 py-4 font-medium">Created</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredGroups.map((group) =>
                <tr
                  key={group.id}
                  onClick={() => navigate(`${groupDetailsBasePath}/${group.id}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer">

                      <td className="px-6 py-4">
                        <p className="font-heading font-medium text-primary">
                          {group.name}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{group.leader}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {group.branch}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{group.members}</td>
                      <td className="px-6 py-4 text-gray-600">{group.createdAt}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={group.status as StatusBadgeValue} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`${groupDetailsBasePath}/${group.id}`);
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/20 text-primary hover:bg-primary/5 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                )}
                  {!isLoadingGroups && filteredGroups.length === 0 &&
                <tr>
                      <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-400 text-sm font-body">

                        No groups match your search.
                      </td>
                    </tr>
                }
                  {isLoadingGroups &&
                <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                        Loading groups...
                      </td>
                    </tr>
                }
                </tbody>
              </table>
            </div>
          </div>
        }

        {groupApprovalView === 'pending' &&
        <div className="space-y-3">
          {isLoadingPendingGroups &&
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400 font-body">Loading pending groups...</div>
          }
          {!isLoadingPendingGroups && pendingGroupRequests.length === 0 &&
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400 font-body">No group proposals awaiting approval.</div>
          }
          {pendingGroupRequests.map((request) => {
            const detail = pendingGroupDetails[request.id];
            const summary = detail ? pendingGroupSummary(detail.payload, branches) : null;
            const isOwnProposal = request.initiatedBy === user?.id;
            return (
              <div
                key={request.id}
                onClick={() => navigate(`${groupDetailsBasePath}/requests/${request.id}`)}
                className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-heading font-semibold text-gray-800">{summary?.name ?? 'Group proposal'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 font-body">
                    <span>Branch: {summary?.branchName ?? '—'}</span>
                    <span>Members: {summary?.memberCount ?? 0}</span>
                    {summary?.leader && <span>Leader: {summary.leader}</span>}
                    {summary?.meetingDay && <span>Meeting Day: {summary.meetingDay}</span>}
                    {summary?.meetingLocation && <span>Location: {summary.meetingLocation}</span>}
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1.5">
                    <ClockIcon size={12} /> Awaiting {request.status === 'PENDING_REVIEW' ? 'review' : 'approval'}
                  </p>
                </div>
                {isOwnProposal ?
                <span className="text-xs text-gray-400 font-body">You proposed this — a different Admin/SuperAdmin/Approver must act on it.</span> :
                !canActOnGroupRequests ? null :
                (() => {
                  // Status-driven, not just role-driven: a request still
                  // PENDING_REVIEW can only ever be *reviewed*, never
                  // approved outright, no matter how senior the viewer is —
                  // see canReviewGroups/canApproveGroups's own comment. An
                  // Approver (approve:GROUP only, no review:GROUP) simply
                  // has no action here while it's still PENDING_REVIEW.
                  const isReviewStep = request.status === 'PENDING_REVIEW';
                  const canActThisStep = isReviewStep ? canReviewGroups : canApproveGroups;
                  if (!canActThisStep) return null;
                  const readiness = groupMemberReadiness[request.id] ?? { allApproved: true };
                  const notReady = !readiness.allApproved;
                  return (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setApproveGroupTargetId(request.id)}
                        disabled={actingGroupRequestId === request.id || notReady}
                        title={notReady ? 'Every proposed member must be fully approved before this group can be reviewed or approved' : undefined}
                        className={`px-4 py-2 text-white text-sm font-heading font-bold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5 ${isReviewStep ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/90'}`}>
                        <CheckCircleIcon size={15} /> {isReviewStep ? 'Mark as Reviewed' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectGroupTargetId(request.id)}
                        disabled={actingGroupRequestId === request.id}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                        <XCircleIcon size={15} /> Reject
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        }

        {groupApprovalView === 'rejected' &&
        <div className="space-y-3">
          {isLoadingRejectedGroups &&
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400 font-body">Loading rejected groups...</div>
          }
          {!isLoadingRejectedGroups && rejectedGroupRequests.length === 0 &&
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400 font-body">No rejected group proposals.</div>
          }
          {rejectedGroupRequests.map((request) => {
            const detail = rejectedGroupDetails[request.id];
            const summary = detail ? pendingGroupSummary(detail.payload, branches) : null;
            const rejection = rejectionInfo(request);
            const isOwnProposal = request.initiatedBy === user?.id;
            return (
              <div
                key={request.id}
                onClick={() => navigate(`${groupDetailsBasePath}/requests/${request.id}`)}
                className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-heading font-semibold text-gray-800">{summary?.name ?? 'Group proposal'}</p>
                      <StatusBadge status="Rejected" />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500 font-body">
                      <span>Branch: {summary?.branchName ?? '—'}</span>
                      <span>Members: {summary?.memberCount ?? 0}</span>
                    </div>
                    {rejection &&
                    <p className="text-xs text-red-600 font-body mt-2">Rejected: {rejection.comment}</p>
                    }
                  </div>
                  {isOwnProposal && detail &&
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openReviseModal(request);
                    }}
                    className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0">
                    <RotateCcwIcon size={15} /> Revise &amp; Resubmit
                  </button>
                  }
                </div>
              </div>
            );
          })}
        </div>
        }
      </div>
      }
    </div>);

}
