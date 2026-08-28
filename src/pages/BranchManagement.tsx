import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingIcon,
  PlusIcon,
  WalletIcon,
  UsersIcon,
  CheckCircle2Icon,
  SearchIcon,
  FilterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CircleXIcon,
  Trash2Icon } from
'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BranchFundingDetailModal } from './branches/BranchFundingDetailModal';
import {
  BranchData,
  CreateBranchPayload,
  EditBranchPayload,
  CreateBranchModal,
  EditBranchModal,
  FundBranchModal } from
'./branches/BranchModals';
import { branchesService } from '../services/branches/branches.service';
import { branchBankAccountsService, type BranchBankAccount } from '../services/branch-bank-accounts/branch-bank-accounts.service';
import { branchFundingService, type BranchFunding } from '../services/branch-funding/branch-funding.service';
import { branchRequestsService, type BranchRequest } from '../services/branch-requests/branch-requests.service';
import { staffService } from '../services/staff/staff.service';
import { workflowRequestsService } from '../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestDetail, WorkflowRequestSummary } from '../services/workflow-requests/workflow-requests.types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { upsertBranchScoped } from '../store/slices/lookupsSlice';
import { useAuth } from '../context/AuthContext';
import type { BranchManagerLookup } from '../store/slices/lookupsSlice';

const BRANCH_ENTITY_TYPE = 'BRANCH';

function formatFund(amountKobo: number): string {
  return `₦${(amountKobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * `managers` (lookups.branchManagers, hydrated once at login) can be stale —
 * a manager onboarded/assigned after that hydration won't be in it yet. Falls
 * back to fetching the staff record directly rather than showing their raw
 * id, same "don't trust the cache to always be current" reasoning as
 * everywhere else this lookup is read from.
 */
async function resolveManagerName(staffId: string | undefined, managers: BranchManagerLookup[]): Promise<string> {
  if (!staffId) return 'Unassigned';
  const cached = managers.find((item) => item.id === staffId);
  if (cached) return cached.fullName;
  try {
    const staff = await staffService.getById(staffId);
    return `${staff.firstName} ${staff.lastName}`.trim() || staffId;
  } catch {
    return staffId;
  }
}

/** `name` — resolved server-side (see WorkflowRequestSummary.initiatedByName) — is preferred over the id whenever available. */
function ActorLabel({ actorId, name }: { actorId: string; name?: string | null }) {
  const { user } = useAuth();
  if (user?.id === actorId) return <span>You</span>;
  if (name) return <span title={actorId}>{name}</span>;
  return <span title={actorId}>{actorId.slice(-6)}</span>;
}

/** Best-effort read of a pending/rejected BRANCH proposal's name/code — the payload shape is whatever BranchesService put there, not formally typed on this side. */
function pendingBranchSummary(payload: Record<string, unknown>): { name: string; code: string | null } {
  const name = typeof payload.name === 'string' ? payload.name : null;
  const code = typeof payload.code === 'string' ? payload.code : null;
  return { name: name ?? '(untitled proposal)', code };
}

const FUNDING_STATUS_LABEL: Record<BranchFunding['status'], string> = {
  PENDING_VERIFICATION: 'Pending Verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

type FundingHistoryRow = BranchFunding & { branchName: string };

export function BranchManagement() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const branchManagers = useAppSelector((state) => state.lookups.branchManagers);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [activeBankAccounts, setActiveBankAccounts] = useState<Record<string, BranchBankAccount | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeView, setActiveView] = useState<'branches' | 'funding-history' | 'requests'>('branches');

  // A Manager's free-form "Request to Head Office" (see MyBranch.tsx) — had
  // no Admin/SuperAdmin/Approver-facing view at all until now, despite the
  // backend (branch-requests.controller.ts) already supporting it fully:
  // GET /branch-requests already returns every branch's requests for this
  // tier, and POST /branch-requests/:id/resolve is gated by the same
  // approveCapability(BRANCH) this whole page already requires.
  const [branchRequests, setBranchRequests] = useState<BranchRequest[]>([]);
  const [isLoadingBranchRequests, setIsLoadingBranchRequests] = useState(true);
  const [branchRequestsLoadError, setBranchRequestsLoadError] = useState<string | null>(null);
  const [resolveTargetRequest, setResolveTargetRequest] = useState<BranchRequest | null>(null);
  const [isResolvingBranchRequest, setIsResolvingBranchRequest] = useState(false);
  // Branch creation is workflow-mediated (a different Admin/SuperAdmin/
  // Approver must approve one) — this is the same Approved/Pending/Rejected
  // split used for Loan Products/Fee Configuration/staff onboarding.
  const [branchApprovalView, setBranchApprovalView] = useState<'approved' | 'pending' | 'rejected'>('approved');

  const [pendingRequests, setPendingRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingDetails, setPendingDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [rejectedRequests, setRejectedRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedDetails, setRejectedDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejected, setIsLoadingRejected] = useState(true);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [deleteTargetBranch, setDeleteTargetBranch] = useState<BranchData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Withdrawing a still-pending proposal is a soft cancel, not a hard delete
  // — see workflowRequestsService.cancel's own doc comment. BRANCH's create
  // chain is a single approve-only step, so a fresh proposal sits at
  // PENDING_APPROVAL immediately (never PENDING_REVIEW) — which is why this
  // uses `cancel` rather than the generic hard-delete endpoint (that one's
  // PENDING_REVIEW/REJECTED only).
  const [withdrawTargetRequestId, setWithdrawTargetRequestId] = useState<string | null>(null);
  const [isWithdrawingRequest, setIsWithdrawingRequest] = useState(false);

  // Permanently deleting a REJECTED proposal — separate from
  // deleteTargetBranch (that one hard-deletes a real, already-approved
  // Branch document; a rejected proposal never created one at all).
  const [deleteTargetRequestId, setDeleteTargetRequestId] = useState<string | null>(null);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);

  // Approver holds approve:BRANCH/initiate:BRANCH server-side (can propose,
  // approve/reject, and now delete a branch) but not org:manage or
  // branch:fund — Edit/Fund would just 403 for that role, so hide them here
  // rather than let the click round-trip to a permission error.
  const isApprover = user?.role === 'approver';

  const [fundingRecords, setFundingRecords] = useState<BranchFunding[]>([]);
  const [isLoadingFunding, setIsLoadingFunding] = useState(true);
  const [fundingLoadError, setFundingLoadError] = useState<string | null>(null);
  const [fundingBranchFilter, setFundingBranchFilter] = useState<string>('all');
  const [fundingStatusFilter, setFundingStatusFilter] = useState<'all' | BranchFunding['status']>('all');
  const [fundingFromDate, setFundingFromDate] = useState<string>('');
  const [fundingToDate, setFundingToDate] = useState<string>('');
  const [selectedFunding, setSelectedFunding] = useState<BranchFunding | null>(null);

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  /**
   * The real Branch document (name/code/address/active — see backend's
   * Branch schema) has no manager/staff-count/active-loan-count/balance
   * fields of its own; each of those is its own real endpoint
   * (GET :id/manager, GET :id/stats, GET :id/balance, GET /bank-accounts).
   * One extra Promise.all per branch is an accepted N+1 tradeoff for a
   * branch list of this size — a `.catch()` on each sub-call keeps one
   * branch's transient failure from blanking out the whole list.
   */
  const loadBranches = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rawBranches = await branchesService.list();
      const enriched = await Promise.all(
        rawBranches.map(async (branch): Promise<BranchData> => {
          const [manager, stats, balance] = await Promise.all([
            branchesService.getCurrentManager(branch.id).catch(() => null),
            branchesService
              .getStats(branch.id)
              .catch(() => ({ branchId: branch.id, staffCount: 0, activeLoansCount: 0 })),
            branchesService
              .getBalance(branch.id)
              .catch(() => ({ branchId: branch.id, availableAmount: 0 })),
          ]);
          const managerName = await resolveManagerName(manager?.staffId, branchManagers);

          return {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            address: branch.address ?? '',
            managerId: manager?.staffId,
            location: branch.address || '—',
            manager: managerName,
            staff: stats.staffCount,
            fund: formatFund(balance.availableAmount),
            totalFundAllocated: balance.availableAmount,
            activeLoans: stats.activeLoansCount,
            status: branch.active ? 'Active' : 'Inactive',
            // Real Branch has no totalDisbursed/repaymentRate of its own —
            // honestly absent, not fabricated (see BranchData's own doc
            // comment). phone/email are real fields now (see UpdateBranchDto).
            phone: branch.phone ?? '',
            email: branch.email ?? '',
            dateCreated: branch.createdAt ? new Date(branch.createdAt).toISOString().split('T')[0] : '',
            totalDisbursed: '—',
            repaymentRate: '—',
            bankAccounts: [],
            fundingHistory: [],
          };
        }),
      );

      setBranches(enriched);
      enriched.forEach((branch) => {
        dispatch(
          upsertBranchScoped({
            id: branch.id,
            name: branch.name,
            code: branch.code,
            address: branch.address,
            managerId: branch.managerId,
            isActive: branch.status === 'Active',
          }),
        );
      });

      const bankAccountEntries = await Promise.all(
        enriched.map(async (branch) => {
          const accounts = await branchBankAccountsService.list(branch.id).catch(() => []);
          return [branch.id, accounts.find((account) => account.active) ?? null] as const;
        }),
      );
      setActiveBankAccounts(Object.fromEntries(bankAccountEntries));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPending = async () => {
    setIsLoadingPending(true);
    try {
      const requests = await workflowRequestsService.getPendingByEntityType(BRANCH_ENTITY_TYPE);
      setPendingRequests(requests);
      const details = await Promise.all(requests.map((request) => workflowRequestsService.getById(request.id)));
      setPendingDetails(Object.fromEntries(details.map((detail) => [detail.id, detail])));
    } catch {
      setPendingRequests([]);
      setPendingDetails({});
    } finally {
      setIsLoadingPending(false);
    }
  };

  const loadRejected = async () => {
    setIsLoadingRejected(true);
    try {
      const requests = await workflowRequestsService.getRejectedByEntityType(BRANCH_ENTITY_TYPE);
      setRejectedRequests(requests);
      const details = await Promise.all(requests.map((request) => workflowRequestsService.getById(request.id)));
      setRejectedDetails(Object.fromEntries(details.map((detail) => [detail.id, detail])));
    } catch {
      setRejectedRequests([]);
      setRejectedDetails({});
    } finally {
      setIsLoadingRejected(false);
    }
  };

  const loadFundingHistory = async () => {
    setIsLoadingFunding(true);
    setFundingLoadError(null);
    try {
      setFundingRecords(await branchFundingService.list());
    } catch (error) {
      setFundingLoadError(error instanceof Error ? error.message : 'Failed to load funding history');
    } finally {
      setIsLoadingFunding(false);
    }
  };

  /** No `branchId` filter — Admin/SuperAdmin/Approver see every branch's requests, row-scoped server-side. */
  const loadBranchRequests = async () => {
    setIsLoadingBranchRequests(true);
    setBranchRequestsLoadError(null);
    try {
      setBranchRequests(await branchRequestsService.list());
    } catch (error) {
      setBranchRequestsLoadError(error instanceof Error ? error.message : 'Failed to load branch requests');
    } finally {
      setIsLoadingBranchRequests(false);
    }
  };

  async function handleResolveBranchRequest(note: string) {
    if (!resolveTargetRequest || !note.trim()) return;
    setIsResolvingBranchRequest(true);
    try {
      await branchRequestsService.resolve(resolveTargetRequest.id, { note: note.trim() });
      showToast('Response sent');
      setResolveTargetRequest(null);
      await loadBranchRequests();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send this response');
    } finally {
      setIsResolvingBranchRequest(false);
    }
  }

  useEffect(() => {
    void loadBranches();
    void loadPending();
    void loadRejected();
    void loadFundingHistory();
    void loadBranchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic KPIs — Total Funded is the sum of each branch's real, currently
  // available balance (i.e. verified funding only, not pending records).
  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.status === 'Active').length;
  const totalFundedKobo = branches.reduce((sum, b) => sum + (b.totalFundAllocated ?? 0), 0);
  const totalStaff = branches.reduce((sum, b) => sum + (b.staff ?? 0), 0);
  const openBranchRequestsCount = branchRequests.filter((request) => request.status === 'OPEN').length;

  const filtered = branches.filter((b) => {
    const matchesSearch =
      !searchQuery.trim() ||
      [b.name, b.id, b.location, b.manager].some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fundingHistoryItems = useMemo<FundingHistoryRow[]>(() => {
    const withBranchNames = fundingRecords.map((record) => ({
      ...record,
      branchName: branches.find((b) => b.id === record.branchId)?.name ?? record.branchId,
    }));

    const fromTime = fundingFromDate ? new Date(fundingFromDate).getTime() : null;
    const toTime = fundingToDate ? new Date(fundingToDate).getTime() : null;

    return withBranchNames
      .filter((item) => {
        if (fundingBranchFilter !== 'all' && item.branchId !== fundingBranchFilter) return false;
        if (fundingStatusFilter !== 'all' && item.status !== fundingStatusFilter) return false;

        const itemTime = new Date(item.fundedAt).getTime();
        if (fromTime !== null && itemTime < fromTime) return false;
        if (toTime !== null && itemTime > toTime) return false;

        return true;
      })
      .sort((first, second) => new Date(second.fundedAt).getTime() - new Date(first.fundedAt).getTime());
  }, [fundingRecords, branches, fundingBranchFilter, fundingStatusFilter, fundingFromDate, fundingToDate]);

  const fundingHistoryTotal = useMemo(
    () => fundingHistoryItems.reduce((sum, item) => sum + item.amount, 0),
    [fundingHistoryItems],
  );
  const isFundingFiltersDefault =
    fundingBranchFilter === 'all' &&
    fundingStatusFilter === 'all' &&
    fundingFromDate.length === 0 &&
    fundingToDate.length === 0;

  function exportFundingHistoryCsv() {
    if (fundingHistoryItems.length === 0) {
      showToast('No funding history rows to export');
      return;
    }

    const escapeCsvValue = (value: string) => {
      const normalized = value.replace(/\r?\n|\r/g, ' ').trim();
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const headers = ['Date', 'Branch', 'Amount', 'Status', 'Reference', 'Recorded By'];
    const rows = fundingHistoryItems.map((item) => [
      item.fundedAt.split('T')[0],
      item.branchName,
      formatFund(item.amount),
      FUNDING_STATUS_LABEL[item.status],
      item.reference || '-',
      item.recordedBy,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsvValue(String(cell))).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const branchSegment =
      fundingBranchFilter === 'all'
        ? 'all-branches'
        : branches.find((branch) => branch.id === fundingBranchFilter)?.name.replace(/\s+/g, '-').toLowerCase() ||
          'filtered';
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `funding-history-${branchSegment}-${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Funding history CSV exported');
  }

  function resetFundingFilters() {
    if (isFundingFiltersDefault) return;
    setFundingBranchFilter('all');
    setFundingStatusFilter('all');
    setFundingFromDate('');
    setFundingToDate('');
  }

  async function handleCreate(data: CreateBranchPayload) {
    setSubmitting(true);
    try {
      await branchesService.create({ name: data.name, code: data.code, address: data.address });
      await loadPending();
      showToast(`Branch "${data.name}" proposed — awaiting approval before it's created.`);
      setCreateOpen(false);
      setBranchApprovalView('pending');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to propose branch');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(id: string, data: EditBranchPayload) {
    const currentBranch = branches.find((branch) => branch.id === id);
    setSubmitting(true);
    try {
      await branchesService.update(id, {
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone || undefined,
        email: data.email || undefined,
        active: data.status === 'Active',
      });

      // Workflow-mediated, not immediate — a different Admin/SuperAdmin/
      // Approver still has to approve this before it takes effect (see
      // BranchManagerAssignmentService) — messaged separately from the
      // branch-details update above since it's a genuinely different
      // outcome ("saved" vs. "proposed, pending approval").
      let managerProposed = false;
      if (data.managerId && data.managerId !== currentBranch?.managerId) {
        await branchesService.assignManager(id, { staffId: data.managerId });
        managerProposed = true;
      }

      await loadBranches();
      showToast(
        managerProposed
          ? 'Branch details updated. Manager assignment proposed — awaiting a second approver.'
          : 'Branch updated successfully',
      );
      setEditOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update branch');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNudge(fundingId: string) {
    try {
      const updated = await branchFundingService.nudge(fundingId);
      showToast("Nudge sent — the branch manager will get an email");
      setFundingRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedFunding((prev) => (prev && prev.id === updated.id ? updated : prev));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to nudge the branch manager');
    }
  }

  async function handleResolveDispute(fundingId: string, resolution: 'RESOLVED' | 'DISMISSED', note: string) {
    const updated = await branchFundingService.resolveDispute(fundingId, resolution, note);
    showToast(resolution === 'RESOLVED' ? 'Dispute marked resolved' : 'Dispute dismissed');
    setFundingRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedFunding(updated);
  }

  async function handleFund(id: string, bankAccountId: string, amountKobo: number, fundedAt: string, reference: string) {
    setSubmitting(true);
    try {
      await branchFundingService.record({
        branchId: id,
        bankAccountId,
        amount: amountKobo,
        fundedAt,
        reference: reference || undefined,
      });
      await loadFundingHistory();
      const branch = branches.find((b) => b.id === id);
      showToast(
        `${formatFund(amountKobo)} recorded for ${branch?.name || id} — awaiting the branch manager's verification`,
      );
      setFundOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record funding');
    } finally {
      setSubmitting(false);
    }
  }

  /** Super Admin/Admin/Approver only — hard-delete a branch that's not (yet) active. Backend re-checks both the active flag and that nothing still references it. */
  async function handleDelete() {
    if (!deleteTargetBranch) return;
    setDeleting(true);
    try {
      await branchesService.remove(deleteTargetBranch.id);
      showToast(`Branch "${deleteTargetBranch.name}" deleted`);
      setDeleteTargetBranch(null);
      await loadBranches();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  }

  async function handleWithdrawRequest() {
    if (!withdrawTargetRequestId) return;
    setIsWithdrawingRequest(true);
    try {
      await workflowRequestsService.cancel(withdrawTargetRequestId);
      showToast('Branch proposal withdrawn');
      setWithdrawTargetRequestId(null);
      await loadPending();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to withdraw this proposal');
    } finally {
      setIsWithdrawingRequest(false);
    }
  }

  async function handleDeleteRequest() {
    if (!deleteTargetRequestId) return;
    setIsDeletingRequest(true);
    try {
      await workflowRequestsService.deleteRequest(deleteTargetRequestId);
      showToast('Rejected branch proposal deleted');
      setDeleteTargetRequestId(null);
      await loadRejected();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete this request');
    } finally {
      setIsDeletingRequest(false);
    }
  }

  async function handleWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      await Promise.all([loadBranches(), loadPending(), loadRejected()]);
      if (action === 'APPROVED') {
        showToast('Branch approved — now showing in Approved.');
        setBranchApprovalView('approved');
      } else {
        showToast('Branch proposal rejected — now showing in Rejected.');
        setBranchApprovalView('rejected');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to act on this request');
    } finally {
      setActingRequestId(null);
    }
  }

  function confirmReject(comment?: string) {
    if (!rejectTargetId || !comment?.trim()) return;
    void handleWorkflowAction(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast.visible &&
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body">

            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Modals */}
      <CreateBranchModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />

      <EditBranchModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        branch={selectedBranch}
        onSubmit={handleEdit} />

      <FundBranchModal
        isOpen={fundOpen}
        onClose={() => setFundOpen(false)}
        branch={selectedBranch}
        activeBankAccount={selectedBranch ? activeBankAccounts[selectedBranch.id] ?? null : null}
        onSubmit={handleFund} />

      <ConfirmationModal
        isOpen={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={(reason) => confirmReject(reason)}
        title="Reject this branch proposal?"
        description="A reason is required — the person who proposed it will see it."
        icon={<XCircleIcon size={20} className="text-red-600" />}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. Duplicate of an existing branch"
        requireInput
      />

      <ConfirmationModal
        isOpen={deleteTargetBranch !== null}
        onClose={() => setDeleteTargetBranch(null)}
        onConfirm={() => void handleDelete()}
        title={`Delete "${deleteTargetBranch?.name ?? ''}"?`}
        description="This permanently removes the branch and its bank accounts/fund balance. This cannot be undone. Only possible while nothing (staff, customers, groups, loans) still references it — active or inactive makes no difference."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        inputType="none"
      />

      <ConfirmationModal
        isOpen={withdrawTargetRequestId !== null}
        onClose={() => setWithdrawTargetRequestId(null)}
        onConfirm={() => void handleWithdrawRequest()}
        title="Withdraw this branch proposal?"
        description="This removes it from the approval queue — nothing was ever created, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isWithdrawingRequest ? 'Withdrawing…' : 'Withdraw'}
        confirmVariant="danger"
        inputType="none"
      />

      <ConfirmationModal
        isOpen={deleteTargetRequestId !== null}
        onClose={() => setDeleteTargetRequestId(null)}
        onConfirm={() => void handleDeleteRequest()}
        title="Delete this rejected branch proposal?"
        description="This permanently removes the request — it cannot be undone."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeletingRequest ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        inputType="none"
      />

      <ConfirmationModal
        isOpen={resolveTargetRequest !== null}
        onClose={() => setResolveTargetRequest(null)}
        onConfirm={(note) => void handleResolveBranchRequest(note ?? '')}
        title={`Respond to "${resolveTargetRequest?.subject ?? ''}"`}
        description="Your response is visible to the branch Manager who raised this request."
        confirmLabel={isResolvingBranchRequest ? 'Sending…' : 'Send Response'}
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Your response"
        inputPlaceholder="e.g. Approved — funds will be sent by Friday"
        requireInput
      />

      <BranchFundingDetailModal
        isOpen={selectedFunding !== null}
        onClose={() => setSelectedFunding(null)}
        funding={selectedFunding}
        branchName={selectedFunding ? branches.find((b) => b.id === selectedFunding.branchId)?.name : undefined}
        mode="admin"
        onNudge={selectedFunding ? () => void handleNudge(selectedFunding.id) : undefined}
        onResolveDispute={
          selectedFunding
            ? (resolution, note) => handleResolveDispute(selectedFunding.id, resolution, note)
            : undefined
        }
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-primary">
            Branch Management
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage branches, allocate funds, and monitor performance
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          disabled={submitting}
          className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-[#e64a19] transition-colors text-sm font-heading font-bold shadow-sm disabled:opacity-60">

          <PlusIcon size={16} className="mr-2" />
          Propose New Branch
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 mr-4">
            <BuildingIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Branches</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {isLoading ? '—' : totalBranches}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-50 rounded-lg text-green-600 mr-4">
            <CheckCircle2Icon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Active Branches</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {isLoading ? '—' : activeBranches}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 mr-4">
            <WalletIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Funded</p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {isLoading ? '—' : formatFund(totalFundedKobo)}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600 mr-4">
            <UsersIcon size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">
              Total Field Staff
            </p>
            <h3 className="text-2xl font-heading font-bold text-primary">
              {isLoading ? '—' : totalStaff}
            </h3>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveView('branches')}
          className={`px-4 py-2 rounded-lg text-sm font-heading font-bold transition-colors ${activeView === 'branches' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Branches
        </button>
        <button
          onClick={() => setActiveView('funding-history')}
          className={`px-4 py-2 rounded-lg text-sm font-heading font-bold transition-colors ${activeView === 'funding-history' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Funding History
        </button>
        <button
          onClick={() => setActiveView('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-heading font-bold transition-colors flex items-center gap-1.5 ${activeView === 'requests' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Branch Requests
          {openBranchRequestsCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-heading font-bold ${activeView === 'requests' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {openBranchRequestsCount}
            </span>
          )}
        </button>
      </div>

      {activeView === 'branches' &&
      <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            Proposing a branch doesn't create it — it takes effect once a different Admin, SuperAdmin, or Approver
            approves it. The person who proposed it can't approve their own proposal.
          </div>

          <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setBranchApprovalView('approved')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${branchApprovalView === 'approved' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Approved ({branches.length})
            </button>
            <button
              onClick={() => setBranchApprovalView('pending')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${branchApprovalView === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Pending Approval ({pendingRequests.length})
            </button>
            <button
              onClick={() => setBranchApprovalView('rejected')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${branchApprovalView === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Rejected ({rejectedRequests.length})
            </button>
          </div>

          {branchApprovalView === 'approved' && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                  <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search branches..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setFilterOpen(!filterOpen)}
                    className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium">
                    <FilterIcon size={16} className="mr-2" /> Filter
                    {statusFilter !== 'all' && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />}
                  </button>
                  {filterOpen &&
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-40">
                      {(['all', 'Active', 'Inactive'] as const).map((s) =>
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setFilterOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${statusFilter === s ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}>
                          {s === 'all' ? 'All Statuses' : s}
                        </button>
                    )}
                    </div>
                  }
                </div>
              </div>

              {loadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                        <th className="px-6 py-4 font-medium">Branch Name</th>
                        <th className="px-6 py-4 font-medium">Manager</th>
                        <th className="px-6 py-4 font-medium">Staff</th>
                        <th className="px-6 py-4 font-medium">Fund Balance</th>
                        <th className="px-6 py-4 font-medium">Active Loans</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {isLoading && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                            Loading branches...
                          </td>
                        </tr>
                      )}
                      {!isLoading &&
                      filtered.map((branch) =>
                      <tr
                        key={branch.id}
                        onClick={() => navigate(`/branches/${branch.id}`)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer">

                          <td className="px-6 py-4">
                            <p className="font-heading font-medium text-primary">
                              {branch.name}
                            </p>
                            <p className="text-xs text-gray-400">{branch.location}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {branch.manager === 'Unassigned' ?
                          <span className="text-gray-400 italic">
                                Pending Assignment
                              </span> :

                          branch.manager
                          }
                          </td>
                          <td className="px-6 py-4 text-gray-600">{branch.staff ?? 0}</td>
                          <td className="px-6 py-4 font-medium text-gray-700">{branch.fund}</td>
                          <td className="px-6 py-4 text-gray-600">{branch.activeLoans ?? 0}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={branch.status as any} />
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center justify-end gap-3">
                              {!isApprover && (
                                <button
                                  onClick={() => {
                                    setSelectedBranch(branch);
                                    setEditOpen(true);
                                  }}
                                  className="text-xs font-heading font-bold text-primary hover:text-primary/80">
                                  Edit
                                </button>
                              )}
                              {!isApprover && (
                                <button
                                  onClick={() => {
                                    setSelectedBranch(branch);
                                    setFundOpen(true);
                                  }}
                                  disabled={branch.manager === 'Unassigned'}
                                  title={branch.manager === 'Unassigned' ? 'Assign a manager to this branch before it can be funded' : undefined}
                                  className="text-xs font-heading font-bold text-green-600 hover:text-green-700 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:text-gray-300">
                                  Fund
                                </button>
                              )}
                              {/* Inactive branches can always attempt delete (backend re-checks
                                  references either way); an Active one only once it has no staff —
                                  matches BranchesService.deleteBranch, which no longer gates on
                                  `active` at all, only on "does anything reference it". */}
                              {(branch.status !== 'Active' || (branch.staff ?? 0) === 0) && (
                                <button
                                  onClick={() => setDeleteTargetBranch(branch)}
                                  title="Only a branch with nothing (staff, customers, groups, loans) still referencing it can be deleted"
                                  className="inline-flex items-center gap-1 text-xs font-heading font-bold text-red-600 hover:text-red-700">
                                  <Trash2Icon size={13} /> Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {!isLoading && filtered.length === 0 &&
                      <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                            No branches match your search.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {branchApprovalView === 'pending' && (
            <div className="space-y-3">
              {isLoadingPending ? (
                <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading pending requests...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
                  <ClockIcon size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
                  <p className="text-xs font-body text-gray-400 mt-1">Proposed branches show up here until they're approved or rejected.</p>
                </div>
              ) : (
                pendingRequests.map((entry) => {
                  const detail = pendingDetails[entry.id];
                  const summary = detail ? pendingBranchSummary(detail.payload) : null;
                  const isOwnProposal = user?.id === entry.initiatedBy;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => navigate(`/branches/requests/${entry.id}`)}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4 cursor-pointer hover:border-primary/30 transition-colors">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <ClockIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-heading font-bold text-gray-900">{summary?.name ?? (detail ? 'Untitled proposal' : 'Loading...')}</p>
                            {summary?.code && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-gray-100 text-gray-600">
                                {summary.code}
                              </span>
                            )}
                            {isOwnProposal && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                            )}
                          </div>
                          <p className="text-xs font-body text-gray-400 mt-0.5">
                            Proposed by <ActorLabel actorId={entry.initiatedBy} name={entry.initiatedByName} /> · {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {isOwnProposal ? (
                        <div className="flex items-start gap-2 flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                          <p className="text-xs font-body text-gray-400 text-right max-w-[160px]">
                            Awaiting another Admin/SuperAdmin/Approver's review — you can't approve your own proposal.
                          </p>
                          <button
                            onClick={() => setWithdrawTargetRequestId(entry.id)}
                            title="Withdraw this proposal"
                            aria-label="Withdraw this proposal"
                            className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2Icon size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                          <button
                            disabled={actingRequestId === entry.id}
                            onClick={() => void handleWorkflowAction(entry.id, 'APPROVED')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                            <CheckCircleIcon size={13} /> Approve
                          </button>
                          <button
                            disabled={actingRequestId === entry.id}
                            onClick={() => setRejectTargetId(entry.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
                            <XCircleIcon size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {branchApprovalView === 'rejected' && (
            <div className="space-y-3">
              {isLoadingRejected ? (
                <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading rejected requests...</div>
              ) : rejectedRequests.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
                  <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-heading font-bold text-gray-500">Nothing rejected</p>
                  <p className="text-xs font-body text-gray-400 mt-1">A rejected proposal never becomes a branch — it shows up here instead.</p>
                </div>
              ) : (
                rejectedRequests.map((entry) => {
                  const detail = rejectedDetails[entry.id];
                  const summary = detail ? pendingBranchSummary(detail.payload) : null;
                  const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');
                  const isOwnProposal = user?.id === entry.initiatedBy;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => navigate(`/branches/requests/${entry.id}`)}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4 cursor-pointer hover:border-primary/30 transition-colors">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                          <CircleXIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-heading font-bold text-gray-900">{summary?.name ?? (detail ? 'Untitled proposal' : 'Loading...')}</p>
                            {summary?.code && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-gray-100 text-gray-600">
                                {summary.code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-body text-gray-400 mt-0.5">
                            Proposed by <ActorLabel actorId={entry.initiatedBy} name={entry.initiatedByName} /> · {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                          {rejectionStep?.actedBy && (
                            <p className="text-xs font-body text-red-600 mt-1.5">
                              Rejected by <ActorLabel actorId={rejectionStep.actedBy} name={rejectionStep.actedByName} />
                              {rejectionStep.actedAt ? ` · ${new Date(rejectionStep.actedAt).toLocaleDateString()}` : ''}
                              {rejectionStep.comment ? `: "${rejectionStep.comment}"` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOwnProposal && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTargetRequestId(entry.id);
                          }}
                          title="Delete this rejected proposal"
                          aria-label="Delete this rejected proposal"
                          className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                          <Trash2Icon size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      }

      {activeView === 'funding-history' &&
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-heading">Total Amount</p>
                <p className="text-lg font-heading font-bold text-primary">{formatFund(fundingHistoryTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isFundingFiltersDefault
                    ? 'No active filters. Showing all funding records.'
                    : 'Active filters applied. Results and totals reflect selected filters.'}
                </p>
              </div>
              <p className="text-xs text-gray-500">{fundingHistoryItems.length} record{fundingHistoryItems.length === 1 ? '' : 's'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select
              value={fundingBranchFilter}
              onChange={(event) => setFundingBranchFilter(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="all">All Branches</option>
              {branches.map((branch) =>
              <option key={branch.id} value={branch.id}>{branch.name}</option>
              )}
            </select>
            <select
              value={fundingStatusFilter}
              onChange={(event) => setFundingStatusFilter(event.target.value as typeof fundingStatusFilter)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="all">All Statuses</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <input
              type="date"
              value={fundingFromDate}
              onChange={(event) => setFundingFromDate(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="date"
              value={fundingToDate}
              onChange={(event) => setFundingToDate(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={exportFundingHistoryCsv}
              className="px-3 py-2 border border-primary text-primary rounded-lg text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
              Export CSV
            </button>
            <button
              onClick={resetFundingFilters}
              disabled={isFundingFiltersDefault}
              title={isFundingFiltersDefault ? 'No active filters' : 'Reset active filters'}
              className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-heading font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
              Reset Filters
            </button>
            </div>
          </div>
          {fundingLoadError && (
            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fundingLoadError}</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Recorded By</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {isLoadingFunding && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      Loading funding history...
                    </td>
                  </tr>
                )}
                {!isLoadingFunding &&
                fundingHistoryItems.map((item) =>
                <tr
                  key={item.id}
                  onClick={() => setSelectedFunding(item)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-gray-600">{item.fundedAt.split('T')[0]}</td>
                    <td className="px-6 py-4 text-primary font-medium">{item.branchName}</td>
                    <td className="px-6 py-4 font-heading font-bold text-gray-800">{formatFund(item.amount)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={
                          item.status === 'VERIFIED' ? 'Verified' : item.status === 'REJECTED' ? 'Rejected' : 'Pending'
                        }
                      />
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.reference || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <ActorLabel actorId={item.recordedBy} />
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                      {item.status === 'PENDING_VERIFICATION' && (
                        <button
                          onClick={() => void handleNudge(item.id)}
                          className="text-xs font-heading font-bold text-primary hover:text-primary/80">
                          Nudge Manager
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {!isLoadingFunding && fundingHistoryItems.length === 0 &&
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      No funding history found for selected filters.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      {activeView === 'requests' &&
      <div className="space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            Free-form requests a branch's own Manager raised to head office (see "Request to Head Office" on their
            branch dashboard) — respond to close one out.
          </div>

          {branchRequestsLoadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{branchRequestsLoadError}</div>
          )}

          {isLoadingBranchRequests ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading branch requests...</div>
          ) : branchRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
              <p className="text-sm font-heading font-bold text-gray-500">No requests yet</p>
              <p className="text-xs font-body text-gray-400 mt-1">A branch Manager's request to head office will show up here.</p>
            </div>
          ) : (
            branchRequests
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((request) => {
                const branchName = branches.find((b) => b.id === request.branchId)?.name ?? request.branchId;
                return (
                  <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading font-bold text-gray-900">{request.subject}</p>
                          <StatusBadge status={request.status === 'OPEN' ? 'Pending' : 'Completed'} />
                        </div>
                        <p className="text-xs font-body text-gray-400 mt-0.5">
                          {branchName} · Raised by <ActorLabel actorId={request.raisedBy} /> · {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm font-body text-gray-700 mt-2">{request.message}</p>
                        {request.status === 'RESOLVED' && request.resolutionNote && (
                          <p className="text-xs font-body text-green-700 mt-2">
                            Response by <ActorLabel actorId={request.resolvedBy ?? ''} />
                            {request.resolvedAt ? ` · ${new Date(request.resolvedAt).toLocaleDateString()}` : ''}: "{request.resolutionNote}"
                          </p>
                        )}
                      </div>
                      {request.status === 'OPEN' && (
                        <button
                          onClick={() => setResolveTargetRequest(request)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-primary/20 text-primary hover:bg-primary/5 transition-colors flex-shrink-0">
                          Respond
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      }
    </div>);

}
