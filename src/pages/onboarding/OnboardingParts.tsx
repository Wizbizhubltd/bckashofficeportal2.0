import type { ReactNode } from 'react';
import { AlertTriangleIcon, CheckCircle2Icon, CheckIcon, LoaderIcon, RefreshCwIcon, ShieldAlertIcon, XCircleIcon } from 'lucide-react';
import type { BvnCheck, OnboardClientInput } from '../../api/clientsApi';
import { PHONE_MAX_DIGITS, sanitizePhoneInput } from '../../utils/phone';

/** A client being filled in during onboarding, with the state of their BVN check. */
export interface DraftClient {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  bvn: string;
  checking: boolean;
  check: BvnCheck | null;
  checkError: string | null;
  /** Whose details to keep when the BVN record differs from what was entered. */
  source: 'bvn' | 'client' | null;
  reason: string;
  /** The API's error for this client from the last onboarding attempt. */
  serverError: string | null;
}

export const BVN_DIGITS = 11;

let draftCounter = 0;
export function newDraft(): DraftClient {
  draftCounter += 1;
  return { key: `client-${draftCounter}`, fullName: '', email: '', phone: '', bvn: '', checking: false, check: null, checkError: null, source: null, reason: '', serverError: null };
}

/** What's wrong with a client's details before their BVN can be checked, or null when they're fine. */
export function detailsProblem(draft: DraftClient): string | null {
  if (draft.fullName.trim().split(/\s+/).filter(Boolean).length < 2) return 'Enter the full name — at least a first and last name.';
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Enter a valid email address.';
  if (draft.phone.length !== PHONE_MAX_DIGITS) return `Enter an ${PHONE_MAX_DIGITS}-digit phone number, e.g. 08031234567.`;
  if (draft.bvn.length !== BVN_DIGITS) return `A BVN is ${BVN_DIGITS} digits.`;
  return null;
}

/** Verified, and — when the BVN record differed — a choice made (with a reason, if keeping the client's details). */
export function isReady(draft: DraftClient): boolean {
  if (!draft.check) return false;
  if (draft.check.matches) return true;
  return draft.source === 'bvn' || (draft.source === 'client' && draft.reason.trim().length > 0);
}

export function toInput(draft: DraftClient): OnboardClientInput {
  const matches = draft.check?.matches ?? false;
  return {
    fullName: draft.fullName.trim(),
    email: draft.email.trim() || null,
    phone: draft.phone || null,
    bvn: draft.bvn,
    bvnVerificationId: draft.check!.verificationId,
    detailsSource: matches ? null : draft.source,
    overrideReason: !matches && draft.source === 'client' ? draft.reason.trim() : null,
  };
}

/** Editing anything the BVN check compared makes that check stale. */
export function applyEdit(draft: DraftClient, changes: Partial<Pick<DraftClient, 'fullName' | 'email' | 'phone' | 'bvn'>>): DraftClient {
  const next = { ...draft, ...changes, serverError: null };
  const checkedFieldChanged = ['fullName', 'phone', 'bvn'].some((field) => field in changes && changes[field as keyof typeof changes] !== draft[field as keyof DraftClient]);
  return checkedFieldChanged ? { ...next, check: null, checkError: null, source: null, reason: '' } : next;
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 sm:gap-4">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-4">
            <span className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-heading font-bold ${
                  done ? 'bg-primary text-white' : active ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <CheckIcon size={16} /> : index + 1}
              </span>
              <span className={`text-sm ${active ? 'font-heading font-bold text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
            </span>
            {index < steps.length - 1 && <span className="hidden h-px w-10 bg-gray-200 sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

const inputClass =
  'w-full px-3 py-2 border rounded-lg text-sm font-body focus:outline-none focus:ring-2 border-gray-200 focus:ring-primary/20 disabled:bg-gray-50';

/** The four onboarding details for one client: full name, email, phone and BVN. */
export function ClientDetailsFields({
  draft,
  onChange,
  heading,
  badge,
  onRemove,
  showProblem,
}: {
  draft: DraftClient;
  onChange: (changes: Partial<Pick<DraftClient, 'fullName' | 'email' | 'phone' | 'bvn'>>) => void;
  heading: string;
  badge?: string;
  onRemove?: () => void;
  showProblem: boolean;
}) {
  const problem = showProblem ? detailsProblem(draft) : null;
  return (
    <section className={`rounded-xl border bg-white p-5 ${problem || draft.serverError ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-sm font-bold text-gray-800">{heading}</h3>
          {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-gray-400 hover:text-red-600">
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className={inputClass} value={draft.fullName} placeholder="e.g. Ada Chioma Obi" onChange={(e) => onChange({ fullName: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" value={draft.email} placeholder="ada@example.com" onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
        <Field label="Phone number" required>
          <input
            className={inputClass}
            type="tel"
            inputMode="numeric"
            maxLength={PHONE_MAX_DIGITS}
            value={draft.phone}
            placeholder="08031234567"
            onChange={(e) => onChange({ phone: sanitizePhoneInput(e.target.value) })}
          />
        </Field>
        <Field label="BVN" required>
          <input
            className={inputClass}
            inputMode="numeric"
            maxLength={BVN_DIGITS}
            value={draft.bvn}
            placeholder="11-digit BVN"
            onChange={(e) => onChange({ bvn: e.target.value.replace(/\D/g, '').slice(0, BVN_DIGITS) })}
          />
        </Field>
      </div>
      {(problem || draft.serverError) && <p className="mt-3 text-sm text-red-600">{draft.serverError ?? problem}</p>}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * One client's BVN check: what the BVN is registered to next to what was entered. When they differ,
 * the staff member either takes the BVN record's details or keeps the client's — with a reason, and
 * the client is flagged high risk until a super admin marks them safe.
 */
export function BvnVerificationCard({
  draft,
  heading,
  badge,
  onRetry,
  onChoose,
  onReason,
}: {
  draft: DraftClient;
  heading: string;
  badge?: string;
  onRetry: () => void;
  onChoose: (source: 'bvn' | 'client') => void;
  onReason: (reason: string) => void;
}) {
  const check = draft.check;
  const status = draft.checking
    ? { tone: 'bg-gray-100 text-gray-600', icon: <LoaderIcon size={14} className="animate-spin" />, label: 'Checking BVN…' }
    : draft.checkError
      ? { tone: 'bg-red-50 text-red-700', icon: <XCircleIcon size={14} />, label: 'Not verified' }
      : check?.matches
        ? { tone: 'bg-green-50 text-green-700', icon: <CheckCircle2Icon size={14} />, label: 'Verified — details match' }
        : check
          ? { tone: 'bg-amber-50 text-amber-800', icon: <AlertTriangleIcon size={14} />, label: 'Details differ from BVN' }
          : { tone: 'bg-gray-100 text-gray-500', icon: null, label: 'Not checked yet' };

  return (
    <section className={`rounded-xl border bg-white p-5 ${draft.serverError ? 'border-red-200' : check && !check.matches ? 'border-amber-200' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-bold text-gray-800">{heading}</h3>
            {badge && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {draft.fullName} · BVN {draft.bvn}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {draft.checkError && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {draft.checkError}
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <RefreshCwIcon size={14} /> Check again
          </button>
        </div>
      )}

      {check && !check.matches && (
        <div className="mt-4 space-y-4">
          <div className="flex gap-4">
            {check.fromBvn.photo && (
              <img
                src={`data:image/jpeg;base64,${check.fromBvn.photo}`}
                alt="Photo on the BVN record"
                className="h-24 w-20 flex-shrink-0 rounded-lg border border-gray-200 object-cover"
              />
            )}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Detail</th>
                    <th className="py-2 pr-4 font-medium">Entered</th>
                    <th className="py-2 font-medium">BVN record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {check.comparisons.map((row) => (
                    <tr key={row.field} className={row.matches ? '' : 'bg-amber-50/60'}>
                      <td className="py-2 pr-4 text-gray-500">{row.field}</td>
                      <td className={`py-2 pr-4 ${row.matches ? 'text-gray-700' : 'font-medium text-amber-900'}`}>{row.given || '—'}</td>
                      <td className={`py-2 ${row.matches ? 'text-gray-700' : 'font-medium text-amber-900'}`}>{row.fromBvn || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(check.fromBvn.birthDate || check.fromBvn.gender) && (
                <p className="mt-2 text-xs text-gray-400">
                  BVN record also shows: {[check.fromBvn.gender, check.fromBvn.birthDate && `born ${check.fromBvn.birthDate}`].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChoiceCard
              selected={draft.source === 'bvn'}
              onSelect={() => onChoose('bvn')}
              title="Use the BVN record's details"
              description="The client is saved with the name and phone on their BVN."
            />
            <ChoiceCard
              selected={draft.source === 'client'}
              onSelect={() => onChoose('client')}
              title="Continue with the client's details"
              description="Keep what was entered. The client is flagged high risk until a super admin marks them safe."
              warning
            />
          </div>

          {draft.source === 'client' && (
            <label className="block space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <ShieldAlertIcon size={14} className="text-red-500" />
                Why are you keeping the client's details? <span className="text-red-500">*</span>
              </span>
              <textarea
                rows={2}
                value={draft.reason}
                onChange={(e) => onReason(e.target.value)}
                placeholder="e.g. Recently married — the BVN still carries her maiden name."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          )}
        </div>
      )}

      {draft.serverError && <p className="mt-3 text-sm text-red-600">{draft.serverError}</p>}
    </section>
  );
}

function ChoiceCard({ selected, onSelect, title, description, warning }: { selected: boolean; onSelect: () => void; title: string; description: string; warning?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition-colors ${
        selected ? (warning ? 'border-red-300 bg-red-50' : 'border-primary bg-primary/5') : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? (warning ? 'border-red-500' : 'border-primary') : 'border-gray-300'}`}>
          {selected && <span className={`h-2 w-2 rounded-full ${warning ? 'bg-red-500' : 'bg-primary'}`} />}
        </span>
        <span className="font-heading text-sm font-bold text-gray-800">{title}</span>
      </span>
      <span className="mt-1 block pl-6 text-xs text-gray-500">{description}</span>
    </button>
  );
}
