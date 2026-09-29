import { useEffect, useState } from 'react';
import { AlertTriangleIcon, CalendarCheckIcon, CheckCircle2Icon, CoinsIcon, HourglassIcon, PiggyBankIcon, ReceiptIcon, WalletIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { formatMoney } from '../../../../utils/money';

/** The loan at a glance — see the API's GET /loans/{id}/summary. */
interface LoanSummary {
  principal: number | null;
  interest: number | null;
  expectedTotal: number | null;
  fees: number | null;
  expectedCompletionDate: string | null;
  totalRepaid: number;
  savedFromRepayments: number;
  totalRemaining: number | null;
  savingsRate: number | null;
  customerTotal: number | null;
  customerRemaining: number | null;
  penalty: {
    charged: number;
    paid: number;
    waived: number;
    outstanding: number;
    startedOn: string | null;
    status: 'None' | 'Unpaid' | 'PartPaid' | 'Paid' | 'Waived';
  };
  /** Whether it's completed (fully repaid and closed), or what's still owed that keeps it open. */
  completion: {
    completed: boolean;
    completedOn: string | null;
    principalOwed: number;
    interestOwed: number;
    feesOwed: number;
    penaltyOwed: number;
  } | null;
}

const PENALTY_STATUS: Record<LoanSummary['penalty']['status'], { label: string; className: string }> = {
  None: { label: 'No penalties', className: 'bg-gray-100 text-gray-600' },
  Unpaid: { label: 'Unpaid', className: 'bg-red-100 text-red-700' },
  PartPaid: { label: 'Part paid', className: 'bg-amber-100 text-amber-800' },
  Paid: { label: 'Paid', className: 'bg-green-100 text-green-700' },
  Waived: { label: 'Waived', className: 'bg-gray-100 text-gray-600' },
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

/**
 * Always shown on the loan page: principal, what it comes to with interest and when it should finish,
 * what's been repaid and what's left, and the loan's penalties. On a savings loan a share of each
 * repayment goes to the client's savings, so what the client pays is a little more than what the loan is owed.
 */
export function LoanSummaryCards({ loanId, refreshToken }: { loanId: number; refreshToken?: number }) {
  const [summary, setSummary] = useState<LoanSummary | null>(null);

  useEffect(() => {
    apiClient
      .get<LoanSummary>(`/loans/${loanId}/summary`)
      .then((response) => setSummary(response.data))
      .catch(() => setSummary(null));
  }, [loanId, refreshToken]);

  if (!summary) return null;

  const saves = (summary.savingsRate ?? 0) > 0;
  const percent = saves ? `${Number(((summary.savingsRate ?? 0) * 100).toFixed(2))}%` : null;
  const penalty = summary.penalty;
  const status = PENALTY_STATUS[penalty.status];

  return (
    <div className="mb-6 space-y-4">
      <CompletionBanner summary={summary} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card icon={CoinsIcon} label="Principal" value={formatMoney(summary.principal)} />
        <Card
          icon={ReceiptIcon}
          label="Expected on completion"
          value={summary.expectedTotal === null ? '—' : formatMoney(summary.expectedTotal)}
          detail={
            summary.expectedTotal === null
              ? 'Known once disbursed'
              : saves
                ? `Principal + interest. Client pays ${formatMoney(summary.customerTotal)} with ${percent} to savings`
                : 'Principal + interest'
          }
        />
        <Card icon={CalendarCheckIcon} label="Expected completion" value={formatDate(summary.expectedCompletionDate)} />
        <Card
          icon={WalletIcon}
          label="Total repaid"
          value={formatMoney(summary.totalRepaid)}
          detail={summary.savedFromRepayments > 0 ? `${formatMoney(summary.savedFromRepayments)} of it went to the client's savings` : undefined}
        />
        <Card
          icon={PiggyBankIcon}
          label="Total remaining"
          value={summary.totalRemaining === null ? '—' : formatMoney(saves ? summary.customerRemaining : summary.totalRemaining)}
          detail={saves && summary.totalRemaining !== null ? `For the client to pay — ${formatMoney(summary.totalRemaining)} still owed to the loan` : undefined}
          tone={summary.totalRemaining === 0 ? 'good' : undefined}
        />
      </div>

      {penalty.status !== 'None' && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-red-100 bg-red-50/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon size={18} className="text-red-600" />
            <span className="font-heading text-sm font-bold text-gray-800">Penalty fees</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          </div>
          <Fact label="Charged" value={formatMoney(penalty.charged)} />
          <Fact label="Started" value={formatDate(penalty.startedOn)} />
          <Fact label="Paid" value={formatMoney(penalty.paid)} />
          {penalty.waived > 0 && <Fact label="Waived" value={formatMoney(penalty.waived)} />}
          <Fact label="Outstanding" value={formatMoney(penalty.outstanding)} />
        </div>
      )}
    </div>
  );
}

/** Completed and closed out — or, for a loan being repaid, exactly what still keeps it open. */
function CompletionBanner({ summary }: { summary: LoanSummary }) {
  const completion = summary.completion;
  if (!completion) return null;

  if (completion.completed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800">
        <CheckCircle2Icon size={18} className="flex-shrink-0" />
        <p>
          <span className="font-heading font-bold">Completed.</span> Fully repaid — principal, interest, fees and penalties — and closed out
          {completion.completedOn ? ` on ${formatDate(completion.completedOn)}` : ''}.
        </p>
      </div>
    );
  }

  // Only a disbursed loan (one with a schedule) can be "not completed yet".
  if (summary.totalRemaining === null || summary.totalRemaining <= 0) return null;

  const loanOwed = completion.principalOwed + completion.interestOwed;
  const parts = [
    completion.principalOwed > 0 && `${formatMoney(completion.principalOwed)} principal`,
    completion.interestOwed > 0 && `${formatMoney(completion.interestOwed)} interest`,
    completion.feesOwed > 0 && `${formatMoney(completion.feesOwed)} in fees`,
    completion.penaltyOwed > 0 && `${formatMoney(completion.penaltyOwed)} in penalties`,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
      <HourglassIcon size={18} className="mt-0.5 flex-shrink-0" />
      <p>
        <span className="font-heading font-bold">Not completed yet.</span>{' '}
        {loanOwed <= 0
          ? `Principal and interest are fully repaid, but ${parts.join(' and ')} ${parts.length === 1 ? 'is' : 'are'} still owed. The loan closes once ${parts.length === 1 ? 'it is' : 'they are'} paid or waived.`
          : `Still owed: ${parts.join(', ')}. The loan closes automatically once everything is paid.`}
      </p>
    </div>
  );
}

function Card({ icon: Icon, label, value, detail, tone }: { icon: typeof CoinsIcon; label: string; value: string; detail?: string; tone?: 'good' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon size={16} className="text-primary" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-2 font-heading text-xl font-bold ${tone === 'good' ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
