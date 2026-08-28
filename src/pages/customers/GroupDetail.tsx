import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, BanknoteIcon, CheckCircleIcon, ClockIcon, Loader2Icon, LockIcon, SearchIcon, UserPlusIcon, UsersIcon, XCircleIcon } from 'lucide-react';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { customersService, type Customer } from '../../services/customers/customers.service';
import {
  groupsService,
  type Group,
  type GroupLeadership,
  type GroupLoanEligibilityResult,
  type GroupMembership,
} from '../../services/groups/groups.service';
import { loansService, type LoanSummary } from '../../services/loans/loans.service';
import { workflowRequestsService, type WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.service';
import { toTitleCase } from '../../utils/staff-display';

const GROUP_MEMBERSHIP_ENTITY_TYPE = 'GROUP_MEMBERSHIP';

type MemberRow = {
  membership: GroupMembership;
  customer: Customer | null;
};

type GroupDetailState = {
  group: Group;
  members: MemberRow[];
  leadership: GroupLeadership;
  eligibility: GroupLoanEligibilityResult;
  /** Every loan ever raised for this group, whatever its status — row-scoped
   * server-side same as everywhere else (a Marketer viewer only ever sees
   * loans they themselves raised; a Manager/Admin-tier viewer sees the
   * group's full loan history). See loanActivityTotals' own doc comment for
   * how this feeds the "cumulative loan activity" section. */
  loans: LoanSummary[];
};

function toDisplayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function customerStatusLabel(customer: Customer | null): 'Approved' | 'Pending Approval' | 'Rejected' | 'Suspended' {
  if (!customer) {
    return 'Pending Approval';
  }
  if (customer.status === 'ACTIVE') {
    return 'Approved';
  }
  if (customer.status === 'REJECTED') {
    return 'Rejected';
  }
  if (customer.status === 'DISABLED') {
    return 'Suspended';
  }
  return 'Pending Approval';
}

function customerName(customer: Customer | null, fallbackId: string): string {
  if (!customer) {
    return `Customer ${fallbackId.slice(-6)}`;
  }
  return toTitleCase(`${customer.firstName} ${customer.lastName}`.trim()) || 'Unknown Customer';
}

const ROLE_LABEL: Record<GroupMembership['role'], string> = {
  GROUP_HEAD: 'Group Head',
  GROUP_HEAD_ASSISTANT: 'Assistant Head',
  COORDINATOR: 'Coordinator',
  MEMBER: 'Member',
};

async function loadGroupDetail(groupId: string): Promise<GroupDetailState> {
  const [group, memberships, leadership, eligibility, loans] = await Promise.all([
    groupsService.getById(groupId),
    groupsService.getMembers(groupId),
    groupsService.getLeadership(groupId),
    groupsService.getEligibility(groupId),
    loansService.list({ groupId }).catch(() => []),
  ]);

  const activeMemberships = memberships.filter((membership) => !membership.leftAt);
  const members: MemberRow[] = await Promise.all(
    activeMemberships.map(async (membership) => {
      try {
        const customer = await customersService.getById(membership.customerId);
        return { membership, customer };
      } catch {
        // Outside the viewer's row-level scope (e.g. a different branch) or
        // deleted — shown as a restricted placeholder rather than failing
        // the whole page.
        return { membership, customer: null };
      }
    }),
  );

  return { group, members, leadership, eligibility, loans };
}

export function GroupDetail() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const customersBasePath = '/customers';
  const { user } = useAuth();

  const [state, setState] = useState<GroupDetailState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  // Same maker set as every other GROUP_MEMBERSHIP initiate action (raise a
  // loan, propose a group) — server-side capability check is the real gate,
  // this only decides what to show. See CustomerDetail.tsx's own canRaiseLoan.
  const canAddMember = user?.role === 'marketer' || user?.role === 'manager';
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addableCustomers, setAddableCustomers] = useState<Customer[]>([]);
  const [isLoadingAddableCustomers, setIsLoadingAddableCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // ADMIN/SUPERADMIN/APPROVER hold approveCapability(GROUP) by default — the
  // only roles that can decide a pending edit privilege request. Server-side
  // capability check is the real gate, this only decides what to show.
  const isApproveTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';
  // A Manager reviews a member-addition proposal (mark-as-reviewed step);
  // Admin/SuperAdmin/Approver give the final approval — same two-step
  // GROUP_MEMBERSHIP chain as GroupsService.registerChainConfig, mirroring
  // Customers.tsx's own GROUP/CREATE review/approve split. Server-side
  // capability checks are the real gate, this only decides what to show.
  const isManager = user?.role === 'manager';
  const [pendingMembershipRequest, setPendingMembershipRequest] = useState<WorkflowRequestSummary | null>(null);
  const [pendingMembershipCustomer, setPendingMembershipCustomer] = useState<Customer | null>(null);
  const [actingOnMembershipRequest, setActingOnMembershipRequest] = useState(false);
  const [rejectMembershipOpen, setRejectMembershipOpen] = useState(false);
  const [approveMembershipOpen, setApproveMembershipOpen] = useState(false);
  const [editPrivilegeModal, setEditPrivilegeModal] = useState<'request' | 'grant' | 'reject' | null>(null);
  const [isActingOnEditPrivilege, setIsActingOnEditPrivilege] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    proposedLeaderName: '',
    meetingDay: '',
    meetingLocation: '',
    expectedMemberCount: '',
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const routeId = typeof groupId === 'string' ? groupId.trim() : '';

  const refresh = () => {
    if (!routeId) {
      setError('Invalid group id.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    return loadGroupDetail(routeId)
      .then((result) => {
        setState(result);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load group.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  /**
   * GROUP_MEMBERSHIP requests have no entityId until approved (same pattern
   * as GROUP/CREATE — see GroupsService.initiateMemberAddition), so the only
   * way to find "the one blocking this group" is to pull every currently
   * pending GROUP_MEMBERSHIP request and match on `payload.groupId`. In
   * practice there's at most one — a PENDING group is locked out of every
   * other membership/leadership write until this resolves (see
   * findActiveGroupOrThrow on the backend), so this never has to pick among
   * several.
   */
  const loadPendingMembershipRequest = async () => {
    if (!routeId) return;
    try {
      const requests = await workflowRequestsService.getPendingByEntityType(GROUP_MEMBERSHIP_ENTITY_TYPE);
      const details = await Promise.all(
        requests.map((request) => workflowRequestsService.getById(request.id).catch(() => null)),
      );
      const match = details.find((detail) => detail && detail.payload.groupId === routeId);
      if (!match) {
        setPendingMembershipRequest(null);
        setPendingMembershipCustomer(null);
        return;
      }
      setPendingMembershipRequest(match);
      const customerId = typeof match.payload.customerId === 'string' ? match.payload.customerId : null;
      if (customerId) {
        setPendingMembershipCustomer(await customersService.getById(customerId).catch(() => null));
      } else {
        setPendingMembershipCustomer(null);
      }
    } catch {
      setPendingMembershipRequest(null);
      setPendingMembershipCustomer(null);
    }
  };

  useEffect(() => {
    void refresh();
    void loadPendingMembershipRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const branchName = state?.group.branchName ?? '—';

  function openAddMemberModal() {
    if (!state) return;
    setAddMemberSearch('');
    setSelectedCustomerId(null);
    setAddMemberError(null);
    setIsAddMemberModalOpen(true);
    setIsLoadingAddableCustomers(true);
    const currentMemberIds = new Set(state.members.map((m) => m.membership.customerId));
    customersService
      .list({ branchId: state.group.branchId })
      .then((items) => {
        setAddableCustomers(items.filter((c) => c.status === 'ACTIVE' && !currentMemberIds.has(c.id)));
      })
      .catch(() => setAddableCustomers([]))
      .finally(() => setIsLoadingAddableCustomers(false));
  }

  async function handleAddMember() {
    if (!state || !selectedCustomerId) return;
    try {
      setIsAddingMember(true);
      setAddMemberError(null);
      await groupsService.addMember(state.group.id, { customerId: selectedCustomerId });
      setIsAddMemberModalOpen(false);
      showToast('Member addition proposed — awaiting review/approval');
      await Promise.all([refresh(), loadPendingMembershipRequest()]);
    } catch (requestError) {
      setAddMemberError(requestError instanceof Error ? requestError.message : 'Failed to propose adding this member');
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleMembershipWorkflowAction(action: 'APPROVED' | 'REJECTED', comment?: string) {
    if (!pendingMembershipRequest) return;
    setRejectMembershipOpen(false);
    setApproveMembershipOpen(false);
    try {
      setActingOnMembershipRequest(true);
      await workflowRequestsService.act(pendingMembershipRequest.id, { action, comment });
      await Promise.all([refresh(), loadPendingMembershipRequest()]);
      if (action === 'REJECTED') {
        showToast('Member addition rejected — the group is unlocked');
      } else {
        // The engine decides whether this settled the review step or the
        // final approval — same "which word" logic as Customers.tsx's own
        // handleGroupWorkflowAction.
        showToast(
          pendingMembershipRequest.status === 'PENDING_REVIEW' ? 'Marked as reviewed' : 'Member added to the group',
        );
      }
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Action failed');
    } finally {
      setActingOnMembershipRequest(false);
    }
  }

  async function handleRequestEditPrivilege(reason?: string) {
    setEditPrivilegeModal(null);
    if (!state || !reason?.trim()) return;
    try {
      setIsActingOnEditPrivilege(true);
      await groupsService.requestEditPrivilege(state.group.id, reason.trim());
      await refresh();
      showToast('Edit privilege requested — awaiting Admin/Approver decision');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to request edit privilege');
    } finally {
      setIsActingOnEditPrivilege(false);
    }
  }

  async function handleDecideEditPrivilege(approve: boolean, comment?: string) {
    setEditPrivilegeModal(null);
    if (!state) return;
    try {
      setIsActingOnEditPrivilege(true);
      await groupsService.decideEditPrivilege(state.group.id, approve, comment);
      await refresh();
      showToast(approve ? 'Edit privilege granted' : 'Edit privilege request rejected');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to record decision');
    } finally {
      setIsActingOnEditPrivilege(false);
    }
  }

  function openDetailsModal() {
    if (!state) return;
    setDetailsForm({
      proposedLeaderName: state.group.proposedLeaderName ?? '',
      meetingDay: state.group.meetingDay ?? '',
      meetingLocation: state.group.meetingLocation ?? '',
      expectedMemberCount: state.group.expectedMemberCount != null ? String(state.group.expectedMemberCount) : '',
    });
    setIsDetailsModalOpen(true);
  }

  async function handleSaveDetails() {
    if (!state) return;
    try {
      setIsSavingDetails(true);
      await groupsService.updateDetails(state.group.id, {
        proposedLeaderName: detailsForm.proposedLeaderName.trim() || undefined,
        meetingDay: detailsForm.meetingDay.trim() || undefined,
        meetingLocation: detailsForm.meetingLocation.trim() || undefined,
        expectedMemberCount: detailsForm.expectedMemberCount.trim() ? Number(detailsForm.expectedMemberCount) : undefined,
      });
      await refresh();
      setIsDetailsModalOpen(false);
      showToast('Group details updated');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to update group details');
    } finally {
      setIsSavingDetails(false);
    }
  }

  const filteredAddableCustomers = addableCustomers.filter((c) => {
    if (!addMemberSearch.trim()) return true;
    const q = addMemberSearch.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.phoneNumber.toLowerCase().includes(q)
    );
  });

  const leaderName = (member: GroupMembership | undefined): string => {
    if (!member) {
      return 'Vacant';
    }
    const row = state?.members.find((m) => m.membership.id === member.id);
    return customerName(row?.customer ?? null, member.customerId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(customersBasePath)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon size={16} className="mr-2" />
          Back to Customers
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">Loading group details...</div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(customersBasePath)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon size={16} className="mr-2" />
          Back to Customers
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-sm text-red-600">{error || 'Group not found.'}</p>
        </div>
      </div>
    );
  }

  const { group, members, leadership, eligibility, loans } = state;
  // "Ongoing loan activity" — every loan that's actually had money move
  // against it (DISBURSED, or CLOSED once fully repaid); a loan still stuck
  // in PENDING_APPROVAL/APPROVED/VERIFICATION_*/REJECTED never touched the
  // branch balance at all, so it has nothing to contribute here. Totals sum
  // across every member's own share on each such loan (LoanSummary is
  // already the group-wide aggregate per loan — see its own doc comment).
  const disbursedLoans = loans.filter((loan) => loan.status === 'DISBURSED' || loan.status === 'CLOSED');
  const hasOngoingLoanActivity = disbursedLoans.length > 0;
  const totalLoanKobo = disbursedLoans.reduce((sum, loan) => sum + loan.cumulativeAmountKobo, 0);
  const totalInterestKobo = disbursedLoans.reduce((sum, loan) => sum + loan.totalInterestKobo, 0);
  const totalOutstandingKobo = disbursedLoans.reduce((sum, loan) => sum + loan.outstandingBalanceKobo, 0);
  // What's originally owed (principal + interest) minus what's still
  // outstanding — the same arithmetic every member's own outstandingBalanceKobo
  // is drawn down by by RepaymentsService.applyToBalance, so this is exactly
  // "how much has actually been paid off so far", not an estimate.
  const totalRepaidKobo = totalLoanKobo + totalInterestKobo - totalOutstandingKobo;
  const isCreator = Boolean(user && group.createdBy === user.id);
  const canRequestEditPrivilege =
    isCreator && group.status === 'ACTIVE' && group.editPrivilege.status !== 'PENDING';
  const canDecideEditPrivilege = isApproveTier && group.editPrivilege.status === 'PENDING';
  const canUpdateDetails = isCreator && group.editPrivilege.status === 'GRANTED';
  // Same "maker can't act on their own proposal" rule the workflow engine
  // enforces server-side (see ActOnWorkflowPayload's own doc comment) —
  // mirrored here just to decide which buttons to show.
  const isOwnMembershipProposal = Boolean(pendingMembershipRequest && user?.id === pendingMembershipRequest.initiatedBy);
  const canReviewMembership = isManager && pendingMembershipRequest?.status === 'PENDING_REVIEW';
  const canApproveMembership = isApproveTier && pendingMembershipRequest?.status === 'PENDING_APPROVAL';

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
        isOpen={editPrivilegeModal === 'request'}
        onClose={() => setEditPrivilegeModal(null)}
        onConfirm={(val) => void handleRequestEditPrivilege(val)}
        title="Request Edit Privilege"
        description={`${group.name} is already approved. Explain what needs correcting — only an Admin/SuperAdmin/Approver can grant this.`}
        icon={<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><LockIcon size={20} /></div>}
        confirmLabel="Submit Request"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Reason for Edit"
        inputPlaceholder="e.g. Expected member count was recorded incorrectly"
        requireInput
      />
      <ConfirmationModal
        isOpen={editPrivilegeModal === 'grant'}
        onClose={() => setEditPrivilegeModal(null)}
        onConfirm={() => void handleDecideEditPrivilege(true)}
        title="Grant Edit Privilege"
        description={`Allow ${group.name}'s creator to make a one-time update to its intake details?`}
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Grant"
        confirmVariant="primary"
      />
      <ConfirmationModal
        isOpen={editPrivilegeModal === 'reject'}
        onClose={() => setEditPrivilegeModal(null)}
        onConfirm={(val) => void handleDecideEditPrivilege(false, val)}
        title="Reject Edit Privilege Request"
        description="Provide a reason for rejecting this request."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Request"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason"
        inputPlaceholder="Explain why this request is being rejected..."
        requireInput
      />

      <ConfirmationModal
        isOpen={approveMembershipOpen}
        onClose={() => setApproveMembershipOpen(false)}
        onConfirm={(val) => void handleMembershipWorkflowAction('APPROVED', val)}
        title={canReviewMembership ? 'Mark as Reviewed' : 'Approve Member Addition'}
        description={
          canReviewMembership
            ? "Mark this member addition as reviewed? This does not approve it — an Admin or Approver still makes the final decision."
            : 'Approve this member addition and unlock the group?'
        }
        icon={
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${canReviewMembership ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
            <CheckCircleIcon size={20} />
          </div>
        }
        confirmLabel={canReviewMembership ? 'Mark as Reviewed' : 'Approve'}
        confirmVariant={canReviewMembership ? 'blue' : 'primary'}
        inputType="textarea"
        inputLabel={canReviewMembership ? 'Review comment (optional)' : 'Comment (optional)'}
        inputPlaceholder="Add any notes for whoever acts on this next..."
      />
      <ConfirmationModal
        isOpen={rejectMembershipOpen}
        onClose={() => setRejectMembershipOpen(false)}
        onConfirm={(val) => void handleMembershipWorkflowAction('REJECTED', val)}
        title="Reject Member Addition"
        description="A reason is required — it unlocks the group without adding the proposed member."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. This customer already has a pending loan elsewhere"
        requireInput
      />

      <AnimatePresence>
        {isDetailsModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsDetailsModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Update Group Details</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                Consumes the granted edit privilege — a fresh request is needed for any further change.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Leader Name</label>
                  <input
                    type="text"
                    value={detailsForm.proposedLeaderName}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, proposedLeaderName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Day</label>
                    <input
                      type="text"
                      value={detailsForm.meetingDay}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, meetingDay: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Members</label>
                    <input
                      type="number"
                      min={1}
                      value={detailsForm.expectedMemberCount}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, expectedMemberCount: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market / Location</label>
                  <input
                    type="text"
                    value={detailsForm.meetingLocation}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, meetingLocation: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsDetailsModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleSaveDetails()}
                  disabled={isSavingDetails}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isSavingDetails ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddMemberModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsAddMemberModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Add Member to Group</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                Only ACTIVE customers in this branch, not already a member, are listed. A customer with a
                pending/active loan in another group cannot be added — server-checked at submission.
              </p>
              <div className="relative mb-3 shrink-0">
                <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="overflow-y-auto flex-1 border border-gray-100 rounded-lg divide-y divide-gray-100">
                {isLoadingAddableCustomers ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6 justify-center">
                    <Loader2Icon size={16} className="animate-spin" /> Loading customers...
                  </div>
                ) : filteredAddableCustomers.length === 0 ? (
                  <p className="text-sm text-gray-400 font-body py-6 text-center">No eligible customers found.</p>
                ) : (
                  filteredAddableCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedCustomerId === c.id ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                    >
                      <p className={`font-medium ${selectedCustomerId === c.id ? 'text-primary' : 'text-gray-800'}`}>
                        {toTitleCase(`${c.firstName} ${c.lastName}`.trim()) || 'Unknown Customer'}
                      </p>
                      <p className="text-xs text-gray-500">{c.phoneNumber}</p>
                    </button>
                  ))
                )}
              </div>
              {addMemberError && <p className="text-xs text-red-600 font-body mt-3">{addMemberError}</p>}
              <div className="flex justify-end gap-3 mt-4 shrink-0">
                <button onClick={() => setIsAddMemberModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleAddMember()}
                  disabled={!selectedCustomerId || isAddingMember}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isAddingMember ? 'Proposing...' : 'Propose Addition'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => navigate(customersBasePath)}
        className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors"
      >
        <ArrowLeftIcon size={16} className="mr-2" />
        Back to Customers
      </button>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-heading font-bold text-primary">{group.name}</h2>
            {/* <p className="text-sm text-gray-500 mt-1">Group ID: {group.id}</p> */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canUpdateDetails && (
              <button
                onClick={openDetailsModal}
                className="px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
              >
                <LockIcon size={13} /> Update Record
              </button>
            )}
            {canRequestEditPrivilege && (
              <button
                onClick={() => setEditPrivilegeModal('request')}
                disabled={isActingOnEditPrivilege}
                className="px-3 py-1.5 border border-primary/20 text-primary text-xs font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                <LockIcon size={13} /> Request Edit Privilege
              </button>
            )}
            <StatusBadge status={group.status === 'ACTIVE' ? 'Active' : group.status === 'PENDING' ? 'Pending' : 'Rejected'} />
          </div>
        </div>

        {group.status === 'PENDING' && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-heading font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <ClockIcon size={13} /> Member Addition Pending
            </p>
            <p className="text-sm text-amber-800 font-body">
              {pendingMembershipCustomer
                ? `${customerName(pendingMembershipCustomer, pendingMembershipCustomer.id)} has been proposed for this group`
                : 'A new member has been proposed for this group'}
              {' — the group is locked (no other membership/leadership changes, and it can\'t raise a loan) until this resolves.'}
            </p>
            {pendingMembershipRequest && (
              <>
                <p className="text-xs text-amber-700 font-body mt-2">
                  {pendingMembershipRequest.status === 'PENDING_REVIEW'
                    ? "Awaiting the branch manager's review."
                    : 'Reviewed — awaiting final approval from an Admin, SuperAdmin, or Approver.'}
                </p>
                {isOwnMembershipProposal ? (
                  <p className="text-xs text-amber-600 font-body mt-2">
                    You proposed this addition — someone else must review/approve it.
                  </p>
                ) : (
                  (canReviewMembership || canApproveMembership) && (() => {
                    // Mirrors the backend's own PreApprovalValidator for
                    // GROUP_MEMBERSHIP/ADD, which re-checks the proposed
                    // member's own status at approval time (not just at
                    // proposal time) — see GroupsService.onModuleInit's own
                    // comment. Only gates the final approve step; the
                    // backend never validates against member status at
                    // review time either.
                    const notApprovable = canApproveMembership && pendingMembershipCustomer?.status !== 'ACTIVE';
                    return (
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <button
                          onClick={() => setApproveMembershipOpen(true)}
                          disabled={actingOnMembershipRequest || notApprovable}
                          title={notApprovable ? 'This customer must be fully approved before the addition can be approved' : undefined}
                          className="px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          {canReviewMembership ? 'Mark as Reviewed' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setRejectMembershipOpen(true)}
                          disabled={actingOnMembershipRequest}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-heading font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    );
                  })()
                )}
              </>
            )}
          </div>
        )}

        {group.editPrivilege.status === 'REJECTED' && isCreator && (
          <p className="mt-3 text-xs font-body text-red-600 flex items-start gap-1.5">
            <XCircleIcon size={13} className="mt-0.5 shrink-0" />
            Your last edit privilege request was rejected{group.editPrivilege.decisionComment ? `: ${group.editPrivilege.decisionComment}` : '.'}
          </p>
        )}
        {group.editPrivilege.status === 'GRANTED' && isCreator && (
          <p className="mt-3 text-xs font-body text-green-600 flex items-start gap-1.5">
            <CheckCircleIcon size={13} className="mt-0.5 shrink-0" />
            Edit privilege granted — use "Update Record" above to make your one change.
          </p>
        )}
        {canDecideEditPrivilege && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-heading font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <LockIcon size={13} /> Edit Privilege Request Pending
            </p>
            <p className="text-sm text-amber-800 font-body">{group.editPrivilege.reason}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                onClick={() => setEditPrivilegeModal('grant')}
                disabled={isActingOnEditPrivilege}
                className="px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                Grant
              </button>
              <button
                onClick={() => setEditPrivilegeModal('reject')}
                disabled={isActingOnEditPrivilege}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-heading font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{branchName}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Members</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{members.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{toDisplayDate(group.createdAt)}</p>
          </div>
        </div>

        {(group.proposedLeaderName || group.meetingDay || group.meetingLocation || group.expectedMemberCount) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Proposed Leader</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{group.proposedLeaderName || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Meeting Day</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{group.meetingDay || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Market / Location</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{group.meetingLocation || '—'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Expected Members</p>
              <p className="text-sm text-gray-800 mt-1 font-medium">{group.expectedMemberCount ?? '—'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Group Head</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{leaderName(leadership.head)}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Assistant Head</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{leaderName(leadership.assistant)}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Coordinator</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{leaderName(leadership.coordinator)}</p>
          </div>
        </div>

        <div className={`mt-4 rounded-lg border p-4 flex items-start gap-3 ${eligibility.eligible ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
          {eligibility.eligible ? (
            <CheckCircleIcon size={18} className="text-green-600 mt-0.5" />
          ) : (
            <XCircleIcon size={18} className="text-amber-600 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-heading font-semibold ${eligibility.eligible ? 'text-green-800' : 'text-amber-800'}`}>
              {eligibility.eligible ? 'Eligible for a loan application' : 'Not eligible for a loan application'}
            </p>
            {!eligibility.eligible && eligibility.ineligibleMembers.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {eligibility.ineligibleMembers.map((item, index) => (
                  <li key={`${item.customerId ?? 'group'}-${index}`} className="text-xs text-amber-700">
                    {item.customerId
                      ? `${customerName(members.find((m) => m.membership.customerId === item.customerId)?.customer ?? null, item.customerId)}: `
                      : ''}
                    {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {hasOngoingLoanActivity && (
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BanknoteIcon size={16} className="text-gray-400" />
            <h3 className="text-sm font-heading font-bold text-primary">Loan Activity</h3>
          </div>
          <p className="text-xs text-gray-500 font-body -mt-3 mb-4">
            Cumulative across every member's own disbursed loan(s) in this group.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Loan</p>
              <p className="text-lg font-heading font-bold text-gray-900 mt-1">{formatNaira(totalLoanKobo)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Repayments</p>
              <p className="text-lg font-heading font-bold text-green-700 mt-1">{formatNaira(totalRepaidKobo)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Outstanding</p>
              <p className="text-lg font-heading font-bold text-amber-700 mt-1">{formatNaira(totalOutstandingKobo)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UsersIcon size={16} className="text-gray-400" />
            <h3 className="text-sm font-heading font-bold text-primary">Group Members</h3>
          </div>
          {canAddMember && (
            <button
              onClick={openAddMemberModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors"
            >
              <UserPlusIcon size={14} /> Add Member
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {members.map(({ membership, customer }) => (
                <tr
                  key={membership.id}
                  onClick={() => {
                    if (customer) {
                      navigate(`${customersBasePath}/${customer.id}`);
                    }
                  }}
                  className={`transition-colors ${customer ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default text-gray-400'}`}
                >
                  <td className="px-6 py-4 text-gray-800 font-medium">{customerName(customer, membership.customerId)}</td>
                  <td className="px-6 py-4 text-gray-600">{customer?.phoneNumber ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{ROLE_LABEL[membership.role]}</td>
                  <td className="px-6 py-4 text-gray-600">{toDisplayDate(membership.joinedAt)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={customerStatusLabel(customer)} />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                    No members found in this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
