import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { SearchIcon, UserIcon, UsersRoundIcon } from 'lucide-react';
import { useRolePath } from '../../../hooks/useRolePath';
import apiClient from '../../../api/apiClient';
import { Pagination } from '../../../components/Pagination';
import { formatMoney } from '../../../utils/money';
import { humanize } from '../../../utils/format';

interface LoanListItem {
  id: number;
  accountNumber: string | null;
  clientId: number | null;
  groupId: number | null;
  officeId: number | null;
  loanProductId: number | null;
  appliedAmount: number | null;
  approvedAmount: number | null;
  status: string;
  applicantName: string | null;
  loanProductName: string | null;
  officeName: string | null;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

const PAGE_SIZE = 20;

const FILTERS = [
  { value: 'Pending', label: 'Awaiting disbursement' },
  { value: 'Disbursed', label: 'Running' },
  { value: 'NeedChanges', label: 'Needs changes' },
  { value: 'Closed', label: 'Closed' },
  { value: '', label: 'All' },
];

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-amber-50 text-amber-800 border-amber-200',
  Disbursed: 'bg-sky-50 text-sky-800 border-sky-200',
  NeedChanges: 'bg-orange-50 text-orange-800 border-orange-200',
  Closed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  WrittenOff: 'bg-red-50 text-red-700 border-red-200',
};

/** Loans in the viewer's office(s), newest first — approved applications become loans here. */
export function LoansListPage() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const [items, setItems] = useState<LoanListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Disbursed');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const response = await apiClient.get<PagedResult<LoanListItem>>('/loans', {
        params: { status: status || undefined, search: search.trim() || undefined, page: pageToLoad, pageSize: PAGE_SIZE },
      });
      setItems(response.data.items);
      setTotalCount(response.data.totalCount);
      setPage(response.data.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load loans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(1), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold text-primary">Loans</h1>
        <p className="mt-1 text-sm text-gray-500">Approved applications become loans. Each one needs a face match before it's disbursed.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setStatus(filter.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${status === filter.value ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account number"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 font-medium">Borrower</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 text-right font-medium">Approved</th>
                <th className="px-4 py-3 font-medium">Office</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">No loans found.</td>
                </tr>
              ) : (
                items.map((loan) => (
                  <tr key={loan.id} onClick={() => navigate(rolePath(`/loans/${loan.id}`))} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={rolePath(`/loans/${loan.id}`)} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
                        {loan.accountNumber ?? `#${loan.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        {loan.clientId ? <UserIcon size={14} className="text-gray-400" /> : <UsersRoundIcon size={14} className="text-gray-400" />}
                        {loan.applicantName ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{loan.loanProductName ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">{formatMoney(loan.approvedAmount ?? loan.appliedAmount)}</td>
                    <td className="px-4 py-3 text-gray-700">{loan.officeName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[loan.status] ?? 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                        {humanize(loan.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={(p) => void load(p)} />
      </div>
    </div>
  );
}
