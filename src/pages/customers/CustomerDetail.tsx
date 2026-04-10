import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  UserIcon,
  ShieldCheckIcon,
  UsersIcon,
  BanknoteIcon,
  CreditCardIcon,
  PlusIcon,
  SendIcon,
  ClockIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  EyeIcon,
  FingerprintIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  BookOpenIcon,
  ReceiptIcon,
  PrinterIcon,
  } from
'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../app/api';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { compressImageFile } from '../../utils/image-compression';
import { BiometricCaptureModal } from './BiometricCaptureModal';
import { KycVerificationModal } from './KycVerificationModal';
import { KycOverviewModal } from './KycOverviewModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ReusableInputField } from '../../components/ReusableInputField';
import { ReusableReactSelect, type SelectOption } from '../../components/ReusableReactSelect';

type BadgeStatus =
  | 'Active'
  | 'Pending'
  | 'Pending Approval'
  | 'Pending Review'
  | 'Completed'
  | 'Approved'
  | 'Rejected'
  | 'Overdue'
  | 'Disbursed'
  | 'Verified'
  | 'Captured'
  | 'On Leave'
  | 'Suspended'
  | 'Inactive'
  | 'New';

type KycVerifyActionType = 'bvn' | 'nin' | 'utilityBill' | 'passportPhoto';

type CustomerViewModel = {
  id: string;
  backendId: string | null;
  name: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  address: string;
  officeAddress: string;
  lga: string;
  state: string;
  nextOfKin: {
    name: string;
    phone: string;
    relationship: string;
  };
  avatar: string;
  group: {
    name: string;
    id: string;
    role: string;
    dateJoined: string;
    status: string;
  };
  branch: string;
  status: string;
  dateJoined: string;
  guarantors: Array<{
    name: string;
    phone: string;
    email: string;
    address: string;
    relationship: string;
    occupation: string;
    bvn: string;
  }>;
  reference: {
    name: string;
    phone: string;
    address: string;
    relationship: string;
    occupation: string;
    yearsKnown: string;
  };
  kyc: {
    bvn: {
      number: string;
      status: string;
    };
    nin: {
      number: string;
      status: string;
    };
    utilityBill: {
      status: string;
    };
    passportPhoto: {
      status: string;
    };
    biometric: {
      status: string;
    };
  };
  loans: unknown[];
  activity: Array<{
    action: string;
    date: string;
    by: string;
  }>;
  isApproved: boolean;
  isRejected: boolean;
  isBlackListed: boolean;
  approvedByName: string;
  rejectedByName: string;
  blacklistedByName: string;
  approvedOn: string;
  rejectedOn: string;
  blackListedOn: string;
  reasonForRejection: string;
  reasonForBlacklisting: string;
};

function extractItem<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const source = response as { data?: unknown; payload?: unknown; item?: unknown };
  const candidates = [source.data, source.payload, source.item];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as T;
    }
  }

  return null;
}

function resolveStaffDisplayName(value: unknown): string {
  if (!value) {
    return '-';
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value !== 'object') {
    return '-';
  }

  const source = value as Record<string, unknown>;
  const firstName = typeof source.firstName === 'string' ? source.firstName : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName : '';
  const joinedName = `${firstName} ${lastName}`.trim();

  if (joinedName.length > 0) {
    return joinedName;
  }

  if (typeof source.name === 'string' && source.name.trim().length > 0) {
    return source.name.trim();
  }

  return '-';
}

function formatDisplayDate(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeEditableValue(value: string | undefined): string {
  if (!value || value === '-') {
    return '';
  }

  return value;
}

const NIGERIAN_STATE_OPTIONS: SelectOption[] = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
].map((value) => ({ label: value, value }));

const LGA_OPTIONS_BY_STATE: Record<string, SelectOption[]> = {
  Lagos: ['Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Eti-Osa', 'Ikeja', 'Kosofe', 'Mushin', 'Oshodi-Isolo', 'Surulere'].map(
    (value) => ({ label: value, value }),
  ),
  FCT: ['Abaji', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali', 'Municipal Area Council'].map((value) => ({ label: value, value })),
  Rivers: ['Obio-Akpor', 'Port Harcourt', 'Eleme', 'Etche', 'Ikwerre', 'Khana'].map((value) => ({ label: value, value })),
  Oyo: ['Ibadan North', 'Ibadan South-West', 'Akinyele', 'Egbeda', 'Ibarapa East'].map((value) => ({ label: value, value })),
  Kano: ['Dala', 'Fagge', 'Gwale', 'Nasarawa', 'Tarauni', 'Ungogo'].map((value) => ({ label: value, value })),
};

type PersonalEditFormValues = {
  fullName: string;
  phoneNumber: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  residentialAddress: string;
  officeAddress: string;
  lga: string;
  state: string;
  nin: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
};

type GuarantorEditFormValues = {
  guarantor1Name: string;
  guarantor1Phone: string;
  guarantor1Email: string;
  guarantor1Address: string;
  guarantor1Relationship: string;
  guarantor1Occupation: string;
  guarantor2Name: string;
  guarantor2Phone: string;
  guarantor2Email: string;
  guarantor2Address: string;
  guarantor2Relationship: string;
  guarantor2Occupation: string;
  guarantor3Name: string;
  guarantor3Phone: string;
  guarantor3Email: string;
  guarantor3Address: string;
  guarantor3Relationship: string;
  guarantor3Occupation: string;
};

type ReferenceEditFormValues = {
  referenceName: string;
  referencePhone: string;
  referenceAddress: string;
  referenceRelationship: string;
  referenceOccupation: string;
  referenceYearsKnown: string;
};

type CustomerFeeItem = {
  category: 'organization' | 'branch' | 'group' | 'loan';
  feeTitle: string;
  description: string;
  chargingType: 'fixed' | 'percentage';
  amount: number;
  isPaid: boolean;
  paidAt: string | undefined;
  paidBy: string | undefined;
  paymentMethod: string | undefined;
  reference: string | undefined;
};

type CustomerFeePaymentHistoryItem = {
  category: 'organization' | 'branch' | 'group' | 'loan';
  feeTitle: string;
  amount: number;
  paymentMethod: string;
  destinationBankAccountId: string | undefined;
  destinationBankName: string | undefined;
  destinationAccountNumber: string | undefined;
  destinationAccountName: string | undefined;
  reference: string | undefined;
  note: string | undefined;
  paidAt: string | undefined;
  paidBy: string | undefined;
};

type BranchBankOption = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isCurrent: boolean;
};

type CustomerLoanItem = {
  id: string;
  loanCode: string;
  principalAmount: number;
  interestRate: number;
  tenorWeeks: number;
  processingFee: number;
  loanProductType: string | undefined;
  repaymentFrequency: string | undefined;
  gracePeriod: string | undefined;
  firstPaymentDate: string | undefined;
  maturityDate: string | undefined;
  purpose: string | undefined;
  remarks: string | undefined;
  status: string;
  initiationDate: string | undefined;
  disbursedDate: string | undefined;
  createdAt: string | undefined;
  dueDate: string | undefined;
};

type CustomerLoanProductOption = {
  id?: string;
  productType: string;
  durationWeeks: number;
  interestRate: number;
  isActive: boolean;
};

type CustomerLoanFeeRule = {
  feeTitle: string;
  chargingType: 'fixed' | 'percentage';
  amount: number;
  description: string;
};

function extractCustomerFees(response: unknown): CustomerFeeItem[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const source = response as { data?: unknown; payload?: unknown; fees?: unknown };
  const container =
    (source.data && typeof source.data === 'object' ? source.data : null) ||
    (source.payload && typeof source.payload === 'object' ? source.payload : null) ||
    source;

  if (!container || typeof container !== 'object') {
    return [];
  }

  const rawFees = (container as { fees?: unknown }).fees;
  if (!Array.isArray(rawFees)) {
    return [];
  }

  return rawFees
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const category = String(item.category ?? '').trim().toLowerCase();
      const chargingType = String(item.chargingType ?? '').trim().toLowerCase();
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount);

      if (!['organization', 'branch', 'group', 'loan'].includes(category)) {
        return null;
      }

      if (!['fixed', 'percentage'].includes(chargingType)) {
        return null;
      }

      if (!Number.isFinite(amount)) {
        return null;
      }

      return {
        category: category as CustomerFeeItem['category'],
        feeTitle: typeof item.feeTitle === 'string' ? item.feeTitle : '',
        description: typeof item.description === 'string' ? item.description : '',
        chargingType: chargingType as CustomerFeeItem['chargingType'],
        amount,
        isPaid: Boolean(item.isPaid),
        paidAt: typeof item.paidAt === 'string' ? item.paidAt : undefined,
        paidBy: typeof item.paidBy === 'string' ? item.paidBy : undefined,
        paymentMethod: typeof item.paymentMethod === 'string' ? item.paymentMethod : undefined,
        reference: typeof item.reference === 'string' ? item.reference : undefined,
      };
    })
    .filter((entry): entry is CustomerFeeItem => entry !== null);
}

function extractCustomerFeePaymentHistory(response: unknown): CustomerFeePaymentHistoryItem[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const source = response as { data?: unknown; payload?: unknown; paymentHistory?: unknown };
  const container =
    (source.data && typeof source.data === 'object' ? source.data : null) ||
    (source.payload && typeof source.payload === 'object' ? source.payload : null) ||
    source;

  if (!container || typeof container !== 'object') {
    return [];
  }

  const rawHistory = (container as { paymentHistory?: unknown }).paymentHistory;
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const category = String(item.category ?? '').trim().toLowerCase();
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount);

      if (!['organization', 'branch', 'group', 'loan'].includes(category)) {
        return null;
      }

      if (!Number.isFinite(amount)) {
        return null;
      }

      return {
        category: category as CustomerFeePaymentHistoryItem['category'],
        feeTitle: typeof item.feeTitle === 'string' ? item.feeTitle : '',
        amount,
        paymentMethod: typeof item.paymentMethod === 'string' ? item.paymentMethod : '-',
        destinationBankAccountId:
          typeof item.destinationBankAccountId === 'string' ? item.destinationBankAccountId : undefined,
        destinationBankName: typeof item.destinationBankName === 'string' ? item.destinationBankName : undefined,
        destinationAccountNumber:
          typeof item.destinationAccountNumber === 'string' ? item.destinationAccountNumber : undefined,
        destinationAccountName:
          typeof item.destinationAccountName === 'string' ? item.destinationAccountName : undefined,
        reference: typeof item.reference === 'string' ? item.reference : undefined,
        note: typeof item.note === 'string' ? item.note : undefined,
        paidAt: typeof item.paidAt === 'string' ? item.paidAt : undefined,
        paidBy: typeof item.paidBy === 'string' ? item.paidBy : undefined,
      };
    })
    .filter((entry): entry is CustomerFeePaymentHistoryItem => entry !== null);
}

function extractBranchBankOptions(response: unknown): BranchBankOption[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const source = response as { data?: unknown; payload?: unknown; bankOptions?: unknown };
  const container =
    (source.data && typeof source.data === 'object' ? source.data : null) ||
    (source.payload && typeof source.payload === 'object' ? source.payload : null) ||
    source;

  if (!container || typeof container !== 'object') {
    return [];
  }

  const rawBankOptions = (container as { bankOptions?: unknown }).bankOptions;
  if (!Array.isArray(rawBankOptions)) {
    return [];
  }

  return rawBankOptions
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id : '';
      const bankName = typeof item.bankName === 'string' ? item.bankName : '';
      const accountNumber = typeof item.accountNumber === 'string' ? item.accountNumber : '';
      const accountName = typeof item.accountName === 'string' ? item.accountName : '';

      if (!id || !bankName || !accountNumber || !accountName) {
        return null;
      }

      return {
        id,
        bankName,
        accountNumber,
        accountName,
        isCurrent: Boolean(item.isCurrent),
      };
    })
    .filter((entry): entry is BranchBankOption => entry !== null);
}

function formatNairaAmount(value: number): string {
  return `₦${Math.round(value).toLocaleString()}`;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateMaturityDate(firstPaymentDate: string, durationWeeks: number): string {
  if (!firstPaymentDate || !Number.isFinite(durationWeeks) || durationWeeks <= 0) {
    return '';
  }

  const firstDate = new Date(`${firstPaymentDate}T00:00:00`);
  if (Number.isNaN(firstDate.getTime())) {
    return '';
  }

  const maturityDate = new Date(firstDate);
  maturityDate.setDate(maturityDate.getDate() + Math.round(durationWeeks) * 7);
  return formatDateForInput(maturityDate);
}

function calculateFirstPaymentDateFromFrequency(
  initiationDate: Date,
  repaymentFrequency: 'Weekly' | 'Bi-Weekly' | 'Monthly',
): string {
  const firstPaymentDate = new Date(initiationDate);

  if (repaymentFrequency === 'Weekly') {
    firstPaymentDate.setDate(firstPaymentDate.getDate() + 7);
  } else if (repaymentFrequency === 'Bi-Weekly') {
    firstPaymentDate.setDate(firstPaymentDate.getDate() + 14);
  } else {
    firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
  }

  return formatDateForInput(firstPaymentDate);
}

function parseLoanDurationWeeks(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const trimmedValue = value.trim().toLowerCase();
  const match = trimmedValue.match(/^(\d+(?:\.\d+)?)\s*(week|weeks|month|months)$/);
  if (!match) {
    return Number.NaN;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Number.NaN;
  }

  const unit = match[2];
  return unit.startsWith('month') ? Math.round(amount * 4) : Math.round(amount);
}

function extractCustomerLoans(response: unknown): CustomerLoanItem[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const source = response as { data?: unknown; payload?: unknown; loans?: unknown };
  const container =
    (source.data && typeof source.data === 'object' ? source.data : null) ||
    (source.payload && typeof source.payload === 'object' ? source.payload : null) ||
    source;

  if (!container || typeof container !== 'object') {
    return [];
  }

  const rawLoans = (container as { loans?: unknown }).loans;
  if (!Array.isArray(rawLoans)) {
    return [];
  }

  return rawLoans
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id : typeof item._id === 'string' ? item._id : '';
      const loanCode = typeof item.loanCode === 'string' ? item.loanCode : '';
      const principalAmount = typeof item.principalAmount === 'number' ? item.principalAmount : Number(item.principalAmount);
      const interestRate = typeof item.interestRate === 'number' ? item.interestRate : Number(item.interestRate);
      const tenorWeeks = typeof item.tenorWeeks === 'number' ? item.tenorWeeks : Number(item.tenorWeeks);
      const processingFee = typeof item.processingFee === 'number' ? item.processingFee : Number(item.processingFee);

      if (!id || !loanCode || !Number.isFinite(principalAmount) || !Number.isFinite(interestRate) || !Number.isFinite(tenorWeeks)) {
        return null;
      }

      return {
        id,
        loanCode,
        principalAmount,
        interestRate,
        tenorWeeks,
        processingFee: Number.isFinite(processingFee) ? processingFee : 0,
        loanProductType: typeof item.loanProductType === 'string' ? item.loanProductType : undefined,
        repaymentFrequency: typeof item.repaymentFrequency === 'string' ? item.repaymentFrequency : undefined,
        gracePeriod: typeof item.gracePeriod === 'string' ? item.gracePeriod : undefined,
        firstPaymentDate: typeof item.firstPaymentDate === 'string' ? item.firstPaymentDate : undefined,
        maturityDate:
          typeof item.maturityDate === 'string'
            ? item.maturityDate
            : typeof item.dueDate === 'string'
              ? item.dueDate
              : undefined,
        purpose: typeof item.purpose === 'string' ? item.purpose : undefined,
        remarks: typeof item.initiationRemarks === 'string' ? item.initiationRemarks : undefined,
        status: typeof item.status === 'string' ? item.status : 'Submitted',
        initiationDate:
          typeof item.initiationDate === 'string'
            ? item.initiationDate
            : typeof item.createdAt === 'string'
              ? item.createdAt
              : undefined,
        disbursedDate:
          typeof item.disbursedDate === 'string'
            ? item.disbursedDate
            : typeof item.disbursedAt === 'string'
              ? item.disbursedAt
              : undefined,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
        dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
      };
    })
    .filter((entry): entry is CustomerLoanItem => entry !== null);
}

function extractCustomerLoanProductOptions(response: unknown): {
  loanProducts: CustomerLoanProductOption[];
  loanFeeRules: CustomerLoanFeeRule[];
} {
  if (!response || typeof response !== 'object') {
    return { loanProducts: [], loanFeeRules: [] };
  }

  const source = response as {
    data?: unknown;
    payload?: unknown;
    loanProducts?: unknown;
    loanFeeRules?: unknown;
  };
  const container =
    (source.data && typeof source.data === 'object' ? source.data : null) ||
    (source.payload && typeof source.payload === 'object' ? source.payload : null) ||
    source;

  if (!container || typeof container !== 'object') {
    return { loanProducts: [], loanFeeRules: [] };
  }

  const rawProducts = (container as { loanProducts?: unknown }).loanProducts;
  const rawFeeRules = (container as { loanFeeRules?: unknown }).loanFeeRules;

  const productSource = Array.isArray(rawProducts)
    ? rawProducts
    : Array.isArray(container)
      ? container
      : [];

  const loanProducts: CustomerLoanProductOption[] = Array.isArray(productSource)
    ? productSource
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const item = entry as Record<string, unknown>;
          const productType =
            typeof item.productType === 'string'
              ? item.productType.trim()
              : typeof item.name === 'string'
                ? item.name.trim()
                : '';
          const durationWeeks =
            typeof item.durationWeeks === 'number'
              ? item.durationWeeks
              : parseLoanDurationWeeks(item.duration);
          const interestRate = typeof item.interestRate === 'number' ? item.interestRate : Number(item.interestRate);
          const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
          const isActive = typeof item.isActive === 'boolean' ? item.isActive : status ? status === 'active' : true;

          if (!productType || !Number.isFinite(durationWeeks) || !Number.isFinite(interestRate)) {
            return null;
          }

          const productId = typeof item.id === 'string' ? item.id : typeof item._id === 'string' ? item._id : '';

          return {
            ...(productId ? { id: productId } : {}),
            productType,
            durationWeeks,
            interestRate,
            isActive,
          };
        })
        .filter((entry): entry is CustomerLoanProductOption => entry !== null)
    : [];

  const loanFeeRules: CustomerLoanFeeRule[] = Array.isArray(rawFeeRules)
    ? rawFeeRules
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const item = entry as Record<string, unknown>;
          const chargingType = typeof item.chargingType === 'string' ? item.chargingType : '';
          const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount);

          if (!['fixed', 'percentage'].includes(chargingType) || !Number.isFinite(amount)) {
            return null;
          }

          return {
            feeTitle: typeof item.feeTitle === 'string' ? item.feeTitle : '',
            chargingType: chargingType as CustomerLoanFeeRule['chargingType'],
            amount,
            description: typeof item.description === 'string' ? item.description : '',
          };
        })
        .filter((entry): entry is CustomerLoanFeeRule => entry !== null)
    : [];

  return { loanProducts, loanFeeRules };
}

function mapApiCustomerToView(
  raw: unknown,
  fallback: CustomerViewModel,
  routeId: string,
): CustomerViewModel | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const firstName = typeof source.firstName === 'string' ? source.firstName : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName : '';
  const joinedName = `${firstName} ${lastName}`.trim();
  const nok =
    typeof source.nok === 'object' && source.nok !== null
      ? (source.nok as Record<string, unknown>)
      : {};
  const profilePic =
    typeof source.profilePic === 'object' && source.profilePic !== null
      ? (source.profilePic as Record<string, unknown>)
      : {};
  const reference =
    typeof source.reference === 'object' && source.reference !== null
      ? (source.reference as Record<string, unknown>)
      : {};
  const kycSource =
    typeof source.kyc === 'object' && source.kyc !== null
      ? (source.kyc as Record<string, unknown>)
      : {};
  const groupSource =
    typeof source.group === 'object' && source.group !== null
      ? (source.group as Record<string, unknown>)
      : {};
  const bvnSource =
    typeof kycSource.bvn === 'object' && kycSource.bvn !== null
      ? (kycSource.bvn as Record<string, unknown>)
      : {};
  const guarantorSources = [source.guarantor1, source.guarantor2, source.guarantor3].map((item) =>
    typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {},
  );
  const backendId =
    (typeof source.id === 'string' && source.id) ||
    (typeof source._id === 'string' && source._id) ||
    null;

  const createdAt = typeof source.createdAt === 'string' ? source.createdAt : '';

  const isApproved = typeof source.isApproved === 'boolean' ? source.isApproved : Boolean(fallback.isApproved);
  const isRejected = typeof source.isRejected === 'boolean' ? source.isRejected : Boolean(fallback.isRejected);
  const isBlackListed = typeof source.isBlackListed === 'boolean' ? source.isBlackListed : Boolean(fallback.isBlackListed);
  const statusFromApproval = isBlackListed
    ? 'Blacklisted'
    : isRejected
    ? 'Rejected'
    : isApproved
    ? 'Approved'
    : 'Pending Approval';
  const approvedByName =
    resolveStaffDisplayName(source.approvedBy) !== '-'
      ? resolveStaffDisplayName(source.approvedBy)
      : fallback.approvedByName || '-';
  const rejectedByName =
    resolveStaffDisplayName(source.rejectedBy) !== '-'
      ? resolveStaffDisplayName(source.rejectedBy)
      : fallback.rejectedByName || '-';
  const blacklistedByName =
    resolveStaffDisplayName(source.blacklistedBy) !== '-'
      ? resolveStaffDisplayName(source.blacklistedBy)
      : fallback.blacklistedByName || '-';
  const approvedOn =
    (typeof source.approvedOn === 'string' && source.approvedOn) ||
    (typeof fallback.approvedOn === 'string' ? fallback.approvedOn : '');
  const rejectedOn =
    (typeof source.rejectedOn === 'string' && source.rejectedOn) ||
    (typeof fallback.rejectedOn === 'string' ? fallback.rejectedOn : '');
  const blackListedOn =
    (typeof source.blackListedOn === 'string' && source.blackListedOn) ||
    (typeof fallback.blackListedOn === 'string' ? fallback.blackListedOn : '');
  const mappedActivity = Array.isArray(source.activity)
    ? source.activity
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const item = entry as Record<string, unknown>;
          const action = typeof item.action === 'string' && item.action.trim().length > 0 ? item.action.trim() : '';
          const by = typeof item.by === 'string' && item.by.trim().length > 0 ? item.by.trim() : '-';
          const dateValue =
            typeof item.date === 'string'
              ? item.date
              : item.date instanceof Date
                ? item.date.toISOString()
                : '';

          if (!action) {
            return null;
          }

          return {
            action,
            by,
            date: formatDisplayDate(dateValue),
          };
        })
        .filter((entry): entry is { action: string; by: string; date: string } => entry !== null)
    : fallback.activity;

  const resolvedGroupName =
    (typeof source.groupName === 'string' && source.groupName) ||
    (typeof groupSource.groupName === 'string' && groupSource.groupName) ||
    (typeof groupSource.name === 'string' && groupSource.name) ||
    fallback.group?.name;

  const resolvedGroupId =
    (typeof source.groupId === 'string' && source.groupId) ||
    (typeof groupSource.id === 'string' && groupSource.id) ||
    (typeof groupSource._id === 'string' && groupSource._id) ||
    fallback.group?.id;

  const resolvedGroupRole =
    (typeof source.groupRole === 'string' && source.groupRole) ||
    (typeof groupSource.role === 'string' && groupSource.role) ||
    fallback.group?.role;
  const resolvedGroupDateJoined = createdAt ? createdAt.split('T')[0] : fallback.group?.dateJoined;

  const resolvedGroupStatus =
    (typeof source.groupStatus === 'string' && source.groupStatus) ||
    (typeof groupSource.status === 'string' && groupSource.status) ||
    (typeof groupSource.isActive === 'boolean' ? (groupSource.isActive ? 'Active' : 'Inactive') : undefined) ||
    fallback.group?.status;

  const marketerSource =
    typeof source.marketer === 'object' && source.marketer !== null
      ? (source.marketer as Record<string, unknown>)
      : {};

  const marketerBranchSource =
    typeof marketerSource.branch === 'object' && marketerSource.branch !== null
      ? (marketerSource.branch as Record<string, unknown>)
      : {};

  const resolvedBranchName =
    (typeof source.marketerBranchName === 'string' && source.marketerBranchName) ||
    (typeof marketerSource.branchName === 'string' && marketerSource.branchName) ||
    (typeof marketerBranchSource.name === 'string' && marketerBranchSource.name) ||
    (typeof source.branchName === 'string' && source.branchName) ||
    (typeof source.branch === 'string' && source.branch) ||
    fallback.branch;

  return {
    ...fallback,
    id: fallback.id || routeId,
    backendId,
    name:
      (typeof source.fullName === 'string' && source.fullName.trim().length > 0
        ? source.fullName
        : joinedName) || fallback.name,
    phone:
      (typeof source.phoneNumber === 'string' && source.phoneNumber) ||
      (typeof source.phone === 'string' && source.phone) ||
      fallback.phone,
    email: (typeof source.email === 'string' && source.email) || fallback.email,
    dob:
      (typeof source.dateOfBirth === 'string' && source.dateOfBirth.split('T')[0]) ||
      (typeof source.dob === 'string' && source.dob) ||
      fallback.dob,
    gender: (typeof source.gender === 'string' && source.gender) || fallback.gender,
    address:
      (typeof source.residentialAddress === 'string' && source.residentialAddress) ||
      (typeof source.address === 'string' && source.address) ||
      fallback.address,
    officeAddress:
      (typeof source.officeAddress === 'string' && source.officeAddress) ||
      fallback.officeAddress,
    lga: (typeof source.lga === 'string' && source.lga) || fallback.lga,
    state: (typeof source.state === 'string' && source.state) || fallback.state,
    group: {
      ...fallback.group,
      name: resolvedGroupName,
      id: resolvedGroupId,
      role: resolvedGroupRole,
      dateJoined: resolvedGroupDateJoined,
      status: resolvedGroupStatus,
    },
    branch: resolvedBranchName,
    avatar:
      (typeof profilePic.url === 'string' && profilePic.url) ||
      (typeof source.avatar === 'string' && source.avatar) ||
      fallback.avatar,
    guarantors: guarantorSources.map((guarantor, index) => ({
      ...(fallback.guarantors?.[index] ?? {}),
      name: (typeof guarantor.fullName === 'string' && guarantor.fullName) || fallback.guarantors?.[index]?.name,
      phone: (typeof guarantor.phoneNumber === 'string' && guarantor.phoneNumber) || fallback.guarantors?.[index]?.phone,
      email: (typeof guarantor.email === 'string' && guarantor.email) || fallback.guarantors?.[index]?.email,
      address: (typeof guarantor.address === 'string' && guarantor.address) || fallback.guarantors?.[index]?.address,
      relationship:
        (typeof guarantor.relationship === 'string' && guarantor.relationship) || fallback.guarantors?.[index]?.relationship,
      occupation: (typeof guarantor.occupation === 'string' && guarantor.occupation) || fallback.guarantors?.[index]?.occupation,
    })),
    reference: {
      ...fallback.reference,
      name: (typeof reference.name === 'string' && reference.name) || fallback.reference?.name,
      phone: (typeof reference.phone === 'string' && reference.phone) || fallback.reference?.phone,
      address: (typeof reference.address === 'string' && reference.address) || fallback.reference?.address,
      relationship: (typeof reference.relationship === 'string' && reference.relationship) || fallback.reference?.relationship,
      occupation: (typeof reference.occupation === 'string' && reference.occupation) || fallback.reference?.occupation,
      yearsKnown: (typeof reference.yearsKnown === 'string' && reference.yearsKnown) || fallback.reference?.yearsKnown,
    },
    nextOfKin: {
      ...fallback.nextOfKin,
      name: (typeof nok.fullName === 'string' && nok.fullName) || fallback.nextOfKin?.name,
      phone: (typeof nok.phoneNumber === 'string' && nok.phoneNumber) || fallback.nextOfKin?.phone,
      relationship: (typeof nok.relationship === 'string' && nok.relationship) || fallback.nextOfKin?.relationship,
    },
    dateJoined: createdAt ? createdAt.split('T')[0] : fallback.dateJoined,
    status: statusFromApproval,
    isApproved,
    isRejected,
    isBlackListed,
    approvedByName,
    rejectedByName,
    blacklistedByName,
    approvedOn,
    rejectedOn,
    blackListedOn,
    activity: mappedActivity,
    reasonForRejection:
      (typeof source.reasonForRejection === 'string' && source.reasonForRejection) || fallback.reasonForRejection,
    reasonForBlacklisting:
      (typeof source.reasonForBlacklisting === 'string' && source.reasonForBlacklisting) || fallback.reasonForBlacklisting,
    kyc: {
      ...fallback.kyc,
      bvn: {
        ...(fallback.kyc?.bvn ?? {}),
        number:
          (typeof source.bvn === 'string' && source.bvn) ||
          (typeof source.bvnNumber === 'string' && source.bvnNumber) ||
          (typeof bvnSource.number === 'string' && bvnSource.number) ||
          fallback.kyc?.bvn?.number,
        status: typeof source.bvnVerified === 'boolean' ? (source.bvnVerified ? 'Verified' : 'Pending') : fallback.kyc?.bvn?.status,
      },
      nin: {
        ...(fallback.kyc?.nin ?? {}),
        number: (typeof source.nin === 'string' && source.nin) || fallback.kyc?.nin?.number,
      },
      biometric: {
        ...(fallback.kyc?.biometric ?? {}),
        status:
          typeof source.biometricVerified === 'boolean'
            ? source.biometricVerified
              ? 'Captured'
              : 'Pending'
            : fallback.kyc?.biometric?.status,
      },
    },
  };
}

const createEmptyCustomer = (customerId: string): CustomerViewModel => ({
  id: customerId,
  backendId: null,
  name: 'Unknown Customer',
  phone: '-',
  email: '-',
  dob: '-',
  gender: '-',
  address: '-',
  officeAddress: '-',
  lga: '-',
  state: '-',
  nextOfKin: {
    name: '-',
    phone: '-',
    relationship: '-',
  },
  avatar: '',
  group: {
    name: '-',
    id: '-',
    role: '-',
    dateJoined: '-',
    status: '-',
  },
  branch: '-',
  status: 'Pending Approval',
  dateJoined: '-',
  guarantors: Array.from({ length: 3 }, () => ({
    name: '-',
    phone: '-',
    email: '-',
    address: '-',
    relationship: '-',
    occupation: '-',
    bvn: '-',
  })),
  reference: {
    name: '-',
    phone: '-',
    address: '-',
    relationship: '-',
    occupation: '-',
    yearsKnown: '-',
  },
  kyc: {
    bvn: {
      number: '-',
      status: 'Pending',
    },
    nin: {
      number: '-',
      status: 'Pending',
    },
    utilityBill: {
      status: 'Pending',
    },
    passportPhoto: {
      status: 'Pending',
    },
    biometric: {
      status: 'Pending',
    },
  },
  loans: [],
  activity: [],
  isApproved: false,
  isRejected: false,
  isBlackListed: false,
  approvedByName: '-',
  rejectedByName: '-',
  blacklistedByName: '-',
  approvedOn: '',
  rejectedOn: '',
  blackListedOn: '',
  reasonForRejection: '',
  reasonForBlacklisting: '',
});
const tabs = [
{
  key: 'personal',
  label: 'Personal Info',
  icon: UserIcon
},
{
  key: 'guarantors',
  label: 'Guarantors',
  icon: UsersIcon
},
{
  key: 'reference',
  label: 'Reference',
  icon: BookOpenIcon
},
{
  key: 'kyc',
  label: 'KYC & Verification',
  icon: ShieldCheckIcon
},
{
  key: 'group',
  label: 'Group Membership',
  icon: UsersIcon
},
{
  key: 'loans',
  label: 'Loan History',
  icon: BanknoteIcon
},
{
  key: 'fees',
  label: 'Fees & Payments',
  icon: ReceiptIcon
},
{
  key: 'activity',
  label: 'Activity Log',
  icon: ClockIcon
}];

const EDITABLE_TAB_KEYS = new Set(['personal', 'guarantors', 'reference']);

function KycRow({
  label,
  status,
  icon,
  onAction





}: {label: string;status: string;icon: React.ReactNode;onAction: () => void;}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
          {icon}
        </div>
        <span className="text-sm font-body text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={status as BadgeStatus} />
        <button
          onClick={onAction}
          className="text-xs font-body text-primary hover:text-primary/80 transition-colors">
          
          {status === 'Verified' || status === 'Captured' ? 'View' : 'Verify'}
        </button>
      </div>
    </div>);

}
export function CustomerDetail() {
  const { id } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const initialCustomer = createEmptyCustomer(typeof id === 'string' ? id : '');
  const [customer, setCustomer] = useState(initialCustomer);
  const [customerBackendId, setCustomerBackendId] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAuthorizer = user?.role === 'authorizer';
  const isMarketer = user?.role === 'marketer';
  // Mutable customer status
  const [customerStatus, setCustomerStatus] = useState(customer.status);
  // Action modal state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // Mutable KYC state
  const [kycStatuses, setKycStatuses] = useState({
    bvn: customer.kyc.bvn.status as string,
    nin: customer.kyc.nin.status as string,
    utilityBill: customer.kyc.utilityBill.status as string,
    passportPhoto: customer.kyc.passportPhoto.status as string,
    biometric: customer.kyc.biometric.status as string
  });
  // Modal states
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [kycVerifyModalOpen, setKycVerifyModalOpen] = useState(false);
  const [kycVerifyType, setKycVerifyType] = useState<
    'bvn' | 'nin' | 'utilityBill' | 'passportPhoto'>(
    'bvn');
  const [kycOverviewOpen, setKycOverviewOpen] = useState(false);
  const [isTabEditModalOpen, setIsTabEditModalOpen] = useState(false);
  const [editingTabKey, setEditingTabKey] = useState<string>('personal');
  const [isSavingTabEdit, setIsSavingTabEdit] = useState(false);
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
  }>({
    message: '',
    visible: false
  });
  const [customerFees, setCustomerFees] = useState<CustomerFeeItem[]>([]);
  const [customerFeePaymentHistory, setCustomerFeePaymentHistory] = useState<CustomerFeePaymentHistoryItem[]>([]);
  const [branchBankOptions, setBranchBankOptions] = useState<BranchBankOption[]>([]);
  const [selectedDestinationBankAccountId, setSelectedDestinationBankAccountId] = useState('');
  const [expandedPaidFeeKeys, setExpandedPaidFeeKeys] = useState<Record<string, boolean>>({});
  const [customerLoans, setCustomerLoans] = useState<CustomerLoanItem[]>([]);
  const hasApprovedLoan = customerLoans.some((loan) => {
    const normalizedLoanStatus = typeof loan.status === 'string' ? loan.status.trim().toLowerCase() : '';
    return normalizedLoanStatus === 'approved' || normalizedLoanStatus === 'active' || normalizedLoanStatus === 'disbursed';
  });
  const canEditCustomerRecord = isSuperAdmin || (isMarketer && !customer.isApproved && !hasApprovedLoan);
  const canChangeCustomerPhoto = isMarketer && !customer.isApproved && !hasApprovedLoan;
  const canEditActiveTab = canEditCustomerRecord && EDITABLE_TAB_KEYS.has(activeTab);
  const [loanProductOptions, setLoanProductOptions] = useState<CustomerLoanProductOption[]>([]);
  const [loanFeeRules, setLoanFeeRules] = useState<CustomerLoanFeeRule[]>([]);
  const [isLoadingCustomerLoans, setIsLoadingCustomerLoans] = useState(false);
  const [isRaiseLoanModalOpen, setIsRaiseLoanModalOpen] = useState(false);
  const [selectedLoanProductType, setSelectedLoanProductType] = useState('');
  const [loanPrincipalAmount, setLoanPrincipalAmount] = useState('');
  const [loanRepaymentFrequency, setLoanRepaymentFrequency] = useState<'Weekly' | 'Bi-Weekly' | 'Monthly'>('Monthly');
  const [loanGracePeriodDays, setLoanGracePeriodDays] = useState('7');
  const [loanFirstPaymentDate, setLoanFirstPaymentDate] = useState('');
  const [loanMaturityDate, setLoanMaturityDate] = useState('');
  const [isLoanMaturityDateManuallyOverridden, setIsLoanMaturityDateManuallyOverridden] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanRemarks, setLoanRemarks] = useState('');
  const [isSubmittingLoanApplication, setIsSubmittingLoanApplication] = useState(false);
  const [resubmittingLoanId, setResubmittingLoanId] = useState<string | null>(null);
  const [selectedLoanForResubmission, setSelectedLoanForResubmission] = useState<CustomerLoanItem | null>(null);
  const [isLoadingCustomerFees, setIsLoadingCustomerFees] = useState(false);
  const [isPayFeeModalOpen, setIsPayFeeModalOpen] = useState(false);
  const [selectedFeeForPayment, setSelectedFeeForPayment] = useState<CustomerFeeItem | null>(null);
  const [feePaymentMethod, setFeePaymentMethod] = useState('Cash');
  const [feePaymentReference, setFeePaymentReference] = useState('');
  const [feePaymentNote, setFeePaymentNote] = useState('');
  const [isSubmittingFeePayment, setIsSubmittingFeePayment] = useState(false);
  const openLoanDetailPage = (loan: CustomerLoanItem) => {
    const loanId = loan.id;

    if (!loanId) {
      showToast('Loan details are unavailable for this record');
      return;
    }

    const basePath = isMarketer ? '/marketer/loan-manager/loans' : '/loan-manager/loans';
    navigate(`${basePath}/${encodeURIComponent(loanId)}`, {
      state: {
        selectedLoan: loan,
        customerBackendId,
        customerId: customer.id,
        customerName: customer.name,
      },
    });
  };

  function showToast(message: string) {
    setToast({
      message,
      visible: true
    });
    setTimeout(
      () =>
      setToast((t) => ({
        ...t,
        visible: false
      })),
      3000
    );
  }

  const loadCustomerFees = async (backendCustomerId: string) => {
    try {
      setIsLoadingCustomerFees(true);
      const response = await api.get(`/customers/${backendCustomerId}/fees`);
      const fees = extractCustomerFees(response);
      const paymentHistory = extractCustomerFeePaymentHistory(response);
      const bankOptions = extractBranchBankOptions(response);
      setCustomerFees(fees);
      setCustomerFeePaymentHistory(paymentHistory);
      setBranchBankOptions(bankOptions);
    } catch {
      setCustomerFees([]);
      setCustomerFeePaymentHistory([]);
      setBranchBankOptions([]);
    } finally {
      setIsLoadingCustomerFees(false);
    }
  };

  const loadCustomerLoans = async (backendCustomerId: string) => {
    try {
      setIsLoadingCustomerLoans(true);
      const response = await api.get(`/customers/${backendCustomerId}/loans`);
      const loans = extractCustomerLoans(response);
      setCustomerLoans(loans);
    } catch {
      setCustomerLoans([]);
    } finally {
      setIsLoadingCustomerLoans(false);
    }
  };

  const loadCustomerLoanProducts = useCallback(async (backendCustomerId: string) => {
    try {
      const loanProductsEndpoint = isSuperAdmin
        ? '/admin/business-rules/loan-products'
        : '/business-rules/loan-products';
      const adminResponse = await api.get(loanProductsEndpoint);
      const parsedAdmin = extractCustomerLoanProductOptions(adminResponse);
      setLoanProductOptions(parsedAdmin.loanProducts.filter((option) => option.isActive));

      try {
        const customerResponse = await api.get(`/customers/${backendCustomerId}/loan-products`);
        const parsedCustomer = extractCustomerLoanProductOptions(customerResponse);
        setLoanFeeRules(parsedCustomer.loanFeeRules);
      } catch {
        setLoanFeeRules([]);
      }
    } catch {
      setLoanProductOptions([]);
      setLoanFeeRules([]);
    }
  }, [isSuperAdmin]);

  const selectedLoanProduct = useMemo(
    () => loanProductOptions.find((item) => item.productType === selectedLoanProductType) ?? null,
    [loanProductOptions, selectedLoanProductType],
  );

  const computedLoanProcessingFee = useMemo(() => {
    const principalAmount = Number(loanPrincipalAmount);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      return 0;
    }

    return loanFeeRules.reduce((total, feeRule) => {
      if (feeRule.chargingType === 'percentage') {
        return total + (principalAmount * feeRule.amount) / 100;
      }

      return total + feeRule.amount;
    }, 0);
  }, [loanPrincipalAmount, loanFeeRules]);

  useEffect(() => {
    if (!isRaiseLoanModalOpen) {
      return;
    }

    const calculatedFirstPaymentDate = calculateFirstPaymentDateFromFrequency(new Date(), loanRepaymentFrequency);
    setLoanFirstPaymentDate(calculatedFirstPaymentDate);
  }, [loanRepaymentFrequency, isRaiseLoanModalOpen]);

  useEffect(() => {
    if (isLoanMaturityDateManuallyOverridden) {
      return;
    }

    if (!loanFirstPaymentDate || !selectedLoanProduct) {
      setLoanMaturityDate('');
      return;
    }

    setLoanMaturityDate(calculateMaturityDate(loanFirstPaymentDate, selectedLoanProduct.durationWeeks));
  }, [loanFirstPaymentDate, selectedLoanProduct, isLoanMaturityDateManuallyOverridden]);

  const handleLoanMaturityDateChange = (value: string) => {
    setLoanMaturityDate(value);
    setIsLoanMaturityDateManuallyOverridden(Boolean(value));
  };

  const openPayFeeModal = (fee: CustomerFeeItem) => {
    setSelectedFeeForPayment(fee);
    setFeePaymentMethod('Cash');
    const currentBank = branchBankOptions.find((option) => option.isCurrent) ?? branchBankOptions[0];
    setSelectedDestinationBankAccountId(currentBank?.id ?? '');
    setFeePaymentReference('');
    setFeePaymentNote('');
    setIsPayFeeModalOpen(true);
  };

  const closePayFeeModal = () => {
    setIsPayFeeModalOpen(false);
    setSelectedFeeForPayment(null);
    setFeePaymentMethod('Cash');
    setSelectedDestinationBankAccountId('');
    setFeePaymentReference('');
    setFeePaymentNote('');
    setIsSubmittingFeePayment(false);
  };

  const togglePaidFeeAccordion = (feeKey: string) => {
    setExpandedPaidFeeKeys((previous) => ({
      ...previous,
      [feeKey]: !previous[feeKey],
    }));
  };

  const closeRaiseLoanModal = () => {
    setIsRaiseLoanModalOpen(false);
    setSelectedLoanProductType('');
    setLoanPrincipalAmount('');
    setLoanRepaymentFrequency('Monthly');
    setLoanGracePeriodDays('7');
    setLoanFirstPaymentDate('');
    setLoanMaturityDate('');
    setIsLoanMaturityDateManuallyOverridden(false);
    setLoanPurpose('');
    setLoanRemarks('');
    setIsSubmittingLoanApplication(false);
  };

  const openRaiseLoanModal = () => {
    if (!isMarketer) {
      showToast('Only marketers can raise loan applications from this page');
      return;
    }

    if (!canEditCustomerRecord) {
      showToast('Marketers cannot raise loans for approved customers or approved loans');
      return;
    }

    if (loanProductOptions.length === 0) {
      showToast('No active loan product configured by super admin');
      return;
    }

    if (!selectedLoanProductType) {
      setSelectedLoanProductType(loanProductOptions[0]?.productType ?? '');
    }

    setIsRaiseLoanModalOpen(true);
  };

  const submitRaiseLoanApplication = async () => {
    if (!isMarketer) {
      showToast('Only marketers can raise loan applications from this page');
      return;
    }

    if (!canEditCustomerRecord) {
      showToast('Marketers cannot raise loans for approved customers or approved loans');
      return;
    }

    if (!customerBackendId) {
      showToast('No backend customer record found to raise loan');
      return;
    }

    const principalAmount = Number(loanPrincipalAmount);
    const gracePeriodDays = Number(loanGracePeriodDays);

    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      showToast('Enter a valid principal amount');
      return;
    }

    if (!selectedLoanProductType) {
      showToast('Select a loan product');
      return;
    }

    if (!Number.isFinite(gracePeriodDays) || gracePeriodDays < 0) {
      showToast('Enter a valid grace period');
      return;
    }

    if (!loanFirstPaymentDate) {
      showToast('Select first payment date');
      return;
    }

    if (!loanMaturityDate) {
      showToast('Select maturity date');
      return;
    }

    if (new Date(loanMaturityDate).getTime() < new Date(loanFirstPaymentDate).getTime()) {
      showToast('Maturity date cannot be before first payment date');
      return;
    }

    if (!loanPurpose.trim()) {
      showToast('Enter loan purpose');
      return;
    }

    try {
      setIsSubmittingLoanApplication(true);
      await api.post(`/customers/${customerBackendId}/loans`, {
        principalAmount,
        loanProductId: selectedLoanProduct?.id,
        loanProductType: selectedLoanProductType,
        repaymentFrequency: loanRepaymentFrequency,
        gracePeriod: gracePeriodDays,
        gracePeriodDays,
        firstPaymentDate: loanFirstPaymentDate,
        maturityDate: loanMaturityDate,
        purpose: loanPurpose.trim(),
        remarks: loanRemarks.trim() || undefined,
      });

      showToast('Loan application raised successfully');
      closeRaiseLoanModal();
      await loadCustomerLoans(customerBackendId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to raise loan application';
      showToast(message);
    } finally {
      setIsSubmittingLoanApplication(false);
    }
  };

  const resubmitLoanApplication = async (loanId: string, remarks?: string) => {
    if (!isMarketer) {
      showToast('Only marketers can resubmit loan applications');
      return;
    }

    if (!customerBackendId) {
      showToast('No backend customer record found to refresh loan applications');
      return;
    }

    if (!loanId) {
      showToast('Loan id is required to resubmit application');
      return;
    }

    try {
      setResubmittingLoanId(loanId);
      await api.post(`/loans/${encodeURIComponent(loanId)}/submit`, {
        remarks: typeof remarks === 'string' && remarks.trim().length > 0 ? remarks.trim() : undefined,
      });
      showToast('Loan application resubmitted successfully');
      await loadCustomerLoans(customerBackendId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resubmit loan application';
      showToast(message);
    } finally {
      setResubmittingLoanId(null);
    }
  };

  const openResubmitLoanModal = (loan: CustomerLoanItem) => {
    setSelectedLoanForResubmission(loan);
    setActiveModal('resubmit-loan');
  };

  const closeResubmitLoanModal = () => {
    setActiveModal(null);
    setSelectedLoanForResubmission(null);
  };

  const confirmResubmitLoan = async (inputValue?: string) => {
    if (!selectedLoanForResubmission) {
      closeResubmitLoanModal();
      return;
    }

    await resubmitLoanApplication(selectedLoanForResubmission.id, inputValue);
    closeResubmitLoanModal();
  };

  const submitFeePayment = async () => {
    if (!customerBackendId || !selectedFeeForPayment) {
      showToast('No fee selected for payment');
      return;
    }

    if (!selectedDestinationBankAccountId) {
      showToast('Select destination bank account');
      return;
    }

    try {
      setIsSubmittingFeePayment(true);
      await api.post(`/customers/${customerBackendId}/fees/pay`, {
        category: selectedFeeForPayment.category,
        feeTitle: selectedFeeForPayment.feeTitle,
        amount: selectedFeeForPayment.amount,
        paymentMethod: feePaymentMethod,
        destinationBankAccountId: selectedDestinationBankAccountId,
        reference: feePaymentReference || undefined,
        note: feePaymentNote || undefined,
      });

      showToast(`${selectedFeeForPayment.feeTitle} paid successfully`);
      closePayFeeModal();
      await loadCustomerFees(customerBackendId);

      const response = await api.get(`/customers/${customerBackendId}`);
      const latestCustomer = extractItem<Record<string, unknown>>(response);
      const mapped = latestCustomer ? mapApiCustomerToView(latestCustomer, customer, id || customer.id) : null;
      if (mapped) {
        setCustomer(mapped);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process fee payment';
      showToast(message);
    } finally {
      setIsSubmittingFeePayment(false);
    }
  };

  const personalEditValidationSchema = useMemo(
    () =>
      Yup.object({
        fullName: Yup.string().trim().required('Full name is required'),
        phoneNumber: Yup.string()
          .trim()
          .required('Phone number is required')
          .matches(/^\d{7,15}$/, 'Phone number must contain 7 to 15 digits'),
        email: Yup.string().trim().email('Enter a valid email').optional(),
        dateOfBirth: Yup.string().trim().matches(/^$|^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format').optional(),
        gender: Yup.string().oneOf(['', 'Male', 'Female', 'Other']).optional(),
        residentialAddress: Yup.string().trim().required('Residential address is required'),
        officeAddress: Yup.string().trim().optional(),
        lga: Yup.string().trim().optional(),
        state: Yup.string().trim().optional(),
        nin: Yup.string().trim().matches(/^$|^\d{11}$/, 'NIN must be exactly 11 digits').optional(),
        nextOfKinName: Yup.string().trim().optional(),
        nextOfKinPhone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Next of kin phone must contain 7 to 15 digits').optional(),
        nextOfKinRelationship: Yup.string().trim().optional(),
      }),
    [],
  );

  const guarantorEditValidationSchema = useMemo(
    () =>
      Yup.object({
        guarantor1Name: Yup.string().trim().optional(),
        guarantor1Phone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Phone number must contain 7 to 15 digits').optional(),
        guarantor1Email: Yup.string().trim().email('Enter a valid email').optional(),
        guarantor1Address: Yup.string().trim().optional(),
        guarantor1Relationship: Yup.string().trim().optional(),
        guarantor1Occupation: Yup.string().trim().optional(),
        guarantor2Name: Yup.string().trim().optional(),
        guarantor2Phone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Phone number must contain 7 to 15 digits').optional(),
        guarantor2Email: Yup.string().trim().email('Enter a valid email').optional(),
        guarantor2Address: Yup.string().trim().optional(),
        guarantor2Relationship: Yup.string().trim().optional(),
        guarantor2Occupation: Yup.string().trim().optional(),
        guarantor3Name: Yup.string().trim().optional(),
        guarantor3Phone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Phone number must contain 7 to 15 digits').optional(),
        guarantor3Email: Yup.string().trim().email('Enter a valid email').optional(),
        guarantor3Address: Yup.string().trim().optional(),
        guarantor3Relationship: Yup.string().trim().optional(),
        guarantor3Occupation: Yup.string().trim().optional(),
      })
        .test('guarantor-1-pair', 'Guarantor 1 name and phone must both be provided', (values) => {
          const hasName = Boolean(values?.guarantor1Name?.trim());
          const hasPhone = Boolean(values?.guarantor1Phone?.trim());
          return hasName === hasPhone;
        })
        .test('guarantor-2-pair', 'Guarantor 2 name and phone must both be provided', (values) => {
          const hasName = Boolean(values?.guarantor2Name?.trim());
          const hasPhone = Boolean(values?.guarantor2Phone?.trim());
          return hasName === hasPhone;
        })
        .test('guarantor-3-pair', 'Guarantor 3 name and phone must both be provided', (values) => {
          const hasName = Boolean(values?.guarantor3Name?.trim());
          const hasPhone = Boolean(values?.guarantor3Phone?.trim());
          return hasName === hasPhone;
        }),
    [],
  );

  const referenceEditValidationSchema = useMemo(
    () =>
      Yup.object({
        referenceName: Yup.string().trim().optional(),
        referencePhone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Phone number must contain 7 to 15 digits').optional(),
        referenceAddress: Yup.string().trim().optional(),
        referenceRelationship: Yup.string().trim().optional(),
        referenceOccupation: Yup.string().trim().optional(),
        referenceYearsKnown: Yup.string().trim().optional(),
      }).test('reference-name-phone-pair', 'Reference name and phone must both be provided', (values) => {
        const hasName = Boolean(values?.referenceName?.trim());
        const hasPhone = Boolean(values?.referencePhone?.trim());
        return hasName === hasPhone;
      }),
    [],
  );

  const submitCustomerUpdate = async (payload: Record<string, unknown>) => {
    if (!canEditCustomerRecord) {
      showToast('You do not have permission to update this customer record');
      return;
    }

    if (!customerBackendId) {
      showToast('No backend customer record found to update');
      return;
    }

    try {
      setIsSavingTabEdit(true);
      const response = await api.patch(`/customers/${customerBackendId}/profile-sections`, payload);
      const updated = extractItem<Record<string, unknown>>(response);
      const mapped = updated ? mapApiCustomerToView(updated, customer, id || customer.id) : null;

      if (mapped) {
        setCustomer(mapped);
        setCustomerStatus(mapped.status);
      }

      setIsTabEditModalOpen(false);
      showToast('Customer record updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update customer';
      showToast(message);
    } finally {
      setIsSavingTabEdit(false);
    }
  };

  const personalEditFormik = useFormik<PersonalEditFormValues>({
    initialValues: {
      fullName: '',
      phoneNumber: '',
      email: '',
      dateOfBirth: '',
      gender: '',
      residentialAddress: '',
      officeAddress: '',
      lga: '',
      state: '',
      nin: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
      nextOfKinRelationship: '',
    },
    validationSchema: personalEditValidationSchema,
    onSubmit: async (values) => {
      const splitName = splitCustomerName(values.fullName || '');
      await submitCustomerUpdate({
        firstName: splitName.firstName || undefined,
        lastName: splitName.lastName || undefined,
        phoneNumber: values.phoneNumber || undefined,
        email: values.email || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        residentialAddress: values.residentialAddress || undefined,
        officeAddress: values.officeAddress || undefined,
        lga: values.lga || undefined,
        state: values.state || undefined,
        nin: values.nin || undefined,
        nok: {
          fullName: values.nextOfKinName || undefined,
          phoneNumber: values.nextOfKinPhone || undefined,
          relationship: values.nextOfKinRelationship || undefined,
        },
      });
    },
  });

  const guarantorEditFormik = useFormik<GuarantorEditFormValues>({
    initialValues: {
      guarantor1Name: '',
      guarantor1Phone: '',
      guarantor1Email: '',
      guarantor1Address: '',
      guarantor1Relationship: '',
      guarantor1Occupation: '',
      guarantor2Name: '',
      guarantor2Phone: '',
      guarantor2Email: '',
      guarantor2Address: '',
      guarantor2Relationship: '',
      guarantor2Occupation: '',
      guarantor3Name: '',
      guarantor3Phone: '',
      guarantor3Email: '',
      guarantor3Address: '',
      guarantor3Relationship: '',
      guarantor3Occupation: '',
    },
    validationSchema: guarantorEditValidationSchema,
    onSubmit: async (values) => {
      await submitCustomerUpdate({
        guarantor1: {
          fullName: values.guarantor1Name || undefined,
          phoneNumber: values.guarantor1Phone || undefined,
          email: values.guarantor1Email || undefined,
          address: values.guarantor1Address || undefined,
          relationship: values.guarantor1Relationship || undefined,
          occupation: values.guarantor1Occupation || undefined,
        },
        guarantor2: {
          fullName: values.guarantor2Name || undefined,
          phoneNumber: values.guarantor2Phone || undefined,
          email: values.guarantor2Email || undefined,
          address: values.guarantor2Address || undefined,
          relationship: values.guarantor2Relationship || undefined,
          occupation: values.guarantor2Occupation || undefined,
        },
        guarantor3: {
          fullName: values.guarantor3Name || undefined,
          phoneNumber: values.guarantor3Phone || undefined,
          email: values.guarantor3Email || undefined,
          address: values.guarantor3Address || undefined,
          relationship: values.guarantor3Relationship || undefined,
          occupation: values.guarantor3Occupation || undefined,
        },
      });
    },
  });

  const referenceEditFormik = useFormik<ReferenceEditFormValues>({
    initialValues: {
      referenceName: '',
      referencePhone: '',
      referenceAddress: '',
      referenceRelationship: '',
      referenceOccupation: '',
      referenceYearsKnown: '',
    },
    validationSchema: referenceEditValidationSchema,
    onSubmit: async (values) => {
      await submitCustomerUpdate({
        reference: {
          name: values.referenceName || undefined,
          phone: values.referencePhone || undefined,
          address: values.referenceAddress || undefined,
          relationship: values.referenceRelationship || undefined,
          occupation: values.referenceOccupation || undefined,
          yearsKnown: values.referenceYearsKnown || undefined,
        },
      });
    },
  });

  const stateSelectOptions = useMemo(() => {
    const selectedState = personalEditFormik.values.state.trim();
    if (!selectedState || NIGERIAN_STATE_OPTIONS.some((option) => option.value === selectedState)) {
      return NIGERIAN_STATE_OPTIONS;
    }

    return [{ label: selectedState, value: selectedState }, ...NIGERIAN_STATE_OPTIONS];
  }, [personalEditFormik.values.state]);

  const lgaSelectOptions = useMemo(() => {
    const selectedState = personalEditFormik.values.state.trim();
    const selectedLga = personalEditFormik.values.lga.trim();
    const baseOptions = selectedState ? LGA_OPTIONS_BY_STATE[selectedState] ?? [] : [];

    if (!selectedLga || baseOptions.some((option) => option.value === selectedLga)) {
      return baseOptions;
    }

    return [{ label: selectedLga, value: selectedLga }, ...baseOptions];
  }, [personalEditFormik.values.state, personalEditFormik.values.lga]);

  const openTabEditModal = (tabKey: string) => {
    if (!EDITABLE_TAB_KEYS.has(tabKey)) {
      return;
    }

    if (!canEditCustomerRecord) {
      showToast('You do not have permission to update this customer record');
      return;
    }

    setEditingTabKey(tabKey);

    if (tabKey === 'personal') {
      personalEditFormik.setValues({
        fullName: customer.name || '',
        phoneNumber: customer.phone || '',
        email: customer.email || '',
        dateOfBirth: customer.dob || '',
        gender: customer.gender || '',
        residentialAddress: customer.address || '',
        officeAddress: customer.officeAddress || '',
        lga: customer.lga || '',
        state: customer.state || '',
        nin: customer.kyc?.nin?.number || '',
        nextOfKinName: customer.nextOfKin?.name || '',
        nextOfKinPhone: customer.nextOfKin?.phone || '',
        nextOfKinRelationship: customer.nextOfKin?.relationship || '',
      });
      personalEditFormik.setTouched({});
      personalEditFormik.setErrors({});
    } else if (tabKey === 'guarantors') {
      guarantorEditFormik.setValues({
        guarantor1Name: normalizeEditableValue(customer.guarantors?.[0]?.name),
        guarantor1Phone: normalizeEditableValue(customer.guarantors?.[0]?.phone),
        guarantor1Email: normalizeEditableValue(customer.guarantors?.[0]?.email),
        guarantor1Address: normalizeEditableValue(customer.guarantors?.[0]?.address),
        guarantor1Relationship: normalizeEditableValue(customer.guarantors?.[0]?.relationship),
        guarantor1Occupation: normalizeEditableValue(customer.guarantors?.[0]?.occupation),
        guarantor2Name: normalizeEditableValue(customer.guarantors?.[1]?.name),
        guarantor2Phone: normalizeEditableValue(customer.guarantors?.[1]?.phone),
        guarantor2Email: normalizeEditableValue(customer.guarantors?.[1]?.email),
        guarantor2Address: normalizeEditableValue(customer.guarantors?.[1]?.address),
        guarantor2Relationship: normalizeEditableValue(customer.guarantors?.[1]?.relationship),
        guarantor2Occupation: normalizeEditableValue(customer.guarantors?.[1]?.occupation),
        guarantor3Name: normalizeEditableValue(customer.guarantors?.[2]?.name),
        guarantor3Phone: normalizeEditableValue(customer.guarantors?.[2]?.phone),
        guarantor3Email: normalizeEditableValue(customer.guarantors?.[2]?.email),
        guarantor3Address: normalizeEditableValue(customer.guarantors?.[2]?.address),
        guarantor3Relationship: normalizeEditableValue(customer.guarantors?.[2]?.relationship),
        guarantor3Occupation: normalizeEditableValue(customer.guarantors?.[2]?.occupation),
      });
      guarantorEditFormik.setTouched({});
      guarantorEditFormik.setErrors({});
    } else if (tabKey === 'reference') {
      referenceEditFormik.setValues({
        referenceName: normalizeEditableValue(customer.reference?.name),
        referencePhone: normalizeEditableValue(customer.reference?.phone),
        referenceAddress: normalizeEditableValue(customer.reference?.address),
        referenceRelationship: normalizeEditableValue(customer.reference?.relationship),
        referenceOccupation: normalizeEditableValue(customer.reference?.occupation),
        referenceYearsKnown: normalizeEditableValue(customer.reference?.yearsKnown),
      });
      referenceEditFormik.setTouched({});
      referenceEditFormik.setErrors({});
    }

    setIsTabEditModalOpen(true);
  };

  const saveTabEdits = async () => {
    if (!canEditCustomerRecord) {
      showToast('You do not have permission to update this customer record');
      return;
    }

    const payload: Record<string, unknown> = {};

    if (editingTabKey === 'personal') {
      await personalEditFormik.submitForm();
      return;
    } else if (editingTabKey === 'guarantors') {
      await guarantorEditFormik.submitForm();
      return;
    } else if (editingTabKey === 'reference') {
      await referenceEditFormik.submitForm();
      return;
    } else {
      showToast('No editable fields available for this tab yet');
      setIsTabEditModalOpen(false);
      return;
    }

    await submitCustomerUpdate(payload);
  };

  useEffect(() => {
    const routeId = typeof id === 'string' ? id.trim() : '';
    const fallbackCustomer = createEmptyCustomer(routeId);

    setCustomer(fallbackCustomer);
    setCustomerStatus(fallbackCustomer.status);
    setKycStatuses({
      bvn: fallbackCustomer.kyc.bvn.status as string,
      nin: fallbackCustomer.kyc.nin.status as string,
      utilityBill: fallbackCustomer.kyc.utilityBill.status as string,
      passportPhoto: fallbackCustomer.kyc.passportPhoto.status as string,
      biometric: fallbackCustomer.kyc.biometric.status as string,
    });
    setCustomerBackendId(null);
    setCustomerFees([]);
    setCustomerFeePaymentHistory([]);
    setBranchBankOptions([]);
    setExpandedPaidFeeKeys({});
    setCustomerLoans([]);
    setLoanProductOptions([]);
    setLoanFeeRules([]);
    closeRaiseLoanModal();
    closePayFeeModal();

    let isMounted = true;

    const loadBackendCustomer = async () => {
      if (!routeId) {
        return;
      }

      try {
        const response = await api.get(`/customers/${encodeURIComponent(routeId)}`);
        const matched = extractItem<Record<string, unknown>>(response);

        if (!matched || !isMounted) {
          return;
        }

        const mapped = mapApiCustomerToView(matched, fallbackCustomer, routeId);
        if (!mapped) {
          return;
        }

        setCustomer(mapped);
        setCustomerStatus(mapped.status);
        setKycStatuses({
          bvn: mapped.kyc.bvn.status as string,
          nin: mapped.kyc.nin.status as string,
          utilityBill: mapped.kyc.utilityBill.status as string,
          passportPhoto: mapped.kyc.passportPhoto.status as string,
          biometric: mapped.kyc.biometric.status as string,
        });
        const backendId = typeof mapped.backendId === 'string' ? mapped.backendId : null;
        setCustomerBackendId(backendId);
        if (backendId) {
          void loadCustomerFees(backendId);
          void loadCustomerLoans(backendId);
          void loadCustomerLoanProducts(backendId);
        }
      } catch {
        // keep empty template when request fails
      }
    };

    void loadBackendCustomer();

    return () => {
      isMounted = false;
    };
  }, [id, loadCustomerLoanProducts]);

  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canChangeCustomerPhoto) {
      showToast('You do not have permission to change this customer photo');
      return;
    }

    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }

    const preparedFile = await compressImageFile(selectedFile, {
      maxWidth: 960,
      maxHeight: 960,
      quality: 0.82,
      outputType: 'image/jpeg',
    });

    const localPreviewUrl = URL.createObjectURL(preparedFile);
    setCustomer((previous) => ({
      ...previous,
      avatar: localPreviewUrl,
    }));

    if (!customerBackendId) {
      showToast('No backend customer record found; profile photo updated locally');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('profilePic', preparedFile);

      const response = await api.patch<Record<string, unknown>, FormData>(
        `/customers/${customerBackendId}/profile-sections`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      const responseSource = response as {
        data?: Record<string, unknown>;
        payload?: Record<string, unknown>;
      };
      const payload = responseSource.data ?? responseSource.payload ?? response;
      const profilePic =
        payload && typeof payload.profilePic === 'object' && payload.profilePic !== null
          ? (payload.profilePic as Record<string, unknown>)
          : null;
      const uploadedUrl =
        (profilePic && typeof profilePic.url === 'string' ? profilePic.url : null) ||
        (typeof payload.avatar === 'string' ? payload.avatar : null);

      if (uploadedUrl) {
        setCustomer((previous) => ({
          ...previous,
          avatar: uploadedUrl,
        }));
      }

      showToast('Profile photo updated successfully');
    } catch {
      showToast('Profile photo updated locally (upload failed)');
    } finally {
      setIsUploadingAvatar(false);
    }
  }
  async function handleCustomerAction(action: string, inputValue?: string) {
    setActiveModal(null);

    if (action === 'blacklist' && !isSuperAdmin) {
      showToast('Only super admin can blacklist customers');
      return;
    }

    if (!customerBackendId) {
      showToast('No backend customer record found to update');
      return;
    }

    const trimmedInput = typeof inputValue === 'string' ? inputValue.trim() : '';

    const endpointByAction: Record<string, string> = {
      approve: `/customers/${customerBackendId}/approve`,
      reject: `/customers/${customerBackendId}/reject`,
      blacklist: `/customers/${customerBackendId}/blacklist`,
    };

    const payloadByAction: Record<string, Record<string, unknown> | undefined> = {
      approve: undefined,
      reject: { reasonForRejection: trimmedInput },
      blacklist: { reasonForBlacklisting: trimmedInput },
    };

    const endpoint = endpointByAction[action];
    if (!endpoint) {
      showToast('Unsupported action');
      return;
    }

    if ((action === 'reject' || action === 'blacklist') && trimmedInput.length === 0) {
      showToast('A reason is required for this action');
      return;
    }

    const statusUpdates: Record<string, string> = {
      approve: 'Approved',
      reject: 'Rejected',
      suspend: 'Suspended',
      activate: 'Approved'
    };
    const messages: Record<string, string> = {
      approve: `Customer ${customer.name} approved successfully`,
      reject: `Customer ${customer.name} has been rejected`,
      blacklist: `Customer ${customer.name} has been blacklisted`,
      suspend: `Customer ${customer.name} has been suspended`,
      activate: `Customer ${customer.name} has been activated`
    };

    try {
      const response = payloadByAction[action]
        ? await api.patch(endpoint, payloadByAction[action])
        : await api.patch(endpoint);

      const payload = extractItem<Record<string, unknown>>(response);
      const mapped = payload ? mapApiCustomerToView(payload, customer, id || customer.id) : null;

      if (mapped) {
        setCustomer(mapped);
        if (statusUpdates[action]) {
          setCustomerStatus(statusUpdates[action]);
        }
      } else if (statusUpdates[action]) {
        setCustomerStatus(statusUpdates[action]);
      }

      showToast(messages[action] || 'Action completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      showToast(message);
    }
  }
  function handleKycRowAction(type: string) {
    if (type === 'biometric') {
      setBiometricModalOpen(true);
    } else {
      if (type === 'bvn' || type === 'nin' || type === 'utilityBill' || type === 'passportPhoto') {
        setKycVerifyType(type as KycVerifyActionType);
      }
      setKycVerifyModalOpen(true);
    }
  }
  function handleBiometricComplete() {
    setKycStatuses((prev) => ({
      ...prev,
      biometric: 'Captured'
    }));
    showToast('Biometric fingerprint captured successfully');
  }
  function handleKycVerified(type: string) {
    setKycStatuses((prev) => ({
      ...prev,
      [type]: 'Verified'
    }));
    const labels: Record<string, string> = {
      bvn: 'BVN',
      nin: 'NIN',
      utilityBill: 'Utility Bill',
      passportPhoto: 'Passport Photo'
    };
    showToast(`${labels[type] || type} verified successfully`);
  }
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          animate={{
            opacity: 1,
            y: 0,
            x: '-50%'
          }}
          exit={{
            opacity: 0,
            y: -20,
            x: '-50%'
          }}
          className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body">
          
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Customer Action Modals */}
      <ConfirmationModal
        isOpen={activeModal === 'approve'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => handleCustomerAction('approve')}
        title="Approve Customer"
        description={`Are you sure you want to approve ${customer.name}? This will activate their account and allow them to participate in group loans.`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircleIcon size={20} />
          </div>
        }
        confirmLabel="Approve Customer"
        confirmVariant="primary" />
      
      <ConfirmationModal
        isOpen={activeModal === 'reject'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => handleCustomerAction('reject', val)}
        title="Reject Customer"
        description={`Are you sure you want to reject ${customer.name}'s application?`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <XCircleIcon size={20} />
          </div>
        }
        confirmLabel="Reject Customer"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="Provide the reason for rejecting this customer..."
        requireInput />

      <ConfirmationModal
        isOpen={activeModal === 'blacklist'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => {
          void handleCustomerAction('blacklist', val);
        }}
        title="Blacklist Customer"
        description={`Are you sure you want to blacklist ${customer.name}? This customer will be flagged for risk review.`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
            <AlertCircleIcon size={20} />
          </div>
        }
        confirmLabel="Blacklist Customer"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for blacklisting"
        inputPlaceholder="Provide the reason for blacklisting this customer..."
        requireInput />
      
      <ConfirmationModal
        isOpen={activeModal === 'suspend'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => handleCustomerAction('suspend', val)}
        title="Suspend Customer"
        description={`Are you sure you want to suspend ${customer.name}'s account? They will be unable to access loan services.`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <AlertCircleIcon size={20} />
          </div>
        }
        confirmLabel="Suspend Customer"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for suspension"
        inputPlaceholder="Provide the reason for suspension..."
        requireInput />
      
      <ConfirmationModal
        isOpen={activeModal === 'activate'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => handleCustomerAction('activate')}
        title="Activate Customer"
        description={`Are you sure you want to reactivate ${customer.name}'s account?`}
        icon={
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircleIcon size={20} />
          </div>
        }
        confirmLabel="Activate Customer"
        confirmVariant="primary" />

      <ConfirmationModal
        isOpen={activeModal === 'resubmit-loan'}
        onClose={closeResubmitLoanModal}
        onConfirm={(val) => {
          void confirmResubmitLoan(val);
        }}
        title="Resubmit Loan Application"
        description={selectedLoanForResubmission
          ? `Are you sure you want to resubmit loan ${selectedLoanForResubmission.loanCode}?`
          : 'Are you sure you want to resubmit this rejected loan application?'}
        icon={
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <SendIcon size={20} />
          </div>
        }
        confirmLabel="Resubmit Loan"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Resubmission note (optional)"
        inputPlaceholder="Add note for reviewers before resubmitting..." />

      <AnimatePresence>
        {isPayFeeModalOpen && selectedFeeForPayment &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4">

            <div className="absolute inset-0 bg-black/40" onClick={closePayFeeModal} />
            <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="relative w-full max-w-lg rounded-xl bg-white shadow-xl p-6 space-y-4">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-heading font-bold text-gray-800">Pay Fee</h3>
                  <p className="text-sm text-gray-500 font-body">
                    Record payment for <span className="font-semibold text-gray-700">{selectedFeeForPayment.feeTitle}</span>
                  </p>
                </div>
                <button
                type="button"
                onClick={closePayFeeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors">

                  <XCircleIcon size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">Category</p>
                  <p className="text-sm font-medium text-gray-800 capitalize">{selectedFeeForPayment.category}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">Amount</p>
                  <p className="text-sm font-medium text-gray-800">{formatNairaAmount(selectedFeeForPayment.amount)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Payment Method</label>
                <select
                value={feePaymentMethod}
                onChange={(event) => setFeePaymentMethod(event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">

                  {['Cash', 'Transfer', 'POS', 'USSD'].map((method) =>
                  <option key={method} value={method}>{method}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Bank Paid To</label>
                <select
                value={selectedDestinationBankAccountId}
                onChange={(event) => setSelectedDestinationBankAccountId(event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">

                  <option value="">Select branch bank account</option>
                  {branchBankOptions.map((option) =>
                  <option key={option.id} value={option.id}>
                      {option.bankName} • {option.accountNumber} ({option.accountName})
                    </option>
                  )}
                </select>
                {branchBankOptions.length === 0 &&
                <p className="text-xs text-amber-600">No branch bank account configured. Add one in branch settings first.</p>
                }
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Reference (optional)</label>
                <input
                value={feePaymentReference}
                onChange={(event) => setFeePaymentReference(event.target.value)}
                placeholder="Transaction/reference number"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Note (optional)</label>
                <textarea
                value={feePaymentNote}
                onChange={(event) => setFeePaymentNote(event.target.value)}
                rows={3}
                placeholder="Additional payment note"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                type="button"
                onClick={closePayFeeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-body text-gray-600 hover:bg-gray-50">

                  Cancel
                </button>
                <button
                type="button"
                onClick={() => {
                  void submitFeePayment();
                }}
                disabled={isSubmittingFeePayment || !selectedDestinationBankAccountId}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-body font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">

                  {isSubmittingFeePayment && <Loader2Icon size={14} className="animate-spin" />}
                  Record Payment
                </button>
              </div>
              {!selectedDestinationBankAccountId &&
              <p className="text-xs text-amber-600 text-right">Select a branch bank account to continue.</p>
              }
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {isRaiseLoanModalOpen &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4">

            <div className="absolute inset-0 bg-black/40" onClick={closeRaiseLoanModal} />
            <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="relative w-full max-w-xl rounded-xl bg-white shadow-xl p-6 space-y-4">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-heading font-bold text-gray-800">Raise Loan Application</h3>
                  <p className="text-sm text-gray-500 font-body">
                    Submit a new loan request for <span className="font-semibold text-gray-700">{customer.name}</span>
                  </p>
                </div>
                <button type="button" onClick={closeRaiseLoanModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XCircleIcon size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-gray-500 font-body">Loan Product</label>
                  <select
                  value={selectedLoanProductType}
                  onChange={(event) => setSelectedLoanProductType(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">

                    <option value="">Select loan product</option>
                    {loanProductOptions.map((product) =>
                    <option key={product.productType} value={product.productType}>
                        {product.productType}
                      </option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Principal Amount</label>
                  <input
                  type="number"
                  min="0"
                  value={loanPrincipalAmount}
                  onChange={(event) => setLoanPrincipalAmount(event.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Interest Rate (%)</label>
                  <input
                  type="number"
                  value={selectedLoanProduct ? selectedLoanProduct.interestRate : ''}
                  readOnly
                  placeholder="Auto from selected product"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Tenor (weeks)</label>
                  <input
                  type="number"
                  value={selectedLoanProduct ? selectedLoanProduct.durationWeeks : ''}
                  readOnly
                  placeholder="Auto from selected product"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Processing Fee</label>
                  <input
                  type="number"
                  value={Math.round(computedLoanProcessingFee * 100) / 100}
                  readOnly
                  placeholder="Auto from loan fee rules"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Repayment Frequency</label>
                  <select
                  value={loanRepaymentFrequency}
                  onChange={(event) => setLoanRepaymentFrequency(event.target.value as 'Weekly' | 'Bi-Weekly' | 'Monthly')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">

                    {['Weekly', 'Bi-Weekly', 'Monthly'].map((frequency) =>
                    <option key={frequency} value={frequency}>{frequency}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Grace Period (days)</label>
                  <input
                  type="number"
                  min="0"
                  value={loanGracePeriodDays}
                  onChange={(event) => setLoanGracePeriodDays(event.target.value)}
                  placeholder="e.g. 7"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">First Payment Date</label>
                  <input
                  type="date"
                  value={loanFirstPaymentDate}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <p className="text-[11px] text-gray-500 font-body">
                    Auto-calculated from initiation date and repayment frequency.
                  </p>

                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-body">Maturity Date</label>
                  <input
                  type="date"
                  value={loanMaturityDate}
                  onChange={(event) => handleLoanMaturityDateChange(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  {!isLoanMaturityDateManuallyOverridden && loanFirstPaymentDate && selectedLoanProduct ?
                  <p className="text-[11px] text-gray-500 font-body">
                      Auto-calculated from first payment date and tenor.
                    </p> :
                  null}

                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Purpose</label>
                <textarea
                value={loanPurpose}
                onChange={(event) => setLoanPurpose(event.target.value)}
                rows={2}
                placeholder="State the purpose of the loan"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-body">Application Remark (optional)</label>
                <textarea
                value={loanRemarks}
                onChange={(event) => setLoanRemarks(event.target.value)}
                rows={3}
                placeholder="Describe purpose or notes for this loan"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />

              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                type="button"
                onClick={closeRaiseLoanModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-body text-gray-600 hover:bg-gray-50">

                  Cancel
                </button>
                <button
                type="button"
                onClick={() => {
                  void submitRaiseLoanApplication();
                }}
                disabled={isSubmittingLoanApplication}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-body font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">

                  {isSubmittingLoanApplication && <Loader2Icon size={14} className="animate-spin" />}
                  Submit Application
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
      

      {/* Existing Modals */}
      <BiometricCaptureModal
        isOpen={biometricModalOpen}
        onClose={() => setBiometricModalOpen(false)}
        onComplete={handleBiometricComplete} />
      
      <KycVerificationModal
        isOpen={kycVerifyModalOpen}
        onClose={() => setKycVerifyModalOpen(false)}
        kycType={kycVerifyType}
        currentNumber={
        kycVerifyType === 'bvn' ?
        customer.kyc.bvn.number && customer.kyc.bvn.number !== '-' ?
        customer.kyc.bvn.number :
        undefined :
        kycVerifyType === 'nin' ?
        customer.kyc.nin.number :
        undefined
        }
        onVerified={(type) => handleKycVerified(type)} />
      
      <KycOverviewModal
        isOpen={kycOverviewOpen}
        onClose={() => setKycOverviewOpen(false)}
        kycStatuses={kycStatuses}
        onVerifyItem={(type) => handleKycRowAction(type)} />

      <AnimatePresence>
        {isTabEditModalOpen &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div className="absolute inset-0 bg-black/40" onClick={() => setIsTabEditModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">

              <h3 className="text-lg font-heading font-bold text-gray-900 mb-4">
                Update {editingTabKey.charAt(0).toUpperCase() + editingTabKey.slice(1)}
              </h3>

              {editingTabKey === 'personal' &&
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void personalEditFormik.submitForm();
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                  <ReusableInputField
                    label="Full Name"
                    name="fullName"
                    value={personalEditFormik.values.fullName}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter full name"
                    error={personalEditFormik.errors.fullName}
                    touched={personalEditFormik.touched.fullName}
                  />

                  <ReusableInputField
                    label="Phone Number"
                    name="phoneNumber"
                    value={personalEditFormik.values.phoneNumber}
                    onChange={(event) =>
                      personalEditFormik.setFieldValue('phoneNumber', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter phone number"
                    type="tel"
                    error={personalEditFormik.errors.phoneNumber}
                    touched={personalEditFormik.touched.phoneNumber}
                  />

                  <ReusableInputField
                    label="Email Address"
                    name="email"
                    value={personalEditFormik.values.email}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter email address"
                    type="email"
                    error={personalEditFormik.errors.email}
                    touched={personalEditFormik.touched.email}
                  />

                  <ReusableInputField
                    label="Date of Birth"
                    name="dateOfBirth"
                    value={personalEditFormik.values.dateOfBirth}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    type="date"
                    error={personalEditFormik.errors.dateOfBirth}
                    touched={personalEditFormik.touched.dateOfBirth}
                  />

                  <ReusableInputField
                    label="Gender"
                    name="gender"
                    as="select"
                    value={personalEditFormik.values.gender}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    options={[
                      { label: 'Male', value: 'Male' },
                      { label: 'Female', value: 'Female' },
                      { label: 'Other', value: 'Other' },
                    ]}
                    error={personalEditFormik.errors.gender}
                    touched={personalEditFormik.touched.gender}
                  />

                  <ReusableInputField
                    label="Residential Address"
                    name="residentialAddress"
                    value={personalEditFormik.values.residentialAddress}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter residential address"
                    error={personalEditFormik.errors.residentialAddress}
                    touched={personalEditFormik.touched.residentialAddress}
                  />

                  <ReusableInputField
                    label="Office Address"
                    name="officeAddress"
                    value={personalEditFormik.values.officeAddress}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter office address"
                    error={personalEditFormik.errors.officeAddress}
                    touched={personalEditFormik.touched.officeAddress}
                  />

                  <ReusableReactSelect
                    name="state"
                    label="State"
                    formik={personalEditFormik}
                    options={stateSelectOptions}
                    placeholder="Select state"
                  />

                  <ReusableReactSelect
                    name="lga"
                    label="LGA"
                    formik={personalEditFormik}
                    options={lgaSelectOptions}
                    placeholder={personalEditFormik.values.state ? 'Select LGA' : 'Select state first'}
                    isDisabled={!personalEditFormik.values.state}
                  />

                  <ReusableInputField
                    label="NIN"
                    name="nin"
                    value={personalEditFormik.values.nin}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter NIN"
                    error={personalEditFormik.errors.nin}
                    touched={personalEditFormik.touched.nin}
                  />

                  <ReusableInputField
                    label="Next of Kin Name"
                    name="nextOfKinName"
                    value={personalEditFormik.values.nextOfKinName}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter next of kin name"
                    error={personalEditFormik.errors.nextOfKinName}
                    touched={personalEditFormik.touched.nextOfKinName}
                  />

                  <ReusableInputField
                    label="Next of Kin Phone"
                    name="nextOfKinPhone"
                    value={personalEditFormik.values.nextOfKinPhone}
                    onChange={(event) =>
                      personalEditFormik.setFieldValue('nextOfKinPhone', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter next of kin phone"
                    type="tel"
                    error={personalEditFormik.errors.nextOfKinPhone}
                    touched={personalEditFormik.touched.nextOfKinPhone}
                  />

                  <ReusableInputField
                    label="Next of Kin Relationship"
                    name="nextOfKinRelationship"
                    value={personalEditFormik.values.nextOfKinRelationship}
                    onChange={personalEditFormik.handleChange}
                    onBlur={personalEditFormik.handleBlur}
                    placeholder="Enter relationship"
                    error={personalEditFormik.errors.nextOfKinRelationship}
                    touched={personalEditFormik.touched.nextOfKinRelationship}
                  />
                </form>
              }

              {editingTabKey === 'guarantors' &&
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void guarantorEditFormik.submitForm();
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                  <p className="sm:col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Guarantor 1</p>

                  <ReusableInputField
                    label="Guarantor 1 Name"
                    name="guarantor1Name"
                    value={guarantorEditFormik.values.guarantor1Name}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 1 name"
                    error={guarantorEditFormik.errors.guarantor1Name}
                    touched={guarantorEditFormik.touched.guarantor1Name}
                  />

                  <ReusableInputField
                    label="Guarantor 1 Phone"
                    name="guarantor1Phone"
                    value={guarantorEditFormik.values.guarantor1Phone}
                    onChange={(event) =>
                      guarantorEditFormik.setFieldValue('guarantor1Phone', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 1 phone"
                    type="tel"
                    error={guarantorEditFormik.errors.guarantor1Phone}
                    touched={guarantorEditFormik.touched.guarantor1Phone}
                  />

                  <ReusableInputField
                    label="Guarantor 1 Email"
                    name="guarantor1Email"
                    value={guarantorEditFormik.values.guarantor1Email}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 1 email"
                    type="email"
                    error={guarantorEditFormik.errors.guarantor1Email}
                    touched={guarantorEditFormik.touched.guarantor1Email}
                  />

                  <ReusableInputField
                    label="Guarantor 1 Relationship"
                    name="guarantor1Relationship"
                    value={guarantorEditFormik.values.guarantor1Relationship}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 1 relationship"
                    error={guarantorEditFormik.errors.guarantor1Relationship}
                    touched={guarantorEditFormik.touched.guarantor1Relationship}
                  />

                  <ReusableInputField
                    label="Guarantor 1 Occupation"
                    name="guarantor1Occupation"
                    value={guarantorEditFormik.values.guarantor1Occupation}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 1 occupation"
                    error={guarantorEditFormik.errors.guarantor1Occupation}
                    touched={guarantorEditFormik.touched.guarantor1Occupation}
                  />

                  <div className="sm:col-span-2">
                    <ReusableInputField
                      label="Guarantor 1 Address"
                      name="guarantor1Address"
                      value={guarantorEditFormik.values.guarantor1Address}
                      onChange={guarantorEditFormik.handleChange}
                      onBlur={guarantorEditFormik.handleBlur}
                      placeholder="Enter guarantor 1 address"
                      error={guarantorEditFormik.errors.guarantor1Address}
                      touched={guarantorEditFormik.touched.guarantor1Address}
                    />
                  </div>

                  <p className="sm:col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Guarantor 2</p>

                  <ReusableInputField
                    label="Guarantor 2 Name"
                    name="guarantor2Name"
                    value={guarantorEditFormik.values.guarantor2Name}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 2 name"
                    error={guarantorEditFormik.errors.guarantor2Name}
                    touched={guarantorEditFormik.touched.guarantor2Name}
                  />

                  <ReusableInputField
                    label="Guarantor 2 Phone"
                    name="guarantor2Phone"
                    value={guarantorEditFormik.values.guarantor2Phone}
                    onChange={(event) =>
                      guarantorEditFormik.setFieldValue('guarantor2Phone', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 2 phone"
                    type="tel"
                    error={guarantorEditFormik.errors.guarantor2Phone}
                    touched={guarantorEditFormik.touched.guarantor2Phone}
                  />

                  <ReusableInputField
                    label="Guarantor 2 Email"
                    name="guarantor2Email"
                    value={guarantorEditFormik.values.guarantor2Email}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 2 email"
                    type="email"
                    error={guarantorEditFormik.errors.guarantor2Email}
                    touched={guarantorEditFormik.touched.guarantor2Email}
                  />

                  <ReusableInputField
                    label="Guarantor 2 Relationship"
                    name="guarantor2Relationship"
                    value={guarantorEditFormik.values.guarantor2Relationship}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 2 relationship"
                    error={guarantorEditFormik.errors.guarantor2Relationship}
                    touched={guarantorEditFormik.touched.guarantor2Relationship}
                  />

                  <ReusableInputField
                    label="Guarantor 2 Occupation"
                    name="guarantor2Occupation"
                    value={guarantorEditFormik.values.guarantor2Occupation}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 2 occupation"
                    error={guarantorEditFormik.errors.guarantor2Occupation}
                    touched={guarantorEditFormik.touched.guarantor2Occupation}
                  />

                  <div className="sm:col-span-2">
                    <ReusableInputField
                      label="Guarantor 2 Address"
                      name="guarantor2Address"
                      value={guarantorEditFormik.values.guarantor2Address}
                      onChange={guarantorEditFormik.handleChange}
                      onBlur={guarantorEditFormik.handleBlur}
                      placeholder="Enter guarantor 2 address"
                      error={guarantorEditFormik.errors.guarantor2Address}
                      touched={guarantorEditFormik.touched.guarantor2Address}
                    />
                  </div>

                  <p className="sm:col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Guarantor 3</p>

                  <ReusableInputField
                    label="Guarantor 3 Name"
                    name="guarantor3Name"
                    value={guarantorEditFormik.values.guarantor3Name}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 3 name"
                    error={guarantorEditFormik.errors.guarantor3Name}
                    touched={guarantorEditFormik.touched.guarantor3Name}
                  />

                  <ReusableInputField
                    label="Guarantor 3 Phone"
                    name="guarantor3Phone"
                    value={guarantorEditFormik.values.guarantor3Phone}
                    onChange={(event) =>
                      guarantorEditFormik.setFieldValue('guarantor3Phone', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 3 phone"
                    type="tel"
                    error={guarantorEditFormik.errors.guarantor3Phone}
                    touched={guarantorEditFormik.touched.guarantor3Phone}
                  />

                  <ReusableInputField
                    label="Guarantor 3 Email"
                    name="guarantor3Email"
                    value={guarantorEditFormik.values.guarantor3Email}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 3 email"
                    type="email"
                    error={guarantorEditFormik.errors.guarantor3Email}
                    touched={guarantorEditFormik.touched.guarantor3Email}
                  />

                  <ReusableInputField
                    label="Guarantor 3 Relationship"
                    name="guarantor3Relationship"
                    value={guarantorEditFormik.values.guarantor3Relationship}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 3 relationship"
                    error={guarantorEditFormik.errors.guarantor3Relationship}
                    touched={guarantorEditFormik.touched.guarantor3Relationship}
                  />

                  <ReusableInputField
                    label="Guarantor 3 Occupation"
                    name="guarantor3Occupation"
                    value={guarantorEditFormik.values.guarantor3Occupation}
                    onChange={guarantorEditFormik.handleChange}
                    onBlur={guarantorEditFormik.handleBlur}
                    placeholder="Enter guarantor 3 occupation"
                    error={guarantorEditFormik.errors.guarantor3Occupation}
                    touched={guarantorEditFormik.touched.guarantor3Occupation}
                  />

                  <div className="sm:col-span-2">
                    <ReusableInputField
                      label="Guarantor 3 Address"
                      name="guarantor3Address"
                      value={guarantorEditFormik.values.guarantor3Address}
                      onChange={guarantorEditFormik.handleChange}
                      onBlur={guarantorEditFormik.handleBlur}
                      placeholder="Enter guarantor 3 address"
                      error={guarantorEditFormik.errors.guarantor3Address}
                      touched={guarantorEditFormik.touched.guarantor3Address}
                    />
                  </div>

                  {typeof guarantorEditFormik.errors === 'string' &&
                  <p className="text-xs text-red-600 sm:col-span-2">{guarantorEditFormik.errors}</p>
                  }
                </form>
              }

              {editingTabKey === 'reference' &&
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void referenceEditFormik.submitForm();
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

                  <ReusableInputField
                    label="Reference Name"
                    name="referenceName"
                    value={referenceEditFormik.values.referenceName}
                    onChange={referenceEditFormik.handleChange}
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter reference name"
                    error={referenceEditFormik.errors.referenceName}
                    touched={referenceEditFormik.touched.referenceName}
                  />

                  <ReusableInputField
                    label="Reference Phone"
                    name="referencePhone"
                    value={referenceEditFormik.values.referencePhone}
                    onChange={(event) =>
                      referenceEditFormik.setFieldValue('referencePhone', sanitizePhoneInput(event.target.value), true)
                    }
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter reference phone"
                    type="tel"
                    error={referenceEditFormik.errors.referencePhone}
                    touched={referenceEditFormik.touched.referencePhone}
                  />

                  <ReusableInputField
                    label="Reference Relationship"
                    name="referenceRelationship"
                    value={referenceEditFormik.values.referenceRelationship}
                    onChange={referenceEditFormik.handleChange}
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter reference relationship"
                    error={referenceEditFormik.errors.referenceRelationship}
                    touched={referenceEditFormik.touched.referenceRelationship}
                  />

                  <ReusableInputField
                    label="Reference Address"
                    name="referenceAddress"
                    value={referenceEditFormik.values.referenceAddress}
                    onChange={referenceEditFormik.handleChange}
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter reference address"
                    error={referenceEditFormik.errors.referenceAddress}
                    touched={referenceEditFormik.touched.referenceAddress}
                  />

                  <ReusableInputField
                    label="Reference Occupation"
                    name="referenceOccupation"
                    value={referenceEditFormik.values.referenceOccupation}
                    onChange={referenceEditFormik.handleChange}
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter reference occupation"
                    error={referenceEditFormik.errors.referenceOccupation}
                    touched={referenceEditFormik.touched.referenceOccupation}
                  />

                  <ReusableInputField
                    label="Years Known"
                    name="referenceYearsKnown"
                    value={referenceEditFormik.values.referenceYearsKnown}
                    onChange={referenceEditFormik.handleChange}
                    onBlur={referenceEditFormik.handleBlur}
                    placeholder="Enter years known"
                    error={referenceEditFormik.errors.referenceYearsKnown}
                    touched={referenceEditFormik.touched.referenceYearsKnown}
                  />

                  {typeof referenceEditFormik.errors === 'string' &&
                  <p className="text-xs text-red-600 sm:col-span-2">{referenceEditFormik.errors}</p>
                  }
                </form>
              }

              <div className="flex justify-end gap-3">
                <button onClick={() => setIsTabEditModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button onClick={() => void saveTabEdits()} disabled={isSavingTabEdit} className="px-4 py-2 bg-primary text-white text-sm rounded-lg disabled:opacity-60">
                  {isSavingTabEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
      

      {/* Back Button */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-sm font-body text-gray-500 hover:text-primary transition-colors">
        
        <ArrowLeftIcon size={16} />
        Back to Customers
      </button>

      {/* Profile Header */}
      <motion.div
        initial={{
          opacity: 0,
          y: 12
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        transition={{
          duration: 0.3
        }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <ProfileAvatar
            src={customer.avatar}
            name={customer.name}
            alt={customer.name}
            className="w-20 h-20 rounded-full border-4 border-primary/10"
            iconSize={30}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h2 className="text-2xl font-heading font-bold text-gray-900">
                {customer.name}
              </h2>
              <StatusBadge status={customerStatus as BadgeStatus} />
              
              {customer.isBlackListed &&
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold bg-red-50 text-red-700 border border-red-100">
                  Blacklisted
                </span>
              }
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm font-body text-gray-500">
              
              <span>{customer.group.name}</span>
              <span>{customer.branch}</span>
              <span>Joined {customer.dateJoined}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            {(isSuperAdmin || isAuthorizer) && customerStatus === 'Pending Approval' &&
            <>
                <button
                onClick={() => setActiveModal('approve')}
                className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                
                  <CheckCircleIcon size={15} /> Approve
                </button>
                <button
                onClick={() => setActiveModal('reject')}
                className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5">
                
                  <XCircleIcon size={15} /> Reject
                </button>
              </>
            }
            {isSuperAdmin && !customer.isBlackListed &&
            <button
              onClick={() => setActiveModal('blacklist')}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-heading font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">

                <AlertCircleIcon size={15} /> Blacklist
              </button>
            }
            {isSuperAdmin && customerStatus === 'Approved' &&
            <button
              onClick={() => setActiveModal('suspend')}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-heading font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">
              
                <AlertCircleIcon size={15} /> Suspend
              </button>
            }
            {isSuperAdmin && customerStatus === 'Suspended' &&
            <button
              onClick={() => setActiveModal('activate')}
              className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
              
                <CheckCircleIcon size={15} /> Activate
              </button>
            }
            {canChangeCustomerPhoto &&
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">

                <ImageIcon size={15} /> {isUploadingAvatar ? 'Uploading...' : 'Change Photo'}
              </button>
            }
            <button
              onClick={() => setKycOverviewOpen(true)}
              className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
              
              <ShieldCheckIcon size={15} /> Verify KYC
            </button>
            <button
              onClick={() => navigate(`/customers/${customer.id}/print`)}
              className="px-4 py-2 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5">
              
              <PrinterIcon size={15} /> View Data Page
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-body whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                
                <Icon size={16} />
                {tab.label}
              </button>);

          })}
        </div>

        <div className="p-6">
           
          {!canEditCustomerRecord && isMarketer && (customer.isApproved || hasApprovedLoan) &&
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-body text-amber-800">
              Approved customers or approved loans can’t be edited by marketers.
            </div>
          }

          {/* Personal Information */}
          {activeTab === 'personal' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
              {[
            {
              label: 'Full Name',
              value: customer.name
            },
            {
              label: 'Phone Number',
              value: customer.phone
            },
            {
              label: 'Email Address',
              value: customer.email
            },
            {
              label: 'Date of Birth',
              value: customer.dob
            },
            {
              label: 'Gender',
              value: customer.gender
            },
            {
              label: 'Residential Address',
              value: customer.address
            },
            {
              label: 'Office/Business Address',
              value: customer.officeAddress
            },
            {
              label: 'LGA',
              value: customer.lga
            },
            {
              label: 'State',
              value: customer.state
            },
            {
              label: 'Next of Kin',
              value: customer.nextOfKin.name
            },
            {
              label: 'Next of Kin Phone',
              value: customer.nextOfKin.phone
            },
            {
              label: 'Relationship',
              value: customer.nextOfKin.relationship
            },
            ...(customer.isApproved
              ? [
                  {
                    label: 'Approved By',
                    value: customer.approvedByName || '-',
                  },
                  {
                    label: 'Approved On',
                    value: formatDisplayDate(customer.approvedOn),
                  },
                ]
              : []),
            ...(customer.isRejected
              ? [
                  {
                    label: 'Rejected By',
                    value: customer.rejectedByName || '-',
                  },
                  {
                    label: 'Rejected On',
                    value: formatDisplayDate(customer.rejectedOn),
                  },
                  {
                    label: 'Rejection Reason',
                    value: customer.reasonForRejection || '-',
                  },
                ]
              : []),
            ...(customer.isBlackListed
              ? [
                  {
                    label: 'Blacklisted By',
                    value: customer.blacklistedByName || '-',
                  },
                  {
                    label: 'Blacklisted On',
                    value: formatDisplayDate(customer.blackListedOn),
                  },
                  {
                    label: 'Blacklisting Reason',
                    value: customer.reasonForBlacklisting || '-',
                  },
                ]
              : [])].
            map((item) =>
            <div key={item.label}>
                  <p className="text-xs text-gray-400 font-body mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm font-body font-medium text-gray-800">
                    {item.value}
                  </p>
                </div>
            )}
            </motion.div>
          }

          {/* Guarantors */}
          {activeTab === 'guarantors' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="space-y-5">
            
              {customer.guarantors.map((g, idx: number) =>
            <div
              key={idx}
              className="border border-gray-100 rounded-xl p-5">
              
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-heading font-bold">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-heading font-bold text-gray-800">
                      Guarantor {idx + 1}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                {
                  label: 'Full Name',
                  value: g.name
                },
                {
                  label: 'Phone Number',
                  value: g.phone
                },
                {
                  label: 'Address',
                  value: g.address
                },
                {
                  label: 'Relationship',
                  value: g.relationship
                },
                {
                  label: 'Occupation',
                  value: g.occupation
                },
                {
                  label: 'BVN',
                  value: g.bvn
                }].
                map((item) =>
                <div key={item.label}>
                        <p className="text-xs text-gray-400 font-body mb-1">
                          {item.label}
                        </p>
                        <p className="text-sm font-body font-medium text-gray-800">
                          {item.value}
                        </p>
                      </div>
                )}
                  </div>
                </div>
            )}
            </motion.div>
          }

          {/* Reference */}
          {activeTab === 'reference' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}>
            
              <div className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpenIcon size={16} />
                  </div>
                  <h4 className="text-sm font-heading font-bold text-gray-800">
                    Reference Information
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                {
                  label: 'Full Name',
                  value: customer.reference.name
                },
                {
                  label: 'Phone Number',
                  value: customer.reference.phone
                },
                {
                  label: 'Address',
                  value: customer.reference.address
                },
                {
                  label: 'Relationship',
                  value: customer.reference.relationship
                },
                {
                  label: 'Occupation',
                  value: customer.reference.occupation
                },
                {
                  label: 'Years Known',
                  value: customer.reference.yearsKnown
                }].
                map((item) =>
                <div key={item.label}>
                      <p className="text-xs text-gray-400 font-body mb-1">
                        {item.label}
                      </p>
                      <p className="text-sm font-body font-medium text-gray-800">
                        {item.value}
                      </p>
                    </div>
                )}
                </div>
              </div>
            </motion.div>
          }

          {/* KYC & Verification */}
          {activeTab === 'kyc' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="max-w-xl">
            
              <KycRow
              label="BVN Verification"
              status={kycStatuses.bvn}
              icon={<ShieldCheckIcon size={16} />}
              onAction={() => handleKycRowAction('bvn')} />
            
              <KycRow
              label="NIN Verification"
              status={kycStatuses.nin}
              icon={<FileTextIcon size={16} />}
              onAction={() => handleKycRowAction('nin')} />
            
              <KycRow
              label="Utility Bill"
              status={kycStatuses.utilityBill}
              icon={<FileTextIcon size={16} />}
              onAction={() => handleKycRowAction('utilityBill')} />
            
              <KycRow
              label="Passport Photo"
              status={kycStatuses.passportPhoto}
              icon={<ImageIcon size={16} />}
              onAction={() => handleKycRowAction('passportPhoto')} />
            
              <KycRow
              label="Biometric Capture"
              status={kycStatuses.biometric}
              icon={<FingerprintIcon size={16} />}
              onAction={() => handleKycRowAction('biometric')} />
            
              {customer.kyc.bvn.number && customer.kyc.bvn.number !== '-' &&
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 font-body">BVN Number</p>
                  <p className="text-sm font-body font-medium text-gray-700 flex items-center gap-2">
                    {customer.kyc.bvn.number}
                    <button className="text-primary hover:text-primary/80">
                      <EyeIcon size={14} />
                    </button>
                  </p>
                </div>
            }
            </motion.div>
          }

          {/* Group Membership */}
          {activeTab === 'group' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
              {[
            {
              label: 'Group Name',
              value: customer.group.name
            },
            {
              label: 'Group ID',
              value: customer.group.id
            },
            {
              label: 'Role in Group',
              value: customer.group.role
            },
            {
              label: 'Date Joined Group',
              value: customer.group.dateJoined
            },
            {
              label: 'Group Status',
              value: customer.group.status
            }].
            map((item) =>
            <div key={item.label}>
                  <p className="text-xs text-gray-400 font-body mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm font-body font-medium text-gray-800">
                    {item.value}
                  </p>
                </div>
            )}
            </motion.div>
          }

          {/* Loan History */}
          {activeTab === 'loans' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="space-y-4">

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500 font-body">Loan applications for this customer</p>
                {isMarketer && canEditCustomerRecord &&
                <button
                  type="button"
                  onClick={openRaiseLoanModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90">

                    <PlusIcon size={14} />
                    Raise Loan
                  </button>
                }
              </div>

              <div className="overflow-x-auto">
              {isLoadingCustomerLoans ?
              <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                    <Loader2Icon size={16} className="animate-spin" />
                    Loading loan applications...
                  </div> :
              customerLoans.length === 0 ?
            <p className="text-sm text-gray-400 font-body py-8 text-center">
                  No loan records found.
                </p> :

            <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                      <th className="px-4 py-3 font-medium">Loan ID</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Tenure</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Initiation Date</th>
                      <th className="px-4 py-3 font-medium">Disbursed Date</th>
                      <th className="px-4 py-3 font-medium">Next Payment</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm font-body">
                    {customerLoans.map((loan) => {
                      const normalizedLoanStatus = typeof loan.status === 'string' ? loan.status.trim().toLowerCase() : '';
                      const canResubmitRejectedLoan = isMarketer && normalizedLoanStatus === 'rejected';

                      return (
                        <tr
                          key={loan.id}
                          onClick={() => openLoanDetailPage(loan)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer">

                          <td className="px-4 py-3 font-medium text-primary">
                            {loan.loanCode}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {formatNairaAmount(loan.principalAmount)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {loan.tenorWeeks} weeks
                          </td>
                          <td className="px-4 py-3 text-gray-600">{loan.interestRate}%</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={loan.status as BadgeStatus} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {loan.initiationDate ? formatDisplayDate(loan.initiationDate) : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {loan.disbursedDate ? formatDisplayDate(loan.disbursedDate) : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {loan.dueDate ? formatDisplayDate(loan.dueDate) : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {canResubmitRejectedLoan ?
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openResubmitLoanModal(loan);
                                }}
                                disabled={resubmittingLoanId === loan.id}
                                className="inline-flex items-center rounded-md border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-60 disabled:cursor-not-allowed">
                                {resubmittingLoanId === loan.id ? 'Resubmitting...' : 'Resubmit'}
                              </button> :
                              <span className="text-xs text-gray-400">-</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
              </div>
            </motion.div>
          }

          {/* Fees & Payments */}
          {activeTab === 'fees' &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4">

              {isLoadingCustomerFees ?
            <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                  <Loader2Icon size={16} className="animate-spin" />
                  Loading fees...
                </div> :
            customerFees.length === 0 ?
            <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-sm font-body text-gray-500">No approved fees available for this customer.</p>
                </div> :
            <div className="space-y-3">
                  {customerFees.map((fee) => {
                const feeKey = `${fee.category}-${fee.feeTitle}`;
                const paymentRecords = customerFeePaymentHistory.filter(
                  (payment) =>
                    payment.category.toLowerCase() === fee.category.toLowerCase() &&
                    payment.feeTitle.trim().toLowerCase() === fee.feeTitle.trim().toLowerCase(),
                );
                const isExpanded = Boolean(expandedPaidFeeKeys[feeKey]);

                return (
                  <div
                  key={feeKey}
                  className="border border-gray-100 rounded-xl p-4 space-y-3">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-heading font-semibold text-gray-800 flex items-center gap-2">
                          <ReceiptIcon size={16} className="text-primary" />
                          {fee.feeTitle}
                        </p>
                        <p className="text-xs font-body text-gray-500 capitalize">
                          {fee.category} fee • {fee.chargingType}
                        </p>
                        <p className="text-xs font-body text-gray-500">{fee.description || '-'}</p>
                        {fee.isPaid &&
                    <p className="text-xs font-body text-green-600">
                            Paid {fee.paidAt ? `on ${formatDisplayDate(fee.paidAt)}` : ''} {fee.paidBy ? `• by ${fee.paidBy}` : ''}
                          </p>
                    }
                      </div>

                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <p className="text-sm font-heading font-bold text-gray-800">{formatNairaAmount(fee.amount)}</p>
                        {fee.isPaid ?
                    <button
                      type="button"
                      onClick={() => togglePaidFeeAccordion(feeKey)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">

                            {paymentRecords.length} record{paymentRecords.length === 1 ? '' : 's'}
                            <ChevronDownIcon size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button> :
                    isMarketer ?
                    <button
                      type="button"
                      onClick={() => openPayFeeModal(fee)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90">

                            <CreditCardIcon size={14} />
                            Pay Fee
                          </button> :
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            Pending Payment
                          </span>
                    }
                      </div>
                    </div>

                    {fee.isPaid && isExpanded &&
                <div className="space-y-2 pt-1 border-t border-gray-100">
                        {paymentRecords.length === 0 ?
                  <p className="text-xs text-gray-500">No payment details available.</p> :
                  paymentRecords.map((payment, index) =>
                  <div key={`${feeKey}-${payment.paidAt ?? index}-${index}`} className="rounded-lg bg-gray-50 border border-gray-100 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Date:</span> {payment.paidAt ? formatDisplayDate(payment.paidAt) : '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Amount:</span> {formatNairaAmount(payment.amount)}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Method:</span> {payment.paymentMethod || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Bank Paid To:</span> {payment.destinationBankName || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Account Name:</span> {payment.destinationAccountName || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Account Number:</span> {payment.destinationAccountNumber || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Transaction Ref:</span> {payment.reference || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Paid By:</span> {payment.paidBy || '-'}</p>
                              <p className="text-xs text-gray-600"><span className="text-gray-400">Note:</span> {payment.note || '-'}</p>
                            </div>
                  )
                  }
                      </div>
                }
                  </div>
                );
              })}
                </div>
            }
            </motion.div>
          }

          {/* Activity Log */}
          {activeTab === 'activity' &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            className="max-w-2xl">
            
              <div className="relative pl-6 border-l-2 border-gray-100 space-y-6">
                {customer.activity.map((item, idx: number) =>
              <div key={idx} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-white border-2 border-primary" />
                    <p className="text-sm font-body text-gray-800">
                      {item.action}
                    </p>
                    <p className="text-xs font-body text-gray-400 mt-0.5">
                      {item.date} • by {item.by}
                    </p>
                  </div>
              )}
              </div>
            </motion.div>
          }
        </div>
      </div>
    </div>);

}