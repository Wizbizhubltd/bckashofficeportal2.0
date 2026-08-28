import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormik } from 'formik';
import {
  XIcon,
  BuildingIcon,
  WalletIcon,
  PencilIcon,
  LandmarkIcon } from
'lucide-react';
import {
  addBankAccountSchema,
  createBranchSchema,
  editBranchSchema,
  fundBranchSchema } from
'../../validators/nonAuthSchemas';
import { ReusableReactSelect, SelectOption } from '../../components/ReusableReactSelect';
import type {
  BranchBankAccount,
  BranchBankAccountPurpose,
} from '../../services/branch-bank-accounts/branch-bank-accounts.service';
import { useAppSelector } from '../../store/hooks';
import type { BranchManagerLookup } from '../../store/slices/lookupsSlice';
export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isCurrent: boolean;
  dateAdded: string;
}
export interface FundingRecord {
  id: string;
  amount: string;
  date: string;
  reference: string;
  transactionReference?: string;
  bankName?: string;
  allocatedBy: string;
  note: string;
}
export interface BranchData {
  id: string;
  name: string;
  code?: string;
  state?: string;
  city?: string;
  address?: string;
  managerId?: string;
  location: string;
  manager: string;
  staff: number;
  fund: string;
  totalFundAllocated?: number;
  activeLoans: number;
  status: string;
  phone: string;
  email: string;
  dateCreated: string;
  totalDisbursed: string;
  repaymentRate: string;
  bankAccounts: BankAccount[];
  fundingHistory: FundingRecord[];
}
function ModalWrapper({
  isOpen,
  onClose,
  children




}: {isOpen: boolean;onClose: () => void;children: React.ReactNode;}) {
  return (
    <AnimatePresence>
      {isOpen &&
      <motion.div
        initial={{
          opacity: 0
        }}
        animate={{
          opacity: 1
        }}
        exit={{
          opacity: 0
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4">
        
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
            y: 10
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 10
          }}
          transition={{
            duration: 0.2
          }}
          className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          
            {children}
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}
function FormField({
  label,
  children,
  required




}: {label: string;children: React.ReactNode;required?: boolean;}) {
  return (
    <div>
      <label className="block text-xs font-body font-medium text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>);

}
const inputClass =
'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
const selectClass =
'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all';

/**
 * Matches CreateBranchDto exactly (name/code/address) — no city/state/phone/
 * email, the real Branch schema has none of those, and no `managerId`
 * either: a branch has no manager field of its own (see
 * BranchManagerAssignment), and — since branch creation is now
 * workflow-mediated (see branchesService.create) — the branch doesn't exist
 * at all until a *different* Admin/SuperAdmin/Approver approves it, so
 * there's no id yet to assign a manager to. Assigning one is a separate
 * step via EditBranchModal once the branch is real.
 */
export interface CreateBranchPayload {
  name: string;
  code: string;
  address: string;
}
// ─── Create Branch Modal ─────────────────────────────────────────
interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBranchPayload) => Promise<void>;
}
export function CreateBranchModal({
  isOpen,
  onClose,
  onSubmit
}: CreateBranchModalProps) {
  const formik = useFormik({
    initialValues: {
      name: '',
      code: '',
      address: '',
    },
    validationSchema: createBranchSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      await onSubmit({
        name: values.name.trim(),
        code: values.code.trim(),
        address: values.address.trim(),
      });

      formik.resetForm();
      onClose();
    }
  });

  function handleClose() {
    formik.resetForm();
    formik.setTouched({});
    onClose();
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose}>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">

        <XIcon size={18} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <BuildingIcon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">
            Propose New Branch
          </h3>
          <p className="text-xs font-body text-gray-500">
            Subject to approval by a different Admin, SuperAdmin, or Approver
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 mb-4">
        This proposes a new branch — it only takes effect once a different Admin, SuperAdmin, or Approver approves
        it. You can assign a manager once it's approved.
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Branch Name" required>
            <input
              id="name"
              name="name"
              type="text"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="e.g. Lekki Phase 1 Branch"
              className={inputClass}
              required />

            {formik.touched.name && formik.errors.name &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.name}</p>
            }
          </FormField>
          <FormField label="Branch Code" required>
            <input
              id="code"
              name="code"
              type="text"
              value={formik.values.code}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="e.g. BCK-LKI"
              className={inputClass}
              required />

            {formik.touched.code && formik.errors.code &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.code}</p>
            }
          </FormField>
        </div>

        <FormField label="Address" required>
          <textarea
            id="address"
            name="address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="e.g. 18 Admiralty Way, Lekki Phase 1"
            rows={3}
            className={`${inputClass} resize-none`}
            required />

          {formik.touched.address && formik.errors.address &&
          <p className="text-xs text-red-600 mt-1">{formik.errors.address}</p>
          }
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">

            Cancel
          </button>
          <button
            type="submit"
            disabled={!formik.isValid || formik.isSubmitting}
            className="px-4 py-2 text-sm font-heading font-bold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

            {formik.isSubmitting ? 'Proposing…' : 'Propose Branch'}
          </button>
        </div>
      </form>
    </ModalWrapper>);

}
// ─── Edit Branch Modal ───────────────────────────────────────────
interface EditBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: BranchData | null;
  onSubmit: (id: string, data: EditBranchPayload) => Promise<void> | void;
}

export interface EditBranchPayload {
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  managerId?: string;
  status: 'Active' | 'Inactive';
}

export function EditBranchModal({
  isOpen,
  onClose,
  branch,
  onSubmit
}: EditBranchModalProps) {
  const managerStaff = useAppSelector((state) => state.lookups.branchManagers);
  const areLookupsLoading = useAppSelector((state) => state.lookups.loading);

  const formik = useFormik({
    initialValues: {
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      managerId: '',
      status: 'Active',
    },
    validationSchema: editBranchSchema,
    validateOnMount: true,
    onSubmit: (values) => {
      if (!branch) return;

      onSubmit(branch.id, {
        name: values.name.trim(),
        code: values.code.trim(),
        address: values.address.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        managerId: values.managerId || undefined,
        status: values.status === 'Active' ? 'Active' : 'Inactive',
      });

      onClose();
    }
  });

  const allBranches = useAppSelector((state) => state.lookups.branches || []);
  const assignedManagerIds = new Set(
    allBranches
      .filter((b: any) => b.id !== branch?.id)
      .map((b: any) => b.managerId)
      .filter((id: string | undefined) => !!id)
  );
  // `managerStaff` (lookups.branchManagers) is already scoped to ACTIVE
  // MANAGER-role staff — see toBranchManagerLookup in lookupsSlice.ts.
  // A manager already assigned to a *different* branch is excluded; the one
  // currently assigned to *this* branch stays selectable (re-selecting it
  // shouldn't require unassigning it first).
  const managerSource = managerStaff.filter(
    (staff: BranchManagerLookup) => !assignedManagerIds.has(staff.id) || staff.id === branch?.managerId,
  );
  const managerOptions: SelectOption[] = managerSource.map((staff) => ({
    label: `${staff.fullName} (${staff.email})`,
    value: staff.id,
  }));

  useEffect(() => {
    if (branch) {
      formik.setValues({
        name: branch.name,
        code: branch.code || '',
        address: branch.address || '',
        phone: branch.phone || '',
        email: branch.email || '',
        managerId: branch.managerId || '',
        status: branch.status === 'Active' ? 'Active' : 'Inactive',
      });
      formik.setTouched({});
    }
  }, [branch]);

  function handleClose() {
    formik.resetForm();
    onClose();
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose}>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
        
        <XIcon size={18} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <PencilIcon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">
            Edit Branch
          </h3>
          <p className="text-xs font-body text-gray-500">
            {branch?.id} — {branch?.name}
          </p>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Branch Name" required>
            <input
              id="name"
              name="name"
              type="text"
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={inputClass}
              required />

            {formik.touched.name && formik.errors.name &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.name}</p>
            }
            
          </FormField>
          <FormField label="Branch Code" required>
            <input
              id="code"
              name="code"
              type="text"
              value={formik.values.code}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={inputClass}
              required />

            {formik.touched.code && formik.errors.code &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.code}</p>
            }
            
          </FormField>
        </div>

        <FormField label="Address" required>
          <textarea
            id="address"
            name="address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            rows={3}
            className={`${inputClass} resize-none`}
            required />

          {formik.touched.address && formik.errors.address &&
          <p className="text-xs text-red-600 mt-1">{formik.errors.address}</p>
          }
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone Number">
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={formik.values.phone}
              onChange={(e) => formik.setFieldValue('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
              onBlur={formik.handleBlur}
              placeholder="08000000000"
              className={inputClass} />

            {formik.touched.phone && formik.errors.phone &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.phone}</p>
            }
          </FormField>
          <FormField label="Email">
            <input
              id="email"
              name="email"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="branch@bckash.com"
              className={inputClass} />

            {formik.touched.email && formik.errors.email &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.email}</p>
            }
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReusableReactSelect
            name="managerId"
            label="Branch Manager (Optional)"
            formik={formik}
            options={managerOptions}
            placeholder="Search and select branch manager"
            isLoading={areLookupsLoading}
            helperText={
              areLookupsLoading
                ? 'Loading eligible managers...'
                : managerOptions.length === 0
                  ? 'No branch manager-level staff found'
                  : undefined
            }
            noOptionsMessage={areLookupsLoading ? 'Loading managers...' : 'No branch manager staff found'}
          />

          <FormField label="Status">
            <select
              id="status"
              name="status"
              value={formik.values.status}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={selectClass}>

              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formik.isValid}
            className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            
            Save Changes
          </button>
        </div>
      </form>
    </ModalWrapper>);

}
// ─── Fund Branch Modal ───────────────────────────────────────────
interface FundBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: BranchData | null;
  /** The branch's currently-active bank account (at most one — see BranchBankAccountsService). null until one exists, which blocks submission entirely. */
  activeBankAccount: BranchBankAccount | null;
  /** Matches RecordBranchFundingDto — amountKobo is already ×100'd from the form's naira input. */
  onSubmit: (
    branchId: string,
    bankAccountId: string,
    amountKobo: number,
    fundedAt: string,
    reference: string,
  ) => Promise<void> | void;
}
export function FundBranchModal({
  isOpen,
  onClose,
  branch,
  activeBankAccount,
  onSubmit
}: FundBranchModalProps) {
  const todayIso = () => new Date().toISOString().split('T')[0];

  const formik = useFormik({
    initialValues: {
      bankAccountId: '',
      amount: '',
      fundedAt: todayIso(),
      reference: '',
    },
    validationSchema: fundBranchSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      if (!branch || !values.bankAccountId) return;

      const amountKobo = Math.round(parseFloat(values.amount.replace(/,/g, '')) * 100);
      await onSubmit(
        branch.id,
        values.bankAccountId,
        amountKobo,
        new Date(values.fundedAt).toISOString(),
        values.reference.trim(),
      );
      formik.resetForm({ values: { bankAccountId: '', amount: '', fundedAt: todayIso(), reference: '' } });
      onClose();
    }
  });

  useEffect(() => {
    if (isOpen) {
      formik.setFieldValue('bankAccountId', activeBankAccount?.id ?? '', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeBankAccount]);

  function handleClose() {
    formik.resetForm({ values: { bankAccountId: '', amount: '', fundedAt: todayIso(), reference: '' } });
    onClose();
  }
  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose}>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">

        <XIcon size={18} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
          <WalletIcon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">
            Record Fund Allocation
          </h3>
          <p className="text-xs font-body text-gray-500">{branch?.name}</p>
        </div>
      </div>

      {branch &&
      <div className="bg-gray-50 rounded-lg p-4 mb-5">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-body text-gray-400">
                Current Fund Balance
              </p>
              <p className="text-xl font-heading font-bold text-primary">
                {branch.fund}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-body text-gray-400">Active Loans</p>
              <p className="text-xl font-heading font-bold text-gray-800">
                {branch.activeLoans}
              </p>
            </div>
          </div>
        </div>
      }

      {activeBankAccount ? (
        <div className="rounded-lg border border-gray-200 px-4 py-3 mb-4">
          <p className="text-xs font-body text-gray-400 mb-1">Funding will be recorded against</p>
          <p className="text-sm font-heading font-bold text-gray-800">
            {activeBankAccount.bankName} · {activeBankAccount.accountNumber}
          </p>
          <p className="text-xs font-body text-gray-500">{activeBankAccount.accountName}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 mb-4">
          This branch has no active bank account yet — add one (or mark an existing one active) before it can be
          funded.
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 mb-4">
        This records head-office funding — it doesn't touch the branch's balance yet. The branch's own current
        manager must verify it before the amount becomes available for disbursement.
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        <FormField label="Amount" required>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body">
              ₦
            </span>
            <input
              id="amount"
              name="amount"
              type="text"
              value={formik.values.amount}
              onChange={(e) =>
              formik.setFieldValue('amount', e.target.value.replace(/[^0-9,]/g, ''))
              }
              onBlur={formik.handleBlur}
              placeholder="Enter amount"
              className={`${inputClass} pl-8`}
              required />

            {formik.touched.amount && formik.errors.amount &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.amount}</p>
            }
          </div>
        </FormField>

        <FormField label="Funded Date" required>
          <input
            id="fundedAt"
            name="fundedAt"
            type="date"
            value={formik.values.fundedAt}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            max={todayIso()}
            className={inputClass}
            required
          />

          {formik.touched.fundedAt && formik.errors.fundedAt &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.fundedAt}</p>
          }
        </FormField>

        <FormField label="Reference (Optional)">
          <input
            id="reference"
            name="reference"
            type="text"
            value={formik.values.reference}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="e.g. NIP-78456392011 or Q3 2026 allocation"
            className={inputClass}
          />

          {formik.touched.reference && formik.errors.reference &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.reference}</p>
          }
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">

            Cancel
          </button>
          <button
            type="submit"
            disabled={!formik.isValid || !activeBankAccount || formik.isSubmitting}
            className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

            {formik.isSubmitting ? 'Funding…' : 'Record Funding'}
          </button>
        </div>
      </form>
    </ModalWrapper>);

}
// ─── Add Bank Account Modal ─────────────────────────────────────
export interface AddBankAccountFormValues {
  bankName: string;
  accountNumber: string;
  accountName: string;
  purpose: BranchBankAccountPurpose;
  isCurrent: boolean;
}
interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  onSubmit: (data: AddBankAccountFormValues) => Promise<void> | void;
}
const BANK_ACCOUNT_PURPOSE_OPTIONS: { value: BranchBankAccountPurpose; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'REPAYMENT_COLLECTION', label: 'Repayment Collection' },
  { value: 'DISBURSEMENT_SOURCE', label: 'Disbursement Source' },
];
export function AddBankAccountModal({
  isOpen,
  onClose,
  branchName,
  onSubmit
}: AddBankAccountModalProps) {
  const formik = useFormik({
    initialValues: {
      bankName: '',
      accountNumber: '',
      accountName: '',
      purpose: 'GENERAL' as BranchBankAccountPurpose,
      isCurrent: true
    },
    validationSchema: addBankAccountSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      await onSubmit({
        bankName: values.bankName.trim(),
        accountNumber: values.accountNumber.trim(),
        accountName: values.accountName.trim(),
        purpose: values.purpose,
        isCurrent: values.isCurrent
      });
      formik.resetForm();
      onClose();
    }
  });

  function handleClose() {
    formik.resetForm();
    onClose();
  }
  return (
    <ModalWrapper isOpen={isOpen} onClose={handleClose}>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
        
        <XIcon size={18} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
          <LandmarkIcon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">
            Add Bank Account
          </h3>
          <p className="text-xs font-body text-gray-500">{branchName}</p>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        <FormField label="Bank Name" required>
          <select
            id="bankName"
            name="bankName"
            value={formik.values.bankName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={selectClass}
            required>
            
            <option value="">Select bank...</option>
            {[
            'First Bank',
            'GTBank',
            'Access Bank',
            'Zenith Bank',
            'UBA',
            'Fidelity Bank',
            'Sterling Bank',
            'Wema Bank',
            'Stanbic IBTC',
            'Polaris Bank'].
            map((b) =>
            <option key={b} value={b}>
                {b}
              </option>
            )}
          </select>

          {formik.touched.bankName && formik.errors.bankName &&
          <p className="text-xs text-red-600 mt-1">{formik.errors.bankName}</p>
          }
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Account Number" required>
            <input
              id="accountNumber"
              name="accountNumber"
              type="text"
              value={formik.values.accountNumber}
              onChange={(e) =>
              formik.setFieldValue('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              onBlur={formik.handleBlur}
              placeholder="0123456789"
              maxLength={10}
              className={inputClass}
              required />

            {formik.touched.accountNumber && formik.errors.accountNumber &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.accountNumber}</p>
            }
          </FormField>
          <FormField label="Account Name" required>
            <input
              id="accountName"
              name="accountName"
              type="text"
              value={formik.values.accountName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="BCKash MFB - Branch Name"
              className={inputClass}
              required />

            {formik.touched.accountName && formik.errors.accountName &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.accountName}</p>
            }
          </FormField>
        </div>

        <FormField label="Purpose" required>
          <select
            id="purpose"
            name="purpose"
            value={formik.values.purpose}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={selectClass}
            required>

            {BANK_ACCOUNT_PURPOSE_OPTIONS.map((option) =>
            <option key={option.value} value={option.value}>
                {option.label}
              </option>
            )}
          </select>

          {formik.touched.purpose && formik.errors.purpose &&
          <p className="text-xs text-red-600 mt-1">{formik.errors.purpose}</p>
          }
        </FormField>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formik.values.isCurrent}
            onChange={(e) => formik.setFieldValue('isCurrent', e.target.checked)}
            className="rounded text-primary focus:ring-primary" />

          <span className="text-sm font-body text-gray-700">
            Set as active account
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-heading font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formik.isValid}
            className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            
            Add Account
          </button>
        </div>
      </form>
    </ModalWrapper>);

}