import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon, FileTextIcon, Loader2Icon, XIcon } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { branchFundingService, type BranchFunding } from '../../services/branch-funding/branch-funding.service';

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDateTime(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

interface BranchFundingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  funding: BranchFunding | null;
  branchName?: string;
  /** Manager view can raise a dispute; Admin-tier view can nudge/resolve one. Neither overlaps — a viewer is only ever one or the other for a given funding record. */
  mode: 'manager' | 'admin';
  onVerify?: () => void;
  onReject?: () => void;
  onNudge?: () => void;
  onRaiseDispute?: (reason: string, evidence: File) => Promise<void>;
  onResolveDispute?: (resolution: 'RESOLVED' | 'DISMISSED', note: string) => Promise<void>;
}

/**
 * Shared by the Manager's Branch Management tab (verify/reject/raise a
 * dispute) and the Admin/SuperAdmin's BranchManagement.tsx funding history
 * (nudge/resolve a dispute) — clicking a funding row opens this, matching
 * the click-through convention used everywhere else in this codebase.
 */
export function BranchFundingDetailModal({
  isOpen,
  onClose,
  funding,
  branchName,
  mode,
  onVerify,
  onReject,
  onNudge,
  onRaiseDispute,
  onResolveDispute,
}: BranchFundingDetailModalProps) {
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasOpenDispute = Boolean(funding?.disputeDetails && funding.disputeDetails.resolution === null);

  useEffect(() => {
    setDisputeReason('');
    setDisputeFile(null);
    setResolveNote('');
    setFormError(null);
    setEvidenceUrl(null);
    if (isOpen && funding?.disputeDetails) {
      branchFundingService
        .getDisputeEvidenceUrl(funding.id)
        .then((result) => setEvidenceUrl(result.url))
        .catch(() => setEvidenceUrl(null));
    }
  }, [isOpen, funding]);

  if (!funding) return null;

  async function handleRaiseDispute() {
    if (!disputeReason.trim() || !disputeFile) {
      setFormError('A reason and document evidence are both required to raise a dispute');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onRaiseDispute?.(disputeReason.trim(), disputeFile);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to raise this dispute');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolveDispute(resolution: 'RESOLVED' | 'DISMISSED') {
    if (!resolveNote.trim()) {
      setFormError('A note is required to resolve this dispute');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onResolveDispute?.(resolution, resolveNote.trim());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to resolve this dispute');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-heading font-bold text-gray-900">Funding Record</h3>
                {branchName && <p className="text-xs text-gray-500 mt-0.5">{branchName}</p>}
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XIcon size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                <p className="text-sm font-heading font-bold text-gray-800 mt-1">{formatNaira(funding.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <div className="mt-1">
                  <StatusBadge
                    status={funding.status === 'VERIFIED' ? 'Verified' : funding.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Funded At</p>
                <p className="text-sm text-gray-800 mt-1">{formatDisplayDateTime(funding.fundedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Reference</p>
                <p className="text-sm text-gray-800 mt-1">{funding.reference || '—'}</p>
              </div>
              {funding.status === 'REJECTED' && funding.rejectionReason && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">{funding.rejectionReason}</p>
                </div>
              )}
              {funding.lastNudgedAt && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Last nudged {formatDisplayDateTime(funding.lastNudgedAt)}</p>
                </div>
              )}
            </div>

            {funding.status === 'PENDING_VERIFICATION' && (mode === 'manager' || mode === 'admin') && (
              <div className="flex items-center gap-2 mt-5 pt-5 border-t border-gray-100">
                {mode === 'manager' && onVerify && (
                  <button
                    onClick={onVerify}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-heading font-bold hover:bg-green-700 transition-colors"
                  >
                    Verify
                  </button>
                )}
                {mode === 'manager' && onReject && (
                  <button
                    onClick={onReject}
                    className="flex-1 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-heading font-bold hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                )}
                {mode === 'admin' && onNudge && (
                  <button
                    onClick={onNudge}
                    className="flex-1 px-4 py-2 border border-primary/20 text-primary rounded-lg text-sm font-heading font-bold hover:bg-primary/5 transition-colors"
                  >
                    Nudge Manager
                  </button>
                )}
              </div>
            )}

            {/* Dispute section */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangleIcon size={15} className="text-amber-500" />
                <h4 className="text-sm font-heading font-bold text-gray-900">Dispute</h4>
              </div>

              {funding.disputeDetails ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-sm text-gray-800">{funding.disputeDetails.reason}</p>
                  <p className="text-xs text-gray-500">Raised {formatDisplayDateTime(funding.disputeDetails.raisedAt)}</p>
                  {evidenceUrl && (
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-primary hover:text-primary/80"
                    >
                      <FileTextIcon size={13} /> View evidence document
                    </a>
                  )}

                  {funding.disputeDetails.resolution ? (
                    <p className="text-xs font-body mt-2">
                      <span className={funding.disputeDetails.resolution === 'RESOLVED' ? 'text-green-700' : 'text-gray-500'}>
                        {funding.disputeDetails.resolution === 'RESOLVED' ? 'Resolved' : 'Dismissed'}
                      </span>
                      {funding.disputeDetails.resolutionNote ? `: "${funding.disputeDetails.resolutionNote}"` : ''}
                    </p>
                  ) : mode === 'admin' && onResolveDispute ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        placeholder="Resolution note..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={submitting}
                          onClick={() => void handleResolveDispute('RESOLVED')}
                          className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-heading font-bold hover:bg-green-700 disabled:opacity-60"
                        >
                          Mark Resolved
                        </button>
                        <button
                          disabled={submitting}
                          onClick={() => void handleResolveDispute('DISMISSED')}
                          className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-heading font-bold hover:bg-gray-50 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Awaiting head office's response.</p>
                  )}
                </div>
              ) : mode === 'manager' && onRaiseDispute && funding.status === 'PENDING_VERIFICATION' ? (
                <div className="space-y-2">
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Why are you disputing this funding record?"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setDisputeFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600"
                  />
                  <p className="text-xs text-gray-400">Document evidence is required to raise a dispute.</p>
                  <button
                    disabled={submitting}
                    onClick={() => void handleRaiseDispute()}
                    className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-heading font-bold hover:bg-amber-50 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {submitting && <Loader2Icon size={14} className="animate-spin" />}
                    Raise Dispute
                  </button>
                </div>
              ) : mode === 'manager' && funding.status !== 'PENDING_VERIFICATION' ? (
                <p className="text-xs text-gray-400">
                  A dispute can only be raised while this record is still awaiting your verification — it's already{' '}
                  {funding.status === 'VERIFIED' ? 'been verified' : 'been rejected'}.
                </p>
              ) : (
                <p className="text-xs text-gray-400">No dispute has been raised on this record.</p>
              )}

              {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
              {hasOpenDispute && mode === 'manager' && (
                <p className="text-xs text-gray-400 mt-2">Your dispute is open — it must be resolved before another can be raised.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
