import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  BuildingIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  WalletIcon,
  UsersIcon,
  BanknoteIcon,
  TrendingUpIcon,
  LandmarkIcon,
  PlusIcon,
  PencilIcon,
  CheckCircleIcon,
  StarIcon,
  ClockIcon,
  HashIcon,
  Trash2Icon,
  XCircleIcon,
  CircleXIcon } from
'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import {
  BranchData,
  BankAccount,
  FundingRecord,
  EditBranchModal,
  FundBranchModal,
  AddBankAccountModal,
  type AddBankAccountFormValues } from
'./BranchModals';
import { branchesService } from '../../services/branches/branches.service';
import type { BranchManagerAssignment } from '../../services/branches/branches.types';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.types';
import { useRoleAssignmentApprovals } from '../../hooks/useRoleAssignmentApprovals';
import { RoleAssignmentApprovalsPanel } from '../../components/RoleAssignmentApprovalsPanel';
import {
  branchBankAccountsService,
  type BranchBankAccount as RealBranchBankAccount,
} from '../../services/branch-bank-accounts/branch-bank-accounts.service';
import { branchFundingService, type BranchFunding } from '../../services/branch-funding/branch-funding.service';
import { staffService, type Staff } from '../../services/staff/staff.service';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import type { BranchManagerLookup } from '../../store/slices/lookupsSlice';
import { STAFF_ROLE_LABEL, STAFF_STATUS_LABEL } from '../../constants/identity-options';
import { buildFrontendStaffId, toTitleCase } from '../../utils/staff-display';

function formatFund(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

function toBankAccount(raw: RealBranchBankAccount): BankAccount {
  return {
    id: raw.id,
    bankName: raw.bankName,
    accountNumber: raw.accountNumber,
    accountName: raw.accountName,
    isCurrent: raw.active,
    dateAdded: raw.createdAt.split('T')[0],
  };
}

function toFundingRecord(raw: BranchFunding): FundingRecord {
  return {
    id: raw.id,
    amount: formatFund(raw.amount / 100),
    date: raw.fundedAt.split('T')[0],
    reference: raw.reference ?? '-',
    allocatedBy: raw.recordedBy,
    note:
      raw.status === 'VERIFIED'
        ? 'Verified'
        : raw.status === 'REJECTED'
          ? `Rejected${raw.rejectionReason ? `: ${raw.rejectionReason}` : ''}`
          : 'Pending verification',
  };
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

interface ManagerRecordRow {
  id: string;
  managerName: string;
  assignedByName: string;
  approvedByName: string;
  startDate: string;
  endDate: string | null;
  comments: string | null;
}

/**
 * `getManagerHistory` already comes back current-manager-first (sorted by
 * startDate desc on the backend), which is exactly what "the current
 * manager is always the one at the top" needs — no extra client-side sort.
 * Names are resolved client-side same as everywhere else on this page;
 * `resolveManagerName` isn't manager-specific despite its name — it's just
 * "look the id up in the branchManagers cache, else fetch the staff
 * record" — so it works fine for assignedBy/approvedBy too, even though
 * those are frequently Admin/SuperAdmin/Approver staff, not Managers.
 */
async function loadManagerRecords(
  branchId: string,
  managers: BranchManagerLookup[],
): Promise<ManagerRecordRow[]> {
  const history: BranchManagerAssignment[] = await branchesService
    .getManagerHistory(branchId)
    .catch(() => []);

  return Promise.all(
    history.map(async (entry) => {
      const [managerName, assignedByName, approvedByName] = await Promise.all([
        resolveManagerName(entry.staffId, managers),
        resolveManagerName(entry.assignedBy, managers),
        resolveManagerName(entry.approvedBy, managers),
      ]);
      return {
        id: entry.id,
        managerName,
        assignedByName,
        approvedByName,
        startDate: entry.startDate.split('T')[0],
        endDate: entry.endDate ? entry.endDate.split('T')[0] : null,
        comments: entry.comments,
      };
    }),
  );
}

const BRANCH_MANAGER_ASSIGNMENT_ENTITY_TYPE = 'BRANCH_MANAGER_ASSIGNMENT';

interface ManagerProposalRow {
  requestId: string;
  managerName: string;
  proposedByName: string;
  proposedAt: string;
  comments: string | null;
  isOwnProposal: boolean;
  rejectedByName: string | null;
  rejectedAt: string | null;
  rejectionComment: string | null;
}

/**
 * Pending/Rejected BRANCH_MANAGER_ASSIGNMENT proposals for this branch —
 * `getPendingByEntityType`/`getRejectedByEntityType` are global (every
 * branch's proposals), so filtered down to this one via `entry.branchId`.
 * One `getById` per entry to reach the payload (`{ staffId, comments }` —
 * see BranchManagerAssignmentService.initiateAssignment) — same N+1-but-small
 * pattern as HrManager.tsx/LoanProductsCrud.tsx/FeeConfiguration.tsx's own
 * Pending/Rejected tabs.
 */
async function buildManagerProposalRows(
  requests: WorkflowRequestSummary[],
  managers: BranchManagerLookup[],
  currentUserId: string | undefined,
): Promise<ManagerProposalRow[]> {
  return Promise.all(
    requests.map(async (entry) => {
      const detail = await workflowRequestsService.getById(entry.id).catch(() => null);
      const payload = (detail?.payload ?? {}) as Record<string, unknown>;
      const staffId = typeof payload.staffId === 'string' ? payload.staffId : undefined;
      const comments = typeof payload.comments === 'string' ? payload.comments : null;
      const managerName = await resolveManagerName(staffId, managers);
      const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');

      return {
        requestId: entry.id,
        managerName,
        proposedByName: entry.initiatedByName ?? entry.initiatedBy,
        proposedAt: entry.createdAt,
        comments,
        isOwnProposal: Boolean(currentUserId) && currentUserId === entry.initiatedBy,
        rejectedByName: rejectionStep?.actedByName ?? rejectionStep?.actedBy ?? null,
        rejectedAt: rejectionStep?.actedAt ?? null,
        rejectionComment: rejectionStep?.comment ?? null,
      };
    }),
  );
}

/**
 * The one real source of truth for this page — replaces the old
 * `/admin/branches/:id`-guessing mappers entirely. Real Branch has no
 * phone/email/totalDisbursed/repaymentRate of its own (see the backend's
 * Branch schema) — left honestly blank/placeholder rather than fabricated,
 * same as BranchManagement.tsx's own mapper.
 */
async function loadBranchDetail(
  id: string,
  managers: BranchManagerLookup[],
): Promise<{ data: BranchData; rawBankAccounts: RealBranchBankAccount[] }> {
  const [branch, manager, stats, balance, bankAccounts, fundingHistory] = await Promise.all([
    branchesService.getById(id),
    branchesService.getCurrentManager(id).catch(() => null),
    branchesService.getStats(id).catch(() => ({ branchId: id, staffCount: 0, activeLoansCount: 0 })),
    branchesService.getBalance(id).catch(() => ({ branchId: id, availableAmount: 0 })),
    branchBankAccountsService.list(id).catch(() => []),
    branchFundingService.list(id).catch(() => []),
  ]);
  const managerName = await resolveManagerName(manager?.staffId, managers);

  return {
    data: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address ?? '',
      managerId: manager?.staffId,
      location: branch.address || '—',
      manager: managerName,
      staff: stats.staffCount,
      fund: formatFund(balance.availableAmount / 100),
      activeLoans: stats.activeLoansCount,
      status: branch.active ? 'Active' : 'Inactive',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      dateCreated: branch.createdAt ? branch.createdAt.split('T')[0] : '',
      totalDisbursed: '—',
      repaymentRate: '—',
      bankAccounts: bankAccounts.map(toBankAccount),
      fundingHistory: fundingHistory
        .slice()
        .sort((a, b) => new Date(b.fundedAt).getTime() - new Date(a.fundedAt).getTime())
        .map(toFundingRecord),
    },
    rawBankAccounts: bankAccounts,
  };
}
type TabKey = 'overview' | 'bank-accounts' | 'funding-history' | 'manager-records' | 'role-assignments' | 'staff-directory';
const tabs: {
  key: TabKey;
  label: string;
}[] = [
{
  key: 'overview',
  label: 'Overview'
},
{
  key: 'bank-accounts',
  label: 'Bank Accounts'
},
{
  key: 'funding-history',
  label: 'Funding History'
},
{
  key: 'manager-records',
  label: 'Manager Records'
},
{
  key: 'role-assignments',
  label: 'Role Assignments'
},
{
  key: 'staff-directory',
  label: 'Staff Directory'
}];

function InfoItem({
  icon,
  label,
  value




}: {icon: React.ReactNode;label: string;value: string;}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs font-body text-gray-400">{label}</p>
        <p className="text-sm font-body font-medium text-gray-800">
          {value || '—'}
        </p>
      </div>
    </div>);

}
function MetricCard({
  label,
  value,
  icon,
  color





}: {label: string;value: string;icon: React.ReactNode;color: string;}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-xs font-body text-gray-400">{label}</p>
        <p className="text-xl font-heading font-bold text-gray-900">{value}</p>
      </div>
    </div>);

}
export function BranchDetail() {
  const { id } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const branchManagers = useAppSelector((state) => state.lookups.branchManagers);
  // See BranchManagement.tsx's own comment — Approver can view/approve/
  // delete a branch but lacks org:manage/branch:fund.
  const isApprover = user?.role === 'approver';
  // No fabricated seed data here anymore — starts null (a loading state)
  // until the real fetch below resolves.
  const [branch, setBranch] = useState<BranchData | null>(null);
  const [rawBankAccounts, setRawBankAccounts] = useState<RealBranchBankAccount[]>([]);
  const [managerRecords, setManagerRecords] = useState<ManagerRecordRow[]>([]);
  const [managerRecordsLoading, setManagerRecordsLoading] = useState(false);
  // Manager Records has its own Pending/Approved/Rejected sub-tabs — a
  // proposed assignment (BRANCH_MANAGER_ASSIGNMENT is a real maker-checker
  // workflow now, see BranchManagerAssignmentService) is otherwise invisible
  // anywhere on this page until approved.
  const [managerRecordsView, setManagerRecordsView] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [managerPendingRows, setManagerPendingRows] = useState<ManagerProposalRow[]>([]);
  const [isLoadingManagerPending, setIsLoadingManagerPending] = useState(false);
  const [managerRejectedRows, setManagerRejectedRows] = useState<ManagerProposalRow[]>([]);
  const [isLoadingManagerRejected, setIsLoadingManagerRejected] = useState(false);
  const [actingManagerRequestId, setActingManagerRequestId] = useState<string | null>(null);
  // A reason is required server-side to reject — captured via a modal
  // rather than acting immediately on click.
  const [managerRejectTargetId, setManagerRejectTargetId] = useState<string | null>(null);
  // Maker withdrawing their own still-pending proposal — same "single-step
  // chain sits at PENDING_APPROVAL immediately" reasoning as every other
  // withdraw button in this app (see workflowRequestsService.cancel's own
  // doc comment).
  const [managerWithdrawTargetId, setManagerWithdrawTargetId] = useState<string | null>(null);
  const [isWithdrawingManagerRequest, setIsWithdrawingManagerRequest] = useState(false);
  const [managerDeleteTargetId, setManagerDeleteTargetId] = useState<string | null>(null);
  const [isDeletingManagerRequest, setIsDeletingManagerRequest] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState<Staff[]>([]);
  const [staffDirectoryLoading, setStaffDirectoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  // Modal states
  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<
    'activate' | 'deactivate' | null>(
    null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Toast
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({
    message: '',
    visible: false
  });
  function showToast(message: string) {
    setToast({
      message,
      visible: true
    });
    setTimeout(
      () =>
      setToast((t) => ({
        ...t,
        visible: false
      })),
      3000
    );
  }

  const refreshManagerRecords = async () => {
    if (!id) {
      setManagerRecords([]);
      return;
    }
    setManagerRecordsLoading(true);
    try {
      setManagerRecords(await loadManagerRecords(id, branchManagers));
    } finally {
      setManagerRecordsLoading(false);
    }
  };

  const refreshManagerPending = async () => {
    if (!id) {
      setManagerPendingRows([]);
      return;
    }
    setIsLoadingManagerPending(true);
    try {
      const all = await workflowRequestsService.getPendingByEntityType(BRANCH_MANAGER_ASSIGNMENT_ENTITY_TYPE);
      const requests = all.filter((entry) => entry.branchId === id);
      setManagerPendingRows(await buildManagerProposalRows(requests, branchManagers, user?.id));
    } catch {
      setManagerPendingRows([]);
    } finally {
      setIsLoadingManagerPending(false);
    }
  };

  const refreshManagerRejected = async () => {
    if (!id) {
      setManagerRejectedRows([]);
      return;
    }
    setIsLoadingManagerRejected(true);
    try {
      const all = await workflowRequestsService.getRejectedByEntityType(BRANCH_MANAGER_ASSIGNMENT_ENTITY_TYPE);
      const requests = all.filter((entry) => entry.branchId === id);
      setManagerRejectedRows(await buildManagerProposalRows(requests, branchManagers, user?.id));
    } catch {
      setManagerRejectedRows([]);
    } finally {
      setIsLoadingManagerRejected(false);
    }
  };

  const refreshStaffDirectory = async () => {
    if (!id) {
      setStaffDirectory([]);
      return;
    }
    setStaffDirectoryLoading(true);
    try {
      setStaffDirectory(await staffService.list(id));
    } catch {
      setStaffDirectory([]);
    } finally {
      setStaffDirectoryLoading(false);
    }
  };

  // BRANCH_ROLE_ASSIGNMENT proposals (Admin/Approver assigned to cover this
  // branch, among possibly others) — separate maker-checker queue from the
  // single-manager BRANCH_MANAGER_ASSIGNMENT one above. See
  // useRoleAssignmentApprovals's own doc comment.
  const roleAssignmentApprovals = useRoleAssignmentApprovals(
    { branchId: id },
    (message) => showToast(message),
    () => void refreshStaffDirectory(),
  );

  const refreshBranch = async () => {
    if (!id) {
      setBranch(null);
      setRawBankAccounts([]);
      return;
    }
    setLoadError(null);
    try {
      const { data, rawBankAccounts: raw } = await loadBranchDetail(id, branchManagers);
      setBranch(data);
      setRawBankAccounts(raw);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load branch');
    }
    // Fire-and-forget — secondary tabs, shouldn't hold up the rest of the page.
    void refreshManagerRecords();
    void refreshManagerPending();
    void refreshManagerRejected();
    void refreshStaffDirectory();
  };

  useEffect(() => {
    if (!id) {
      setBranch(null);
      setRawBankAccounts([]);
      setManagerRecords([]);
      setManagerPendingRows([]);
      setManagerRejectedRows([]);
      setStaffDirectory([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    loadBranchDetail(id, branchManagers)
      .then(({ data, rawBankAccounts: raw }) => {
        if (isMounted) {
          setBranch(data);
          setRawBankAccounts(raw);
        }
      })
      .catch((error) => {
        if (isMounted) setLoadError(error instanceof Error ? error.message : 'Failed to load branch');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    setManagerRecordsLoading(true);
    loadManagerRecords(id, branchManagers)
      .then((rows) => {
        if (isMounted) setManagerRecords(rows);
      })
      .finally(() => {
        if (isMounted) setManagerRecordsLoading(false);
      });

    void refreshManagerPending();
    void refreshManagerRejected();

    setStaffDirectoryLoading(true);
    staffService
      .list(id)
      .then((staff) => {
        if (isMounted) setStaffDirectory(staff);
      })
      .catch(() => {
        if (isMounted) setStaffDirectory([]);
      })
      .finally(() => {
        if (isMounted) setStaffDirectoryLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BuildingIcon size={48} className="text-gray-300 mb-4 animate-pulse" />
        <p className="text-sm font-body text-gray-400">Loading branch...</p>
      </div>);
  }

  if (!branch) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BuildingIcon size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-heading font-bold text-gray-600">
          Branch Not Found
        </h3>
        <p className="text-sm font-body text-gray-400 mt-1">
          {loadError || "The branch you're looking for doesn't exist."}
        </p>
        <button
          onClick={() => navigate('/branches')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors">

          Back to Branches
        </button>
      </div>);

  }
  async function handleEdit(branchId: string, data: Partial<BranchData>) {
    try {
      await branchesService.update(branchId, {
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone || undefined,
        email: data.email || undefined,
        active: data.status === 'Active' ? true : data.status === 'Inactive' ? false : undefined,
      });

      // Workflow-mediated, not immediate — a different Admin/SuperAdmin/
      // Approver still has to approve this before it actually takes effect
      // (see BranchManagerAssignmentService), so the branch keeps showing
      // its current manager (or Unassigned) until then. Messaged separately
      // from the branch-details update above since it's a genuinely
      // different outcome ("saved" vs. "proposed, pending approval").
      let managerProposed = false;
      if (typeof data.managerId === 'string' && data.managerId !== branch?.managerId) {
        await branchesService.assignManager(branchId, { staffId: data.managerId });
        managerProposed = true;
      }

      await refreshBranch();
      showToast(
        managerProposed
          ? 'Branch details updated. Manager assignment proposed — awaiting a second approver.'
          : 'Branch details updated successfully',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update branch');
    }
  }
  async function handleFund(branchId: string, bankAccountId: string, amountKobo: number, fundedAt: string, reference: string) {
    try {
      await branchFundingService.record({
        branchId,
        bankAccountId,
        amount: amountKobo,
        fundedAt,
        reference: reference || undefined,
      });
      await refreshBranch();
      showToast(`₦${(amountKobo / 100).toLocaleString()} recorded — awaiting the branch manager's verification`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record funding');
    }
  }
  async function handleAddBankAccount(data: AddBankAccountFormValues) {
    if (!branch) {
      return;
    }

    try {
      await branchBankAccountsService.create({
        branchId: branch.id,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        purpose: data.purpose,
        active: data.isCurrent,
      });
      await refreshBranch();
      showToast('Bank account added successfully');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add bank account');
    }
  }
  async function handleSetCurrent(accountId: string) {
    try {
      // Deactivates whichever other account for this branch currently holds
      // that spot — see BranchBankAccountsService.update's own doc comment.
      await branchBankAccountsService.update(accountId, { active: true });
      await refreshBranch();
      showToast('Active bank account updated');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update active bank account');
    }
  }
  async function handleStatusChange() {
    const newStatus = statusModal === 'activate' ? 'Active' : 'Inactive';
    if (!branch) {
      setStatusModal(null);
      return;
    }
    try {
      await branchesService.update(branch.id, { active: newStatus === 'Active' });
      await refreshBranch();
      showToast(`Branch ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to change branch status');
    }
    setStatusModal(null);
  }
  /** Super Admin/Admin/Approver only — hard-delete. Only possible while the branch is inactive and nothing still references it. */
  async function handleDelete() {
    if (!branch) return;
    setDeleting(true);
    try {
      await branchesService.remove(branch.id);
      showToast(`Branch "${branch.name}" deleted`);
      navigate('/branches');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete branch');
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleManagerWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingManagerRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      // Approving changes the branch's actual current manager — refreshBranch
      // also re-triggers the Approved/Staff Directory sub-tabs, not just the
      // headline "Manager" field.
      await Promise.all([refreshBranch(), refreshManagerPending(), refreshManagerRejected()]);
      if (action === 'APPROVED') {
        setManagerRecordsView('approved');
        showToast('Manager assignment approved');
      } else {
        setManagerRecordsView('rejected');
        showToast('Manager assignment rejected');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to act on this request');
    } finally {
      setActingManagerRequestId(null);
    }
  }

  function confirmManagerReject(comment?: string) {
    if (!managerRejectTargetId || !comment?.trim()) return;
    void handleManagerWorkflowAction(managerRejectTargetId, 'REJECTED', comment.trim());
    setManagerRejectTargetId(null);
  }

  async function handleWithdrawManagerRequest() {
    if (!managerWithdrawTargetId) return;
    setIsWithdrawingManagerRequest(true);
    try {
      await workflowRequestsService.cancel(managerWithdrawTargetId);
      showToast('Proposal withdrawn');
      setManagerWithdrawTargetId(null);
      await refreshManagerPending();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to withdraw this proposal');
    } finally {
      setIsWithdrawingManagerRequest(false);
    }
  }

  async function handleDeleteManagerRequest() {
    if (!managerDeleteTargetId) return;
    setIsDeletingManagerRequest(true);
    try {
      await workflowRequestsService.deleteRequest(managerDeleteTargetId);
      showToast('Rejected proposal deleted');
      setManagerDeleteTargetId(null);
      await refreshManagerRejected();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete this proposal');
    } finally {
      setIsDeletingManagerRequest(false);
    }
  }

  const currentAccount = branch.bankAccounts.find((a) => a.isCurrent);
  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast.visible &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: '-50%'
          }}
          exit={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body">
          
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Modals */}
      <EditBranchModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        branch={branch}
        onSubmit={handleEdit} />
      
      <FundBranchModal
        isOpen={fundOpen}
        onClose={() => setFundOpen(false)}
        branch={branch}
        activeBankAccount={rawBankAccounts.find((account) => account.active) ?? null}
        onSubmit={handleFund} />
      
      <AddBankAccountModal
        isOpen={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        branchName={branch.name}
        onSubmit={handleAddBankAccount} />
      
      <ConfirmationModal
      description=''
        isOpen={statusModal !== null}
        onClose={() => setStatusModal(null)}
        onConfirm={handleStatusChange}
        title={
        statusModal === 'activate' ? 'Activate Branch' : 'Deactivate Branch'
        }
        confirmLabel={statusModal === 'activate' ? 'Activate' : 'Deactivate'}
        />

      <ConfirmationModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title={`Delete "${branch.name}"?`}
        description="This permanently removes the branch and its bank accounts/fund balance. This cannot be undone. Only possible while the branch is inactive and nothing (staff, customers, groups, loans) still references it."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        />

      <ConfirmationModal
        isOpen={managerRejectTargetId !== null}
        onClose={() => setManagerRejectTargetId(null)}
        onConfirm={(reason) => confirmManagerReject(reason)}
        title="Reject this manager assignment?"
        description="A reason is required — the person who proposed it will see it."
        icon={<XCircleIcon size={20} className="text-red-600" />}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. This staff member is needed at their current branch"
        requireInput
        />

      <ConfirmationModal
        isOpen={managerWithdrawTargetId !== null}
        onClose={() => setManagerWithdrawTargetId(null)}
        onConfirm={() => void handleWithdrawManagerRequest()}
        title="Withdraw this proposal?"
        description="This removes it from the approval queue — nothing was ever assigned, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isWithdrawingManagerRequest ? 'Withdrawing…' : 'Withdraw'}
        confirmVariant="danger"
        />

      <ConfirmationModal
        isOpen={managerDeleteTargetId !== null}
        onClose={() => setManagerDeleteTargetId(null)}
        onConfirm={() => void handleDeleteManagerRequest()}
        title="Delete this rejected proposal?"
        description="This permanently removes the request — it cannot be undone."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeletingManagerRequest ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        />


      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/branches')}
          className="flex items-center gap-1.5 text-sm font-body text-gray-500 hover:text-primary transition-colors w-fit">
          
          <ArrowLeftIcon size={16} />
          Back to Branches
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BuildingIcon size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-heading font-bold text-gray-900">
                  {branch.name}
                </h1>
                <StatusBadge status={branch.status as any} />
              </div>
              <p className="text-sm font-body text-gray-500 mt-0.5">{branch.location}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isApprover &&
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-heading font-bold text-gray-600 hover:bg-gray-50 transition-colors">

                <PencilIcon size={14} />
                Edit
              </button>
            }
            {!isApprover && branch.manager === 'Unassigned' &&
            // Opens the same Edit modal (its Branch Manager field already
            // does the real work — see handleEdit's assignManager call
            // below) rather than a separate one-field modal — same data,
            // same validation (a manager already assigned elsewhere is
            // excluded), no second implementation to keep in sync.
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-heading font-bold hover:bg-amber-600 transition-colors">

                <UserIcon size={14} />
                Assign Manager
              </button>
            }
            {!isApprover &&
            <button
              onClick={() => setFundOpen(true)}
              disabled={branch.manager === 'Unassigned'}
              title={branch.manager === 'Unassigned' ? 'Assign a manager to this branch before it can be funded' : undefined}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-200">

                <WalletIcon size={14} />
                Fund Branch
              </button>
            }
            {!isApprover && (branch.status === 'Active' ?
            <button
              onClick={() => setStatusModal('deactivate')}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-heading font-bold hover:bg-red-50 transition-colors">

                Deactivate
              </button> :

            <button
              onClick={() => setStatusModal('activate')}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-heading font-bold hover:bg-green-700 transition-colors">

                Activate
              </button>
            )}
            {branch.status !== 'Active' &&
            <button
              onClick={() => setDeleteOpen(true)}
              title="Only a deactivated branch with nothing still referencing it can be deleted"
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-heading font-bold hover:bg-red-50 transition-colors">

                <Trash2Icon size={14} />
                Delete
              </button>
            }
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Branch detail tabs">
          {tabs.map((tab) =>
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 text-sm font-heading font-bold transition-colors relative ${activeTab === tab.key ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
            
              {tab.label}
              {tab.key === 'bank-accounts' &&
            branch.bankAccounts.length > 0 &&
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {branch.bankAccounts.length}
                  </span>
            }
              {tab.key === 'funding-history' &&
            branch.fundingHistory.length > 0 &&
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {branch.fundingHistory.length}
                  </span>
            }
              {tab.key === 'manager-records' && managerPendingRows.length > 0 &&
            <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {managerPendingRows.length} pending
                  </span>
            }
              {tab.key === 'manager-records' &&
            managerPendingRows.length === 0 &&
            managerRecords.length > 0 &&
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {managerRecords.length}
                  </span>
            }
              {tab.key === 'role-assignments' && roleAssignmentApprovals.pendingRows.length > 0 &&
            <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {roleAssignmentApprovals.pendingRows.length} pending
                  </span>
            }
              {tab.key === 'staff-directory' &&
            staffDirectory.length > 0 &&
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {staffDirectory.length}
                  </span>
            }
              {activeTab === tab.key &&
            <motion.div
              layoutId="branch-tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />

            }
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' &&
        <motion.div
          key="overview"
          initial={{
            opacity: 0,
            y: 8
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -8
          }}
          transition={{
            duration: 0.2
          }}
          className="space-y-6">
          
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
              label="Fund Balance"
              value={branch.fund}
              icon={<WalletIcon size={22} className="text-indigo-600" />}
              color="bg-indigo-50" />
            
              <MetricCard
              label="Active Loans"
              value={String(branch.activeLoans)}
              icon={<BanknoteIcon size={22} className="text-green-600" />}
              color="bg-green-50" />
            
              <MetricCard
              label="Total Disbursed"
              value={branch.totalDisbursed}
              icon={<TrendingUpIcon size={22} className="text-blue-600" />}
              color="bg-blue-50" />
            
              <MetricCard
              label="Repayment Rate"
              value={branch.repaymentRate}
              icon={
              <CheckCircleIcon size={22} className="text-emerald-600" />
              }
              color="bg-emerald-50" />
            
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Branch Information */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-base font-heading font-bold text-gray-900 mb-5">
                  Branch Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InfoItem
                  icon={<BuildingIcon size={16} />}
                  label="Branch Name"
                  value={branch.name} />
                
                  <InfoItem
                  icon={<MapPinIcon size={16} />}
                  label="Location"
                  value={branch.location} />
                
                  <InfoItem
                  icon={<UserIcon size={16} />}
                  label="Branch Manager"
                  value={branch.manager} />
                
                  <InfoItem
                  icon={<UsersIcon size={16} />}
                  label="Staff Count"
                  value={String(branch.staff)} />
                
                  <InfoItem
                  icon={<PhoneIcon size={16} />}
                  label="Phone"
                  value={branch.phone} />
                
                  <InfoItem
                  icon={<MailIcon size={16} />}
                  label="Email"
                  value={branch.email} />
                
                  <InfoItem
                  icon={<CalendarIcon size={16} />}
                  label="Date Created"
                  value={branch.dateCreated} />
                
                  <InfoItem
                  icon={<HashIcon size={16} />}
                  label="Branch ID"
                  value={branch.code || branch.id} />

                </div>
              </div>

              {/* Current Bank Account */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-heading font-bold text-gray-900">
                    Current Bank Account
                  </h3>
                  <LandmarkIcon size={18} className="text-gray-400" />
                </div>
                {currentAccount ?
              <div className="space-y-4">
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <p className="text-xs font-body text-gray-400 mb-1">
                        Bank
                      </p>
                      <p className="text-sm font-heading font-bold text-gray-900">
                        {currentAccount.bankName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-body text-gray-400 mb-1">
                        Account Number
                      </p>
                      <p className="text-lg font-heading font-bold text-primary tracking-wider">
                        {currentAccount.accountNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-body text-gray-400 mb-1">
                        Account Name
                      </p>
                      <p className="text-sm font-body font-medium text-gray-800">
                        {currentAccount.accountName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-body text-gray-400 mb-1">
                        Added On
                      </p>
                      <p className="text-sm font-body text-gray-600">
                        {currentAccount.dateAdded}
                      </p>
                    </div>
                  </div> :

              <div className="text-center py-8">
                    <LandmarkIcon
                  size={32}
                  className="text-gray-200 mx-auto mb-3" />
                
                    <p className="text-sm font-body text-gray-400">
                      No bank account configured
                    </p>
                    <button
                  onClick={() => setAddAccountOpen(true)}
                  className="mt-3 text-sm font-heading font-bold text-primary hover:text-accent transition-colors">
                  
                      + Add Bank Account
                    </button>
                  </div>
              }
              </div>
            </div>

            {/* Recent Funding */}
            {branch.fundingHistory.length > 0 &&
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-heading font-bold text-gray-900">
                    Recent Funding
                  </h3>
                  <button
                onClick={() => setActiveTab('funding-history')}
                className="text-sm font-heading font-bold text-primary hover:text-accent transition-colors">
                
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {branch.fundingHistory.slice(0, 3).map((record) =>
              <div
                key={record.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                          <WalletIcon size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-body font-medium text-gray-800">
                            {record.amount}
                          </p>
                          <p className="text-xs font-body text-gray-400">
                            {record.note}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-body text-gray-500">
                          {record.date}
                        </p>
                        <p className="text-xs font-body text-gray-400">
                          {record.reference}
                        </p>
                      </div>
                    </div>
              )}
                </div>
              </div>
          }
          </motion.div>
        }

        {activeTab === 'bank-accounts' &&
        <motion.div
          key="bank-accounts"
          initial={{
            opacity: 0,
            y: 8
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -8
          }}
          transition={{
            duration: 0.2
          }}
          className="space-y-4">
          
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-heading font-bold text-gray-900">
                  Bank Accounts
                </h3>
                <p className="text-sm font-body text-gray-500 mt-0.5">
                  {branch.bankAccounts.length} account
                  {branch.bankAccounts.length !== 1 ? 's' : ''} on file
                </p>
              </div>
              <button
              onClick={() => setAddAccountOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors">
              
                <PlusIcon size={14} />
                Add Account
              </button>
            </div>

            {branch.bankAccounts.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <LandmarkIcon
              size={48}
              className="text-gray-200 mx-auto mb-4" />
            
                <h4 className="text-base font-heading font-bold text-gray-600">
                  No Bank Accounts
                </h4>
                <p className="text-sm font-body text-gray-400 mt-1">
                  Add a bank account to start receiving funds.
                </p>
                <button
              onClick={() => setAddAccountOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors">
              
                  Add First Account
                </button>
              </div> :

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branch.bankAccounts.map((account) =>
            <div
              key={account.id}
              className={`bg-white rounded-xl border shadow-sm p-5 relative ${account.isCurrent ? 'border-primary/30 ring-1 ring-primary/10' : 'border-gray-100'}`}>
              
                    {account.isCurrent &&
              <div className="absolute top-4 right-4 flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        <StarIcon size={12} className="fill-primary" />
                        <span className="text-xs font-heading font-bold">
                          Current
                        </span>
                      </div>
              }

                    <div className="flex items-center gap-3 mb-4">
                      <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${account.isCurrent ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  
                        <LandmarkIcon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-heading font-bold text-gray-900">
                          {account.bankName}
                        </p>
                        <p className="text-xs font-body text-gray-400">
                          Added {account.dateAdded}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-4">
                      <div>
                        <p className="text-xs font-body text-gray-400">
                          Account Number
                        </p>
                        <p className="text-base font-heading font-bold text-gray-800 tracking-wider">
                          {account.accountNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-body text-gray-400">
                          Account Name
                        </p>
                        <p className="text-sm font-body font-medium text-gray-700">
                          {account.accountName}
                        </p>
                      </div>
                    </div>

                    {!account.isCurrent &&
              <button
                onClick={() => handleSetCurrent(account.id)}
                className="w-full py-2 border border-primary/20 text-primary rounded-lg text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
                
                        Set as Current
                      </button>
              }
                  </div>
            )}
              </div>
          }
          </motion.div>
        }

        {activeTab === 'funding-history' &&
        <motion.div
          key="funding-history"
          initial={{
            opacity: 0,
            y: 8
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -8
          }}
          transition={{
            duration: 0.2
          }}
          className="space-y-4">
          
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-heading font-bold text-gray-900">
                  Funding History
                </h3>
                <p className="text-sm font-body text-gray-500 mt-0.5">
                  {branch.fundingHistory.length} allocation
                  {branch.fundingHistory.length !== 1 ? 's' : ''} recorded
                </p>
              </div>
              <button
              onClick={() => setFundOpen(true)}
              disabled={branch.manager === 'Unassigned'}
              title={branch.manager === 'Unassigned' ? 'Assign a manager to this branch before it can be funded' : undefined}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-200">

                <WalletIcon size={14} />
                Allocate Funds
              </button>
            </div>

            {branch.fundingHistory.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <WalletIcon size={48} className="text-gray-200 mx-auto mb-4" />
                <h4 className="text-base font-heading font-bold text-gray-600">
                  No Funding Records
                </h4>
                <p className="text-sm font-body text-gray-400 mt-1">
                  No funds have been allocated to this branch yet.
                </p>
                <button
              onClick={() => setFundOpen(true)}
              disabled={branch.manager === 'Unassigned'}
              title={branch.manager === 'Unassigned' ? 'Assign a manager to this branch before it can be funded' : undefined}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-200">

                  Allocate First Fund
                </button>
              </div> :

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Amount</th>
                        <th className="px-6 py-4 font-medium">Reference</th>
                        <th className="px-6 py-4 font-medium">Allocated By</th>
                        <th className="px-6 py-4 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {branch.fundingHistory.map((record) =>
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50/50 transition-colors">
                    
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <ClockIcon size={14} className="text-gray-400" />
                              <span className="font-body text-gray-700">
                                {record.date}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-heading font-bold text-green-700">
                              {record.amount}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {record.reference}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-body text-gray-700">
                            {record.allocatedBy}
                          </td>
                          <td className="px-6 py-4 font-body text-gray-500 max-w-[200px] truncate">
                            {record.note}
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>

                {/* Summary footer */}
                <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
                  <p className="text-sm font-body text-gray-500">
                    Total Allocations:{' '}
                    <span className="font-heading font-bold text-gray-800">
                      {branch.fundingHistory.length}
                    </span>
                  </p>
                  <p className="text-sm font-body text-gray-500">
                    Current Balance:{' '}
                    <span className="font-heading font-bold text-primary">
                      {branch.fund}
                    </span>
                  </p>
                </div>
              </div>
          }
          </motion.div>
        }

        {activeTab === 'manager-records' &&
        <motion.div
          key="manager-records"
          initial={{
            opacity: 0,
            y: 8
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -8
          }}
          transition={{
            duration: 0.2
          }}
          className="space-y-4">

            <div>
              <h3 className="text-base font-heading font-bold text-gray-900">
                Manager Records
              </h3>
              <p className="text-sm font-body text-gray-500 mt-0.5">
                Every manager ever assigned to this branch — the current one is always listed first.
              </p>
            </div>

            <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setManagerRecordsView('pending')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${managerRecordsView === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
                Pending ({managerPendingRows.length})
              </button>
              <button
                onClick={() => setManagerRecordsView('approved')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${managerRecordsView === 'approved' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
                Approved ({managerRecords.length})
              </button>
              <button
                onClick={() => setManagerRecordsView('rejected')}
                className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${managerRecordsView === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
                Rejected ({managerRejectedRows.length})
              </button>
            </div>

            {managerRecordsView === 'pending' ?
          <div className="space-y-3">
                {isLoadingManagerPending && managerPendingRows.length === 0 ?
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                    <ClockIcon size={40} className="text-gray-200 mx-auto mb-3 animate-pulse" />
                    <p className="text-sm font-body text-gray-400">Loading pending requests...</p>
                  </div> :
            managerPendingRows.length === 0 ?
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                    <ClockIcon size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
                    <p className="text-xs font-body text-gray-400 mt-1">A proposed manager assignment will show up here until it's approved or rejected.</p>
                  </div> :

            managerPendingRows.map((row) =>
            <div key={row.requestId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <ClockIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading font-bold text-gray-900">{row.managerName}</p>
                          {row.isOwnProposal &&
                    <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                    }
                        </div>
                        <p className="text-xs font-body text-gray-400 mt-0.5">
                          Proposed by {row.proposedByName} · {new Date(row.proposedAt).toLocaleDateString()}
                        </p>
                        {row.comments &&
                  <p className="text-xs font-body text-gray-500 mt-1 italic">"{row.comments}"</p>
                  }
                      </div>
                    </div>

                    {row.isOwnProposal ?
              <div className="flex items-start gap-2 flex-shrink-0">
                        <p className="text-xs font-body text-gray-400 text-right max-w-[160px]">
                          Awaiting another Admin/SuperAdmin/Approver's review — you can't approve your own proposal.
                        </p>
                        <button
                    disabled={actingManagerRequestId === row.requestId}
                    onClick={() => setManagerWithdrawTargetId(row.requestId)}
                    title="Withdraw this proposal"
                    aria-label="Withdraw this proposal"
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60">
                          <Trash2Icon size={15} />
                        </button>
                      </div> :

              <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                    disabled={actingManagerRequestId === row.requestId}
                    onClick={() => void handleManagerWorkflowAction(row.requestId, 'APPROVED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                          <CheckCircleIcon size={13} /> Approve
                        </button>
                        <button
                    disabled={actingManagerRequestId === row.requestId}
                    onClick={() => setManagerRejectTargetId(row.requestId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
                          <XCircleIcon size={13} /> Reject
                        </button>
                      </div>
              }
                  </div>
            )}
              </div> :

          managerRecordsView === 'rejected' ?
          <div className="space-y-3">
                {isLoadingManagerRejected && managerRejectedRows.length === 0 ?
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                    <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3 animate-pulse" />
                    <p className="text-sm font-body text-gray-400">Loading rejected requests...</p>
                  </div> :
            managerRejectedRows.length === 0 ?
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                    <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-heading font-bold text-gray-500">Nothing rejected</p>
                    <p className="text-xs font-body text-gray-400 mt-1">A rejected manager assignment never takes effect — it shows up here instead of in Approved.</p>
                  </div> :

            managerRejectedRows.map((row) =>
            <div key={row.requestId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                        <CircleXIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-gray-900">{row.managerName}</p>
                        <p className="text-xs font-body text-gray-400 mt-0.5">
                          Proposed by {row.proposedByName} · {new Date(row.proposedAt).toLocaleDateString()}
                        </p>
                        {row.comments &&
                  <p className="text-xs font-body text-gray-500 mt-1 italic">"{row.comments}"</p>
                  }
                        {row.rejectedByName &&
                  <p className="text-xs font-body text-red-600 mt-1.5">
                            Rejected by {row.rejectedByName}
                            {row.rejectedAt ? ` · ${new Date(row.rejectedAt).toLocaleDateString()}` : ''}
                            {row.rejectionComment ? `: "${row.rejectionComment}"` : ''}
                          </p>
                  }
                      </div>
                    </div>
                    {row.isOwnProposal &&
              <button
                onClick={() => setManagerDeleteTargetId(row.requestId)}
                title="Delete this rejected proposal"
                aria-label="Delete this rejected proposal"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                        <Trash2Icon size={15} />
                      </button>
              }
                  </div>
            )}
              </div> :

          managerRecordsLoading && managerRecords.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <UserIcon size={48} className="text-gray-200 mx-auto mb-4 animate-pulse" />
                <p className="text-sm font-body text-gray-400">Loading manager records...</p>
              </div> :
          managerRecords.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <UserIcon size={48} className="text-gray-200 mx-auto mb-4" />
                <h4 className="text-base font-heading font-bold text-gray-600">
                  No Manager Records
                </h4>
                <p className="text-sm font-body text-gray-400 mt-1">
                  No manager has ever been assigned to this branch.
                </p>
              </div> :

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                        <th className="px-6 py-4 font-medium">Name</th>
                        <th className="px-6 py-4 font-medium">Assigned By</th>
                        <th className="px-6 py-4 font-medium">Approved By</th>
                        <th className="px-6 py-4 font-medium">Date Assigned</th>
                        <th className="px-6 py-4 font-medium">Date Replaced</th>
                        <th className="px-6 py-4 font-medium">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {managerRecords.map((record) =>
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50/50 transition-colors">

                          <td className="px-6 py-4 font-body font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              {record.managerName}
                              {record.endDate === null &&
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-heading font-bold">
                                  Current
                                </span>
                        }
                            </div>
                          </td>
                          <td className="px-6 py-4 font-body text-gray-700">
                            {record.assignedByName}
                          </td>
                          <td className="px-6 py-4 font-body text-gray-700">
                            {record.approvedByName}
                          </td>
                          <td className="px-6 py-4 font-body text-gray-500">
                            {record.startDate}
                          </td>
                          <td className="px-6 py-4 font-body text-gray-500">
                            {record.endDate ?? '—'}
                          </td>
                          <td className="px-6 py-4 font-body text-gray-500 max-w-[220px] truncate" title={record.comments ?? undefined}>
                            {record.comments ?? '—'}
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </div>
          }
          </motion.div>
        }

        {activeTab === 'role-assignments' &&
        <motion.div
          key="role-assignments"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-4">

            <div>
              <h3 className="text-base font-heading font-bold text-gray-900">
                Role Assignments
              </h3>
              <p className="text-sm font-body text-gray-500 mt-0.5">
                Admins/Approvers proposed to cover this branch — approving here activates their coverage and notifies them.
              </p>
            </div>

            <RoleAssignmentApprovalsPanel state={roleAssignmentApprovals} />
          </motion.div>
        }

        {activeTab === 'staff-directory' &&
        <motion.div
          key="staff-directory"
          initial={{
            opacity: 0,
            y: 8
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -8
          }}
          transition={{
            duration: 0.2
          }}
          className="space-y-4">

            <div>
              <h3 className="text-base font-heading font-bold text-gray-900">
                Staff Directory
              </h3>
              <p className="text-sm font-body text-gray-500 mt-0.5">
                Every staff member currently assigned to this branch.
              </p>
            </div>

            {staffDirectoryLoading && staffDirectory.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <UsersIcon size={48} className="text-gray-200 mx-auto mb-4 animate-pulse" />
                <p className="text-sm font-body text-gray-400">Loading staff directory...</p>
              </div> :
          staffDirectory.length === 0 ?
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <UsersIcon size={48} className="text-gray-200 mx-auto mb-4" />
                <h4 className="text-base font-heading font-bold text-gray-600">
                  No Staff Assigned
                </h4>
                <p className="text-sm font-body text-gray-400 mt-1">
                  No staff member is currently assigned to this branch.
                </p>
              </div> :

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                        <th className="px-6 py-4 font-medium">Employee</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium">User Type</th>
                        <th className="px-6 py-4 font-medium">Email</th>
                        <th className="px-6 py-4 font-medium">Phone</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {staffDirectory.map((staff) =>
                  <tr
                    key={staff.id}
                    onClick={() => navigate(`/staff-management/${staff.id}`)}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer">

                          <td className="px-6 py-4">
                            <p className="font-heading font-medium text-primary">
                              {toTitleCase(`${staff.firstName} ${staff.lastName}`.trim()) || 'Unknown Staff'}
                            </p>
                            <p className="text-xs text-gray-400">{buildFrontendStaffId(staff.id)}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {STAFF_ROLE_LABEL[staff.role] ?? staff.role}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{staff.userType}</td>
                          <td className="px-6 py-4 text-gray-600">{staff.email}</td>
                          <td className="px-6 py-4 text-gray-600">{staff.phoneNumber}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={(STAFF_STATUS_LABEL[staff.status] ?? staff.status) as any} />
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </div>
          }
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}