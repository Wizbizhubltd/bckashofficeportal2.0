import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, CheckIcon, RotateCcwIcon, TrashIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { ConfirmationModal } from '../../../components/ConfirmationModal';

interface GlAccountOption {
  id: number;
  name: string | null;
  glCode: string | null;
}

interface GlJournalEntry {
  id: number;
  officeId: number | null;
  glAccountId: number | null;
  glAccountName: string | null;
  transactionType: string | null;
  debit: number | null;
  credit: number | null;
  reversed: boolean;
  reference: string | null;
  loanId: number | null;
  date: string | null;
  narration: string | null;
  manualEntry: boolean;
  approved: boolean;
}

interface LineDraft {
  glAccountId: string;
  side: 'debit' | 'credit';
  amount: string;
}

const EMPTY_LINE: LineDraft = { glAccountId: '', side: 'debit', amount: '' };

export function JournalEntriesPage() {
  const [entries, setEntries] = useState<GlJournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GlAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState('');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [reverseTarget, setReverseTarget] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<GlJournalEntry[]>('/gl/journal-entries');
      setEntries(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load journal entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    apiClient.get<GlAccountOption[]>('/gl-accounts').then((r) => setAccounts(r.data)).catch(() => undefined);
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + (l.side === 'debit' ? Number(l.amount) || 0 : 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.side === 'credit' ? Number(l.amount) || 0 : 0), 0);
  const balanced = lines.length >= 2 && totalDebit === totalCredit && totalDebit > 0;

  const handleCreate = async () => {
    try {
      await apiClient.post('/gl/journal-entries', {
        officeId: null,
        date,
        narration,
        lines: lines
          .filter((l) => l.glAccountId && Number(l.amount) > 0)
          .map((l) => ({ glAccountId: Number(l.glAccountId), debit: l.side === 'debit' ? Number(l.amount) : null, credit: l.side === 'credit' ? Number(l.amount) : null })),
      });
      toast.success('Manual journal entry created — pending approval.');
      setShowCreate(false);
      setDate('');
      setNarration('');
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create journal entry.');
    }
  };

  const handleApprove = async (reference: string) => {
    try {
      await apiClient.post(`/gl/journal-entries/${reference}/approve`, { notes: null });
      toast.success('Journal entry approved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed.');
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) {
      return;
    }
    try {
      await apiClient.post(`/gl/journal-entries/${reverseTarget}/reverse`);
      toast.success('Journal entry reversed.');
      setReverseTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reversal failed.');
    }
  };

  const groupedByReference = Object.values(
    entries.reduce<Record<string, GlJournalEntry[]>>((groups, e) => {
      const key = e.reference ?? `#${e.id}`;
      (groups[key] ??= []).push(e);
      return groups;
    }, {}),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-1">FR-GL-2/FR-GL-3. System-posted entries (loans, transfers) are pre-approved; manual entries need approval before they count toward reports.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Manual Entry
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Debit</th>
              <th className="px-4 py-3 font-medium">Credit</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : groupedByReference.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No journal entries yet.</td></tr>
            ) : (
              groupedByReference.map((batch) => {
                const first = batch[0];
                return batch.map((e, index) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{index === 0 ? e.reference : ''}</td>
                    <td className="px-4 py-3 text-gray-700">{e.date}</td>
                    <td className="px-4 py-3 text-gray-700">{e.transactionType}</td>
                    <td className="px-4 py-3 text-gray-700">{e.glAccountName}</td>
                    <td className="px-4 py-3 text-gray-700">{e.debit?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{e.credit?.toLocaleString() ?? '—'}</td>
                    <td className="px-4 py-3">
                      {e.reversed ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Reversed</span>
                      ) : e.approved ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Approved</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {index === 0 && (
                        <div className="flex items-center gap-2 justify-end">
                          {first.manualEntry && !first.approved && !first.reversed && (
                            <button onClick={() => void handleApprove(first.reference!)} className="text-gray-400 hover:text-green-600" aria-label="Approve">
                              <CheckIcon size={16} />
                            </button>
                          )}
                          {!first.reversed && (
                            <button onClick={() => setReverseTarget(first.reference)} className="text-gray-400 hover:text-red-600" aria-label="Reverse">
                              <RotateCcwIcon size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">Manual Journal Entry</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
                <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={line.glAccountId}
                    onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, glAccountId: e.target.value } : l)))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="">— Account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.glCode ? `${a.glCode} — ${a.name}` : a.name}</option>
                    ))}
                  </select>
                  <select
                    value={line.side}
                    onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, side: e.target.value as 'debit' | 'credit' } : l)))}
                    className="w-28 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, amount: e.target.value } : l)))}
                    className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <button
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    disabled={lines.length <= 2}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove line"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setLines([...lines, { ...EMPTY_LINE }])}
              className="mt-3 text-sm text-primary hover:underline"
            >
              + Add line
            </button>

            <div className="mt-4 flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-gray-600">Debit total: <strong>{totalDebit.toLocaleString()}</strong></span>
              <span className="text-gray-600">Credit total: <strong>{totalCredit.toLocaleString()}</strong></span>
              <span className={balanced ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{balanced ? 'Balanced' : 'Not balanced'}</span>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!balanced || !date}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={reverseTarget !== null}
        onClose={() => setReverseTarget(null)}
        onConfirm={() => void handleReverse()}
        title="Reverse this journal entry batch?"
        description="Every line sharing this reference will be flagged reversed. This never deletes the entries — they stay for the audit trail."
        confirmLabel="Reverse"
        confirmVariant="danger"
      />
    </div>
  );
}
