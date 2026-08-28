import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, FilterIcon, MoreVerticalIcon, Loader2Icon, CheckCircleIcon, XCircleIcon, CornerDownLeftIcon } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { repaymentsService, type RepaymentListItem, type RepaymentStatus } from '../../services/repayments/repayments.service';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';

type StatusBadgeValue = ComponentProps<typeof StatusBadge>['status'];

const STATUS_BADGE: Record<RepaymentStatus, StatusBadgeValue> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  UNDER_DISPUTE: 'Pending Review',
  REJECTED: 'Rejected',
};

const STATUS_FILTER_OPTIONS: { value: 'all' | RepaymentStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'UNDER_DISPUTE', label: 'Under Dispute' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CHANNEL_LABEL: Record<RepaymentListItem['channel'], string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  BANK_DEPOSIT: 'Bank Deposit',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

export function LoanRepayment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RepaymentStatus>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [repayments, setRepayments] = useState<RepaymentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewingRepayment, setViewingRepayment] = useState<RepaymentListItem | null>(null);
  const [repaymentActionModal, setRepaymentActionModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [isActingOnRepayment, setIsActingOnRepayment] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const isAdminTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';

  async function loadRepayments() {
    setIsLoading(true);
    try {
      const items = await repaymentsService.list(isAdminTier && branchFilter ? { branchId: branchFilter } : undefined);
      setRepayments(items);
      setLoadError(null);
    } catch (error) {
      setRepayments([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load repayments');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRepayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminTier, branchFilter]);

  // Same maker-never-checks-own-work shape as LoanDetail.tsx's
  // canActOnCurrentStep/canActOnRepayment — REPAYMENT_RECORD is always a
  // fixed 2-step review-then-approve chain, so pendingWorkflowStatus alone
  // (no per-step array here) is enough to tell which role's turn it is.
  const isOwnRepaymentSubmission = Boolean(user && viewingRepayment && user.id === viewingRepayment.recordedBy);
  const canActOnRepayment =
    Boolean(viewingRepayment?.pendingWorkflowRequestId) &&
    !isOwnRepaymentSubmission &&
    ((viewingRepayment?.pendingWorkflowStatus === 'PENDING_REVIEW' && user?.role === 'manager') ||
      (viewingRepayment?.pendingWorkflowStatus === 'PENDING_APPROVAL' &&
        (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver')));

  async function handleRepaymentWorkflowAction(action: 'APPROVED' | 'REJECTED' | 'RETURNED', comment?: string) {
    setRepaymentActionModal(null);
    if (!viewingRepayment?.pendingWorkflowRequestId) return;
    try {
      setIsActingOnRepayment(true);
      await workflowRequestsService.act(viewingRepayment.pendingWorkflowRequestId, { action, comment });
      setViewingRepayment(null);
      await loadRepayments();
      showToast(
        action === 'APPROVED' ? 'Repayment step approved' : action === 'REJECTED' ? 'Repayment rejected' : 'Returned to maker',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsActingOnRepayment(false);
    }
  }

  const branchName = useMemo(
    () => (id: string) => branches.find((b) => b.id === id)?.name ?? '—',
    [branches],
  );

  const filteredRepayments = repayments.filter((r) => {
    const matchesSearch =
      !searchQuery.trim() ||
      [r.groupName, r.customerName, r.transactionReference].some((field) =>
        field.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {toast.visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body">
          <CheckCircleIcon size={16} />
          {toast.message}
        </div>
      )}

      <ConfirmationModal
        isOpen={repaymentActionModal === 'approve'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('APPROVED', val)}
        title="Approve this repayment"
        description="Move this repayment forward to the next step in its review chain (or apply it to the borrower's balance, if this is the last step)."
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Approve"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Comment (optional)"
      />
      <ConfirmationModal
        isOpen={repaymentActionModal === 'reject'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('REJECTED', val)}
        title="Reject this repayment"
        description="Rejecting leaves the borrower's balance unaffected — this repayment is never applied. This cannot be undone."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Repayment"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        requireInput
      />
      <ConfirmationModal
        isOpen={repaymentActionModal === 'return'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('RETURNED', val)}
        title="Return to maker"
        description="Send this repayment back to the beginning of its review chain for whoever recorded it to address, rather than approving or rejecting outright."
        icon={<div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600"><CornerDownLeftIcon size={20} /></div>}
        confirmLabel="Return"
        confirmVariant="orange"
        inputType="textarea"
        inputLabel="What needs to change"
        requireInput
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-heading font-bold text-primary">Loan Repayments</h2>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {isAdminTier && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
            >
              <FilterIcon size={16} className="mr-2" /> Filter
              {statusFilter !== 'all' && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-48">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${statusFilter === option.value ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-4 font-medium">Borrower</th>
                <th className="px-6 py-4 font-medium">Group</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Channel</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Payment Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRepayments.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setViewingRepayment(r)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-heading font-medium text-primary">{r.customerName}</td>
                  <td className="px-6 py-4 text-gray-700">{r.groupName}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">{formatNaira(r.amountKobo)}</td>
                  <td className="px-6 py-4 text-gray-600">{CHANNEL_LABEL[r.channel]}</td>
                  <td className="px-6 py-4 text-gray-600">{r.branchName ?? branchName(r.branchId)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDisplayDate(r.paymentDate)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={STATUS_BADGE[r.status]} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingRepayment(r);
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreVerticalIcon size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !loadError && filteredRepayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    No repayments match your search.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon size={16} className="animate-spin" /> Loading repayments...
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && loadError && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500 text-sm font-body">
                    {loadError}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden (not unmounted — viewingRepayment itself stays set) while a
          repaymentActionModal confirmation dialog is open: both are
          position:fixed at the same z-index, so with this modal still in
          the DOM afterward in JSX order it would otherwise paint on top of
          and swallow every click meant for the confirmation dialog behind
          it — this is what "Approve"/"Reject" appeared to silently do
          nothing. Clearing repaymentActionModal (Cancel/X) brings this
          panel straight back since viewingRepayment was never nulled. */}
      {viewingRepayment && !repaymentActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewingRepayment(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-heading font-bold text-gray-900 mb-4">Repayment Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Borrower</span><span className="font-medium text-gray-800">{viewingRepayment.customerName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Group</span><span className="font-medium text-gray-800">{viewingRepayment.groupName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-gray-800">{formatNaira(viewingRepayment.amountKobo)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Channel</span><span className="font-medium text-gray-800">{CHANNEL_LABEL[viewingRepayment.channel]}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Branch</span><span className="font-medium text-gray-800">{viewingRepayment.branchName ?? branchName(viewingRepayment.branchId)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Transaction Reference</span><span className="font-medium text-gray-800 font-mono text-xs">{viewingRepayment.transactionReference}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment Date</span><span className="font-medium text-gray-800">{formatDisplayDate(viewingRepayment.paymentDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Recorded By</span><span className="font-medium text-gray-800">{viewingRepayment.recordedByName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={STATUS_BADGE[viewingRepayment.status]} /></div>
            </div>
            {viewingRepayment.pendingWorkflowRequestId && isOwnRepaymentSubmission && (
              <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                You recorded this repayment — a different reviewer/approver must act on it.
              </p>
            )}
            {viewingRepayment.pendingWorkflowRequestId && !isOwnRepaymentSubmission && !canActOnRepayment && (
              <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Awaiting {viewingRepayment.pendingWorkflowStatus === 'PENDING_REVIEW' ? "a Manager's review" : "an Admin/Approver's approval"}.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button
                onClick={() => navigate(`/loan-manager/loans/${viewingRepayment.loanId}`)}
                disabled={isActingOnRepayment}
                className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60"
              >
                View Loan
              </button>
              <button onClick={() => setViewingRepayment(null)} disabled={isActingOnRepayment} className="px-4 py-2 border border-gray-200 text-sm rounded-lg disabled:opacity-60">Close</button>
              {canActOnRepayment && (
                <>
                  <button onClick={() => setRepaymentActionModal('return')} disabled={isActingOnRepayment} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <CornerDownLeftIcon size={15} /> Return
                  </button>
                  <button onClick={() => setRepaymentActionModal('reject')} disabled={isActingOnRepayment} className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <XCircleIcon size={15} /> Reject
                  </button>
                  <button onClick={() => setRepaymentActionModal('approve')} disabled={isActingOnRepayment} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <CheckCircleIcon size={15} /> {viewingRepayment.pendingWorkflowStatus === 'PENDING_REVIEW' ? 'Review' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
