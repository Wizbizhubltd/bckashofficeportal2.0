import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useRolePath } from '../../../hooks/useRolePath';
import apiClient, { type ApiError } from '../../../api/apiClient';
import { clientsApi } from '../../../api/clientsApi';
import { ClientCodeModal, type SentClientCode } from './ClientCodeModal';
import { ApplicantPicker } from './ApplicantPicker';
import { formatMoney } from '../../../utils/money';
import { sanitizeDecimal, sanitizeWholeNumber } from '../../../utils/numeric';
import { useScopedOffices } from '../../../hooks/useScopedOffices';
import { ACCOUNT_NUMBER_LENGTH, DISBURSEMENT_MODES, payoutProblem, type DisbursementMode } from '../../../utils/disbursement';

interface ClientCodeResponse {
  required: boolean;
  codeId: number | null;
  sentTo: string | null;
  resendAfterSeconds: number;
}

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
  disbursementMode: DisbursementMode | '';
  bankName: string;
  accountNumber: string;
  accountName: string;
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
  disbursementMode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
};

export function LoanApplicationFormPage() {
  const rolePath = useRolePath();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  // "Raise loan" on a client's page opens this with ?clientId=…&officeId=… so the applicant is already chosen.
  const [searchParams] = useSearchParams();
  const presetClientId = isEditing ? null : searchParams.get('clientId');
  const [presetClientName, setPresetClientName] = useState<string | null>(null);
  // Why the client opened from their page can't take a loan (pending, no face captured, loan already open).
  const [presetClientBlocker, setPresetClientBlocker] = useState<string | null>(null);

  const [form, setForm] = useState<ApplicationFormState>(() => ({
    ...EMPTY_FORM,
    clientId: presetClientId ?? '',
    officeId: isEditing ? '' : searchParams.get('officeId') ?? '',
  }));

  useEffect(() => {
    if (!presetClientId) return;
    apiClient
      .get<{ displayName: string | null; firstName: string | null; lastName: string | null; accountNo: string | null; loanBlocker: string | null; activeLoan: string | null }>(
        `/clients/${presetClientId}`,
      )
      .then(({ data }) => {
        setPresetClientName(`${data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ')}${data.accountNo ? ` · A/C ${data.accountNo}` : ''}`);
        setPresetClientBlocker(data.loanBlocker ?? (data.activeLoan ? `This client already has an active loan. ${data.activeLoan}` : null));
      })
      .catch(() => setPresetClientName(null));
  }, [presetClientId]);
  const [products, setProducts] = useState<LoanProductOption[]>([]);
  const [purposes, setPurposes] = useState<LoanPurposeOption[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [sentCode, setSentCode] = useState<SentClientCode | null>(null);
  const [formFee, setFormFee] = useState<number | null>(null);

  const offices = useScopedOffices();

  // The list is already limited to the user's own office(s); someone with just one works in it.
  useEffect(() => {
    if (!isEditing && offices.length === 1) {
      setForm((prev) => ({ ...prev, officeId: prev.officeId || String(offices[0].id) }));
    }
  }, [offices, isEditing]);

  useEffect(() => {
    void apiClient.get<LoanProductOption[]>('/loan-products').then((response) => setProducts(response.data));
    void apiClient.get<LoanPurposeOption[]>('/loan-purposes').then((response) => setPurposes(response.data));
    void clientsApi.applicationFormFee().then(setFormFee);
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
          disbursementMode: a.disbursementMode ?? '',
          bankName: a.disbursementBankName ?? '',
          accountNumber: a.disbursementAccountNumber ?? '',
          accountName: a.disbursementAccountName ?? '',
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load application.'))
      .finally(() => setLoading(false));
  }, [id, isEditing]);

  const buildPayload = () => ({
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
    disbursementMode: form.disbursementMode || null,
    disbursementBankName: form.disbursementMode === 'BankTransfer' ? form.bankName.trim() : null,
    disbursementAccountNumber: form.disbursementMode === 'BankTransfer' ? form.accountNumber.trim() : null,
    disbursementAccountName: form.disbursementMode === 'BankTransfer' ? form.accountName.trim() : null,
  });

  const createApplication = async (clientCode?: { codeId: number; code: string }) => {
    const response = await apiClient.post('/loan-applications', { ...buildPayload(), clientCodeId: clientCode?.codeId ?? null, clientCode: clientCode?.code ?? null });
    toast.success('Application created.');
    navigate(rolePath(`/loan-applications/${response.data.id}`));
  };

  /** Asks the server to text/email the client a code. Null when codes are switched off. */
  const sendClientCode = async (): Promise<SentClientCode | null> => {
    const { data } = await apiClient.post<ClientCodeResponse>('/loan-applications/client-codes', {
      clientId: Number(form.clientId),
      loanProductId: Number(form.loanProductId),
      amount: Number(form.amount),
    });
    return data.required && data.codeId != null ? { codeId: data.codeId, sentTo: data.sentTo, resendAfterSeconds: data.resendAfterSeconds } : null;
  };

  const handleSave = async () => {
    if (!(Number(form.amount) > 0)) {
      toast.error('Enter the requested amount as a number, e.g. 250000.');
      return;
    }
    if (form.loanTerm && !(Number(form.loanTerm) > 0)) {
      toast.error('Enter the term as a whole number, e.g. 24.');
      return;
    }
    const payout = payoutProblem(form.disbursementMode, form.bankName, form.accountNumber, form.accountName);
    if (payout) {
      toast.error(payout);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await apiClient.put(`/loan-applications/${id}`, buildPayload());
        toast.success('Application updated.');
        navigate(rolePath(`/loan-applications/${id}`));
      } else if (form.clientType === 'Client') {
        // When client confirmation codes are on, the client must confirm before it's submitted.
        const sent = await sendClientCode();
        if (sent) {
          setSentCode(sent);
        } else {
          await createApplication();
        }
      } else {
        await createApplication();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed — check the amount and term are within the product’s range.');
    } finally {
      setSaving(false);
    }
  };

  const confirmWithCode = async (code: string): Promise<string | null> => {
    if (!sentCode) return null;
    try {
      await createApplication({ codeId: sentCode.codeId, code });
      setSentCode(null);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not submit the application.';
    }
  };

  const resendClientCode = async (): Promise<string | null> => {
    try {
      const sent = await sendClientCode();
      if (sent) setSentCode(sent);
      return null;
    } catch (error) {
      return (error as ApiError)?.message ?? 'Could not send a new code.';
    }
  };

  const amountLabel = form.amount ? formatMoney(Number(form.amount)) : '';

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
              disabled={!!presetClientId || isEditing}
              value={form.clientType}
              onChange={(e) => setForm({ ...form, clientType: e.target.value as 'Client' | 'Group' })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="Client">Client</option>
              <option value="Group">Group</option>
            </select>
          </div>
          {presetClientId ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <Link to={rolePath(`/clients/${presetClientId}`)} className="block truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-primary hover:underline">
                {presetClientName ?? `Client #${presetClientId}`}
              </Link>
              {presetClientBlocker && <p className="mt-1 text-xs text-red-600">{presetClientBlocker}</p>}
            </div>
          ) : isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{form.clientType}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {form.clientType === 'Client' ? `Client #${form.clientId}` : `Group #${form.groupId}`}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{form.clientType === 'Client' ? 'Client' : 'Group'}</label>
              <ApplicantPicker
                kind={form.clientType}
                value={form.clientType === 'Client' ? form.clientId : form.groupId}
                onChange={(applicantId) => setForm((prev) => (prev.clientType === 'Client' ? { ...prev, clientId: applicantId } : { ...prev, groupId: applicantId }))}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Office</label>
            <select
              value={form.officeId}
              onChange={(e) => setForm({ ...form, officeId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="">Select an office</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name ?? `Office #${office.id}`}
                </option>
              ))}
            </select>
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
              inputMode="decimal"
              placeholder="e.g. 250000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: sanitizeDecimal(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            {!isEditing && formFee !== null && (
              <p className="mt-1 text-xs text-gray-500">The applicant pays a non-refundable application form fee of {formatMoney(formFee)}.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 24"
              value={form.loanTerm}
              onChange={(e) => setForm({ ...form, loanTerm: sanitizeWholeNumber(e.target.value, 4) })}
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

        <div className="border-t border-gray-100 pt-6">
          <h2 className="text-sm font-heading font-bold text-gray-700">Disbursement</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">How the client will receive the money. For a bank transfer, enter the account it should be paid into.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disbursement Method</label>
              <select
                value={form.disbursementMode}
                onChange={(e) => setForm({ ...form, disbursementMode: e.target.value as DisbursementMode | '' })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Choose…</option>
                {DISBURSEMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.disbursementMode === 'BankTransfer' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <input
                  type="text"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="e.g. Access Bank"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={ACCOUNT_NUMBER_LENGTH}
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '').slice(0, ACCOUNT_NUMBER_LENGTH) })}
                  placeholder="10 digits"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>
          )}
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
            disabled={saving || !!presetClientBlocker}
            title={presetClientBlocker ?? undefined}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <ClientCodeModal sent={sentCode} amountLabel={amountLabel} onConfirm={confirmWithCode} onResend={resendClientCode} onClose={() => setSentCode(null)} />
    </div>
  );
}
