import { useEffect, useRef, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2Icon, DownloadIcon, FileTextIcon, IdCardIcon, LoaderIcon, ReceiptIcon, UploadIcon, XIcon, type LucideIcon } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

type Category = 'nin_slip' | 'utility_bill' | 'id_card';
type IdType = 'drivers_license' | 'international_passport' | 'voters_card';

interface DocumentItem {
  id: number;
  name: string | null;
  size: string | null;
  notes: string | null;
  createdAt: string | null;
  category: Category | null;
  idType: IdType | null;
  idNumber: string | null;
  label: string | null;
}

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';

const ID_TYPES: { value: IdType; label: string }[] = [
  { value: 'drivers_license', label: "Driver's licence" },
  { value: 'international_passport', label: 'International passport' },
  { value: 'voters_card', label: "Voter's card" },
];

const SLOTS: { category: Category; title: string; button: string; numberLabel: string; icon: LucideIcon }[] = [
  { category: 'nin_slip', title: 'NIN slip', button: 'Upload NIN', numberLabel: 'NIN', icon: FileTextIcon },
  { category: 'utility_bill', title: 'Utility bill', button: 'Upload utility bill', numberLabel: 'Account / meter number', icon: ReceiptIcon },
  { category: 'id_card', title: 'ID card', button: 'Upload ID card', numberLabel: 'ID number', icon: IdCardIcon },
];

/** What's wrong with a number before it's sent — the server checks the same things. */
function numberProblem(category: Category, idType: IdType | '', number: string): string | null {
  const value = number.trim();
  if (category === 'nin_slip') return /^\d{11}$/.test(value) ? null : 'A NIN is 11 digits.';
  if (category === 'utility_bill') return value.length >= 3 && value.length <= 30 ? null : 'Enter the account or meter number on the bill.';
  if (!idType) return 'Choose the type of ID.';
  return /^[A-Za-z0-9]{6,20}$/.test(value) ? null : 'Enter the ID number as printed — 6 to 20 letters and digits, no spaces.';
}

function formatSize(size: string | null): string {
  const bytes = Number(size);
  if (!Number.isFinite(bytes)) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The client's documents: a NIN slip, a utility bill and an ID card (driver's licence, international
 * passport or voter's card), each with its number and a picture or PDF of at most 2 MB. Uploading
 * again replaces the previous one. Only the staff member who onboarded the client uploads.
 */
export function DocumentsSection({ clientId, readOnly = false }: { clientId: number; readOnly?: boolean }) {
  const [items, setItems] = useState<DocumentItem[] | null>(null);
  const [uploading, setUploading] = useState<Category | null>(null);

  const load = async () => {
    try {
      setItems((await apiClient.get<DocumentItem[]>(`/clients/${clientId}/documents`)).data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load documents.');
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const download = async (item: DocumentItem) => {
    try {
      const response = await apiClient.get(`/clients/${clientId}/documents/${item.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name ?? 'document';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.');
    }
  };

  if (!items) return <p className="py-10 text-center text-sm text-gray-400">Loading…</p>;

  const older = items.filter((d) => d.category === null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const doc = items.find((d) => d.category === slot.category);
          return (
            <div key={slot.category} className={`flex flex-col rounded-xl border p-4 ${doc ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <slot.icon size={18} />
                </span>
                <h4 className="flex-1 font-heading text-sm font-bold text-gray-800">{slot.title}</h4>
                {doc && <CheckCircle2Icon size={18} className="text-emerald-600" />}
              </div>

              {doc ? (
                <dl className="mt-3 flex-1 space-y-1 text-sm">
                  {slot.category === 'id_card' && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-400">Type</dt>
                      <dd className="font-medium text-gray-800">{doc.label}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-400">{slot.numberLabel}</dt>
                    <dd className="font-medium text-gray-800">{doc.idNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-400">Uploaded</dt>
                    <dd className="text-gray-700">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-NG') : '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 flex-1 text-sm text-gray-400">Not uploaded yet.</p>
              )}

              <div className="mt-4 flex gap-2">
                {doc && (
                  <button onClick={() => void download(doc)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    <DownloadIcon size={14} /> {formatSize(doc.size) || 'Download'}
                  </button>
                )}
                {!readOnly && (
                  <button
                    onClick={() => setUploading(slot.category)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                  >
                    <UploadIcon size={14} /> {doc ? 'Replace' : slot.button}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {older.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-heading font-bold uppercase tracking-widest text-gray-400">Earlier uploads</h4>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {older.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <FileTextIcon size={14} className="text-gray-400" /> {item.name}
                </span>
                <button onClick={() => void download(item)} className="text-gray-400 hover:text-primary" aria-label="Download">
                  <DownloadIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploading && (
        <UploadModal
          clientId={clientId}
          slot={SLOTS.find((s) => s.category === uploading)!}
          onClose={() => setUploading(null)}
          onUploaded={() => {
            setUploading(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  clientId,
  slot,
  onClose,
  onUploaded,
}: {
  clientId: number;
  slot: (typeof SLOTS)[number];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [idType, setIdType] = useState<IdType | ''>('');
  const [number, setNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isId = slot.category === 'id_card';

  const chooseFile = (chosen: File | undefined) => {
    setError(null);
    if (!chosen) return;
    if (!/\.(jpe?g|png|pdf)$/i.test(chosen.name)) {
      setError('Choose a picture (JPG or PNG) or a PDF.');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError(`That file is ${(chosen.size / 1024 / 1024).toFixed(1)} MB — the limit is 2 MB.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setFile(chosen);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = numberProblem(slot.category, idType, number);
    if (problem) return setError(problem);
    if (!file) return setError('Choose the file to upload.');

    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', slot.category);
      form.append('idNumber', number.trim());
      if (isId) form.append('idType', idType);
      await apiClient.post(`/clients/${clientId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${slot.title} uploaded.`);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={slot.button}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-heading text-base font-bold text-gray-900">{slot.button}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isId && (
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-gray-600">
                Type of ID <span className="text-red-500">*</span>
              </span>
              <select value={idType} onChange={(e) => setIdType(e.target.value as IdType | '')} className={`${inputClass} bg-white`}>
                <option value="">Select…</option>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(!isId || idType) && (
            <>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-gray-600">
                  {isId ? `${ID_TYPES.find((t) => t.value === idType)?.label} number` : slot.numberLabel} <span className="text-red-500">*</span>
                </span>
                <input
                  className={inputClass}
                  value={number}
                  inputMode={slot.category === 'nin_slip' ? 'numeric' : undefined}
                  maxLength={slot.category === 'nin_slip' ? 11 : 30}
                  placeholder={slot.category === 'nin_slip' ? '11-digit NIN' : undefined}
                  onChange={(e) => {
                    setError(null);
                    setNumber(slot.category === 'nin_slip' ? e.target.value.replace(/\D/g, '') : e.target.value);
                  }}
                />
              </label>

              <div className="space-y-1">
                <span className="block text-xs font-medium text-gray-600">
                  {isId ? 'ID file' : `${slot.title} file`} <span className="text-red-500">*</span>
                </span>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 hover:border-primary/40">
                  <UploadIcon size={18} className="text-gray-400" />
                  <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${formatSize(String(file.size))}` : 'Choose a picture or PDF (max 2 MB)'}</span>
                  <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => chooseFile(e.target.files?.[0])} />
                </label>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-heading font-bold text-white hover:bg-accent/90 disabled:opacity-60">
            {saving && <LoaderIcon size={16} className="animate-spin" />}
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}
