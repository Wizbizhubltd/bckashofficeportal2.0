import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2Icon, FileClockIcon, UserCheckIcon, UsersIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { usersApi, staffName, type PagedResult, type StaffUser } from '../../api/usersApi';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import { ROLE_LABELS } from '../../config/roles';
import { StatusBadge } from '../../components/StatusBadge';
import { StatCard, count } from '../dashboard/DashboardKit';

interface OfficeDetail {
  id: number;
  name: string | null;
  officeCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  zoneName: string | null;
  cityName: string | null;
  lgaName: string | null;
  stateName: string | null;
  openingDate: string | null;
  active: boolean;
  staffCount: number;
}

/** One office in a director's zones: its details, its headline numbers and its staff. */
export function OfficeOverviewPage() {
  const { id } = useParams();
  const officeId = Number(id);
  const rolePath = useRolePath();
  const { hasModule } = useMe();
  const [office, setOffice] = useState<OfficeDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [clientsTotal, setClientsTotal] = useState<number | null>(null);
  const [pendingApplications, setPendingApplications] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<OfficeDetail>(`/offices/${officeId}`)
      .then((response) => setOffice(response.data))
      .catch(() => setNotFound(true));
    usersApi
      .list({ officeId, pageSize: 100 })
      .then((result) => setStaff(result.items))
      .catch(() => setStaff([]));
    apiClient
      .get<PagedResult<unknown>>('/clients', { params: { officeId, page: 1, pageSize: 1 } })
      .then((r) => setClientsTotal(r.data.totalCount))
      .catch(() => setClientsTotal(0));
    apiClient
      .get<PagedResult<unknown>>('/loan-applications', { params: { officeId, status: 'Pending', page: 1, pageSize: 1 } })
      .then((r) => setPendingApplications(r.data.totalCount))
      .catch(() => setPendingApplications(0));
  }, [officeId]);

  if (notFound) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">This office doesn't exist or isn't in your zones.</p>
        <Link to={rolePath('/offices')} className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to my offices
        </Link>
      </div>
    );
  }

  if (!office) {
    return <div className="text-center text-gray-400 py-12">Loading…</div>;
  }

  return (
    <div className="space-y-6">

      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2Icon size={22} />
            </span>
            <div>
              <h1 className="font-heading text-xl font-bold text-slate-900">{office.name ?? `Office #${office.id}`}</h1>
              <p className="text-sm text-slate-500">
                {office.officeCode ?? '—'} · {office.zoneName ?? 'No zone'}
              </p>
            </div>
          </div>
          <StatusBadge status={office.active ? 'Active' : 'Inactive'} />
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Item label="Location" value={[office.cityName, office.lgaName, office.stateName].filter(Boolean).join(', ')} />
          <Item label="Address" value={office.address} />
          <Item label="Phone" value={office.phone} />
          <Item label="Opened" value={office.openingDate ? new Date(office.openingDate).toLocaleDateString('en-NG') : null} />
        </dl>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={UserCheckIcon} tone="slate" label="Staff" value={count.format(office.staffCount)} detail="Assigned to this office" />
        <StatCard
          icon={UsersIcon}
          tone="green"
          label="Clients"
          value={clientsTotal === null ? null : count.format(clientsTotal)}
          detail="Registered here"
          to={hasModule('clients') ? rolePath('/clients') : undefined}
        />
        <StatCard
          icon={FileClockIcon}
          tone="amber"
          label="Pending applications"
          value={pendingApplications === null ? null : count.format(pendingApplications)}
          detail="Awaiting a decision"
          to={hasModule('loans') ? rolePath('/loan-applications') : undefined}
        />
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-4 font-heading text-sm font-semibold text-slate-800">Staff</h2>
        {staff === null ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No staff in this office.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    {hasModule('staff') ? (
                      <Link to={rolePath(`/staff/${member.id}`)} className="font-medium text-primary hover:underline">
                        {staffName(member)}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-800">{staffName(member)}</span>
                    )}
                    <span className="block text-xs text-slate-400">{member.email}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ROLE_LABELS[member.userType ?? ''] ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={member.onboardingStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value || '—'}</dd>
    </div>
  );
}
