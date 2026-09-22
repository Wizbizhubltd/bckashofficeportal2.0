import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { ConfirmationModal } from '../../../components/ConfirmationModal';

interface Office {
  id: number;
  name: string | null;
}

interface GlClosure {
  id: number;
  officeId: number | null;
  closingDate: string | null;
  notes: string | null;
  reopenedAt: string | null;
}

export function ClosuresPage() {
  const [closures, setClosures] = useState<GlClosure[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [officeId, setOfficeId] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reopenTarget, setReopenTarget] = useState<GlClosure | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<GlClosure[]>('/gl/closures');
      setClosures(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load closures.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    apiClient.get<Office[]>('/offices').then((r) => setOffices(r.data)).catch(() => undefined);
  }, []);

  const officeName = (id: number | null) => (id === null ? 'All offices' : offices.find((o) => o.id === id)?.name ?? `Office #${id}`);

  const handleClose = async () => {
    try {
      await apiClient.post('/gl/closures', { officeId: officeId ? Number(officeId) : null, closingDate, notes: notes || null });
      toast.success('Period closed.');
      setShowCreate(false);
      setOfficeId('');
      setClosingDate('');
      setNotes('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to close period.');
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget) {
      return;
    }
    try {
      await apiClient.post(`/gl/closures/${reopenTarget.id}/reopen`, { notes: 'Reopened from admin console' });
      toast.success('Closure reopened.');
      setReopenTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reopening failed — this requires the elevated gl.closure-reopen permission.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">GL Closures</h1>
          <p className="text-sm text-gray-500 mt-1">FR-GL-4. Entries dated on/before a closure can't be posted. Reopening requires the elevated gl.closure-reopen permission and is audited.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Close Period
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Office</th>
              <th className="px-4 py-3 font-medium">Closing Date</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : closures.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No closures yet.</td></tr>
            ) : (
              closures.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{officeName(c.officeId)}</td>
                  <td className="px-4 py-3 text-gray-700">{c.closingDate}</td>
                  <td className="px-4 py-3 text-gray-500">{c.notes}</td>
                  <td className="px-4 py-3">
                    {c.reopenedAt ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">Reopened</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Closed</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.reopenedAt && (
                      <button onClick={() => setReopenTarget(c)} className="text-gray-400 hover:text-primary" aria-label="Reopen">
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">Close Accounting Period</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Office</label>
                <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="">All offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Date</label>
                <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
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
              <button onClick={() => void handleClose()} disabled={!closingDate} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                Close Period
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={reopenTarget !== null}
        onClose={() => setReopenTarget(null)}
        onConfirm={() => void handleReopen()}
        title="Reopen this closure?"
        description="Postings on or before this closing date will be allowed again. This is a privileged, audited action."
        confirmLabel="Reopen"
        confirmVariant="danger"
      />
    </div>
  );
}
