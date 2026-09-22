import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, XCircleIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

interface SavingsCharge {
  id: number;
  chargeType: string;
  penalty: boolean;
  waived: boolean;
  amount: number | null;
  amountPaid: number | null;
  dueDate: string | null;
}

interface ChargesSectionProps {
  accountId: number;
  onChanged?: () => void;
}

const CHARGE_TYPES = ['SavingsActivation', 'WithdrawalFee', 'AnnualFee', 'MonthlyFee', 'SpecifiedDueDate'];

export function ChargesSection({ accountId, onChanged }: ChargesSectionProps) {
  const [items, setItems] = useState<SavingsCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttach, setShowAttach] = useState(false);
  const [chargeType, setChargeType] = useState(CHARGE_TYPES[0]);
  const [penalty, setPenalty] = useState(false);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<SavingsCharge[]>(`/savings-accounts/${accountId}/charges`);
      setItems(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load charges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleAttach = async () => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/charges`, {
        chargeType,
        penalty,
        amount: Number(amount),
        dueDate: dueDate || null,
      });
      toast.success('Charge attached.');
      setShowAttach(false);
      setAmount('');
      setDueDate('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to attach charge.');
    }
  };

  const handlePay = async (charge: SavingsCharge) => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/charges/${charge.id}/pay`, null);
      toast.success('Charge paid.');
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed — this may take the balance below its minimum.');
    }
  };

  const handleWaive = async (charge: SavingsCharge) => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/charges/${charge.id}/waive`, null);
      toast.success('Charge waived.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Waive failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide">Charges</h3>
        <button
          onClick={() => setShowAttach(true)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Attach Charge
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No charges yet.</td></tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{c.chargeType}{c.penalty && <span className="ml-2 text-xs text-red-600">(penalty)</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{c.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{c.dueDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.waived ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Waived</span>
                    ) : (c.amountPaid ?? 0) > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Paid</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Due</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.waived && (c.amountPaid ?? 0) === 0 && (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => void handlePay(c)} className="text-gray-400 hover:text-green-600" aria-label="Pay">
                          <CheckIcon size={16} />
                        </button>
                        <button onClick={() => void handleWaive(c)} className="text-gray-400 hover:text-red-600" aria-label="Waive">
                          <XCircleIcon size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAttach && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Attach Charge</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
                <select
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  {CHARGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                Penalty
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAttach(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void handleAttach()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                Attach
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
