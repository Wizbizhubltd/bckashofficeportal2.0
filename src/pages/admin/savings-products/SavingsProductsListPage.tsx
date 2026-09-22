import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, PowerIcon, TrashIcon } from 'lucide-react';
import apiClient, { type ApiError } from '../../../api/apiClient';

interface SavingsProduct {
  id: number;
  name: string | null;
  shortName: string | null;
  interestRate: number | null;
  minimumBalance: number | null;
  allowOverdraft: boolean;
  active: boolean;
}

export function SavingsProductsListPage() {
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<SavingsProduct[]>('/savings-products');
      setProducts(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load savings products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleActive = async (product: SavingsProduct) => {
    try {
      await apiClient.post(`/savings-products/${product.id}/${product.active ? 'deactivate' : 'activate'}`);
      toast.success(product.active ? 'Product deactivated.' : 'Product activated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  const handleDelete = async (product: SavingsProduct) => {
    try {
      await apiClient.delete(`/savings-products/${product.id}`);
      toast.success('Product deleted.');
      await load();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) {
        toast.error('This product has savings accounts against it — deactivate it instead.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  const filtered = products.filter((p) => (p.name ?? '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Savings Products</h1>
          <p className="text-sm text-gray-500 mt-1">Configurable savings products (BR-SAV-1). Deleting a product in use is blocked — deactivate instead.</p>
        </div>
        <Link
          to="/admin/savings-products/new"
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Product
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="w-full max-w-sm mb-4 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Interest Rate</th>
              <th className="px-4 py-3 font-medium">Minimum Balance</th>
              <th className="px-4 py-3 font-medium">Overdraft</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No savings products found.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-700">{p.interestRate ?? '—'}%</td>
                  <td className="px-4 py-3 text-gray-700">{p.minimumBalance ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{p.allowOverdraft ? 'Allowed' : 'Not allowed'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/admin/savings-products/${p.id}/edit`} className="text-gray-400 hover:text-primary" aria-label="Edit">
                        <PencilIcon size={16} />
                      </Link>
                      <button onClick={() => void toggleActive(p)} className="text-gray-400 hover:text-primary" aria-label="Toggle active">
                        <PowerIcon size={16} />
                      </button>
                      <button onClick={() => void handleDelete(p)} className="text-gray-400 hover:text-red-600" aria-label="Delete">
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
