import { useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PencilIcon, XIcon, ReceiptIcon, PowerIcon, Loader2Icon, ClockIcon, CheckCircleIcon, XCircleIcon, CircleXIcon, Trash2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import {
  feeDefinitionsService,
  type FeeAppliesTo,
  type FeeCalcType,
  type FeeCategory,
  type FeeDefinition,
  type FeePercentageBasis,
  type FeeTiming,
  type PenaltyFrequency,
} from '../../services/fee-definitions/fee-definitions.service';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestDetail, WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.types';

const CATEGORY_LABEL: Record<FeeCategory, string> = {
  REGISTRATION: 'Registration',
  FORM: 'Form',
  MEMBERSHIP: 'Membership',
  LATE_REPAYMENT: 'Late Repayment',
  EARLY_LIQUIDATION: 'Early Liquidation',
  OTHER: 'Other',
};
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL) as FeeCategory[];

const TIMING_OPTIONS: { value: FeeTiming; label: string }[] = [
  { value: 'PRE_LOAN', label: 'Pre-Loan' },
  { value: 'DURING_LIFECYCLE', label: 'During Loan Lifecycle' },
];
const CALC_TYPE_OPTIONS: { value: FeeCalcType; label: string }[] = [
  { value: 'FIXED', label: 'Fixed (₦)' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
];
const PERCENTAGE_OF_OPTIONS: { value: FeePercentageBasis; label: string }[] = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'OUTSTANDING', label: 'Outstanding Balance' },
  { value: 'OVERDUE_AMOUNT', label: 'Overdue Amount' },
];
const APPLIES_TO_OPTIONS: { value: FeeAppliesTo; label: string }[] = [
  { value: 'PER_MEMBER', label: 'Per Member' },
  { value: 'PER_GROUP', label: 'Per Group' },
];
const FREQUENCY_OPTIONS: { value: PenaltyFrequency; label: string }[] = [
  { value: 'ONE_TIME', label: 'One-Time' },
  { value: 'RECURRING', label: 'Recurring' },
];

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const selectClass = `${inputClass} bg-white`;

function ModalWrapper({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function toCurrency(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type FormValues = {
  name: string;
  category: FeeCategory;
  timing: FeeTiming;
  calcType: FeeCalcType;
  value: string;
  percentageOf: string;
  appliesTo: FeeAppliesTo;
  frequency: PenaltyFrequency;
  recurrenceIntervalDays: string;
  maxRecurrences: string;
};

const EMPTY_FORM: FormValues = {
  name: '',
  category: 'REGISTRATION',
  timing: 'PRE_LOAN',
  calcType: 'FIXED',
  value: '',
  percentageOf: '',
  appliesTo: 'PER_MEMBER',
  frequency: 'ONE_TIME',
  recurrenceIntervalDays: '',
  maxRecurrences: '',
};

function toFormValues(fee: FeeDefinition): FormValues {
  return {
    name: fee.name,
    category: fee.category,
    timing: fee.timing,
    calcType: fee.calcType,
    // Both kobo and basis points use the same x100 scaling from their
    // natural unit (naira / percent).
    value: (fee.value / 100).toFixed(2),
    percentageOf: fee.percentageOf ?? '',
    appliesTo: fee.appliesTo,
    frequency: fee.frequency,
    recurrenceIntervalDays: fee.recurrenceIntervalDays ? String(fee.recurrenceIntervalDays) : '',
    maxRecurrences: fee.maxRecurrences ? String(fee.maxRecurrences) : '',
  };
}

/** Best-effort read of a pending FEE_DEFINITION request's proposed name/amount — CREATE payloads are flat, UPDATE payloads wrap changes in `{ feeDefinitionId, changes }`. */
function pendingFeeSummary(payload: Record<string, unknown>): { name: string | null; amount: string | null } {
  const changes = payload.changes && typeof payload.changes === 'object' ? (payload.changes as Record<string, unknown>) : payload;
  const name = typeof changes.name === 'string' ? changes.name : null;
  const calcType = typeof changes.calcType === 'string' ? changes.calcType : null;
  const value = typeof changes.value === 'number' ? changes.value : null;
  const amount = value === null ? null : calcType === 'PERCENTAGE' ? `${(value / 100).toFixed(2)}%` : toCurrency(value);
  return { name, amount };
}

const feeFormSchema = Yup.object({
  name: Yup.string().trim().required('Fee name is required'),
  value: Yup.number().typeError('Enter a valid amount').min(0, 'Must be 0 or greater').required('Amount is required'),
  percentageOf: Yup.string().when('calcType', {
    is: 'PERCENTAGE',
    then: (schema) => schema.required('Select what the percentage is based on'),
  }),
  recurrenceIntervalDays: Yup.string().when('frequency', {
    is: 'RECURRING',
    then: (schema) => schema.required('Recurrence interval (days) is required for a recurring fee'),
  }),
});

export function FeeConfiguration() {
  const { user } = useAuth();
  const [view, setView] = useState<'active' | 'pending' | 'rejected'>('active');

  const [fees, setFees] = useState<FeeDefinition[]>([]);
  const [activeCategory, setActiveCategory] = useState<FeeCategory>('REGISTRATION');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing: FeeDefinition | null }>({ open: false, editing: null });
  const [activeToggleTarget, setActiveToggleTarget] = useState<FeeDefinition | null>(null);
  // A reason is required server-side to reject — captured via a modal
  // rather than acting immediately on click.
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  // Maker withdrawing their own still-pending proposal — FEE_DEFINITION's
  // create/update chain is a single approve() step, so a fresh proposal
  // sits at PENDING_APPROVAL immediately (never PENDING_REVIEW), which is
  // why this uses the softer `cancel` (keeps a CANCELLED record) rather
  // than the generic hard-delete endpoint (PENDING_REVIEW/REJECTED only —
  // see workflowRequestsService.deleteRequest's own doc comment). Nothing
  // else to clean up either way: a FeeDefinition document doesn't exist
  // until this request is actually approved.
  const [withdrawTargetRequestId, setWithdrawTargetRequestId] = useState<string | null>(null);
  const [isWithdrawingRequest, setIsWithdrawingRequest] = useState(false);
  // A rejected proposal never persisted anything — deleting it is a
  // permanent hard delete, own-proposal only (see
  // workflowRequestsService.deleteRequest's own doc comment).
  const [deleteTargetRequestId, setDeleteTargetRequestId] = useState<string | null>(null);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);

  // Pending Approval tab — GET pending-all/FEE_DEFINITION deliberately
  // includes the caller's own submissions (unlike GET pending), same reason
  // this exists on LoanProductsCrud.tsx: a proposed fee doesn't touch the
  // real fee_definitions collection until approved, so without this a
  // maker has no way to see their own proposal is genuinely pending.
  const [pendingRequests, setPendingRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingDetails, setPendingDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  // Rejected tab — a rejected CREATE never persists a FeeDefinition, so this
  // (via GET rejected-all/FEE_DEFINITION) is the only place that outcome is
  // visible at all once it leaves Pending. Read-only: nothing to act on.
  const [rejectedRequests, setRejectedRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedDetails, setRejectedDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejected, setIsLoadingRejected] = useState(true);

  const loadFees = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setFees(await feeDefinitionsService.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load fee definitions');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPending = async () => {
    setIsLoadingPending(true);
    try {
      const requests = await workflowRequestsService.getPendingByEntityType('FEE_DEFINITION');
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
      const requests = await workflowRequestsService.getRejectedByEntityType('FEE_DEFINITION');
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

  useEffect(() => {
    void loadFees();
    void loadPending();
    void loadRejected();
  }, []);

  async function handleWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      // Read the category before acting — once approved, this request drops
      // out of pendingDetails and we'd have no way to know which category
      // card the newly-approved fee actually landed under. For an UPDATE
      // that doesn't touch `category`, fall back to the fee's existing
      // (pre-update) category from the currently-loaded list.
      const detail = pendingDetails[requestId];
      const payload = detail?.payload;
      const isUpdate = payload?.changes && typeof payload.changes === 'object';
      const changes = isUpdate ? (payload!.changes as Record<string, unknown>) : payload;
      const existingFeeId = isUpdate && typeof payload!.feeDefinitionId === 'string' ? payload!.feeDefinitionId : null;
      const category =
        (typeof changes?.category === 'string' ? (changes.category as FeeCategory) : null) ??
        fees.find((fee) => fee.id === existingFeeId)?.category ??
        null;

      await workflowRequestsService.act(requestId, { action, comment });
      await Promise.all([loadFees(), loadPending(), loadRejected()]);

      if (action === 'APPROVED') {
        // It doesn't just vanish from Pending — jump the viewer straight to
        // where it actually landed (including switching category, since the
        // Active tab's table is scoped to whichever category card is
        // selected), instead of leaving them thinking it was lost.
        if (category) setActiveCategory(category);
        setView('active');
        toast.success('Approved — now showing in Active.');
      } else {
        if (category) setActiveCategory(category);
        setView('rejected');
        toast.success('Rejected — now showing in Rejected.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to act on this request');
    } finally {
      setActingRequestId(null);
    }
  }

  function confirmReject(comment?: string) {
    if (!rejectTargetId || !comment?.trim()) return;
    void handleWorkflowAction(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  async function handleWithdrawRequest() {
    if (!withdrawTargetRequestId) return;
    setIsWithdrawingRequest(true);
    try {
      await workflowRequestsService.cancel(withdrawTargetRequestId);
      toast.success('Proposal withdrawn');
      setWithdrawTargetRequestId(null);
      await loadPending();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw this proposal');
    } finally {
      setIsWithdrawingRequest(false);
    }
  }

  async function handleDeleteRequest() {
    if (!deleteTargetRequestId) return;
    setIsDeletingRequest(true);
    try {
      await workflowRequestsService.deleteRequest(deleteTargetRequestId);
      toast.success('Rejected proposal deleted');
      setDeleteTargetRequestId(null);
      await loadRejected();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete this proposal');
    } finally {
      setIsDeletingRequest(false);
    }
  }

  const formik = useFormik<FormValues>({
    initialValues: EMPTY_FORM,
    validationSchema: feeFormSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      const payload = {
        name: values.name.trim(),
        category: values.category,
        timing: values.timing,
        calcType: values.calcType,
        value: Math.round(parseFloat(values.value) * 100),
        percentageOf: values.calcType === 'PERCENTAGE' ? (values.percentageOf as FeePercentageBasis) : undefined,
        appliesTo: values.appliesTo,
        frequency: values.frequency,
        recurrenceIntervalDays: values.frequency === 'RECURRING' ? parseInt(values.recurrenceIntervalDays, 10) : undefined,
        maxRecurrences: values.maxRecurrences.trim() ? parseInt(values.maxRecurrences, 10) : undefined,
      };

      setSubmitting(true);
      try {
        if (modal.editing) {
          await feeDefinitionsService.update(modal.editing.id, payload);
          toast.success('Fee update proposed — awaiting approval before it takes effect.');
        } else {
          await feeDefinitionsService.create(payload);
          toast.success('Fee proposed — awaiting approval before it appears live.');
        }
        setModal({ open: false, editing: null });
        await Promise.all([loadFees(), loadPending()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to submit fee');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const categoryFees = useMemo(() => fees.filter((fee) => fee.category === activeCategory), [fees, activeCategory]);

  function openCreate(category: FeeCategory) {
    formik.resetForm({ values: { ...EMPTY_FORM, category } });
    setModal({ open: true, editing: null });
  }

  function openEdit(fee: FeeDefinition) {
    formik.resetForm({ values: toFormValues(fee) });
    setModal({ open: true, editing: fee });
  }

  function closeModal() {
    formik.resetForm({ values: EMPTY_FORM });
    setModal({ open: false, editing: null });
  }

  async function handleToggleActive() {
    if (!activeToggleTarget) return;
    setSubmitting(true);
    try {
      await feeDefinitionsService.update(activeToggleTarget.id, { active: !activeToggleTarget.active });
      toast.success(`${activeToggleTarget.active ? 'Deactivation' : 'Reactivation'} proposed — awaiting approval.`);
      setActiveToggleTarget(null);
      await Promise.all([loadFees(), loadPending()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to propose status change');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">Fee Configuration</h3>
          <p className="text-sm text-gray-500">Fees applied to loans and members — proposed here, subject to approval.</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        Adding or editing a fee proposes a change — it only takes effect once an Admin/SuperAdmin/Approver approves
        it. The person who proposed it can't approve their own proposal.
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('active')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'active' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Active ({fees.length})
        </button>
        <button
          onClick={() => setView('pending')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'pending' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Pending Approval ({pendingRequests.length})
        </button>
        <button
          onClick={() => setView('rejected')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'rejected' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Rejected ({rejectedRequests.length})
        </button>
      </div>

      {loadError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

      {view === 'pending' ? (
        <div className="space-y-3">
          {isLoadingPending ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading pending requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
              <ClockIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
              <p className="text-xs font-body text-gray-400 mt-1">Proposed fees/updates will show up here until they're approved or rejected.</p>
            </div>
          ) : (
            pendingRequests.map((entry) => {
              const detail = pendingDetails[entry.id];
              const summary = detail ? pendingFeeSummary(detail.payload) : null;
              const isOwnProposal = user?.id === entry.initiatedBy;

              return (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <ClockIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-bold text-gray-900">{summary?.name ?? (detail ? 'Untitled proposal' : 'Loading...')}</p>
                        <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-gray-100 text-gray-600">
                          {entry.action === 'CREATE' ? 'New Fee' : 'Update'}
                        </span>
                        {isOwnProposal && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                        )}
                      </div>
                      <p className="text-xs font-body text-gray-400 mt-0.5">
                        {summary?.amount ? `${summary.amount} · ` : ''}
                        Proposed {new Date(entry.createdAt).toLocaleDateString()}
                        {entry.entityId ? ` · updates ${entry.entityId}` : ''}
                      </p>
                    </div>
                  </div>

                  {isOwnProposal ? (
                    <div className="flex items-start gap-2 flex-shrink-0">
                      <p className="text-xs font-body text-gray-400 text-right max-w-[160px]">
                        Awaiting another Admin/SuperAdmin/Approver's review — you can't approve your own proposal.
                      </p>
                      <button
                        disabled={actingRequestId === entry.id}
                        onClick={() => setWithdrawTargetRequestId(entry.id)}
                        title="Withdraw this proposal"
                        aria-label="Withdraw this proposal"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60">
                        <Trash2Icon size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
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
      ) : view === 'rejected' ? (
        <div className="space-y-3">
          {isLoadingRejected ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading rejected requests...</div>
          ) : rejectedRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
              <CircleXIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-heading font-bold text-gray-500">Nothing rejected</p>
              <p className="text-xs font-body text-gray-400 mt-1">A rejected proposal never takes effect — it shows up here instead of a fee.</p>
            </div>
          ) : (
            rejectedRequests.map((entry) => {
              const detail = rejectedDetails[entry.id];
              const summary = detail ? pendingFeeSummary(detail.payload) : null;
              const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');
              const isOwnProposal = user?.id === entry.initiatedBy;
              return (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                      <CircleXIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-bold text-gray-900">{summary?.name ?? (detail ? 'Untitled proposal' : 'Loading...')}</p>
                        <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-gray-100 text-gray-600">
                          {entry.action === 'CREATE' ? 'New Fee' : 'Update'}
                        </span>
                      </div>
                      <p className="text-xs font-body text-gray-400 mt-0.5">
                        {summary?.amount ? `${summary.amount} · ` : ''}
                        Proposed {new Date(entry.createdAt).toLocaleDateString()}
                        {entry.entityId ? ` · updates ${entry.entityId}` : ''}
                      </p>
                      {rejectionStep?.actedBy && (
                        <p className="text-xs font-body text-red-600 mt-1.5">
                          Rejected by {rejectionStep.actedBy === user?.id ? 'you' : rejectionStep.actedBy}
                          {rejectionStep.actedAt ? ` · ${new Date(rejectionStep.actedAt).toLocaleDateString()}` : ''}
                          {rejectionStep.comment ? `: "${rejectionStep.comment}"` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOwnProposal && (
                    <button
                      onClick={() => setDeleteTargetRequestId(entry.id)}
                      title="Delete this rejected proposal"
                      aria-label="Delete this rejected proposal"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2Icon size={15} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORY_OPTIONS.map((category) => {
          const count = fees.filter((fee) => fee.category === category).length;
          return (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeCategory === category ? 'border-primary/30 ring-1 ring-primary/10 bg-white shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
              }`}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-primary/10 text-primary">
                <ReceiptIcon size={16} />
              </div>
              <p className="text-xs font-body text-gray-500">{CATEGORY_LABEL[category]}</p>
              <p className="text-lg font-heading font-bold text-gray-900">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <ReceiptIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold text-gray-900">{CATEGORY_LABEL[activeCategory]}</h3>
              <p className="text-sm font-body text-gray-500">
                {categoryFees.length} fee{categoryFees.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <button
            onClick={() => openCreate(activeCategory)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors">
            <PlusIcon size={14} />
            Propose Fee
          </button>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">Loading fee definitions...</div>
        ) : categoryFees.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ReceiptIcon size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-heading font-bold text-gray-500">No fees configured</p>
            <p className="text-xs font-body text-gray-400 mt-1">Propose a fee for this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-3 font-medium">Fee</th>
                  <th className="px-6 py-3 font-medium">Timing</th>
                  <th className="px-6 py-3 font-medium">Applies To</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {categoryFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-heading font-medium text-gray-900">{fee.name}</p>
                      {fee.frequency === 'RECURRING' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Recurring every {fee.recurrenceIntervalDays}d{fee.maxRecurrences ? `, capped at ${fee.maxRecurrences}x` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{TIMING_OPTIONS.find((t) => t.value === fee.timing)?.label ?? fee.timing}</td>
                    <td className="px-6 py-4 text-gray-600">{fee.appliesTo === 'PER_MEMBER' ? 'Per Member' : 'Per Group'}</td>
                    <td className="px-6 py-4 font-heading font-bold text-gray-800">
                      {fee.calcType === 'FIXED' ? toCurrency(fee.value) : `${(fee.value / 100).toFixed(2)}% of ${fee.percentageOf?.toLowerCase()}`}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={fee.active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(fee)} className="text-primary hover:text-accent mr-3 transition-colors">
                        <PencilIcon size={14} />
                      </button>
                      <button onClick={() => setActiveToggleTarget(fee)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <PowerIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      <ModalWrapper isOpen={modal.open} onClose={closeModal}>
        <button onClick={closeModal} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <XIcon size={18} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <ReceiptIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">{modal.editing ? 'Propose Fee Update' : 'Propose Fee'}</h3>
            <p className="text-xs font-body text-gray-500">{modal.editing ? 'Subject to approval' : 'Subject to approval before it goes live'}</p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Fee Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="e.g. Registration Form"
              className={inputClass}
            />
            {formik.touched.name && formik.errors.name && <p className="text-xs text-red-600 mt-1">{formik.errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Category</label>
              <select name="category" value={formik.values.category} onChange={formik.handleChange} className={selectClass}>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Timing</label>
              <select name="timing" value={formik.values.timing} onChange={formik.handleChange} className={selectClass}>
                {TIMING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Charging Type</label>
              <select name="calcType" value={formik.values.calcType} onChange={formik.handleChange} className={selectClass}>
                {CALC_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                name="value"
                type="number"
                step="0.01"
                value={formik.values.value}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder={formik.values.calcType === 'FIXED' ? '500' : '2.5'}
                className={inputClass}
              />
              {formik.touched.value && formik.errors.value && <p className="text-xs text-red-600 mt-1">{formik.errors.value}</p>}
            </div>
          </div>

          {formik.values.calcType === 'PERCENTAGE' && (
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                Percentage Of <span className="text-red-500">*</span>
              </label>
              <select name="percentageOf" value={formik.values.percentageOf} onChange={formik.handleChange} className={selectClass}>
                <option value="">Select...</option>
                {PERCENTAGE_OF_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {formik.touched.percentageOf && formik.errors.percentageOf && <p className="text-xs text-red-600 mt-1">{formik.errors.percentageOf}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Applies To</label>
            <select name="appliesTo" value={formik.values.appliesTo} onChange={formik.handleChange} className={selectClass}>
              {APPLIES_TO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Frequency</label>
              <select name="frequency" value={formik.values.frequency} onChange={formik.handleChange} className={selectClass}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Only meaningful for Early Liquidation fees today.</p>
            </div>
            {formik.values.frequency === 'RECURRING' && (
              <div>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                  Recur Every (days) <span className="text-red-500">*</span>
                </label>
                <input
                  name="recurrenceIntervalDays"
                  type="number"
                  min={1}
                  value={formik.values.recurrenceIntervalDays}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={inputClass}
                />
                {formik.touched.recurrenceIntervalDays && formik.errors.recurrenceIntervalDays && (
                  <p className="text-xs text-red-600 mt-1">{formik.errors.recurrenceIntervalDays}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {submitting && <Loader2Icon size={14} className="animate-spin" />}
              {modal.editing ? 'Propose Changes' : 'Propose Fee'}
            </button>
          </div>
        </form>
      </ModalWrapper>

      <ConfirmationModal
        isOpen={Boolean(activeToggleTarget)}
        onClose={() => setActiveToggleTarget(null)}
        onConfirm={() => void handleToggleActive()}
        title={activeToggleTarget?.active ? 'Propose deactivation?' : 'Propose reactivation?'}
        description={`This proposes a status change for "${activeToggleTarget?.name}" — it takes effect once approved.`}
        confirmLabel={submitting ? 'Working...' : 'Propose'}
        confirmVariant={activeToggleTarget?.active ? 'danger' : 'primary'}
      />

      <ConfirmationModal
        isOpen={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={(reason) => confirmReject(reason)}
        title="Reject this proposal?"
        description="A reason is required — the person who proposed it will see it."
        icon={<XCircleIcon size={20} className="text-red-600" />}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. Amount is above policy"
        requireInput
      />

      <ConfirmationModal
        isOpen={withdrawTargetRequestId !== null}
        onClose={() => setWithdrawTargetRequestId(null)}
        onConfirm={() => void handleWithdrawRequest()}
        title="Withdraw this proposal?"
        description="This removes it from the approval queue — nothing was ever created, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isWithdrawingRequest ? 'Withdrawing…' : 'Withdraw'}
        confirmVariant="danger"
      />

      <ConfirmationModal
        isOpen={deleteTargetRequestId !== null}
        onClose={() => setDeleteTargetRequestId(null)}
        onConfirm={() => void handleDeleteRequest()}
        title="Delete this rejected proposal?"
        description="This permanently removes the request — it cannot be undone."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel={isDeletingRequest ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
      />
    </div>
  );
}
