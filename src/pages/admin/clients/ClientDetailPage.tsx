import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BadgeCheckIcon,
  BanIcon,
  ScanFaceIcon,
  PiggyBankIcon,
  CheckCircleIcon,
  FileTextIcon,
  HandCoinsIcon,
  LockIcon,
  UnlockIcon,
  HistoryIcon,
  LandmarkIcon,
  PauseCircleIcon,
  PencilIcon,
  PlayCircleIcon,
  PrinterIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserIcon,
  UsersRoundIcon,
  XCircleIcon,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { clientsApi, editRequestsApi, GROUP_ROLE_LABELS, type ClientAuditEntry, type ClientDetail, type ClientGroupMembership, type ClientLoan } from '../../../api/clientsApi';
import { useAuth } from '../../../context/AuthContext';
import { useMe } from '../../../context/MeContext';
import { useRolePath } from '../../../hooks/useRolePath';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { PassportPhoto } from '../../../components/PassportPhoto';
import { SimpleCrudScreen } from '../SimpleCrudScreen';
import { DocumentsSection } from './sections/DocumentsSection';
import { BiometricsSection } from './sections/BiometricsSection';
import { ContactsSection } from './sections/ContactsSection';
import { SavingsSection } from './sections/SavingsSection';
import { useClientSavings } from '../../../hooks/useClientSavings';
import { formatMoney } from '../../../utils/money';

const TABS = [
  { key: 'overview', label: 'Overview', icon: UserIcon },
  { key: 'groups', label: 'Group Details', icon: UsersRoundIcon },
  { key: 'loans', label: 'Loan Record', icon: LandmarkIcon },
  { key: 'savings', label: 'Savings', icon: PiggyBankIcon },
  { key: 'audit', label: 'Audit trail', icon: HistoryIcon },
] as const;
type TabKey = (typeof TABS)[number]['key'];

type Dialog = 'decline' | 'delete' | 'request-deletion' | 'deactivate' | 'close' | 'request-edit' | 'grant-edit' | 'refuse-edit' | null;

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  return withTime
    ? date.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function clientName(client: Pick<ClientDetail, 'displayName' | 'firstName' | 'middleName' | 'lastName'>): string {
  return client.displayName || [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ') || 'Unnamed client';
}

/**
 * A client's page: who they are (photo, key details, statuses) with the actions the viewer's role
 * allows, then tabs for their overview and documentation, groups, loans and audit trail.
 */
export function ClientDetailPage() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const { userType } = useAuth();
  const { hasModule } = useMe();
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'overview';

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [savingsVersion, setSavingsVersion] = useState(0);
  const savings = useClientSavings(clientId, savingsVersion);

  const load = async () => {
    try {
      setClient(await clientsApi.get(clientId));
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setDialog(null);
    try {
      await action();
      toast.success(success);
      if (after) after();
      else await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  if (notFound) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">This client doesn't exist, was deleted, or isn't in your office(s).</p>
        <Link to={rolePath('/clients')} className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  if (!client) {
    return <p className="py-12 text-center text-sm text-gray-400">Loading…</p>;
  }

  const name = clientName(client);
  const actions = client.actions;
  const isController = userType === 'controller';
  const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  // A loan needs an approved client with their face captured and no loan already open (the server enforces the same).
  const loanBlocker =
    client.loanBlocker ??
    (client.status !== 'Active' ? 'Only an approved client can apply for a loan.' : client.activeLoan ? `This client already has an active loan. ${client.activeLoan}` : null);

  return (
    <div className="space-y-6">
      {/* Top section: brief details, statuses and actions */}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="relative self-start">
            <PassportPhoto clientId={client.id} name={name} hasPhoto={client.hasPhoto} version={photoVersion} />
            {actions?.canEditDetails && !client.hasPhoto && (
              <button
                type="button"
                onClick={() => setSearchParams({ doc: 'biometrics' }, { replace: true })}
                className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow hover:bg-primary/90"
                title="Capture the client's face — it becomes their profile picture"
                aria-label="Capture the client's face"
              >
                <ScanFaceIcon size={16} />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-slate-900">{name}</h1>
              <StatusBadge status={client.status} />
              {client.isHighRisk && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <ShieldAlertIcon size={12} /> High risk
                </span>
              )}
              {client.bvnVerifiedAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <BadgeCheckIcon size={12} /> BVN verified
                </span>
              )}
              {client.pendingDeletionRequest && (
                <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Deletion requested</span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              A/C {client.accountNo ?? '—'} · {client.officeName ?? 'No office'}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Brief label="Phone" value={client.mobile ?? client.phone} />
              <Brief label="Email" value={client.email} />
              <Brief label="BVN" value={client.bvn ? `•••••••${client.bvn.slice(-4)}` : null} />
              <Brief label="Joined" value={formatDate(client.joinedDate)} />
              <Brief label="Active loan" value={client.activeLoan ?? 'None'} />
              <Brief label="Savings" value={savings ? formatMoney(savings.balance) : null} />
              <Brief label="Onboarded by" value={client.createdByName} />
              <Brief label="Approved" value={client.activatedDate ? `${formatDate(client.activatedDate)}${client.activatedByName ? ` · ${client.activatedByName}` : ''}` : null} />
            </dl>
          </div>
        </div>

        {client.isHighRisk && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <ShieldAlertIcon size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-heading font-bold">Flagged high risk</p>
              <p className="mt-0.5">
                Onboarded with details that differ from their BVN record. Reason given: “{client.highRiskReason ?? '—'}”. They can't be approved until a super admin marks them
                safe.
              </p>
            </div>
          </div>
        )}

        {client.currentEditRequest?.status === 'pending' && (
          <div className="mt-5 flex flex-wrap items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <LockIcon size={18} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold">Edit privilege requested</p>
              <p className="mt-0.5">
                {client.currentEditRequest.requestedByName ?? 'Staff'} asked on {formatDate(client.currentEditRequest.createdAt)}: “{client.currentEditRequest.reason}”.
                {actions?.canReviewEditRequests ? '' : ' Waiting for a controller.'}
              </p>
            </div>
            {actions?.canReviewEditRequests && (
              <div className="flex gap-2">
                <button onClick={() => setDialog('refuse-edit')} className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100">
                  Refuse
                </button>
                <button onClick={() => setDialog('grant-edit')} className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800">
                  Grant
                </button>
              </div>
            )}
          </div>
        )}

        {actions?.editPrivilegeOpen && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <UnlockIcon size={18} className="mt-0.5 flex-shrink-0" />
            <p>
              <span className="font-heading font-bold">Edit privilege granted.</span>{' '}
              {client.status === 'Pending'
                ? 'The profile was edited, so the client is pending approval again. Editing stays open until a controller approves them.'
                : 'Saving any change sends the client back to pending approval until a controller approves them again.'}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          {actions?.canEditDetails && (
            <Link to={rolePath(`/clients/${client.id}/edit`)} className={`${buttonClass} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              <PencilIcon size={16} /> Edit details
            </Link>
          )}
          {isController && client.status === 'Pending' && !client.isHighRisk && (client.approvalBlockers?.length ?? 0) > 0 && (
            <span className="inline-flex items-center rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              To approve, the client needs {client.approvalBlockers!.join(' and ')}.
            </span>
          )}
          {hasModule('loans') && client.status === 'Active' && !client.biometricEnrolledAt && client.loanBlocker && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No loan can be raised until the client's face is captured.
              {actions?.canEditDetails && (
                <button type="button" onClick={() => setSearchParams({ doc: 'biometrics' }, { replace: true })} className="font-medium underline">
                  Capture face
                </button>
              )}
            </span>
          )}
          {actions?.canApprove && (
            <button onClick={() => void run(() => clientsApi.approve(client.id), `${name} approved.`)} className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}>
              <CheckCircleIcon size={16} /> Approve
            </button>
          )}
          {actions?.canDecline && (
            <button onClick={() => setDialog('decline')} className={`${buttonClass} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              <XCircleIcon size={16} /> Decline
            </button>
          )}
          {isController && client.status === 'Active' && (
            <button onClick={() => setDialog('deactivate')} className={`${buttonClass} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              <PauseCircleIcon size={16} /> Deactivate
            </button>
          )}
          {isController && client.status === 'Inactive' && (
            <button
              onClick={() => void run(() => apiClient.post(`/clients/${client.id}/reactivate`), `${name} reactivated.`)}
              className={`${buttonClass} border border-gray-200 text-gray-700 hover:bg-gray-50`}
            >
              <PlayCircleIcon size={16} /> Reactivate
            </button>
          )}
          {isController && (client.status === 'Active' || client.status === 'Inactive') && (
            <button onClick={() => setDialog('close')} className={`${buttonClass} border border-gray-200 text-red-600 hover:bg-red-50`}>
              <BanIcon size={16} /> Close
            </button>
          )}
          {hasModule('loans') && (
            !loanBlocker ? (
              <Link
                to={rolePath(`/loan-applications/new?clientId=${client.id}${client.officeId ? `&officeId=${client.officeId}` : ''}`)}
                className={`${buttonClass} bg-primary text-white hover:bg-primary/90`}
              >
                <HandCoinsIcon size={16} /> Raise loan
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={loanBlocker}
                className={`${buttonClass} cursor-not-allowed bg-primary text-white opacity-50`}
              >
                <HandCoinsIcon size={16} /> Raise loan
              </button>
            )
          )}
          {actions?.canDelete && (
            <button onClick={() => setDialog('delete')} className={`${buttonClass} border border-red-200 text-red-600 hover:bg-red-50`}>
              <Trash2Icon size={16} /> Delete
            </button>
          )}
          {actions?.canRequestEdit && (
            <button onClick={() => setDialog('request-edit')} className={`${buttonClass} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
              <LockIcon size={16} /> Request edit privilege
            </button>
          )}
          {actions?.canRequestDeletion && (
            <button onClick={() => setDialog('request-deletion')} className={`${buttonClass} border border-red-200 text-red-600 hover:bg-red-50`}>
              <Trash2Icon size={16} /> Request deletion
            </button>
          )}
          <a
            href={rolePath(`/clients/${client.id}/print`)}
            target="_blank"
            rel="noreferrer"
            className={`${buttonClass} ml-auto border border-gray-200 text-gray-700 hover:bg-gray-50`}
          >
            <PrinterIcon size={16} /> Print data page
          </a>
        </div>
      </section>

      {/* Second section: tabs */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div role="tablist" className="flex overflow-x-auto border-b border-slate-100 px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setSearchParams(t.key === 'overview' ? {} : { tab: t.key }, { replace: true })}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors ${
                tab === t.key ? 'border-accent font-heading font-bold text-primary' : 'border-transparent text-gray-500 hover:text-primary'
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'overview' && (
            <OverviewTab
              client={client}
              onEnrolled={() => {
                setPhotoVersion((v) => v + 1);
                void load();
              }}
            />
          )}
          {tab === 'groups' && <GroupsTab clientId={client.id} />}
          {tab === 'loans' && <LoansTab clientId={client.id} />}
          {tab === 'savings' && <SavingsSection clientId={client.id} onChange={() => setSavingsVersion((v) => v + 1)} />}
          {tab === 'audit' && <AuditTab clientId={client.id} />}
        </div>
      </section>

      <ConfirmationModal
        isOpen={dialog === 'decline'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => clientsApi.decline(client.id, reason ?? ''), `${name} declined.`)}
        title="Decline client"
        description="The client moves to Declined. Give the reason for the record."
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Decline"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'deactivate' || dialog === 'close'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) =>
          void run(() => apiClient.post(`/clients/${client.id}/${dialog}`, { reason }), dialog === 'close' ? `${name} closed.` : `${name} deactivated.`)
        }
        title={dialog === 'close' ? 'Close client' : 'Deactivate client'}
        description={dialog === 'close' ? 'Closing is final.' : 'The client moves to Inactive until reactivated.'}
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel={dialog === 'close' ? 'Close' : 'Deactivate'}
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => void run(() => clientsApi.remove(client.id), `${name} deleted.`, () => navigate(rolePath('/clients')))}
        title="Delete client"
        description={`${name} has never been approved, so they can be deleted straight away. They'll be removed from any groups.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'request-edit'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => editRequestsApi.request(client.id, reason ?? ''), 'Edit privilege requested — a controller will review it.')}
        title="Request edit privilege"
        description={`${name} has been approved, so their profile is locked. Say what needs changing and why. The client stays active until a controller grants it; once you save an edit, they go back to pending approval.`}
        inputType="textarea"
        inputLabel="Reason for the edit"
        requireInput
        confirmLabel="Send request"
      />
      <ConfirmationModal
        isOpen={dialog === 'grant-edit'}
        onClose={() => setDialog(null)}
        onConfirm={(note) =>
          client.currentEditRequest && void run(() => editRequestsApi.approve(client.currentEditRequest!.id, note?.trim() || null), 'Edit privilege granted.')
        }
        title="Grant edit privilege"
        description={`${client.currentEditRequest?.requestedByName ?? 'The requester'} will be able to edit ${name}'s profile. The first saved edit sends the client back to pending, for you to approve again.`}
        inputType="textarea"
        inputLabel="Note (optional)"
        confirmLabel="Grant"
      />
      <ConfirmationModal
        isOpen={dialog === 'refuse-edit'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => client.currentEditRequest && void run(() => editRequestsApi.reject(client.currentEditRequest!.id, note ?? ''), 'Edit request refused.')}
        title="Refuse edit request"
        description="The profile stays locked. Tell the requester why."
        inputType="textarea"
        inputLabel="Why is it refused?"
        requireInput
        confirmLabel="Refuse"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'request-deletion'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => clientsApi.requestDeletion(client.id, reason ?? ''), 'Deletion requested — a super admin will review it.')}
        title="Request deletion"
        description={`${name} has been approved, so only a super admin can delete them. Say why they should be deleted.`}
        inputType="textarea"
        inputLabel="Reason"
        requireInput
        confirmLabel="Send request"
        confirmVariant="danger"
      />
    </div>
  );
}

function Brief({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-slate-800" title={value ?? undefined}>
        {value || '—'}
      </dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-800">{value || '—'}</dd>
    </div>
  );
}

const DOC_SECTIONS = [
  { key: 'biometrics', label: 'Biometrics' },
  { key: 'documents', label: 'Documents' },
  { key: 'guarantors', label: 'Guarantors' },
  { key: 'references', label: 'References' },
  { key: 'next-of-kin', label: 'Next of kin' },
  { key: 'notes', label: 'Notes' },
] as const;
type DocSection = (typeof DOC_SECTIONS)[number]['key'];

function OverviewTab({ client, onEnrolled }: { client: ClientDetail; onEnrolled: () => void }) {
  // In the URL (?doc=…) so the photo's capture button can open Biometrics directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const docParam = searchParams.get('doc');
  const section: DocSection = DOC_SECTIONS.some((s) => s.key === docParam) ? (docParam as DocSection) : 'biometrics';
  const setSection = (key: DocSection) => setSearchParams(key === 'biometrics' ? {} : { doc: key }, { replace: true });
  const readOnly = !client.actions?.canEditDetails;
  const address = [client.address, client.street, client.city, client.state, client.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xs font-heading font-bold uppercase tracking-widest text-gray-400">Personal details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="First name" value={client.firstName} />
          <Detail label="Middle name" value={client.middleName} />
          <Detail label="Last name" value={client.lastName} />
          <Detail label="Gender" value={client.gender} />
          <Detail label="Date of birth" value={client.dob ? formatDate(client.dob) : null} />
          <Detail label="Marital status" value={client.maritalStatus} />
          <Detail label="Occupation / business" value={client.occupation} />
          <Detail label="Nationality" value={client.nationality} />
          <Detail label="Client type" value={client.clientType} />
          <Detail label="External ID" value={client.externalId} />
          <Detail label="Account officer" value={client.staffName ?? client.createdByName} />
          <Detail label="Mobile" value={client.mobile} />
          <Detail label="Email" value={client.email} />
          <div className="sm:col-span-2">
            <Detail label="Residential address" value={address} />
          </div>
          <div className="sm:col-span-2">
            <Detail label="Business address" value={client.businessAddress} />
          </div>
          {client.status === 'Declined' && <Detail label="Declined reason" value={client.declinedReason} />}
          {client.status === 'Inactive' && <Detail label="Inactive reason" value={client.inactiveReason} />}
          {client.status === 'Closed' && <Detail label="Closed reason" value={client.closedReason} />}
        </dl>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-heading font-bold uppercase tracking-widest text-gray-400">BVN verification & risk</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="BVN" value={client.bvn} />
          <Detail label="Verified" value={client.bvnVerifiedAt ? formatDate(client.bvnVerifiedAt, true) : 'Not verified (onboarded before BVN checks)'} />
          <Detail
            label="Details on file"
            value={client.bvnDetailsSource === 'client' ? "Client's own (differ from BVN)" : client.bvnDetailsSource === 'bvn' ? 'From the BVN record' : null}
          />
          <Detail label="Risk" value={client.isHighRisk ? 'High risk' : client.highRiskClearedAt ? `Marked safe ${formatDate(client.highRiskClearedAt)}` : 'Normal'} />
          {client.highRiskReason && <Detail label="Reason for keeping client's details" value={client.highRiskReason} />}
          {client.highRiskClearedNote && <Detail label="Super admin's note" value={client.highRiskClearedNote} />}
        </dl>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-heading font-bold uppercase tracking-widest text-gray-400">Documentation</h2>
          {readOnly && (
            <p className="inline-flex items-center gap-1 text-xs text-gray-400">
              {client.activatedDate && !client.actions?.editPrivilegeOpen ? (
                <>
                  <LockIcon size={12} /> Locked since the client was approved — request edit privilege to change it.
                </>
              ) : (
                `Only ${client.createdByName ?? 'the staff member who onboarded this client'} can change their documentation.`
              )}
            </p>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
          {DOC_SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${section === s.key ? 'bg-white font-medium text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === 'documents' && <DocumentsSection clientId={client.id} readOnly={readOnly} />}
        {section === 'biometrics' && <BiometricsSection clientId={client.id} clientName={clientName(client)} onEnrolled={onEnrolled} />}
        {(section === 'guarantors' || section === 'references') && (
          <ContactsSection key={section} clientId={client.id} kind={section} readOnly={readOnly} onChange={onEnrolled} />
        )}
        {section === 'next-of-kin' && (
          <SimpleCrudScreen<{ id: number; clientRelationshipId: number | null; firstName: string | null; lastName: string | null; mobile: string | null; email: string | null; notes: string | null }>
            key={section}
            title="Next of kin"
            endpoint={`/clients/${client.id}/next-of-kin`}
            readOnly={readOnly}
            columns={[
              { key: 'firstName', label: 'First Name' },
              { key: 'lastName', label: 'Last Name' },
              { key: 'mobile', label: 'Mobile' },
            ]}
            fields={[
              { key: 'clientRelationshipId', label: 'Relationship Type ID', type: 'number' },
              { key: 'firstName', label: 'First Name', type: 'text' },
              { key: 'lastName', label: 'Last Name', type: 'text' },
              { key: 'mobile', label: 'Mobile', type: 'tel' },
              { key: 'email', label: 'Email', type: 'text' },
              { key: 'notes', label: 'Notes', type: 'textarea' },
            ]}
            emptyItem={{ clientRelationshipId: null, firstName: '', lastName: '', mobile: '', email: '', notes: '' }}
          />
        )}
        {section === 'notes' && (
          <SimpleCrudScreen<{ id: number; notes: string | null }>
            title="Notes"
            endpoint={`/clients/${client.id}/notes`}
            columns={[{ key: 'notes', label: 'Note' }]}
            fields={[{ key: 'notes', label: 'Note', type: 'textarea' }]}
            emptyItem={{ notes: '' }}
          />
        )}
      </section>
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, failed };
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-gray-400">{children}</p>;
}

function GroupsTab({ clientId }: { clientId: number }) {
  const rolePath = useRolePath();
  const { data, failed } = useLoad<ClientGroupMembership[]>(() => clientsApi.groups(clientId), [clientId]);
  if (failed) return <Empty>Couldn't load the client's groups.</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  if (data.length === 0) return <Empty>This client isn't in any group.</Empty>;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {data.map((membership) => (
        <Link
          key={membership.groupId}
          to={rolePath(`/groups/${membership.groupId}`)}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition-all hover:border-primary/30 hover:shadow-md"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UsersRoundIcon size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-heading font-semibold text-gray-800 group-hover:text-primary">{membership.groupName ?? `Group #${membership.groupId}`}</span>
            <span className="block text-xs text-gray-500">
              {GROUP_ROLE_LABELS[membership.role ?? 'member'] ?? 'Member'} · joined {formatDate(membership.joinedAt)}
            </span>
          </span>
          <StatusBadge status={membership.status} />
        </Link>
      ))}
    </div>
  );
}

function LoansTab({ clientId }: { clientId: number }) {
  const rolePath = useRolePath();
  const { data, failed } = useLoad(() => clientsApi.loans(clientId), [clientId]);
  if (failed) return <Empty>Couldn't load the client's loans.</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  if (data.items.length === 0) return <Empty>No loans on record for this client.</Empty>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Loan</th>
            <th className="px-4 py-3 font-medium text-right">Requested</th>
            <th className="px-4 py-3 font-medium text-right">Approved</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.items.map((loan: ClientLoan) => (
            <tr key={loan.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link to={rolePath(`/loans/${loan.id}`)} className="font-medium text-primary hover:underline">
                  {loan.accountNumber ?? `Loan #${loan.id}`}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(loan.appliedAmount)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{loan.approvedAmount === null ? '—' : formatMoney(loan.approvedAmount)}</td>
              <td className="px-4 py-3 text-gray-700">{loan.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Turns an audit entry's JSON notes into a short readable line. */
function describeNotes(notes: string | null): string | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return Object.entries(parsed)
      .filter(([key]) => !['UpdatedAt', 'CreatedAt'].includes(key))
      .map(([key, value]) => {
        if (value && typeof value === 'object' && 'after' in (value as object)) {
          const change = value as { before: unknown; after: unknown };
          return `${key}: ${change.before ?? '—'} → ${change.after ?? '—'}`;
        }
        return `${key}: ${Array.isArray(value) ? value.map((v) => JSON.stringify(v)).join(', ') || '—' : String(value ?? '—')}`;
      })
      .join(' · ');
  } catch {
    return notes;
  }
}

function AuditTab({ clientId }: { clientId: number }) {
  const { data, failed } = useLoad<ClientAuditEntry[]>(() => clientsApi.audit(clientId), [clientId]);
  if (failed) return <Empty>Couldn't load the audit trail.</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  if (data.length === 0) return <Empty>Nothing recorded yet.</Empty>;

  return (
    <ol className="relative space-y-5 border-l border-gray-200 pl-6">
      {data.map((entry, index) => (
        <li key={entry.id ?? `created-${index}`} className="relative">
          <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-primary/70" />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-gray-800">
              <FileTextIcon size={13} className="mr-1 inline text-gray-400" />
              {entry.module === 'DeletionRequest' ? `Deletion request — ${entry.action?.toLowerCase()}` : entry.action}
            </p>
            <p className="text-xs text-gray-400">{formatDate(entry.at, true)}</p>
          </div>
          <p className="text-xs text-gray-500">{entry.userName ?? 'System'}</p>
          {describeNotes(entry.notes) && <p className="mt-1 break-words text-xs text-gray-500">{describeNotes(entry.notes)}</p>}
        </li>
      ))}
    </ol>
  );
}
