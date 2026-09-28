import { useState } from 'react';
import { useMe } from '../../context/MeContext';
import type { ClientListItem } from '../admin/clients/ClientsListPage';
import type { GroupListItem } from '../admin/groups/GroupsListPage';
import {
  ArrearsStat,
  ClientsStat,
  DashboardHero,
  OnboardingPrompt,
  OutstandingLoansStat,
  PendingApplicationsBrief,
  PendingApplicationsStat,
  PendingClientsBrief,
  PendingGroupsBrief,
  SectionError,
  usePage,
  useSummary,
  type LoanApplicationItem,
} from './DashboardKit';

/** A marketer's day: the clients they're bringing in and the loan applications they've raised, for their office. */
export function MarketerDashboard() {
  const { hasModule } = useMe();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);
  const clients = hasModule('clients');
  const loans = hasModule('loans');

  const summary = useSummary(reloadKey);
  const applications = usePage<LoanApplicationItem>('/loan-applications', { status: 'Pending' }, reloadKey, loans);
  const pendingClients = usePage<ClientListItem>('/clients', { status: 'Pending' }, reloadKey, clients);
  const pendingGroups = usePage<GroupListItem>('/groups', { status: 'Pending' }, reloadKey, clients);

  return (
    <div className="space-y-6">
      <DashboardHero tagline="Your clients and loan applications at a glance." onRefresh={reload} />
      <OnboardingPrompt />

      {summary.status === 'error' ? (
        <SectionError message="Couldn't load the dashboard figures." onRetry={reload} />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {clients && <ClientsStat summary={summary} />}
          {loans && <PendingApplicationsStat summary={summary} label="My pending applications" />}
          {loans && <OutstandingLoansStat summary={summary} />}
          {loans && <ArrearsStat summary={summary} />}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {loans && <PendingApplicationsBrief section={applications} />}
        {clients && <PendingClientsBrief section={pendingClients} />}
        {clients && <PendingGroupsBrief section={pendingGroups} />}
      </section>
    </div>
  );
}
