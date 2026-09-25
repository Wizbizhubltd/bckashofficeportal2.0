import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';
import { PHONE_MAX_DIGITS, sanitizePhoneInput, toLocalPhone } from '../../../utils/phone';

interface Office {
  id: number;
  name: string | null;
}

interface GroupFormState {
  name: string;
  officeId: string;
  staffId: string;
  joinedDate: string;
  mobile: string;
  phone: string;
  email: string;
  street: string;
  ward: string;
  district: string;
  region: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  officeId: '',
  staffId: '',
  joinedDate: '',
  mobile: '',
  phone: '',
  email: '',
  street: '',
  ward: '',
  district: '',
  region: '',
  address: '',
  notes: '',
};

function field<K extends keyof GroupFormState>(
  form: GroupFormState,
  setForm: (form: GroupFormState) => void,
  key: K,
  label: string,
  type: 'text' | 'date' | 'email' | 'tel' = 'text',
) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        inputMode={type === 'tel' ? 'numeric' : undefined}
        maxLength={type === 'tel' ? PHONE_MAX_DIGITS : undefined}
        placeholder={type === 'tel' ? '08031234567' : undefined}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: type === 'tel' ? sanitizePhoneInput(e.target.value) : e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
    </div>
  );
}

export function GroupFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiClient.get<Office[]>('/offices').then((response) => setOffices(response.data));
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setLoading(true);
    apiClient
      .get(`/groups/${id}`)
      .then((response) => {
        const g = response.data;
        setForm({
          name: g.name ?? '',
          officeId: g.officeId?.toString() ?? '',
          staffId: g.staffId?.toString() ?? '',
          joinedDate: g.joinedDate ?? '',
          mobile: toLocalPhone(g.mobile),
          phone: toLocalPhone(g.phone),
          email: g.email ?? '',
          street: g.street ?? '',
          ward: g.ward ?? '',
          district: g.district ?? '',
          region: g.region ?? '',
          address: g.address ?? '',
          notes: g.notes ?? '',
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load group.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        officeId: form.officeId ? Number(form.officeId) : null,
        name: form.name || null,
        externalId: null,
        staffId: form.staffId ? Number(form.staffId) : null,
        joinedDate: form.joinedDate || null,
        mobile: form.mobile || null,
        phone: form.phone || null,
        email: form.email || null,
        street: form.street || null,
        ward: form.ward || null,
        district: form.district || null,
        region: form.region || null,
        address: form.address || null,
        notes: form.notes || null,
      };

      if (isEditing) {
        await apiClient.put(`/groups/${id}`, payload);
        toast.success('Group updated.');
        navigate(`/admin/groups/${id}`);
      } else {
        const response = await apiClient.post('/groups', payload);
        toast.success('Group created.');
        navigate(`/admin/groups/${response.data.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-heading font-bold text-primary mb-6">{isEditing ? 'Edit Group' : 'Add Group'}</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-8">
        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field(form, setForm, 'name', 'Group Name')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office</label>
              <select
                value={form.officeId}
                onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">—</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {field(form, setForm, 'staffId', 'Staff ID')}
            {field(form, setForm, 'joinedDate', 'Joined Date', 'date')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field(form, setForm, 'mobile', 'Mobile', 'tel')}
            {field(form, setForm, 'phone', 'Phone', 'tel')}
            {field(form, setForm, 'email', 'Email', 'email')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field(form, setForm, 'street', 'Street')}
            {field(form, setForm, 'ward', 'Ward')}
            {field(form, setForm, 'district', 'District')}
            {field(form, setForm, 'region', 'Region')}
            {field(form, setForm, 'address', 'Address Line')}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
