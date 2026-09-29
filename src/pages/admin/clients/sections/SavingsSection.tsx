import { useState } from 'react';
import toast from 'react-hot-toast';
import { PiggyBankIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';
import { formatMoney } from '../../../../utils/money';
import { useClientSavings, type EntryType } from '../../../../hooks/useClientSavings';

const ENTRY_LABELS: Record<EntryType, string> = {
  Contribution: 'Saved from repayment',
  ContributionReversal: 'Repayment reversed',
  Withdrawal: 'Withdrawn',
  EarlyWithdrawalFee: 'Early cash-out charge',
  Forfeiture: 'Forfeited — loan written off',
};

/**
 * The client's loan savings: a share of every repayment on their loans, kept across loans. Withdrawn in
 * full once no loan is running; cashing out while one is keeps back a charge (a setting); writing a loan off forfeits it.
 */
export function SavingsSection({ clientId, onChange }: { clientId: number; onChange?: () => void }) {
  const [version, setVersion] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const savings = useClientSavings(clientId, version);

  if (!savings) return <p className="py-10 text-center text-sm text-gray-400">Loading…</p>;

  const feePercent = `${Number((savings.earlyWithdrawalFeeRate * 100).toFixed(2))}%`;

  const withdraw = async (notes: string | undefined) => {
    setConfirming(false);
    try {
      const { data } = await apiClient.post<{ payout: number; fee: number }>(`/clients/${clientId}/savings/withdraw`, { notes: notes?.trim() || null });
      toast.success(`${formatMoney(data.payout)} paid out${data.fee > 0 ? ` (${formatMoney(data.fee)} kept for cashing out early)` : ''}.`);
      setVersion((v) => v + 1);
      onChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Withdrawal failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PiggyBankIcon size={24} />
        </span>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Savings balance</p>
          <p className="font-heading text-2xl font-bold text-gray-900">{formatMoney(savings.balance)}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {savings.balance <= 0
              ? 'Nothing saved yet — a share of every loan repayment goes here.'
              : savings.hasRunningLoan
                ? `A loan is still running, so cashing out now pays ${formatMoney(savings.withdrawalPayout)} — ${feePercent} (${formatMoney(savings.withdrawalFee)}) is kept.`
                : 'No loan is running, so the whole balance can be withdrawn.'}
          </p>
        </div>
        {savings.canWithdraw && savings.balance > 0 && (
          <button
            onClick={() => setConfirming(true)}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90 sm:self-center"
          >
            Withdraw {formatMoney(savings.withdrawalPayout)}
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-heading font-bold uppercase tracking-widest text-gray-400">History</h3>
        {savings.entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No savings activity yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">What</th>
                  <th className="px-4 py-3 font-medium">Loan</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savings.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-gray-700">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {ENTRY_LABELS[entry.type]}
                      {entry.notes && <span className="block text-xs text-gray-400">{entry.notes}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.loanNumber ?? '—'}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${entry.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {entry.amount < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(entry.amount))}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.createdByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={(notes) => void withdraw(notes)}
        title={`Pay out ${formatMoney(savings.withdrawalPayout)}?`}
        description={
          savings.hasRunningLoan
            ? `The client is cashing out while a loan is still running, so ${feePercent} (${formatMoney(savings.withdrawalFee)}) of their ${formatMoney(savings.balance)} savings is kept. Their savings go to zero.`
            : `The client's whole ${formatMoney(savings.balance)} savings are paid out and the balance goes to zero.`
        }
        inputType="textarea"
        inputLabel="Note (optional) — e.g. how it was paid"
        confirmLabel="Pay out"
      />
    </div>
  );
}
