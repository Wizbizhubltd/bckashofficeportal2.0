import { useState } from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import type { StaffUser } from '../../api/usersApi';
import { formatMoney } from '../../utils/money';
import {
  ArrearsStat,
  BriefCard,
  BriefRow,
  ClientsStat,
  DashboardHero,
  DisbursedStat,
  OnboardingPrompt,
  OutstandingLoansStat,
  PendingApplicationsBrief,
  PendingApplicationsStat,
  PendingStaffBrief,
  RepaidStat,
  SectionError,
  StaffStat,
  usePage,
  useSummary,
  type LoanApplicationItem,
} from './DashboardKit';

interface LateLoanItem {
  id: number;
  accountNumber: string | null;
  appliedAmount: number | null;
  approvedAmount: number | null;
}

/**
 * A controller oversees one office above its manager: portfolio health first (money out, money back,
 * arrears), then what's waiting on their authority.
 */
export function ControllerDashboard() {
  const { me, hasModule } = useMe();
  const rolePath = useRolePath();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((key) => key + 1);
  const staff = hasModule('staff');
  const clients = hasModule('clients');
  const loans = hasModule('loans');

  const summary = useSummary(reloadKey);
  const lateLoans = usePage<LateLoanItem>('/loans/late', {}, reloadKey, loans);
  const applications = usePage<LoanApplicationItem>('/loan-applications', { status: 'Pending' }, reloadKey, loans);
  const pendingStaff = usePage<StaffUser>('/users', { onboardingStatus: 'Pending' }, reloadKey, staff);

  return (
    <div className="space-y-6">
      <DashboardHero tagline={`Oversight of ${me?.officeName ?? 'your office'} — portfolio health and approvals.`} onRefresh={reload} />
      <OnboardingPrompt />

      {summary.status === 'error' ? (
        <SectionError message="Couldn't load the dashboard figures." onRetry={reload} />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loans && <DisbursedStat summary={summary} />}
          {loans && <RepaidStat summary={summary} />}
          {loans && <OutstandingLoansStat summary={summary} />}
          {loans && <ArrearsStat summary={summary} />}
          {loans && <PendingApplicationsStat summary={summary} label="Awaiting approval" />}
          {clients && <ClientsStat summary={summary} />}
          {staff && <StaffStat summary={summary} />}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {loans && (
          <BriefCard
            icon={AlertTriangleIcon}
            title="Loans in arrears"
            section={lateLoans}
            emptyText="No loans are in arrears."
            renderItem={(item: LateLoanItem) => (
              <BriefRow
                key={item.id}
                to={rolePath(`/loans/${item.id}`)}
                title={item.accountNumber ? `Loan ${item.accountNumber}` : `Loan #${item.id}`}
                subtitle="Past-due installments"
                trailing={<span className="font-heading text-sm font-semibold text-rose-700">{formatMoney(item.approvedAmount ?? item.appliedAmount, 0)}</span>}
              />
            )}
          />
        )}
        {loans && <PendingApplicationsBrief section={applications} title="Applications awaiting approval" />}
        {staff && <PendingStaffBrief section={pendingStaff} />}
      </section>
    </div>
  );
}
