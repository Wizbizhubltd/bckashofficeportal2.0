import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';
import type { ClientType } from './ClientsListPage';
import { PHONE_MAX_DIGITS, sanitizePhoneInput, toLocalPhone } from '../../../utils/phone';

interface Office {
  id: number;
  name: string | null;
}

interface ClientFormState {
  clientType: ClientType;
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  incorporationNumber: string;
  displayName: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  bvn: string;
  mobile: string;
  phone: string;
  email: string;
  occupation: string;
  officeId: string;
  staffId: string;
  street: string;
  ward: string;
  district: string;
  region: string;
  address: string;
  postalCode: string;
  country: string;
  state: string;
  city: string;
  joinedDate: string;
}

const EMPTY_FORM: ClientFormState = {
  clientType: 'Individual',
  title: '',
  firstName: '',
  middleName: '',
  lastName: '',
  incorporationNumber: '',
  displayName: '',
  dob: '',
  gender: '',
  maritalStatus: '',
  bvn: '',
  mobile: '',
  phone: '',
  email: '',
  occupation: '',
  officeId: '',
  staffId: '',
  street: '',
  ward: '',
  district: '',
  region: '',
  address: '',
  postalCode: '',
  country: '',
  state: '',
  city: '',
  joinedDate: '',
};

function field<K extends keyof ClientFormState>(
  form: ClientFormState,
  setForm: (form: ClientFormState) => void,
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

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
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
      .get(`/clients/${id}`)
      .then((response) => {
        const c = response.data;
        setForm({
          clientType: c.clientType ?? 'Individual',
          title: c.title ?? '',
          firstName: c.firstName ?? '',
          middleName: c.middleName ?? '',
          lastName: c.lastName ?? '',
          incorporationNumber: c.incorporationNumber ?? '',
          displayName: c.displayName ?? '',
          dob: c.dob ?? '',
          gender: c.gender ?? '',
          maritalStatus: c.maritalStatus ?? '',
          bvn: c.bvn ?? '',
          mobile: toLocalPhone(c.mobile),
          phone: toLocalPhone(c.phone),
          email: c.email ?? '',
          occupation: c.occupation ?? '',
          officeId: c.officeId?.toString() ?? '',
          staffId: c.staffId?.toString() ?? '',
          street: c.street ?? '',
          ward: c.ward ?? '',
          district: c.district ?? '',
          region: c.region ?? '',
          address: c.address ?? '',
          postalCode: c.postalCode ?? '',
          country: c.country ?? '',
          state: c.state ?? '',
          city: c.city ?? '',
          joinedDate: c.joinedDate ?? '',
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load client.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        bvn: form.bvn || null,
        countryId: null,
        officeId: form.officeId ? Number(form.officeId) : null,
        staffId: form.staffId ? Number(form.staffId) : null,
        referredById: null,
        externalId: null,
        title: form.title || null,
        firstName: form.firstName || null,
        middleName: form.middleName || null,
        lastName: form.lastName || null,
        fullName: [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || null,
        incorporationNumber: form.incorporationNumber || null,
        displayName: form.displayName || [form.firstName, form.lastName].filter(Boolean).join(' ') || null,
        picture: null,
        mobile: form.mobile || null,
        phone: form.phone || null,
        email: form.email || null,
        gender: form.gender || null,
        clientType: form.clientType,
        maritalStatus: form.maritalStatus || null,
        dob: form.dob || null,
        street: form.street || null,
        ward: form.ward || null,
        district: form.district || null,
        region: form.region || null,
        address: form.address || null,
        joinedDate: form.joinedDate || null,
        occupation: form.occupation || null,
        postalCode: form.postalCode || null,
        country: form.country || null,
        state: form.state || null,
        city: form.city || null,
      };

      if (isEditing) {
        await apiClient.put(`/clients/${id}`, payload);
        toast.success('Client updated.');
        navigate(`/admin/clients/${id}`);
      } else {
        const response = await apiClient.post('/clients', payload);
        toast.success('Client created.');
        navigate(`/admin/clients/${response.data.id}`);
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
    <div className="max-w-4xl">
      <h1 className="text-xl font-heading font-bold text-primary mb-6">{isEditing ? 'Edit Client' : 'Add Client'}</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-8">
        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
              <select
                value={form.clientType}
                onChange={(e) => setForm({ ...form, clientType: e.target.value as ClientType })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="Individual">Individual</option>
                <option value="Business">Business</option>
                <option value="Ngo">NGO</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {field(form, setForm, 'title', 'Title')}
            {field(form, setForm, 'firstName', form.clientType === 'Individual' ? 'First Name' : 'Business Name')}
            {form.clientType === 'Individual' && field(form, setForm, 'middleName', 'Middle Name')}
            {form.clientType === 'Individual' && field(form, setForm, 'lastName', 'Last Name')}
            {form.clientType !== 'Individual' && field(form, setForm, 'incorporationNumber', 'Incorporation Number')}
            {field(form, setForm, 'displayName', 'Display Name')}
            {form.clientType === 'Individual' && field(form, setForm, 'dob', 'Date of Birth', 'date')}
            {form.clientType === 'Individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
            {form.clientType === 'Individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                <select
                  value={form.maritalStatus}
                  onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">—</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
            )}
            {field(form, setForm, 'occupation', 'Occupation')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Contact & KYC</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field(form, setForm, 'bvn', 'BVN')}
            {field(form, setForm, 'mobile', 'Mobile', 'tel')}
            {field(form, setForm, 'phone', 'Phone', 'tel')}
            {field(form, setForm, 'email', 'Email', 'email')}
            {field(form, setForm, 'joinedDate', 'Joined Date', 'date')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Office & Staff</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {field(form, setForm, 'street', 'Street')}
            {field(form, setForm, 'ward', 'Ward')}
            {field(form, setForm, 'district', 'District')}
            {field(form, setForm, 'region', 'Region')}
            {field(form, setForm, 'city', 'City')}
            {field(form, setForm, 'state', 'State')}
            {field(form, setForm, 'country', 'Country')}
            {field(form, setForm, 'postalCode', 'Postal Code')}
            {field(form, setForm, 'address', 'Address Line')}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
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
