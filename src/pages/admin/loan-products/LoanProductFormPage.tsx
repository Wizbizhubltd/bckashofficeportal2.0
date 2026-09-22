import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient from '../../../api/apiClient';

interface LoanProductFormState {
  name: string;
  shortName: string;
  description: string;
  fundId: string;
  currencyId: string;
  decimals: string;
  minimumPrincipal: string;
  defaultPrincipal: string;
  maximumPrincipal: string;
  minimumLoanTerm: string;
  defaultLoanTerm: string;
  maximumLoanTerm: string;
  repaymentFrequency: string;
  repaymentFrequencyType: string;
  minimumInterestRate: string;
  defaultInterestRate: string;
  maximumInterestRate: string;
  interestRateType: string;
  graceOnInterestCharged: string;
  graceOnPrincipal: string;
  graceOnInterestPayment: string;
  allowCustomGrace: boolean;
  allowStandingInstructions: boolean;
  interestMethod: string;
  amortizationMethod: string;
  interestCalculationPeriodType: string;
  yearDays: string;
  monthDays: string;
  loanTransactionStrategy: string;
  includeInCycle: boolean;
  lockGuarantee: boolean;
  allocateOverpayments: boolean;
  allowAdditionalCharges: boolean;
  accountingRule: string;
  npaDays: string;
  arrearsGraceDays: string;
  npaSuspendIncome: boolean;
  glAccountFundSourceId: string;
  glAccountLoanPortfolioId: string;
  glAccountReceivableInterestId: string;
  glAccountReceivableFeeId: string;
  glAccountReceivablePenaltyId: string;
  glAccountLoanOverPaymentsId: string;
  glAccountSuspendedIncomeId: string;
  glAccountIncomeInterestId: string;
  glAccountIncomeFeeId: string;
  glAccountIncomePenaltyId: string;
  glAccountIncomeRecoveryId: string;
  glAccountLoansWrittenOffId: string;
}

const EMPTY_FORM: LoanProductFormState = {
  name: '', shortName: '', description: '', fundId: '', currencyId: '', decimals: '2',
  minimumPrincipal: '', defaultPrincipal: '', maximumPrincipal: '',
  minimumLoanTerm: '', defaultLoanTerm: '', maximumLoanTerm: '',
  repaymentFrequency: '1', repaymentFrequencyType: 'Months',
  minimumInterestRate: '', defaultInterestRate: '', maximumInterestRate: '', interestRateType: 'Year',
  graceOnInterestCharged: '', graceOnPrincipal: '', graceOnInterestPayment: '',
  allowCustomGrace: false, allowStandingInstructions: false,
  interestMethod: 'Flat', amortizationMethod: 'EqualInstallment',
  interestCalculationPeriodType: 'Same', yearDays: 'Days365', monthDays: 'Days30',
  loanTransactionStrategy: 'InterestPrincipalPenaltyFees',
  includeInCycle: false, lockGuarantee: false, allocateOverpayments: false, allowAdditionalCharges: false,
  accountingRule: 'Cash', npaDays: '', arrearsGraceDays: '', npaSuspendIncome: false,
  glAccountFundSourceId: '', glAccountLoanPortfolioId: '', glAccountReceivableInterestId: '', glAccountReceivableFeeId: '',
  glAccountReceivablePenaltyId: '', glAccountLoanOverPaymentsId: '', glAccountSuspendedIncomeId: '', glAccountIncomeInterestId: '',
  glAccountIncomeFeeId: '', glAccountIncomePenaltyId: '', glAccountIncomeRecoveryId: '', glAccountLoansWrittenOffId: '',
};

function textField<K extends keyof LoanProductFormState>(form: LoanProductFormState, setForm: (f: LoanProductFormState) => void, key: K, label: string) {
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

function selectField<K extends keyof LoanProductFormState>(
  form: LoanProductFormState, setForm: (f: LoanProductFormState) => void, key: K, label: string, options: string[],
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

interface GlAccountOption {
  id: number;
  name: string | null;
  glCode: string | null;
}

/** Same shape as selectField, but options come from GET /gl-accounts (Phase 6) rather than a fixed enum list. */
function glAccountField<K extends keyof LoanProductFormState>(
  form: LoanProductFormState, setForm: (f: LoanProductFormState) => void, key: K, label: string, accounts: GlAccountOption[],
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

function checkboxField<K extends keyof LoanProductFormState>(form: LoanProductFormState, setForm: (f: LoanProductFormState) => void, key: K, label: string) {
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

export function LoanProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<LoanProductFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);

  useEffect(() => {
    apiClient
      .get<GlAccountOption[]>('/gl-accounts')
      .then((response) => setGlAccounts(response.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setLoading(true);
    apiClient
      .get(`/loan-products/${id}`)
      .then((response) => {
        const p = response.data;
        const toText = (v: unknown) => (v === null || v === undefined ? '' : String(v));
        setForm({
          name: toText(p.name), shortName: toText(p.shortName), description: toText(p.description),
          fundId: toText(p.fundId), currencyId: toText(p.currencyId), decimals: toText(p.decimals),
          minimumPrincipal: toText(p.minimumPrincipal), defaultPrincipal: toText(p.defaultPrincipal), maximumPrincipal: toText(p.maximumPrincipal),
          minimumLoanTerm: toText(p.minimumLoanTerm), defaultLoanTerm: toText(p.defaultLoanTerm), maximumLoanTerm: toText(p.maximumLoanTerm),
          repaymentFrequency: toText(p.repaymentFrequency), repaymentFrequencyType: toText(p.repaymentFrequencyType) || 'Months',
          minimumInterestRate: toText(p.minimumInterestRate), defaultInterestRate: toText(p.defaultInterestRate), maximumInterestRate: toText(p.maximumInterestRate),
          interestRateType: toText(p.interestRateType) || 'Year',
          graceOnInterestCharged: toText(p.graceOnInterestCharged), graceOnPrincipal: toText(p.graceOnPrincipal), graceOnInterestPayment: toText(p.graceOnInterestPayment),
          allowCustomGrace: Boolean(p.allowCustomGrace), allowStandingInstructions: Boolean(p.allowStandingInstructions),
          interestMethod: toText(p.interestMethod) || 'Flat', amortizationMethod: toText(p.amortizationMethod) || 'EqualInstallment',
          interestCalculationPeriodType: toText(p.interestCalculationPeriodType) || 'Same',
          yearDays: toText(p.yearDays) || 'Days365', monthDays: toText(p.monthDays) || 'Days30',
          loanTransactionStrategy: toText(p.loanTransactionStrategy) || 'InterestPrincipalPenaltyFees',
          includeInCycle: Boolean(p.includeInCycle), lockGuarantee: Boolean(p.lockGuarantee),
          allocateOverpayments: Boolean(p.allocateOverpayments), allowAdditionalCharges: Boolean(p.allowAdditionalCharges),
          accountingRule: toText(p.accountingRule) || 'Cash', npaDays: toText(p.npaDays), arrearsGraceDays: toText(p.arrearsGraceDays),
          npaSuspendIncome: Boolean(p.npaSuspendIncome),
          glAccountFundSourceId: toText(p.glAccountFundSourceId), glAccountLoanPortfolioId: toText(p.glAccountLoanPortfolioId),
          glAccountReceivableInterestId: toText(p.glAccountReceivableInterestId), glAccountReceivableFeeId: toText(p.glAccountReceivableFeeId),
          glAccountReceivablePenaltyId: toText(p.glAccountReceivablePenaltyId), glAccountLoanOverPaymentsId: toText(p.glAccountLoanOverPaymentsId),
          glAccountSuspendedIncomeId: toText(p.glAccountSuspendedIncomeId), glAccountIncomeInterestId: toText(p.glAccountIncomeInterestId),
          glAccountIncomeFeeId: toText(p.glAccountIncomeFeeId), glAccountIncomePenaltyId: toText(p.glAccountIncomePenaltyId),
          glAccountIncomeRecoveryId: toText(p.glAccountIncomeRecoveryId), glAccountLoansWrittenOffId: toText(p.glAccountLoansWrittenOffId),
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load product.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() === '' ? null : Number(v));
      const payload = {
        name: form.name || null,
        shortName: form.shortName || null,
        description: form.description || null,
        fundId: num(form.fundId),
        currencyId: num(form.currencyId),
        decimals: Number(form.decimals || '2'),
        minimumPrincipal: num(form.minimumPrincipal),
        defaultPrincipal: num(form.defaultPrincipal),
        maximumPrincipal: num(form.maximumPrincipal),
        minimumLoanTerm: num(form.minimumLoanTerm),
        defaultLoanTerm: num(form.defaultLoanTerm),
        maximumLoanTerm: num(form.maximumLoanTerm),
        repaymentFrequency: num(form.repaymentFrequency),
        repaymentFrequencyType: form.repaymentFrequencyType,
        minimumInterestRate: num(form.minimumInterestRate),
        defaultInterestRate: num(form.defaultInterestRate),
        maximumInterestRate: num(form.maximumInterestRate),
        interestRateType: form.interestRateType,
        graceOnInterestCharged: num(form.graceOnInterestCharged),
        graceOnPrincipal: num(form.graceOnPrincipal),
        graceOnInterestPayment: num(form.graceOnInterestPayment),
        allowCustomGrace: form.allowCustomGrace,
        allowStandingInstructions: form.allowStandingInstructions,
        interestMethod: form.interestMethod,
        amortizationMethod: form.amortizationMethod,
        interestCalculationPeriodType: form.interestCalculationPeriodType,
        yearDays: form.yearDays,
        monthDays: form.monthDays,
        loanTransactionStrategy: form.loanTransactionStrategy,
        includeInCycle: form.includeInCycle,
        lockGuarantee: form.lockGuarantee,
        allocateOverpayments: form.allocateOverpayments,
        allowAdditionalCharges: form.allowAdditionalCharges,
        accountingRule: form.accountingRule,
        npaDays: num(form.npaDays),
        arrearsGraceDays: num(form.arrearsGraceDays),
        npaSuspendIncome: form.npaSuspendIncome,
        glAccountFundSourceId: num(form.glAccountFundSourceId),
        glAccountLoanPortfolioId: num(form.glAccountLoanPortfolioId),
        glAccountReceivableInterestId: num(form.glAccountReceivableInterestId),
        glAccountReceivableFeeId: num(form.glAccountReceivableFeeId),
        glAccountReceivablePenaltyId: num(form.glAccountReceivablePenaltyId),
        glAccountLoanOverPaymentsId: num(form.glAccountLoanOverPaymentsId),
        glAccountSuspendedIncomeId: num(form.glAccountSuspendedIncomeId),
        glAccountIncomeInterestId: num(form.glAccountIncomeInterestId),
        glAccountIncomeFeeId: num(form.glAccountIncomeFeeId),
        glAccountIncomePenaltyId: num(form.glAccountIncomePenaltyId),
        glAccountIncomeRecoveryId: num(form.glAccountIncomeRecoveryId),
        glAccountLoansWrittenOffId: num(form.glAccountLoansWrittenOffId),
      };

      if (isEditing) {
        await apiClient.put(`/loan-products/${id}`, payload);
        toast.success('Loan product updated.');
      } else {
        await apiClient.post('/loan-products', payload);
        toast.success('Loan product created.');
      }
      navigate('/admin/loan-products');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed — check that minimum ≤ default ≤ maximum for principal, term, and rate.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-heading font-bold text-primary mb-6">{isEditing ? 'Edit Loan Product' : 'Add Loan Product'}</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-8">
        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Basics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {textField(form, setForm, 'name', 'Name')}
            {textField(form, setForm, 'shortName', 'Short Name')}
            {textField(form, setForm, 'fundId', 'Fund ID')}
            {textField(form, setForm, 'currencyId', 'Currency ID')}
            {textField(form, setForm, 'decimals', 'Decimals')}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Principal, Term & Rate (FR-LN-2: min ≤ default ≤ max)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {textField(form, setForm, 'minimumPrincipal', 'Minimum Principal')}
            {textField(form, setForm, 'defaultPrincipal', 'Default Principal')}
            {textField(form, setForm, 'maximumPrincipal', 'Maximum Principal')}
            {textField(form, setForm, 'minimumLoanTerm', 'Minimum Term')}
            {textField(form, setForm, 'defaultLoanTerm', 'Default Term')}
            {textField(form, setForm, 'maximumLoanTerm', 'Maximum Term')}
            {textField(form, setForm, 'minimumInterestRate', 'Minimum Interest Rate')}
            {textField(form, setForm, 'defaultInterestRate', 'Default Interest Rate')}
            {textField(form, setForm, 'maximumInterestRate', 'Maximum Interest Rate')}
            {selectField(form, setForm, 'interestRateType', 'Interest Rate Period', ['Day', 'Week', 'Month', 'Year'])}
            {textField(form, setForm, 'repaymentFrequency', 'Repayment Frequency')}
            {selectField(form, setForm, 'repaymentFrequencyType', 'Repayment Frequency Unit', ['Days', 'Weeks', 'Months', 'Years'])}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Interest & Amortization</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectField(form, setForm, 'interestMethod', 'Interest Method', ['Flat', 'DecliningBalance'])}
            {selectField(form, setForm, 'amortizationMethod', 'Amortization Method', ['EqualInstallment', 'EqualPrincipal'])}
            {selectField(form, setForm, 'interestCalculationPeriodType', 'Interest Calculation Period', ['Daily', 'Same'])}
            {selectField(form, setForm, 'yearDays', 'Year-Day Convention', ['Actual', 'Days360', 'Days364', 'Days365'])}
            {selectField(form, setForm, 'monthDays', 'Month-Day Convention', ['Actual', 'Days30', 'Days31'])}
            {selectField(form, setForm, 'loanTransactionStrategy', 'Repayment Allocation Strategy', ['PenaltyFeesInterestPrincipal', 'PrincipalInterestPenaltyFees', 'InterestPrincipalPenaltyFees'])}
            {selectField(form, setForm, 'accountingRule', 'Accounting Rule', ['None', 'Cash', 'AccrualPeriodic', 'AccrualUpfront'])}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">Grace Periods & Behavior</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {textField(form, setForm, 'graceOnInterestCharged', 'Grace on Interest Charged')}
            {textField(form, setForm, 'graceOnPrincipal', 'Grace on Principal')}
            {textField(form, setForm, 'graceOnInterestPayment', 'Grace on Interest Payment')}
            {textField(form, setForm, 'npaDays', 'NPA Days')}
            {textField(form, setForm, 'arrearsGraceDays', 'Arrears Grace Days')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {checkboxField(form, setForm, 'allowCustomGrace', 'Allow Custom Grace')}
            {checkboxField(form, setForm, 'allowStandingInstructions', 'Allow Standing Instructions')}
            {checkboxField(form, setForm, 'includeInCycle', 'Include In Cycle')}
            {checkboxField(form, setForm, 'lockGuarantee', 'Lock Guarantee')}
            {checkboxField(form, setForm, 'allocateOverpayments', 'Allocate Overpayments')}
            {checkboxField(form, setForm, 'allowAdditionalCharges', 'Allow Additional Charges')}
            {checkboxField(form, setForm, 'npaSuspendIncome', 'NPA Suspends Income')}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-heading font-bold text-gray-500 uppercase tracking-wide mb-4">GL Mapping (BR-GL-2 — drives Phase 6's automatic posting for this product's loans)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {glAccountField(form, setForm, 'glAccountFundSourceId', 'Fund Source', glAccounts)}
            {glAccountField(form, setForm, 'glAccountLoanPortfolioId', 'Loan Portfolio', glAccounts)}
            {glAccountField(form, setForm, 'glAccountReceivableInterestId', 'Receivable Interest', glAccounts)}
            {glAccountField(form, setForm, 'glAccountReceivableFeeId', 'Receivable Fee', glAccounts)}
            {glAccountField(form, setForm, 'glAccountReceivablePenaltyId', 'Receivable Penalty', glAccounts)}
            {glAccountField(form, setForm, 'glAccountLoanOverPaymentsId', 'Overpayments', glAccounts)}
            {glAccountField(form, setForm, 'glAccountSuspendedIncomeId', 'Suspended Income', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomeInterestId', 'Income Interest', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomeFeeId', 'Income Fee', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomePenaltyId', 'Income Penalty', glAccounts)}
            {glAccountField(form, setForm, 'glAccountIncomeRecoveryId', 'Income Recovery', glAccounts)}
            {glAccountField(form, setForm, 'glAccountLoansWrittenOffId', 'Loans Written Off', glAccounts)}
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
