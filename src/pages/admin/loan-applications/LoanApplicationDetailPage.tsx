import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PencilIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { SimpleCrudScreen } from '../SimpleCrudScreen';

type ApprovalStatus = 'Pending' | 'Approved' | 'Declined';

interface LoanApplicationProfile {
  id: number;
  clientType: 'Client' | 'Group';
  loanId: number | null;
  loanPurposeId: number | null;
  officeId: number | null;
  clientId: number | null;
  groupId: number | null;
  loanProductId: number;
  amount: number;
  status: ApprovalStatus;
  loanTerm: number | null;
  loanTermType: string | null;
  approvedNotes: string | null;
  declinedNotes: string | null;
  notes: string | null;
}

interface Guarantor {
  id: number;
  clientId: number | null;
  isClient: boolean;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  amount: number | null;
}

interface Collateral {
  id: number;
  collateralTypeId: number | null;
  name: string | null;
  serial: string | null;
  value: number | null;
  description: string | null;
}

type SectionKey = 'profile' | 'guarantors' | 'collateral';

export function LoanApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = Number(id);

  const [application, setApplication] = useState<LoanApplicationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>('profile');
  const [showApprove, setShowApprove] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [approveNotes, setApproveNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<LoanApplicationProfile>(`/loan-applications/${applicationId}`);
      setApplication(response.data);
      setApprovedAmount(response.data.amount?.toString() ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load application.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const handleApprove = async () => {
    try {
      await apiClient.post(`/loan-applications/${applicationId}/approve`, {
        approvedAmount: Number(approvedAmount),
        notes: approveNotes || null,
      });
      toast.success('Application approved — a loan record was created.');
      setShowApprove(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed.');
    }
  };

  const handleDecline = async (reason?: string) => {
    try {
      await apiClient.post(`/loan-applications/${applicationId}/decline`, { reason });
      toast.success('Application declined.');
      setShowDecline(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Decline failed.');
    }
  };

  if (loading || !application) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const isPending = application.status === 'Pending';

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-heading font-bold text-primary">Application #{application.id}</h1>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {application.clientType} · Requested {application.amount.toLocaleString()}
            {application.loanId && (
              <>
                {' '}· Linked loan{' '}
                <Link to={`/admin/loans/${application.loanId}`} className="text-primary hover:underline">
                  #{application.loanId}
                </Link>
              </>
            )}
          </p>
        </div>

        {isPending && (
          <div className="flex items-center gap-2">
            <Link
              to={`/admin/loan-applications/${application.id}/edit`}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg"
            >
              <PencilIcon size={16} />
              Edit
            </Link>
            <button
              onClick={() => setShowApprove(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
            >
              <CheckCircleIcon size={16} />
              Approve
            </button>
            <button
              onClick={() => setShowDecline(true)}
              className="flex items-center gap-2 border border-gray-200 text-red-600 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-lg"
            >
              <XCircleIcon size={16} />
              Decline
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {(['profile', 'guarantors', 'collateral'] as SectionKey[]).map((s) => (
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
          <ProfileField label="Loan Product ID" value={String(application.loanProductId)} />
          <ProfileField label="Term" value={application.loanTerm ? `${application.loanTerm} ${application.loanTermType ?? ''}` : null} />
          <ProfileField label="Notes" value={application.notes} />
          {application.status === 'Approved' && <ProfileField label="Approved Notes" value={application.approvedNotes} />}
          {application.status === 'Declined' && <ProfileField label="Declined Reason" value={application.declinedNotes} />}
        </div>
      )}

      {section === 'guarantors' && (
        <SimpleCrudScreen<Guarantor>
          title="Guarantors"
          description="Guarantors on this application (FR-LN-21)."
          endpoint={`/loan-applications/${applicationId}/guarantors`}
          columns={[
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'amount', label: 'Amount' },
          ]}
          fields={[
            { key: 'clientId', label: 'Existing Client ID (if a client guarantor)', type: 'number' },
            { key: 'isClient', label: 'Is an existing client', type: 'checkbox' },
            { key: 'firstName', label: 'First Name', type: 'text' },
            { key: 'lastName', label: 'Last Name', type: 'text' },
            { key: 'mobile', label: 'Mobile', type: 'tel' },
            { key: 'amount', label: 'Guaranteed Amount', type: 'number' },
          ]}
          emptyItem={{ clientId: null, isClient: false, firstName: '', lastName: '', mobile: '', amount: null }}
        />
      )}

      {section === 'collateral' && (
        <SimpleCrudScreen<Collateral>
          title="Collateral"
          description="Collateral items on this application (FR-LN-22)."
          endpoint={`/loan-applications/${applicationId}/collateral`}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'serial', label: 'Serial No.' },
            { key: 'value', label: 'Value' },
          ]}
          fields={[
            { key: 'collateralTypeId', label: 'Collateral Type ID', type: 'number' },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'serial', label: 'Serial No.', type: 'text' },
            { key: 'value', label: 'Estimated Value', type: 'number' },
            { key: 'description', label: 'Description', type: 'textarea' },
          ]}
          emptyItem={{ collateralTypeId: null, name: '', serial: '', value: null, description: '' }}
        />
      )}

      {showApprove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Approve Application</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approved Amount</label>
                <input
                  type="text"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowApprove(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleApprove()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDecline}
        onClose={() => setShowDecline(false)}
        onConfirm={(reason) => void handleDecline(reason)}
        title="Decline application"
        description="This application will be declined — a terminal state. A new application must be created if the client wants to reapply."
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Decline"
        confirmVariant="danger"
      />
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
