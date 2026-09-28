import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { OtpInput } from '../../../components/OtpInput';

export interface SentClientCode {
  codeId: number;
  sentTo: string | null;
  resendAfterSeconds: number;
}

interface ClientCodeModalProps {
  /** Null = closed. */
  sent: SentClientCode | null;
  amountLabel: string;
  /** Submits the application with the code; resolves to an error message, or null on success. */
  onConfirm: (code: string) => Promise<string | null>;
  /** Sends a fresh code; resolves to an error message, or null on success. */
  onResend: () => Promise<string | null>;
  onClose: () => void;
}

/**
 * Step two of raising a loan for a client when client confirmation codes are on: the client reads
 * back the code they were sent, which names the staff member, product and amount.
 */
export function ClientCodeModal({ sent, amountLabel, onConfirm, onResend, onClose }: ClientCodeModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!sent) return;
    setCode('');
    setError(null);
    setResendIn(sent.resendAfterSeconds);
  }, [sent]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const confirm = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setError(await onConfirm(code));
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    const problem = await onResend();
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <AnimatePresence>
      {sent && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
          >
            <button type="button" onClick={onClose} disabled={busy} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <XIcon size={18} />
            </button>

            <div className="flex items-start gap-3 mb-5">
              <ShieldCheckIcon size={22} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-heading font-bold text-gray-900">Client confirmation</h3>
                <p className="text-sm text-gray-500 mt-1">
                  We sent the client a code{sent.sentTo ? ` at ${sent.sentTo}` : ''} for this {amountLabel} application. Ask them to read it back to you — only
                  enter it if they agreed to this loan.
                </p>
              </div>
            </div>

            <OtpInput value={code} onChange={setCode} disabled={busy} hasError={!!error} autoFocus />
            {error && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}

            <div className="flex items-center justify-between gap-3 mt-6">
              <button type="button" onClick={() => void resend()} disabled={busy || resendIn > 0} className="text-sm text-primary hover:underline disabled:text-gray-400 disabled:no-underline">
                {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy || code.length !== 6}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {busy && <LoaderIcon size={14} className="animate-spin" />}
                Confirm & submit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
