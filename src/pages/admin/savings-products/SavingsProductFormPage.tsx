import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';

interface SavingsProductFormState {
  name: string;
  shortName: string;
  description: string;
  currencyId: string;
  decimals: string;
  interestRate: string;
  allowOverdraft: boolean;
  minimumBalance: string;
  interestCompoundingPeriod: string;
  interestPostingPeriod: string;
  interestCalculationType: string;
  allowTransferWithdrawalFee: boolean;
  openingBalance: string;
  allowAdditionalCharges: boolean;
  yearDays: string;
  accountingRule: string;
  glAccountSavingsReferenceId: string;
  glAccountOverdraftPortfolioId: string;
  glAccountSavingsControlId: string;
  glAccountInterestOnSavingsId: string;
  glAccountSavingsWrittenOffId: string;
  glAccountIncomeInterestId: string;
  glAccountIncomeFeeId: string;
  glAccountIncomePenaltyId: string;
}

const EMPTY_FORM: SavingsProductFormState = {
  name: '', shortName: '', description: '', currencyId: '', decimals: '2',
  interestRate: '', allowOverdraft: false, minimumBalance: '',
  interestCompoundingPeriod: 'Monthly', interestPostingPeriod: 'Monthly', interestCalculationType: 'Daily',
  allowTransferWithdrawalFee: false, openingBalance: '0', allowAdditionalCharges: false,
  yearDays: 'Days365', accountingRule: 'Cash',
  glAccountSavingsReferenceId: '', glAccountOverdraftPortfolioId: '', glAccountSavingsControlId: '',
  glAccountInterestOnSavingsId: '', glAccountSavingsWrittenOffId: '', glAccountIncomeInterestId: '',
  glAccountIncomeFeeId: '', glAccountIncomePenaltyId: '',
};

interface GlAccountOption {
  id: number;
  name: string | null;
  glCode: string | null;
}

function textField<K extends keyof SavingsProductFormState>(form: SavingsProductFormState, setForm: (f: SavingsProductFormState) => void, key: K, label: string) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
    </div>
  );
}

function selectField<K extends keyof SavingsProductFormState>(
  form: SavingsProductFormState, setForm: (f: SavingsProductFormState) => void, key: K, label: string, options: string[],
) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function checkboxField<K extends keyof SavingsProductFormState>(form: SavingsProductFormState, setForm: (f: SavingsProductFormState) => void, key: K, label: string) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={form[key] as boolean}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        className="rounded text-primary focus:ring-primary"
      />
      {label}
    </label>
  );
}

function glAccountField<K extends keyof SavingsProductFormState>(
  form: SavingsProductFormState, setForm: (f: SavingsProductFormState) => void, key: K, label: string, accounts: GlAccountOption[],
) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      >
        <option value="">— Not mapped —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.glCode ? `${a.glCode} — ${a.name}` : a.name}</option>
        ))}
      </select>
    </div>
  );
}

export function SavingsProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<SavingsProductFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);

  useEffect(() => {
    apiClient.get<GlAccountOption[]>('/gl-accounts').then((response) => setGlAccounts(response.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setLoading(true);
    apiClient
      .get(`/savings-products/${id}`)
      .then((response) => {
        const p = response.data;
        const toText = (v: unknown) => (v === null || v === undefined ? '' : String(v));
        setForm({
          name: toText(p.name), shortName: toText(p.shortName), description: toText(p.description),
          currencyId: toText(p.currencyId), decimals: toText(p.decimals),
          interestRate: toText(p.interestRate), allowOverdraft: Boolean(p.allowOverdraft), minimumBalance: toText(p.minimumBalance),
          interestCompoundingPeriod: toText(p.interestCompoundingPeriod) || 'Monthly',
          interestPostingPeriod: toText(p.interestPostingPeriod) || 'Monthly',
          interestCalculationType: toText(p.interestCalculationType) || 'Daily',
          allowTransferWithdrawalFee: Boolean(p.allowTransferWithdrawalFee), openingBalance: toText(p.openingBalance),
          allowAdditionalCharges: Boolean(p.allowAdditionalCharges),
          yearDays: toText(p.yearDays) || 'Days365', accountingRule: toText(p.accountingRule) || 'Cash',
          glAccountSavingsReferenceId: toText(p.glAccountSavingsReferenceId), glAccountOverdraftPortfolioId: toText(p.glAccountOverdraftPortfolioId),
          glAccountSavingsControlId: toText(p.glAccountSavingsControlId), glAccountInterestOnSavingsId: toText(p.glAccountInterestOnSavingsId),
          glAccountSavingsWrittenOffId: toText(p.glAccountSavingsWrittenOffId), glAccountIncomeInterestId: toText(p.glAccountIncomeInterestId),
          glAccountIncomeFeeId: toText(p.glAccountIncomeFeeId), glAccountIncomePenaltyId: toText(p.glAccountIncomePenaltyId),
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const num = (v: string) => (v === '' ? null : Number(v));
      const payload = {
        name: form.name || null,
        shortName: form.shortName || null,
        description: form.description || null,
        currencyId: num(form.currencyId),
        decimals: Number(form.decimals) || 2,
        interestRate: num(form.interestRate),
        allowOverdraft: form.allowOverdraft,
        minimumBalance: num(form.minimumBalance),
        interestCompoundingPeriod: form.interestCompoundingPeriod,
        interestPostingPeriod: form.interestPostingPeriod,
        interestCalculationType: form.interestCalculationType,
        allowTransferWithdrawalFee: form.allowTransferWithdrawalFee,
        openingBalance: num(form.openingBalance),
        allowAdditionalCharges: form.allowAdditionalCharges,
        yearDays: form.yearDays,
        accountingRule: form.accountingRule,
        glAccountSavingsReferenceId: num(form.glAccountSavingsReferenceId),
        glAccountOverdraftPortfolioId: num(form.glAccountOverdraftPortfolioId),
        glAccountSavingsControlId: num(form.glAccountSavingsControlId),
        glAccountInterestOnSavingsId: num(form.glAccountInterestOnSavingsId),
        glAccountSavingsWrittenOffId: num(form.glAccountSavingsWrittenOffId),
        glAccountIncomeInterestId: num(form.glAccountIncomeInterestId),
        glAccountIncomeFeeId: num(form.glAccountIncomeFeeId),
        glAccountIncomePenaltyId: num(form.glAccountIncomePenaltyId),
      };

      if (isEditing) {
        await apiClient.put(`/savings-products/${id}`, payload);
        toast.success('Savings product updated.');
      } else {
        await apiClient.post('/savings-products', payload);
        toast.success('Savings product created.');
      }
      navigate('/admin/savings-products');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading…</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-heading font-bold text-primary mb-6">{isEditing ? 'Edit Savings Product' : 'Add Savings Product'}</h1>

      <div className="space-y-8 max-w-4xl">
        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Basics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {textField(form, setForm, 'name', 'Name')}
            {textField(form, setForm, 'shortName', 'Short Name')}
            {textField(form, setForm, 'description', 'Description')}
            {textField(form, setForm, 'currencyId', 'Currency ID')}
            {textField(form, setForm, 'decimals', 'Decimals')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Interest & Balance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {textField(form, setForm, 'interestRate', 'Interest Rate (%)')}
            {textField(form, setForm, 'minimumBalance', 'Minimum Balance')}
            {textField(form, setForm, 'openingBalance', 'Default Opening Balance')}
            {selectField(form, setForm, 'interestCompoundingPeriod', 'Compounding Period', ['Daily', 'Monthly', 'Quarterly', 'Biannual', 'Annually'])}
            {selectField(form, setForm, 'interestPostingPeriod', 'Posting Period', ['Monthly', 'Quarterly', 'Biannual', 'Annually'])}
            {selectField(form, setForm, 'interestCalculationType', 'Calculation Type', ['Daily', 'Average'])}
            {selectField(form, setForm, 'yearDays', 'Year Days', ['Days360', 'Days365'])}
            {selectField(form, setForm, 'accountingRule', 'Accounting Rule', ['None', 'Cash'])}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {checkboxField(form, setForm, 'allowOverdraft', 'Allow Overdraft')}
            {checkboxField(form, setForm, 'allowTransferWithdrawalFee', 'Allow Transfer Withdrawal Fee')}
            {checkboxField(form, setForm, 'allowAdditionalCharges', 'Allow Additional Charges')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">GL Mapping (BR-GL-2 — drives Phase 7's automatic posting for this product's accounts)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {glAccountField(form, setForm, 'glAccountSavingsReferenceId', 'Savings Reference (cash/fund side)', glAccounts)}
            {glAccountField(form, setForm, 'glAccountSavingsControlId', 'Savings Control (liability side)', glAccounts)}
            {glAccountField(form, setForm, 'glAccountOverdraftPortfolioId', 'Overdraft Portfolio', glAccounts)}
            {glAccountField(form, setForm, 'glAccountInterestOnSavingsId', 'Interest On Savings (expense)', glAccounts)}
            {glAccountField(form, setForm, 'glAccountSavingsWrittenOffId', 'Savings Written Off', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomeInterestId', 'Income Interest (overdraft)', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomeFeeId', 'Income Fee', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomePenaltyId', 'Income Penalty', glAccounts)}
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
