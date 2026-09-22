import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, MinusIcon, RotateCcwIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';

interface SavingsTransaction {
  id: number;
  transactionType: string | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  reversible: boolean;
  reversed: boolean;
  date: string | null;
  notes: string | null;
}

interface TransactionsSectionProps {
  accountId: number;
  onChanged?: () => void;
}

/** Doubles as the "statement view" — every row already shows the running balance after that transaction. */
export function TransactionsSection({ accountId, onChanged }: TransactionsSectionProps) {
  const [items, setItems] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'deposit' | 'withdrawal' | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reverseTarget, setReverseTarget] = useState<SavingsTransaction | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<SavingsTransaction[]>(`/savings-accounts/${accountId}/transactions`);
      setItems(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleRecord = async () => {
    if (!modal) {
      return;
    }
    try {
      await apiClient.post(`/savings-accounts/${accountId}/transactions/${modal}`, {
        amount: Number(amount),
        date: date || null,
        notes: notes || null,
      });
      toast.success(modal === 'deposit' ? 'Deposit recorded.' : 'Withdrawal recorded.');
      setModal(null);
      setAmount('');
      setDate('');
      setNotes('');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'This withdrawal would take the balance below its minimum (or overdraft limit).');
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) {
      return;
    }
    try {
      await apiClient.post(`/savings-accounts/${accountId}/transactions/${reverseTarget.id}/reverse`);
      toast.success('Transaction reversed.');
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
        <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide">Transactions & Statement</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('deposit')}
            className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <PlusIcon size={16} />
            Deposit
          </button>
          <button
            onClick={() => setModal('withdrawal')}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <MinusIcon size={16} />
            Withdraw
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Debit</th>
              <th className="px-4 py-3 font-medium">Credit</th>
              <th className="px-4 py-3 font-medium">Balance</th>
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
                  <td className="px-4 py-3 text-gray-700">{t.debit?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{t.credit?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{t.balance?.toLocaleString() ?? '—'}</td>
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

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">{modal === 'deposit' ? 'Record Deposit' : 'Record Withdrawal'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
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
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void handleRecord()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                Record
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={reverseTarget !== null}
        onClose={() => setReverseTarget(null)}
        onConfirm={() => void handleReverse()}
        title="Reverse this transaction?"
        description="The account balance will be restored to its pre-transaction state."
        confirmLabel="Reverse"
        confirmVariant="danger"
      />
    </div>
  );
}
