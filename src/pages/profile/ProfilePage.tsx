import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { BadgeCheckIcon, CheckCircle2Icon, LandmarkIcon, LoaderIcon, UserIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { usersApi, type Bank, type Gender, type UpdateProfileInput } from '../../api/usersApi';
import { useMe } from '../../context/MeContext';
import { ReusableInputField } from '../../components/ReusableInputField';
import { StatusBadge } from '../../components/StatusBadge';
import { ROLE_LABELS, MODULES } from '../../config/roles';
import { humanize, initials } from '../../utils/format';
import { PHONE_MAX_DIGITS, sanitizePhoneInput, toLocalPhone } from '../../utils/phone';

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

const RELATIONSHIP_OPTIONS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Relative', 'Friend', 'Other'].map((r) => ({ label: r, value: r }));

const ACCOUNT_NUMBER_DIGITS = 10;

type FormState = Record<keyof UpdateProfileInput, string>;

// Staff must be at least 16 — the API refuses anything later.
const latestDateOfBirth = (() => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 16);
  return date.toISOString().slice(0, 10);
})();

/**
 * The signed-in user's own profile: who they are in the organisation (read-only, set by whoever
 * onboarded them) and the onboarding details they complete themselves — personal, next of kin, bank.
 */
export function ProfilePage() {
  const { me, loading, replace } = useMe();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void usersApi.banks().then(setBanks).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    setForm({
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      phone: toLocalPhone(me.phone),
      gender: me.gender === 'Unspecified' ? '' : me.gender,
      address: me.address ?? '',
      dateOfBirth: me.dateOfBirth ?? '',
      nextOfKinName: me.nextOfKinName ?? '',
      nextOfKinPhone: toLocalPhone(me.nextOfKinPhone),
      nextOfKinRelationship: me.nextOfKinRelationship ?? '',
      bankName: me.bankName ?? '',
      bankAccountNumber: me.bankAccountNumber ?? '',
      bankAccountName: me.bankAccountName ?? '',
    });
  }, [me]);

  const bankOptions = useMemo(() => banks.map((b) => ({ label: b.name, value: b.name })), [banks]);

  if (loading && !me) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderIcon size={20} className="animate-spin" />
      </div>
    );
  }

  if (!me || !form) {
    return <p className="py-16 text-center text-sm text-slate-400">Couldn't load your profile. Refresh the page to try again.</p>;
  }

  const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.email;
  const totalFields = 12;
  const completed = totalFields - me.missingProfileFields.length;

  const set = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => (prev ? { ...prev, [field]: event.target.value } : prev));
  const setPhone = (field: 'phone' | 'nextOfKinPhone') => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => (prev ? { ...prev, [field]: sanitizePhoneInput(event.target.value) } : prev));

  const accountNumberInvalid = form.bankAccountNumber.length > 0 && form.bankAccountNumber.length !== ACCOUNT_NUMBER_DIGITS;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    if (accountNumberInvalid) {
      toast.error(`Bank account number must be ${ACCOUNT_NUMBER_DIGITS} digits.`);
      return;
    }

    setSaving(true);
    try {
      const orNull = (value: string) => value.trim() || null;
      const updated = await usersApi.updateMyProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: orNull(form.phone),
        gender: (form.gender || 'Unspecified') as Gender,
        address: orNull(form.address),
        dateOfBirth: orNull(form.dateOfBirth),
        nextOfKinName: orNull(form.nextOfKinName),
        nextOfKinPhone: orNull(form.nextOfKinPhone),
        nextOfKinRelationship: orNull(form.nextOfKinRelationship),
        bankName: orNull(form.bankName),
        bankAccountNumber: orNull(form.bankAccountNumber),
        bankAccountName: orNull(form.bankAccountName),
      });
      replace(updated);
      toast.success(updated.profileComplete ? 'Profile saved — your onboarding details are complete.' : 'Profile saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 font-heading text-xl font-bold text-primary">
              {initials(fullName) || <UserIcon size={24} />}
            </div>
            <h2 className="mt-3 font-heading text-lg font-bold text-slate-900">{fullName}</h2>
            <p className="text-sm text-slate-500">{me.email}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StatusBadge status={me.onboardingStatus} />
              <StatusBadge status={me.blocked ? 'Suspended' : 'Active'} />
            </div>
          </div>

          <dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
            <Row label="Role" value={ROLE_LABELS[me.userType ?? ''] ?? humanize(me.userType)} />
            <Row label="User class" value={me.userClass ?? '—'} />
            {me.zones.length > 0 ? (
              <Row label="Zones" value={me.zones.map((z) => z.name).join(', ')} />
            ) : (
              <Row label="Office" value={me.officeName ?? 'Not assigned'} />
            )}
            <Row label="Modules" value={me.modules.map((m) => MODULES[m]?.label ?? m).join(', ') || 'None'} />
            <Row label="Onboarded by" value={me.createdByName ?? '—'} />
            <Row label="Last sign-in" value={me.lastLogin ? new Date(me.lastLogin).toLocaleString('en-NG') : '—'} />
          </dl>
          <p className="mt-4 text-xs text-slate-400">Your role, office and modules are managed by your organisation. Ask a super admin if any of them are wrong.</p>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-slate-800">Onboarding details</h3>
            <span className="text-sm font-semibold text-slate-700">
              {completed}/{totalFields}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${me.profileComplete ? 'bg-emerald-500' : 'bg-accent'}`}
              style={{ width: `${(completed / totalFields) * 100}%` }}
            />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            {me.profileComplete ? (
              <>
                <CheckCircle2Icon size={16} className="text-emerald-600" /> Complete — thank you.
              </>
            ) : (
              'Fill in every section on this page to complete your onboarding.'
            )}
          </p>
        </section>
      </aside>

      <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2" noValidate>
        <FormSection icon={UserIcon} title="Personal details">
          <ReusableInputField label="First name" name="firstName" value={form.firstName} onChange={set('firstName')} required />
          <ReusableInputField label="Last name" name="lastName" value={form.lastName} onChange={set('lastName')} required />
          <ReusableInputField
            label="Phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={PHONE_MAX_DIGITS}
            placeholder="08031234567"
            value={form.phone}
            onChange={setPhone('phone')}
          />
          <ReusableInputField label="Gender" name="gender" as="select" value={form.gender} onChange={set('gender')} options={GENDER_OPTIONS} />
          <ReusableInputField label="Date of birth" name="dateOfBirth" type="date" max={latestDateOfBirth} value={form.dateOfBirth} onChange={set('dateOfBirth')} />
          <div className="sm:col-span-2">
            <ReusableInputField label="Residential address" name="address" as="textarea" rows={2} value={form.address} onChange={set('address')} />
          </div>
        </FormSection>

        <FormSection icon={UsersIcon} title="Next of kin">
          <ReusableInputField label="Full name" name="nextOfKinName" value={form.nextOfKinName} onChange={set('nextOfKinName')} />
          <ReusableInputField
            label="Relationship"
            name="nextOfKinRelationship"
            as="select"
            value={form.nextOfKinRelationship}
            onChange={set('nextOfKinRelationship')}
            options={RELATIONSHIP_OPTIONS}
          />
          <ReusableInputField
            label="Phone"
            name="nextOfKinPhone"
            type="tel"
            inputMode="numeric"
            maxLength={PHONE_MAX_DIGITS}
            placeholder="08031234567"
            value={form.nextOfKinPhone}
            onChange={setPhone('nextOfKinPhone')}
          />
        </FormSection>

        <FormSection icon={LandmarkIcon} title="Bank account" hint="Where your salary and allowances are paid.">
          <ReusableInputField label="Bank" name="bankName" as="select" value={form.bankName} onChange={set('bankName')} options={bankOptions} />
          <ReusableInputField
            label="Account number"
            name="bankAccountNumber"
            inputMode="numeric"
            maxLength={ACCOUNT_NUMBER_DIGITS}
            placeholder="0123456789"
            value={form.bankAccountNumber}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, bankAccountNumber: e.target.value.replace(/\D/g, '').slice(0, ACCOUNT_NUMBER_DIGITS) } : prev))}
            error={`Must be ${ACCOUNT_NUMBER_DIGITS} digits.`}
            touched={accountNumberInvalid}
          />
          <div className="sm:col-span-2">
            <ReusableInputField label="Account name" name="bankAccountName" value={form.bankAccountName} onChange={set('bankAccountName')} />
          </div>
        </FormSection>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-heading font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? <LoaderIcon size={16} className="animate-spin" /> : <BadgeCheckIcon size={16} />}
            Save profile
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function FormSection({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={16} />
        </span>
        <div>
          <h3 className="font-heading text-sm font-semibold text-slate-800">{title}</h3>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
