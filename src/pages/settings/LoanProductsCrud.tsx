import { useEffect, useMemo, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilIcon,
  XIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleXIcon,
  PackageIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  HistoryIcon,
  Loader2Icon,
  PowerIcon,
  Trash2Icon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { feeDefinitionsService, type FeeDefinition } from '../../services/fee-definitions/fee-definitions.service';
import {
  loanProductsService,
  type CreateLoanProductPayload,
  type InterestType,
  type LoanProduct,
  type PenaltyFrequency,
  type FeeCalcType,
  type PenaltyPercentageBasis,
  type ProductStatus,
} from '../../services/loan-products/loan-products.service';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestDetail, WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.types';

// Loans raised against a product go through whatever this product's own
// approvalChainSteps say — a single approve(LOAN) step is the sensible
// default every product gets from this form; a more elaborate multi-step
// chain isn't exposed here yet (see LoanProductsService.registerLoanApprovalChain).
const DEFAULT_APPROVAL_CHAIN_STEPS = [{ order: 0, requiredCapability: 'workflow:approve:LOAN' }];

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const selectClass = `${inputClass} bg-white`;

const INTEREST_TYPE_OPTIONS: { value: InterestType; label: string }[] = [
  { value: 'FLAT', label: 'Flat' },
  { value: 'REDUCING', label: 'Reducing Balance' },
];
const PENALTY_CALC_TYPE_OPTIONS: { value: FeeCalcType; label: string }[] = [
  { value: 'FIXED', label: 'Fixed (₦)' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
];
const PENALTY_PERCENTAGE_OF_OPTIONS: { value: PenaltyPercentageBasis; label: string }[] = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'OUTSTANDING', label: 'Outstanding Balance' },
  { value: 'OVERDUE_AMOUNT', label: 'Overdue Amount' },
];
const PENALTY_FREQUENCY_OPTIONS: { value: PenaltyFrequency; label: string }[] = [
  { value: 'ONE_TIME', label: 'One-Time' },
  { value: 'RECURRING', label: 'Recurring' },
];

type FormValues = {
  name: string;
  interestRatePercent: string;
  interestType: InterestType;
  tenureOptionsText: string;
  minGroupSize: string;
  /** Days per repayment installment — 7 (weekly) is the standard cadence. */
  repaymentPeriodDays: string;
  feeIds: string[];
  penaltyCalcType: FeeCalcType;
  penaltyValue: string;
  penaltyPercentageOf: string;
  penaltyGracePeriodDays: string;
  penaltyFrequency: PenaltyFrequency;
  penaltyRecurrenceIntervalDays: string;
  penaltyMaxRecurrences: string;
};

const EMPTY_FORM: FormValues = {
  name: '',
  interestRatePercent: '',
  interestType: 'FLAT',
  tenureOptionsText: '',
  minGroupSize: '3',
  repaymentPeriodDays: '7',
  feeIds: [],
  penaltyCalcType: 'FIXED',
  penaltyValue: '',
  penaltyPercentageOf: '',
  penaltyGracePeriodDays: '0',
  penaltyFrequency: 'ONE_TIME',
  penaltyRecurrenceIntervalDays: '',
  penaltyMaxRecurrences: '',
};

function toFormValues(product: LoanProduct): FormValues {
  return {
    name: product.name,
    interestRatePercent: (product.interestRate / 100).toFixed(2),
    interestType: product.interestType,
    tenureOptionsText: product.tenureOptions.join(', '),
    minGroupSize: String(product.minGroupSize),
    repaymentPeriodDays: String(product.repaymentPeriodDays),
    feeIds: [...product.feeIds],
    penaltyCalcType: product.penaltyRule.calcType,
    // Both kobo and basis points use the same x100 scaling from their
    // natural unit (naira / percent), so this division works either way.
    penaltyValue: (product.penaltyRule.value / 100).toFixed(2),
    penaltyPercentageOf: product.penaltyRule.percentageOf ?? '',
    penaltyGracePeriodDays: String(product.penaltyRule.gracePeriodDays),
    penaltyFrequency: product.penaltyRule.frequency,
    penaltyRecurrenceIntervalDays: product.penaltyRule.recurrenceIntervalDays ? String(product.penaltyRule.recurrenceIntervalDays) : '',
    penaltyMaxRecurrences: product.penaltyRule.maxRecurrences ? String(product.penaltyRule.maxRecurrences) : '',
  };
}

const productSchema = Yup.object({
  name: Yup.string().trim().required('Product name is required'),
  interestRatePercent: Yup.number().typeError('Enter a valid interest rate').min(0, 'Must be 0 or greater').required('Interest rate is required'),
  tenureOptionsText: Yup.string()
    .trim()
    .required('At least one tenure (in days) is required')
    .test('valid-tenures', 'Enter tenures as a comma-separated list of whole days, minimum 14, e.g. 14, 30, 60', (value) => {
      if (!value) return false;
      return value
        .split(',')
        .map((part) => part.trim())
        .every((part) => /^\d+$/.test(part) && Number(part) >= 14);
    }),
  minGroupSize: Yup.number().typeError('Enter a valid group size').min(3, 'Minimum group size is 3').required('Minimum group size is required'),
  repaymentPeriodDays: Yup.number()
    .typeError('Enter a valid number of days')
    .min(1, 'Must be at least 1 day')
    .required('Repayment period is required'),
  penaltyValue: Yup.number().typeError('Enter a valid penalty value').min(0, 'Must be 0 or greater').required('Penalty value is required'),
  penaltyPercentageOf: Yup.string().when('penaltyCalcType', {
    is: 'PERCENTAGE',
    then: (schema) => schema.required('Select what the percentage penalty is based on'),
  }),
  penaltyGracePeriodDays: Yup.number().typeError('Enter valid grace period days').min(0).required('Grace period is required'),
  penaltyRecurrenceIntervalDays: Yup.string().when('penaltyFrequency', {
    is: 'RECURRING',
    then: (schema) => schema.required('Recurrence interval (days) is required for a recurring penalty'),
  }),
});

function buildPayload(values: FormValues): CreateLoanProductPayload {
  const tenureOptions = values.tenureOptionsText
    .split(',')
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 14);

  return {
    name: values.name.trim(),
    interestRate: Math.round(parseFloat(values.interestRatePercent) * 100),
    interestType: values.interestType,
    tenureOptions,
    minGroupSize: parseInt(values.minGroupSize, 10),
    repaymentPeriodDays: parseInt(values.repaymentPeriodDays, 10) || 7,
    feeIds: values.feeIds,
    approvalChainSteps: DEFAULT_APPROVAL_CHAIN_STEPS,
    penaltyRule: {
      calcType: values.penaltyCalcType,
      value: Math.round(parseFloat(values.penaltyValue) * 100),
      percentageOf: values.penaltyCalcType === 'PERCENTAGE' ? (values.penaltyPercentageOf as PenaltyPercentageBasis) : undefined,
      gracePeriodDays: parseInt(values.penaltyGracePeriodDays, 10) || 0,
      frequency: values.penaltyFrequency,
      recurrenceIntervalDays: values.penaltyFrequency === 'RECURRING' ? parseInt(values.penaltyRecurrenceIntervalDays, 10) : undefined,
      maxRecurrences: values.penaltyMaxRecurrences.trim() ? parseInt(values.penaltyMaxRecurrences, 10) : undefined,
    },
  };
}

function formatMoneyFromKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Best-effort read of a pending LOAN_PRODUCT request's proposed name/rate — the payload shape is whatever LoanProductsService put there, not formally typed on this side. */
function pendingProductSummary(payload: Record<string, unknown>): { name: string; interestRate: string | null } {
  const changes = payload.changes && typeof payload.changes === 'object' ? (payload.changes as Record<string, unknown>) : payload;
  const name = typeof changes.name === 'string' ? changes.name : null;
  const interestRate = typeof changes.interestRate === 'number' ? `${(changes.interestRate / 100).toFixed(2)}%` : null;
  return { name: name ?? '(name unchanged)', interestRate };
}

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

export function LoanProductsCrud() {
  const { user } = useAuth();
  const [view, setView] = useState<'active' | 'pending' | 'rejected'>('active');

  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [fees, setFees] = useState<FeeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pending Approval tab — GET pending-all/LOAN_PRODUCT deliberately
  // includes the caller's own submissions (unlike GET pending), so a
  // creator can confirm their proposal is genuinely sitting there awaiting
  // someone else, instead of concluding it silently vanished. See
  // workflowRequestsService.getPendingByEntityType's own doc comment.
  const [pendingRequests, setPendingRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingDetails, setPendingDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  // Rejected tab — a rejected CREATE never persists a LoanProduct, so this
  // (via GET rejected-all/LOAN_PRODUCT) is the only place that outcome is
  // visible at all once it leaves Pending. Read-only: nothing to act on.
  const [rejectedRequests, setRejectedRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedDetails, setRejectedDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejected, setIsLoadingRejected] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyByProduct, setHistoryByProduct] = useState<Record<string, WorkflowRequestSummary[]>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; editing: LoanProduct | null }>({ open: false, editing: null });
  const [statusTarget, setStatusTarget] = useState<{ product: LoanProduct; nextStatus: ProductStatus } | null>(null);
  // A reason is required server-side to reject — captured via a modal
  // rather than acting immediately on click.
  const [rejectTarget, setRejectTarget] = useState<{ requestId: string; productId: string | null } | null>(null);
  // Maker withdrawing their own still-pending proposal — LOAN_PRODUCT's
  // create/update chain is a single approve() step, so a fresh proposal
  // sits at PENDING_APPROVAL immediately (never PENDING_REVIEW), which is
  // why this uses the softer `cancel` (keeps a CANCELLED record) rather than
  // the generic hard-delete endpoint (PENDING_REVIEW/REJECTED only — see
  // workflowRequestsService.deleteRequest's own doc comment). Nothing else
  // to clean up either way: a LoanProduct document doesn't exist until this
  // request is actually approved.
  const [deleteTargetRequestId, setDeleteTargetRequestId] = useState<string | null>(null);

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [productList, feeList] = await Promise.all([loanProductsService.list(), feeDefinitionsService.list()]);
      setProducts(productList);
      setFees(feeList);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load loan products');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPending = async () => {
    setIsLoadingPending(true);
    try {
      const requests = await workflowRequestsService.getPendingByEntityType('LOAN_PRODUCT');
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
      const requests = await workflowRequestsService.getRejectedByEntityType('LOAN_PRODUCT');
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
    void loadAll();
    void loadPending();
    void loadRejected();
  }, []);

  const formik = useFormik<FormValues>({
    initialValues: EMPTY_FORM,
    validationSchema: productSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      const payload = buildPayload(values);
      setSubmitting(true);
      try {
        if (modal.editing) {
          await loanProductsService.update(modal.editing.id, payload);
          toast.success('Update proposed — awaiting approval before it takes effect.');
        } else {
          await loanProductsService.create(payload);
          toast.success('Loan product proposed — awaiting approval before it appears live.');
        }
        setModal({ open: false, editing: null });
        await Promise.all([loadAll(), loadPending()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to submit loan product');
      } finally {
        setSubmitting(false);
      }
    },
  });

  function openCreateModal() {
    formik.resetForm({ values: EMPTY_FORM });
    setModal({ open: true, editing: null });
  }

  function openEditModal(product: LoanProduct) {
    formik.resetForm({ values: toFormValues(product) });
    setModal({ open: true, editing: product });
  }

  function closeModal() {
    formik.resetForm({ values: EMPTY_FORM });
    setModal({ open: false, editing: null });
  }

  async function toggleExpand(product: LoanProduct) {
    const nextExpanded = expandedId === product.id ? null : product.id;
    setExpandedId(nextExpanded);
    if (nextExpanded && !historyByProduct[product.id]) {
      setLoadingHistoryId(product.id);
      try {
        const history = await workflowRequestsService.getHistory('LOAN_PRODUCT', product.id);
        setHistoryByProduct((current) => ({ ...current, [product.id]: history }));
      } catch {
        setHistoryByProduct((current) => ({ ...current, [product.id]: [] }));
      } finally {
        setLoadingHistoryId(null);
      }
    }
  }

  async function refreshHistoryFor(productId: string) {
    try {
      const history = await workflowRequestsService.getHistory('LOAN_PRODUCT', productId);
      setHistoryByProduct((current) => ({ ...current, [productId]: history }));
    } catch {
      // best-effort — the row just keeps showing whatever it had
    }
  }

  async function handleProposeStatusChange() {
    if (!statusTarget) return;
    setSubmitting(true);
    try {
      await loanProductsService.update(statusTarget.product.id, { status: statusTarget.nextStatus });
      toast.success(`${statusTarget.nextStatus === 'INACTIVE' ? 'Deactivation' : 'Reactivation'} proposed — awaiting approval.`);
      setStatusTarget(null);
      await Promise.all([loadAll(), loadPending()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to propose status change');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWorkflowAction(requestId: string, productId: string | null, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      await Promise.all([loadAll(), loadPending(), loadRejected(), ...(productId ? [refreshHistoryFor(productId)] : [])]);
      if (action === 'APPROVED') {
        // It doesn't just vanish from Pending — jump the viewer straight to
        // where it actually landed, instead of leaving them staring at a
        // Pending tab with one fewer row and no visible destination.
        setView('active');
        toast.success('Approved — now showing in Active.');
      } else {
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
    if (!rejectTarget || !comment?.trim()) return;
    void handleWorkflowAction(rejectTarget.requestId, rejectTarget.productId, 'REJECTED', comment.trim());
    setRejectTarget(null);
  }

  async function handleDeleteProposal(requestId: string) {
    setDeleteTargetRequestId(null);
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.cancel(requestId);
      await loadPending();
      toast.success('Proposal withdrawn');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw this proposal');
    } finally {
      setActingRequestId(null);
    }
  }

  const activeCount = useMemo(() => products.filter((item) => item.status === 'ACTIVE').length, [products]);
  const feeNameById = useMemo(() => new Map(fees.map((fee) => [fee.id, fee.name])), [fees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <PackageIcon size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">Loan Products</h3>
            <p className="text-sm font-body text-gray-500">
              {activeCount} active of {products.length} products
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          disabled={submitting || isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          <PlusIcon size={14} />
          Propose Product
        </button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        Creating or editing a product proposes a change — it only takes effect once an Admin, SuperAdmin, or Approver approves
        it. The person who proposed it can't approve their own proposal.
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setView('active')}
          className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'active' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
          Active ({products.length})
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

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      {view === 'pending' ? (
        <div className="space-y-3">
          {isLoadingPending ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading pending requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
              <ClockIcon size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
              <p className="text-xs font-body text-gray-400 mt-1">Proposed products/updates will show up here until they're approved or rejected.</p>
            </div>
          ) : (
            pendingRequests.map((entry) => {
              const detail = pendingDetails[entry.id];
              const summary = detail ? pendingProductSummary(detail.payload) : null;
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
                          {entry.action === 'CREATE' ? 'New Product' : 'Update'}
                        </span>
                        {isOwnProposal && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                        )}
                      </div>
                      <p className="text-xs font-body text-gray-400 mt-0.5">
                        {summary?.interestRate ? `${summary.interestRate} interest · ` : ''}
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
                        onClick={() => setDeleteTargetRequestId(entry.id)}
                        title="Withdraw this proposal"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60">
                        <Trash2Icon size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={actingRequestId === entry.id}
                        onClick={() => void handleWorkflowAction(entry.id, entry.entityId, 'APPROVED')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                        <CheckCircleIcon size={13} /> Approve
                      </button>
                      <button
                        disabled={actingRequestId === entry.id}
                        onClick={() => setRejectTarget({ requestId: entry.id, productId: entry.entityId })}
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
              <p className="text-xs font-body text-gray-400 mt-1">A rejected proposal never takes effect — it shows up here instead of a product.</p>
            </div>
          ) : (
            rejectedRequests.map((entry) => {
              const detail = rejectedDetails[entry.id];
              const summary = detail ? pendingProductSummary(detail.payload) : null;
              const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');
              return (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                      <CircleXIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-bold text-gray-900">{summary?.name ?? (detail ? 'Untitled proposal' : 'Loading...')}</p>
                        <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-gray-100 text-gray-600">
                          {entry.action === 'CREATE' ? 'New Product' : 'Update'}
                        </span>
                      </div>
                      <p className="text-xs font-body text-gray-400 mt-0.5">
                        {summary?.interestRate ? `${summary.interestRate} interest · ` : ''}
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
                </div>
              );
            })
          )}
        </div>
      ) : (
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center text-gray-500 text-sm">Loading loan products...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-12 text-center">
            <PackageIcon size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-heading font-bold text-gray-500">No loan products yet</p>
            <p className="text-xs font-body text-gray-400 mt-1">Propose a product to populate this list.</p>
          </div>
        ) : (
          products.map((product) => {
            const history = historyByProduct[product.id];
            return (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => void toggleExpand(product)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        product.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <PackageIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-heading font-bold text-gray-900">{product.name}</p>
                        <StatusBadge status={product.status === 'ACTIVE' ? 'Active' : product.status === 'INACTIVE' ? 'Inactive' : 'Rejected'} />
                      </div>
                      <p className="text-xs font-body text-gray-400 mt-0.5">
                        {product.interestType === 'FLAT' ? 'Flat' : 'Reducing'} interest
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 mr-4">
                    <div className="text-center">
                      <p className="text-xs font-body text-gray-400">Tenure</p>
                      <p className="text-sm font-heading font-bold text-gray-800">{product.tenureOptions.join(', ')} days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-body text-gray-400">Interest</p>
                      <p className="text-sm font-heading font-bold text-accent">{(product.interestRate / 100).toFixed(2)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-body text-gray-400">Min Group</p>
                      <p className="text-xs font-body font-medium text-gray-700">{product.minGroupSize}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditModal(product);
                      }}
                      className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                      <PencilIcon size={14} />
                    </button>
                    {expandedId === product.id ? <ChevronUpIcon size={16} className="text-gray-400" /> : <ChevronDownIcon size={16} className="text-gray-400" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === product.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden">
                      <div className="px-6 pb-5 border-t border-gray-100 pt-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs text-gray-400">Tenure Options</p>
                            <p className="text-sm font-bold text-gray-800">{product.tenureOptions.join(', ')} days</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Interest</p>
                            <p className="text-sm font-bold text-accent">
                              {(product.interestRate / 100).toFixed(2)}% ({product.interestType === 'FLAT' ? 'Flat' : 'Reducing'})
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Repayment Period</p>
                            <p className="text-sm font-bold text-gray-800">
                              {product.repaymentPeriodDays === 7 ? 'Weekly' : `Every ${product.repaymentPeriodDays} days`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Min Group Size</p>
                            <p className="text-sm font-bold text-gray-800">{product.minGroupSize}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Fees</p>
                            <p className="text-sm font-bold text-gray-800">
                              {product.feeIds.length === 0 ? '—' : product.feeIds.map((id) => feeNameById.get(id) ?? id).join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                          <span className="font-heading font-bold text-gray-700">Penalty:</span>{' '}
                          {product.penaltyRule.calcType === 'FIXED'
                            ? formatMoneyFromKobo(product.penaltyRule.value)
                            : `${(product.penaltyRule.value / 100).toFixed(2)}% of ${product.penaltyRule.percentageOf?.toLowerCase()}`}
                          , after {product.penaltyRule.gracePeriodDays} grace day{product.penaltyRule.gracePeriodDays === 1 ? '' : 's'}
                          {product.penaltyRule.frequency === 'RECURRING' &&
                            ` — recurring every ${product.penaltyRule.recurrenceIntervalDays} day(s)${
                              product.penaltyRule.maxRecurrences ? `, capped at ${product.penaltyRule.maxRecurrences}x` : ''
                            }`}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            disabled={submitting}
                            onClick={(event) => {
                              event.stopPropagation();
                              setStatusTarget({ product, nextStatus: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-colors disabled:opacity-60 ${
                              product.status === 'ACTIVE'
                                ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                : 'border border-green-200 text-green-600 hover:bg-green-50'
                            }`}>
                            <PowerIcon size={12} />
                            {product.status === 'ACTIVE' ? 'Propose Deactivation' : 'Propose Reactivation'}
                          </button>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <HistoryIcon size={14} className="text-gray-500" />
                            <h4 className="text-sm font-heading font-bold text-gray-700">Change History</h4>
                            {history && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{history.length}</span>}
                          </div>
                          {loadingHistoryId === product.id ? (
                            <p className="text-xs font-body text-gray-400 italic">Loading history...</p>
                          ) : !history || history.length === 0 ? (
                            <p className="text-xs font-body text-gray-400 italic">No proposed changes recorded yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {history.map((entry) => (
                                <div key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                                  <div className="flex items-start gap-2">
                                    <ClockIcon size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <span className="font-medium text-gray-700">{entry.action}</span>
                                      <span className="text-gray-400"> · {new Date(entry.createdAt).toLocaleDateString()}</span>
                                      <span className="ml-2">
                                        <StatusBadge
                                          status={
                                            entry.status === 'APPROVED'
                                              ? 'Approved'
                                              : entry.status === 'REJECTED'
                                                ? 'Rejected'
                                                : entry.status === 'RETURNED_TO_MAKER'
                                                  ? 'Pending'
                                                  : 'Pending Approval'
                                          }
                                        />
                                      </span>
                                    </div>
                                  </div>
                                  {(entry.status === 'PENDING_REVIEW' || entry.status === 'PENDING_APPROVAL') && (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <button
                                        disabled={actingRequestId === entry.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleWorkflowAction(entry.id, product.id, 'APPROVED');
                                        }}
                                        className="px-2 py-1 rounded text-[11px] font-heading font-bold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-60">
                                        Approve
                                      </button>
                                      <button
                                        disabled={actingRequestId === entry.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setRejectTarget({ requestId: entry.id, productId: product.id });
                                        }}
                                        className="px-2 py-1 rounded text-[11px] font-heading font-bold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60">
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
      )}

      <ModalWrapper isOpen={modal.open} onClose={closeModal}>
        <button onClick={closeModal} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <XIcon size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <PackageIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">{modal.editing ? 'Propose Product Update' : 'Propose Loan Product'}</h3>
            <p className="text-xs font-body text-gray-500">{modal.editing ? `${modal.editing.id} — subject to approval` : 'Subject to approval before it goes live'}</p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="e.g. Quick Cash"
              className={inputClass}
            />
            {formik.touched.name && formik.errors.name && <p className="text-xs text-red-600 mt-1">{formik.errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                Interest Rate (% flat, for the full loan tenure) <span className="text-red-500">*</span>
              </label>
              <input
                name="interestRatePercent"
                type="number"
                step="0.01"
                value={formik.values.interestRatePercent}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="e.g. 15.00"
                className={inputClass}
              />
              {formik.touched.interestRatePercent && formik.errors.interestRatePercent && (
                <p className="text-xs text-red-600 mt-1">{formik.errors.interestRatePercent}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Interest Type</label>
              <select name="interestType" value={formik.values.interestType} onChange={formik.handleChange} className={selectClass}>
                {INTEREST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                Tenure Options (days, min. 14) <span className="text-red-500">*</span>
              </label>
              <input
                name="tenureOptionsText"
                value={formik.values.tenureOptionsText}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="14, 30, 60"
                className={inputClass}
              />
              {formik.touched.tenureOptionsText && formik.errors.tenureOptionsText && (
                <p className="text-xs text-red-600 mt-1">{formik.errors.tenureOptionsText}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                Min Group Size <span className="text-red-500">*</span>
              </label>
              <input
                name="minGroupSize"
                type="number"
                min={3}
                value={formik.values.minGroupSize}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={inputClass}
              />
              {formik.touched.minGroupSize && formik.errors.minGroupSize && <p className="text-xs text-red-600 mt-1">{formik.errors.minGroupSize}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
              Repayment Period (days) <span className="text-red-500">*</span>
            </label>
            <input
              name="repaymentPeriodDays"
              type="number"
              min={1}
              value={formik.values.repaymentPeriodDays}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="7"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">7 = weekly. Principal + interest are spread evenly across installments this many days apart; the first repayment falls this many days after disbursement (or cheque pickup).</p>
            {formik.touched.repaymentPeriodDays && formik.errors.repaymentPeriodDays && (
              <p className="text-xs text-red-600 mt-1">{formik.errors.repaymentPeriodDays}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Fees Applied</label>
            {fees.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No fee definitions available yet.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                {fees.map((fee) => (
                  <label key={fee.id} className="flex items-center gap-2 text-sm px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={formik.values.feeIds.includes(fee.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...formik.values.feeIds, fee.id]
                          : formik.values.feeIds.filter((id) => id !== fee.id);
                        formik.setFieldValue('feeIds', next, false);
                      }}
                    />
                    {fee.name}
                    {!fee.active && <span className="text-xs text-gray-400">(inactive)</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-body font-semibold text-gray-700 mb-2 uppercase tracking-wide">Overdue Penalty</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Type</label>
                <select name="penaltyCalcType" value={formik.values.penaltyCalcType} onChange={formik.handleChange} className={selectClass}>
                  {PENALTY_CALC_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  name="penaltyValue"
                  type="number"
                  step="0.01"
                  value={formik.values.penaltyValue}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={formik.values.penaltyCalcType === 'FIXED' ? '500' : '2.5'}
                  className={inputClass}
                />
                {formik.touched.penaltyValue && formik.errors.penaltyValue && <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyValue}</p>}
              </div>
            </div>

            {formik.values.penaltyCalcType === 'PERCENTAGE' && (
              <div className="mt-4">
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                  Percentage Of <span className="text-red-500">*</span>
                </label>
                <select name="penaltyPercentageOf" value={formik.values.penaltyPercentageOf} onChange={formik.handleChange} className={selectClass}>
                  <option value="">Select...</option>
                  {PENALTY_PERCENTAGE_OF_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formik.touched.penaltyPercentageOf && formik.errors.penaltyPercentageOf && (
                  <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyPercentageOf}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Grace Period (days)</label>
                <input
                  name="penaltyGracePeriodDays"
                  type="number"
                  min={0}
                  value={formik.values.penaltyGracePeriodDays}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={inputClass}
                />
                {formik.touched.penaltyGracePeriodDays && formik.errors.penaltyGracePeriodDays && (
                  <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyGracePeriodDays}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Frequency</label>
                <select name="penaltyFrequency" value={formik.values.penaltyFrequency} onChange={formik.handleChange} className={selectClass}>
                  {PENALTY_FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formik.values.penaltyFrequency === 'RECURRING' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
                    Recur Every (days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="penaltyRecurrenceIntervalDays"
                    type="number"
                    min={1}
                    value={formik.values.penaltyRecurrenceIntervalDays}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={inputClass}
                  />
                  {formik.touched.penaltyRecurrenceIntervalDays && formik.errors.penaltyRecurrenceIntervalDays && (
                    <p className="text-xs text-red-600 mt-1">{formik.errors.penaltyRecurrenceIntervalDays}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">Max Recurrences (optional)</label>
                  <input
                    name="penaltyMaxRecurrences"
                    type="number"
                    min={1}
                    value={formik.values.penaltyMaxRecurrences}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="No cap"
                    className={inputClass}
                  />
                </div>
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
              {modal.editing ? 'Propose Changes' : 'Propose Product'}
            </button>
          </div>
        </form>
      </ModalWrapper>

      <ConfirmationModal
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void handleProposeStatusChange()}
        title={statusTarget?.nextStatus === 'INACTIVE' ? 'Propose deactivation?' : 'Propose reactivation?'}
        description={`This proposes a status change for "${statusTarget?.product.name}" — it takes effect once approved.`}
        confirmLabel={submitting ? 'Working...' : 'Propose'}
        confirmVariant={statusTarget?.nextStatus === 'INACTIVE' ? 'danger' : 'primary'}
        icon={<CheckCircleIcon size={20} />}
      />

      <ConfirmationModal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => confirmReject(reason)}
        title="Reject this proposal?"
        description="A reason is required — the person who proposed it will see it."
        icon={<XCircleIcon size={20} className="text-red-600" />}
        confirmLabel="Reject"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="e.g. Interest rate is out of policy range"
        requireInput
      />

      <ConfirmationModal
        isOpen={deleteTargetRequestId !== null}
        onClose={() => setDeleteTargetRequestId(null)}
        onConfirm={() => deleteTargetRequestId && void handleDeleteProposal(deleteTargetRequestId)}
        title="Withdraw this proposal?"
        description="This removes it from the approval queue — nothing was ever created, so there's nothing else to undo. This cannot be reversed."
        icon={<Trash2Icon size={20} className="text-red-600" />}
        confirmLabel="Withdraw"
        confirmVariant="danger"
      />
    </div>
  );
}
