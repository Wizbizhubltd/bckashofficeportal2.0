import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PlusIcon, UserIcon, UsersRoundIcon } from 'lucide-react';
import { useRolePath } from '../../../hooks/useRolePath';
import apiClient from '../../../api/apiClient';
import { Pagination } from '../../../components/Pagination';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatMoney } from '../../../utils/money';

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

const FILTERS: { value: '' | ApprovalStatus; label: string }[] = [
  { value: 'Pending', label: 'Awaiting decision' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Declined', label: 'Declined' },
  { value: '', label: 'All' },
];

/** Loan applications in the viewer's office(s), newest first. */
export function LoanApplicationsListPage() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const [items, setItems] = useState<LoanApplicationListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'' | ApprovalStatus>('Pending');

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
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Loan Applications</h1>
          <p className="mt-1 text-sm text-gray-500">Applications raised for approved clients and groups. Raise one from the client's page.</p>
        </div>
        <Link
          to={rolePath('/loan-applications/new')}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          <PlusIcon size={16} />
          New application
        </Link>
      </div>

      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
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

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Application</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Office</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Loan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">Loading…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">No loan applications found.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} onClick={() => navigate(rolePath(`/loan-applications/${item.id}`))} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={rolePath(`/loan-applications/${item.id}`)} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
                        #{item.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        {item.clientType === 'Group' ? <UsersRoundIcon size={14} className="text-gray-400" /> : <UserIcon size={14} className="text-gray-400" />}
                        {item.applicantName ?? (item.clientType === 'Group' ? `Group #${item.groupId}` : `Client #${item.clientId}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.loanProductName ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">{formatMoney(item.amount)}</td>
                    <td className="px-4 py-3 text-gray-700">{item.officeName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.loanId ? (
                        <Link to={rolePath(`/loans/${item.loanId}`)} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                          View loan
                        </Link>
                      ) : (
                        '—'
                      )}
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
