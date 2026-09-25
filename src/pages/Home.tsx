import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  Building2Icon,
  BriefcaseIcon,
  ClipboardListIcon,
  FileClockIcon,
  RefreshCwIcon,
  UserCheckIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { humanize, initials } from '../utils/format';
import type { ClientListItem } from './admin/clients/ClientsListPage';
import type { GroupListItem } from './admin/groups/GroupsListPage';

interface DashboardSummary {
  officesCount: number;
  activeOfficesCount: number;
  staffCount: number;
  clientsCount: number;
  activeClientsCount: number;
  outstandingLoansCount: number;
  lateLoansCount: number;
  disbursementsThisMonthCount: number;
  disbursementsThisMonthAmount: number;
  repaymentsThisMonthCount: number;
  repaymentsThisMonthAmount: number;
  pendingLoanApplicationsCount: number;
  pendingStaffOnboardingCount: number;
}

interface CurrentUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  officeName: string | null;
  userType: string | null;
  userClass: 'Initiator' | 'Authorizer' | 'Reviewer' | null;
  lastLogin: string | null;
}

interface LoanApplicationItem {
  id: number;
  clientType: 'Client' | 'Group';
  amount: number;
  status: 'Pending' | 'Approved' | 'Declined';
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

// Each brief is fetched separately so one failing (e.g. a module this user can't read) doesn't blank the rest.
type Section<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

const BRIEF_SIZE = 5;

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const nairaCompact = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', notation: 'compact', maximumFractionDigits: 1 });
const count = new Intl.NumberFormat('en-NG');

function useSection<T>(load: () => Promise<T>, reloadKey: number): Section<T> {
  const [section, setSection] = useState<Section<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setSection({ status: 'loading' });
    load()
      .then((data) => !cancelled && setSection({ status: 'ready', data }))
      .catch(() => !cancelled && setSection({ status: 'error' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return section;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const { user } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  const me = useSection(() => apiClient.get<CurrentUser>('/users/me').then((r) => r.data), reloadKey);
  const summary = useSection(() => apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data), reloadKey);
  const applications = useSection(
    () =>
      apiClient
        .get<PagedResult<LoanApplicationItem>>('/loan-applications', { params: { status: 'Pending', page: 1, pageSize: BRIEF_SIZE } })
        .then((r) => r.data),
    reloadKey,
  );
  const clients = useSection(
    () =>
      apiClient
        .get<PagedResult<ClientListItem>>('/clients', { params: { status: 'Pending', page: 1, pageSize: BRIEF_SIZE } })
        .then((r) => r.data),
    reloadKey,
  );
  const groups = useSection(
    () =>
      apiClient
        .get<PagedResult<GroupListItem>>('/groups', { params: { status: 'Pending', page: 1, pageSize: BRIEF_SIZE } })
        .then((r) => r.data),
    reloadKey,
  );

  const profile = me.status === 'ready' ? me.data : null;
  const fullName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || user?.fullName || profile?.email || 'there';
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monthName = new Date().toLocaleDateString('en-NG', { month: 'long' });

  return (
    <div className="space-y-6">
      {/* Welcome + profile */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-[#0b2a21] p-6 text-white shadow-lg shadow-primary/10 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-40 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 font-heading text-xl font-bold ring-1 ring-white/25">
              {initials(fullName) || '?'}
            </div>
            <div>
              <p className="text-sm text-white/70">{today}</p>
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                {greeting()}, {fullName.split(' ')[0]}
              </h2>
              <p className="mt-0.5 text-sm text-white/70">{profile?.email ?? user?.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <dl className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
              <ProfileChip icon={Building2Icon} label="Office" value={me.status === 'loading' ? null : profile?.officeName || '—'} />
              <ProfileChip icon={BriefcaseIcon} label="User type" value={me.status === 'loading' ? null : humanize(profile?.userType ?? user?.user_type)} />
              <ProfileChip icon={BadgeCheckIcon} label="User class" value={me.status === 'loading' ? null : humanize(profile?.userClass ?? user?.user_class)} />
            </dl>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Refresh dashboard"
              title="Refresh"
            >
              <RefreshCwIcon size={18} />
            </button>
          </div>
        </div>
      </motion.section>

      {/* Counts */}
      {summary.status === 'error' ? (
        <SectionError message="Couldn't load the dashboard figures." onRetry={() => setReloadKey((key) => key + 1)} />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={UsersIcon}
            tone="green"
            label="Clients"
            value={summary.status === 'ready' ? count.format(summary.data.clientsCount) : null}
            detail={summary.status === 'ready' ? `${count.format(summary.data.activeClientsCount)} active` : null}
            to="/admin/clients"
          />
          <StatCard
            icon={BanknoteIcon}
            tone="blue"
            label="Outstanding loans"
            value={summary.status === 'ready' ? count.format(summary.data.outstandingLoansCount) : null}
            detail={summary.status === 'ready' ? 'Disbursed and running' : null}
          />
          <StatCard
            icon={AlertTriangleIcon}
            tone="red"
            label="Loans in arrears"
            value={summary.status === 'ready' ? count.format(summary.data.lateLoansCount) : null}
            detail={
              summary.status === 'ready' && summary.data.outstandingLoansCount > 0
                ? `${((summary.data.lateLoansCount / summary.data.outstandingLoansCount) * 100).toFixed(1)}% of outstanding`
                : summary.status === 'ready'
                  ? 'Past-due installments'
                  : null
            }
          />
          <StatCard
            icon={FileClockIcon}
            tone="amber"
            label="Pending applications"
            value={summary.status === 'ready' ? count.format(summary.data.pendingLoanApplicationsCount) : null}
            detail={summary.status === 'ready' ? 'Awaiting a decision' : null}
            to="/admin/loan-applications"
          />
          <StatCard
            icon={ArrowUpRightIcon}
            tone="violet"
            label={`Disbursed in ${monthName}`}
            value={summary.status === 'ready' ? nairaCompact.format(summary.data.disbursementsThisMonthAmount) : null}
            valueTitle={summary.status === 'ready' ? naira.format(summary.data.disbursementsThisMonthAmount) : undefined}
            detail={summary.status === 'ready' ? `${count.format(summary.data.disbursementsThisMonthCount)} disbursements` : null}
          />
          <StatCard
            icon={ArrowDownLeftIcon}
            tone="green"
            label={`Repaid in ${monthName}`}
            value={summary.status === 'ready' ? nairaCompact.format(summary.data.repaymentsThisMonthAmount) : null}
            valueTitle={summary.status === 'ready' ? naira.format(summary.data.repaymentsThisMonthAmount) : undefined}
            detail={summary.status === 'ready' ? `${count.format(summary.data.repaymentsThisMonthCount)} repayments` : null}
          />
          <StatCard
            icon={Building2Icon}
            tone="slate"
            label="Offices"
            value={summary.status === 'ready' ? count.format(summary.data.officesCount) : null}
            detail={summary.status === 'ready' ? `${count.format(summary.data.activeOfficesCount)} active` : null}
            to="/admin/offices"
          />
          <StatCard
            icon={UserCheckIcon}
            tone="slate"
            label="Staff"
            value={summary.status === 'ready' ? count.format(summary.data.staffCount) : null}
            detail={summary.status === 'ready' ? `${count.format(summary.data.pendingStaffOnboardingCount)} awaiting onboarding` : null}
          />
        </section>
      )}

      {/* Briefs */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <BriefCard
          icon={ClipboardListIcon}
          title="Pending loan applications"
          viewAllTo="/admin/loan-applications"
          section={applications}
          emptyText="No applications are waiting for a decision."
          renderItem={(item: LoanApplicationItem) => (
            <BriefRow
              key={item.id}
              to={`/admin/loan-applications/${item.id}`}
              title={`Application #${item.id}`}
              subtitle={`${item.clientType} loan`}
              trailing={<span className="font-heading text-sm font-semibold text-slate-800">{naira.format(item.amount)}</span>}
            />
          )}
        />
        <BriefCard
          icon={UsersIcon}
          title="Clients awaiting activation"
          viewAllTo="/admin/clients"
          section={clients}
          emptyText="No clients are waiting for activation."
          renderItem={(item: ClientListItem) => {
            const name = item.displayName || [item.firstName, item.lastName].filter(Boolean).join(' ') || `Client #${item.id}`;
            return (
              <BriefRow
                key={item.id}
                to={`/admin/clients/${item.id}`}
                avatar={initials(name)}
                title={name}
                subtitle={item.accountNo ? `A/C ${item.accountNo}` : item.mobile ?? '—'}
                trailing={<StatusBadge status={item.status} />}
              />
            );
          }}
        />
        <BriefCard
          icon={UsersRoundIcon}
          title="Groups awaiting activation"
          viewAllTo="/admin/groups"
          section={groups}
          emptyText="No groups are waiting for activation."
          renderItem={(item: GroupListItem) => {
            const name = item.name || `Group #${item.id}`;
            return (
              <BriefRow
                key={item.id}
                to={`/admin/groups/${item.id}`}
                avatar={initials(name)}
                title={name}
                subtitle={item.accountNo ? `A/C ${item.accountNo}` : 'No account number'}
                trailing={<StatusBadge status={item.status} />}
              />
            );
          }}
        />
      </section>
    </div>
  );
}

function ProfileChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/60">
        <Icon size={12} />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold">
        {value ?? <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/20 align-middle" />}
      </dd>
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  red: 'bg-rose-50 text-rose-700 ring-rose-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  valueTitle,
  detail,
  to,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string | null;
  valueTitle?: string;
  detail: string | null;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${TONES[tone]}`}>
          <Icon size={19} />
        </span>
        {to && <ArrowRightIcon size={16} className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      {value === null ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]" title={valueTitle}>
          {value}
        </p>
      )}
      {detail === null ? (
        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      )}
    </>
  );

  const className = 'group block rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all';
  return to ? (
    <Link to={to} className={`${className} hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function BriefCard<T>({
  icon: Icon,
  title,
  viewAllTo,
  section,
  emptyText,
  renderItem,
}: {
  icon: LucideIcon;
  title: string;
  viewAllTo: string;
  section: Section<PagedResult<T>>;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={16} />
          </span>
          <h3 className="font-heading text-sm font-semibold text-slate-800">{title}</h3>
          {section.status === 'ready' && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {count.format(section.data.totalCount)}
            </span>
          )}
        </div>
        <Link to={viewAllTo} className="text-xs font-medium text-primary hover:text-accent">
          View all
        </Link>
      </div>

      <div className="flex-1 p-2">
        {section.status === 'loading' ? (
          <ul>
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 px-3 py-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
              </li>
            ))}
          </ul>
        ) : section.status === 'error' ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">Couldn't load these records.</p>
        ) : section.data.items.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-400">{emptyText}</p>
        ) : (
          <ul>{section.data.items.map(renderItem)}</ul>
        )}
      </div>
    </div>
  );
}

function BriefRow({
  to,
  avatar,
  title,
  subtitle,
  trailing,
}: {
  to: string;
  avatar?: string;
  title: string;
  subtitle: string;
  trailing: ReactNode;
}) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {avatar || <FileClockIcon size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{title}</span>
          <span className="block truncate text-xs text-slate-400">{subtitle}</span>
        </span>
        <span className="flex-shrink-0">{trailing}</span>
      </Link>
    </li>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertTriangleIcon size={16} />
        {message}
      </span>
      <button type="button" onClick={onRetry} className="font-medium hover:underline">
        Try again
      </button>
    </div>
  );
}
