import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BanknoteIcon,
  CheckCircle2Icon,
  CrownIcon,
  HourglassIcon,
  PencilIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { clientsApi, GROUP_ROLE_LABELS, type GroupStatus, type GroupSummary } from '../../../api/clientsApi';
import { useAuth } from '../../../context/AuthContext';
import { useRolePath } from '../../../hooks/useRolePath';
import { CLIENT_CREATOR_ROLES, type OfficeRole } from '../../../config/roles';
import { StatusBadge } from '../../../components/StatusBadge';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { formatMoney, formatMoneyCompact } from '../../../utils/money';
import { humanize, initials } from '../../../utils/format';
import { StatCard } from '../../dashboard/DashboardKit';

interface GroupProfile {
  id: number;
  accountNo: string | null;
  name: string | null;
  status: GroupStatus;
  joinedDate: string | null;
  activatedDate: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

type Dialog = 'delete' | 'request-deletion' | null;

const count = new Intl.NumberFormat('en-NG');

/**
 * A group's page: loan totals across its members, member counts, and the roster with the leader,
 * assistant and organizer first. A group is approved once all its members are; one with an approved
 * member can only be deleted through a super-admin-approved request.
 */
export function GroupDetailPage() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const { userType } = useAuth();
  const groupId = Number(useParams<{ id: string }>().id);
  const [group, setGroup] = useState<GroupProfile | null>(null);
  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = async () => {
    try {
      const [profile, figures] = await Promise.all([apiClient.get<GroupProfile>(`/groups/${groupId}`).then((r) => r.data), clientsApi.groupSummary(groupId)]);
      setGroup(profile);
      setSummary(figures);
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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
        <p className="text-gray-500">This group doesn't exist, was deleted, or isn't in your office(s).</p>
        <Link to={rolePath('/groups')} className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to groups
        </Link>
      </div>
    );
  }

  if (!group || !summary) {
    return <p className="py-12 text-center text-sm text-gray-400">Loading…</p>;
  }

  const name = group.name ?? `Group #${group.id}`;
  const canEdit = CLIENT_CREATOR_ROLES.includes(userType as OfficeRole);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UsersRoundIcon size={26} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-bold text-slate-900">{name}</h1>
                <StatusBadge status={group.status} />
                {summary.pendingDeletionRequest && (
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Deletion requested</span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {group.accountNo ? `A/C ${group.accountNo} · ` : ''}
                {summary.officeName ?? 'No office'}
                {summary.createdByName ? ` · onboarded by ${summary.createdByName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Link
                to={rolePath(`/groups/${group.id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <PencilIcon size={16} /> Edit details
              </Link>
            )}
            {summary.canDelete && (
              <button
                onClick={() => setDialog('delete')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2Icon size={16} /> Delete group
              </button>
            )}
            {summary.canRequestDeletion && (
              <button
                onClick={() => setDialog('request-deletion')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2Icon size={16} /> Request deletion
              </button>
            )}
          </div>
        </div>

        {group.status === 'Pending' && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <HourglassIcon size={16} />
            Awaiting approval — the group is approved automatically once all {summary.totalMembers} members are ({summary.approvedMembers} so far).
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          <Brief label="Phone" value={group.mobile ?? group.phone} />
          <Brief label="Email" value={group.email} />
          <Brief label="Meeting address" value={group.address} />
          <Brief label="Approved" value={group.activatedDate ? new Date(group.activatedDate).toLocaleDateString('en-NG') : null} />
        </dl>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={BanknoteIcon}
          tone="violet"
          label="Cumulative loans"
          value={formatMoneyCompact(summary.cumulativeLoanAmount)}
          valueTitle={formatMoney(summary.cumulativeLoanAmount, 0)}
          detail={`${count.format(summary.cumulativeLoanCount)} loan${summary.cumulativeLoanCount === 1 ? '' : 's'} across members`}
        />
        <StatCard
          icon={WalletIcon}
          tone="red"
          label="Pending repayment"
          value={formatMoneyCompact(summary.pendingRepaymentAmount)}
          valueTitle={formatMoney(summary.pendingRepaymentAmount, 0)}
          detail="Still owed on running loans"
        />
        <StatCard icon={UsersIcon} tone="slate" label="Total members" value={count.format(summary.totalMembers)} detail="In the group now" />
        <StatCard icon={CheckCircle2Icon} tone="green" label="Approved" value={count.format(summary.approvedMembers)} detail="Members approved" />
        <StatCard icon={HourglassIcon} tone="amber" label="Pending" value={count.format(summary.pendingMembers)} detail="Awaiting approval" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 font-heading text-sm font-semibold text-slate-800">Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium text-right">Loans</th>
                <th className="px-5 py-3 font-medium text-right">Pending repayment</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.members.map((member) => {
                const memberName = member.displayName || `Client #${member.clientId}`;
                const leadership = member.role && member.role !== 'member';
                return (
                  <tr key={member.clientId} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(rolePath(`/clients/${member.clientId}`))}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(memberName)}
                        </span>
                        <div>
                          <Link to={rolePath(`/clients/${member.clientId}`)} onClick={(e) => e.stopPropagation()} className="font-medium text-primary hover:underline">
                            {memberName}
                          </Link>
                          <span className="block text-xs text-gray-400">{member.accountNo ? `A/C ${member.accountNo}` : '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${leadership ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                        {member.role === 'leader' && <CrownIcon size={12} />}
                        {GROUP_ROLE_LABELS[member.role ?? 'member'] ?? 'Member'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(member.loanAmount, 0)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(member.pendingRepayment, 0)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={member.status} />
                        {member.isHighRisk && (
                          <span title="High risk" className="text-red-600">
                            <ShieldAlertIcon size={16} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-heading text-sm font-semibold text-slate-800">Loan records</h2>
          <span className="text-xs text-slate-400">Every member's loans and loan applications, and the group's own</span>
        </div>
        {summary.loanRecords.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No loans or loan applications for this group's members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Record</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.loanRecords.map((record) => (
                  <tr key={`${record.kind}-${record.id}`} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        to={rolePath(record.kind === 'loan' ? `/loans/${record.id}` : `/loan-applications/${record.id}`)}
                        className="font-medium text-primary hover:underline"
                      >
                        {record.reference}
                      </Link>
                      <span className="block text-xs text-gray-400">{record.kind === 'loan' ? 'Loan' : 'Application'}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {record.clientId ? (
                        <Link to={rolePath(`/clients/${record.clientId}`)} className="hover:text-primary hover:underline">
                          {record.clientName ?? `Client #${record.clientId}`}
                        </Link>
                      ) : (
                        <span>{record.clientName ?? 'Group loan'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{record.loanProductName ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(record.amount, 0)}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700">{humanize(record.status)}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{record.date ? new Date(record.date).toLocaleDateString('en-NG') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmationModal
        isOpen={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => void run(() => clientsApi.removeGroup(group.id), `${name} deleted.`, () => navigate(rolePath('/groups')))}
        title="Delete group"
        description="None of its members has been approved, so the group can be deleted straight away. Its clients stay on the platform as individual clients."
        confirmLabel="Delete group"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={dialog === 'request-deletion'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => clientsApi.requestGroupDeletion(group.id, reason ?? ''), 'Deletion requested — a super admin will review it.')}
        title="Request group deletion"
        description="This group has approved members, so only a super admin can delete it. Say why it should be deleted."
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
      <dd className="mt-0.5 truncate font-medium text-slate-800">{value || '—'}</dd>
    </div>
  );
}
