import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';

interface LoanProductOption {
  id: number;
  name: string | null;
}

interface LoanPurposeOption {
  id: number;
  name: string | null;
}

interface ApplicationFormState {
  clientType: 'Client' | 'Group';
  loanProductId: string;
  loanPurposeId: string;
  officeId: string;
  clientId: string;
  groupId: string;
  amount: string;
  loanTerm: string;
  loanTermType: string;
  notes: string;
}

const EMPTY_FORM: ApplicationFormState = {
  clientType: 'Client',
  loanProductId: '',
  loanPurposeId: '',
  officeId: '',
  clientId: '',
  groupId: '',
  amount: '',
  loanTerm: '',
  loanTermType: 'Months',
  notes: '',
};

export function LoanApplicationFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<ApplicationFormState>(EMPTY_FORM);
  const [products, setProducts] = useState<LoanProductOption[]>([]);
  const [purposes, setPurposes] = useState<LoanPurposeOption[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void apiClient.get<LoanProductOption[]>('/loan-products').then((response) => setProducts(response.data));
    void apiClient.get<LoanPurposeOption[]>('/loan-purposes').then((response) => setPurposes(response.data));
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setLoading(true);
    apiClient
      .get(`/loan-applications/${id}`)
      .then((response) => {
        const a = response.data;
        setForm({
          clientType: a.clientType,
          loanProductId: a.loanProductId?.toString() ?? '',
          loanPurposeId: a.loanPurposeId?.toString() ?? '',
          officeId: a.officeId?.toString() ?? '',
          clientId: a.clientId?.toString() ?? '',
          groupId: a.groupId?.toString() ?? '',
          amount: a.amount?.toString() ?? '',
          loanTerm: a.loanTerm?.toString() ?? '',
          loanTermType: a.loanTermType ?? 'Months',
          notes: a.notes ?? '',
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load application.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clientType: form.clientType,
        loanPurposeId: form.loanPurposeId ? Number(form.loanPurposeId) : null,
        currencyId: null,
        officeId: form.officeId ? Number(form.officeId) : null,
        clientId: form.clientType === 'Client' && form.clientId ? Number(form.clientId) : null,
        groupId: form.clientType === 'Group' && form.groupId ? Number(form.groupId) : null,
        loanProductId: Number(form.loanProductId),
        amount: Number(form.amount),
        loanTerm: form.loanTerm ? Number(form.loanTerm) : null,
        loanTermType: form.loanTermType,
        notes: form.notes || null,
      };

      if (isEditing) {
        await apiClient.put(`/loan-applications/${id}`, payload);
        toast.success('Application updated.');
        navigate(`/admin/loan-applications/${id}`);
      } else {
        const response = await apiClient.post('/loan-applications', payload);
        toast.success('Application created.');
        navigate(`/admin/loan-applications/${response.data.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed — check the amount and term are within the product’s range.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-heading font-bold text-primary mb-6">{isEditing ? 'Edit Loan Application' : 'New Loan Application'}</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applicant Type</label>
            <select
              value={form.clientType}
              onChange={(e) => setForm({ ...form, clientType: e.target.value as 'Client' | 'Group' })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="Client">Client</option>
              <option value="Group">Group</option>
            </select>
          </div>
          {form.clientType === 'Client' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group ID</label>
              <input
                type="text"
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Office ID</label>
            <input
              type="text"
              value={form.officeId}
              onChange={(e) => setForm({ ...form, officeId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
            <select
              value={form.loanProductId}
              onChange={(e) => setForm({ ...form, loanProductId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <select
              value={form.loanPurposeId}
              onChange={(e) => setForm({ ...form, loanPurposeId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="">—</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested Amount</label>
            <input
              type="text"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <input
              type="text"
              value={form.loanTerm}
              onChange={(e) => setForm({ ...form, loanTerm: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term Unit</label>
            <select
              value={form.loanTermType}
              onChange={(e) => setForm({ ...form, loanTermType: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="Days">Days</option>
              <option value="Weeks">Weeks</option>
              <option value="Months">Months</option>
              <option value="Years">Years</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

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
