import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2Icon, HourglassIcon, LandmarkIcon, PlusIcon, RotateCcwIcon, XCircleIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';
import { formatMoney } from '../../../../utils/money';
import { sanitizeDecimal } from '../../../../utils/numeric';

interface LoanTransaction {
  id: number;
  transactionType: string | null;
  amount: number | null;
  principal: number | null;
  interest: number | null;
  fee: number | null;
  penalty: number | null;
  overpayment: number | null;
  date: string | null;
  reversible: boolean;
  reversed: boolean;
  notes: string | null;
}

/** Where the customer pays: the loan's office default bank account (set in the control portal's Office Funding). */
interface RepaymentAccount {
  officeName: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  /** The most that can be recorded now: what's still owed, less repayments already waiting for confirmation. */
  maxRepayment: number | null;
}

/** A repayment staff recorded, waiting for (or past) the office manager's confirmation. */
interface RepaymentSubmission {
  id: number;
  amount: number;
  paymentDate: string | null;
  notes: string | null;
  status: 'Pending' | 'Approved' | 'Disputed';
  submittedByName: string | null;
  submittedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  disputeReason: string | null;
  canReview: boolean;
}

interface RepaymentsSectionProps {
  loanId: number;
  onChanged?: () => void;
}

export function RepaymentsSection({ loanId, onChanged }: RepaymentsSectionProps) {
  const [items, setItems] = useState<LoanTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecord, setShowRecord] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reverseTarget, setReverseTarget] = useState<LoanTransaction | null>(null);
  const [payInto, setPayInto] = useState<RepaymentAccount | 'loading' | 'failed'>('loading');
  const [submissions, setSubmissions] = useState<RepaymentSubmission[]>([]);
  const [disputeTarget, setDisputeTarget] = useState<RepaymentSubmission | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [response, waiting] = await Promise.all([
        apiClient.get<LoanTransaction[]>(`/loans/${loanId}/repayments`),
        apiClient.get<RepaymentSubmission[]>(`/loans/${loanId}/repayments/submissions`).catch(() => ({ data: [] as RepaymentSubmission[] })),
      ]);
      setItems(response.data);
      setSubmissions(waiting.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const openRecord = () => {
    setShowRecord(true);
    setPayInto('loading');
    apiClient
      .get<RepaymentAccount>(`/loans/${loanId}/repayments/pay-into`)
      .then((response) => setPayInto(response.data))
      .catch(() => setPayInto('failed'));
  };

  const maxRepayment = typeof payInto === 'object' ? payInto.maxRepayment : null;
  const amountValue = Number(amount);
  const amountProblem =
    maxRepayment === 0
      ? 'Nothing is left to pay on this loan.'
      : !amount.trim()
        ? null
        : !Number.isFinite(amountValue) || amountValue <= 0
          ? 'Enter an amount greater than zero.'
          : maxRepayment !== null && amountValue > maxRepayment
            ? `That's more than the client still owes — at most ${formatMoney(maxRepayment)}.`
            : null;

  const handleRecord = async () => {
    try {
      const response = await apiClient.post(`/loans/${loanId}/repayments`, {
        amount: Number(amount),
        paymentTypeId: null,
        date: date || null,
        notes: notes || null,
      });
      // 202: it waits for the office manager to confirm the money arrived before it counts.
      toast.success(response.status === 202 ? 'Repayment recorded — waiting for the office manager to confirm it.' : 'Repayment recorded.');
      setShowRecord(false);
      setAmount('');
      setDate('');
      setNotes('');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record repayment.');
    }
  };

  const review = async (submission: RepaymentSubmission, action: 'approve' | 'dispute', reason?: string) => {
    setDisputeTarget(null);
    try {
      await apiClient.post(`/loans/${loanId}/repayments/submissions/${submission.id}/${action}`, action === 'dispute' ? { reason } : undefined);
      toast.success(action === 'approve' ? 'Repayment confirmed and applied to the loan.' : 'Repayment disputed.');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) {
      return;
    }
    try {
      await apiClient.post(`/loans/${loanId}/repayments/${reverseTarget.id}/reverse`);
      toast.success('Repayment reversed.');
      setReverseTarget(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reversal failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide">Transactions</h3>
        <button
          onClick={openRecord}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Record Repayment
        </button>
      </div>

      {submissions.some((s) => s.status !== 'Approved') && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-heading font-bold uppercase tracking-wide text-gray-500">Repayments awaiting confirmation</h3>
          <ul className="space-y-2">
            {submissions
              .filter((s) => s.status !== 'Approved')
              .map((s) => (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                    s.status === 'Pending' ? 'border-amber-200 bg-amber-50/60' : 'border-red-200 bg-red-50/60'
                  }`}
                >
                  {s.status === 'Pending' ? <HourglassIcon size={18} className="text-amber-600" /> : <XCircleIcon size={18} className="text-red-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {formatMoney(s.amount)} <span className="font-normal text-gray-500">paid {s.paymentDate ?? '—'}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Recorded by {s.submittedByName ?? 'staff'}
                      {s.notes ? ` · “${s.notes}”` : ''}
                    </p>
                    {s.status === 'Pending' ? (
                      <p className="text-xs text-amber-700">Not counted yet — waiting for the office manager to confirm the money arrived.</p>
                    ) : (
                      <p className="text-xs text-red-700">
                        Disputed by {s.reviewedByName ?? 'the manager'}: “{s.disputeReason}”. It doesn’t count against the loan.
                      </p>
                    )}
                  </div>
                  {s.canReview && (
                    <div className="flex gap-2">
                      <button onClick={() => setDisputeTarget(s)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        Dispute
                      </button>
                      <button
                        onClick={() => void review(s, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        <CheckCircle2Icon size={14} /> Confirm received
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Principal</th>
              <th className="px-4 py-3 font-medium">Interest</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No transactions yet.</td></tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{t.transactionType}</td>
                  <td className="px-4 py-3 text-gray-700">{t.date}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(t.amount)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(t.principal)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(t.interest)}</td>
                  <td className="px-4 py-3">
                    {t.reversed ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Reversed</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.reversible && !t.reversed && (
                      <button onClick={() => setReverseTarget(t)} className="text-gray-400 hover:text-red-600" aria-label="Reverse">
                        <RotateCcwIcon size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Record Repayment</h2>
            <div className="mb-4 flex gap-3 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
              <LandmarkIcon size={18} className="mt-0.5 flex-shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Customer pays into</p>
                {payInto === 'loading' ? (
                  <p className="text-gray-400">Loading…</p>
                ) : payInto === 'failed' ? (
                  <p className="text-gray-500">Couldn’t load the office’s account.</p>
                ) : payInto.accountNumber ? (
                  <>
                    <p className="font-heading text-base font-bold tracking-wide text-gray-900">{payInto.accountNumber}</p>
                    <p className="text-gray-700">
                      {payInto.accountName} · {payInto.bankName}
                    </p>
                    {payInto.officeName && <p className="text-xs text-gray-400">{payInto.officeName}’s default account</p>}
                  </>
                ) : (
                  <p className="text-gray-500">{payInto.officeName ?? 'This office'} has no default bank account yet — a super admin sets one under Office Funding.</p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                  {maxRepayment !== null && maxRepayment > 0 && (
                    <button type="button" onClick={() => setAmount(String(maxRepayment))} className="text-xs text-primary hover:underline">
                      Remaining: {formatMoney(maxRepayment)}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(sanitizeDecimal(e.target.value))}
                  disabled={maxRepayment === 0}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50 ${amountProblem ? 'border-red-300' : 'border-gray-300'}`}
                />
                {amountProblem && <p className="mt-1 text-xs text-red-600">{amountProblem}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowRecord(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleRecord()}
                disabled={!amount.trim() || amountProblem !== null || payInto === 'loading'}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Record
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={disputeTarget !== null}
        onClose={() => setDisputeTarget(null)}
        onConfirm={(reason) => disputeTarget && void review(disputeTarget, 'dispute', reason)}
        title="Dispute this repayment?"
        description={`${disputeTarget ? formatMoney(disputeTarget.amount) : 'It'} won’t count against the loan. ${disputeTarget?.submittedByName ?? 'Whoever recorded it'} will be told why.`}
        inputType="textarea"
        inputLabel="What's wrong — e.g. no such deposit on the statement"
        requireInput
        confirmLabel="Dispute"
        confirmVariant="danger"
      />

      <ConfirmationModal
        isOpen={reverseTarget !== null}
        onClose={() => setReverseTarget(null)}
        onConfirm={() => void handleReverse()}
        title="Reverse this transaction?"
        description="The schedule and any paid amounts it covered will be restored to their pre-transaction state."
        confirmLabel="Reverse"
        confirmVariant="danger"
      />
    </div>
  );
}
