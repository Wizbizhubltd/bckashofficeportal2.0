import { useEffect, useMemo, useState } from 'react';
import {
  FileTextIcon,
  DownloadIcon,
  PieChartIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  Loader2Icon,
  FileSpreadsheetIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import { loanReportsService } from '../../services/loans/loan-reports.service';
import type {
  LoanReportsResult,
  LoanStatus,
} from '../../services/loans/loan-reports.types';

type ReportTab = 'portfolio' | 'delinquency' | 'collection' | 'groups';

const TABS: { id: ReportTab; title: string; description: string; icon: typeof PieChartIcon; bg: string; iconColor: string }[] = [
  {
    id: 'portfolio',
    title: 'Portfolio Summary',
    description: 'Overview of total active loans, outstanding balances, and overall portfolio health.',
    icon: PieChartIcon,
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'delinquency',
    title: 'Delinquency Report',
    description: 'Detailed list of overdue payments, at-risk groups, and aging analysis.',
    icon: AlertTriangleIcon,
    bg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    id: 'collection',
    title: 'Collection Report',
    description: 'Weekly collection metrics versus expected repayments.',
    icon: TrendingUpIcon,
    bg: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    id: 'groups',
    title: 'Group Performance',
    description: "Metrics on individual group repayment rates and loan activity.",
    icon: FileTextIcon,
    bg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
];

const STATUS_LABELS: Record<LoanStatus, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  VERIFICATION_IN_PROGRESS: 'Verification In Progress',
  VERIFICATION_FAILED: 'Verification Failed',
  DISBURSED: 'Disbursed / Active',
  REJECTED: 'Rejected',
  CLOSED: 'Completed',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function formatDisplayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

function StatCard({ label, value, tone = 'text-gray-800' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-500 font-body">{label}</p>
      <p className={`text-lg font-heading font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * All four sections, always exported together — simpler and more useful
 * than "just whichever tab is open", and every field here already went
 * through LoanReportsService's own row-scoping, so nothing exported can
 * ever exceed what this viewer could already see on-screen.
 */
async function downloadReportsAsExcel(result: LoanReportsResult, branchLabel: string) {
  // Lazy-loaded — same reasoning as HrManager.tsx's own Excel export.
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Portfolio Summary');
  summarySheet.columns = [{ header: 'Metric', key: 'metric', width: 32 }, { header: 'Value', key: 'value', width: 24 }];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ metric: 'Total Loans', value: result.portfolioSummary.totalLoans });
  summarySheet.addRow({ metric: 'Total Disbursed', value: formatNaira(result.portfolioSummary.totalDisbursedKobo) });
  summarySheet.addRow({ metric: 'Total Outstanding', value: formatNaira(result.portfolioSummary.totalOutstandingKobo) });
  summarySheet.addRow({ metric: 'Total Interest', value: formatNaira(result.portfolioSummary.totalInterestKobo) });
  summarySheet.addRow({ metric: 'Total Repaid', value: formatNaira(result.portfolioSummary.totalRepaidKobo) });
  summarySheet.addRow({ metric: '', value: '' });
  summarySheet.addRow({ metric: 'By Status', value: '' }).font = { bold: true };
  for (const [status, count] of Object.entries(result.portfolioSummary.byStatus)) {
    summarySheet.addRow({ metric: STATUS_LABELS[status as LoanStatus] ?? status, value: count });
  }

  const delinquencySheet = workbook.addWorksheet('Delinquency');
  delinquencySheet.columns = [
    { header: 'Customer', key: 'customer', width: 24 },
    { header: 'Group', key: 'group', width: 22 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Installment #', key: 'installment', width: 14 },
    { header: 'Overdue Amount', key: 'overdue', width: 18 },
    { header: 'Penalty', key: 'penalty', width: 16 },
    { header: 'Days Late', key: 'daysLate', width: 12 },
    { header: 'Applied At', key: 'appliedAt', width: 16 },
  ];
  delinquencySheet.getRow(1).font = { bold: true };
  for (const row of result.delinquency.rows) {
    delinquencySheet.addRow({
      customer: row.customerName,
      group: row.groupName,
      branch: row.branchName ?? '—',
      installment: row.installmentNumber,
      overdue: formatNaira(row.overdueAmountKobo),
      penalty: formatNaira(row.penaltyAmountKobo),
      daysLate: row.daysLateAtApplication,
      appliedAt: formatDisplayDate(row.appliedAt),
    });
  }

  const collectionSheet = workbook.addWorksheet('Collection Trend');
  collectionSheet.columns = [
    { header: 'Week Starting', key: 'week', width: 16 },
    { header: 'Expected', key: 'expected', width: 18 },
    { header: 'Collected', key: 'collected', width: 18 },
  ];
  collectionSheet.getRow(1).font = { bold: true };
  for (const period of result.collection.weekly) {
    collectionSheet.addRow({
      week: formatDisplayDate(period.periodStart),
      expected: formatNaira(period.expectedKobo),
      collected: formatNaira(period.collectedKobo),
    });
  }

  const groupSheet = workbook.addWorksheet('Group Performance');
  groupSheet.columns = [
    { header: 'Group', key: 'group', width: 22 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Members', key: 'members', width: 10 },
    { header: 'Loans Raised', key: 'loansRaised', width: 14 },
    { header: 'Active Loans', key: 'activeLoans', width: 14 },
    { header: 'Total Disbursed', key: 'disbursed', width: 18 },
    { header: 'Total Outstanding', key: 'outstanding', width: 18 },
    { header: 'Repayment Rate', key: 'rate', width: 16 },
  ];
  groupSheet.getRow(1).font = { bold: true };
  for (const row of result.groupPerformance) {
    groupSheet.addRow({
      group: row.groupName,
      branch: row.branchName ?? '—',
      members: row.memberCount,
      loansRaised: row.totalLoansRaised,
      activeLoans: row.activeLoansCount,
      disbursed: formatNaira(row.totalDisbursedKobo),
      outstanding: formatNaira(row.totalOutstandingKobo),
      rate: `${row.repaymentRatePercent}%`,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `loan-reports-${branchLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** No PDF library in this project — a real, dependency-free "print to PDF"
 * via the browser's own print dialog (choose "Save as PDF" as the
 * destination), same trick used broadly for admin-dashboard exports. Builds
 * plain semantic HTML directly from the already-fetched data rather than
 * snapshotting the DOM, so it's always print-clean regardless of on-screen
 * layout/theme. */
function openReportsPrintWindow(result: LoanReportsResult, branchLabel: string) {
  const generatedAt = new Date(result.generatedAt).toLocaleString();
  const statusRows = Object.entries(result.portfolioSummary.byStatus)
    .map(([status, count]) => `<tr><td>${STATUS_LABELS[status as LoanStatus] ?? status}</td><td>${count}</td></tr>`)
    .join('');
  const delinquencyRows = result.delinquency.rows
    .map(
      (row) =>
        `<tr><td>${row.customerName}</td><td>${row.groupName}</td><td>${row.branchName ?? '—'}</td><td>${row.installmentNumber}</td><td>${formatNaira(row.overdueAmountKobo)}</td><td>${formatNaira(row.penaltyAmountKobo)}</td><td>${row.daysLateAtApplication}</td><td>${formatDisplayDate(row.appliedAt)}</td></tr>`,
    )
    .join('');
  const collectionRows = result.collection.weekly
    .map(
      (period) =>
        `<tr><td>${formatDisplayDate(period.periodStart)}</td><td>${formatNaira(period.expectedKobo)}</td><td>${formatNaira(period.collectedKobo)}</td></tr>`,
    )
    .join('');
  const groupRows = result.groupPerformance
    .map(
      (row) =>
        `<tr><td>${row.groupName}</td><td>${row.branchName ?? '—'}</td><td>${row.memberCount}</td><td>${row.totalLoansRaised}</td><td>${row.activeLoansCount}</td><td>${formatNaira(row.totalDisbursedKobo)}</td><td>${formatNaira(row.totalOutstandingKobo)}</td><td>${row.repaymentRatePercent}%</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Loan Reports</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
  th { background: #f9fafb; color: #6b7280; text-transform: uppercase; letter-spacing: 0.02em; }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; min-width: 140px; }
  .stat .label { font-size: 11px; color: #6b7280; }
  .stat .value { font-size: 15px; font-weight: bold; margin-top: 2px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Loan Reports</h1>
  <p class="meta">Branch: ${branchLabel} &middot; Generated ${generatedAt}</p>

  <h2>Portfolio Summary</h2>
  <div class="stats">
    <div class="stat"><div class="label">Total Loans</div><div class="value">${result.portfolioSummary.totalLoans}</div></div>
    <div class="stat"><div class="label">Total Disbursed</div><div class="value">${formatNaira(result.portfolioSummary.totalDisbursedKobo)}</div></div>
    <div class="stat"><div class="label">Total Outstanding</div><div class="value">${formatNaira(result.portfolioSummary.totalOutstandingKobo)}</div></div>
    <div class="stat"><div class="label">Total Interest</div><div class="value">${formatNaira(result.portfolioSummary.totalInterestKobo)}</div></div>
    <div class="stat"><div class="label">Total Repaid</div><div class="value">${formatNaira(result.portfolioSummary.totalRepaidKobo)}</div></div>
  </div>
  <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${statusRows}</tbody></table>

  <h2>Delinquency Report</h2>
  <div class="stats">
    <div class="stat"><div class="label">Overdue Accounts</div><div class="value">${result.delinquency.totalOverdueAccounts}</div></div>
    <div class="stat"><div class="label">Overdue Amount</div><div class="value">${formatNaira(result.delinquency.totalOverdueAmountKobo)}</div></div>
    <div class="stat"><div class="label">Penalties</div><div class="value">${formatNaira(result.delinquency.totalPenaltyAmountKobo)}</div></div>
    <div class="stat"><div class="label">At-risk Groups</div><div class="value">${result.delinquency.atRiskGroupCount}</div></div>
  </div>
  <table><thead><tr><th>Customer</th><th>Group</th><th>Branch</th><th>Installment #</th><th>Overdue</th><th>Penalty</th><th>Days Late</th><th>Applied At</th></tr></thead><tbody>${delinquencyRows || '<tr><td colspan="8">No delinquent accounts.</td></tr>'}</tbody></table>

  <h2>Collection Report (last 8 weeks)</h2>
  <table><thead><tr><th>Week Starting</th><th>Expected</th><th>Collected</th></tr></thead><tbody>${collectionRows}</tbody></table>

  <h2>Group Performance</h2>
  <table><thead><tr><th>Group</th><th>Branch</th><th>Members</th><th>Loans Raised</th><th>Active Loans</th><th>Total Disbursed</th><th>Total Outstanding</th><th>Repayment Rate</th></tr></thead><tbody>${groupRows || '<tr><td colspan="8">No groups with loan activity.</td></tr>'}</tbody></table>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function LoanReports() {
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);

  const [activeTab, setActiveTab] = useState<ReportTab>('portfolio');
  const [branchFilter, setBranchFilter] = useState('');
  const [result, setResult] = useState<LoanReportsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);

  const isAdminTier = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver';

  // Row-level scope is enforced server-side (LoanReportsService reuses
  // LoansService.listForActor) — same "no role-specific logic needed here"
  // reasoning as LoanApplications.tsx.
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loanReportsService
      .getReports(isAdminTier && branchFilter ? { branchId: branchFilter } : undefined)
      .then((data) => {
        if (isMounted) {
          setResult(data);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setResult(null);
          setLoadError(error instanceof Error ? error.message : 'Failed to load loan reports');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isAdminTier, branchFilter]);

  const branchLabel = useMemo(() => {
    if (!isAdminTier) return 'My Branch';
    if (!branchFilter) return 'All Branches';
    return branches.find((b) => b.id === branchFilter)?.name ?? 'All Branches';
  }, [isAdminTier, branchFilter, branches]);

  async function handleExport(kind: 'pdf' | 'excel') {
    if (!result) return;
    setIsExporting(kind);
    try {
      if (kind === 'excel') {
        await downloadReportsAsExcel(result, branchLabel);
      } else {
        openReportsPrintWindow(result, branchLabel);
      }
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-primary">Loan Reports</h2>
          <p className="text-xs text-gray-500 font-body mt-0.5">Portfolio health, delinquency, collections, and group performance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap items-center">
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
          <button
            onClick={() => handleExport('pdf')}
            disabled={!result || isExporting !== null}
            className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting === 'pdf' ? <Loader2Icon size={16} className="mr-2 animate-spin" /> : <DownloadIcon size={16} className="mr-2" />}
            Export PDF
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={!result || isExporting !== null}
            className="flex items-center px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting === 'excel' ? <Loader2Icon size={16} className="mr-2 animate-spin" /> : <FileSpreadsheetIcon size={16} className="mr-2" />}
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left bg-white rounded-xl border p-4 transition-colors ${isActive ? 'border-primary shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tab.bg}`}>
                <Icon size={20} className={tab.iconColor} />
              </div>
              <p className="font-heading font-bold text-sm text-primary mt-3">{tab.title}</p>
              <p className="text-xs text-gray-500 font-body mt-1">{tab.description}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm font-body">
            <Loader2Icon size={16} className="animate-spin" /> Loading report data...
          </div>
        )}
        {!isLoading && loadError && (
          <div className="py-16 text-center text-red-500 text-sm font-body">{loadError}</div>
        )}
        {!isLoading && !loadError && result && (
          <>
            {activeTab === 'portfolio' && <PortfolioSection result={result} />}
            {activeTab === 'delinquency' && <DelinquencySection result={result} />}
            {activeTab === 'collection' && <CollectionSection result={result} />}
            {activeTab === 'groups' && <GroupPerformanceSection result={result} />}
          </>
        )}
      </div>
    </div>
  );
}

function PortfolioSection({ result }: { result: LoanReportsResult }) {
  const { portfolioSummary } = result;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Loans" value={String(portfolioSummary.totalLoans)} />
        <StatCard label="Total Disbursed" value={formatNaira(portfolioSummary.totalDisbursedKobo)} />
        <StatCard label="Total Outstanding" value={formatNaira(portfolioSummary.totalOutstandingKobo)} tone="text-amber-600" />
        <StatCard label="Total Interest" value={formatNaira(portfolioSummary.totalInterestKobo)} />
        <StatCard label="Total Repaid" value={formatNaira(portfolioSummary.totalRepaidKobo)} tone="text-green-600" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {(Object.entries(portfolioSummary.byStatus) as [LoanStatus, number][]).map(([status, count]) => (
              <tr key={status}>
                <td className="px-4 py-3 text-gray-700">{STATUS_LABELS[status]}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DelinquencySection({ result }: { result: LoanReportsResult }) {
  const { delinquency } = result;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Overdue Accounts" value={String(delinquency.totalOverdueAccounts)} tone="text-red-600" />
        <StatCard label="Overdue Amount" value={formatNaira(delinquency.totalOverdueAmountKobo)} tone="text-red-600" />
        <StatCard label="Penalties Applied" value={formatNaira(delinquency.totalPenaltyAmountKobo)} />
        <StatCard label="At-risk Groups" value={String(delinquency.atRiskGroupCount)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Installment #</th>
              <th className="px-4 py-3 font-medium">Overdue</th>
              <th className="px-4 py-3 font-medium">Penalty</th>
              <th className="px-4 py-3 font-medium">Days Late</th>
              <th className="px-4 py-3 font-medium">Applied At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {delinquency.rows.map((row, index) => (
              <tr key={`${row.loanId}-${row.installmentNumber}-${index}`}>
                <td className="px-4 py-3 font-medium text-gray-800">{row.customerName}</td>
                <td className="px-4 py-3 text-gray-700">{row.groupName}</td>
                <td className="px-4 py-3 text-gray-600">{row.branchName ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{row.installmentNumber}</td>
                <td className="px-4 py-3 text-red-600 font-medium">{formatNaira(row.overdueAmountKobo)}</td>
                <td className="px-4 py-3 text-gray-700">{formatNaira(row.penaltyAmountKobo)}</td>
                <td className="px-4 py-3 text-gray-600">{row.daysLateAtApplication}</td>
                <td className="px-4 py-3 text-gray-500">{formatDisplayDate(row.appliedAt)}</td>
              </tr>
            ))}
            {delinquency.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm font-body">
                  No delinquent accounts right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CollectionSection({ result }: { result: LoanReportsResult }) {
  const weekly = result.collection.weekly;
  const maxKobo = Math.max(1, ...weekly.flatMap((w) => [w.expectedKobo, w.collectedKobo]));
  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 font-body">Expected vs. collected repayments over the last 8 weeks.</p>
      <div className="space-y-3">
        {weekly.map((period) => (
          <div key={period.periodLabel} className="text-sm">
            <div className="flex justify-between text-gray-600 mb-1">
              <span className="font-medium">{formatDisplayDate(period.periodStart)}</span>
              <span>
                {formatNaira(period.collectedKobo)} <span className="text-gray-400">/ {formatNaira(period.expectedKobo)} expected</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gray-300 absolute left-0 top-0"
                style={{ width: `${(period.expectedKobo / maxKobo) * 100}%` }}
              />
              <div
                className="h-full bg-green-500 absolute left-0 top-0"
                style={{ width: `${(period.collectedKobo / maxKobo) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupPerformanceSection({ result }: { result: LoanReportsResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
            <th className="px-4 py-3 font-medium">Group</th>
            <th className="px-4 py-3 font-medium">Branch</th>
            <th className="px-4 py-3 font-medium">Members</th>
            <th className="px-4 py-3 font-medium">Loans Raised</th>
            <th className="px-4 py-3 font-medium">Active Loans</th>
            <th className="px-4 py-3 font-medium">Total Disbursed</th>
            <th className="px-4 py-3 font-medium">Total Outstanding</th>
            <th className="px-4 py-3 font-medium">Repayment Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {result.groupPerformance.map((row) => (
            <tr key={row.groupId}>
              <td className="px-4 py-3 font-medium text-gray-800">{row.groupName}</td>
              <td className="px-4 py-3 text-gray-600">{row.branchName ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{row.memberCount}</td>
              <td className="px-4 py-3 text-gray-600">{row.totalLoansRaised}</td>
              <td className="px-4 py-3 text-gray-600">{row.activeLoansCount}</td>
              <td className="px-4 py-3 text-gray-700">{formatNaira(row.totalDisbursedKobo)}</td>
              <td className="px-4 py-3 text-amber-600">{formatNaira(row.totalOutstandingKobo)}</td>
              <td className="px-4 py-3">
                <span className={`font-medium ${row.repaymentRatePercent >= 80 ? 'text-green-600' : row.repaymentRatePercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {row.repaymentRatePercent}%
                </span>
              </td>
            </tr>
          ))}
          {result.groupPerformance.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm font-body">
                No groups with loan activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
