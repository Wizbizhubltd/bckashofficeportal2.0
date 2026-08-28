import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ShieldCheckIcon, CheckCircleIcon, AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { customersService, type Customer, type MismatchFlag } from '../../services/customers/customers.service';

type Step = 'bvn' | 'result' | 'reason';

interface VerifyBvnModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  initialBvn: string;
  /** What the marketer typed at intake (the "Full Name"/"Phone Number" table columns) — sent to the API so the backend can diff it against what the BVN provider resolves. */
  submittedFullName: string;
  submittedPhoneNumber: string;
  /** Fires once the customer is actually created — i.e. after an explicit confirm (whether or not there was a mismatch to decide). Never fires just from a successful BVN lookup. */
  onVerified: (customer: Customer, mismatchFlags: MismatchFlag[]) => void;
  /** Optional — lets the parent also surface a toast for a failed verify/confirm (e.g. a duplicate BVN), in addition to this modal's own inline error. */
  onError?: (message: string) => void;
}

/**
 * A 409 from either call below no longer means only one thing — it's
 * CustomerService's shared conflict status for two distinct guards: "This BVN
 * is already registered to another customer" and "A customer with phone
 * number ... already exists" (see CustomerService.assertPhoneNumberAvailable).
 * Both are already clear, specific messages from the backend, so surface
 * whichever one actually came back instead of guessing/overwriting it.
 */
function describeError(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phoneNumber: 'Phone number',
};

/**
 * The real BC Kash MFB provider has no OTP/consent step — one live BVN
 * lookup (`POST /customers/verify-bvn`) either succeeds (returns the
 * provider's resolved identity + mismatchFlags, held server-side behind a
 * short-lived `previewId` — see VerifyBvnResult's own doc comment) or fails
 * (invalid BVN / provider unavailable / already registered). Deliberately
 * creates no Customer record by itself, even when nothing mismatched — the
 * record is only created once the marketer explicitly confirms via
 * `POST /customers/confirm-bvn-verification`: "Continue" when there's
 * nothing to decide, or a pick between the provider's resolved identity (no
 * justification needed) and what was originally submitted (requires a
 * reason, recorded permanently on the flag for whichever different Admin/
 * Approver reviews this customer later) when there is.
 */
export function VerifyBvnModal({
  isOpen,
  onClose,
  branchId,
  initialBvn,
  submittedFullName,
  submittedPhoneNumber,
  onVerified,
  onError,
}: VerifyBvnModalProps) {
  const [step, setStep] = useState<Step>('bvn');
  const [bvn, setBvn] = useState(initialBvn);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ firstName: string; lastName: string; phoneNumber: string } | null>(null);
  const [mismatchFlags, setMismatchFlags] = useState<MismatchFlag[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('bvn');
      setBvn(initialBvn);
      setPreviewId(null);
      setResolved(null);
      setMismatchFlags([]);
      setReason('');
      setError(null);
    }
  }, [isOpen, initialBvn]);

  async function handleVerify() {
    if (!/^\d{11}$/.test(bvn)) {
      setError('BVN must be exactly 11 digits');
      return;
    }
    if (!branchId) {
      setError('Select a branch on Step 1 first');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await customersService.verifyBvn({
        bvn,
        branchId,
        fullName: submittedFullName || undefined,
        phoneNumber: submittedPhoneNumber || undefined,
      });
      setPreviewId(result.previewId);
      setResolved(result.resolved);
      setMismatchFlags(result.mismatchFlags);
      setStep('result');
    } catch (err) {
      const message = describeError(err, 'Failed to verify BVN');
      setError(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Used both when there's nothing to decide (straight "Continue") and when the marketer explicitly picks "Use API Details" over a flagged mismatch — same call either way. */
  async function handleKeepProviderValue() {
    if (!previewId) return;
    setError(null);
    setIsConfirming(true);
    try {
      const result = await customersService.confirmBvnVerification({
        previewId,
        useSubmittedValues: false,
      });
      onVerified(result.customer, result.mismatchFlags);
      onClose();
    } catch (err) {
      const message = describeError(err, 'Failed to create the customer record');
      setError(message);
      onError?.(message);
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleUseSubmittedValue() {
    if (!previewId) return;
    if (!reason.trim()) {
      setError('A reason is required to use what was submitted');
      return;
    }
    setError(null);
    setIsConfirming(true);
    try {
      const fullNameFlagged = mismatchFlags.some((flag) => flag.field === 'fullName');
      const phoneFlagged = mismatchFlags.some((flag) => flag.field === 'phoneNumber');
      const result = await customersService.confirmBvnVerification({
        previewId,
        useSubmittedValues: true,
        fullName: fullNameFlagged ? submittedFullName : undefined,
        phoneNumber: phoneFlagged ? submittedPhoneNumber : undefined,
        reason: reason.trim(),
      });
      onVerified(result.customer, result.mismatchFlags);
      onClose();
    } catch (err) {
      const message = describeError(err, 'Failed to create the customer record');
      setError(message);
      onError?.(message);
    } finally {
      setIsConfirming(false);
    }
  }

  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-heading font-bold text-gray-900">Verify BVN</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <XIcon size={18} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700 font-body">{error}</div>}

              {step === 'bvn' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-body">BVN</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bvn}
                      onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="12345678901"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {(submittedFullName || submittedPhoneNumber) && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 font-body space-y-0.5">
                      <p className="font-medium text-gray-500 uppercase tracking-wide text-[10px]">Submitted at intake</p>
                      {submittedFullName && <p>Name: {submittedFullName}</p>}
                      {submittedPhoneNumber && <p>Phone: {submittedPhoneNumber}</p>}
                    </div>
                  )}
                  <button
                    onClick={() => void handleVerify()}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2Icon size={14} className="animate-spin" />}
                    Verify BVN
                  </button>
                </>
              )}

              {step === 'result' && resolved && (
                <>
                  <div className="rounded-lg bg-green-50 border border-green-100 p-3 flex items-center gap-2 text-green-700 text-sm font-body">
                    <CheckCircleIcon size={16} /> BVN verified — nothing's been saved yet, confirm below to create the customer record.
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resolved from BVN provider</p>
                    <p className="text-sm text-gray-800"><span className="text-gray-400">Name:</span> {resolved.firstName} {resolved.lastName}</p>
                    <p className="text-sm text-gray-800"><span className="text-gray-400">Phone:</span> {resolved.phoneNumber}</p>
                  </div>

                  {mismatchFlags.length > 0 ? (
                    <>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangleIcon size={13} /> Doesn't match what was submitted
                        </p>
                        {mismatchFlags.map((flag) => (
                          <p key={flag.field} className="text-xs text-amber-800">
                            {FIELD_LABELS[flag.field] ?? flag.field}: submitted "<span className="font-medium">{flag.submitted}</span>", provider says "<span className="font-medium">{flag.providerValue}</span>"
                          </p>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 font-body">Which version should this customer's record use?</p>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={() => void handleKeepProviderValue()}
                          disabled={isConfirming}
                          className="w-full px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {isConfirming && <Loader2Icon size={14} className="animate-spin" />}
                          Use API Details
                        </button>
                        <button
                          onClick={() => setStep('reason')}
                          disabled={isConfirming}
                          className="w-full px-4 py-2.5 bg-white border border-primary/30 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60"
                        >
                          Use What I Typed
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {(submittedFullName || submittedPhoneNumber) && (
                        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-700 font-body">
                          Matches what was submitted at intake.
                        </div>
                      )}
                      <button
                        onClick={() => void handleKeepProviderValue()}
                        disabled={isConfirming}
                        className="w-full px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {isConfirming ? <Loader2Icon size={16} className="animate-spin" /> : <ShieldCheckIcon size={16} />}
                        {isConfirming ? 'Creating...' : 'Continue'}
                      </button>
                    </>
                  )}
                </>
              )}

              {step === 'reason' && resolved && (
                <>
                  <div className="rounded-lg border border-gray-100 p-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Will be recorded as</p>
                    {submittedFullName && mismatchFlags.some((f) => f.field === 'fullName') && (
                      <p className="text-sm text-gray-800"><span className="text-gray-400">Name:</span> {submittedFullName}</p>
                    )}
                    {submittedPhoneNumber && mismatchFlags.some((f) => f.field === 'phoneNumber') && (
                      <p className="text-sm text-gray-800"><span className="text-gray-400">Phone:</span> {submittedPhoneNumber}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-body">Reason for using the submitted details over the provider's</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Customer confirmed their legal name in person; BVN record uses a maiden name..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep('result')}
                      disabled={isConfirming}
                      className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => void handleUseSubmittedValue()}
                      disabled={isConfirming || !reason.trim()}
                      className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isConfirming && <Loader2Icon size={14} className="animate-spin" />}
                      Confirm
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
