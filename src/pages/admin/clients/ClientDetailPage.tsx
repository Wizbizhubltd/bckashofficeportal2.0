import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PencilIcon, CheckCircleIcon, XCircleIcon, PauseCircleIcon, PlayCircleIcon, BanIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { SimpleCrudScreen } from '../SimpleCrudScreen';
import { DocumentsSection } from './sections/DocumentsSection';
import type { ClientStatus, ClientType } from './ClientsListPage';

interface ClientProfile {
  id: number;
  accountNo: string | null;
  oldAccountNo: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ClientStatus;
  clientType: ClientType | null;
  bvn: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  officeId: number | null;
  joinedDate: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  postalCode: string | null;
  inactiveReason: string | null;
  declinedReason: string | null;
  closedReason: string | null;
}

interface ClientIdentification {
  id: number;
  clientIdentificationTypeId: number | null;
  name: string | null;
  active: boolean;
  notes: string | null;
}

interface NextOfKinOrGuardian {
  id: number;
  clientRelationshipId: number | null;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  notes: string | null;
}

interface NoteItem {
  id: number;
  notes: string | null;
}

type SectionKey = 'profile' | 'identifications' | 'next-of-kin' | 'guardians' | 'documents' | 'notes';

type TransitionKind = 'activate' | 'deactivate' | 'reactivate' | 'decline' | 'close';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'identifications', label: 'Identifications' },
  { key: 'next-of-kin', label: 'Next of Kin' },
  { key: 'guardians', label: 'Guardians' },
  { key: 'documents', label: 'Documents' },
  { key: 'notes', label: 'Notes' },
];

function canActivate(status: ClientStatus) { return status === 'Pending'; }
function canDeactivate(status: ClientStatus) { return status === 'Active'; }
function canReactivate(status: ClientStatus) { return status === 'Inactive'; }
function canDecline(status: ClientStatus) { return status === 'Pending'; }
function canClose(status: ClientStatus) { return status === 'Pending' || status === 'Active' || status === 'Inactive'; }

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>('profile');
  const [pendingTransition, setPendingTransition] = useState<TransitionKind | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ClientProfile>(`/clients/${clientId}`);
      setClient(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load client.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const runTransition = async (kind: TransitionKind, reason?: string) => {
    try {
      if (kind === 'activate') {
        await apiClient.post(`/clients/${clientId}/activate`, { activatedDate: null });
      } else if (kind === 'reactivate') {
        await apiClient.post(`/clients/${clientId}/reactivate`);
      } else {
        await apiClient.post(`/clients/${clientId}/${kind}`, { reason });
      }
      toast.success('Client status updated.');
      setPendingTransition(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  if (loading || !client) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const transitionModalConfig: Record<Exclude<TransitionKind, 'activate' | 'reactivate'>, { title: string; description: string }> = {
    deactivate: { title: 'Deactivate client', description: 'This client will move to Inactive status.' },
    decline: { title: 'Decline client', description: 'This client will move to Declined status — a terminal state.' },
    close: { title: 'Close client', description: 'This client will move to Closed status — a terminal state.' },
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-heading font-bold text-primary">
              {client.displayName || `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim()}
            </h1>
            <StatusBadge status={client.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Account No. {client.accountNo}
            {client.oldAccountNo && <> · Legacy Account No. {client.oldAccountNo}</>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/admin/clients/${client.id}/edit`}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg"
          >
            <PencilIcon size={16} />
            Edit
          </Link>
          {canActivate(client.status) && (
            <button onClick={() => void runTransition('activate')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <CheckCircleIcon size={16} />
              Activate
            </button>
          )}
          {canDeactivate(client.status) && (
            <button onClick={() => setPendingTransition('deactivate')} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg">
              <PauseCircleIcon size={16} />
              Deactivate
            </button>
          )}
          {canReactivate(client.status) && (
            <button onClick={() => void runTransition('reactivate')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <PlayCircleIcon size={16} />
              Reactivate
            </button>
          )}
          {canDecline(client.status) && (
            <button onClick={() => setPendingTransition('decline')} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg">
              <XCircleIcon size={16} />
              Decline
            </button>
          )}
          {canClose(client.status) && (
            <button onClick={() => setPendingTransition('close')} className="flex items-center gap-2 border border-gray-200 text-red-600 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-lg">
              <BanIcon size={16} />
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-2 text-sm font-heading font-medium border-b-2 -mb-px transition-colors ${
              section === s.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileField label="Client Type" value={client.clientType} />
          <ProfileField label="BVN" value={client.bvn} />
          <ProfileField label="Mobile" value={client.mobile} />
          <ProfileField label="Phone" value={client.phone} />
          <ProfileField label="Email" value={client.email} />
          <ProfileField label="Occupation" value={client.occupation} />
          <ProfileField label="Joined Date" value={client.joinedDate} />
          <ProfileField label="Address" value={[client.street, client.ward, client.district, client.region, client.city, client.state, client.country].filter(Boolean).join(', ') || null} />
          <ProfileField label="Postal Code" value={client.postalCode} />
          {client.status === 'Inactive' && <ProfileField label="Inactive Reason" value={client.inactiveReason} />}
          {client.status === 'Declined' && <ProfileField label="Declined Reason" value={client.declinedReason} />}
          {client.status === 'Closed' && <ProfileField label="Closed Reason" value={client.closedReason} />}
        </div>
      )}

      {section === 'identifications' && (
        <SimpleCrudScreen<ClientIdentification>
          title="Identifications"
          description="Identification documents on file (FR-CLI-3). Identification Type is entered by ID from the Identification Types admin screen."
          endpoint={`/clients/${clientId}/identifications`}
          columns={[
            { key: 'name', label: 'Document No.' },
            { key: 'clientIdentificationTypeId', label: 'Type ID' },
            { key: 'active', label: 'Active', render: (i) => (i.active ? 'Yes' : 'No') },
          ]}
          fields={[
            { key: 'clientIdentificationTypeId', label: 'Identification Type ID', type: 'number' },
            { key: 'name', label: 'Document No.', type: 'text' },
            { key: 'active', label: 'Active', type: 'checkbox' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyItem={{ clientIdentificationTypeId: null, name: '', active: true, notes: '' }}
        />
      )}

      {section === 'next-of-kin' && (
        <SimpleCrudScreen<NextOfKinOrGuardian>
          title="Next of Kin"
          description="Next-of-kin contacts (FR-CLI-3). Relationship is entered by ID from the Relationship Types admin screen."
          endpoint={`/clients/${clientId}/next-of-kin`}
          columns={[
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'mobile', label: 'Mobile' },
          ]}
          fields={[
            { key: 'clientRelationshipId', label: 'Relationship Type ID', type: 'number' },
            { key: 'firstName', label: 'First Name', type: 'text' },
            { key: 'lastName', label: 'Last Name', type: 'text' },
            { key: 'mobile', label: 'Mobile', type: 'text' },
            { key: 'email', label: 'Email', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyItem={{ clientRelationshipId: null, firstName: '', lastName: '', mobile: '', email: '', notes: '' }}
        />
      )}

      {section === 'guardians' && (
        <SimpleCrudScreen<NextOfKinOrGuardian>
          title="Next of Guardians"
          description="Next-of-guardian contacts (FR-CLI-3). Relationship is entered by ID from the Relationship Types admin screen."
          endpoint={`/clients/${clientId}/next-of-guardians`}
          columns={[
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'mobile', label: 'Mobile' },
          ]}
          fields={[
            { key: 'clientRelationshipId', label: 'Relationship Type ID', type: 'number' },
            { key: 'firstName', label: 'First Name', type: 'text' },
            { key: 'lastName', label: 'Last Name', type: 'text' },
            { key: 'mobile', label: 'Mobile', type: 'text' },
            { key: 'email', label: 'Email', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          emptyItem={{ clientRelationshipId: null, firstName: '', lastName: '', mobile: '', email: '', notes: '' }}
        />
      )}

      {section === 'documents' && <DocumentsSection clientId={clientId} />}

      {section === 'notes' && (
        <SimpleCrudScreen<NoteItem>
          title="Notes"
          description="Free-text notes on this client (FR-CLI-3)."
          endpoint={`/clients/${clientId}/notes`}
          columns={[{ key: 'notes', label: 'Note' }]}
          fields={[{ key: 'notes', label: 'Note', type: 'textarea' }]}
          emptyItem={{ notes: '' }}
        />
      )}

      {pendingTransition && pendingTransition !== 'activate' && pendingTransition !== 'reactivate' && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setPendingTransition(null)}
          onConfirm={(reason) => void runTransition(pendingTransition, reason)}
          title={transitionModalConfig[pendingTransition].title}
          description={transitionModalConfig[pendingTransition].description}
          inputType="textarea"
          inputLabel="Reason"
          requireInput
          confirmLabel={transitionModalConfig[pendingTransition].title}
          confirmVariant="danger"
        />
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
