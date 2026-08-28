import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUpIcon,
  UsersIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  WalletIcon,
  BuildingIcon,
  LandmarkIcon,
  Loader2Icon } from
'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer } from
'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { loansService, type LoanSummary } from '../services/loans/loans.service';
import { branchesService } from '../services/branches/branches.service';
import { branchFundingService } from '../services/branch-funding/branch-funding.service';

type StatusBadgeValue = ComponentProps<typeof StatusBadge>['status'];

const LOAN_STATUS_BADGE: Record<LoanSummary['status'], StatusBadgeValue> = {
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

const MONTH_WINDOW = 6;

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager';
  // branch-funding's list endpoint is row-scoped server-side (see
  // branchFundingService.list's own doc comment): only Admin/SuperAdmin/
  // Approver get every branch's records back, so only they get a genuinely
  // org-wide total here — a Manager/Marketer call would silently just be
  // their own branch's, which the "organisation" label would misrepresent.
  const isOrgWide = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'approver';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Manager-only: this branch's own name (user.branch may not be populated —
  // see AuthContext.verifyOtp's own comment — this is the reliable
  // fallback) and fund balance. Funding history/confirmation, disputes,
  // requests to head office, and notifications all live on the dedicated
  // Branch Management tab (MyBranch.tsx) instead — see its own doc comment.
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchBalanceKobo, setBranchBalanceKobo] = useState<number | null>(null);

  // Admin/SuperAdmin/Approver only: total head-office funding actually
  // confirmed (VERIFIED) across every branch — a lifetime "funding done"
  // figure, distinct from branches' current available balances (which net
  // out disbursements). PENDING_VERIFICATION/REJECTED records are excluded
  // since nothing has actually landed in a branch's balance for those yet.
  const [totalOrgFundingKobo, setTotalOrgFundingKobo] = useState<number | null>(null);
  const [isLoadingOrgFunding, setIsLoadingOrgFunding] = useState(false);

  const getGreeting = () => {
    if (user?.role === 'super_admin') return 'Super Admin Dashboard';
    if (user?.role === 'admin') return 'Admin Dashboard';
    if (user?.role === 'manager') return `Branch Dashboard — ${user.branch ?? branchName ?? 'your branch'}`;
    if (user?.role === 'marketer') return 'Marketer Dashboard';
    return 'Approver Dashboard';
  };

  // Loans — row-scoped server-side (see LoanSummary's own doc comment):
  // Admin/SuperAdmin/Approver see every loan, a Manager only their own
  // branch's, a Marketer only ones they raised. No branch filter needed
  // here — the KPIs/chart/recent-activity below are naturally scoped.
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [loanLoadError, setLoanLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingLoans(true);
    loansService
      .list()
      .then((items) => {
        if (isMounted) {
          setLoans(items);
          setLoanLoadError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoans([]);
          setLoanLoadError(error instanceof Error ? error.message : 'Failed to load loans');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingLoans(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isManager || !user?.branchId) return;
    let isMounted = true;

    branchesService
      .getById(user.branchId)
      .then((branch) => {
        if (isMounted) setBranchName(branch.name);
      })
      .catch(() => {
        if (isMounted) setBranchName(null);
      });

    branchesService
      .getBalance(user.branchId)
      .then((balance) => {
        if (isMounted) setBranchBalanceKobo(balance.availableAmount);
      })
      .catch(() => {
        if (isMounted) setBranchBalanceKobo(null);
      });

    return () => {
      isMounted = false;
    };
  }, [isManager, user?.branchId]);

  useEffect(() => {
    if (!isOrgWide) return;
    let isMounted = true;
    setIsLoadingOrgFunding(true);

    branchFundingService
      .list()
      .then((records) => {
        if (!isMounted) return;
        const verifiedTotal = records
          .filter((record) => record.status === 'VERIFIED')
          .reduce((sum, record) => sum + record.amount, 0);
        setTotalOrgFundingKobo(verifiedTotal);
      })
      .catch(() => {
        if (isMounted) setTotalOrgFundingKobo(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingOrgFunding(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOrgWide]);

  // KPIs — computed client-side from the (already row-scoped) loans list;
  // there's no dedicated reporting/aggregation endpoint on the backend yet.
  const kpis = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const settledLoans = loans.filter((loan) => loan.status === 'DISBURSED' || loan.status === 'CLOSED');

    const totalDisbursedYtdKobo = loans
      .filter(
        (loan) =>
          loan.disbursedAt !== null &&
          (loan.status === 'DISBURSED' || loan.status === 'CLOSED') &&
          new Date(loan.disbursedAt).getFullYear() === currentYear,
      )
      .reduce((sum, loan) => sum + loan.cumulativeAmountKobo, 0);

    const activeGroupLoans = loans.filter((loan) => loan.status === 'DISBURSED').length;
    const pendingApplications = loans.filter((loan) => loan.status === 'PENDING_APPROVAL').length;

    // Repayment rate is a principal-recovery proxy (outstanding vs. cumulative
    // raised amount) — the real per-loan expected-repayment total (principal +
    // interest) only exists on LoanDetail, not this summary list, so this
    // intentionally undercounts what's actually been collected once interest
    // is due. Good enough for a dashboard-level trend, not a reconciliation figure.
    const settledPrincipalKobo = settledLoans.reduce((sum, loan) => sum + loan.cumulativeAmountKobo, 0);
    const settledOutstandingKobo = settledLoans.reduce((sum, loan) => sum + loan.outstandingBalanceKobo, 0);
    const repaymentRate =
      settledPrincipalKobo > 0 ? (1 - settledOutstandingKobo / settledPrincipalKobo) * 100 : null;

    return { totalDisbursedYtdKobo, activeGroupLoans, pendingApplications, repaymentRate };
  }, [loans]);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: { key: string; name: string; amount: number }[] = [];
    for (let i = MONTH_WINDOW - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleDateString('en-US', { month: 'short' }), amount: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));

    loans.forEach((loan) => {
      if (!loan.disbursedAt) return;
      if (loan.status !== 'DISBURSED' && loan.status !== 'CLOSED') return;
      const d = new Date(loan.disbursedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.amount += loan.cumulativeAmountKobo;
    });

    return months.map((m) => ({ name: m.name, amount: m.amount / 100 }));
  }, [loans]);

  const recentActivity = useMemo(
    () =>
      loans
        .slice()
        .sort(
          (a, b) =>
            new Date(b.disbursedAt ?? b.raisedAt).getTime() - new Date(a.disbursedAt ?? a.raisedAt).getTime(),
        )
        .slice(0, 5),
    [loans],
  );

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-primary">
            {getGreeting()}
          </h2>
          <p className="text-gray-500 font-body text-sm mt-1">
            Welcome back, {user?.name} • {today}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <button
              onClick={() => navigate('/my-branch')}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-heading font-bold shadow-sm">
              <BuildingIcon size={16} className="mr-2" />
              Branch Management
            </button>
          )}
          <button
            onClick={() => navigate('/loan-manager/reports')}
            className="flex items-center px-4 py-2 bg-white text-primary border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-heading font-medium shadow-sm">

            <FileTextIcon size={16} className="mr-2" />
            Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isManager || isOrgWide ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        {isOrgWide && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Total Funding (Organisation)</p>
                <h3 className="text-2xl font-heading font-bold text-primary">
                  {isLoadingOrgFunding || totalOrgFundingKobo === null ? '—' : formatNaira(totalOrgFundingKobo)}
                </h3>
              </div>
              <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
                <LandmarkIcon size={20} />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">Head-office funding verified across all branches</p>
          </div>
        )}

        {isManager && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Branch Fund Balance</p>
                <h3 className="text-2xl font-heading font-bold text-primary">
                  {branchBalanceKobo === null ? '—' : formatNaira(branchBalanceKobo)}
                </h3>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <WalletIcon size={20} />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">Available for new loan disbursements at this branch</p>
          </div>
        )}

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">
                Total Disbursed (YTD)
              </p>
              <h3 className="text-2xl font-heading font-bold text-primary">
                {isLoadingLoans ? '—' : formatNaira(kpis.totalDisbursedYtdKobo)}
              </h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <TrendingUpIcon size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Loans disbursed so far this year</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">
                Active Group Loans
              </p>
              <h3 className="text-2xl font-heading font-bold text-primary">
                {isLoadingLoans ? '—' : kpis.activeGroupLoans}
              </h3>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <UsersIcon size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Currently disbursed, still being repaid</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">
                Repayment Rate
              </p>
              <h3 className="text-2xl font-heading font-bold text-primary">
                {isLoadingLoans || kpis.repaymentRate === null ? '—' : `${kpis.repaymentRate.toFixed(1)}%`}
              </h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2Icon size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Principal recovered vs. disbursed (disbursed + closed loans)</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">
                Pending Applications
              </p>
              <h3 className="text-2xl font-heading font-bold text-primary">
                {isLoadingLoans ? '—' : kpis.pendingApplications}
              </h3>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <ClockIcon size={20} />
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Awaiting approval</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-heading font-bold text-primary mb-6">
            Disbursement Trend (6 Months)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 20,
                  bottom: 5,
                  left: 0,
                }}>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0" />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12,
                  }}
                  dy={10} />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#6b7280',
                    fontSize: 12,
                  }}
                  tickFormatter={(value) => `₦${(value / 1000000).toFixed(1)}M`} />

                <Tooltip
                  cursor={{
                    fill: '#f3f4f6',
                  }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number) => [
                    `₦${value.toLocaleString()}`,
                    'Disbursed',
                  ]} />

                <Bar
                  dataKey="amount"
                  fill="#1A5745"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50} />

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-1 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-heading font-bold text-primary">
              Recent Activity
            </h3>
            <button
              onClick={() => navigate('/loan-manager/group-loans')}
              className="text-sm text-accent hover:text-[#e64a19] font-medium">

              View All
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-heading">
                  <th className="px-6 py-3 font-medium">Group</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {recentActivity.map((loan) =>
                  <tr
                    key={loan.id}
                    onClick={() => navigate(`/loan-manager/loans/${loan.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer">

                    <td className="px-6 py-4">
                      <p className="font-heading font-medium text-primary">
                        {loan.groupName}
                      </p>
                      <p className="text-xs text-gray-400">{formatDisplayDate(loan.disbursedAt ?? loan.raisedAt)}</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {formatNaira(loan.cumulativeAmountKobo)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={LOAN_STATUS_BADGE[loan.status]} />
                    </td>
                  </tr>
                )}
                {!isLoadingLoans && !loanLoadError && recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      No loan activity yet.
                    </td>
                  </tr>
                )}
                {isLoadingLoans && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 text-sm font-body">
                      <span className="inline-flex items-center gap-2">
                        <Loader2Icon size={16} className="animate-spin" /> Loading...
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoadingLoans && loanLoadError && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-red-500 text-sm font-body">
                      {loanLoadError}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>);

}
