import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { InfoIcon, LoaderIcon } from 'lucide-react';
import { usersApi, type CreateStaffInput, type Gender, type UserClass } from '../../api/usersApi';
import { useAuth } from '../../context/AuthContext';
import { useMe } from '../../context/MeContext';
import { useRolePath } from '../../hooks/useRolePath';
import { useScopedOffices } from '../../hooks/useScopedOffices';
import { isOfficeRole, rolesBelow, ROLE_LABELS } from '../../config/roles';
import { ReusableInputField } from '../../components/ReusableInputField';
import { PHONE_MAX_DIGITS, sanitizePhoneInput } from '../../utils/phone';

const USER_CLASS_OPTIONS: { label: string; value: UserClass }[] = [
  { label: 'Initiator — creates records, awaiting approval', value: 'Initiator' },
  { label: 'Authorizer — approves or declines what an Initiator creates', value: 'Authorizer' },
  { label: 'Reviewer — read-only oversight', value: 'Reviewer' },
];

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

type FormState = Omit<CreateStaffInput, 'officeId'> & { officeId: string };

/**
 * Onboard a staff member into one of the viewer's offices, as a role ranked below their own. Unless
 * the viewer is a super admin (who can't use this portal), the new record waits for an Authorizer of
 * the viewer's role before it can sign in.
 */
export function StaffFormPage() {
  const navigate = useNavigate();
  const rolePath = useRolePath();
  const { userType } = useAuth();
  const { me } = useMe();
  const offices = useScopedOffices();
  const roleOptions = isOfficeRole(userType) ? rolesBelow(userType) : [];

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    officeId: '',
    userTypeSlug: roleOptions.length === 1 ? roleOptions[0] : '',
    userClass: 'Initiator',
    gender: 'Unspecified',
    address: '',
    notes: '',
  });

  // Someone who works in one office onboards into it.
  useEffect(() => {
    if (offices.length === 1) setForm((prev) => ({ ...prev, officeId: String(offices[0].id) }));
  }, [offices]);

  const update = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await usersApi.create({
        ...form,
        email: form.email.trim(),
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        officeId: form.officeId ? Number(form.officeId) : null,
      });
      toast.success(
        created.onboardingStatus === 'Pending'
          ? `${ROLE_LABELS[form.userTypeSlug]} onboarded — awaiting authorization before they can sign in.`
          : 'Staff member onboarded.',
      );
      navigate(rolePath(`/staff/${created.id}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to onboard staff member.');
    } finally {
      setSaving(false);
    }
  };

  const cannotInitiate = me && me.userClass !== 'Initiator';

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h1 className="text-xl font-heading font-bold text-primary mb-2">Onboard Staff</h1>
        <p className="text-sm text-gray-500 mb-6">
          They'll get an email with a temporary password. An Authorizer with your role must approve the record before they can sign in.
        </p>

        {cannotInitiate && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <InfoIcon size={16} className="mt-0.5 flex-shrink-0" />
            Only staff with the Initiator class can onboard new staff. Your class is {me?.userClass ?? 'not set'}.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReusableInputField label="First name" name="firstName" value={form.firstName} onChange={update('firstName')} required />
            <ReusableInputField label="Last name" name="lastName" value={form.lastName} onChange={update('lastName')} required />
          </div>

          <ReusableInputField label="Email address" name="email" type="email" value={form.email} onChange={update('email')} required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReusableInputField
              label="Phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              maxLength={PHONE_MAX_DIGITS}
              placeholder="08031234567"
              value={form.phone ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: sanitizePhoneInput(e.target.value) }))}
            />
            <ReusableInputField label="Gender" name="gender" as="select" value={form.gender === 'Unspecified' ? '' : form.gender} onChange={update('gender')} options={GENDER_OPTIONS} />
          </div>

          <ReusableInputField
            label="Office"
            name="officeId"
            as="select"
            value={form.officeId}
            onChange={update('officeId')}
            options={offices.map((o) => ({ label: o.zoneName ? `${o.name} · ${o.zoneName}` : o.name ?? `Office #${o.id}`, value: String(o.id) }))}
            disabled={offices.length === 1}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReusableInputField
              label="Role"
              name="userTypeSlug"
              as="select"
              value={form.userTypeSlug}
              onChange={update('userTypeSlug')}
              options={roleOptions.map((slug) => ({ label: ROLE_LABELS[slug], value: slug }))}
              required
            />
            <ReusableInputField label="Maker-checker class" name="userClass" as="select" value={form.userClass} onChange={update('userClass')} options={USER_CLASS_OPTIONS} required />
          </div>
          <p className="text-xs text-gray-400 -mt-2">You can onboard {roleOptions.map((r) => ROLE_LABELS[r].toLowerCase() + 's').join(', ') || 'no one'} — roles ranked below yours.</p>

          <ReusableInputField label="Address" name="address" as="textarea" value={form.address ?? ''} onChange={update('address')} />
          <ReusableInputField label="Notes" name="notes" as="textarea" value={form.notes ?? ''} onChange={update('notes')} />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => navigate(rolePath('/staff'))} className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.email || !form.firstName || !form.lastName || !form.userTypeSlug || !form.officeId}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-heading font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving && <LoaderIcon size={16} className="animate-spin" />}
              Onboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
