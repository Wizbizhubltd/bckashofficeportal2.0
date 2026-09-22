import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangleIcon, RotateCcwIcon, BanknoteIcon, XOctagonIcon, CalendarClockIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { SimpleCrudScreen } from '../SimpleCrudScreen';
import { ScheduleSection } from './sections/ScheduleSection';
import { RepaymentsSection } from './sections/RepaymentsSection';

type LoanStatus = 'New' | 'Pending' | 'Approved' | 'NeedChanges' | 'Disbursed' | 'Declined' | 'Rejected' | 'Withdrawn' | 'WrittenOff' | 'Closed' | 'PendingReschedule' | 'Rescheduled' | 'Paid';

interface LoanProfile {
  id: number;
  clientType: 'Client' | 'Group';
  loanProductId: number | null;
  clientId: number | null;
  officeId: number | null;
  groupId: number | null;
  accountNumber: string | null;
  principal: number | null;
  appliedAmount: number | null;
  approvedAmount: number | null;
  loanTerm: number | null;
  loanTermType: string | null;
  interestRate: number | null;
  status: LoanStatus;
  approvedNotes: string | null;
  disbursementDate: string | null;
  disbursedNotes: string | null;
  writtenOffDate: string | null;
  writtenOffNotes: string | null;
  isNpa: boolean;
  incomeSuspended: boolean;
  notes: string | null;
}

interface LoanCharge {
  id: number;
  chargeId: number | null;
  penalty: boolean;
  chargeType: string;
  chargeOption: string;
  amount: number | null;
  dueDate: string | null;
  gracePeriod: number;
}

type SectionKey = 'profile' | 'schedule' | 'repayments' | 'charges';

// StatusBadge's union doesn't cover every LoanStatus value — map the ones this app currently
// reaches to a badge status it does support, and fall back to a plain pill for the rest.
function toBadgeStatus(status: LoanStatus): 'Pending' | 'Approved' | 'Rejected' | 'Closed' | null {
  switch (status) {
    case 'Pending':
    case 'PendingReschedule':
      return 'Pending';
    case 'Approved':
    case 'Disbursed':
    case 'Rescheduled':
    case 'Paid':
      return 'Approved';
    case 'Declined':
    case 'Rejected':
    case 'WrittenOff':
      return 'Rejected';
    case 'Closed':
      return 'Closed';
    default:
      return null;
  }
}

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const loanId = Number(id);

  const [loan, setLoan] = useState<LoanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>('profile');
  const [scheduleRefreshToken, setScheduleRefreshToken] = useState(0);

  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [showDisburse, setShowDisburse] = useState(false);
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');
  const [showWriteOff, setShowWriteOff] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reschedulePrincipal, setReschedulePrincipal] = useState('');
  const [rescheduleFromDate, setRescheduleFromDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<LoanProfile>(`/loans/${loanId}`);
      setLoan(response.data);
      setDisbursedAmount(response.data.approvedAmount?.toString() ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load loan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const reloadAfterServicingAction = async () => {
    setScheduleRefreshToken((t) => t + 1);
    await load();
  };

  const handleRequestChanges = async (reason?: string) => {
    try {
      await apiClient.post(`/loans/${loanId}/request-changes`, { reason });
      toast.success('Changes requested.');
      setShowRequestChanges(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  const handleResubmit = async () => {
    try {
      await apiClient.post(`/loans/${loanId}/resubmit`);
      toast.success('Loan resubmitted.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  const handleDisburse = async () => {
    try {
      await apiClient.post(`/loans/${loanId}/disburse`, {
        disbursementDate: null,
        disbursedAmount: Number(disbursedAmount),
        notes: disburseNotes || null,
      });
      toast.success('Loan disbursed and repayment schedule generated.');
      setShowDisburse(false);
      await reloadAfterServicingAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Disbursement failed.');
    }
  };

  const handleWriteOff = async (reason?: string) => {
    try {
      await apiClient.post(`/loans/${loanId}/write-off`, { reason, date: null });
      toast.success('Loan written off.');
      setShowWriteOff(false);
      await reloadAfterServicingAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Write-off failed.');
    }
  };

  const handleReschedule = async () => {
    try {
      await apiClient.post(`/loans/${loanId}/reschedule-requests`, {
        principal: Number(reschedulePrincipal),
        rescheduleFromDate,
        recalculateInterest: true,
        notes: rescheduleNotes || null,
      });
      toast.success('Reschedule request created — approve it from the Reschedule Requests below to regenerate the schedule.');
      setShowReschedule(false);
      setReschedulePrincipal('');
      setRescheduleFromDate('');
      setRescheduleNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reschedule request failed.');
    }
  };

  if (loading || !loan) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const badgeStatus = toBadgeStatus(loan.status);
  const hasActiveSchedule = loan.status === 'Disbursed' || loan.status === 'Rescheduled';

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-heading font-bold text-primary">Loan {loan.accountNumber}</h1>
            {badgeStatus ? <StatusBadge status={badgeStatus} /> : (
              <span className="px-2.5 py-1 rounded-full text-xs font-heading font-medium border bg-gray-100 text-gray-600 border-gray-200">
                {loan.status}
              </span>
            )}
            {loan.isNpa && (
              <span className="px-2.5 py-1 rounded-full text-xs font-heading font-medium border bg-red-100 text-red-700 border-red-200">
                NPA{loan.incomeSuspended ? ' · Income Suspended' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {loan.clientType} · Approved {loan.approvedAmount?.toLocaleString() ?? '—'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {loan.status === 'Pending' && (
            <>
              <button
                onClick={() => setShowDisburse(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
              >
                <BanknoteIcon size={16} />
                Disburse
              </button>
              <button
                onClick={() => setShowRequestChanges(true)}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg"
              >
                <AlertTriangleIcon size={16} />
                Request Changes
              </button>
            </>
          )}
          {loan.status === 'NeedChanges' && (
            <button
              onClick={() => void handleResubmit()}
              className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 text-sm font-medium px-3 py-2 rounded-lg"
            >
              <RotateCcwIcon size={16} />
              Resubmit
            </button>
          )}
          {hasActiveSchedule && (
            <>
              <button
                onClick={() => setShowReschedule(true)}
                className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg"
              >
                <CalendarClockIcon size={16} />
                Reschedule
              </button>
              <button
                onClick={() => setShowWriteOff(true)}
                className="flex items-center gap-2 border border-gray-200 text-red-600 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-lg"
              >
                <XOctagonIcon size={16} />
                Write Off
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {(['profile', 'schedule', 'repayments', 'charges'] as SectionKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 text-sm font-heading font-medium border-b-2 -mb-px transition-colors capitalize ${
              section === s ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileField label="Applied Amount" value={loan.appliedAmount?.toLocaleString() ?? null} />
          <ProfileField label="Approved Amount" value={loan.approvedAmount?.toLocaleString() ?? null} />
          <ProfileField label="Disbursed Principal" value={loan.principal?.toLocaleString() ?? null} />
          <ProfileField label="Interest Rate" value={loan.interestRate ? `${loan.interestRate}%` : null} />
          <ProfileField label="Term" value={loan.loanTerm ? `${loan.loanTerm} ${loan.loanTermType ?? ''}` : null} />
          <ProfileField label="Disbursement Date" value={loan.disbursementDate} />
          <ProfileField label="Approval Notes" value={loan.approvedNotes} />
          <ProfileField label="Disbursement Notes" value={loan.disbursedNotes} />
          {loan.status === 'WrittenOff' && <ProfileField label="Written-Off Date" value={loan.writtenOffDate} />}
          {loan.status === 'WrittenOff' && <ProfileField label="Written-Off Reason" value={loan.writtenOffNotes} />}
          <ProfileField label="Notes" value={loan.notes} />
        </div>
      )}

      {section === 'schedule' && (
        <div className="space-y-6">
          <ScheduleSection loanId={loanId} refreshToken={scheduleRefreshToken} />
          <RescheduleRequestsList loanId={loanId} refreshToken={scheduleRefreshToken} onChanged={reloadAfterServicingAction} />
        </div>
      )}

      {section === 'repayments' && <RepaymentsSection loanId={loanId} onChanged={reloadAfterServicingAction} />}

      {section === 'charges' && (
        <SimpleCrudScreen<LoanCharge>
          title="Loan Charges"
          description="Loan-level charges (BR-LN-6). Amount is entered directly, not auto-calculated from the schedule."
          endpoint={`/loans/${loanId}/charges`}
          columns={[
            { key: 'chargeType', label: 'Type' },
            { key: 'amount', label: 'Amount' },
            { key: 'dueDate', label: 'Due Date' },
            { key: 'penalty', label: 'Penalty', render: (c) => (c.penalty ? 'Yes' : 'No') },
          ]}
          fields={[
            { key: 'chargeId', label: 'Charge ID (optional)', type: 'number' },
            { key: 'chargeType', label: 'Type (e.g. Disbursement, InstallmentFee)', type: 'text' },
            { key: 'chargeOption', label: 'Calculation Basis (e.g. Flat, Percentage)', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'number' },
            { key: 'dueDate', label: 'Due Date', type: 'text' },
            { key: 'gracePeriod', label: 'Grace Period (days)', type: 'number' },
            { key: 'penalty', label: 'Penalty', type: 'checkbox' },
          ]}
          emptyItem={{ chargeId: null, chargeType: 'Disbursement', chargeOption: 'Flat', amount: null, dueDate: null, gracePeriod: 0, penalty: false }}
        />
      )}

      <p className="text-xs text-gray-400 mt-4">
        The repayment schedule uses a best-effort interest/amortization formula that has not been validated against BCKash's legacy system — see docs/interest-calculation-spec.md.
      </p>

      <ConfirmationModal
        isOpen={showRequestChanges}
        onClose={() => setShowRequestChanges(false)}
        onConfirm={(reason) => void handleRequestChanges(reason)}
        title="Request changes"
        description="This loan will move to Need Changes, sending it back to the loan officer to revise terms (FR-LN-7)."
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Request Changes"
        confirmVariant="orange"
      />

      <ConfirmationModal
        isOpen={showWriteOff}
        onClose={() => setShowWriteOff(false)}
        onConfirm={(reason) => void handleWriteOff(reason)}
        title="Write off this loan?"
        description="All outstanding principal, interest, fees, and penalty will be moved out of the active portfolio (FR-LN-24)."
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Write Off"
        confirmVariant="danger"
      />

      {showDisburse && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-2">Disburse Loan</h2>
            <p className="text-xs text-gray-500 mb-4">
              This generates the full repayment schedule (best-effort formula — see docs/interest-calculation-spec.md).
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disbursed Amount</label>
                <input
                  type="text"
                  value={disbursedAmount}
                  onChange={(e) => setDisbursedAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowDisburse(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleDisburse()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Disburse
              </button>
            </div>
          </div>
        </div>
      )}

      {showReschedule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-2">Request Reschedule</h2>
            <p className="text-xs text-gray-500 mb-4">
              Creates a pending request (FR-LN-23) — approving it (from the Reschedule Requests list) regenerates the schedule from the reschedule-from date forward.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Outstanding Principal</label>
                <input
                  type="text"
                  value={reschedulePrincipal}
                  onChange={(e) => setReschedulePrincipal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reschedule From Date</label>
                <input
                  type="date"
                  value={rescheduleFromDate}
                  onChange={(e) => setRescheduleFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowReschedule(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={() => void handleReschedule()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
                Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  );
}

interface RescheduleRequest {
  id: number;
  principal: number | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  rescheduleFromDate: string | null;
  notes: string | null;
}

function RescheduleRequestsList({ loanId, refreshToken, onChanged }: { loanId: number; refreshToken: number; onChanged: () => void }) {
  const [items, setItems] = useState<RescheduleRequest[]>([]);

  const load = async () => {
    try {
      const response = await apiClient.get<RescheduleRequest[]>(`/loans/${loanId}/reschedule-requests`);
      setItems(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load reschedule requests.');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId, refreshToken]);

  const act = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      await apiClient.post(`/loans/${loanId}/reschedule-requests/${requestId}/${action}`, action === 'reject' ? { reason: null } : undefined);
      toast.success(action === 'approve' ? 'Reschedule approved — schedule regenerated.' : 'Reschedule rejected.');
      await load();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Reschedule Requests</h3>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">New Principal</th>
              <th className="px-4 py-3 font-medium">From Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{r.principal?.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">{r.rescheduleFromDate}</td>
                <td className="px-4 py-3 text-gray-700">{r.status}</td>
                <td className="px-4 py-3">
                  {r.status === 'Pending' && (
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => void act(r.id, 'approve')} className="text-xs text-green-700 hover:underline">Approve</button>
                      <button onClick={() => void act(r.id, 'reject')} className="text-xs text-red-600 hover:underline">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
