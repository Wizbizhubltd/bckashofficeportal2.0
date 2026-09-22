import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PencilIcon, CheckCircleIcon, XCircleIcon, PauseCircleIcon, PlayCircleIcon, BanIcon } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { MembersSection } from './sections/MembersSection';
import type { ClientStatus } from '../clients/ClientsListPage';

interface GroupProfile {
  id: number;
  accountNo: string | null;
  name: string | null;
  status: ClientStatus;
  officeId: number | null;
  joinedDate: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  region: string | null;
  address: string | null;
  notes: string | null;
  inactiveReason: string | null;
  declinedReason: string | null;
  closedReason: string | null;
}

type SectionKey = 'profile' | 'members';

type TransitionKind = 'activate' | 'deactivate' | 'reactivate' | 'decline' | 'close';

function canActivate(status: ClientStatus) { return status === 'Pending'; }
function canDeactivate(status: ClientStatus) { return status === 'Active'; }
function canReactivate(status: ClientStatus) { return status === 'Inactive'; }
function canDecline(status: ClientStatus) { return status === 'Pending'; }
function canClose(status: ClientStatus) { return status === 'Pending' || status === 'Active' || status === 'Inactive'; }

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);

  const [group, setGroup] = useState<GroupProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<SectionKey>('profile');
  const [pendingTransition, setPendingTransition] = useState<TransitionKind | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<GroupProfile>(`/groups/${groupId}`);
      setGroup(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load group.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const runTransition = async (kind: TransitionKind, reason?: string) => {
    try {
      if (kind === 'activate') {
        await apiClient.post(`/groups/${groupId}/activate`, { activatedDate: null });
      } else if (kind === 'reactivate') {
        await apiClient.post(`/groups/${groupId}/reactivate`);
      } else {
        await apiClient.post(`/groups/${groupId}/${kind}`, { reason });
      }
      toast.success('Group status updated.');
      setPendingTransition(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  if (loading || !group) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const transitionModalConfig: Record<Exclude<TransitionKind, 'activate' | 'reactivate'>, { title: string; description: string }> = {
    deactivate: { title: 'Deactivate group', description: 'This group will move to Inactive status.' },
    decline: { title: 'Decline group', description: 'This group will move to Declined status — a terminal state.' },
    close: { title: 'Close group', description: 'This group will move to Closed status — a terminal state.' },
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-heading font-bold text-primary">{group.name}</h1>
            <StatusBadge status={group.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Account No. {group.accountNo || `#${group.id}`}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/admin/groups/${group.id}/edit`}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg"
          >
            <PencilIcon size={16} />
            Edit
          </Link>
          {canActivate(group.status) && (
            <button onClick={() => void runTransition('activate')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <CheckCircleIcon size={16} />
              Activate
            </button>
          )}
          {canDeactivate(group.status) && (
            <button onClick={() => setPendingTransition('deactivate')} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg">
              <PauseCircleIcon size={16} />
              Deactivate
            </button>
          )}
          {canReactivate(group.status) && (
            <button onClick={() => void runTransition('reactivate')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg">
              <PlayCircleIcon size={16} />
              Reactivate
            </button>
          )}
          {canDecline(group.status) && (
            <button onClick={() => setPendingTransition('decline')} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg">
              <XCircleIcon size={16} />
              Decline
            </button>
          )}
          {canClose(group.status) && (
            <button onClick={() => setPendingTransition('close')} className="flex items-center gap-2 border border-gray-200 text-red-600 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-lg">
              <BanIcon size={16} />
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {(['profile', 'members'] as SectionKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 text-sm font-heading font-medium border-b-2 -mb-px transition-colors capitalize ${
              section === s ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'profile' ? 'Profile' : 'Members'}
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileField label="Mobile" value={group.mobile} />
          <ProfileField label="Phone" value={group.phone} />
          <ProfileField label="Email" value={group.email} />
          <ProfileField label="Joined Date" value={group.joinedDate} />
          <ProfileField label="Address" value={[group.street, group.ward, group.district, group.region].filter(Boolean).join(', ') || null} />
          <ProfileField label="Notes" value={group.notes} />
          {group.status === 'Inactive' && <ProfileField label="Inactive Reason" value={group.inactiveReason} />}
          {group.status === 'Declined' && <ProfileField label="Declined Reason" value={group.declinedReason} />}
          {group.status === 'Closed' && <ProfileField label="Closed Reason" value={group.closedReason} />}
        </div>
      )}

      {section === 'members' && <MembersSection groupId={groupId} />}

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
