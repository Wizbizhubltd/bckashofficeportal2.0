import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, Trash2Icon, XCircleIcon } from 'lucide-react';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { workflowRequestsService, type WorkflowRequestDetail } from '../../services/workflow-requests/workflow-requests.service';

const PROPOSAL_STATUS_BADGE: Record<WorkflowRequestDetail['status'], 'Pending Review' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Inactive'> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_APPROVAL: 'Pending Approval',
  RETURNED_TO_MAKER: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Inactive',
};

// Same "maker alone may erase, only before/after review has genuinely moved
// it forward" rule as GroupProposalDetail.tsx's own DELETABLE_STATUSES.
const DELETABLE_STATUSES: WorkflowRequestDetail['status'][] = ['PENDING_REVIEW', 'REJECTED'];

function toDisplayDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function branchProposalSummary(payload: Record<string, unknown>): { name: string; code: string | null; address: string | null } {
  const name = typeof payload.name === 'string' ? payload.name : null;
  const code = typeof payload.code === 'string' ? payload.code : null;
  const address = typeof payload.address === 'string' ? payload.address : null;
  return { name: name ?? '(untitled proposal)', code, address };
}

/**
 * Detail view for a branch proposal that hasn't been approved yet (still
 * PENDING_REVIEW/PENDING_APPROVAL/REJECTED) — no `Branch` document exists
 * for it until approved, only this WorkflowRequest and its payload. Reached
 * by clicking a row in BranchManagement.tsx's Pending/Rejected tabs, which
 * previously had no click-through at all.
 */
export function BranchProposalDetail() {
  const navigate = useNavigate();
  const { workflowRequestId } = useParams<{ workflowRequestId: string }>();
  const { user } = useAuth();

  const [detail, setDetail] = useState<WorkflowRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const routeId = typeof workflowRequestId === 'string' ? workflowRequestId.trim() : '';

  const refresh = () => {
    if (!routeId) {
      setError('Invalid proposal id.');
      setIsLoading(false);
      return Promise.resolve();
    }
    setIsLoading(true);
    setError(null);
    return workflowRequestsService
      .getById(routeId)
      .then((result) => setDetail(result))
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load branch proposal.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowRequestId]);

  const isOwnProposal = Boolean(detail && user && detail.initiatedBy === user.id);
  const canDelete = isOwnProposal && Boolean(detail && DELETABLE_STATUSES.includes(detail.status));
  const canAct = Boolean(detail) && !isOwnProposal && (detail?.status === 'PENDING_REVIEW' || detail?.status === 'PENDING_APPROVAL');

  async function handleAct(action: 'APPROVED' | 'REJECTED', comment?: string) {
    if (!detail) return;
    setActing(true);
    try {
      await workflowRequestsService.act(detail.id, { action, comment });
      showToast(action === 'APPROVED' ? 'Branch approved' : 'Branch proposal rejected');
      await refresh();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to act on this request');
    } finally {
      setActing(false);
    }
  }

  function confirmReject(comment?: string) {
    if (!comment?.trim()) return;
    setRejectOpen(false);
    void handleAct('REJECTED', comment.trim());
  }

  async function handleDelete() {
    if (!detail) return;
    setIsDeleting(true);
    try {
      await workflowRequestsService.deleteRequest(detail.id);
      navigate('/branches');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to delete this proposal.');
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/branches')} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
          <ArrowLeftIcon size={16} className="mr-2" /> Back to Branches
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">Loading branch proposal...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/branches')} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
          <ArrowLeftIcon size={16} className="mr-2" /> Back to Branches
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-sm text-red-600">{error || 'Branch proposal not found.'}</p>
        </div>
      </div>
    );
  }

  const summary = branchProposalSummary(detail.payload);
  const lastActedStep = [...detail.steps].reverse().find((step) => step.action !== null);

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
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
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
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete Branch Proposal"
        description={`Delete "${summary.name}"? This permanently removes the proposal — it cannot be undone.`}
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
      />

      <button onClick={() => navigate('/branches')} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
        <ArrowLeftIcon size={16} className="mr-2" /> Back to Branches
      </button>

      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-heading font-bold text-primary">{summary.name}</h2>
            <p className="text-sm text-gray-500 mt-1">Proposal ID: {detail.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={PROPOSAL_STATUS_BADGE[detail.status]} />
            {canDelete && (
              <button
                onClick={() => setDeleteOpen(true)}
                title="Delete this branch proposal"
                aria-label="Delete this branch proposal"
                className="p-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2Icon size={16} />
              </button>
            )}
          </div>
        </div>

        {(detail.status === 'PENDING_REVIEW' || detail.status === 'PENDING_APPROVAL' || detail.status === 'RETURNED_TO_MAKER') && (
          <p className="mt-2 text-xs font-body text-amber-600 flex items-center gap-1.5">
            <ClockIcon size={13} /> Awaiting {detail.status === 'PENDING_APPROVAL' ? 'approval' : 'review'}
          </p>
        )}
        {detail.status === 'REJECTED' && lastActedStep && (
          <p className="mt-2 text-xs font-body text-red-600">
            Rejected by {lastActedStep.actedByName ?? 'a reviewer'}
            {lastActedStep.comment ? `: "${lastActedStep.comment}"` : ''}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Branch Code</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{summary.code || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{summary.address || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Submitted</p>
            <p className="text-sm text-gray-800 mt-1 font-medium">{toDisplayDateTime(detail.createdAt)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Proposed By</p>
          <p className="text-sm text-gray-800 mt-1 font-medium">
            {isOwnProposal ? 'You' : (detail.initiatedByName ?? detail.initiatedBy)}
          </p>
        </div>

        {isOwnProposal && (detail.status === 'PENDING_REVIEW' || detail.status === 'PENDING_APPROVAL') && (
          <p className="mt-4 text-xs font-body text-gray-400">
            Awaiting another Admin/SuperAdmin/Approver's review — you can't approve your own proposal.
          </p>
        )}

        {canAct && (
          <div className="flex items-center gap-2 mt-6">
            <button
              disabled={acting}
              onClick={() => void handleAct('APPROVED')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              <CheckCircleIcon size={14} /> Approve
            </button>
            <button
              disabled={acting}
              onClick={() => setRejectOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <XCircleIcon size={14} /> Reject
            </button>
          </div>
        )}
      </div>

      {detail.steps.some((step) => step.action !== null) && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-heading font-bold text-primary">Review History</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {detail.steps
              .filter((step) => step.action !== null)
              .map((step) => (
                <div key={step.order} className="px-6 py-3 text-sm">
                  <p className="text-gray-800">
                    <span className="font-medium">{step.actedByName ?? step.actedBy ?? 'Someone'}</span>{' '}
                    {step.action === 'APPROVED' ? 'approved' : step.action === 'REJECTED' ? 'rejected' : 'returned'} this
                    proposal
                    {step.actedAt ? ` on ${toDisplayDateTime(step.actedAt)}` : ''}.
                  </p>
                  {step.comment && <p className="text-xs text-gray-500 mt-1">"{step.comment}"</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
