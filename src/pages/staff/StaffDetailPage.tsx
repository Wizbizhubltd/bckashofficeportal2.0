import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BanIcon, Building2Icon, CheckCircleIcon, KeyRoundIcon, UnlockIcon, UserCogIcon, XCircleIcon } from 'lucide-react';
import { usersApi, staffName, type StaffUser, type UserClass } from '../../api/usersApi';
import { useRolePath } from '../../hooks/useRolePath';
import { useScopedOffices } from '../../hooks/useScopedOffices';
import { ROLE_LABELS } from '../../config/roles';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { StatusBadge } from '../../components/StatusBadge';
import { initials } from '../../utils/format';

function formatDate(value: string | null, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  return withTime ? date.toLocaleString('en-NG') : date.toLocaleDateString('en-NG');
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5 break-words">{value || '—'}</dd>
    </div>
  );
}

type Dialog = 'decline' | 'office' | 'class' | 'reset' | 'block' | null;

/**
 * One staff member in the viewer's office(s). The API only lets the viewer act on staff ranked below
 * them, and approving/declining onboarding also needs the maker-checker rule (an Authorizer of the
 * initiator's role) — its refusals are shown as they come back.
 */
export function StaffDetailPage() {
  const { id } = useParams();
  const staffId = Number(id);
  const rolePath = useRolePath();
  const offices = useScopedOffices();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    setLoading(true);
    usersApi
      .get(staffId)
      .then(setStaff)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [staffId]);

  const run = async (action: () => Promise<StaffUser>, success: string) => {
    setDialog(null);
    try {
      setStaff(await action());
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading…</div>;
  }

  if (notFound || !staff) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">This staff member doesn't exist or isn't in your office(s).</p>
        <Link to={rolePath('/staff')} className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to staff
        </Link>
      </div>
    );
  }

  const name = staffName(staff);
  const actionClass = 'flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-primary/5 text-sm text-gray-700';

  return (
    <div className="max-w-5xl space-y-4">

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-heading font-bold">{initials(name)}</div>
            <div>
              <h1 className="text-xl font-heading font-bold text-gray-900">{name}</h1>
              <p className="text-sm text-gray-500">
                {ROLE_LABELS[staff.userType ?? ''] ?? 'No role'} · {staff.officeName ?? 'Unassigned office'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={staff.onboardingStatus} />
            <StatusBadge status={staff.blocked ? 'Suspended' : 'Active'} />
          </div>
        </div>
        {staff.onboardingStatus === 'Declined' && staff.onboardingDeclinedReason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Declined: {staff.onboardingDeclinedReason}</div>
        )}
      </div>

      {staff.onboardingStatus === 'Pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-amber-800">Awaiting authorization — they can't sign in until an Authorizer with {staff.createdByName ? `${staff.createdByName}'s` : "the initiator's"} role approves.</p>
          <div className="flex gap-2">
            <button
              onClick={() => void run(() => usersApi.approveOnboarding(staffId), 'Onboarding approved.')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-sm font-heading font-bold px-3 py-1.5 rounded-lg"
            >
              <CheckCircleIcon size={14} />
              Approve
            </button>
            <button
              onClick={() => setDialog('decline')}
              className="flex items-center gap-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-heading font-bold px-3 py-1.5 rounded-lg"
            >
              <XCircleIcon size={14} />
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-8">
        <section>
          <h2 className="text-sm font-heading font-bold text-gray-400 uppercase tracking-widest mb-4">Personal details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Detail label="Email" value={staff.email} />
            <Detail label="Phone" value={staff.phone} />
            <Detail label="Gender" value={staff.gender === 'Unspecified' ? null : staff.gender} />
            <Detail label="Date of birth" value={staff.dateOfBirth ? formatDate(staff.dateOfBirth) : null} />
            <Detail label="Address" value={staff.address} />
          </dl>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-400 uppercase tracking-widest mb-4">Employment</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Detail label="Office" value={staff.officeName} />
            <Detail label="Role" value={ROLE_LABELS[staff.userType ?? '']} />
            <Detail label="Maker-checker class" value={staff.userClass} />
            <Detail label="Onboarded by" value={staff.createdByName} />
            <Detail label="Onboarded on" value={formatDate(staff.createdAt)} />
            <Detail label="Approved by" value={staff.onboardingApprovedByName} />
            <Detail label="Last sign-in" value={formatDate(staff.lastLogin, true)} />
          </dl>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-heading font-bold text-gray-400 uppercase tracking-widest">Onboarding details</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${staff.profileComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {staff.profileComplete ? 'Complete' : `${staff.missingProfileFields.length} missing`}
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <Detail label="Next of kin" value={staff.nextOfKinName} />
            <Detail label="Next of kin phone" value={staff.nextOfKinPhone} />
            <Detail label="Relationship" value={staff.nextOfKinRelationship} />
            <Detail label="Bank" value={staff.bankName} />
            <Detail label="Account number" value={staff.bankAccountNumber} />
            <Detail label="Account name" value={staff.bankAccountName} />
          </dl>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-heading font-bold text-gray-400 uppercase tracking-widest mb-4">Manage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {offices.length > 1 && (
            <button onClick={() => setDialog('office')} className={actionClass}>
              <Building2Icon size={16} className="text-primary" />
              Move to another office
            </button>
          )}
          <button onClick={() => setDialog('class')} className={actionClass}>
            <UserCogIcon size={16} className="text-primary" />
            Change maker-checker class
          </button>
          <button onClick={() => setDialog('reset')} className={actionClass}>
            <KeyRoundIcon size={16} className="text-primary" />
            Reset password
          </button>
          <button
            onClick={() => setDialog('block')}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${staff.blocked ? 'border-green-200 hover:bg-green-50 text-green-700' : 'border-red-200 hover:bg-red-50 text-red-600'}`}
          >
            {staff.blocked ? <UnlockIcon size={16} /> : <BanIcon size={16} />}
            {staff.blocked ? 'Unblock account' : 'Block account'}
          </button>
        </div>
      </section>

      <ConfirmationModal
        isOpen={dialog === 'decline'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => usersApi.declineOnboarding(staffId, reason ?? ''), 'Onboarding declined.')}
        title="Decline onboarding"
        description="The record stays blocked from signing in. Give a reason for the record."
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Decline"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'office'}
        onClose={() => setDialog(null)}
        onConfirm={(officeId) => officeId && void run(() => usersApi.assignOffice(staffId, Number(officeId)), 'Office changed.')}
        title="Move to another office"
        description={`Move ${name} to another of your offices.`}
        inputType="select"
        inputLabel="Office"
        selectOptions={offices.filter((o) => o.id !== staff.officeId).map((o) => ({ label: o.name ?? `Office #${o.id}`, value: String(o.id) }))}
        requireInput
        confirmLabel="Move"
      />
      <ConfirmationModal
        isOpen={dialog === 'class'}
        onClose={() => setDialog(null)}
        onConfirm={(userClass) => userClass && void run(() => usersApi.changeUserClass(staffId, userClass as UserClass), 'Maker-checker class changed.')}
        title="Change maker-checker class"
        description="Initiators create records; Authorizers approve or decline what an Initiator of the same role created; Reviewers only view."
        inputType="select"
        inputLabel="New class"
        selectOptions={['Initiator', 'Authorizer', 'Reviewer'].map((c) => ({ label: c, value: c }))}
        requireInput
        confirmLabel="Change class"
      />
      <ConfirmationModal
        isOpen={dialog === 'reset'}
        onClose={() => setDialog(null)}
        onConfirm={() => void run(() => usersApi.resetPassword(staffId), 'A new temporary password has been emailed to them.')}
        title="Reset password"
        description={`Email ${name} a new temporary password. They'll have to change it when they next sign in.`}
        confirmLabel="Reset password"
        confirmVariant="blue"
      />
      <ConfirmationModal
        isOpen={dialog === 'block'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          void run(() => (staff.blocked ? usersApi.unblock(staffId) : usersApi.block(staffId)), staff.blocked ? 'Account unblocked.' : 'Account blocked.')
        }
        title={staff.blocked ? 'Unblock account' : 'Block account'}
        description={staff.blocked ? `${name} will be able to sign in again.` : `${name} will be stopped from signing in straight away.`}
        confirmLabel={staff.blocked ? 'Unblock' : 'Block'}
        confirmVariant={staff.blocked ? 'primary' : 'danger'}
      />
    </div>
  );
}
