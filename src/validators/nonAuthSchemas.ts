import * as Yup from 'yup';

// Branch has no city/state fields on the real backend (see backashbackend's
// Branch schema — name/code/address/phone/email/active); the modal these
// back only ever collects what CreateBranchDto/UpdateBranchDto actually
// accept. Only UpdateBranchDto accepts phone/email today — set on an
// existing branch via Edit, not at creation time.
export const createBranchSchema = Yup.object({
  name: Yup.string().trim().required('Branch name is required'),
  code: Yup.string().trim().required('Branch code is required'),
  address: Yup.string().trim().required('Address is required'),
});

export const editBranchSchema = Yup.object({
  name: Yup.string().trim().required('Branch name is required'),
  code: Yup.string().trim().required('Branch code is required'),
  address: Yup.string().trim().required('Address is required'),
  phone: Yup.string()
    .trim()
    .optional()
    .test('empty-or-11-digits', 'Phone number must be exactly 11 digits', (value) => !value || /^\d{11}$/.test(value)),
  email: Yup.string().trim().email('Enter a valid email').optional(),
  managerId: Yup.string()
    .trim()
    .optional()
    .test('empty-or-objectid', 'Manager ID must be a valid ObjectId', (value) => !value || /^[a-f\d]{24}$/i.test(value)),
  status: Yup.string().oneOf(['Active', 'Inactive']).required('Status is required'),
});

// Matches RecordBranchFundingDto exactly — bankAccountId must be the
// branch's currently-*active* account (the modal doesn't offer a picker;
// it's read-only, resolved from the branch's own active account, since
// there's at most one). No separate "note" field (folded into the one
// optional `reference` field the real API has).
export const fundBranchSchema = Yup.object({
  bankAccountId: Yup.string()
    .trim()
    .required('The branch needs an active bank account before it can be funded'),
  amount: Yup.string()
    .required('Amount is required')
    .test('valid-amount', 'Enter a valid amount', (value) => {
      const parsed = Number((value || '').replace(/,/g, ''));
      return Number.isFinite(parsed) && parsed > 0;
    }),
  fundedAt: Yup.string().required('Funded date is required'),
  reference: Yup.string().trim().max(120, 'Reference must be 120 characters or fewer'),
});

export const addBankAccountSchema = Yup.object({
  bankName: Yup.string().required('Bank name is required'),
  accountNumber: Yup.string()
    .matches(/^\d{10}$/, 'Account number must be 10 digits')
    .required('Account number is required'),
  accountName: Yup.string().trim().required('Account name is required'),
  purpose: Yup.string()
    .oneOf(['REPAYMENT_COLLECTION', 'DISBURSEMENT_SOURCE', 'GENERAL'], 'Select a valid purpose')
    .required('Purpose is required'),
  isCurrent: Yup.boolean().required(),
});

export const departmentSchema = Yup.object({
  name: Yup.string().trim().required('Department name is required'),
});

export const roleSchema = Yup.object({
  name: Yup.string().trim().required('Role name is required'),
  department: Yup.string().required('Department is required'),
});

export const expenseSchema = Yup.object({
  category: Yup.string().required('Category is required'),
  description: Yup.string().trim().required('Description is required'),
  amount: Yup.number().typeError('Enter a valid amount').moreThan(0).required('Amount is required'),
  branch: Yup.string().required('Branch is required'),
  date: Yup.string(),
});
