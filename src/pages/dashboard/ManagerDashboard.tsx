import { useState } from 'react';
import { useMe } from '../../context/MeContext';
import type { StaffUser } from '../../api/usersApi';
import type { ClientListItem } from '../admin/clients/ClientsListPage';
import {
  ArrearsStat,
  ClientsStat,
  DashboardHero,
  DisbursedStat,
  OnboardingPrompt,
  OutstandingLoansStat,
  PendingApplicationsBrief,
  PendingApplicationsStat,
  PendingClientsBrief,
  PendingStaffBrief,
  RepaidStat,
  SectionError,
  StaffStat,
  usePage,
  useSummary,
  type LoanApplicationItem,
} from './DashboardKit';

/** A manager runs one office: its marketers, its clients and its loan book. */
export function ManagerDashboard() {
  const { me, hasModule } = useMe();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);
  const staff = hasModule('staff');
  const clients = hasModule('clients');
  const loans = hasModule('loans');

  const summary = useSummary(reloadKey);
  const pendingStaff = usePage<StaffUser>('/users', { onboardingStatus: 'Pending' }, reloadKey, staff);
  const applications = usePage<LoanApplicationItem>('/loan-applications', { status: 'Pending' }, reloadKey, loans);
  const pendingClients = usePage<ClientListItem>('/clients', { status: 'Pending' }, reloadKey, clients);

  return (
    <div className="space-y-6">
      <DashboardHero tagline={`Running ${me?.officeName ?? 'your office'} — your team, clients and loan book.`} onRefresh={reload} />
      <OnboardingPrompt />

      {summary.status === 'error' ? (
        <SectionError message="Couldn't load the dashboard figures." onRetry={reload} />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {staff && <StaffStat summary={summary} />}
          {clients && <ClientsStat summary={summary} />}
          {loans && <PendingApplicationsStat summary={summary} />}
          {loans && <OutstandingLoansStat summary={summary} />}
          {loans && <ArrearsStat summary={summary} />}
          {loans && <DisbursedStat summary={summary} />}
          {loans && <RepaidStat summary={summary} />}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {staff && <PendingStaffBrief section={pendingStaff} />}
        {loans && <PendingApplicationsBrief section={applications} />}
        {clients && <PendingClientsBrief section={pendingClients} />}
      </section>
    </div>
  );
}
