import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, FilterIcon, CheckIcon, XIcon, CheckCircleIcon, ClockIcon, Loader2Icon } from 'lucide-react';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { loansService, type LoanDetail } from '../../services/loans/loans.service';
import { workflowRequestsService, type WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.service';

const LOAN_ENTITY_TYPE = 'LOAN';

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

/** One row — the pending WorkflowRequest itself, plus whatever the loan's own detail resolves for display (group/branch/amount/raiser). Detail can fail to load (e.g. a transient error) without losing the row entirely — it just shows placeholders. */
type ApprovalRow = {
  request: WorkflowRequestSummary;
  detail: LoanDetail | null;
};

async function loadApprovalQueue(): Promise<ApprovalRow[]> {
  // "Currently awaiting the signed-in staff member" — the engine itself
  // already excludes anything the viewer can't act on (wrong capability
  // for the current step, or their own proposal), so this queue needs no
  // extra client-side filtering the way a general Pending list would.
  const requests = await workflowRequestsService.getPending();
  const loanRequests = requests.filter((request) => request.entityType === LOAN_ENTITY_TYPE);

  const details = await Promise.all(
    loanRequests.map((request) =>
      request.entityId ? loansService.getDetail(request.entityId).catch(() => null) : Promise.resolve(null),
    ),
  );

  return loanRequests.map((request, index) => ({ request, detail: details[index] ?? null }));
}

export function LoanApprovals() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'PENDING_REVIEW' | 'PENDING_APPROVAL'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const refresh = () => {
    setIsLoading(true);
    return loadApprovalQueue()
      .then((items) => {
        setRows(items);
        setLoadError(null);
      })
      .catch((error) => {
        setRows([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load the approvals queue');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      showToast(action === 'APPROVED' ? 'Loan approved' : 'Loan rejected');
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to act on this loan');
    } finally {
      setActingRequestId(null);
    }
  }

  function confirmReject(comment?: string) {
    if (!rejectTargetId || !comment?.trim()) return;
    void handleWorkflowAction(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  function confirmApprove(comment?: string) {
    if (!approveTargetId) return;
    void handleWorkflowAction(approveTargetId, 'APPROVED', comment);
    setApproveTargetId(null);
  }

  const filteredRows = rows.filter(({ request, detail }) => {
    const matchesSearch =
      !searchQuery.trim() ||
      [
        request.entityId ?? '',
        request.initiatedByName ?? '',
        detail?.group.name ?? '',
        detail?.group.branchName ?? '',
        detail?.product.name ?? '',
      ].some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = stageFilter === 'all' || request.status === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
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
        isOpen={approveTargetId !== null}
        onClose={() => setApproveTargetId(null)}
        onConfirm={(val) => confirmApprove(val)}
        title="Approve this loan?"
        description="This advances it to the next step in its approval chain — or activates it if this was the final step."
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Approve"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Comment (optional)"
        inputPlaceholder="Add any notes for whoever acts on this next..."
      />
      <ConfirmationModal
        isOpen={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={(val) => confirmReject(val)}
        title="Reject this loan?"
        description="A reason is required — the marketer who raised it will see it."
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. Group is over-leveraged for this product"
        requireInput
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-primary">
            Loan Approvals Queue
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Loans currently awaiting your review or approval
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search applications..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
            >
              <FilterIcon size={16} className="mr-2" /> Filter
              {stageFilter !== 'all' && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-52">
                {([
                  { value: 'all', label: 'All Stages' },
                  { value: 'PENDING_REVIEW', label: 'Awaiting Review' },
                  { value: 'PENDING_APPROVAL', label: 'Awaiting Approval' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStageFilter(option.value);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${stageFilter === option.value ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}
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
                <th className="px-6 py-4 font-medium">Group Name</th>
                <th className="px-6 py-4 font-medium">Product</th>
                <th className="px-6 py-4 font-medium">Amount Requested</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Raised</th>
                <th className="px-6 py-4 font-medium">Current Stage</th>
                <th className="px-6 py-4 font-medium">Raised By</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRows.map(({ request, detail }) => (
                <tr
                  key={request.id}
                  onClick={() => request.entityId && navigate(`/loan-manager/loans/${request.entityId}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-heading font-medium text-primary">{detail?.group.name ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{detail?.product.name ?? '—'}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {detail ? formatNaira(detail.cumulativeAmountKobo) : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{detail?.group.branchName ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDisplayDate(request.createdAt)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={request.status === 'PENDING_REVIEW' ? 'Pending Review' : 'Pending Approval'} />
                  </td>
                  <td className="px-6 py-4 text-gray-600">{request.initiatedByName ?? request.initiatedBy}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={actingRequestId === request.id}
                        onClick={() => setApproveTargetId(request.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-60"
                        title={request.status === 'PENDING_REVIEW' ? 'Mark as reviewed' : 'Approve'}
                      >
                        <CheckIcon size={18} />
                      </button>
                      <button
                        disabled={actingRequestId === request.id}
                        onClick={() => setRejectTargetId(request.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60"
                        title="Reject"
                      >
                        <XIcon size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !loadError && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    <span className="inline-flex items-center gap-2">
                      <ClockIcon size={16} className="text-gray-300" /> Nothing awaiting your review or approval.
                    </span>
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon size={16} className="animate-spin" /> Loading the approvals queue...
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
    </div>
  );
}
