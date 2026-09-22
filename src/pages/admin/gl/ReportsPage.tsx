import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';

interface TrialBalanceRow {
  glAccountId: number;
  name: string | null;
  glCode: string | null;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
}

interface AccountTypeBalance {
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
}

interface ProfitAndLoss {
  sections: AccountTypeBalance[];
  netProfit: number;
}

interface CashFlowPeriod {
  period: string;
  netMovement: number;
}

type Tab = 'trial-balance' | 'balance-sheet' | 'profit-and-loss' | 'cash-flow';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'profit-and-loss', label: 'Profit & Loss' },
  { id: 'cash-flow', label: 'Cash Flow' },
];

/** FR-GL-7 — explicitly basic/unstyled at this stage per the phase spec; polish is Phase 8's reporting pass. */
export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('trial-balance');
  const [officeId, setOfficeId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<AccountTypeBalance[]>([]);
  const [profitAndLoss, setProfitAndLoss] = useState<ProfitAndLoss | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  const params = () => ({
    officeId: officeId || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'trial-balance') {
        const r = await apiClient.get<TrialBalanceRow[]>('/gl/reports/trial-balance', { params: params() });
        setTrialBalance(r.data);
      } else if (tab === 'balance-sheet') {
        const r = await apiClient.get<AccountTypeBalance[]>('/gl/reports/balance-sheet', { params: params() });
        setBalanceSheet(r.data);
      } else if (tab === 'profit-and-loss') {
        const r = await apiClient.get<ProfitAndLoss>('/gl/reports/profit-and-loss', { params: params() });
        setProfitAndLoss(r.data);
      } else {
        const r = await apiClient.get<CashFlowPeriod[]>('/gl/reports/cash-flow', { params: params() });
        setCashFlow(r.data);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-heading font-bold text-primary">Financial Reports</h1>
        <p className="text-sm text-gray-500 mt-1">FR-GL-7. Computed from approved, non-reversed journal entries. Cash flow is a simplified view — see docs/gl-posting-spec.md.</p>
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Office ID</label>
          <input type="text" value={officeId} onChange={(e) => setOfficeId(e.target.value)} className="w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <button onClick={() => void load()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
          Apply
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400">Loading…</div>
        ) : tab === 'trial-balance' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Debit</th>
                <th className="px-4 py-3 font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trialBalance.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No data for this filter.</td></tr>
              ) : (
                <>
                  {trialBalance.map((row) => (
                    <tr key={row.glAccountId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{row.glCode}</td>
                      <td className="px-4 py-3 text-gray-700">{row.name}</td>
                      <td className="px-4 py-3 text-gray-700">{row.accountType}</td>
                      <td className="px-4 py-3 text-gray-700">{row.totalDebit.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700">{row.totalCredit.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3">{trialBalance.reduce((s, r) => s + r.totalDebit, 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{trialBalance.reduce((s, r) => s + r.totalCredit, 0).toLocaleString()}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        ) : tab === 'balance-sheet' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Debit</th>
                <th className="px-4 py-3 font-medium">Credit</th>
                <th className="px-4 py-3 font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {balanceSheet.map((row) => (
                <tr key={row.accountType} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.accountType}</td>
                  <td className="px-4 py-3 text-gray-700">{row.totalDebit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{row.totalCredit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{row.net.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'profit-and-loss' ? (
          <div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Debit</th>
                  <th className="px-4 py-3 font-medium">Credit</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profitAndLoss?.sections.map((row) => (
                  <tr key={row.accountType} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{row.accountType}</td>
                    <td className="px-4 py-3 text-gray-700">{row.totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{row.totalCredit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{row.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 font-medium text-sm">Net Profit: {profitAndLoss?.netProfit.toLocaleString() ?? 0}</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Net Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashFlow.length === 0 ? (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">No data for this filter.</td></tr>
              ) : (
                cashFlow.map((row) => (
                  <tr key={row.period} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{row.period}</td>
                    <td className="px-4 py-3 text-gray-700">{row.netMovement.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
