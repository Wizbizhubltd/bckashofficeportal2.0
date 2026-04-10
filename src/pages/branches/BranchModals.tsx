import React, { useEffect, useState } from 'react';
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
import { api } from '../../app/api';
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
  organizationId?: string;
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

type OptionItem = {
  id: string;
  name: string;
};

async function fetchStateLgaOptions(stateName: string): Promise<OptionItem[]> {
  try {
    const response = await api.get(`/locations/states/${encodeURIComponent(stateName)}/local-governments`);
    const source = response as {
      data?: { localGovernments?: unknown };
      payload?: { localGovernments?: unknown };
    };

    const lgaList =
      (Array.isArray(source.data?.localGovernments) ? source.data?.localGovernments : undefined) ??
      (Array.isArray(source.payload?.localGovernments) ? source.payload?.localGovernments : undefined) ??
      [];

    return lgaList
      .filter((item): item is string => typeof item === 'string')
      .map((name) => ({ id: name, name }));
  } catch {
    return [];
  }
}

export interface CreateBranchPayload {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
  email?: string;
  managerId?: string;
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
  const lookupStates = useAppSelector((state) => state.lookups.states);
  const managerStaff = useAppSelector((state) => state.lookups.branchManagers);
  const allBranches = useAppSelector((state) => state.lookups.branches || []);
  // Get managerIds already assigned to a branch
  const assignedManagerIds = new Set(
    allBranches
      .map((b: any) => b.managerId)
      .filter((id: string | undefined) => !!id)
  );
  const areLookupsLoading = useAppSelector((state) => state.lookups.loading);
  const [localGovernments, setLocalGovernments] = useState<OptionItem[]>([]);
  const [isLoadingLgas, setIsLoadingLgas] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: '',
      code: '',
      state: '',
      city: '',
      address: '',
      phone: '',
      email: '',
      managerId: ''
    },
    validationSchema: createBranchSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      await onSubmit({
        name: values.name.trim(),
        code: values.code.trim()+ Math.floor(100 + Math.random() * 900).toString(),
        state: values.state,
        city: values.city,
        address: values.address.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        managerId: values.managerId || undefined,
      });

      formik.resetForm();
      setLocalGovernments([]);
      onClose();
    }
  });

  const stateOptions: SelectOption[] = lookupStates.map((state) => ({ label: state.name, value: state.name }));
  const lgaOptions: SelectOption[] = localGovernments.map((item) => ({ label: item.name, value: item.name }));
  const managerOptions: SelectOption[] = managerStaff
    .filter((staff: BranchManagerLookup) => !assignedManagerIds.has(staff.id))
    .map((staff: BranchManagerLookup) => ({
      label: `${staff.fullName} (${staff.email})`,
      value: staff.id,
    }));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadBaseOptions = async () => {
      return;
    };

    loadBaseOptions();
  }, [isOpen]);

  useEffect(() => {
    if (!formik.values.state) {
      setLocalGovernments([]);
      if (formik.values.city) {
        formik.setFieldValue('city', '');
      }
      return;
    }

    const loadLgas = async () => {
      setIsLoadingLgas(true);
      const lgaOptions = await fetchStateLgaOptions(formik.values.state);
      setLocalGovernments(lgaOptions);
      setIsLoadingLgas(false);

      if (formik.values.city) {
        formik.setFieldValue('city', '');
      }
    };

    loadLgas();
  }, [formik.values.state]);

  function handleClose() {
    formik.resetForm();
    formik.setTouched({});
    setLocalGovernments([]);
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
            Create New Branch
          </h3>
          <p className="text-xs font-body text-gray-500">
            Add a new branch to the network
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReusableReactSelect
            name="state"
            label="State"
            formik={formik}
            options={stateOptions}
            placeholder="Search and select state"
            isLoading={areLookupsLoading}
            helperText={areLookupsLoading ? 'Loading states...' : undefined}
            noOptionsMessage={areLookupsLoading ? 'Loading states...' : 'No states found'} />

          <ReusableReactSelect
            name="city"
            label="LGA"
            formik={formik}
            options={lgaOptions}
            placeholder={formik.values.state ? 'Search and select LGA' : 'Select state first'}
            isDisabled={!formik.values.state}
            isLoading={isLoadingLgas}
            helperText={!formik.values.state ? 'Choose a state first' : isLoadingLgas ? 'Loading LGAs...' : undefined}
            noOptionsMessage={!formik.values.state ? 'Select a state first' : isLoadingLgas ? 'Loading LGAs...' : 'No LGAs found'} />
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
          noOptionsMessage={
            areLookupsLoading ? 'Loading managers...' : 'No branch manager staff found'
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone Number">
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={formik.values.phone}
              onChange={(event) => {
                formik.setFieldValue('phone', event.target.value.replace(/\D/g, ''), true);
              }}
              onBlur={formik.handleBlur}
              placeholder="e.g. 08012345678"
              className={inputClass} />

            {formik.touched.phone && formik.errors.phone &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.phone}</p>
            }

          </FormField>
          <FormField label="Email Address">
            <input
              id="email"
              name="email"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="branch@bckashmfb.com.ng"
              className={inputClass} />

            {formik.touched.email && formik.errors.email &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.email}</p>
            }
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
            className="px-4 py-2 text-sm font-heading font-bold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">

            Create Branch
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
  state: string;
  city: string;
  address: string;
  phone?: string;
  email?: string;
  managerId?: string;
  status: 'Active' | 'Inactive';
}

type ManagerSelectItem = {
  id: string;
  fullName: string;
  email: string;
  userLevel: string;
};

function toManagerSelectItem(raw: unknown): ManagerSelectItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const id = source.id ?? source._id;
  if (typeof id !== 'string') {
    return null;
  }

  const firstName = typeof source.firstName === 'string' ? source.firstName.trim() : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName.trim() : '';
  const joined = `${firstName} ${lastName}`.trim();
  const fallbackName =
    (typeof source.name === 'string' && source.name.trim().length > 0 ? source.name.trim() : '') ||
    (typeof source.fullName === 'string' && source.fullName.trim().length > 0 ? source.fullName.trim() : '') ||
    'Branch Manager';

  return {
    id,
    fullName: joined || fallbackName,
    email: typeof source.email === 'string' ? source.email : '',
    userLevel: typeof source.userLevel === 'string' ? source.userLevel : '',
  };
}

async function fetchBranchManagerOptions(): Promise<ManagerSelectItem[]> {
  try {
    const response = await api.get('/admin/staff?includeInactive=true');
    const source = response as { data?: unknown; payload?: unknown; items?: unknown };
    const list =
      (Array.isArray(source.data) ? source.data : undefined) ??
      (Array.isArray(source.payload) ? source.payload : undefined) ??
      (Array.isArray(source.items) ? source.items : undefined) ??
      [];

    return list
      .map(toManagerSelectItem)
      .filter((item): item is ManagerSelectItem => item !== null)
      .filter((item) => item.userLevel === 'BranchManager');
  } catch {
    return [];
  }
}

export function EditBranchModal({
  isOpen,
  onClose,
  branch,
  onSubmit
}: EditBranchModalProps) {
  const lookupStates = useAppSelector((state) => state.lookups.states);
  const managerStaff = useAppSelector((state) => state.lookups.branchManagers);
  const areLookupsLoading = useAppSelector((state) => state.lookups.loading);
  const [localGovernments, setLocalGovernments] = useState<OptionItem[]>([]);
  const [isLoadingLgas, setIsLoadingLgas] = useState(false);
  const [eligibleManagers, setEligibleManagers] = useState<ManagerSelectItem[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: '',
      code: '',
      state: '',
      city: '',
      address: '',
      managerId: '',
      phone: '',
      email: '',
      status: 'Active',
    },
    validationSchema: editBranchSchema,
    validateOnMount: true,
    onSubmit: (values) => {
      if (!branch) return;

      onSubmit(branch.id, {
        name: values.name.trim(),
        code: values.code.trim(),
        state: values.state,
        city: values.city,
        address: values.address.trim(),
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        managerId: values.managerId || undefined,
        status: values.status === 'Active' ? 'Active' : 'Inactive',
      });

      onClose();
    }
  });

  const stateOptions: SelectOption[] = lookupStates.map((state) => ({ label: state.name, value: state.name }));
  const lgaOptions: SelectOption[] = localGovernments.map((item) => ({ label: item.name, value: item.name }));
  const allBranches = useAppSelector((state) => state.lookups.branches || []);
  const assignedManagerIds = new Set(
    allBranches
      .filter((b: any) => b.id !== branch?.id)
      .map((b: any) => b.managerId)
      .filter((id: string | undefined) => !!id)
  );
  const fallbackManagers = managerStaff
    .filter((staff: BranchManagerLookup) => staff.userLevel === 'BranchManager' && !assignedManagerIds.has(staff.id))
    .map((staff: BranchManagerLookup) => ({
      id: staff.id,
      fullName: staff.fullName,
      email: staff.email,
      userLevel: staff.userLevel,
    }));
  const managerSource = eligibleManagers.length > 0
    ? eligibleManagers.filter((staff) => !assignedManagerIds.has(staff.id) || staff.id === branch?.managerId)
    : fallbackManagers;
  const managerOptions: SelectOption[] = managerSource.map((staff) => ({
    label: `${staff.fullName} (${staff.email})`,
    value: staff.id,
  }));

  useEffect(() => {
    if (branch) {
      formik.setValues({
        name: branch.name,
        code: branch.code || '',
        state: branch.state || '',
        city: branch.city || '',
        address: branch.address || '',
        managerId: branch.managerId || '',
        phone: branch.phone,
        email: branch.email,
        status: branch.status === 'Active' ? 'Active' : 'Inactive',
      });
      formik.setTouched({});
    }
  }, [branch]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadBaseOptions = async () => {
      setIsLoadingManagers(true);
      const managers = await fetchBranchManagerOptions();
      setEligibleManagers(managers);
      setIsLoadingManagers(false);
    };

    loadBaseOptions();
  }, [isOpen]);

  useEffect(() => {
    if (!formik.values.state) {
      setLocalGovernments([]);
      return;
    }

    const loadLgas = async () => {
      setIsLoadingLgas(true);
      const lgas = await fetchStateLgaOptions(formik.values.state);
      setLocalGovernments(lgas);
      setIsLoadingLgas(false);

      if (formik.values.city && !lgas.some((item) => item.name === formik.values.city)) {
        formik.setFieldValue('city', '');
      }
    };

    loadLgas();
  }, [formik.values.state]);

  function handleClose() {
    formik.resetForm();
    setLocalGovernments([]);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReusableReactSelect
            name="state"
            label="State"
            formik={formik}
            options={stateOptions}
            placeholder="Search and select state"
            isLoading={areLookupsLoading}
            helperText={areLookupsLoading ? 'Loading states...' : undefined}
            noOptionsMessage={areLookupsLoading ? 'Loading states...' : 'No states found'} />

          <ReusableReactSelect
            name="city"
            label="LGA"
            formik={formik}
            options={lgaOptions}
            placeholder={formik.values.state ? 'Search and select LGA' : 'Select state first'}
            isDisabled={!formik.values.state}
            isLoading={isLoadingLgas}
            helperText={!formik.values.state ? 'Choose a state first' : isLoadingLgas ? 'Loading LGAs...' : undefined}
            noOptionsMessage={!formik.values.state ? 'Select a state first' : isLoadingLgas ? 'Loading LGAs...' : 'No LGAs found'} />
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
          <ReusableReactSelect
            name="managerId"
            label="Branch Manager (Optional)"
            formik={formik}
            options={managerOptions}
            placeholder="Search and select branch manager"
            isLoading={areLookupsLoading || isLoadingManagers}
            helperText={
              areLookupsLoading || isLoadingManagers
                ? 'Loading eligible managers...'
                : managerOptions.length === 0
                  ? 'No branch manager-level staff found'
                  : undefined
            }
            noOptionsMessage={
              areLookupsLoading || isLoadingManagers ? 'Loading managers...' : 'No branch manager staff found'
            }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone Number">
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              value={formik.values.phone}
              onChange={(event) => {
                formik.setFieldValue('phone', event.target.value.replace(/\D/g, ''), true);
              }}
              onBlur={formik.handleBlur}
              className={inputClass} />

            {formik.touched.phone && formik.errors.phone &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.phone}</p>
            }
            
          </FormField>
          <FormField label="Email Address">
            <input
              id="email"
              name="email"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={inputClass} />

            {formik.touched.email && formik.errors.email &&
            <p className="text-xs text-red-600 mt-1">{formik.errors.email}</p>
            }
            
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
  onSubmit: (
    id: string,
    amount: number,
    bankAccountId: string,
    transactionReference: string,
    note: string,
  ) => Promise<void> | void;
}
export function FundBranchModal({
  isOpen,
  onClose,
  branch,
  onSubmit
}: FundBranchModalProps) {
  const formik = useFormik({
    initialValues: {
      amount: '',
      bankAccountId: '',
      transactionReference: '',
      note: ''
    },
    validationSchema: fundBranchSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      if (!branch) return;

      const numAmount = parseInt(values.amount.replace(/,/g, ''), 10);
      await onSubmit(
        branch.id,
        numAmount,
        values.bankAccountId,
        values.transactionReference.trim(),
        values.note.trim(),
      );
      formik.resetForm();
      onClose();
    }
  });

  useEffect(() => {
    if (!branch || !isOpen) {
      return;
    }

    if (branch.bankAccounts.length > 0 && !formik.values.bankAccountId) {
      const current = branch.bankAccounts.find((item) => item.isCurrent);
      formik.setFieldValue('bankAccountId', (current ?? branch.bankAccounts[0]).id);
    }
  }, [branch, formik, isOpen]);

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
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
          <WalletIcon size={20} />
        </div>
        <div>
          <h3 className="text-lg font-heading font-bold text-gray-900">
            Fund Allocation
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

      <form onSubmit={formik.handleSubmit} className="space-y-4" noValidate>
        <FormField label="Amount to Allocate" required>
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

        <FormField label="Funding Note / Reference">
          <select
            id="bankAccountId"
            name="bankAccountId"
            value={formik.values.bankAccountId}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            className={selectClass}
            required
          >
            <option value="">Select destination bank account...</option>
            {(branch?.bankAccounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName} • {account.accountNumber} ({account.accountName})
              </option>
            ))}
          </select>

          {formik.touched.bankAccountId && (formik.errors as Record<string, string>).bankAccountId &&
            <p className="text-xs text-red-600 mt-1">{(formik.errors as Record<string, string>).bankAccountId}</p>
          }
        </FormField>

        <FormField label="Transaction Reference" required>
          <input
            id="transactionReference"
            name="transactionReference"
            type="text"
            value={formik.values.transactionReference}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="e.g. NIP-78456392011"
            className={inputClass}
            required
          />

          {formik.touched.transactionReference && (formik.errors as Record<string, string>).transactionReference &&
            <p className="text-xs text-red-600 mt-1">{(formik.errors as Record<string, string>).transactionReference}</p>
          }
        </FormField>

        <FormField label="Funding Note / Comment">
          <textarea
            id="note"
            name="note"
            value={formik.values.note}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            placeholder="e.g. Q3 2026 fund allocation"
            rows={3}
            className={`${inputClass} resize-none`} />
          
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
            disabled={!formik.isValid || (branch?.bankAccounts.length ?? 0) === 0 || !formik.values.bankAccountId}
            className="px-4 py-2 text-sm font-heading font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            
            Allocate Funds
          </button>
        </div>
        {branch && branch.bankAccounts.length === 0 &&
          <p className="text-xs text-amber-600">Add a branch bank account before allocating funds.</p>
        }
      </form>
    </ModalWrapper>);

}
// ─── Add Bank Account Modal ─────────────────────────────────────
interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  onSubmit: (data: Omit<BankAccount, 'id' | 'dateAdded'>) => Promise<void> | void;
}
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
      isCurrent: true
    },
    validationSchema: addBankAccountSchema,
    validateOnMount: true,
    onSubmit: async (values) => {
      await onSubmit({
        bankName: values.bankName.trim(),
        accountNumber: values.accountNumber.trim(),
        accountName: values.accountName.trim(),
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

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formik.values.isCurrent}
            onChange={(e) => formik.setFieldValue('isCurrent', e.target.checked)}
            className="rounded text-primary focus:ring-primary" />
          
          <span className="text-sm font-body text-gray-700">
            Set as current (primary) account
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