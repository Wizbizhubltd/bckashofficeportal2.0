import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  Building2Icon,
  FileClockIcon,
  RefreshCwIcon,
  UserCheckIcon,
  UsersIcon,
  UsersRoundIcon,
  ClipboardListIcon,
  type LucideIcon,
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import type { PagedResult, StaffUser } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import { ROLE_LABELS } from '../../config/roles';
import { initials } from '../../utils/format';
import { formatMoney, formatMoneyCompact } from '../../utils/money';
import { StatusBadge } from '../../components/StatusBadge';
import type { ClientListItem } from '../admin/clients/ClientsListPage';
import type { GroupListItem } from '../admin/groups/GroupsListPage';

/**
 * Building blocks shared by the role dashboards (pages/dashboard/*Dashboard.tsx). Every figure comes
 * from the API already narrowed to the viewer's office(s), so a marketer sees their office and a
 * director sees their zones without any filtering here.
 */

export interface DashboardSummary {
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

export interface LoanApplicationItem {
  id: number;
  clientType: 'Client' | 'Group';
  amount: number;
  status: 'Pending' | 'Approved' | 'Declined';
}

// Each brief is fetched separately so one failing (e.g. a module this user can't read) doesn't blank the rest.
export type Section<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

export const BRIEF_SIZE = 5;

export const count = new Intl.NumberFormat('en-NG');

export function useSection<T>(load: () => Promise<T>, reloadKey: number, enabled = true): Section<T> {
  const [section, setSection] = useState<Section<T>>({ status: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setSection({ status: 'loading' });
    load()
      .then((data) => !cancelled && setSection({ status: 'ready', data }))
      .catch(() => !cancelled && setSection({ status: 'error' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, enabled]);

  return section;
}

export function useSummary(reloadKey: number): Section<DashboardSummary> {
  return useSection(() => apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data), reloadKey);
}

/** First page of a list endpoint, for a brief card. */
export function usePage<T>(path: string, params: Record<string, unknown>, reloadKey: number, enabled = true): Section<PagedResult<T>> {
  return useSection(
    () => apiClient.get<PagedResult<T>>(path, { params: { page: 1, pageSize: BRIEF_SIZE, ...params } }).then((r) => r.data),
    reloadKey,
    enabled,
  );
}

export function whenReady<T>(section: Section<T>, pick: (data: T) => string): string | null {
  return section.status === 'ready' ? pick(section.data) : null;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Greeting, who the viewer is and what they cover (their office, or a director's zones). */
export function DashboardHero({ tagline, onRefresh }: { tagline: string; onRefresh: () => void }) {
  const { user, userType } = useAuth();
  const { me, loading } = useMe();
  const fullName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || user?.fullName || me?.email || 'there';
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const coverage = me?.zones.length ? me.zones.map((z) => z.name).join(', ') : me?.officeName || '—';

  return (
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
            <p className="mt-0.5 text-sm text-white/70">{tagline}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <dl className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <ProfileChip icon={BriefcaseIcon} label="Role" value={ROLE_LABELS[userType ?? ''] ?? '—'} />
            <ProfileChip icon={Building2Icon} label={me?.zones.length ? 'Zones' : 'Office'} value={loading && !me ? null : coverage} />
            <ProfileChip icon={BadgeCheckIcon} label="User class" value={loading && !me ? null : me?.userClass ?? '—'} />
          </dl>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <RefreshCwIcon size={18} />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

/** Nudges the viewer to finish the onboarding details on their profile until they have. */
export function OnboardingPrompt() {
  const { me } = useMe();
  const rolePath = useRolePath();
  if (!me || me.profileComplete) return null;

  return (
    <Link
      to={rolePath('/profile')}
      className="group flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 transition-colors hover:bg-amber-100/70"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <UserCheckIcon size={20} />
      </span>
      <span className="flex-1">
        <span className="block font-heading text-sm font-bold">Complete your onboarding details</span>
        <span className="block text-sm">
          {me.missingProfileFields.length} detail{me.missingProfileFields.length === 1 ? '' : 's'} still missing — your next of kin, bank account and personal details.
        </span>
      </span>
      <ArrowRightIcon size={18} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Staff awaiting authorization — the brief every staff-managing role sees. */
export function PendingStaffBrief({ section }: { section: Section<PagedResult<StaffUser>> }) {
  const rolePath = useRolePath();
  return (
    <BriefCard
      icon={UserCheckIcon}
      title="Staff awaiting authorization"
      viewAllTo={rolePath('/staff?onboardingStatus=Pending')}
      section={section}
      emptyText="No staff are waiting for authorization."
      renderItem={(item: StaffUser) => {
        const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email;
        return (
          <BriefRow
            key={item.id}
            to={rolePath(`/staff/${item.id}`)}
            avatar={initials(name)}
            title={name}
            subtitle={`${ROLE_LABELS[item.userType ?? ''] ?? 'Staff'} · ${item.officeName ?? 'No office'}`}
            trailing={<span className="text-xs text-slate-400">{item.createdByName ?? ''}</span>}
          />
        );
      }}
    />
  );
}

// ---- Stat cards, each fed by the scoped dashboard summary ----

type SummaryProps = { summary: Section<DashboardSummary> };

const monthName = () => new Date().toLocaleDateString('en-NG', { month: 'long' });

export function ClientsStat({ summary }: SummaryProps) {
  const rolePath = useRolePath();
  return (
    <StatCard
      icon={UsersIcon}
      tone="green"
      label="Clients"
      value={whenReady(summary, (d) => count.format(d.clientsCount))}
      detail={whenReady(summary, (d) => `${count.format(d.activeClientsCount)} active`)}
      to={rolePath('/clients')}
    />
  );
}

export function PendingApplicationsStat({ summary, label = 'Pending applications' }: SummaryProps & { label?: string }) {
  const rolePath = useRolePath();
  return (
    <StatCard
      icon={FileClockIcon}
      tone="amber"
      label={label}
      value={whenReady(summary, (d) => count.format(d.pendingLoanApplicationsCount))}
      detail={whenReady(summary, () => 'Awaiting a decision')}
      to={rolePath('/loan-applications')}
    />
  );
}

export function OutstandingLoansStat({ summary }: SummaryProps) {
  return (
    <StatCard
      icon={BanknoteIcon}
      tone="blue"
      label="Outstanding loans"
      value={whenReady(summary, (d) => count.format(d.outstandingLoansCount))}
      detail={whenReady(summary, () => 'Disbursed and running')}
    />
  );
}

export function ArrearsStat({ summary }: SummaryProps) {
  return (
    <StatCard
      icon={AlertTriangleIcon}
      tone="red"
      label="Loans in arrears"
      value={whenReady(summary, (d) => count.format(d.lateLoansCount))}
      detail={whenReady(summary, (d) =>
        d.outstandingLoansCount > 0 ? `${((d.lateLoansCount / d.outstandingLoansCount) * 100).toFixed(1)}% of outstanding` : 'Past-due installments',
      )}
    />
  );
}

export function DisbursedStat({ summary }: SummaryProps) {
  return (
    <StatCard
      icon={ArrowUpRightIcon}
      tone="violet"
      label={`Disbursed in ${monthName()}`}
      value={whenReady(summary, (d) => formatMoneyCompact(d.disbursementsThisMonthAmount))}
      valueTitle={summary.status === 'ready' ? formatMoney(summary.data.disbursementsThisMonthAmount, 0) : undefined}
      detail={whenReady(summary, (d) => `${count.format(d.disbursementsThisMonthCount)} disbursements`)}
    />
  );
}

export function RepaidStat({ summary }: SummaryProps) {
  return (
    <StatCard
      icon={ArrowDownLeftIcon}
      tone="green"
      label={`Repaid in ${monthName()}`}
      value={whenReady(summary, (d) => formatMoneyCompact(d.repaymentsThisMonthAmount))}
      valueTitle={summary.status === 'ready' ? formatMoney(summary.data.repaymentsThisMonthAmount, 0) : undefined}
      detail={whenReady(summary, (d) => `${count.format(d.repaymentsThisMonthCount)} repayments`)}
    />
  );
}

export function StaffStat({ summary }: SummaryProps) {
  const rolePath = useRolePath();
  return (
    <StatCard
      icon={UserCheckIcon}
      tone="slate"
      label="Staff"
      value={whenReady(summary, (d) => count.format(d.staffCount))}
      detail={whenReady(summary, (d) => `${count.format(d.pendingStaffOnboardingCount)} awaiting authorization`)}
      to={rolePath('/staff')}
    />
  );
}

export function OfficesStat({ summary }: SummaryProps) {
  const rolePath = useRolePath();
  return (
    <StatCard
      icon={Building2Icon}
      tone="slate"
      label="Offices"
      value={whenReady(summary, (d) => count.format(d.officesCount))}
      detail={whenReady(summary, (d) => `${count.format(d.activeOfficesCount)} active`)}
      to={rolePath('/offices')}
    />
  );
}

// ---- Briefs ----

export function PendingApplicationsBrief({ section, title = 'Pending loan applications' }: { section: Section<PagedResult<LoanApplicationItem>>; title?: string }) {
  const rolePath = useRolePath();
  return (
    <BriefCard
      icon={ClipboardListIcon}
      title={title}
      viewAllTo={rolePath('/loan-applications')}
      section={section}
      emptyText="No applications are waiting for a decision."
      renderItem={(item: LoanApplicationItem) => (
        <BriefRow
          key={item.id}
          to={rolePath(`/loan-applications/${item.id}`)}
          title={`Application #${item.id}`}
          subtitle={`${item.clientType} loan`}
          trailing={<span className="font-heading text-sm font-semibold text-slate-800">{formatMoney(item.amount, 0)}</span>}
        />
      )}
    />
  );
}

export function PendingClientsBrief({ section }: { section: Section<PagedResult<ClientListItem>> }) {
  const rolePath = useRolePath();
  return (
    <BriefCard
      icon={UsersIcon}
      title="Clients awaiting activation"
      viewAllTo={rolePath('/clients')}
      section={section}
      emptyText="No clients are waiting for activation."
      renderItem={(item: ClientListItem) => {
        const name = item.displayName || [item.firstName, item.lastName].filter(Boolean).join(' ') || `Client #${item.id}`;
        return (
          <BriefRow
            key={item.id}
            to={rolePath(`/clients/${item.id}`)}
            avatar={initials(name)}
            title={name}
            subtitle={item.accountNo ? `A/C ${item.accountNo}` : item.mobile ?? '—'}
            trailing={<StatusBadge status={item.status} />}
          />
        );
      }}
    />
  );
}

export function PendingGroupsBrief({ section }: { section: Section<PagedResult<GroupListItem>> }) {
  const rolePath = useRolePath();
  return (
    <BriefCard
      icon={UsersRoundIcon}
      title="Groups awaiting activation"
      viewAllTo={rolePath('/groups')}
      section={section}
      emptyText="No groups are waiting for activation."
      renderItem={(item: GroupListItem) => {
        const name = item.name || `Group #${item.id}`;
        return (
          <BriefRow
            key={item.id}
            to={rolePath(`/groups/${item.id}`)}
            avatar={initials(name)}
            title={name}
            subtitle={item.accountNo ? `A/C ${item.accountNo}` : 'No account number'}
            trailing={<StatusBadge status={item.status} />}
          />
        );
      }}
    />
  );
}

export function ProfileChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
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

export const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  red: 'bg-rose-50 text-rose-700 ring-rose-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatCard({
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

export function BriefCard<T>({
  icon: Icon,
  title,
  viewAllTo,
  section,
  emptyText,
  renderItem,
}: {
  icon: LucideIcon;
  title: string;
  viewAllTo?: string;
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
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-medium text-primary hover:text-accent">
            View all
          </Link>
        )}
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

export function BriefRow({
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

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
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
