import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, PowerIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import apiClient, { type ApiError } from '../../api/apiClient';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useLocationOptions } from '../../hooks/useLocationOptions';

interface Office {
  id: number;
  name: string | null;
  parentId: number | null;
  externalId: string | null;
  openingDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  managerId: number | null;
  active: boolean;
  defaultOffice: boolean;
  officeCode: string | null;
  stateId: number | null;
  lgaId: number | null;
  cityId: number | null;
  zoneId: number | null;
  zoneName: string | null;
}

interface OfficeFormState {
  id?: number;
  name: string;
  parentId: number | null;
  defaultOffice: boolean;
  stateId: number | null;
  lgaId: number | null;
  cityId: number | null;
  zoneId: number | null;
}

interface OfficeInUse {
  activeClientCount: number;
  openLoanCount: number;
}

const EMPTY_FORM: OfficeFormState = { name: '', parentId: null, defaultOffice: false, stateId: null, lgaId: null, cityId: null, zoneId: null };

const selectClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-gray-50';

/** Renders the office hierarchy as an indented list — depth from walking each office's ParentId chain. */
function buildDepthMap(offices: Office[]): Map<number, number> {
  const byId = new Map(offices.map((o) => [o.id, o]));
  const depths = new Map<number, number>();

  const depthOf = (id: number, seen = new Set<number>()): number => {
    if (depths.has(id)) {
      return depths.get(id)!;
    }
    const office = byId.get(id);
    if (!office?.parentId || seen.has(id)) {
      depths.set(id, 0);
      return 0;
    }
    const depth = 1 + depthOf(office.parentId, new Set(seen).add(id));
    depths.set(id, depth);
    return depth;
  };

  offices.forEach((o) => depthOf(o.id));
  return depths;
}

export function OfficesAdmin() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<OfficeFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [inUsePrompt, setInUsePrompt] = useState<{ office: Office; counts: OfficeInUse } | null>(null);
  const { states, lgas, cities, zones } = useLocationOptions(form?.stateId ?? null, form?.lgaId ?? null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Office[]>('/offices');
      setOffices(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load offices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const depths = buildDepthMap(offices);
  const sorted = [...offices].sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0));

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      // This form only edits some fields — carry the rest over unchanged instead of clearing them.
      const existing = offices.find((o) => o.id === form.id);
      const payload = {
        name: form.name,
        parentId: form.parentId,
        externalId: existing?.externalId ?? null,
        openingDate: existing?.openingDate ?? null,
        address: existing?.address ?? null,
        phone: existing?.phone ?? null,
        email: existing?.email ?? null,
        notes: existing?.notes ?? null,
        managerId: existing?.managerId ?? null,
        defaultOffice: form.defaultOffice,
        stateId: form.stateId,
        lgaId: form.lgaId,
        cityId: form.cityId,
        zoneId: form.zoneId,
      };

      if (form.id) {
        await apiClient.put(`/offices/${form.id}`, payload);
        toast.success('Office updated.');
      } else {
        await apiClient.post('/offices', payload);
        toast.success('Office created.');
      }
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'A circular parent office was rejected, or the save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (office: Office, confirm = false) => {
    try {
      if (office.active) {
        await apiClient.post(`/offices/${office.id}/deactivate${confirm ? '?confirm=true' : ''}`);
        toast.success('Office deactivated.');
        setInUsePrompt(null);
        await load();
      } else {
        await apiClient.post(`/offices/${office.id}/activate`);
        toast.success('Office reactivated.');
        await load();
      }
    } catch (error) {
      // 409 In-use — ConfirmationModal wasn't shown yet, so surface it now.
      const apiError = error as ApiError;
      if (!confirm && apiError.status === 409 && apiError.responseData) {
        setInUsePrompt({ office, counts: apiError.responseData as OfficeInUse });
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Offices</h1>
          <p className="text-sm text-gray-500 mt-1">Branch/office hierarchy (BR-ORG-1). Deactivating an office in use requires confirmation.</p>
        </div>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Office
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading…</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No offices yet.</td>
              </tr>
            ) : (
              sorted.map((office) => (
                <tr key={office.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    <span style={{ paddingLeft: `${(depths.get(office.id) ?? 0) * 20}px` }}>
                      {(depths.get(office.id) ?? 0) > 0 && '↳ '}
                      {office.name}
                      {office.defaultOffice && <span className="ml-2 text-xs text-primary">(default)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">{office.officeCode ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{office.zoneName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${office.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {office.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() =>
                          setForm({
                            id: office.id,
                            name: office.name ?? '',
                            parentId: office.parentId,
                            defaultOffice: office.defaultOffice,
                            stateId: office.stateId,
                            lgaId: office.lgaId,
                            cityId: office.cityId,
                            zoneId: office.zoneId,
                          })
                        }
                        className="text-gray-400 hover:text-primary"
                        aria-label="Edit"
                      >
                        <PencilIcon size={16} />
                      </button>
                      <button onClick={() => void toggleActive(office)} className="text-gray-400 hover:text-red-600" aria-label="Toggle active">
                        <PowerIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">{form.id ? 'Edit Office' : 'Add Office'}</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Office</label>
                <select
                  value={form.parentId ?? ''}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">— None (top-level) —</option>
                  {offices.filter((o) => o.id !== form.id).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="office-state" className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <select
                    id="office-state"
                    value={form.stateId ?? ''}
                    onChange={(e) => setForm({ ...form, stateId: e.target.value ? Number(e.target.value) : null, lgaId: null, cityId: null })}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    {states.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="office-lga" className="block text-sm font-medium text-gray-700 mb-1">LGA *</label>
                  <select
                    id="office-lga"
                    value={form.lgaId ?? ''}
                    onChange={(e) => setForm({ ...form, lgaId: e.target.value ? Number(e.target.value) : null, cityId: null })}
                    disabled={!form.stateId}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    {lgas.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="office-city" className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <select
                    id="office-city"
                    value={form.cityId ?? ''}
                    onChange={(e) => setForm({ ...form, cityId: e.target.value ? Number(e.target.value) : null })}
                    disabled={!form.lgaId}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    {cities.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="office-zone" className="block text-sm font-medium text-gray-700 mb-1">Zone *</label>
                  <select
                    id="office-zone"
                    value={form.zoneId ?? ''}
                    onChange={(e) => setForm({ ...form, zoneId: e.target.value ? Number(e.target.value) : null })}
                    className={selectClass}
                  >
                    <option value="">Select...</option>
                    {zones.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.lgaId && cities.length === 0 && (
                <p className="text-xs text-gray-500">No cities in this LGA yet — a super admin can add them in the control portal.</p>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.defaultOffice}
                  onChange={(e) => setForm({ ...form, defaultOffice: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                Default office
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !form.name || !form.stateId || !form.lgaId || !form.cityId || !form.zoneId}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={inUsePrompt !== null}
        onClose={() => setInUsePrompt(null)}
        onConfirm={() => inUsePrompt && void toggleActive(inUsePrompt.office, true)}
        title="This office is still in use"
        description={
          inUsePrompt
            ? `${inUsePrompt.counts.activeClientCount} active client(s) and ${inUsePrompt.counts.openLoanCount} open loan(s) are tied to this office. Deactivate anyway?`
            : ''
        }
        icon={<AlertTriangleIcon className="text-amber-600" size={20} />}
        confirmLabel="Deactivate anyway"
        confirmVariant="danger"
      />
    </div>
  );
}
