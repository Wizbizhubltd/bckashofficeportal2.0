import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { CheckCircle2Icon, FileTextIcon, LoaderIcon, ShieldAlertIcon, XIcon } from 'lucide-react';
import apiClient from '../api/apiClient';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { formatMoney } from '../utils/money';

type Status = 'PendingAcknowledgement' | 'Acknowledged' | 'Disputed' | 'Cancelled';

interface Funding {
  id: number;
  officeName: string | null;
  amount: number;
  reference: string;
  fundedOn: string;
  bankAccountLabel: string | null;
  notes: string | null;
  status: Status;
  fundedByName: string | null;
  createdAt: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  disputedAt: string | null;
  disputeReason: string | null;
  disputeDocumentName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

const STATUS: Record<Status, { label: string; className: string }> = {
  PendingAcknowledgement: { label: 'Needs your acknowledgement', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  Acknowledged: { label: 'Acknowledged', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Disputed: { label: 'Disputed', className: 'bg-red-50 text-red-700 border-red-200' },
  Cancelled: { label: 'Cancelled', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const MAX_BYTES = 10 * 1024 * 1024;
const when = (value: string | null) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

async function openStatement(fundingId: number) {
  try {
    const response = await apiClient.get<Blob>(`/office-fundings/${fundingId}/statement`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error('Could not open the bank statement.');
  }
}

function DisputeModal({ funding, onClose, onDone }: { funding: Funding | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fileProblem = file && file.size > MAX_BYTES ? 'The bank statement must be 10 MB or smaller.' : null;
  const ready = reason.trim().length >= 10 && !!file && !fileProblem;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!funding || !file || !ready) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('reason', reason.trim());
      form.append('statement', file);
      await apiClient.post(`/office-fundings/${funding.id}/dispute`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Dispute sent. The funding won’t count towards the office’s funds until it’s resolved.');
      setReason('');
      setFile(null);
      await onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send the dispute.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {funding && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.form onSubmit={submit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <button type="button" onClick={onClose} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <XIcon size={18} />
            </button>
            <div>
              <h3 className="text-lg font-heading font-bold text-gray-900">Dispute this funding</h3>
              <p className="text-sm text-gray-500 mt-1">
                {formatMoney(funding.amount)} · reference <span className="font-mono">{funding.reference}</span>. Explain what’s wrong and attach the office’s bank statement for the period.
              </p>
            </div>
            <label className="block">
              <span className="block text-sm text-gray-800 mb-1">Why are you disputing it?</span>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`e.g. Only ${formatMoney(150_000)} arrived, not ${formatMoney(200_000)}.`}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              <span className="block text-xs text-gray-500 mt-1">At least 10 characters.</span>
            </label>
            <label className="block">
              <span className="block text-sm text-gray-800 mb-1">Bank statement</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-sm"
              />
              <span className={`block text-xs mt-1 ${fileProblem ? 'text-red-600' : 'text-gray-500'}`}>{fileProblem ?? 'PDF, JPG or PNG, up to 10 MB.'}</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || !ready} className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {saving && <LoaderIcon size={14} className="animate-spin" />}
                Send dispute
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** For branch managers: acknowledge or dispute the funding sent to the offices they manage. */
export function OfficeFundingPage() {
  const [fundings, setFundings] = useState<Funding[] | null>(null);
  const [acknowledging, setAcknowledging] = useState<Funding | null>(null);
  const [disputing, setDisputing] = useState<Funding | null>(null);

  const load = async () => {
    try {
      const { data } = await apiClient.get<Funding[]>('/office-fundings/mine');
      setFundings(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load office funding.');
      setFundings([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const acknowledge = async (funding: Funding, comment?: string) => {
    try {
      await apiClient.post(`/office-fundings/${funding.id}/acknowledge`, { comment: comment ?? null });
      toast.success(`${formatMoney(funding.amount)} acknowledged — it’s now in the office’s funds.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to acknowledge.');
    }
  };

  const waiting = fundings?.filter((f) => f.status === 'PendingAcknowledgement').length ?? 0;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold text-primary">Office Funding</h1>
        <p className="text-sm text-gray-500 mt-1">
          Funding sent to the offices you manage. Check it arrived in the office’s account, then acknowledge it — or dispute it with the bank statement if it didn’t arrive as described.
        </p>
      </div>

      {waiting > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <ShieldAlertIcon size={16} />
          {waiting} funding{waiting === 1 ? '' : 's'} waiting for your acknowledgement.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Office</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fundings === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : fundings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No funding yet. Funding appears here for offices where you’re the branch manager.
                </td>
              </tr>
            ) : (
              fundings.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="px-4 py-3 text-gray-800 font-medium">{f.officeName ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                    {formatMoney(f.amount)}
                    <span className="block text-xs text-gray-400">sent {f.fundedOn}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="font-mono text-xs">{f.reference}</span>
                    {f.bankAccountLabel && <span className="block text-xs text-gray-400">to {f.bankAccountLabel}</span>}
                    <span className="block text-xs text-gray-400">
                      by {f.fundedByName ?? '—'} · {when(f.createdAt)}
                    </span>
                    {f.notes && <span className="block text-xs text-gray-500">{f.notes}</span>}
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${STATUS[f.status].className}`}>{STATUS[f.status].label}</span>
                    {f.acknowledgedAt && <p className="text-xs text-gray-500">{when(f.acknowledgedAt)}</p>}
                    {f.disputeReason && <p className="text-xs text-red-700">“{f.disputeReason}”</p>}
                    {f.cancelReason && <p className="text-xs text-gray-500">Cancelled: “{f.cancelReason}”</p>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-y-1">
                    {(f.status === 'PendingAcknowledgement' || f.status === 'Disputed') && (
                      <button type="button" onClick={() => setAcknowledging(f)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                        <CheckCircle2Icon size={12} />
                        Acknowledge
                      </button>
                    )}
                    {f.status === 'PendingAcknowledgement' && (
                      <button type="button" onClick={() => setDisputing(f)} className="block ml-auto text-xs text-red-600 hover:underline">
                        Dispute
                      </button>
                    )}
                    {f.disputeDocumentName && (
                      <button type="button" onClick={() => void openStatement(f.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <FileTextIcon size={12} />
                        Statement
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!acknowledging}
        onClose={() => setAcknowledging(null)}
        onConfirm={(comment) => {
          const target = acknowledging;
          setAcknowledging(null);
          if (target) void acknowledge(target, comment);
        }}
        title={acknowledging ? `Acknowledge ${formatMoney(acknowledging.amount)}?` : 'Acknowledge'}
        description="Confirm the money is in the office’s bank account. It will then count towards the office’s funds for loans. This can’t be undone."
        inputType="textarea"
        inputLabel="Comment (optional)"
        confirmLabel="Acknowledge"
        confirmVariant="primary"
      />
      <DisputeModal funding={disputing} onClose={() => setDisputing(null)} onDone={load} />
    </div>
  );
}
