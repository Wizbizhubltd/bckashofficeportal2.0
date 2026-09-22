import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, XIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';

interface SavingsProduct {
  id: number;
  name: string | null;
}

interface SavingsAccount {
  id: number;
  accountNumber: string | null;
  clientId: number;
  status: string;
  balance: number | null;
}

export function SavingsAccountsListPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<SavingsAccount[]>('/savings-accounts');
      setAccounts(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load savings accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    apiClient.get<SavingsProduct[]>('/savings-products').then((r) => setProducts(r.data)).catch(() => undefined);
  }, []);

  const handleOpen = async () => {
    try {
      const response = await apiClient.post('/savings-accounts', {
        clientType: 'Client',
        clientId: Number(clientId),
        groupId: null,
        officeId: null,
        savingsProductId: Number(productId),
        notes: null,
      });
      toast.success('Savings account opened — pending approval.');
      setShowOpen(false);
      setClientId('');
      setProductId('');
      navigate(`/admin/savings/${response.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open account.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Savings Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">BR-SAV-2. Open, approve, and manage client savings accounts.</p>
        </div>
        <button
          onClick={() => setShowOpen(true)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Open Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Account No.</th>
              <th className="px-4 py-3 font-medium">Client ID</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No savings accounts yet.</td></tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/savings/${a.id}`} className="text-primary hover:underline font-medium">{a.accountNumber ?? `#${a.id}`}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.clientId}</td>
                  <td className="px-4 py-3 text-gray-700">{a.balance?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{a.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">Open Savings Account</h2>
              <button onClick={() => setShowOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Savings Product</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">— Select —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleOpen()}
                disabled={!clientId || !productId}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
