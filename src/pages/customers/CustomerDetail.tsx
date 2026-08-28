import { useEffect, useMemo, useState, type ComponentProps } from 'react';
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
  ReceiptIcon,
  BookOpenIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  EyeIcon,
  EyeOffIcon,
  FingerprintIcon,
  Loader2Icon,
  ClockIcon,
  HistoryIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  MessageSquareIcon,
  CameraIcon,
  FileTextIcon,
  BanknoteIcon as RaiseLoanIcon,
  LockIcon,
  FlagIcon,
  Trash2Icon,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ReusableInputField } from '../../components/ReusableInputField';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useAuth } from '../../context/AuthContext';
import { useAppSelector } from '../../store/hooks';
import {
  customersService,
  type BvnReviewComparison,
  type Customer,
  type CustomerAuditEntry,
  type CustomerKycCaptureStatus,
  type CustomerRepaymentRisk,
  type MismatchFlag,
} from '../../services/customers/customers.service';
import { groupsService, type Group, type GroupMemberRole } from '../../services/groups/groups.service';
import { loansService, type CustomerLoanHistoryItem, type DisbursementChannel } from '../../services/loans/loans.service';
import { loanProductsService, type LoanProduct } from '../../services/loan-products/loan-products.service';
import { feePaymentsService, type AvailableFeeItem, type CustomerFeePaymentItem, type FeePaymentStatus } from '../../services/fee-payments/fee-payments.service';
import { branchBankAccountsService, type BranchBankAccount } from '../../services/branch-bank-accounts/branch-bank-accounts.service';
import { branchesService } from '../../services/branches/branches.service';
import { workflowRequestsService, type WorkflowRequestSummary } from '../../services/workflow-requests/workflow-requests.service';
import { toTitleCase } from '../../utils/staff-display';
import { withId } from '../../utils/id-label';
import { BiometricCaptureModal } from './BiometricCaptureModal';

const CUSTOMER_ENTITY_TYPE = 'CUSTOMER';
const PENDING_STATUSES: WorkflowRequestSummary['status'][] = ['PENDING_REVIEW', 'PENDING_APPROVAL', 'RETURNED_TO_MAKER'];

type TabKey = 'personal' | 'guarantors' | 'reference' | 'kyc' | 'group' | 'loans' | 'fees' | 'audit';

/** Narrowed to just what the "Payment Details" modal renders — both `AvailableFeeItem` and `CustomerFeePaymentItem` satisfy this structurally, so the same modal/state works for either. */
type FeeViewDetails = {
  feeName: string | null;
  productName: string | null;
  amountKobo: number | null;
  status: FeePaymentStatus;
  recordedAt: string | null;
  accountPaidTo: string | null;
  paymentReference: string | null;
};

const TABS: { key: TabKey; label: string; icon: typeof UserIcon }[] = [
  { key: 'personal', label: 'Personal Info', icon: UserIcon },
  { key: 'guarantors', label: 'Guarantors', icon: UsersIcon },
  { key: 'reference', label: 'Reference', icon: BookOpenIcon },
  { key: 'kyc', label: 'KYC & Verification', icon: ShieldCheckIcon },
  { key: 'group', label: 'Group Membership', icon: UsersIcon },
  { key: 'loans', label: 'Loan History', icon: BanknoteIcon },
  { key: 'fees', label: 'Fees & Payments', icon: ReceiptIcon },
  { key: 'audit', label: 'Audit Trail', icon: HistoryIcon },
];

function formatDisplayDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

/** Turns a raw audit action code like "CUSTOMER_KYC_APPROVED" into "Customer Kyc Approved". */
function formatAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

/**
 * Preview-only estimate for the Raise Loan summary step — mirrors the real
 * schedule math in backashbackend's calculateFlatInterestSchedule/
 * calculateReducingBalanceSchedule (the interest rate is a flat cost for the
 * whole tenure, not an annual rate prorated by days), just without building
 * the full installment-by-installment schedule. The actual, authoritative
 * schedule is generated server-side at disbursement — this is only ever
 * shown before a loan is raised, to give the customer/marketer a sense of
 * what they're committing to.
 *
 * `repaymentPeriodDays` (7 = weekly, the standard cadence — see
 * LoanProduct.repaymentPeriodDays) decides how many installments the real
 * schedule will have (`ceil(tenureDays / repaymentPeriodDays)`), which only
 * matters for REDUCING — the annuity formula's per-installment rate depends
 * on the installment count, not the raw day count. FLAT is unaffected: total
 * interest is always exactly `principal * rate`, regardless of how many
 * installments it's split across.
 */
function estimateTotalInterestKobo(
  principalKobo: number,
  rateBasisPoints: number,
  tenureDays: number,
  interestType: 'FLAT' | 'REDUCING',
  repaymentPeriodDays: number,
): number {
  if (!Number.isFinite(principalKobo) || principalKobo <= 0 || !Number.isFinite(tenureDays) || tenureDays <= 0) {
    return 0;
  }
  if (interestType === 'FLAT') {
    return Math.round((principalKobo * rateBasisPoints) / 10_000);
  }
  const installmentCount = Math.max(1, Math.ceil(tenureDays / (repaymentPeriodDays || 7)));
  const perInstallmentRate = rateBasisPoints / 10_000 / installmentCount;
  if (perInstallmentRate === 0) return 0;
  const factor = Math.pow(1 + perInstallmentRate, installmentCount);
  const emi = (principalKobo * perInstallmentRate * factor) / (factor - 1);
  return Math.round(emi * installmentCount - principalKobo);
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

const CUSTOMER_STATUS_BADGE: Record<Customer['status'], 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Suspended'> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  ACTIVE: 'Approved',
  REJECTED: 'Rejected',
  DISABLED: 'Suspended',
};

/**
 * `Customer.status` only ever has one generic "still going through the
 * approval flow" value (PENDING_APPROVAL) — it doesn't distinguish which
 * step of the chain a submission is actually on. Showing that generic badge
 * next to the more specific "Awaiting review"/"Awaiting approval" subtext
 * (driven by the real WorkflowRequest's own status) read as two different,
 * contradictory statuses at a glance. This derives both the badge *and* the
 * subtext word from the same source — the actual pending request — so
 * they always agree. RETURNED_TO_MAKER (sent back for revision) is bucketed
 * with the review step: it's the maker's turn again, same as before anyone
 * had reviewed it at all, not a final-approval-stage concern.
 */
function pendingRequestStepLabel(
  status: WorkflowRequestSummary['status'],
): { badge: 'Pending Review' | 'Pending Approval'; word: 'review' | 'approval' } {
  if (status === 'PENDING_REVIEW' || status === 'RETURNED_TO_MAKER') {
    return { badge: 'Pending Review', word: 'review' };
  }
  return { badge: 'Pending Approval', word: 'approval' };
}

const KYC_STATUS_BADGE: Record<Customer['kycStatus'], 'Pending' | 'Pending Review' | 'Verified' | 'Overdue'> = {
  INCOMPLETE: 'Pending',
  PENDING_VERIFICATION: 'Pending Review',
  VERIFIED: 'Verified',
  MISMATCH_FLAGGED: 'Overdue',
};

type BadgeStatus = ComponentProps<typeof StatusBadge>['status'];

/** Prefers the parent Loan's status (the more informative one) over the member's own account status, falling back sensibly for values StatusBadge has no dedicated style for. */
function loanHistoryStatusBadge(item: CustomerLoanHistoryItem): BadgeStatus {
  switch (item.loanStatus) {
    case 'PENDING_APPROVAL':
      return 'Pending Approval';
    case 'APPROVED':
      return 'Approved';
    case 'VERIFICATION_IN_PROGRESS':
    case 'VERIFICATION_FAILED':
      return 'Pending Review';
    case 'DISBURSED':
      return 'Disbursed';
    case 'REJECTED':
      return 'Rejected';
    case 'CLOSED':
      return item.status === 'DEFAULTED' ? 'Overdue' : 'Completed';
    default:
      return 'Pending';
  }
}

type PersonalEditFormValues = {
  address: string;
  email: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
};

type GuarantorEditFormValues = {
  g1Name: string; g1Phone: string; g1Email: string; g1Address: string; g1Relationship: string; g1Occupation: string;
  g2Name: string; g2Phone: string; g2Email: string; g2Address: string; g2Relationship: string; g2Occupation: string;
  g3Name: string; g3Phone: string; g3Email: string; g3Address: string; g3Relationship: string; g3Occupation: string;
};

type ReferenceEditFormValues = {
  name: string;
  phone: string;
  address: string;
  relationship: string;
  occupation: string;
  yearsKnown: string;
};

function normalize(value: string | null | undefined): string {
  return value ?? '';
}

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const branches = useAppSelector((state) => state.lookups.branches);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingRequest, setPendingRequest] = useState<WorkflowRequestSummary | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowRequestSummary[]>([]);

  const [loanHistory, setLoanHistory] = useState<CustomerLoanHistoryItem[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  // The tab's actual list — every fee genuinely paid/waived for this
  // customer so far (feePaymentsService.listForCustomer). Distinct from
  // `availableFees` below, which is every PRE_LOAN fee this customer *could*
  // owe (paid or not) — kept loaded in the background purely to populate the
  // "Pay Fee" picker's options, no longer rendered as the tab's main list.
  const [feePayments, setFeePayments] = useState<CustomerFeePaymentItem[]>([]);
  const [isLoadingFeePayments, setIsLoadingFeePayments] = useState(false);
  const [availableFees, setAvailableFees] = useState<AvailableFeeItem[]>([]);
  const [isLoadingFees, setIsLoadingFees] = useState(false);
  const [viewingFee, setViewingFee] = useState<FeeViewDetails | null>(null);
  // "Pay Fee" is a two-step flow: pick which still-pending fee to pay
  // (payFeePickerOpen), then the existing record-payment form
  // (recordingFee/recordFeeForm) takes over exactly as it already did when
  // opened from a specific fee row.
  const [payFeePickerOpen, setPayFeePickerOpen] = useState(false);
  const [recordingFee, setRecordingFee] = useState<AvailableFeeItem | null>(null);
  const [recordFeeForm, setRecordFeeForm] = useState({ status: 'PAID' as 'PAID' | 'WAIVED', accountPaidTo: '', paymentReference: '' });
  const [isRecordingFee, setIsRecordingFee] = useState(false);
  // For the "Account Paid To" dropdown on the record-payment form — the
  // customer's own branch's bank accounts, so the marketer picks the one
  // they actually collected the fee into rather than typing it freehand.
  const [branchBankAccounts, setBranchBankAccounts] = useState<BranchBankAccount[]>([]);
  const [customerGroups, setCustomerGroups] = useState<{ group: Group; role: GroupMemberRole }[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [activeModal, setActiveModal] = useState<
    | 'approve'
    | 'reject'
    | 'review'
    | 'resubmit'
    | 'disable'
    | 'enable'
    | 'record-nin'
    | 'verify-nin'
    | 'grant-edit-privilege'
    | 'reject-edit-privilege'
    | 'delete'
    | null
  >(null);
  const [editPrivilegeModalOpen, setEditPrivilegeModalOpen] = useState(false);
  const [editPrivilegeReason, setEditPrivilegeReason] = useState('');
  const [editPrivilegeSignatureFile, setEditPrivilegeSignatureFile] = useState<File | null>(null);
  const [editPrivilegeSignatureUrl, setEditPrivilegeSignatureUrl] = useState<string | null>(null);
  const [raiseLoanModalOpen, setRaiseLoanModalOpen] = useState(false);
  const [raiseLoanStep, setRaiseLoanStep] = useState<'details' | 'summary'>('details');
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [raiseLoanForm, setRaiseLoanForm] = useState({
    groupId: '',
    productId: '',
    tenureDays: '',
    amountNaira: '',
    purpose: '',
    disbursementChannel: 'TRANSFER' as DisbursementChannel,
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
  });
  const [isRaisingLoan, setIsRaisingLoan] = useState(false);
  // Mirrors LoansService.raiseApplication's own pre-raise check (see its own
  // doc comment: "the branch must actually be able to cover this loan
  // before it's even raised") — surfaced here so the marketer sees it
  // before submitting, not just as an error after. The backend's own check
  // (against the balance at actual submission time) stays the real,
  // authoritative gate — this is a client-side-only early warning.
  const [raiseLoanBranchBalanceKobo, setRaiseLoanBranchBalanceKobo] = useState<number | null>(null);
  const [applicantPhotoFile, setApplicantPhotoFile] = useState<File | null>(null);
  const [applicantPhotoPreviewUrl, setApplicantPhotoPreviewUrl] = useState<string | null>(null);
  // The consent step (item 4) — a code sent to the customer's phone/email,
  // read back to the marketer before the application can be raised.
  const [consentChallenge, setConsentChallenge] = useState<{ challengeId: string; expiresAt: string } | null>(null);
  const [consentCodeInput, setConsentCodeInput] = useState('');
  const [isSendingConsentCode, setIsSendingConsentCode] = useState(false);

  const [repaymentRisk, setRepaymentRisk] = useState<CustomerRepaymentRisk | null>(null);
  const [mismatchFlags, setMismatchFlags] = useState<MismatchFlag[]>([]);
  const [bvnComparison, setBvnComparison] = useState<BvnReviewComparison | null>(null);
  const [isComparingBvn, setIsComparingBvn] = useState(false);
  const [auditTrail, setAuditTrail] = useState<CustomerAuditEntry[]>([]);
  const [isLoadingAuditTrail, setIsLoadingAuditTrail] = useState(false);
  const [hasLoadedAuditTrail, setHasLoadedAuditTrail] = useState(false);
  const [isTabEditModalOpen, setIsTabEditModalOpen] = useState(false);
  const [editingTabKey, setEditingTabKey] = useState<'personal' | 'guarantors' | 'reference'>('personal');
  const [biometricModalOpen, setBiometricModalOpen] = useState(false);
  const [revealedBvn, setRevealedBvn] = useState<string | null>(null);
  const [revealedNin, setRevealedNin] = useState<string | null | undefined>(undefined);
  const [biometricUrl, setBiometricUrl] = useState<string | null>(null);
  const [idDocumentModalOpen, setIdDocumentModalOpen] = useState(false);
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [isRevealingKyc, setIsRevealingKyc] = useState<'bvn' | 'nin' | 'biometric' | 'idDocument' | null>(null);
  const [kycCaptureStatus, setKycCaptureStatus] = useState<CustomerKycCaptureStatus | null>(null);
  const [isActing, setIsActing] = useState(false);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isApprover = user?.role === 'approver';
  const isManager = user?.role === 'manager';
  // ADMIN/SUPERADMIN/APPROVER hold approveCapability(CUSTOMER) by default,
  // MANAGER holds reviewCapability(CUSTOMER) — see backashbackend's
  // default-role-capabilities.ts MAKER_ENTITY_TYPES comment. Server-side
  // capability checks are the real gate; this only decides what to show.
  const isApproveTier = isSuperAdmin || isAdmin || isApprover;
  const isCreator = Boolean(customer && user && customer.createdBy === user.id);
  // Manager/Admin/SuperAdmin all hold reviewCapability(CUSTOMER) — Approver
  // holds only approveCapability. A submission still PENDING_REVIEW can
  // only ever be *reviewed*, never approved outright, no matter how senior
  // the viewer is — gating on the submission's actual current status (not
  // just the viewer's role) is what makes that true here, not only on the
  // server. A Manager/Admin/SuperAdmin can never review something they
  // created themselves — same rule the server enforces for the final
  // approve step below.
  const canReviewPending =
    (isManager || isSuperAdmin || isAdmin) &&
    pendingRequest !== null &&
    pendingRequest.status === 'PENDING_REVIEW' &&
    pendingRequest.initiatedBy !== user?.id;
  const canReviewOrApprove = isManager || isApproveTier;

  const branchName = useMemo(
    () =>
      customer
        ? withId(customer.branchName ?? branches.find((b) => b.id === customer.branchId)?.name, customer.branchId)
        : '—',
    [customer, branches],
  );

  const refresh = async () => {
    if (!id) return;
    try {
      const [detail, history] = await Promise.all([
        customersService.getById(id),
        workflowRequestsService.getHistory(CUSTOMER_ENTITY_TYPE, id).catch(() => []),
      ]);
      setCustomer(detail);
      setPendingRequest(history.find((request) => PENDING_STATUSES.includes(request.status)) ?? null);
      setWorkflowHistory(history);
      setLoadError(null);
      if (hasLoadedAuditTrail) {
        customersService
          .getAuditTrail(id)
          .then(setAuditTrail)
          .catch(() => {});
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load customer');
    }
  };

  const refreshKycCaptureStatus = async () => {
    if (!id) return;
    try {
      const status = await customersService.getKycCaptureStatus(id);
      setKycCaptureStatus(status);
    } catch {
      setKycCaptureStatus(null);
    }
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    Promise.all([
      customersService.getById(id),
      workflowRequestsService.getHistory(CUSTOMER_ENTITY_TYPE, id).catch(() => []),
    ])
      .then(([detail, history]) => {
        if (!isMounted) return;
        setCustomer(detail);
        setPendingRequest(history.find((request) => PENDING_STATUSES.includes(request.status)) ?? null);
        setWorkflowHistory(history);
      })
      .catch((error) => {
        if (isMounted) setLoadError(error instanceof Error ? error.message : 'Failed to load customer');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    void refreshKycCaptureStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-loads the biometric photo (once captured) to stand in for the
  // avatar — same signed URL the KYC tab's "View" button would fetch, just
  // pre-fetched here so the header shows the actual photo, not a
  // placeholder, without the viewer needing to go find it.
  useEffect(() => {
    if (!id || !kycCaptureStatus?.biometricCaptured || biometricUrl) return;
    let isMounted = true;
    customersService
      .getBiometricSignedUrl(id)
      .then((result) => {
        if (isMounted) setBiometricUrl(result.url);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [id, kycCaptureStatus?.biometricCaptured, biometricUrl]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setIsLoadingLoans(true);
    loansService
      .getHistoryForCustomer(id)
      .then((items) => {
        if (isMounted) setLoanHistory(items);
      })
      .catch(() => {
        if (isMounted) setLoanHistory([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLoans(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const refreshLoanHistory = () => {
    if (!id) return;
    setIsLoadingLoans(true);
    loansService
      .getHistoryForCustomer(id)
      .then(setLoanHistory)
      .catch(() => setLoanHistory([]))
      .finally(() => setIsLoadingLoans(false));
  };

  const refreshAvailableFees = () => {
    if (!id) return;
    setIsLoadingFees(true);
    feePaymentsService
      .listAvailableFees(id)
      .then(setAvailableFees)
      .catch(() => setAvailableFees([]))
      .finally(() => setIsLoadingFees(false));
  };

  const refreshFeePayments = () => {
    if (!id) return;
    setIsLoadingFeePayments(true);
    feePaymentsService
      .listForCustomer(id)
      .then(setFeePayments)
      .catch(() => setFeePayments([]))
      .finally(() => setIsLoadingFeePayments(false));
  };

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setIsLoadingFees(true);
    feePaymentsService
      .listAvailableFees(id)
      .then((items) => {
        if (isMounted) setAvailableFees(items);
      })
      .catch(() => {
        if (isMounted) setAvailableFees([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFees(false);
      });
    setIsLoadingFeePayments(true);
    feePaymentsService
      .listForCustomer(id)
      .then((items) => {
        if (isMounted) setFeePayments(items);
      })
      .catch(() => {
        if (isMounted) setFeePayments([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFeePayments(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Every bank account on the customer's own branch — reads are
  // authenticated-only server-side (see branchBankAccountsService's own doc
  // comment), so no extra capability gate needed here either.
  useEffect(() => {
    if (!customer?.branchId) {
      setBranchBankAccounts([]);
      return;
    }
    let isMounted = true;
    branchBankAccountsService
      .list(customer.branchId)
      .then((accounts) => {
        if (isMounted) setBranchBankAccounts(accounts);
      })
      .catch(() => {
        if (isMounted) setBranchBankAccounts([]);
      });
    return () => {
      isMounted = false;
    };
  }, [customer?.branchId]);

  // Re-checked every time the raise-loan modal is open and a group is
  // selected — the balance the loan would actually draw from is the
  // *group's* branch (matches LoansService.raiseApplication's own check),
  // which is normally the same as the customer's own branch but not
  // guaranteed to be.
  useEffect(() => {
    if (!raiseLoanModalOpen) return;
    const branchId =
      customerGroups.find(({ group }) => group.id === raiseLoanForm.groupId)?.group.branchId ?? customer?.branchId;
    if (!branchId) {
      setRaiseLoanBranchBalanceKobo(null);
      return;
    }
    let isMounted = true;
    branchesService
      .getBalance(branchId)
      .then((result) => {
        if (isMounted) setRaiseLoanBranchBalanceKobo(result.availableAmount);
      })
      .catch(() => {
        if (isMounted) setRaiseLoanBranchBalanceKobo(null);
      });
    return () => {
      isMounted = false;
    };
  }, [raiseLoanModalOpen, raiseLoanForm.groupId, customerGroups, customer?.branchId]);

  // There is no "groups a customer belongs to" endpoint on the backend —
  // Group/GroupMembership are only queryable by groupId, not customerId.
  // This cross-references every group the viewer can see (row-scoped
  // server-side, same as the Customers page's Groups tab) against this
  // customer's id. Only worth doing once the customer is actually ACTIVE —
  // group membership requires an approved, KYC-verified customer.
  useEffect(() => {
    if (!id || !customer || customer.status !== 'ACTIVE') {
      setCustomerGroups([]);
      return;
    }

    let isMounted = true;
    setIsLoadingGroups(true);
    groupsService
      .list()
      .then(async (groups) => {
        const results = await Promise.all(
          groups.map(async (group) => {
            try {
              const members = await groupsService.getMembers(group.id);
              const membership = members.find((m) => m.customerId === id && !m.leftAt);
              return membership ? { group, role: membership.role } : null;
            } catch {
              return null;
            }
          }),
        );
        if (isMounted) {
          setCustomerGroups(results.filter((item): item is { group: Group; role: GroupMemberRole } => item !== null));
        }
      })
      .catch(() => {
        if (isMounted) setCustomerGroups([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, customer?.status]);

  // Marketer's submitted-vs-provider mismatch flags — a Manager reviewing
  // (or an Admin/Approver approving) a submission needs to see these before
  // deciding, per item 4 of the onboarding-review requirements.
  useEffect(() => {
    if (!id || !canReviewOrApprove) {
      setMismatchFlags([]);
      return;
    }
    let isMounted = true;
    customersService
      .getMismatchFlags(id)
      .then((result) => {
        if (isMounted) setMismatchFlags(result.mismatchFlags);
      })
      .catch(() => {
        if (isMounted) setMismatchFlags([]);
      });
    return () => {
      isMounted = false;
    };
  }, [id, canReviewOrApprove]);

  // Late-repayment warning banner — live read (not dependent on the nightly
  // penalty sweep having already run), only meaningful once the customer is
  // ACTIVE and could actually have a disbursed loan account.
  useEffect(() => {
    if (!id || !customer || customer.status !== 'ACTIVE') {
      setRepaymentRisk(null);
      return;
    }
    let isMounted = true;
    customersService
      .getRepaymentRisk(id)
      .then((result) => {
        if (isMounted) setRepaymentRisk(result);
      })
      .catch(() => {
        if (isMounted) setRepaymentRisk(null);
      });
    return () => {
      isMounted = false;
    };
  }, [id, customer?.status]);

  useEffect(() => {
    if (activeTab !== 'audit' || !id || hasLoadedAuditTrail) return;
    let isMounted = true;
    setIsLoadingAuditTrail(true);
    customersService
      .getAuditTrail(id)
      .then((entries) => {
        if (isMounted) setAuditTrail(entries);
      })
      .catch(() => {
        if (isMounted) setAuditTrail([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAuditTrail(false);
          setHasLoadedAuditTrail(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [activeTab, id, hasLoadedAuditTrail]);

  // Once ACTIVE, the server refuses updateOnboardingDetails/recordNin
  // unless editPrivilege has been GRANTED — see requestEditPrivilege's own
  // comment. Everything else about "can this creator edit right now"
  // (REJECTED allowed, PENDING_APPROVAL allowed) is unchanged.
  const canEditRecord =
    isCreator &&
    customer?.status !== 'REJECTED' &&
    (customer?.status !== 'ACTIVE' || customer?.editPrivilege.status === 'GRANTED');
  // DRAFT is the real pre-submission state now (see Customer['status']'s own
  // doc comment) — biometric capture and Submit for Approval both happen
  // before the marketer has submitted anything.
  const canCaptureBiometric = isCreator && customer?.status === 'DRAFT';
  const canSubmitForApproval = isCreator && customer?.status === 'DRAFT' && customer?.kycStatus === 'VERIFIED';
  // The final step — only actionable once review has actually happened
  // (status flips PENDING_REVIEW -> PENDING_APPROVAL only once a
  // Manager/Admin/SuperAdmin completes the review step above).
  const canApproveRejectPending =
    isApproveTier &&
    pendingRequest !== null &&
    pendingRequest.status === 'PENDING_APPROVAL' &&
    pendingRequest.initiatedBy !== user?.id;
  const canResubmit = isCreator && customer?.status === 'REJECTED';
  // Withdraw a draft or REJECTED record raised by mistake — never once it's
  // gone ACTIVE (that's what disable is for). Deleting while a submission
  // is still sitting in someone else's review/approval queue is allowed
  // too — the server cancels that WorkflowRequest as part of the delete.
  const canDeleteRecord =
    isCreator &&
    (customer?.status === 'DRAFT' || customer?.status === 'PENDING_APPROVAL' || customer?.status === 'REJECTED');
  const canDisable = isApproveTier && customer?.status === 'ACTIVE';
  const canEnable = isApproveTier && customer?.status === 'DISABLED';
  const canRequestEditPrivilege =
    isCreator && customer?.status === 'ACTIVE' && customer?.editPrivilege.status !== 'PENDING';
  const canDecideEditPrivilege = isApproveTier && customer?.editPrivilege.status === 'PENDING';
  // A Marketer/Manager may raise a loan for a customer once both the
  // customer and (every member of) their group are approved — customerGroups
  // is only ever populated for ACTIVE customers to begin with (see its own
  // effect), and every group in it is, by construction, an ACTIVE Group.
  const canRaiseLoan =
    (user?.role === 'marketer' || user?.role === 'manager') &&
    customer?.status === 'ACTIVE' &&
    customerGroups.length > 0;
  // LOAN_DISBURSEMENT_OPS_CAPABILITY — held by everyone except Approver
  // (see default-role-capabilities.ts). Front-desk cash-collection, not
  // maker-checker.
  const canRecordFeePayment = user?.role !== 'approver';

  // ---------------------------------------------------------------------------
  // Formik forms — mirror UpdateOnboardingDetailsPayload exactly; nothing here
  // maps to a fictional field (no dob/gender/lga/state on the real Customer).
  // ---------------------------------------------------------------------------

  const personalFormik = useFormik<PersonalEditFormValues>({
    initialValues: { address: '', email: '', nextOfKinName: '', nextOfKinPhone: '', nextOfKinRelationship: '' },
    validationSchema: Yup.object({
      address: Yup.string().trim().max(240),
      email: Yup.string().trim().email('Enter a valid email'),
      nextOfKinName: Yup.string().trim(),
      nextOfKinPhone: Yup.string().trim().matches(/^$|^\d{7,15}$/, 'Phone must contain 7 to 15 digits'),
      nextOfKinRelationship: Yup.string().trim(),
    }),
    onSubmit: async (values) => {
      if (!id) return;
      try {
        await customersService.updateOnboardingDetails(id, {
          address: values.address || undefined,
          email: values.email || undefined,
          nextOfKin: values.nextOfKinName.trim()
            ? {
                fullName: values.nextOfKinName.trim(),
                phoneNumber: values.nextOfKinPhone.trim(),
                relationship: values.nextOfKinRelationship.trim() || undefined,
              }
            : undefined,
        });
        await refresh();
        setIsTabEditModalOpen(false);
        showToast('Customer details updated successfully');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update customer');
      }
    },
  });

  const guarantorFormik = useFormik<GuarantorEditFormValues>({
    initialValues: {
      g1Name: '', g1Phone: '', g1Email: '', g1Address: '', g1Relationship: '', g1Occupation: '',
      g2Name: '', g2Phone: '', g2Email: '', g2Address: '', g2Relationship: '', g2Occupation: '',
      g3Name: '', g3Phone: '', g3Email: '', g3Address: '', g3Relationship: '', g3Occupation: '',
    },
    onSubmit: async (values) => {
      if (!id) return;
      const rows = [
        { name: values.g1Name, phone: values.g1Phone, email: values.g1Email, address: values.g1Address, relationship: values.g1Relationship, occupation: values.g1Occupation },
        { name: values.g2Name, phone: values.g2Phone, email: values.g2Email, address: values.g2Address, relationship: values.g2Relationship, occupation: values.g2Occupation },
        { name: values.g3Name, phone: values.g3Phone, email: values.g3Email, address: values.g3Address, relationship: values.g3Relationship, occupation: values.g3Occupation },
      ].filter((row) => row.name.trim() && row.phone.trim());

      try {
        await customersService.updateOnboardingDetails(id, {
          guarantors: rows.map((row) => ({
            fullName: row.name.trim(),
            phoneNumber: row.phone.trim(),
            email: row.email.trim() || undefined,
            address: row.address.trim() || undefined,
            relationship: row.relationship.trim() || undefined,
            occupation: row.occupation.trim() || undefined,
          })),
        });
        await refresh();
        setIsTabEditModalOpen(false);
        showToast('Guarantors updated successfully');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update guarantors');
      }
    },
  });

  const referenceFormik = useFormik<ReferenceEditFormValues>({
    initialValues: { name: '', phone: '', address: '', relationship: '', occupation: '', yearsKnown: '' },
    onSubmit: async (values) => {
      if (!id) return;
      try {
        await customersService.updateOnboardingDetails(id, {
          reference: values.name.trim()
            ? {
                fullName: values.name.trim(),
                phoneNumber: values.phone.trim(),
                address: values.address.trim() || undefined,
                relationship: values.relationship.trim() || undefined,
                occupation: values.occupation.trim() || undefined,
                yearsKnown: values.yearsKnown.trim() || undefined,
              }
            : undefined,
        });
        await refresh();
        setIsTabEditModalOpen(false);
        showToast('Reference updated successfully');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update reference');
      }
    },
  });

  function openTabEditModal(tabKey: 'personal' | 'guarantors' | 'reference') {
    if (!canEditRecord || !customer) {
      showToast('You do not have permission to update this customer record');
      return;
    }
    setEditingTabKey(tabKey);
    if (tabKey === 'personal') {
      personalFormik.setValues({
        address: normalize(customer.address),
        email: normalize(customer.email),
        nextOfKinName: normalize(customer.nextOfKin?.fullName),
        nextOfKinPhone: normalize(customer.nextOfKin?.phoneNumber),
        nextOfKinRelationship: normalize(customer.nextOfKin?.relationship),
      });
    } else if (tabKey === 'guarantors') {
      const [g1, g2, g3] = customer.guarantors;
      guarantorFormik.setValues({
        g1Name: normalize(g1?.fullName), g1Phone: normalize(g1?.phoneNumber), g1Email: normalize(g1?.email), g1Address: normalize(g1?.address), g1Relationship: normalize(g1?.relationship), g1Occupation: normalize(g1?.occupation),
        g2Name: normalize(g2?.fullName), g2Phone: normalize(g2?.phoneNumber), g2Email: normalize(g2?.email), g2Address: normalize(g2?.address), g2Relationship: normalize(g2?.relationship), g2Occupation: normalize(g2?.occupation),
        g3Name: normalize(g3?.fullName), g3Phone: normalize(g3?.phoneNumber), g3Email: normalize(g3?.email), g3Address: normalize(g3?.address), g3Relationship: normalize(g3?.relationship), g3Occupation: normalize(g3?.occupation),
      });
    } else {
      referenceFormik.setValues({
        name: normalize(customer.reference?.fullName),
        phone: normalize(customer.reference?.phoneNumber),
        address: normalize(customer.reference?.address),
        relationship: normalize(customer.reference?.relationship),
        occupation: normalize(customer.reference?.occupation),
        yearsKnown: normalize(customer.reference?.yearsKnown),
      });
    }
    setIsTabEditModalOpen(true);
  }

  async function handleSubmitForApproval() {
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.submitForApproval(id);
      await refresh();
      showToast('Submitted for approval');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to submit for approval');
    } finally {
      setIsActing(false);
    }
  }

  async function handleWorkflowAction(action: 'APPROVED' | 'REJECTED', comment?: string) {
    setActiveModal(null);
    if (!pendingRequest) return;
    try {
      setIsActing(true);
      await workflowRequestsService.act(pendingRequest.id, { action, comment });
      await refresh();
      if (action === 'REJECTED') {
        showToast('Customer rejected');
      } else {
        // The engine itself decides whether this was the review step or the
        // final approval — this is only picking the right word to show.
        showToast(isManager && !isApproveTier ? 'Marked as reviewed' : 'Customer approved');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsActing(false);
    }
  }

  async function handleResubmit() {
    setActiveModal(null);
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.resubmitForApproval(id);
      await refresh();
      showToast('Resubmitted for approval');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to resubmit');
    } finally {
      setIsActing(false);
    }
  }

  async function handleCompareBvn() {
    if (!id) return;
    try {
      setIsComparingBvn(true);
      const result = await customersService.getBvnReviewComparison(id);
      setBvnComparison(result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to re-verify BVN');
    } finally {
      setIsComparingBvn(false);
    }
  }

  function openEditPrivilegeModal() {
    setEditPrivilegeReason('');
    setEditPrivilegeSignatureFile(null);
    setEditPrivilegeModalOpen(true);
  }

  async function handleRequestEditPrivilege() {
    if (!id) return;
    if (!editPrivilegeReason.trim()) {
      showToast('A reason is required');
      return;
    }
    if (!editPrivilegeSignatureFile) {
      showToast("The customer's signature is required");
      return;
    }
    try {
      setIsActing(true);
      await customersService.requestEditPrivilege(id, editPrivilegeReason.trim(), editPrivilegeSignatureFile);
      await refresh();
      setEditPrivilegeModalOpen(false);
      showToast('Edit privilege requested — awaiting Admin/Approver decision');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to request edit privilege');
    } finally {
      setIsActing(false);
    }
  }

  async function handleDecideEditPrivilege(approve: boolean, comment?: string) {
    setActiveModal(null);
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.decideEditPrivilege(id, approve, comment);
      await refresh();
      showToast(approve ? 'Edit privilege granted' : 'Edit privilege request rejected');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record decision');
    } finally {
      setIsActing(false);
    }
  }

  async function viewEditPrivilegeSignature() {
    if (!id) return;
    try {
      const result = await customersService.getEditPrivilegeSignatureUrl(id);
      setEditPrivilegeSignatureUrl(result.url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load signature');
    }
  }

  function openRecordFeeModal(fee: AvailableFeeItem) {
    setPayFeePickerOpen(false);
    setRecordFeeForm({ status: 'PAID', accountPaidTo: '', paymentReference: '' });
    setRecordingFee(fee);
  }

  async function handleRecordFeePayment() {
    if (!id || !recordingFee) return;
    if (recordingFee.amountKobo === null) {
      showToast('This fee depends on the loan amount — record it from the loan raise flow instead');
      return;
    }
    try {
      setIsRecordingFee(true);
      await feePaymentsService.record({
        customerId: id,
        productId: recordingFee.productId,
        feeDefinitionId: recordingFee.feeDefinitionId,
        amountKobo: recordingFee.amountKobo,
        status: recordFeeForm.status,
        accountPaidTo: recordFeeForm.accountPaidTo.trim() || undefined,
        paymentReference: recordFeeForm.paymentReference.trim() || undefined,
      });
      refreshAvailableFees();
      refreshFeePayments();
      setRecordingFee(null);
      showToast(recordFeeForm.status === 'PAID' ? 'Payment recorded' : 'Fee waived');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsRecordingFee(false);
    }
  }

  function openRaiseLoanModal() {
    setRaiseLoanForm({
      groupId: customerGroups[0]?.group.id ?? '',
      productId: '',
      tenureDays: '',
      amountNaira: '',
      purpose: '',
      disbursementChannel: 'TRANSFER',
      bankAccountName: '',
      bankAccountNumber: '',
      bankName: '',
    });
    setRaiseLoanStep('details');
    setApplicantPhotoFile(null);
    setApplicantPhotoPreviewUrl(null);
    setConsentChallenge(null);
    setConsentCodeInput('');
    setRaiseLoanModalOpen(true);
    if (loanProducts.length === 0) {
      loanProductsService
        .list('ACTIVE')
        .then(setLoanProducts)
        .catch(() => setLoanProducts([]));
    }
  }

  function selectRaiseLoanProduct(productId: string) {
    // Auto-populates tenure with the product's own first option — the
    // marketer only has to override it if they actually want a different one.
    const product = loanProducts.find((p) => p.id === productId);
    setRaiseLoanForm((f) => ({
      ...f,
      productId,
      tenureDays: product?.tenureOptions[0] ? String(product.tenureOptions[0]) : '',
    }));
  }

  function handleApplicantPhotoSelected(file: File | null) {
    setApplicantPhotoFile(file);
    setApplicantPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSendConsentCode() {
    if (!id) return;
    try {
      setIsSendingConsentCode(true);
      const challenge = await loansService.requestConsent(id);
      setConsentChallenge(challenge);
      setConsentCodeInput('');
      showToast('Consent code sent to the customer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send consent code');
    } finally {
      setIsSendingConsentCode(false);
    }
  }

  const selectedLoanProduct = loanProducts.find((p) => p.id === raiseLoanForm.productId) ?? null;
  const raiseLoanAmountKobo = Math.round(Number(raiseLoanForm.amountNaira) * 100);
  const estimatedInterestKobo = selectedLoanProduct
    ? estimateTotalInterestKobo(
        raiseLoanAmountKobo,
        selectedLoanProduct.interestRate,
        Number(raiseLoanForm.tenureDays),
        selectedLoanProduct.interestType,
        selectedLoanProduct.repaymentPeriodDays,
      )
    : 0;
  const estimatedTotalPaymentKobo = raiseLoanAmountKobo + estimatedInterestKobo;
  const insufficientBranchBalance =
    raiseLoanBranchBalanceKobo !== null &&
    Number.isFinite(raiseLoanAmountKobo) &&
    raiseLoanAmountKobo > 0 &&
    raiseLoanAmountKobo > raiseLoanBranchBalanceKobo;
  const canProceedToLoanSummary =
    Boolean(raiseLoanForm.groupId) &&
    Boolean(raiseLoanForm.productId) &&
    Boolean(raiseLoanForm.tenureDays) &&
    Number.isFinite(raiseLoanAmountKobo) &&
    raiseLoanAmountKobo > 0 &&
    !insufficientBranchBalance &&
    (raiseLoanForm.disbursementChannel !== 'TRANSFER' ||
      (raiseLoanForm.bankAccountName.trim() && raiseLoanForm.bankAccountNumber.trim() && raiseLoanForm.bankName.trim()));
  const canSubmitLoan = canProceedToLoanSummary && Boolean(consentChallenge) && /^\d{6}$/.test(consentCodeInput);

  async function handleRaiseLoan() {
    if (!id || !consentChallenge) return;
    const { groupId, productId, tenureDays, purpose, disbursementChannel, bankAccountName, bankAccountNumber, bankName } = raiseLoanForm;
    if (!canSubmitLoan) {
      showToast('Fill in every field, including the customer consent code');
      return;
    }
    try {
      setIsRaisingLoan(true);
      const result = await loansService.raiseApplication({
        groupId,
        productId,
        tenureDays: Number(tenureDays),
        memberLoanRequests: [
          {
            customerId: id,
            requestedAmountKobo: raiseLoanAmountKobo,
            disbursementChannel,
            bankAccountDetails:
              disbursementChannel === 'TRANSFER'
                ? { accountName: bankAccountName.trim(), accountNumber: bankAccountNumber.trim(), bankName: bankName.trim() }
                : undefined,
          },
        ],
        consentChallengeId: consentChallenge.challengeId,
        consentCode: consentCodeInput,
        purpose: purpose.trim() || undefined,
      });
      const memberLoanAccountId = result.memberLoanAccounts[0]?._id;
      if (applicantPhotoFile && memberLoanAccountId) {
        try {
          await loansService.uploadApplicantPhoto(memberLoanAccountId, applicantPhotoFile);
        } catch {
          showToast('Loan raised, but the applicant photo failed to upload — try again from the loan record');
        }
      }
      setRaiseLoanModalOpen(false);
      showToast('Loan application raised — awaiting approval');
      // So the newly-raised loan shows up in Loan History (and anything
      // else the raise may have touched) without a manual browser reload.
      refreshLoanHistory();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // The backend re-checks the branch balance atomically at actual
      // submission time (see LoansService.raiseApplication's own comment —
      // it can move between our own pre-check above and now), so this can
      // still fire even past the inline warning. Same friendly wording
      // either way rather than the raw "available: X kobo, requested: Y
      // kobo" backend message.
      showToast(
        /insufficient funds/i.test(message)
          ? 'Insufficient branch balance to grant this loan'
          : message || 'Failed to raise loan application',
      );
    } finally {
      setIsRaisingLoan(false);
    }
  }

  async function handleDisable(reason?: string) {
    setActiveModal(null);
    if (!id || !reason?.trim()) {
      showToast('A reason is required to disable this customer');
      return;
    }
    try {
      setIsActing(true);
      await customersService.disable(id, { reason: reason.trim() });
      await refresh();
      showToast('Customer disabled');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to disable customer');
    } finally {
      setIsActing(false);
    }
  }

  async function handleEnable() {
    setActiveModal(null);
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.enable(id);
      await refresh();
      showToast('Customer re-enabled');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to enable customer');
    } finally {
      setIsActing(false);
    }
  }

  async function handleDeleteCustomer() {
    setActiveModal(null);
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.deleteCustomer(id);
      navigate('/customers');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete customer');
    } finally {
      setIsActing(false);
    }
  }

  async function handleRecordNin(nin?: string) {
    setActiveModal(null);
    const trimmed = (nin ?? '').trim();
    if (!/^\d+$/.test(trimmed)) {
      showToast('NIN must contain digits only');
      return;
    }
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.recordNin(id, { nin: trimmed });
      await refreshKycCaptureStatus();
      showToast('NIN recorded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record NIN');
    } finally {
      setIsActing(false);
    }
  }

  async function handleManuallyVerifyNin(note?: string) {
    setActiveModal(null);
    if (!id) return;
    try {
      setIsActing(true);
      await customersService.manuallyVerifyNin(id, { note: note?.trim() ?? '' });
      await refreshKycCaptureStatus();
      showToast('NIN manually verified');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to verify NIN');
    } finally {
      setIsActing(false);
    }
  }

  async function handleBiometricUpload(file: File) {
    if (!id) return;
    try {
      await customersService.captureBiometric(id, file);
      await Promise.all([refresh(), refreshKycCaptureStatus()]);
      showToast('Biometric capture uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload biometric capture');
      throw error;
    }
  }

  async function handleIdDocumentUpload(file: File) {
    if (!id) return;
    try {
      await customersService.captureIdDocument(id, file);
      await refreshKycCaptureStatus();
      showToast('ID document uploaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to upload ID document');
      throw error;
    }
  }

  async function revealBvn() {
    if (!id) return;
    try {
      setIsRevealingKyc('bvn');
      const result = await customersService.getDecryptedBvn(id);
      setRevealedBvn(result.bvn);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load BVN');
    } finally {
      setIsRevealingKyc(null);
    }
  }

  async function revealNin() {
    if (!id) return;
    try {
      setIsRevealingKyc('nin');
      const result = await customersService.getDecryptedNin(id);
      setRevealedNin(result.nin);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load NIN');
    } finally {
      setIsRevealingKyc(null);
    }
  }

  async function revealBiometric() {
    if (!id) return;
    try {
      setIsRevealingKyc('biometric');
      const result = await customersService.getBiometricSignedUrl(id);
      setBiometricUrl(result.url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load biometric image');
    } finally {
      setIsRevealingKyc(null);
    }
  }

  async function revealIdDocument() {
    if (!id) return;
    try {
      setIsRevealingKyc('idDocument');
      const result = await customersService.getIdDocumentSignedUrl(id);
      setIdDocumentUrl(result.url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load ID document image');
    } finally {
      setIsRevealingKyc(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <UserIcon size={48} className="text-gray-300 mb-4 animate-pulse" />
        <p className="text-sm font-body text-gray-400">Loading customer...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <UserIcon size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-heading font-bold text-gray-600">Customer Not Found</h3>
        <p className="text-sm font-body text-gray-400 mt-1">{loadError || "This customer doesn't exist or you don't have access to it."}</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-heading font-bold hover:bg-primary/90 transition-colors"
        >
          Back to Customers
        </button>
      </div>
    );
  }

  const fullName = toTitleCase(`${customer.firstName} ${customer.lastName}`.trim()) || 'Unknown Customer';

  // The most recent rejection's own comment — surfaced right at the top so
  // whoever needs to fix the record doesn't have to dig into the audit
  // trail tab to find it.
  const lastRejectedRequest = [...workflowHistory].reverse().find((request) => request.status === 'REJECTED');
  const lastRejectionComment = lastRejectedRequest?.steps
    .slice()
    .reverse()
    .find((step) => step.action === 'REJECTED')?.comment;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[60] bg-primary text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-body"
          >
            <CheckCircleIcon size={16} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={activeModal === 'approve'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => void handleWorkflowAction('APPROVED')}
        title="Approve Customer"
        description={`Approve ${fullName}'s KYC submission and activate their account?`}
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Approve Customer"
        confirmVariant="primary"
      />
      <ConfirmationModal
        isOpen={activeModal === 'review'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleWorkflowAction('APPROVED', val)}
        title="Mark as Reviewed"
        description={`Mark ${fullName}'s submission as reviewed? This does not approve the record — an Admin or Approver still makes the final decision.`}
        icon={<div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Mark as Reviewed"
        confirmVariant="blue"
        inputType="textarea"
        inputLabel="Review comment (optional)"
        inputPlaceholder="Add any notes for the approver..."
        // Admin/SuperAdmin still see this button (canReviewPending
        // deliberately includes them, e.g. so they can step in if no
        // Manager is available) but only a Manager may actually complete
        // the review step — same pattern as Customers.tsx's group-review
        // modal.
        confirmDisabled={!isManager}
        disabledReason={!isManager ? 'Only a Branch Manager can mark a customer submission as reviewed.' : undefined}
      />
      <ConfirmationModal
        isOpen={activeModal === 'resubmit'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => void handleResubmit()}
        title="Resubmit for Approval"
        description={`Resubmit ${fullName}'s record for a fresh review cycle? Make sure whatever was flagged has already been corrected.`}
        icon={<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><RotateCcwIcon size={20} /></div>}
        confirmLabel="Resubmit"
        confirmVariant="primary"
      />
      <ConfirmationModal
        isOpen={activeModal === 'reject'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleWorkflowAction('REJECTED', val)}
        title="Reject Customer"
        description={`Reject ${fullName}'s KYC submission?`}
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Customer"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        inputPlaceholder="Provide the reason for rejecting this customer..."
        requireInput
      />
      <ConfirmationModal
        isOpen={activeModal === 'disable'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleDisable(val)}
        title="Disable Customer"
        description={`Disable ${fullName}'s account? They will be blocked from further activity until re-enabled.`}
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><AlertCircleIcon size={20} /></div>}
        confirmLabel="Disable Customer"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason"
        inputPlaceholder="Provide a reason (min. 3 characters)..."
        requireInput
      />
      <ConfirmationModal
        isOpen={activeModal === 'enable'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => void handleEnable()}
        title="Re-enable Customer"
        description={`Re-enable ${fullName}'s account?`}
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Re-enable"
        confirmVariant="primary"
      />
      <ConfirmationModal
        isOpen={activeModal === 'delete'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => void handleDeleteCustomer()}
        title="Delete Customer Record"
        description={`Delete ${fullName}'s record? This withdraws it permanently${pendingRequest ? " and cancels the pending review/approval it's awaiting" : ''} — it cannot be undone.`}
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><Trash2Icon size={20} /></div>}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={activeModal === 'record-nin'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleRecordNin(val)}
        title="Record NIN"
        description="Enter this customer's National Identification Number. Encrypted at rest."
        icon={<div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><ShieldCheckIcon size={20} /></div>}
        confirmLabel="Record NIN"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="NIN"
        inputPlaceholder="Digits only"
        requireInput
      />
      <ConfirmationModal
        isOpen={activeModal === 'verify-nin'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleManuallyVerifyNin(val)}
        title="Manually Verify NIN"
        description="A recorded human attestation, not an automated check — there is no live NIN provider."
        icon={<div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><ShieldCheckIcon size={20} /></div>}
        confirmLabel="Verify NIN"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Note (optional)"
        inputPlaceholder="Add a verification note..."
      />
      <ConfirmationModal
        isOpen={activeModal === 'reject-edit-privilege'}
        onClose={() => setActiveModal(null)}
        onConfirm={(val) => void handleDecideEditPrivilege(false, val)}
        title="Reject Edit Privilege Request"
        description="Provide a reason for rejecting this request."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Request"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason"
        inputPlaceholder="Explain why this request is being rejected..."
        requireInput
      />

      <AnimatePresence>
        {editPrivilegeModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditPrivilegeModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Request Edit Privilege</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                {fullName} is already approved. Explain what needs correcting and upload a photo of the
                customer's signature — only an Admin/SuperAdmin/Approver can grant this.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Edit</label>
                  <textarea
                    value={editPrivilegeReason}
                    onChange={(e) => setEditPrivilegeReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Customer's phone number was recorded incorrectly"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Signature</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditPrivilegeSignatureFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-heading file:font-bold file:text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditPrivilegeModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleRequestEditPrivilege()}
                  disabled={isActing}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  Submit Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {raiseLoanModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setRaiseLoanModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Raise Loan</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                {raiseLoanStep === 'details'
                  ? `Raise a loan application on behalf of ${fullName}.`
                  : 'Review before submitting — confirm the customer consents before raising.'}
              </p>

              {raiseLoanStep === 'details' ? (
                <>
                  <div className="space-y-4">
                    {customerGroups.length > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                        <select
                          value={raiseLoanForm.groupId}
                          onChange={(e) => setRaiseLoanForm((f) => ({ ...f, groupId: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                        >
                          {customerGroups.map(({ group }) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loan Product</label>
                      <select
                        value={raiseLoanForm.productId}
                        onChange={(e) => selectRaiseLoanProduct(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                      >
                        <option value="">Select a product</option>
                        {loanProducts.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (days)</label>
                      <select
                        value={raiseLoanForm.tenureDays}
                        onChange={(e) => setRaiseLoanForm((f) => ({ ...f, tenureDays: e.target.value }))}
                        disabled={!raiseLoanForm.productId}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white disabled:bg-gray-50"
                      >
                        <option value="">Select tenure</option>
                        {selectedLoanProduct?.tenureOptions.map((days) => (
                          <option key={days} value={days}>{days} days</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 font-body mt-1">Auto-filled from the product's own first tenure option — change it if needed.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Requested Amount (₦)</label>
                      <input
                        type="number"
                        min={1}
                        value={raiseLoanForm.amountNaira}
                        onChange={(e) => setRaiseLoanForm((f) => ({ ...f, amountNaira: e.target.value.replace(/[^\d.]/g, '') }))}
                        placeholder="e.g. 50000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                      {insufficientBranchBalance && (
                        <p className="text-xs text-red-600 font-body mt-1.5 flex items-start gap-1.5">
                          <AlertCircleIcon size={13} className="mt-0.5 shrink-0" />
                          Insufficient branch balance to grant this loan
                          {raiseLoanBranchBalanceKobo !== null ? ` — only ${formatNaira(raiseLoanBranchBalanceKobo)} available.` : '.'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purpose (optional)</label>
                      <textarea
                        rows={2}
                        value={raiseLoanForm.purpose}
                        onChange={(e) => setRaiseLoanForm((f) => ({ ...f, purpose: e.target.value }))}
                        placeholder="e.g. Working capital for market trading"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Disbursement Channel</label>
                      <select
                        value={raiseLoanForm.disbursementChannel}
                        onChange={(e) => setRaiseLoanForm((f) => ({ ...f, disbursementChannel: e.target.value as DisbursementChannel }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                      >
                        <option value="TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE_PICKUP">Cheque Pickup</option>
                      </select>
                    </div>

                    {raiseLoanForm.disbursementChannel === 'TRANSFER' && (
                      <div className="rounded-lg border border-gray-100 p-4 space-y-3 bg-gray-50">
                        <p className="text-xs font-heading font-bold text-gray-600 uppercase tracking-wide">Bank Account Details</p>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                          <input
                            type="text"
                            value={raiseLoanForm.bankAccountName}
                            onChange={(e) => setRaiseLoanForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                            placeholder="e.g. Amina Bello"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={raiseLoanForm.bankAccountNumber}
                            onChange={(e) => setRaiseLoanForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                            placeholder="10-digit NUBAN"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={raiseLoanForm.bankName}
                            onChange={(e) => setRaiseLoanForm((f) => ({ ...f, bankName: e.target.value }))}
                            placeholder="e.g. GTBank"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Applicant Photo (optional)</label>
                      <div className="flex items-center gap-3">
                        {applicantPhotoPreviewUrl && (
                          <img src={applicantPhotoPreviewUrl} alt="Applicant" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleApplicantPhotoSelected(e.target.files?.[0] ?? null)}
                          className="flex-1 text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-heading file:font-bold file:text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-400 font-body mt-1">A photo of the customer taken at application time.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setRaiseLoanModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                    <button
                      onClick={() => setRaiseLoanStep('summary')}
                      disabled={!canProceedToLoanSummary}
                      className="px-4 py-2 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
                    >
                      Review Summary
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-100 p-4 bg-gray-50 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium text-gray-800">{fullName}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Group</span><span className="font-medium text-gray-800">{customerGroups.find(({ group }) => group.id === raiseLoanForm.groupId)?.group.name ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="font-medium text-gray-800">{selectedLoanProduct?.name ?? '—'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Tenure</span><span className="font-medium text-gray-800">{raiseLoanForm.tenureDays} days</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-gray-800">₦{Number(raiseLoanForm.amountNaira || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Estimated Interest</span><span className="font-medium text-gray-800">{formatNaira(estimatedInterestKobo)}</span></div>
                      <div className="flex justify-between pt-2 mt-1 border-t border-gray-200"><span className="text-gray-700 font-heading font-bold">Estimated Total Payment</span><span className="text-primary font-heading font-bold">{formatNaira(estimatedTotalPaymentKobo)}</span></div>
                      {raiseLoanForm.purpose.trim() && (
                        <div className="flex justify-between"><span className="text-gray-500">Purpose</span><span className="font-medium text-gray-800 text-right">{raiseLoanForm.purpose.trim()}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-gray-500">Disbursement</span><span className="font-medium text-gray-800">{raiseLoanForm.disbursementChannel === 'TRANSFER' ? 'Bank Transfer' : 'Cheque Pickup'}</span></div>
                      {raiseLoanForm.disbursementChannel === 'TRANSFER' && (
                        <div className="flex justify-between"><span className="text-gray-500">Bank Account</span><span className="font-medium text-gray-800 text-right">{raiseLoanForm.bankAccountName}<br />{raiseLoanForm.bankAccountNumber} · {raiseLoanForm.bankName}</span></div>
                      )}
                      <div className="flex justify-between"><span className="text-gray-500">Applicant Photo</span><span className="font-medium text-gray-800">{applicantPhotoFile ? 'Attached' : 'Not attached'}</span></div>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <p className="text-xs font-heading font-bold text-amber-700 uppercase tracking-wide">Customer Consent</p>
                      <p className="text-xs text-amber-800 font-body">Send a code to the customer's phone/email, then enter what they read back to you.</p>
                      <button
                        onClick={() => void handleSendConsentCode()}
                        disabled={isSendingConsentCode}
                        className="text-xs font-heading font-bold text-primary hover:text-primary/80 transition-colors disabled:opacity-60"
                      >
                        {isSendingConsentCode ? 'Sending...' : consentChallenge ? 'Resend Code' : 'Send Consent Code'}
                      </button>
                      {consentChallenge && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Consent Code</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={consentCodeInput}
                            onChange={(e) => setConsentCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit code"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between mt-6">
                    <button onClick={() => setRaiseLoanStep('details')} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Back</button>
                    <div className="flex gap-3">
                      <button onClick={() => setRaiseLoanModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                      <button
                        onClick={() => void handleRaiseLoan()}
                        disabled={isRaisingLoan || !canSubmitLoan}
                        className="px-4 py-2 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
                      >
                        {isRaisingLoan ? 'Raising...' : 'Raise Loan Application'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {payFeePickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPayFeePickerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Pay Fee</h3>
              <p className="text-xs text-gray-500 font-body mb-4">Select which fee this customer is paying.</p>
              {isLoadingFees ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-4">
                  <Loader2Icon size={16} className="animate-spin" /> Loading fees...
                </div>
              ) : (() => {
                const payableFees = availableFees.filter((fee) => fee.status === 'PENDING' && fee.amountKobo !== null);
                return payableFees.length === 0 ? (
                  <p className="text-sm font-body text-gray-500 py-4">
                    Nothing left to pay — every fee that applies to this customer has already been paid or waived
                    (or depends on a loan amount, which is recorded from the loan raise flow instead).
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {payableFees.map((fee) => (
                      <button
                        key={`${fee.productId}:${fee.feeDefinitionId}`}
                        onClick={() => openRecordFeeModal(fee)}
                        className="w-full flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-heading font-semibold text-gray-800">{fee.feeName}</p>
                          <p className="text-xs font-body text-gray-500">{fee.productName}</p>
                        </div>
                        <p className="text-sm font-heading font-bold text-gray-800 shrink-0">{formatNaira(fee.amountKobo!)}</p>
                      </button>
                    ))}
                  </div>
                );
              })()}
              <div className="flex justify-end mt-6">
                <button onClick={() => setPayFeePickerOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingFee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setViewingFee(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-4">Payment Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Fee</span><span className="font-medium text-gray-800">{viewingFee.feeName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="font-medium text-gray-800">{viewingFee.productName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-gray-800">{viewingFee.amountKobo !== null ? formatNaira(viewingFee.amountKobo) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-gray-800">{viewingFee.status === 'PAID' ? 'Paid' : viewingFee.status === 'WAIVED' ? 'Waived' : 'Pending'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium text-gray-800">{formatDisplayDate(viewingFee.recordedAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Account Paid To</span><span className="font-medium text-gray-800">{viewingFee.accountPaidTo ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Payment Reference</span><span className="font-medium text-gray-800">{viewingFee.paymentReference ?? '—'}</span></div>
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={() => setViewingFee(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recordingFee && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setRecordingFee(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Record Payment</h3>
              <p className="text-xs text-gray-500 font-body mb-4">{recordingFee.feeName} — {recordingFee.amountKobo !== null ? formatNaira(recordingFee.amountKobo) : '—'}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={recordFeeForm.status}
                    onChange={(e) => setRecordFeeForm((f) => ({ ...f, status: e.target.value as 'PAID' | 'WAIVED' }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    <option value="PAID">Paid</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </div>
                {recordFeeForm.status === 'PAID' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Paid To</label>
                      <select
                        value={recordFeeForm.accountPaidTo}
                        onChange={(e) => setRecordFeeForm((f) => ({ ...f, accountPaidTo: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                      >
                        <option value="">Select account...</option>
                        {branchBankAccounts
                          .slice()
                          .sort((a, b) => Number(b.active) - Number(a.active))
                          .map((account) => {
                            const label = `${account.bankName} — ${account.accountNumber} (${account.accountName})${account.active ? '' : ' — inactive'}`;
                            return (
                              <option key={account.id} value={label}>
                                {label}
                              </option>
                            );
                          })}
                      </select>
                      {branchBankAccounts.length === 0 && (
                        <p className="text-xs text-gray-400 font-body mt-1">This branch has no bank accounts on file yet.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Reference</label>
                      <input
                        type="text"
                        value={recordFeeForm.paymentReference}
                        onChange={(e) => setRecordFeeForm((f) => ({ ...f, paymentReference: e.target.value }))}
                        placeholder="e.g. teller/transfer reference"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setRecordingFee(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleRecordFeePayment()}
                  disabled={isRecordingFee}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isRecordingFee ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BiometricCaptureModal
        isOpen={biometricModalOpen}
        onClose={() => setBiometricModalOpen(false)}
        onUpload={handleBiometricUpload}
      />

      <BiometricCaptureModal
        isOpen={idDocumentModalOpen}
        onClose={() => setIdDocumentModalOpen(false)}
        onUpload={handleIdDocumentUpload}
        title="ID Document Capture"
        hint="A photo of the customer's NIN slip, voter's card, or similar."
      />

      <AnimatePresence>
        {isTabEditModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsTabEditModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto"
            >
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-4">
                Update {editingTabKey === 'personal' ? 'Personal Details' : editingTabKey === 'guarantors' ? 'Guarantors' : 'Reference'}
              </h3>

              {editingTabKey === 'personal' && (
                <form onSubmit={(e) => { e.preventDefault(); void personalFormik.submitForm(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <ReusableInputField label="Residential Address" name="address" value={personalFormik.values.address} onChange={personalFormik.handleChange} onBlur={personalFormik.handleBlur} error={personalFormik.errors.address} touched={personalFormik.touched.address} />
                  </div>
                  <ReusableInputField label="Email Address" name="email" type="email" value={personalFormik.values.email} onChange={personalFormik.handleChange} onBlur={personalFormik.handleBlur} error={personalFormik.errors.email} touched={personalFormik.touched.email} />
                  <div />
                  <ReusableInputField label="Next of Kin Name" name="nextOfKinName" value={personalFormik.values.nextOfKinName} onChange={personalFormik.handleChange} onBlur={personalFormik.handleBlur} error={personalFormik.errors.nextOfKinName} touched={personalFormik.touched.nextOfKinName} />
                  <ReusableInputField label="Next of Kin Phone" name="nextOfKinPhone" type="tel" value={personalFormik.values.nextOfKinPhone} onChange={(e) => personalFormik.setFieldValue('nextOfKinPhone', e.target.value.replace(/\D/g, '').slice(0, 15))} onBlur={personalFormik.handleBlur} error={personalFormik.errors.nextOfKinPhone} touched={personalFormik.touched.nextOfKinPhone} />
                  <ReusableInputField label="Next of Kin Relationship" name="nextOfKinRelationship" value={personalFormik.values.nextOfKinRelationship} onChange={personalFormik.handleChange} onBlur={personalFormik.handleBlur} error={personalFormik.errors.nextOfKinRelationship} touched={personalFormik.touched.nextOfKinRelationship} />
                </form>
              )}

              {editingTabKey === 'guarantors' && (
                <form onSubmit={(e) => { e.preventDefault(); void guarantorFormik.submitForm(); }} className="space-y-5 mb-4">
                  {([1, 2, 3] as const).map((n) => (
                    <div key={n} className="border border-gray-100 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Guarantor {n}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ReusableInputField label="Full Name" name={`g${n}Name`} value={guarantorFormik.values[`g${n}Name` as keyof GuarantorEditFormValues]} onChange={guarantorFormik.handleChange} onBlur={guarantorFormik.handleBlur} />
                        <ReusableInputField label="Phone" name={`g${n}Phone`} type="tel" value={guarantorFormik.values[`g${n}Phone` as keyof GuarantorEditFormValues]} onChange={(e) => guarantorFormik.setFieldValue(`g${n}Phone`, e.target.value.replace(/\D/g, '').slice(0, 15))} onBlur={guarantorFormik.handleBlur} />
                        <ReusableInputField label="Email" name={`g${n}Email`} type="email" value={guarantorFormik.values[`g${n}Email` as keyof GuarantorEditFormValues]} onChange={guarantorFormik.handleChange} onBlur={guarantorFormik.handleBlur} />
                        <ReusableInputField label="Occupation" name={`g${n}Occupation`} value={guarantorFormik.values[`g${n}Occupation` as keyof GuarantorEditFormValues]} onChange={guarantorFormik.handleChange} onBlur={guarantorFormik.handleBlur} />
                        <ReusableInputField label="Relationship" name={`g${n}Relationship`} value={guarantorFormik.values[`g${n}Relationship` as keyof GuarantorEditFormValues]} onChange={guarantorFormik.handleChange} onBlur={guarantorFormik.handleBlur} />
                        <ReusableInputField label="Address" name={`g${n}Address`} value={guarantorFormik.values[`g${n}Address` as keyof GuarantorEditFormValues]} onChange={guarantorFormik.handleChange} onBlur={guarantorFormik.handleBlur} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">Leave a guarantor's name and phone blank to remove them. Saving replaces the full list.</p>
                </form>
              )}

              {editingTabKey === 'reference' && (
                <form onSubmit={(e) => { e.preventDefault(); void referenceFormik.submitForm(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <ReusableInputField label="Full Name" name="name" value={referenceFormik.values.name} onChange={referenceFormik.handleChange} onBlur={referenceFormik.handleBlur} />
                  <ReusableInputField label="Phone" name="phone" type="tel" value={referenceFormik.values.phone} onChange={(e) => referenceFormik.setFieldValue('phone', e.target.value.replace(/\D/g, '').slice(0, 15))} onBlur={referenceFormik.handleBlur} />
                  <ReusableInputField label="Relationship" name="relationship" value={referenceFormik.values.relationship} onChange={referenceFormik.handleChange} onBlur={referenceFormik.handleBlur} />
                  <ReusableInputField label="Occupation" name="occupation" value={referenceFormik.values.occupation} onChange={referenceFormik.handleChange} onBlur={referenceFormik.handleBlur} />
                  <ReusableInputField label="Years Known" name="yearsKnown" value={referenceFormik.values.yearsKnown} onChange={referenceFormik.handleChange} onBlur={referenceFormik.handleBlur} />
                  <div className="sm:col-span-2">
                    <ReusableInputField label="Address" name="address" value={referenceFormik.values.address} onChange={referenceFormik.handleChange} onBlur={referenceFormik.handleBlur} />
                  </div>
                </form>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setIsTabEditModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => {
                    if (editingTabKey === 'personal') void personalFormik.submitForm();
                    else if (editingTabKey === 'guarantors') void guarantorFormik.submitForm();
                    else void referenceFormik.submitForm();
                  }}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => navigate('/customers')} className="flex items-center gap-2 text-sm font-body text-gray-500 hover:text-primary transition-colors">
        <ArrowLeftIcon size={16} />
        Back to Customers
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="relative shrink-0">
            <ProfileAvatar src={biometricUrl} name={fullName} alt={fullName} className="w-20 h-20 rounded-full border-4 border-primary/10" iconSize={30} />
            {!kycCaptureStatus?.biometricCaptured && (
              <span
                title="No biometric photo captured yet"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center border-2 border-white shadow-sm"
              >
                <CameraIcon size={13} />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h2 className="text-2xl font-heading font-bold text-gray-900">{fullName}</h2>
              <StatusBadge status={pendingRequest ? pendingRequestStepLabel(pendingRequest.status).badge : CUSTOMER_STATUS_BADGE[customer.status]} />
              <StatusBadge status={KYC_STATUS_BADGE[customer.kycStatus]} />
              {customer.kycStatus === 'MISMATCH_FLAGGED' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                  <FlagIcon size={12} /> BVN Flagged
                </span>
              )}
              {repaymentRisk?.flag === 'AMBER' && (
                <span
                  title={repaymentRisk.message ?? undefined}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  <AlertCircleIcon size={12} /> Late Repayment
                </span>
              )}
              {repaymentRisk?.flag === 'RED' && (
                <span
                  title={repaymentRisk.message ?? undefined}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"
                >
                  <AlertCircleIcon size={12} /> Seriously Overdue
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm font-body text-gray-500">
              <span>{customer.phoneNumber}</span>
              <span>{branchName}</span>
              <span>Joined {formatDisplayDate(customer.createdAt)}</span>
            </div>
            {repaymentRisk && repaymentRisk.flag !== 'NONE' && (
              <p
                className={`mt-2 text-xs font-body flex items-start gap-1.5 ${
                  repaymentRisk.flag === 'RED' ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                <AlertCircleIcon size={13} className="mt-0.5 shrink-0" />
                {repaymentRisk.message}
              </p>
            )}
            {customer.status === 'DISABLED' && customer.disabledReason && (
              <p className="mt-2 text-xs font-body text-red-600">Disabled: {customer.disabledReason}</p>
            )}
            {customer.status === 'REJECTED' && (
              <p className="mt-2 text-xs font-body text-red-600 flex items-start gap-1.5">
                <XCircleIcon size={13} className="mt-0.5 shrink-0" />
                Rejected{lastRejectionComment ? `: ${lastRejectionComment}` : ' — no reason was given.'}
              </p>
            )}
            {pendingRequest && (
              <p className="mt-2 text-xs font-body text-amber-600 flex items-center gap-1.5">
                <ClockIcon size={13} /> Awaiting {pendingRequestStepLabel(pendingRequest.status).word}
              </p>
            )}
            {!pendingRequest && !isCreator && customer.status === 'DRAFT' && (
              <p className="mt-2 text-xs font-body text-gray-400 flex items-center gap-1.5">
                <ClockIcon size={13} />
                Not yet submitted for approval{customer.kycStatus !== 'VERIFIED' ? " — the maker's KYC isn't complete yet" : ' by the maker'}. There is nothing to review here yet.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            {canSubmitForApproval && (
              <button onClick={() => void handleSubmitForApproval()} disabled={isActing} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                Submit for Approval
              </button>
            )}
            {canReviewPending && (
              <>
                <button onClick={() => setActiveModal('review')} className="px-4 py-2 bg-blue-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                  <CheckCircleIcon size={15} /> Mark as Reviewed
                </button>
                <button onClick={() => setActiveModal('reject')} className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5">
                  <XCircleIcon size={15} /> Reject
                </button>
              </>
            )}
            {canApproveRejectPending && (
              <>
                <button onClick={() => setActiveModal('approve')} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                  <CheckCircleIcon size={15} /> Approve
                </button>
                <button onClick={() => setActiveModal('reject')} className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5">
                  <XCircleIcon size={15} /> Reject
                </button>
              </>
            )}
            {canResubmit && (
              <button onClick={() => setActiveModal('resubmit')} disabled={isActing} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                <RotateCcwIcon size={15} /> Resubmit for Approval
              </button>
            )}
            {canDisable && (
              <button onClick={() => setActiveModal('disable')} className="px-4 py-2 border border-red-200 text-red-600 text-sm font-heading font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">
                <AlertCircleIcon size={15} /> Disable
              </button>
            )}
            {canEnable && (
              <button onClick={() => setActiveModal('enable')} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5">
                <CheckCircleIcon size={15} /> Re-enable
              </button>
            )}
            {canRaiseLoan && (
              <button onClick={openRaiseLoanModal} className="px-4 py-2 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5">
                <RaiseLoanIcon size={15} /> Raise Loan
              </button>
            )}
            {canRequestEditPrivilege && (
              <button
                onClick={openEditPrivilegeModal}
                disabled={customer.editPrivilege.status === 'PENDING'}
                className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                <LockIcon size={15} /> {customer.editPrivilege.status === 'PENDING' ? 'Edit Request Pending' : 'Request Edit Privilege'}
              </button>
            )}
            <button
              onClick={() => navigate(`/customers/${customer.id}/print`)}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
            >
              <FileTextIcon size={15} /> Generate Data Page
            </button>
            {canDeleteRecord && (
              <button
                onClick={() => setActiveModal('delete')}
                disabled={isActing}
                title="Delete this customer record"
                aria-label="Delete this customer record"
                className="p-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2Icon size={16} />
              </button>
            )}
          </div>
        </div>

        {customer.editPrivilege.status === 'REJECTED' && isCreator && (
          <p className="mt-3 text-xs font-body text-red-600 flex items-start gap-1.5">
            <XCircleIcon size={13} className="mt-0.5 shrink-0" />
            Your last edit privilege request was rejected{customer.editPrivilege.decisionComment ? `: ${customer.editPrivilege.decisionComment}` : '.'}
          </p>
        )}
        {customer.editPrivilege.status === 'GRANTED' && isCreator && (
          <p className="mt-3 text-xs font-body text-green-600 flex items-start gap-1.5">
            <CheckCircleIcon size={13} className="mt-0.5 shrink-0" />
            Edit privilege granted — use "Update Record" on Personal/Guarantors/Reference to make your one change.
          </p>
        )}

        {canDecideEditPrivilege && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-heading font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <LockIcon size={13} /> Edit Privilege Request Pending
            </p>
            <p className="text-sm text-amber-800 font-body">{customer.editPrivilege.reason}</p>
            <p className="text-xs text-amber-600 font-body mt-1">Requested {formatDisplayDate(customer.editPrivilege.requestedAt)}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button onClick={() => void viewEditPrivilegeSignature()} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                <EyeIcon size={14} /> View Signature
              </button>
              <button onClick={() => void handleDecideEditPrivilege(true)} disabled={isActing} className="px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                Grant
              </button>
              <button onClick={() => setActiveModal('reject-edit-privilege')} disabled={isActing} className="px-3 py-1.5 bg-red-600 text-white text-xs font-heading font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
                Reject
              </button>
            </div>
            {editPrivilegeSignatureUrl && (
              <a href={editPrivilegeSignatureUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-2 inline-block">Open signature image</a>
            )}
          </div>
        )}
      </motion.div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-body whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'personal' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {canEditRecord && (
                <div className="mb-4 flex justify-end">
                  <button onClick={() => openTabEditModal('personal')} className="px-4 py-2 rounded-lg border border-primary/20 text-primary text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
                    Update Record
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { label: 'Full Name', value: fullName },
                  { label: 'Phone Number', value: customer.phoneNumber },
                  { label: 'Email Address', value: customer.email || '-' },
                  { label: 'Residential Address', value: customer.address || '-' },
                  { label: 'Branch', value: customer.branchName ?? branches.find((b) => b.id === customer.branchId)?.name ?? '—' },
                  { label: 'Status', value: CUSTOMER_STATUS_BADGE[customer.status] },
                  { label: 'Next of Kin', value: customer.nextOfKin?.fullName || '-' },
                  { label: 'Next of Kin Phone', value: customer.nextOfKin?.phoneNumber || '-' },
                  { label: 'Relationship', value: customer.nextOfKin?.relationship || '-' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400 font-body mb-1">{item.label}</p>
                    <p className="text-sm font-body font-medium text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'guarantors' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {canEditRecord && (
                <div className="flex justify-end">
                  <button onClick={() => openTabEditModal('guarantors')} className="px-4 py-2 rounded-lg border border-primary/20 text-primary text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
                    Update Record
                  </button>
                </div>
              )}
              {customer.guarantors.length === 0 && <p className="text-sm text-gray-400 font-body py-8 text-center">No guarantors recorded.</p>}
              {customer.guarantors.map((g, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-heading font-bold">{idx + 1}</span>
                    <h4 className="text-sm font-heading font-bold text-gray-800">Guarantor {idx + 1}</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Full Name', value: g.fullName },
                      { label: 'Phone Number', value: g.phoneNumber },
                      { label: 'Email', value: g.email || '-' },
                      { label: 'Address', value: g.address || '-' },
                      { label: 'Relationship', value: g.relationship || '-' },
                      { label: 'Occupation', value: g.occupation || '-' },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-gray-400 font-body mb-1">{item.label}</p>
                        <p className="text-sm font-body font-medium text-gray-800">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'reference' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {canEditRecord && (
                <div className="mb-4 flex justify-end">
                  <button onClick={() => openTabEditModal('reference')} className="px-4 py-2 rounded-lg border border-primary/20 text-primary text-sm font-heading font-bold hover:bg-primary/5 transition-colors">
                    Update Record
                  </button>
                </div>
              )}
              {!customer.reference ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">No reference recorded.</p>
              ) : (
                <div className="border border-gray-100 rounded-xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Full Name', value: customer.reference.fullName },
                      { label: 'Phone Number', value: customer.reference.phoneNumber },
                      { label: 'Address', value: customer.reference.address || '-' },
                      { label: 'Relationship', value: customer.reference.relationship || '-' },
                      { label: 'Occupation', value: customer.reference.occupation || '-' },
                      { label: 'Years Known', value: customer.reference.yearsKnown || '-' },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-gray-400 font-body mb-1">{item.label}</p>
                        <p className="text-sm font-body font-medium text-gray-800">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'kyc' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl space-y-4">
              <div className="rounded-lg border border-gray-100 p-4 bg-gray-50">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Overall KYC Status</p>
                <div className="mt-1"><StatusBadge status={KYC_STATUS_BADGE[customer.kycStatus]} /></div>
                <p className="text-xs text-gray-400 font-body mt-2">Verified once BVN consent is confirmed and a biometric image has been captured.</p>
              </div>

              {mismatchFlags.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-xs font-heading font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquareIcon size={13} /> What the marketer submitted vs. the provider's record
                  </p>
                  {mismatchFlags.map((flag, idx) => (
                    <div key={idx} className="text-xs font-body text-amber-800 border-t border-amber-200 pt-2 first:border-t-0 first:pt-0">
                      <p className="font-semibold capitalize">{flag.field}</p>
                      <p>Submitted: <span className="font-mono">{flag.submitted}</span></p>
                      <p>Provider: <span className="font-mono">{flag.providerValue}</span></p>
                      {flag.resolution ? (
                        <p className="mt-1 text-amber-700">
                          Resolved — {flag.resolution === 'KEPT_PROVIDER_VALUE' ? "kept the provider's value" : 'used the submitted value'}
                          {flag.reason ? `: "${flag.reason}"` : ''}
                        </p>
                      ) : (
                        <p className="mt-1 text-amber-600 italic">Not yet resolved by the marketer.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canReviewOrApprove && (
                <div className="rounded-lg border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-body font-medium text-gray-800">Re-verify BVN Against Provider</p>
                      <p className="text-xs text-gray-400 font-body mt-0.5">Live lookup, compared side-by-side against what's on record.</p>
                    </div>
                    <button onClick={() => void handleCompareBvn()} disabled={isComparingBvn} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1 shrink-0">
                      {isComparingBvn ? <Loader2Icon size={14} className="animate-spin" /> : <RefreshCwIcon size={14} />}
                      Verify
                    </button>
                  </div>
                  {bvnComparison && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs font-body">
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide mb-1">On Record</p>
                        <p className="text-gray-700">{bvnComparison.onRecord.firstName} {bvnComparison.onRecord.lastName}</p>
                        <p className="text-gray-700">{bvnComparison.onRecord.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase tracking-wide mb-1">Provider</p>
                        <p className={bvnComparison.provider.firstName.toLowerCase() !== bvnComparison.onRecord.firstName.toLowerCase() || bvnComparison.provider.lastName.toLowerCase() !== bvnComparison.onRecord.lastName.toLowerCase() ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                          {bvnComparison.provider.firstName} {bvnComparison.provider.lastName}
                        </p>
                        <p className={bvnComparison.provider.phoneNumber !== bvnComparison.onRecord.phoneNumber ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                          {bvnComparison.provider.phoneNumber}
                        </p>
                        <p className="text-gray-500 mt-1">DOB: {bvnComparison.provider.dateOfBirth}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border border-gray-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-body font-medium text-gray-800">BVN</p>
                    {mismatchFlags.length > 0 && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                          mismatchFlags.some((flag) => !flag.resolvedAt)
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}
                        title="The marketer's submitted name/phone didn't match the BVN provider's record — see the mismatch details below."
                      >
                        <AlertCircleIcon size={11} />
                        {mismatchFlags.some((flag) => !flag.resolvedAt) ? 'Mismatch flagged' : 'Mismatch was flagged'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-body mt-0.5">Verified during onboarding (OTP consent) — read-only here.</p>
                  {mismatchFlags.length > 0 && (
                    <p className="text-xs text-amber-600 font-body mt-1">
                      Submitted details didn't match the BVN provider's record — the marketer proceeded anyway.
                      {mismatchFlags.some((flag) => !flag.resolvedAt) ? ' See "What the marketer submitted vs. the provider\'s record" above.' : ' This was since resolved.'}
                    </p>
                  )}
                  {revealedBvn && <p className="text-sm font-mono text-gray-700 mt-1">{revealedBvn}</p>}
                </div>
                {isApproveTier && (
                  <button onClick={() => void revealBvn()} disabled={isRevealingKyc === 'bvn'} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                    {isRevealingKyc === 'bvn' ? <Loader2Icon size={14} className="animate-spin" /> : revealedBvn ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    {revealedBvn ? 'Hide' : 'View'}
                  </button>
                )}
              </div>

              <div className="border border-gray-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-body font-medium text-gray-800">NIN</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kycCaptureStatus?.ninRecorded ? (kycCaptureStatus.ninVerified ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200') : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                      {kycCaptureStatus?.ninRecorded ? (kycCaptureStatus.ninVerified ? 'Verified' : 'Recorded') : 'Not recorded'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-body mt-0.5">Manually recorded — no live provider, never gates KYC status.</p>
                  {revealedNin !== undefined && <p className="text-sm font-mono text-gray-700 mt-1">{revealedNin ?? 'Not recorded'}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {canEditRecord && (
                    <button onClick={() => setActiveModal('record-nin')} className="text-xs font-body text-primary hover:text-primary/80 transition-colors">Record</button>
                  )}
                  {kycCaptureStatus?.ninRecorded && (
                    <button onClick={() => void revealNin()} disabled={isRevealingKyc === 'nin'} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      {isRevealingKyc === 'nin' ? <Loader2Icon size={14} className="animate-spin" /> : <EyeIcon size={14} />}
                      View
                    </button>
                  )}
                  {isApproveTier && (
                    <button onClick={() => setActiveModal('verify-nin')} className="text-xs font-body text-primary hover:text-primary/80 transition-colors">Verify</button>
                  )}
                </div>
              </div>

              <div className="border border-gray-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-body font-medium text-gray-800">Biometric Capture</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kycCaptureStatus?.biometricCaptured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                      {kycCaptureStatus?.biometricCaptured ? 'Uploaded' : 'Not uploaded'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-body mt-0.5">Compared against the BVN photo during disbursement verification.</p>
                  {biometricUrl && (
                    <a href={biometricUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">Open image</a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {canCaptureBiometric && (
                    <button onClick={() => setBiometricModalOpen(true)} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      <FingerprintIcon size={13} /> {kycCaptureStatus?.biometricCaptured ? 'Recapture' : 'Capture'}
                    </button>
                  )}
                  {kycCaptureStatus?.biometricCaptured && (
                    <button onClick={() => void revealBiometric()} disabled={isRevealingKyc === 'biometric'} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      {isRevealingKyc === 'biometric' ? <Loader2Icon size={14} className="animate-spin" /> : <EyeIcon size={14} />}
                      View
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-gray-100 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-body font-medium text-gray-800">ID Document</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kycCaptureStatus?.idDocumentCaptured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                      {kycCaptureStatus?.idDocumentCaptured ? 'Uploaded' : 'Not uploaded'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-body mt-0.5">A photo of the customer's NIN slip, voter's card, or similar.</p>
                  {idDocumentUrl && (
                    <a href={idDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 inline-block">Open image</a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {canCaptureBiometric && (
                    <button onClick={() => setIdDocumentModalOpen(true)} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      <FingerprintIcon size={13} /> {kycCaptureStatus?.idDocumentCaptured ? 'Recapture' : 'Capture'}
                    </button>
                  )}
                  {kycCaptureStatus?.idDocumentCaptured && (
                    <button onClick={() => void revealIdDocument()} disabled={isRevealingKyc === 'idDocument'} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                      {isRevealingKyc === 'idDocument' ? <Loader2Icon size={14} className="animate-spin" /> : <EyeIcon size={14} />}
                      View
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'group' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {isLoadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                  <Loader2Icon size={16} className="animate-spin" /> Loading group membership...
                </div>
              ) : customer.status !== 'ACTIVE' ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">Group membership requires an approved customer.</p>
              ) : customerGroups.length === 0 ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">Not a member of any group.</p>
              ) : (
                customerGroups.map(({ group, role }) => (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/customers/groups/${group.id}`)}
                    className="border border-gray-100 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-heading font-semibold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-400 font-body mt-0.5">{withId(group.branchName ?? branches.find((b) => b.id === group.branchId)?.name, group.branchId)}</p>
                    </div>
                    <span className="text-xs font-medium text-primary bg-primary/5 px-2.5 py-1 rounded-full">
                      {role === 'GROUP_HEAD' ? 'Group Head' : role === 'GROUP_HEAD_ASSISTANT' ? 'Assistant Head' : role === 'COORDINATOR' ? 'Coordinator' : 'Member'}
                    </span>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'loans' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="overflow-x-auto">
                {isLoadingLoans ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                    <Loader2Icon size={16} className="animate-spin" /> Loading loan history...
                  </div>
                ) : loanHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 font-body py-8 text-center">No loan records found.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Tenure</th>
                        <th className="px-4 py-3 font-medium">Rate</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Raised</th>
                        <th className="px-4 py-3 font-medium">Disbursed</th>
                        <th className="px-4 py-3 font-medium">Maturity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm font-body">
                      {loanHistory.map((item) => (
                        <tr
                          key={item.memberLoanAccountId}
                          onClick={() => navigate(`/loan-manager/loans/${item.loanId}`)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium text-primary">{item.productName ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{formatNaira(item.principalAmountKobo)}</td>
                          <td className="px-4 py-3 text-gray-600">{item.tenureDays ? `${item.tenureDays} days` : '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{item.interestRateBasisPoints != null ? `${(item.interestRateBasisPoints / 100).toFixed(2)}%` : '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={loanHistoryStatusBadge(item)} /></td>
                          <td className="px-4 py-3 text-gray-600">{formatDisplayDate(item.raisedAt)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDisplayDate(item.disbursedAt)}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDisplayDate(item.maturityDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'fees' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-body text-gray-500">Every fee actually paid or waived for this customer.</p>
                {canRecordFeePayment && (
                  <button
                    onClick={() => setPayFeePickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0"
                  >
                    <ReceiptIcon size={14} /> Pay Fee
                  </button>
                )}
              </div>

              {isLoadingFeePayments ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                  <Loader2Icon size={16} className="animate-spin" /> Loading fees...
                </div>
              ) : feePayments.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-sm font-body text-gray-500">No fees have been paid for this customer yet.</p>
                </div>
              ) : (
                feePayments.map((fee) => (
                  <div key={fee.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-heading font-semibold text-gray-800 flex items-center gap-2">
                        <ReceiptIcon size={16} className="text-primary" />
                        {fee.feeName ?? 'Fee'}
                      </p>
                      <p className="text-xs font-body text-gray-500 mt-0.5">{fee.productName ?? '—'}</p>
                      {fee.recordedAt && <p className="text-xs font-body text-gray-400 mt-0.5">{formatDisplayDate(fee.recordedAt)}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-heading font-bold text-gray-800">{formatNaira(fee.amountKobo)}</p>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${fee.status === 'PAID' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                        {fee.status === 'PAID' ? 'Paid' : 'Waived'}
                      </span>
                      <div className="mt-1.5">
                        <button onClick={() => setViewingFee(fee)} className="text-xs font-body text-primary hover:text-primary/80 transition-colors">
                          View Payment Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {isLoadingAuditTrail ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 font-body py-6">
                  <Loader2Icon size={16} className="animate-spin" /> Loading audit trail...
                </div>
              ) : auditTrail.length === 0 ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">No recorded activity yet.</p>
              ) : (
                [...auditTrail].reverse().map((entry) => (
                  <div key={entry.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm font-heading font-semibold text-gray-800">{formatAuditAction(entry.action)}</p>
                      <p className="text-xs text-gray-400 font-body">{formatDisplayDateTime(entry.timestamp)}</p>
                    </div>
                    <p className="text-xs text-gray-500 font-body mt-1">Actor: {entry.actorId ? withId(entry.actorName, entry.actorId) : 'System'}</p>
                    {typeof entry.metadata?.comment === 'string' && entry.metadata.comment && (
                      <p className="text-xs text-gray-600 font-body mt-1.5 italic">"{entry.metadata.comment}"</p>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
