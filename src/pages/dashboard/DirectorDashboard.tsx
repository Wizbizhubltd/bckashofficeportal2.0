import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2Icon, MapIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import type { StaffUser } from '../../api/usersApi';
import {
  ArrearsStat,
  ClientsStat,
  DashboardHero,
  DisbursedStat,
  OfficesStat,
  OnboardingPrompt,
  OutstandingLoansStat,
  PendingApplicationsBrief,
  PendingStaffBrief,
  RepaidStat,
  SectionError,
  StaffStat,
  count,
  usePage,
  useSection,
  useSummary,
  type LoanApplicationItem,
} from './DashboardKit';

export interface OfficeSummary {
  id: number;
  name: string | null;
  officeCode: string | null;
  zoneId: number | null;
  zoneName: string | null;
  cityName: string | null;
  stateName: string | null;
  active: boolean;
  staffCount: number;
}

/** A director oversees every office in the zones a super admin assigned them — the figures roll up across all of them. */
export function DirectorDashboard() {
  const { me, hasModule } = useMe();
  const rolePath = useRolePath();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);
  const offices = hasModule('offices');
  const staff = hasModule('staff');
  const clients = hasModule('clients');
  const loans = hasModule('loans');

  const summary = useSummary(reloadKey);
  const officeList = useSection(() => apiClient.get<OfficeSummary[]>('/offices').then((r) => r.data), reloadKey, offices);
  const pendingStaff = usePage<StaffUser>('/users', { onboardingStatus: 'Pending' }, reloadKey, staff);
  const applications = usePage<LoanApplicationItem>('/loan-applications', { status: 'Pending' }, reloadKey, loans);
  const zoneCount = me?.zones.length ?? 0;

  return (
    <div className="space-y-6">
      <DashboardHero tagline={`Overseeing ${zoneCount} zone${zoneCount === 1 ? '' : 's'} and every office in them.`} onRefresh={reload} />
      <OnboardingPrompt />

      {me && zoneCount === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          <MapIcon size={18} className="mt-0.5 flex-shrink-0 text-primary" />
          No zones have been assigned to you yet. A super admin assigns directors their zones from the Control Portal; until then there are no offices to show.
        </div>
      )}

      {summary.status === 'error' ? (
        <SectionError message="Couldn't load the dashboard figures." onRetry={reload} />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {offices && <OfficesStat summary={summary} />}
          {staff && <StaffStat summary={summary} />}
          {clients && <ClientsStat summary={summary} />}
          {loans && <OutstandingLoansStat summary={summary} />}
          {loans && <ArrearsStat summary={summary} />}
          {loans && <DisbursedStat summary={summary} />}
          {loans && <RepaidStat summary={summary} />}
        </section>
      )}

      {offices && (
        <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2Icon size={16} />
              </span>
              <h3 className="font-heading text-sm font-semibold text-slate-800">Offices in your zones</h3>
            </div>
            <Link to={rolePath('/offices')} className="text-xs font-medium text-primary hover:text-accent">
              View all
            </Link>
          </div>
          {officeList.status === 'loading' ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : officeList.status === 'error' ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Couldn't load your offices.</p>
          ) : officeList.data.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">There are no offices in your zones yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Office</th>
                    <th className="px-5 py-3 font-medium">Zone</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium text-right">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officeList.data.slice(0, 8).map((office) => (
                    <tr key={office.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link to={rolePath(`/offices/${office.id}`)} className="font-medium text-primary hover:underline">
                          {office.name ?? `Office #${office.id}`}
                        </Link>
                        {!office.active && <span className="ml-2 text-xs text-slate-400">Inactive</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{office.zoneName ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{[office.cityName, office.stateName].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{count.format(office.staffCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {staff && <PendingStaffBrief section={pendingStaff} />}
        {loans && <PendingApplicationsBrief section={applications} />}
      </section>
    </div>
  );
}
