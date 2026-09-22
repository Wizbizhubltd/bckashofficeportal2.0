import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { TransactionsSection } from './sections/TransactionsSection';
import { ChargesSection } from './sections/ChargesSection';

interface SavingsAccount {
  id: number;
  clientType: string;
  clientId: number;
  officeId: number | null;
  savingsProductId: number | null;
  accountNumber: string | null;
  interestRate: number | null;
  allowOverdraft: boolean;
  minimumBalance: number | null;
  overdraftLimit: number | null;
  status: 'Pending' | 'Approved' | 'Closed' | 'Declined' | 'Withdrawn';
  balance: number | null;
  deposits: number | null;
  withdrawals: number | null;
  interestEarned: number | null;
  interestPosted: number | null;
  nextInterestCalculationDate: string | null;
  nextInterestPostingDate: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<SavingsAccount['status'], string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-100 text-gray-500',
  Declined: 'bg-red-100 text-red-700',
  Withdrawn: 'bg-gray-100 text-gray-500',
};

type Tab = 'transactions' | 'charges';

export function SavingsAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);

  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('transactions');
  const [showApprove, setShowApprove] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [overdraftLimit, setOverdraftLimit] = useState('');
  const [declineTarget, setDeclineTarget] = useState(false);
  const [showRepayFromSavings, setShowRepayFromSavings] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState('');
  const [repayAmount, setRepayAmount] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<SavingsAccount>(`/savings-accounts/${accountId}`);
      setAccount(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleApprove = async () => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/approve`, {
        openingBalance: openingBalance ? Number(openingBalance) : null,
        overdraftLimit: overdraftLimit ? Number(overdraftLimit) : null,
        date: null,
        notes: null,
      });
      toast.success('Account approved.');
      setShowApprove(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed.');
    }
  };

  const handleDecline = async (reason: string) => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/decline`, { reason });
      toast.success('Account declined.');
      setDeclineTarget(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Decline failed.');
    }
  };

  const handleClose = async () => {
    try {
      await apiClient.post(`/savings-accounts/${accountId}/close`, null);
      toast.success('Account closed.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Closing failed — withdraw the full balance first.');
    }
  };

  const handleRepayFromSavings = async () => {
    try {
      await apiClient.post('/savings-transfers/repay-loan', {
        savingsId: accountId,
        loanId: Number(repayLoanId),
        amount: Number(repayAmount),
        date: null,
        notes: null,
      });
      toast.success('Loan repaid from savings.');
      setShowRepayFromSavings(false);
      setRepayLoanId('');
      setRepayAmount('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfer failed.');
    }
  };

  if (loading || !account) {
    return <div className="text-center text-gray-400 py-12">Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">{account.accountNumber ?? `Savings #${account.id}`}</h1>
          <p className="text-sm text-gray-500 mt-1">Client #{account.clientId}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_STYLES[account.status]}`}>{account.status}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Balance</p>
          <p className="text-lg font-heading font-bold text-primary">{account.balance?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Interest Rate</p>
          <p className="text-lg font-heading font-bold text-primary">{account.interestRate ?? '—'}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Interest Earned</p>
          <p className="text-lg font-heading font-bold text-primary">{account.interestEarned?.toLocaleString() ?? '0'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Next Interest Posting</p>
          <p className="text-lg font-heading font-bold text-primary">{account.nextInterestPostingDate ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {account.status === 'Pending' && (
          <>
            <button onClick={() => setShowApprove(true)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
              Approve
            </button>
            <button onClick={() => setDeclineTarget(true)} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
              Decline
            </button>
          </>
        )}
        {account.status === 'Approved' && (
          <>
            <button onClick={() => void handleClose()} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Close Account
            </button>
            <button onClick={() => setShowRepayFromSavings(true)} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-[#e64a19]">
              Repay Loan from Savings
            </button>
          </>
        )}
      </div>

      {account.status === 'Approved' && (
        <>
          <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setTab('transactions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'transactions' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Transactions & Statement
            </button>
            <button
              onClick={() => setTab('charges')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'charges' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Charges
            </button>
          </div>

          {tab === 'transactions' ? (
            <TransactionsSection accountId={account.id} onChanged={load} />
          ) : (
            <ChargesSection accountId={account.id} onChanged={load} />
          )}
        </>
      )}

      {showApprove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Approve Savings Account</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (optional)</label>
                <input
                  type="text"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overdraft Limit (optional)</label>
                <input
                  type="text"
                  value={overdraftLimit}
                  onChange={(e) => setOverdraftLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowApprove(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void handleApprove()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {showRepayFromSavings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Repay Loan from Savings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan ID</label>
                <input
                  type="text"
                  value={repayLoanId}
                  onChange={(e) => setRepayLoanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="text"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowRepayFromSavings(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleRepayFromSavings()}
                disabled={!repayLoanId || !repayAmount}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-[#e64a19] disabled:opacity-60"
              >
                Repay
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={declineTarget}
        onClose={() => setDeclineTarget(false)}
        onConfirm={(reason) => void handleDecline(reason ?? '')}
        title="Decline this savings account?"
        description="Provide a reason for declining."
        confirmLabel="Decline"
        confirmVariant="danger"
        inputType="textarea"
        requireInput
      />
    </div>
  );
}
