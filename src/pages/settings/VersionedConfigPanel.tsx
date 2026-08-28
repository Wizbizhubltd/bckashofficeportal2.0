import { useEffect, useState } from 'react';
import { useFormik, type FormikProps, type FormikValues } from 'formik';
import type * as Yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, CircleXIcon, ClockIcon, HistoryIcon, Loader2Icon, PlusIcon, XCircleIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';
import type { WorkflowRequestDetail, WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.types';

/**
 * Shared shell for the three Settings > "Loan Configuration" / "Repayment &
 * Penalties" / "Branch Rules" panels — each backs a *versioned* singleton
 * config entity (see platform-config.types.ts's own doc comment): proposing
 * a change is workflow-mediated, never in-place, and on approval a
 * brand-new record becomes ACTIVE while whichever record was previously
 * ACTIVE (if any) flips to INACTIVE.
 *
 * "Approved" tab = every real persisted version (the full history — who
 * proposed/approved each one, and when); "Pending" tab = still-in-flight
 * proposals, same GET pending-all/:entityType pattern LoanProductsCrud.tsx
 * established, including the same "the maker can't approve their own
 * proposal" hide-the-buttons rule.
 */

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

interface VersionedConfigRecord {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  proposedBy: string;
  proposedAt: string;
  approvedBy: string;
  approvedAt: string;
}

export function ModalWrapper({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

/** "You" for the signed-in staff member, otherwise a shortened id — this app has no staff-directory-by-id lookup on the frontend yet, same limitation noted on every other "who did this" display in Settings. */
function ActorLabel({ actorId }: { actorId: string }) {
  const { user } = useAuth();
  if (user?.id === actorId) return <span>You</span>;
  return <span title={actorId}>{actorId.slice(-6)}</span>;
}

interface VersionedConfigPanelProps<TRecord extends VersionedConfigRecord, TPayload, TFormValues extends FormikValues> {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** WorkflowEntityType string, e.g. 'LOAN_CONFIG' — feeds GET /workflow-requests/pending-all/:entityType. */
  entityType: string;
  listRecords: () => Promise<TRecord[]>;
  proposeRecord: (payload: TPayload) => Promise<WorkflowRequestSummary>;
  emptyFormValues: TFormValues;
  /** Prefills the "propose new version" form from the current ACTIVE record, so a maker edits forward from the live values instead of starting blank. */
  toFormValues: (record: TRecord) => TFormValues;
  buildPayload: (values: TFormValues) => TPayload;
  validationSchema: Yup.ObjectSchema<Record<string, unknown>>;
  renderFields: (formik: FormikProps<TFormValues>) => React.ReactNode;
  renderRecordSummary: (record: TRecord) => React.ReactNode;
  /** Best-effort read of a pending proposal's payload for the Pending tab preview — payload shape is whatever the CREATE DTO put there, not formally typed on this side. */
  renderPendingSummary: (payload: Record<string, unknown>) => React.ReactNode;
}

export function VersionedConfigPanel<TRecord extends VersionedConfigRecord, TPayload, TFormValues extends FormikValues>({
  title,
  description,
  icon,
  entityType,
  listRecords,
  proposeRecord,
  emptyFormValues,
  toFormValues,
  buildPayload,
  validationSchema,
  renderFields,
  renderRecordSummary,
  renderPendingSummary,
}: VersionedConfigPanelProps<TRecord, TPayload, TFormValues>) {
  const { user } = useAuth();
  const [view, setView] = useState<'approved' | 'pending' | 'rejected'>('approved');

  const [records, setRecords] = useState<TRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<WorkflowRequestSummary[]>([]);
  const [pendingDetails, setPendingDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  // A reason is required server-side to reject — captured via this modal
  // rather than acting immediately on click.
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // Rejected tab — a rejected CREATE never persists a domain record, so this
  // (via GET rejected-all/:entityType) is the only place that outcome is
  // visible at all once it leaves Pending. Read-only: nothing to act on.
  const [rejectedRequests, setRejectedRequests] = useState<WorkflowRequestSummary[]>([]);
  const [rejectedDetails, setRejectedDetails] = useState<Record<string, WorkflowRequestDetail>>({});
  const [isLoadingRejected, setIsLoadingRejected] = useState(true);

  const loadRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRecords(await listRecords());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : `Failed to load ${title}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPending = async () => {
    setIsLoadingPending(true);
    try {
      const requests = await workflowRequestsService.getPendingByEntityType(entityType);
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
      const requests = await workflowRequestsService.getRejectedByEntityType(entityType);
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
    void loadRecords();
    void loadPending();
    void loadRejected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const formik = useFormik<TFormValues>({
    initialValues: emptyFormValues,
    validationSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        await proposeRecord(buildPayload(values));
        toast.success(`New ${title} version proposed — awaiting approval before it takes effect.`);
        setModalOpen(false);
        formik.resetForm({ values: emptyFormValues });
        await Promise.all([loadRecords(), loadPending()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to propose a ${title} version`);
      } finally {
        setSubmitting(false);
      }
    },
  });

  function openProposeModal() {
    const active = records.find((record) => record.status === 'ACTIVE');
    formik.resetForm({ values: active ? toFormValues(active) : emptyFormValues });
    setModalOpen(true);
  }

  function closeModal() {
    formik.resetForm({ values: emptyFormValues });
    setModalOpen(false);
  }

  async function handleWorkflowAction(requestId: string, action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActingRequestId(requestId);
    try {
      await workflowRequestsService.act(requestId, { action, comment });
      await Promise.all([loadRecords(), loadPending(), loadRejected()]);
      if (action === 'APPROVED') {
        // It doesn't just vanish from Pending — jump the viewer straight to
        // where it actually landed, instead of leaving them staring at a
        // Pending tab with one fewer row and no visible destination.
        setView('approved');
        toast.success('Approved — now showing in Approved.');
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
    if (!rejectTargetId || !comment?.trim()) return;
    void handleWorkflowAction(rejectTargetId, 'REJECTED', comment.trim());
    setRejectTargetId(null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">{icon}</div>
            <div>
              <h3 className="text-lg font-heading font-bold text-gray-900">{title}</h3>
              <p className="text-sm font-body text-gray-500 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            onClick={openProposeModal}
            disabled={submitting || isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-heading font-bold hover:bg-[#e64a19] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0">
            <PlusIcon size={14} />
            Propose New Version
          </button>
        </div>

        <div className="px-6 pt-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 mb-4">
            Proposing a new version doesn't edit the current one — it takes effect (and supersedes whatever is
            currently active) only once an Admin, SuperAdmin, or Approver approves it. The person who proposed it
            can't approve their own proposal.
          </div>

          <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setView('approved')}
              className={`px-4 py-1.5 text-sm font-body rounded-md transition-colors ${view === 'approved' ? 'bg-white text-primary font-bold shadow-sm' : 'text-gray-500'}`}>
              Approved ({records.length})
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
        </div>

        {loadError && <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

        <div className="px-6 py-5">
          {view === 'pending' ? (
            <div className="space-y-3">
              {isLoadingPending ? (
                <p className="text-sm text-gray-500 text-center py-8">Loading pending requests...</p>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-10">
                  <ClockIcon size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-heading font-bold text-gray-500">Nothing awaiting approval</p>
                  <p className="text-xs font-body text-gray-400 mt-1">A newly proposed version shows up here until it's approved or rejected.</p>
                </div>
              ) : (
                pendingRequests.map((entry) => {
                  const detail = pendingDetails[entry.id];
                  const isOwnProposal = user?.id === entry.initiatedBy;
                  return (
                    <div key={entry.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <ClockIcon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-body text-gray-700">
                              {detail ? renderPendingSummary(detail.payload) : 'Loading...'}
                            </span>
                            {isOwnProposal && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-heading font-medium bg-blue-50 text-blue-600">Your proposal</span>
                            )}
                          </div>
                          <p className="text-xs font-body text-gray-400 mt-0.5">
                            Proposed by <ActorLabel actorId={entry.initiatedBy} /> · {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {isOwnProposal ? (
                        <p className="text-xs font-body text-gray-400 flex-shrink-0 text-right max-w-[160px]">
                          Awaiting another Admin/SuperAdmin/Approver's review.
                        </p>
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
                <p className="text-sm text-gray-500 text-center py-8">Loading rejected requests...</p>
              ) : rejectedRequests.length === 0 ? (
                <div className="text-center py-10">
                  <CircleXIcon size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-heading font-bold text-gray-500">Nothing rejected</p>
                  <p className="text-xs font-body text-gray-400 mt-1">A rejected proposal never takes effect — it shows up here instead of a version.</p>
                </div>
              ) : (
                rejectedRequests.map((entry) => {
                  const detail = rejectedDetails[entry.id];
                  const rejectionStep = entry.steps.find((step) => step.action === 'REJECTED');
                  return (
                    <div key={entry.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                          <CircleXIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-body text-gray-700">{detail ? renderPendingSummary(detail.payload) : 'Loading...'}</span>
                          <p className="text-xs font-body text-gray-400 mt-0.5">
                            Proposed by <ActorLabel actorId={entry.initiatedBy} /> · {new Date(entry.createdAt).toLocaleDateString()}
                          </p>
                          {rejectionStep?.actedBy && (
                            <p className="text-xs font-body text-red-600 mt-1.5">
                              Rejected by <ActorLabel actorId={rejectionStep.actedBy} />
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
                <p className="text-sm text-gray-500 text-center py-8">Loading versions...</p>
              ) : records.length === 0 ? (
                <div className="text-center py-10">
                  <HistoryIcon size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-heading font-bold text-gray-500">No version has ever been approved</p>
                  <p className="text-xs font-body text-gray-400 mt-1">Propose one to get started.</p>
                </div>
              ) : (
                records.map((record) => (
                  <div key={record.id} className={`rounded-xl border p-4 ${record.status === 'ACTIVE' ? 'border-primary/20 bg-primary/[0.03]' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <StatusBadge status={record.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
                      <div className="text-right text-xs font-body text-gray-400">
                        <p>
                          Proposed by <ActorLabel actorId={record.proposedBy} /> · {new Date(record.proposedAt).toLocaleDateString()}
                        </p>
                        <p>
                          Approved by <ActorLabel actorId={record.approvedBy} /> · {new Date(record.approvedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {renderRecordSummary(record)}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ModalWrapper isOpen={modalOpen} onClose={closeModal}>
        <button onClick={closeModal} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <XIcon size={18} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
          <div>
            <h3 className="text-lg font-heading font-bold text-gray-900">Propose {title} Version</h3>
            <p className="text-xs font-body text-gray-500">Subject to approval before it goes live</p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
          {renderFields(formik)}

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
              Propose Version
            </button>
          </div>
        </form>
      </ModalWrapper>

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
        inputPlaceholder="e.g. Numbers don't match the approved budget"
        requireInput
      />
    </div>
  );
}

export function ToggleField({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-body font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 font-body">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/30 ${enabled ? 'bg-primary' : 'bg-gray-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export { inputClass };
