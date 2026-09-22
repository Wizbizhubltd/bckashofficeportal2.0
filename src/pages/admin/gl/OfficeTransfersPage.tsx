import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';

interface Office {
  id: number;
  name: string | null;
}

interface GlAccountOption {
  id: number;
  name: string | null;
  glCode: string | null;
}

interface OfficeTransaction {
  id: number;
  fromOfficeId: number | null;
  toOfficeId: number | null;
  amount: number | null;
  date: string | null;
  notes: string | null;
}

export function OfficeTransfersPage() {
  const [transfers, setTransfers] = useState<OfficeTransaction[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [accounts, setAccounts] = useState<GlAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [fromOfficeId, setFromOfficeId] = useState('');
  const [toOfficeId, setToOfficeId] = useState('');
  const [glAccountId, setGlAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<OfficeTransaction[]>('/gl/office-transfers');
      setTransfers(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load transfers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    apiClient.get<Office[]>('/offices').then((r) => setOffices(r.data)).catch(() => undefined);
    apiClient.get<GlAccountOption[]>('/gl-accounts').then((r) => setAccounts(r.data)).catch(() => undefined);
  }, []);

  const officeName = (id: number | null) => offices.find((o) => o.id === id)?.name ?? `Office #${id}`;

  const handleCreate = async () => {
    try {
      await apiClient.post('/gl/office-transfers', {
        fromOfficeId: Number(fromOfficeId), toOfficeId: Number(toOfficeId), currencyId: null,
        amount: Number(amount), glAccountId: Number(glAccountId), date, notes: notes || null,
      });
      toast.success('Transfer recorded and posted.');
      setShowCreate(false);
      setFromOfficeId('');
      setToOfficeId('');
      setGlAccountId('');
      setAmount('');
      setDate('');
      setNotes('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record transfer.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Office Transfers</h1>
          <p className="text-sm text-gray-500 mt-1">FR-GL-5. Posts a balanced pair of journal entries against the chosen clearing account for both offices.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          New Transfer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No transfers yet.</td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{officeName(t.fromOfficeId)}</td>
                  <td className="px-4 py-3 text-gray-700">{officeName(t.toOfficeId)}</td>
                  <td className="px-4 py-3 text-gray-700">{t.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{t.date}</td>
                  <td className="px-4 py-3 text-gray-500">{t.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">New Office Transfer</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Office</label>
                <select value={fromOfficeId} onChange={(e) => setFromOfficeId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="">— Select —</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Office</label>
                <select value={toOfficeId} onChange={(e) => setToOfficeId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="">— Select —</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clearing GL Account</label>
                <select value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="">— Select —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.glCode ? `${a.glCode} — ${a.name}` : a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!fromOfficeId || !toOfficeId || !glAccountId || !amount || !date}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
