import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, FilterIcon, MoreVerticalIcon, Loader2Icon } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { loansService, type LoanSummary } from '../../services/loans/loans.service';

type StatusBadgeValue = ComponentProps<typeof StatusBadge>['status'];

/** The disbursement pipeline: approved and awaiting/undergoing verification, or already disbursed — see LoanApplications.tsx for what comes before. */
const DISBURSEMENT_STATUSES: LoanSummary['status'][] = [
  'APPROVED',
  'VERIFICATION_IN_PROGRESS',
  'VERIFICATION_FAILED',
  'DISBURSED',
];

const STATUS_BADGE: Record<LoanSummary['status'], StatusBadgeValue> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  VERIFICATION_IN_PROGRESS: 'Pending Review',
  VERIFICATION_FAILED: 'Pending Review',
  DISBURSED: 'Disbursed',
  REJECTED: 'Rejected',
  CLOSED: 'Completed',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

export function LoanDisbursement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoanSummary['status']>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isAdminTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loansService
      .list(isAdminTier && branchFilter ? { branchId: branchFilter } : undefined)
      .then((items) => {
        if (isMounted) {
          setLoans(items.filter((loan) => DISBURSEMENT_STATUSES.includes(loan.status)));
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoans([]);
          setLoadError(error instanceof Error ? error.message : 'Failed to load disbursements');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isAdminTier, branchFilter]);

  const branchName = useMemo(
    () => (id: string) => branches.find((b) => b.id === id)?.name ?? '—',
    [branches],
  );

  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      !searchQuery.trim() ||
      [loan.groupName, loan.id, loan.productName ?? '', ...loan.memberCustomerNames].some((field) =>
        field.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-heading font-bold text-primary">Loan Disbursements</h2>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search disbursements..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {isAdminTier && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium"
            >
              <FilterIcon size={16} className="mr-2" /> Filter
              {statusFilter !== 'all' && <span className="ml-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-48">
                {(['all', ...DISBURSEMENT_STATUSES] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setStatusFilter(option);
                      setFilterOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm font-body hover:bg-gray-50 transition-colors ${statusFilter === option ? 'text-primary font-bold bg-primary/5' : 'text-gray-600'}`}
                  >
                    {option === 'all' ? 'All Statuses' : option.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                <th className="px-6 py-4 font-medium">Group Name</th>
                <th className="px-6 py-4 font-medium">Customer(s)</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Interest</th>
                <th className="px-6 py-4 font-medium">Total Repayable</th>
                <th className="px-6 py-4 font-medium">Branch</th>
                <th className="px-6 py-4 font-medium">Approved</th>
                <th className="px-6 py-4 font-medium">Disbursed</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredLoans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => navigate(`/loan-manager/loans/${loan.id}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-heading font-medium text-primary">{loan.groupName}</td>
                  <td className="px-6 py-4 text-gray-700">
                    {loan.memberCustomerNames.length > 0 ? loan.memberCustomerNames.join(', ') : '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">{formatNaira(loan.cumulativeAmountKobo)}</td>
                  <td className="px-6 py-4 text-gray-700">
                    {formatNaira(loan.totalInterestKobo)}
                    {loan.interestIsEstimate && (
                      <span className="text-xs text-gray-400 font-body ml-1" title="Not yet disbursed — estimated from the product's own rate, not yet the final schedule.">
                        (est.)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">{formatNaira(loan.totalRepayableKobo)}</td>
                  <td className="px-6 py-4 text-gray-600">{loan.branchName ?? branchName(loan.branchId)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDisplayDate(loan.approvedAt)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDisplayDate(loan.disbursedAt)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={STATUS_BADGE[loan.status]} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/loan-manager/loans/${loan.id}`);
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <MoreVerticalIcon size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && !loadError && filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    No disbursements match your search.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                    <span className="inline-flex items-center gap-2">
                      <Loader2Icon size={16} className="animate-spin" /> Loading disbursements...
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && loadError && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-red-500 text-sm font-body">
                    {loadError}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
