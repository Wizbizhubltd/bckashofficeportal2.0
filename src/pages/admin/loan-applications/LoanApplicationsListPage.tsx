import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { Pagination } from '../../../components/Pagination';
import { StatusBadge } from '../../../components/StatusBadge';

type ApprovalStatus = 'Pending' | 'Approved' | 'Declined';

interface LoanApplicationListItem {
  id: number;
  clientType: 'Client' | 'Group';
  clientId: number | null;
  groupId: number | null;
  officeId: number | null;
  loanProductId: number;
  amount: number;
  status: ApprovalStatus;
  loanId: number | null;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

const PAGE_SIZE = 20;

export function LoanApplicationsListPage() {
  const [items, setItems] = useState<LoanApplicationListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const response = await apiClient.get<PagedResult<LoanApplicationListItem>>('/loan-applications', {
        params: { status: status || undefined, page: pageToLoad, pageSize: PAGE_SIZE },
      });
      setItems(response.data.items);
      setTotalCount(response.data.totalCount);
      setPage(response.data.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load loan applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void load(1);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Loan Applications</h1>
          <p className="text-sm text-gray-500 mt-1">Loan application workflow (BR-LN-2).</p>
        </div>
        <Link
          to="/admin/loan-applications/new"
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          New Application
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Declined">Declined</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Loan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No loan applications found.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    <Link to={`/admin/loan-applications/${item.id}`} className="text-primary hover:underline font-medium">
                      #{item.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.clientType}</td>
                  <td className="px-4 py-3 text-gray-700">{item.amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.loanId ? (
                      <Link to={`/admin/loans/${item.loanId}`} className="text-primary hover:underline">
                        #{item.loanId}
                      </Link>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={(p) => void load(p)} />
      </div>
    </div>
  );
}
