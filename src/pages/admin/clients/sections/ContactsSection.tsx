import { useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangleIcon, CheckCircle2Icon, LoaderIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { ConfirmationModal } from '../../../../components/ConfirmationModal';
import { ContactPhoto } from '../../../../components/ContactPhoto';
import { clientsApi, type ClientContact as Contact } from '../../../../api/clientsApi';
import { PHONE_MAX_DIGITS, sanitizePhoneInput, toLocalPhone } from '../../../../utils/phone';

type Form = { fullName: string; phone: string; email: string; address: string; relationship: string; occupation: string; gender: string };

const EMPTY: Form = { fullName: '', phone: '', email: '', address: '', relationship: '', occupation: '', gender: '' };

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const CONFIG = {
  guarantors: { singular: 'guarantor', plural: 'Guarantors', minimum: 2, addressRequired: true },
  references: { singular: 'reference', plural: 'References', minimum: 1, addressRequired: false },
} as const;

/**
 * A client's guarantors or references. The client needs at least 2 guarantors and 1 reference before
 * a controller can approve them. Only the staff member who onboarded the client changes them. Each can
 * carry a passport photo, printed on the client's loan form.
 */
export function ContactsSection({ clientId, kind, readOnly, onChange }: { clientId: number; kind: 'guarantors' | 'references'; readOnly: boolean; onChange: () => void }) {
  const config = CONFIG[kind];
  const [items, setItems] = useState<Contact[] | null>(null);
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);

  const load = async () => {
    try {
      setItems((await apiClient.get<Contact[]>(`/clients/${clientId}/${kind}`)).data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to load ${config.plural.toLowerCase()}.`);
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, kind]);

  const remove = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await apiClient.delete(`/clients/${clientId}/${kind}/${target.id}`);
      toast.success(`${target.fullName} removed.`);
      await load();
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Remove failed.');
    }
  };

  if (!items) return <p className="py-10 text-center text-sm text-gray-400">Loading…</p>;

  const short = config.minimum - items.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {short > 0 ? (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangleIcon size={15} />
            {items.length} of the {config.minimum} {config.minimum === 1 ? config.singular : `${config.singular}s`} needed before approval.
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2Icon size={15} />
            Minimum of {config.minimum} met.
          </p>
        )}
        {!readOnly && (
          <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90">
            <PlusIcon size={16} /> Add {config.singular}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No {config.plural.toLowerCase()} yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((contact) => (
            <div key={contact.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <ContactPhoto clientId={clientId} kind={kind} contactId={contact.id} name={contact.fullName} hasPhoto={contact.hasPhoto} version={photoVersion} />
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-gray-800">{contact.fullName}</p>
                    <p className="text-xs text-gray-500">{[contact.relationship, contact.occupation].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(contact)} className="rounded p-1 text-gray-400 hover:text-primary" aria-label="Edit">
                      <PencilIcon size={15} />
                    </button>
                    <button onClick={() => setDeleting(contact)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Remove">
                      <Trash2Icon size={15} />
                    </button>
                  </div>
                )}
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Gender" value={contact.gender ? contact.gender[0].toUpperCase() + contact.gender.slice(1) : null} />
                <Row label="Phone" value={contact.phone} />
                <Row label="Email" value={contact.email} />
                <Row label="Address" value={contact.address} />
              </dl>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ContactModal
          clientId={clientId}
          kind={kind}
          contact={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setPhotoVersion((v) => v + 1);
            void load();
            onChange();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        title={`Remove ${config.singular}`}
        description={`Remove ${deleting?.fullName ?? ''} as a ${config.singular}?`}
        confirmLabel="Remove"
        confirmVariant="danger"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 flex-shrink-0 text-gray-400">{label}</dt>
      <dd className="text-gray-700">{value || '—'}</dd>
    </div>
  );
}

function ContactModal({
  clientId,
  kind,
  contact,
  onClose,
  onSaved,
}: {
  clientId: number;
  kind: 'guarantors' | 'references';
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const config = CONFIG[kind];
  const [form, setForm] = useState<Form>(
    contact
      ? {
          fullName: contact.fullName,
          phone: toLocalPhone(contact.phone),
          email: contact.email ?? '',
          address: contact.address ?? '',
          relationship: contact.relationship ?? '',
          occupation: contact.occupation ?? '',
          gender: contact.gender ?? '',
        }
      : EMPTY,
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setError(null);
    setForm((prev) => ({ ...prev, [field]: field === 'phone' ? sanitizePhoneInput(event.target.value) : event.target.value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.fullName.trim().split(/\s+/).filter(Boolean).length < 2) return setError('Enter the full name — at least a first and last name.');
    if (form.phone.length !== PHONE_MAX_DIGITS) return setError('Enter an 11-digit phone number, e.g. 08031234567.');
    if (!form.relationship.trim()) return setError('Say how they know the client.');
    if (config.addressRequired && !form.address.trim()) return setError("A guarantor's address is required.");
    if (photo && !/\.(jpe?g|png)$/i.test(photo.name)) return setError('Upload the passport photo as a JPG or PNG.');
    if (photo && photo.size > PHOTO_MAX_BYTES) return setError('The photo must be 2 MB or smaller.');

    setSaving(true);
    try {
      const body = {
        ...form,
        email: form.email.trim() || null,
        occupation: form.occupation.trim() || null,
        address: form.address.trim() || null,
        gender: form.gender || null,
      };
      const saved = contact
        ? (await apiClient.put<Contact>(`/clients/${clientId}/${kind}/${contact.id}`, body)).data
        : (await apiClient.post<Contact>(`/clients/${clientId}/${kind}`, body)).data;
      if (photo) {
        // The contact is saved either way; a failed photo can be uploaded again by editing them.
        try {
          await clientsApi.uploadContactPhoto(clientId, kind, saved.id, photo);
        } catch (err) {
          toast.error(`Saved, but the photo didn't upload: ${err instanceof Error ? err.message : 'try again'}.`);
        }
      }
      toast.success(`${form.fullName.trim()} ${contact ? 'updated' : `added as a ${config.singular}`}.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-heading text-base font-bold text-gray-900">{contact ? `Edit ${config.singular}` : `Add ${config.singular}`}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name" required>
            <input className={inputClass} value={form.fullName} onChange={set('fullName')} />
          </Field>
          <Field label="Phone number" required>
            <input className={inputClass} type="tel" inputMode="numeric" maxLength={PHONE_MAX_DIGITS} placeholder="08031234567" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Relationship to client" required>
            <input className={inputClass} value={form.relationship} placeholder="e.g. Brother, Employer" onChange={set('relationship')} />
          </Field>
          <Field label="Occupation">
            <input className={inputClass} value={form.occupation} onChange={set('occupation')} />
          </Field>
          <Field label="Gender">
            <select className={`${inputClass} bg-white`} value={form.gender} onChange={set('gender')}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label={contact?.hasPhoto ? 'Replace passport photo' : 'Passport photo'}>
            <input
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                setError(null);
                setPhoto(e.target.files?.[0] ?? null);
              }}
            />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" required={config.addressRequired}>
              <textarea className={inputClass} rows={2} value={form.address} onChange={set('address')} />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90 disabled:opacity-60">
            {saving && <LoaderIcon size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
