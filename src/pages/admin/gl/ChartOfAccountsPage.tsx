import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, PowerIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';

type GlAccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

interface GlAccount {
  id: number;
  name: string | null;
  parentId: number | null;
  glCode: string | null;
  accountType: GlAccountType;
  active: boolean;
  manualEntries: boolean;
  notes: string | null;
}

interface GlAccountFormState {
  id?: number;
  name: string;
  parentId: number | null;
  glCode: string;
  accountType: GlAccountType;
  manualEntries: boolean;
  notes: string;
}

const EMPTY_FORM: GlAccountFormState = { name: '', parentId: null, glCode: '', accountType: 'Asset', manualEntries: true, notes: '' };
const ACCOUNT_TYPES: GlAccountType[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

/** Same indented-tree rendering approach as OfficesAdmin.tsx (BR-GL-1's chart of accounts is a self-referencing tree, same shape as Office). */
function buildDepthMap(accounts: GlAccount[]): Map<number, number> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const depths = new Map<number, number>();

  const depthOf = (id: number, seen = new Set<number>()): number => {
    if (depths.has(id)) {
      return depths.get(id)!;
    }
    const account = byId.get(id);
    if (!account?.parentId || seen.has(id)) {
      depths.set(id, 0);
      return 0;
    }
    const depth = 1 + depthOf(account.parentId, new Set(seen).add(id));
    depths.set(id, depth);
    return depth;
  };

  accounts.forEach((a) => depthOf(a.id));
  return depths;
}

export function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<GlAccountFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<GlAccount[]>('/gl-accounts');
      setAccounts(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load chart of accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const depths = buildDepthMap(accounts);
  const sorted = [...accounts].sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0));

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, parentId: form.parentId, glCode: form.glCode, accountType: form.accountType, manualEntries: form.manualEntries, notes: form.notes || null };
      if (form.id) {
        await apiClient.put(`/gl-accounts/${form.id}`, payload);
        toast.success('GL account updated.');
      } else {
        await apiClient.post('/gl-accounts', payload);
        toast.success('GL account created.');
      }
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'A circular parent account was rejected, or the save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account: GlAccount) => {
    try {
      await apiClient.post(`/gl-accounts/${account.id}/${account.active ? 'deactivate' : 'activate'}`);
      toast.success(account.active ? 'Account deactivated.' : 'Account reactivated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">BR-GL-1. Hierarchical, typed accounts. Only accounts with "Manual entries" enabled can be targeted by a manual journal entry.</p>
        </div>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Manual Entries</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No GL accounts yet.</td></tr>
            ) : (
              sorted.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{account.glCode}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span style={{ paddingLeft: `${(depths.get(account.id) ?? 0) * 20}px` }}>
                      {(depths.get(account.id) ?? 0) > 0 && '↳ '}
                      {account.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{account.accountType}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${account.manualEntries ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {account.manualEntries ? 'Allowed' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${account.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {account.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setForm({ id: account.id, name: account.name ?? '', parentId: account.parentId, glCode: account.glCode ?? '', accountType: account.accountType, manualEntries: account.manualEntries, notes: account.notes ?? '' })}
                        className="text-gray-400 hover:text-primary"
                        aria-label="Edit"
                      >
                        <PencilIcon size={16} />
                      </button>
                      <button onClick={() => void toggleActive(account)} className="text-gray-400 hover:text-red-600" aria-label="Toggle active">
                        <PowerIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">{form.id ? 'Edit GL Account' : 'Add GL Account'}</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GL Code</label>
                <input
                  type="text"
                  value={form.glCode}
                  onChange={(e) => setForm({ ...form, glCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={form.accountType}
                  onChange={(e) => setForm({ ...form, accountType: e.target.value as GlAccountType })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account</label>
                <select
                  value={form.parentId ?? ''}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">— None (top-level) —</option>
                  {accounts.filter((a) => a.id !== form.id).map((a) => (
                    <option key={a.id} value={a.id}>{a.glCode ? `${a.glCode} — ${a.name}` : a.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.manualEntries}
                  onChange={(e) => setForm({ ...form, manualEntries: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                Allow manual journal entries against this account
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
