import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { ConfirmationModal } from '../../components/ConfirmationModal';

const PRODUCTS = ['Loan', 'Savings', 'Shares', 'Client'] as const;
const CHARGE_TYPES = [
  'Disbursement', 'DisbursementRepayment', 'SpecifiedDueDate', 'InstallmentFee', 'OverdueInstallmentFee',
  'LoanReschedulingFee', 'OverdueMaturity', 'SavingsActivation', 'WithdrawalFee', 'AnnualFee', 'MonthlyFee',
  'Activation', 'SharesPurchase', 'SharesRedeem',
] as const;
const CHARGE_OPTIONS = [
  'Flat', 'Percentage', 'InstallmentPrincipalDue', 'InstallmentPrincipalInterestDue', 'InstallmentInterestDue',
  'InstallmentTotalDue', 'TotalDue', 'PrincipalDue', 'InterestDue', 'TotalOutstanding', 'OriginalPrincipal',
] as const;

interface Charge {
  id: number;
  name: string | null;
  product: string;
  chargeType: string;
  chargeOption: string;
  chargeFrequency: number;
  chargeFrequencyType: string;
  chargeFrequencyAmount: number;
  amount: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  chargePaymentMode: string;
  active: boolean;
  penalty: boolean;
  override: boolean;
  glAccountIncomeId: number | null;
}

type ChargeForm = Omit<Charge, 'id' | 'active'> & { id?: number };

const EMPTY_FORM: ChargeForm = {
  name: '',
  product: 'Loan',
  chargeType: 'Disbursement',
  chargeOption: 'Flat',
  chargeFrequency: 0,
  chargeFrequencyType: 'Days',
  chargeFrequencyAmount: 0,
  amount: null,
  minimumAmount: null,
  maximumAmount: null,
  chargePaymentMode: 'Regular',
  penalty: false,
  override: false,
  glAccountIncomeId: null,
};

export function ChargesAdmin() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ChargeForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Charge[]>('/charges');
      setCharges(response.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load charges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await apiClient.put(`/charges/${form.id}`, form);
        toast.success('Charge updated.');
      } else {
        await apiClient.post('/charges', form);
        toast.success('Charge created.');
      }
      setForm(null);
      await load();
    } catch (error) {
      // The server validates the product/charge_type/charge_option combination (ChargeValidationRules) —
      // its message names exactly which pairing was rejected.
      toast.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await apiClient.delete(`/charges/${deleteTarget.id}`);
      toast.success('Charge deactivated.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Charges</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fees and penalties scoped to loan/savings/shares/client (FR-ORG-5). Product/type/option combinations are
            validated server-side.
          </p>
        </div>
        <button
          onClick={() => setForm(EMPTY_FORM)}
          className="flex items-center gap-2 bg-accent hover:bg-[#e64a19] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusIcon size={16} />
          Add Charge
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Option</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading…</td></tr>
            ) : charges.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No charges yet.</td></tr>
            ) : (
              charges.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.product}</td>
                  <td className="px-4 py-3 text-gray-700">{c.chargeType}</td>
                  <td className="px-4 py-3 text-gray-700">{c.chargeOption}</td>
                  <td className="px-4 py-3 text-gray-700">{c.amount ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setForm({ ...c })} className="text-gray-400 hover:text-primary" aria-label="Edit">
                        <PencilIcon size={16} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-red-600" aria-label="Deactivate">
                        <TrashIcon size={16} />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-primary">{form.id ? 'Edit Charge' : 'Add Charge'}</h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <Select label="Product" value={form.product} options={PRODUCTS} onChange={(v) => setForm({ ...form, product: v })} />
              <Select label="Charge Type" value={form.chargeType} options={CHARGE_TYPES} onChange={(v) => setForm({ ...form, chargeType: v })} />
              <Select label="Charge Option" value={form.chargeOption} options={CHARGE_OPTIONS} onChange={(v) => setForm({ ...form, chargeOption: v })} />
              <Select
                label="Payment Mode"
                value={form.chargePaymentMode}
                options={['Regular', 'AccountTransfer']}
                onChange={(v) => setForm({ ...form, chargePaymentMode: v })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  value={form.amount ?? ''}
                  onChange={(e) => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <Select label="Frequency Type" value={form.chargeFrequencyType} options={['Days', 'Weeks', 'Months', 'Years']} onChange={(v) => setForm({ ...form, chargeFrequencyType: v })} />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.penalty} onChange={(e) => setForm({ ...form, penalty: e.target.checked })} className="rounded text-primary focus:ring-primary" />
                Penalty
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.override} onChange={(e) => setForm({ ...form, override: e.target.checked })} className="rounded text-primary focus:ring-primary" />
                Overridable
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
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
      )}

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Deactivate this charge?"
        description="Charges already in use on a product are deactivated, not deleted (FR-ORG-5)."
        icon={<AlertTriangleIcon className="text-red-600" size={20} />}
        confirmLabel="Deactivate"
        confirmVariant="danger"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
