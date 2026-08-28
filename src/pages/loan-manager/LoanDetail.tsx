import { useEffect, useRef, useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  FileTextIcon,
  UsersIcon,
  GitBranchIcon,
  CalendarIcon,
  ClockIcon,
  BanknoteIcon,
  CheckCircleIcon,
  XCircleIcon,
  CornerDownLeftIcon,
  CreditCardIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FingerprintIcon,
  Loader2Icon,
  RefreshCwIcon,
  PencilIcon,
  Trash2Icon,
  CameraIcon,
  VideoOffIcon,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import {
  loansService,
  type LoanDetail as LoanDetailData,
  type LoanDetailScheduleRow,
  type LoanDetailBorrower,
  type LoanDetailRepayment,
} from '../../services/loans/loans.service';
import { workflowRequestsService } from '../../services/workflow-requests/workflow-requests.service';
import { branchBankAccountsService, type BranchBankAccount } from '../../services/branch-bank-accounts/branch-bank-accounts.service';
import { repaymentsService, type RepaymentChannel } from '../../services/repayments/repayments.service';

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

const tabs = [
  { key: 'overview', label: 'Loan Overview', icon: FileTextIcon },
  { key: 'borrowers', label: 'Borrowers & Group', icon: UsersIcon },
  { key: 'approval', label: 'Approval Workflow', icon: GitBranchIcon },
  { key: 'repayment', label: 'Repayment Schedule', icon: CalendarIcon },
  { key: 'disbursement', label: 'Disbursement', icon: CreditCardIcon },
  { key: 'activity', label: 'Activity Log', icon: ClockIcon },
] as const;

function toCurrency(kobo: number): string {
  if (!Number.isFinite(kobo)) return '₦0';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);
}

function toDisplayDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
}

function toDisplayDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

function loanStatusBadge(status: LoanDetailData['status']): BadgeStatus {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'Pending Approval';
    case 'APPROVED':
      return 'Approved';
    case 'VERIFICATION_IN_PROGRESS':
      return 'Pending Review';
    case 'VERIFICATION_FAILED':
      return 'Overdue';
    case 'DISBURSED':
      return 'Disbursed';
    case 'REJECTED':
      return 'Rejected';
    case 'CLOSED':
      return 'Completed';
    default:
      return 'Pending';
  }
}

function memberStatusBadge(status: LoanDetailBorrower['status']): BadgeStatus {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'ACTIVE':
      return 'Active';
    case 'CLOSED':
      return 'Completed';
    case 'DEFAULTED':
      return 'Overdue';
    default:
      return 'Pending';
  }
}

function stepStatusBadge(status: LoanDetailData['approvalWorkflow'][number]['status']): BadgeStatus {
  switch (status) {
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'RETURNED':
      return 'Pending';
    default:
      return 'Pending';
  }
}

function verificationStatusBadge(status: NonNullable<LoanDetailBorrower['verification']>['status']): BadgeStatus {
  switch (status) {
    case 'PASSED':
      return 'Verified';
    case 'FAILED':
      return 'Rejected';
    case 'ESCALATED':
      return 'Overdue';
    default:
      return 'Pending';
  }
}

function scheduleRowStatusBadge(status: LoanDetailScheduleRow['status']): BadgeStatus {
  if (status === 'PAID') return 'Completed';
  if (status === 'PARTIAL') return 'Pending Review';
  return 'Pending';
}

const CHANNEL_LABEL: Record<'CASH' | 'BANK_TRANSFER' | 'BANK_DEPOSIT', string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  BANK_DEPOSIT: 'Bank Deposit',
};

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-400 font-body mb-1">{label}</p>
      <p className={`text-lg font-heading font-bold ${highlight ? 'text-accent' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function RepaymentScheduleTab({ schedule, navigate }: { schedule: LoanDetailScheduleRow[]; navigate: (path: string) => void }) {
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const toggleRow = (num: number) => {
    setExpandedRows((prev) => (prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]));
  };

  if (schedule.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarIcon size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-400 font-body">No repayment schedule yet — this loan has not been disbursed.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-400 font-body">
        <UsersIcon size={14} />
        <span>Click any installment row to see individual borrower contributions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
              <th className="px-4 py-3 font-medium w-8"></th>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Principal</th>
              <th className="px-4 py-3 font-medium">Interest</th>
              <th className="px-4 py-3 font-medium">Total Due</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm font-body">
            {schedule.map((row) => {
              const isExpanded = expandedRows.includes(row.installmentNumber);
              return (
                <Fragment key={row.installmentNumber}>
                  <tr
                    onClick={() => toggleRow(row.installmentNumber)}
                    className={`transition-colors cursor-pointer border-b border-gray-50 ${row.balanceKobo > 0 && new Date(row.dueDate) < new Date() ? 'bg-red-50/50 hover:bg-red-50/70' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {isExpanded ? <ChevronDownIcon size={16} className="text-primary" /> : <ChevronRightIcon size={16} />}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{row.installmentNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{toDisplayDate(row.dueDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{toCurrency(row.principalKobo)}</td>
                    <td className="px-4 py-3 text-gray-600">{toCurrency(row.interestKobo)}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{toCurrency(row.totalDueKobo)}</td>
                    <td className="px-4 py-3 text-green-600 font-bold">{toCurrency(row.amountPaidKobo)}</td>
                    <td className={`px-4 py-3 font-bold ${row.balanceKobo > 0 ? 'text-red-600' : 'text-gray-700'}`}>{toCurrency(row.balanceKobo)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={scheduleRowStatusBadge(row.status)} />
                    </td>
                  </tr>
                  {isExpanded &&
                    row.borrowerRows.map((bp, bIdx) => (
                      <tr key={`${row.installmentNumber}-${bIdx}`} className="bg-gray-50/60 border-b border-gray-50/80">
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mx-auto"></div>
                        </td>
                        <td
                          className="px-4 py-2.5 text-primary text-xs font-medium cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${bp.customerId}`);
                          }}
                        >
                          {bp.name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{toCurrency(bp.principalKobo)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{toCurrency(bp.interestKobo)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{toCurrency(bp.totalDueKobo)}</td>
                        <td className="px-4 py-2.5 text-xs text-green-600 font-medium">{toCurrency(bp.amountPaidKobo)}</td>
                        <td className={`px-4 py-2.5 text-xs font-medium ${bp.balanceKobo > 0 ? 'text-red-600' : 'text-gray-600'}`}>{toCurrency(bp.balanceKobo)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={scheduleRowStatusBadge(bp.status)} />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Live camera capture for pre-disbursement facial verification — replaces a
 * plain file picker with an actual webcam session, since the captured frame
 * is what gets compared against the customer's stored BVN photo via AWS
 * Rekognition (see backend LoanVerificationService.initiateMemberVerification).
 * Requests the camera on mount, lets the officer capture/retake a still
 * frame, and only then hands the resulting File up to the caller.
 */
function WebcamCaptureModal({
  borrowerName,
  isSubmitting,
  onSubmit,
}: {
  borrowerName: string;
  isSubmitting: boolean;
  onSubmit: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;
    let activeStream: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access a camera. Try a different device or browser.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setError('Could not access the camera — check the browser permission prompt and try again.'));

    return () => {
      isMounted = false;
      activeStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedFile(new File([blob], `verification-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        setCapturedUrl(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92,
    );
  }

  function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedFile(null);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <VideoOffIcon size={28} className="mx-auto text-red-400 mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : capturedUrl ? (
        <img src={capturedUrl} alt={`Captured frame of ${borrowerName}`} className="w-full rounded-lg border border-gray-200 aspect-video object-cover" />
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border border-gray-200 bg-black aspect-video object-cover" />
      )}
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex justify-center gap-3">
        {!error && !capturedUrl && (
          <button onClick={handleCapture} className="px-5 py-2.5 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2">
            <CameraIcon size={16} /> Capture Photo
          </button>
        )}
        {capturedUrl && (
          <>
            <button onClick={handleRetake} disabled={isSubmitting} className="px-4 py-2 border border-gray-200 text-sm rounded-lg disabled:opacity-60">Retake</button>
            <button
              onClick={() => capturedFile && onSubmit(capturedFile)}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Verifying...' : `Verify ${borrowerName}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [detail, setDetail] = useState<LoanDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['key']>('overview');
  const [isActing, setIsActing] = useState(false);

  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  function showToast(message: string) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  }

  const [workflowActionModal, setWorkflowActionModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [verifyingBorrower, setVerifyingBorrower] = useState<LoanDetailBorrower | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingDisbursement, setIsCheckingDisbursement] = useState(false);
  const [confirmingHandoverId, setConfirmingHandoverId] = useState<string | null>(null);

  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BranchBankAccount[]>([]);
  const [recordPaymentForm, setRecordPaymentForm] = useState({
    memberLoanAccountId: '',
    branchBankAccountId: '',
    channel: 'BANK_TRANSFER' as RepaymentChannel,
    transactionReference: '',
    amountNaira: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [viewingRepayment, setViewingRepayment] = useState<LoanDetailRepayment | null>(null);
  const [repaymentActionModal, setRepaymentActionModal] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [isActingOnRepayment, setIsActingOnRepayment] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ tenureDays: '', purpose: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const routeId = typeof id === 'string' ? id.trim() : '';

  const refresh = async () => {
    if (!routeId) {
      setLoadError('Invalid loan id.');
      setIsLoading(false);
      return;
    }
    try {
      const data = await loansService.getDetail(routeId);
      setDetail(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load loan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  async function handleWorkflowAction(action: 'APPROVED' | 'REJECTED' | 'RETURNED', comment?: string) {
    setWorkflowActionModal(null);
    if (!detail?.pendingWorkflowRequestId) return;
    try {
      setIsActing(true);
      await workflowRequestsService.act(detail.pendingWorkflowRequestId, { action, comment });
      await refresh();
      showToast(action === 'APPROVED' ? 'Step approved' : action === 'REJECTED' ? 'Loan rejected' : 'Returned to maker');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsActing(false);
    }
  }

  async function handleRepaymentWorkflowAction(action: 'APPROVED' | 'REJECTED' | 'RETURNED', comment?: string) {
    setRepaymentActionModal(null);
    if (!viewingRepayment?.pendingWorkflowRequestId) return;
    try {
      setIsActingOnRepayment(true);
      await workflowRequestsService.act(viewingRepayment.pendingWorkflowRequestId, { action, comment });
      setViewingRepayment(null);
      await refresh();
      showToast(
        action === 'APPROVED' ? 'Repayment step approved' : action === 'REJECTED' ? 'Repayment rejected' : 'Returned to maker',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsActingOnRepayment(false);
    }
  }

  function openVerifyModal(borrower: LoanDetailBorrower) {
    setVerifyingBorrower(borrower);
  }

  async function handleSubmitVerification(file: File) {
    if (!detail || !verifyingBorrower) return;
    try {
      setIsVerifying(true);
      const result = await loansService.verifyMember(detail.id, verifyingBorrower.customerId, file);
      await refresh();
      setVerifyingBorrower(null);
      showToast(
        result.status === 'PASSED'
          ? `${verifyingBorrower.name} verified — facial match ${result.facialMatch?.similarityPercent ?? '—'}%`
          : `Verification escalated for ${verifyingBorrower.name} — needs Admin/Approver review`,
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleCheckAndDisburse() {
    if (!detail) return;
    try {
      setIsCheckingDisbursement(true);
      await loansService.checkAndDisburse(detail.id);
      await refresh();
      showToast('Disbursement check re-run');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to re-check disbursement');
    } finally {
      setIsCheckingDisbursement(false);
    }
  }

  async function handleConfirmChequeHandover(memberLoanAccountId: string) {
    try {
      setConfirmingHandoverId(memberLoanAccountId);
      await loansService.confirmChequeHandover(memberLoanAccountId);
      await refresh();
      showToast('Cheque handover confirmed');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to confirm handover');
    } finally {
      setConfirmingHandoverId(null);
    }
  }

  function openRecordPaymentModal() {
    if (!detail) return;
    setRecordPaymentForm({
      memberLoanAccountId: detail.borrowers.find((b) => b.status === 'ACTIVE')?.memberLoanAccountId ?? '',
      branchBankAccountId: '',
      channel: 'BANK_TRANSFER',
      transactionReference: '',
      amountNaira: '',
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    setRecordPaymentModalOpen(true);
    // Only the branch's currently-active account — at most one — matches
    // what BranchFundingService/RepaymentsService actually accept.
    branchBankAccountsService
      .list(detail.group.branchId, true)
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]));
  }

  async function handleRecordPayment() {
    if (!detail) return;
    const amountKobo = Math.round(Number(recordPaymentForm.amountNaira) * 100);
    if (!recordPaymentForm.memberLoanAccountId || !recordPaymentForm.branchBankAccountId || !recordPaymentForm.transactionReference.trim() || !Number.isFinite(amountKobo) || amountKobo <= 0) {
      showToast('Fill in every field with a valid amount');
      return;
    }
    // Mirrors RepaymentsService.recordRepayment's own server-side guard —
    // checked here too so a marketer never even round-trips to the backend
    // to find out. Per-borrower balance (LoanDetailBorrower.
    // outstandingBalanceKobo), not the loan's aggregate — a repayment always
    // targets one specific member's account.
    const selectedBorrower = detail.borrowers.find((b) => b.memberLoanAccountId === recordPaymentForm.memberLoanAccountId);
    const outstandingForBorrower = selectedBorrower?.outstandingBalanceKobo ?? 0;
    if (amountKobo > outstandingForBorrower) {
      showToast("Amount can't be greater than outstanding balance!");
      return;
    }
    try {
      setIsRecordingPayment(true);
      await repaymentsService.recordRepayment({
        memberLoanAccountId: recordPaymentForm.memberLoanAccountId,
        branchBankAccountId: recordPaymentForm.branchBankAccountId,
        channel: recordPaymentForm.channel,
        transactionReference: recordPaymentForm.transactionReference.trim(),
        amountKobo,
        paymentDate: new Date(recordPaymentForm.paymentDate).toISOString(),
      });
      setRecordPaymentModalOpen(false);
      await refresh();
      showToast('Repayment recorded — awaiting review/approval before it affects the balance');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record repayment');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  function openEditModal() {
    if (!detail) return;
    setEditForm({ tenureDays: String(detail.tenureDays), purpose: detail.purpose ?? '' });
    setEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!detail) return;
    const tenureDays = Number(editForm.tenureDays);
    if (!Number.isInteger(tenureDays) || tenureDays < 14) {
      showToast('Tenure must be a whole number of at least 14 days');
      return;
    }
    try {
      setIsSavingEdit(true);
      await loansService.updatePendingApplication(detail.id, {
        tenureDays,
        purpose: editForm.purpose.trim() || undefined,
      });
      setEditModalOpen(false);
      await refresh();
      showToast('Loan application updated');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update loan application');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteLoan() {
    if (!detail) return;
    try {
      setIsDeleting(true);
      await loansService.deleteLoan(detail.id);
      navigate('/loan-manager/group-loans');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete loan application');
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileTextIcon size={48} className="text-gray-300 mb-4 animate-pulse" />
        <p className="text-sm font-body text-gray-400">Loading loan...</p>
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-sm text-gray-600 hover:text-primary transition-colors">
          <ArrowLeftIcon size={16} className="mr-2" />
          Back
        </button>
        <div className="bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-sm text-red-600">{loadError || 'Loan not found.'}</p>
        </div>
      </div>
    );
  }

  const isPending = detail.status === 'PENDING_APPROVAL';
  const isApproved = detail.status === 'APPROVED' || detail.status === 'VERIFICATION_IN_PROGRESS';
  const isDisbursed = detail.status === 'DISBURSED' || detail.status === 'CLOSED';
  const isOwnSubmission = Boolean(user && user.id === detail.raisedBy);
  // Status-driven, not just role-driven: a Marketer only ever holds
  // initiateCapability(LOAN) — never review or approve — so they should
  // never see these buttons at all. A Manager holds reviewCapability(LOAN)
  // and can only act while the current step is the review step; Admin/
  // SuperAdmin/Approver hold approveCapability(LOAN) and can only act once
  // it's reached the approve step. Same per-step gating shape as
  // Customers.tsx's canReviewGroups/canApproveGroups. Server-side capability
  // checks are the real gate; this only decides which buttons to show.
  const pendingStep = detail.approvalWorkflow.find((step) => step.status === 'PENDING');
  const isReviewStep = pendingStep?.requiredCapability === 'workflow:review:LOAN';
  const isApproveStep = pendingStep?.requiredCapability === 'workflow:approve:LOAN';
  const canActOnCurrentStep =
    Boolean(detail.pendingWorkflowRequestId) &&
    !isOwnSubmission &&
    ((isReviewStep && user?.role === 'manager') ||
      (isApproveStep && (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver')));
  // A loan application can only be edited or hard-deleted by the raiser,
  // and only before anything in its approval chain has acted — see
  // LoansService.updatePendingApplication/deleteLoan's own doc comments.
  const canEditOrDelete = isPending && isOwnSubmission;
  // `isDisbursed` above also covers CLOSED (kept broad on purpose — it
  // gates which tabs/sections apply post-disbursement generally) — Record
  // Payment specifically needs the loan to still be open, not "was disbursed
  // at some point". Backend now auto-closes a loan once every member
  // account's outstandingBalanceKobo (which already has every penalty ever
  // charged baked in — see LoansService.syncCompletionStatus) reaches 0, so
  // the balance check here is really just belt-and-suspenders against a
  // stale `detail` still showing DISBURSED for a moment.
  const isClosed = detail.status === 'CLOSED';
  const canRecordPayment =
    isDisbursed &&
    !isClosed &&
    detail.outstandingBalanceKobo > 0 &&
    (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager' || user?.role === 'marketer');
  // "Money actually received" — only APPROVED repayments ever moved the
  // needle on outstandingBalanceKobo (see RepaymentsService.applyToBalance),
  // so a PENDING/UNDER_DISPUTE/REJECTED record here would overstate it.
  const totalRepaidKobo = detail.repayments
    .filter((r) => r.status === 'APPROVED')
    .reduce((sum, r) => sum + r.amountKobo, 0);
  // A single-borrower loan is really an individual loan wearing a Group
  // wrapper — the group's own (often internal/auto-generated) name is less
  // useful there than just naming the one customer it's actually for. A
  // real multi-member group loan has no single "customer" to substitute, so
  // it keeps showing the group name.
  const headerName = detail.borrowers.length === 1 ? detail.borrowers[0].name : detail.group.name;
  // Record Payment modal's own live validation — see handleRecordPayment's
  // matching check (that one's the actual gate; this drives the inline
  // prompt/disabled state so a marketer sees the problem before submitting).
  const recordPaymentSelectedBorrower = detail.borrowers.find(
    (b) => b.memberLoanAccountId === recordPaymentForm.memberLoanAccountId,
  );
  const recordPaymentOutstandingKobo = recordPaymentSelectedBorrower?.outstandingBalanceKobo ?? 0;
  const recordPaymentAmountKobo = Math.round(Number(recordPaymentForm.amountNaira) * 100);
  const recordPaymentExceedsOutstanding =
    Boolean(recordPaymentForm.memberLoanAccountId) &&
    Number.isFinite(recordPaymentAmountKobo) &&
    recordPaymentAmountKobo > recordPaymentOutstandingKobo;
  const verifiedCount = detail.borrowers.filter((b) => b.verification?.status === 'PASSED').length;
  const allBorrowersVerified = detail.borrowers.length > 0 && verifiedCount === detail.borrowers.length;
  // Same maker-never-checks-own-work shape as canActOnCurrentStep above,
  // just keyed off the repayment's own pendingWorkflowStatus rather than a
  // per-step array (REPAYMENT_RECORD is always exactly this fixed 2-step
  // review-then-approve chain — see RepaymentsService.recordRepayment).
  const isOwnRepaymentSubmission = Boolean(user && viewingRepayment && user.id === viewingRepayment.recordedBy);
  const canActOnRepayment =
    Boolean(viewingRepayment?.pendingWorkflowRequestId) &&
    !isOwnRepaymentSubmission &&
    ((viewingRepayment?.pendingWorkflowStatus === 'PENDING_REVIEW' && user?.role === 'manager') ||
      (viewingRepayment?.pendingWorkflowStatus === 'PENDING_APPROVAL' &&
        (user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'approver')));

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
        isOpen={workflowActionModal === 'approve'}
        onClose={() => setWorkflowActionModal(null)}
        onConfirm={(val) => void handleWorkflowAction('APPROVED', val)}
        title="Approve this step"
        description="Move this loan application forward to the next step in its approval chain (or activate it, if this is the last step)."
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Approve"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Comment (optional)"
      />
      <ConfirmationModal
        isOpen={workflowActionModal === 'reject'}
        onClose={() => setWorkflowActionModal(null)}
        onConfirm={(val) => void handleWorkflowAction('REJECTED', val)}
        title="Reject this loan application"
        description="Rejecting closes every member's account on this loan without ever disbursing it. This cannot be undone."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Loan"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        requireInput
      />
      <ConfirmationModal
        isOpen={workflowActionModal === 'return'}
        onClose={() => setWorkflowActionModal(null)}
        onConfirm={(val) => void handleWorkflowAction('RETURNED', val)}
        title="Return to maker"
        description="Send this step back to the beginning of the chain for the maker to address, rather than approving or rejecting outright."
        icon={<div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600"><CornerDownLeftIcon size={20} /></div>}
        confirmLabel="Return"
        confirmVariant="orange"
        inputType="textarea"
        inputLabel="What needs to change"
        requireInput
      />

      <ConfirmationModal
        isOpen={repaymentActionModal === 'approve'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('APPROVED', val)}
        title="Approve this repayment"
        description="Move this repayment forward to the next step in its review chain (or apply it to the borrower's balance, if this is the last step)."
        icon={<div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><CheckCircleIcon size={20} /></div>}
        confirmLabel="Approve"
        confirmVariant="primary"
        inputType="textarea"
        inputLabel="Comment (optional)"
      />
      <ConfirmationModal
        isOpen={repaymentActionModal === 'reject'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('REJECTED', val)}
        title="Reject this repayment"
        description="Rejecting leaves the borrower's balance unaffected — this repayment is never applied. This cannot be undone."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><XCircleIcon size={20} /></div>}
        confirmLabel="Reject Repayment"
        confirmVariant="danger"
        inputType="textarea"
        inputLabel="Reason for rejection"
        requireInput
      />
      <ConfirmationModal
        isOpen={repaymentActionModal === 'return'}
        onClose={() => setRepaymentActionModal(null)}
        onConfirm={(val) => void handleRepaymentWorkflowAction('RETURNED', val)}
        title="Return to maker"
        description="Send this repayment back to the beginning of its review chain for whoever recorded it to address, rather than approving or rejecting outright."
        icon={<div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600"><CornerDownLeftIcon size={20} /></div>}
        confirmLabel="Return"
        confirmVariant="orange"
        inputType="textarea"
        inputLabel="What needs to change"
        requireInput
      />

      <AnimatePresence>
        {verifyingBorrower && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setVerifyingBorrower(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Verify: {verifyingBorrower.name}</h3>
              <p className="text-xs text-gray-500 font-body mb-4">
                Start a facial capture session — the frame is compared against the customer's stored biometric image
                (AWS Rekognition), plus a live BVN recheck. A failure escalates for Admin/Approver review — it never
                automatically rejects the loan.
              </p>
              <WebcamCaptureModal
                borrowerName={verifyingBorrower.name}
                isSubmitting={isVerifying}
                onSubmit={(file) => void handleSubmitVerification(file)}
              />
              <div className="flex justify-end mt-6">
                <button onClick={() => setVerifyingBorrower(null)} disabled={isVerifying} className="px-4 py-2 border border-gray-200 text-sm rounded-lg disabled:opacity-60">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recordPaymentModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setRecordPaymentModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Record a Repayment</h3>
              <p className="text-xs text-gray-500 font-body mb-4">No balance effect until a Manager reviews and an Admin/Approver approves it.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Borrower</label>
                  <select
                    value={recordPaymentForm.memberLoanAccountId}
                    onChange={(e) => setRecordPaymentForm((f) => ({ ...f, memberLoanAccountId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    <option value="">Select a borrower</option>
                    {detail.borrowers.filter((b) => b.status === 'ACTIVE').map((b) => (
                      <option key={b.memberLoanAccountId} value={b.memberLoanAccountId}>
                        {b.name} — {toCurrency(b.outstandingBalanceKobo ?? 0)} owing
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Bank Account (received into)</label>
                  <select
                    value={recordPaymentForm.branchBankAccountId}
                    onChange={(e) => setRecordPaymentForm((f) => ({ ...f, branchBankAccountId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    <option value="">Select an account</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.bankName} — {acc.accountNumber}</option>
                    ))}
                  </select>
                  {bankAccounts.length === 0 && (
                    <p className="text-xs text-amber-600 font-body mt-1">No branch bank accounts visible to your role — an Admin/SuperAdmin may need to record this instead.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                    <select
                      value={recordPaymentForm.channel}
                      onChange={(e) => setRecordPaymentForm((f) => ({ ...f, channel: e.target.value as RepaymentChannel }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="BANK_DEPOSIT">Bank Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
                    <input
                      type="number"
                      min={1}
                      value={recordPaymentForm.amountNaira}
                      onChange={(e) => setRecordPaymentForm((f) => ({ ...f, amountNaira: e.target.value.replace(/[^\d.]/g, '') }))}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${recordPaymentExceedsOutstanding ? 'border-red-300 focus:ring-red-100 focus:border-red-400' : 'border-gray-300 focus:ring-primary/20 focus:border-primary'}`}
                    />
                    {recordPaymentForm.memberLoanAccountId && (
                      recordPaymentExceedsOutstanding ? (
                        <p className="text-xs text-red-600 font-body mt-1">Amount can't be greater than outstanding balance!</p>
                      ) : (
                        <p className="text-xs text-gray-400 font-body mt-1">Outstanding: {toCurrency(recordPaymentOutstandingKobo)}</p>
                      )
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
                  <input
                    type="text"
                    value={recordPaymentForm.transactionReference}
                    onChange={(e) => setRecordPaymentForm((f) => ({ ...f, transactionReference: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={recordPaymentForm.paymentDate}
                    onChange={(e) => setRecordPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setRecordPaymentModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleRecordPayment()}
                  disabled={isRecordingPayment || recordPaymentExceedsOutstanding}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isRecordingPayment ? 'Recording...' : 'Record Repayment'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-lg font-heading font-bold text-gray-900 mb-1">Edit Loan Application</h3>
              <p className="text-xs text-gray-500 font-body mb-4">Only tenure and purpose can be changed here — locked the moment any step of the approval chain acts.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (days)</label>
                  <select
                    value={editForm.tenureDays}
                    onChange={(e) => setEditForm((f) => ({ ...f, tenureDays: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    {detail.product.tenureOptions.map((days) => (
                      <option key={days} value={days}>{days} days</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                  <textarea
                    rows={2}
                    value={editForm.purpose}
                    onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg">Cancel</button>
                <button
                  onClick={() => void handleSaveEdit()}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => void handleDeleteLoan()}
        title="Delete Loan Application"
        description="Permanently deletes this loan application and every member's account on it, and withdraws it from the approval chain. This cannot be undone."
        icon={<div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><Trash2Icon size={20} /></div>}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        confirmVariant="danger"
      />

      {/* Hidden (not unmounted — viewingRepayment itself stays set) while a
          repaymentActionModal confirmation dialog is open: both are
          position:fixed at the same z-index, so with this modal still in
          the DOM afterward in JSX order it would otherwise paint on top of
          and swallow every click meant for the confirmation dialog behind
          it — this is what "Approve"/"Reject" appeared to silently do
          nothing. Clearing repaymentActionModal (Cancel/X) brings this
          panel straight back since viewingRepayment was never nulled. */}
      {viewingRepayment && !repaymentActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewingRepayment(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-heading font-bold text-gray-900 mb-4">Repayment Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Borrower</span><span className="font-medium text-gray-800">{viewingRepayment.customerName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-gray-800">{toCurrency(viewingRepayment.amountKobo)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Channel</span><span className="font-medium text-gray-800">{CHANNEL_LABEL[viewingRepayment.channel]}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Transaction Reference</span><span className="font-medium text-gray-800 font-mono text-xs">{viewingRepayment.transactionReference}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment Date</span><span className="font-medium text-gray-800">{toDisplayDate(viewingRepayment.paymentDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Recorded By</span><span className="font-medium text-gray-800">{viewingRepayment.recordedByName ?? '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">Status</span>
                <StatusBadge
                  status={
                    viewingRepayment.status === 'APPROVED' ? 'Approved' :
                    viewingRepayment.status === 'REJECTED' ? 'Rejected' :
                    viewingRepayment.status === 'UNDER_DISPUTE' ? 'Pending Review' : 'Pending'
                  }
                />
              </div>
            </div>
            {viewingRepayment.pendingWorkflowRequestId && isOwnRepaymentSubmission && (
              <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                You recorded this repayment — a different reviewer/approver must act on it.
              </p>
            )}
            {viewingRepayment.pendingWorkflowRequestId && !isOwnRepaymentSubmission && !canActOnRepayment && (
              <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Awaiting {viewingRepayment.pendingWorkflowStatus === 'PENDING_REVIEW' ? "a Manager's review" : "an Admin/Approver's approval"}.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setViewingRepayment(null)} disabled={isActingOnRepayment} className="px-4 py-2 border border-gray-200 text-sm rounded-lg disabled:opacity-60">Close</button>
              {canActOnRepayment && (
                <>
                  <button onClick={() => setRepaymentActionModal('return')} disabled={isActingOnRepayment} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <CornerDownLeftIcon size={15} /> Return
                  </button>
                  <button onClick={() => setRepaymentActionModal('reject')} disabled={isActingOnRepayment} className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <XCircleIcon size={15} /> Reject
                  </button>
                  <button onClick={() => setRepaymentActionModal('approve')} disabled={isActingOnRepayment} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                    <CheckCircleIcon size={15} /> {viewingRepayment.pendingWorkflowStatus === 'PENDING_REVIEW' ? 'Review' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-body text-gray-500 hover:text-primary transition-colors">
        <ArrowLeftIcon size={16} />
        Back to Loan Manager
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-heading font-bold text-gray-900">{headerName}</h2>
              <StatusBadge status={loanStatusBadge(detail.status)} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-body text-gray-500">
              <span>{detail.group.branchName ?? '—'}</span>
              <span>Raised {toDisplayDate(detail.raisedAt)} by {detail.raisedByName}</span>
              <span>{detail.product.name}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditOrDelete && (
              <>
                <button onClick={openEditModal} className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
                  <PencilIcon size={15} /> Edit
                </button>
                <button onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 border border-red-200 text-red-600 text-sm font-heading font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">
                  <Trash2Icon size={15} /> Delete
                </button>
              </>
            )}
            {canActOnCurrentStep && (
              <>
                <button onClick={() => setWorkflowActionModal('approve')} disabled={isActing} className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                  <CheckCircleIcon size={15} /> Approve
                </button>
                <button onClick={() => setWorkflowActionModal('reject')} disabled={isActing} className="px-4 py-2 bg-red-600 text-white text-sm font-heading font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                  <XCircleIcon size={15} /> Reject
                </button>
                <button onClick={() => setWorkflowActionModal('return')} disabled={isActing} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-heading font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                  <CornerDownLeftIcon size={15} /> Return
                </button>
              </>
            )}
            {isApproved && (
              <button onClick={() => void handleCheckAndDisburse()} disabled={isCheckingDisbursement} className="px-4 py-2 bg-accent text-white text-sm font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                {isCheckingDisbursement ? <Loader2Icon size={15} className="animate-spin" /> : <BanknoteIcon size={15} />}
                {allBorrowersVerified ? 'Disburse Now' : `Check Disbursement (${verifiedCount}/${detail.borrowers.length})`}
              </button>
            )}
            {canRecordPayment && (
              <button onClick={openRecordPaymentModal} className="px-4 py-2 border border-primary/20 text-primary text-sm font-heading font-bold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
                <CreditCardIcon size={15} /> Record Payment
              </button>
            )}
          </div>
        </div>

        {isPending && !detail.pendingWorkflowRequestId && (
          <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Awaiting the approval chain — no step is currently assigned to a viewable actor.
          </div>
        )}
        {isOwnSubmission && detail.pendingWorkflowRequestId && (
          <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            You raised this application — a different reviewer/approver must act on the current step.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
          <MetricCard label="Loan Amount" value={toCurrency(detail.cumulativeAmountKobo)} />
          <MetricCard label="Interest Rate" value={`${(detail.product.interestRateBasisPoints / 100).toFixed(2)}%`} />
          <MetricCard label="Interest Amount" value={toCurrency(detail.totalInterestKobo)} />
          <MetricCard label="Expected Total Repayment" value={toCurrency(detail.totalRepayableKobo)} />
          <MetricCard label="Tenure" value={`${detail.tenureDays} days`} />
          {/* <MetricCard label="Members" value={String(detail.borrowers.length)} /> */}
          <MetricCard label="Total Repaid" value={toCurrency(totalRepaidKobo)} />
          <MetricCard label="Outstanding Balance" value={toCurrency(detail.outstandingBalanceKobo)} highlight={isDisbursed && detail.outstandingBalanceKobo > 0} />
          <MetricCard label="Disbursed" value={toDisplayDate(detail.disbursedAt)} />
          <MetricCard label="Status" value={detail.status.replace(/_/g, ' ')} highlight={detail.status === 'VERIFICATION_FAILED'} />
        </div>
      </motion.div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {tabs.map((tab) => {
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
          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { label: 'Loan Product', value: detail.product.name },
                { label: 'Purpose', value: detail.purpose ?? '—' },
                { label: 'Principal Amount', value: toCurrency(detail.cumulativeAmountKobo) },
                { label: 'Interest Rate', value: `${(detail.product.interestRateBasisPoints / 100).toFixed(2)}% flat` },
                { label: 'Interest Type', value: detail.product.interestType === 'FLAT' ? 'Flat' : 'Reducing Balance' },
                { label: 'Tenure', value: `${detail.tenureDays} days` },
                { label: 'Total Expected Repayment', value: toCurrency(detail.totalRepayableKobo) },
                { label: 'Total Interest', value: toCurrency(detail.totalInterestKobo) },
                { label: 'Total Repayments', value: toCurrency(totalRepaidKobo) },
                { label: 'Outstanding Balance', value: toCurrency(detail.outstandingBalanceKobo) },
                { label: 'Raised By', value: detail.raisedByName },
                { label: 'Date Raised', value: toDisplayDate(detail.raisedAt) },
                { label: 'Date Approved', value: toDisplayDate(detail.approvedAt) },
                { label: 'Date Disbursed', value: toDisplayDate(detail.disbursedAt) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-400 font-body mb-1">{item.label}</p>
                  <p className="text-sm font-body font-medium text-gray-800">{item.value}</p>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'borrowers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Group Name', value: detail.group.name },
                  { label: 'Branch', value: detail.group.branchName ?? '—' },
                  { label: 'Group Leader', value: detail.group.leaderName ?? '—' },
                  { label: 'Active Group Members', value: String(detail.group.memberCount) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5">
                    <p className="text-xs text-gray-400 font-body mb-1">{item.label}</p>
                    <p className="text-sm font-body font-medium text-gray-800 break-words">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                      <th className="px-4 py-3 font-medium">Borrower</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Share</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">KYC</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm font-body">
                    {detail.borrowers.map((b) => (
                      <tr key={b.memberLoanAccountId} onClick={() => navigate(`/customers/${b.customerId}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3 font-medium text-primary">{b.name}</td>
                        <td className="px-4 py-3 text-gray-600">{b.phoneNumber}</td>
                        <td className="px-4 py-3 text-gray-800 font-heading font-bold">{toCurrency(b.principalAmountKobo)}</td>
                        <td className="px-4 py-3 text-gray-600">{b.disbursementChannel === 'TRANSFER' ? 'Bank Transfer' : 'Cheque Pickup'}</td>
                        <td className="px-4 py-3 text-gray-600">{b.kycStatus.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3"><StatusBadge status={memberStatusBadge(b.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'approval' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              {detail.approvalWorkflow.length === 0 ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">No approval chain recorded for this loan.</p>
              ) : (
                <div className="relative pl-8 space-y-8">
                  {detail.approvalWorkflow.map((step, idx) => {
                    const dotColor =
                      step.status === 'APPROVED' ? 'bg-green-500 border-green-200' :
                      step.status === 'REJECTED' ? 'bg-red-500 border-red-200' :
                      step.status === 'RETURNED' ? 'bg-orange-500 border-orange-200' :
                      'bg-yellow-500 border-yellow-200 animate-pulse';
                    const lineColor = step.status === 'APPROVED' ? 'bg-green-200' : 'bg-gray-200';
                    return (
                      <div key={idx} className="relative">
                        {idx < detail.approvalWorkflow.length - 1 && <div className={`absolute left-[-20px] top-6 w-0.5 h-full ${lineColor}`} />}
                        <div className={`absolute -left-[26px] top-1 w-5 h-5 rounded-full border-4 ${dotColor}`} />
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="text-sm font-heading font-bold text-gray-800">Step {idx + 1}</h4>
                              <p className="text-xs text-gray-400 font-body">{step.requiredCapability}</p>
                            </div>
                            <StatusBadge status={stepStatusBadge(step.status)} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm font-body">
                            <div>
                              <p className="text-xs text-gray-400">Acted By</p>
                              <p className="text-gray-700">{step.actedByName ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">Date</p>
                              <p className="text-gray-700">{toDisplayDateTime(step.actedAt)}</p>
                            </div>
                          </div>
                          {step.comment && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-400 font-body">Comment</p>
                              <p className="text-sm text-gray-600 font-body italic">"{step.comment}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'repayment' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <RepaymentScheduleTab schedule={detail.repaymentSchedule} navigate={navigate} />

              <div>
                <h4 className="text-sm font-heading font-bold text-gray-700 mb-3">Repayment Records</h4>
                {detail.repayments.length === 0 ? (
                  <p className="text-sm text-gray-400 font-body py-4">No repayments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                          <th className="px-4 py-3 font-medium">Borrower</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Channel</th>
                          <th className="px-4 py-3 font-medium">Reference</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Recorded By</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm font-body">
                        {detail.repayments.map((r) => (
                          <tr key={r.id} onClick={() => setViewingRepayment(r)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                            <td className="px-4 py-3 font-medium text-primary">{r.customerName}</td>
                            <td className="px-4 py-3 text-gray-800 font-heading font-bold">{toCurrency(r.amountKobo)}</td>
                            <td className="px-4 py-3 text-gray-600">{CHANNEL_LABEL[r.channel]}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.transactionReference}</td>
                            <td className="px-4 py-3 text-gray-600">{toDisplayDate(r.paymentDate)}</td>
                            <td className="px-4 py-3 text-gray-600">{r.recordedByName ?? '—'}</td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                status={
                                  r.status === 'APPROVED' ? 'Approved' :
                                  r.status === 'REJECTED' ? 'Rejected' :
                                  r.status === 'UNDER_DISPUTE' ? 'Pending Review' : 'Pending'
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-heading font-bold text-gray-700 mb-3">Penalty Charges</h4>
                {detail.penalties.length === 0 ? (
                  <p className="text-sm text-gray-400 font-body py-4">No penalties incurred — every installment has been paid on time so far.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-red-50/60 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider font-heading">
                          <th className="px-4 py-3 font-medium">Borrower</th>
                          <th className="px-4 py-3 font-medium">Installment</th>
                          <th className="px-4 py-3 font-medium">Overdue Amount</th>
                          <th className="px-4 py-3 font-medium">Days Late</th>
                          <th className="px-4 py-3 font-medium">Penalty</th>
                          <th className="px-4 py-3 font-medium">Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm font-body">
                        {detail.penalties.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-3 font-medium text-primary">{p.customerName}</td>
                            <td className="px-4 py-3 text-gray-600">#{p.scheduleInstallmentNumber}</td>
                            <td className="px-4 py-3 text-gray-700">{toCurrency(p.overdueAmountKobo)}</td>
                            <td className="px-4 py-3 text-gray-600">{p.daysLateAtApplication}</td>
                            <td className="px-4 py-3 text-red-600 font-heading font-bold">{toCurrency(p.penaltyAmountKobo)}</td>
                            <td className="px-4 py-3 text-gray-500">{toDisplayDate(p.appliedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'disbursement' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {!isApproved && !isDisbursed && (
                <div className="text-center py-12">
                  <CreditCardIcon size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400 font-body">This loan isn't approved yet — verification opens up once it is.</p>
                </div>
              )}

              {(isApproved || isDisbursed) && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FingerprintIcon size={18} className="text-accent" />
                      <h4 className="text-sm font-heading font-bold text-gray-800">Per-Borrower Disbursement Verification</h4>
                    </div>
                    {isApproved && (
                      <button onClick={() => void handleCheckAndDisburse()} disabled={isCheckingDisbursement} className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                        {isCheckingDisbursement ? <Loader2Icon size={13} className="animate-spin" /> : <RefreshCwIcon size={13} />}
                        Re-check
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    {detail.borrowers.map((b) => (
                      <div key={b.memberLoanAccountId} className="flex items-center justify-between p-3.5 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${b.verification?.status === 'PASSED' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                            {b.verification?.status === 'PASSED' ? <CheckCircleIcon size={18} /> : <FingerprintIcon size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-body font-medium text-gray-800">{b.name}</p>
                            <p className="text-xs font-body text-gray-400">
                              {b.disbursementChannel === 'TRANSFER'
                                ? b.bankAccountDetails ? `${b.bankAccountDetails.bankName} — ${b.bankAccountDetails.accountNumber}` : 'Bank Transfer'
                                : 'Cheque Pickup'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-heading font-bold text-gray-800">{toCurrency(b.principalAmountKobo)}</p>
                            {b.verification?.similarityPercent != null && (
                              <p className="text-[10px] font-body text-gray-400 uppercase">{b.verification.similarityPercent}% match</p>
                            )}
                          </div>
                          {b.verification?.status === 'PASSED' ? (
                            <StatusBadge status={verificationStatusBadge(b.verification.status)} />
                          ) : b.status === 'ACTIVE' ? (
                            <StatusBadge status="Disbursed" />
                          ) : b.verification ? (
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={verificationStatusBadge(b.verification.status)} />
                              {b.verification.escalationReason && <p className="text-[10px] text-red-500 max-w-[160px] text-right">{b.verification.escalationReason}</p>}
                            </div>
                          ) : isApproved ? (
                            <button onClick={() => openVerifyModal(b)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-heading font-bold rounded-lg hover:bg-accent/90 transition-colors">
                              <FingerprintIcon size={14} /> Verify
                            </button>
                          ) : (
                            <StatusBadge status="Pending" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDisbursed && detail.borrowers.some((b) => b.disbursementChannel === 'CHEQUE_PICKUP') && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                    <h4 className="text-sm font-heading font-bold text-gray-800">Cheque Handover</h4>
                  </div>
                  <div className="p-4 space-y-2">
                    {detail.borrowers.filter((b) => b.disbursementChannel === 'CHEQUE_PICKUP' && b.status === 'ACTIVE').map((b) => (
                      <div key={b.memberLoanAccountId} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <p className="text-sm font-body text-gray-800">{b.name}</p>
                        {b.chequeHandedOverAt ? (
                          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircleIcon size={13} /> Handed over {toDisplayDate(b.chequeHandedOverAt)}</span>
                        ) : (
                          <button
                            onClick={() => void handleConfirmChequeHandover(b.memberLoanAccountId)}
                            disabled={confirmingHandoverId === b.memberLoanAccountId}
                            className="px-3 py-1.5 bg-primary text-white text-xs font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            Confirm Handover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              {detail.activity.length === 0 ? (
                <p className="text-sm text-gray-400 font-body py-8 text-center">No recorded activity yet.</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-gray-100 space-y-6">
                  {[...detail.activity].reverse().map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-white border-2 border-primary" />
                      <p className="text-sm font-body text-gray-800">{item.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-body text-gray-400 mt-0.5">{toDisplayDateTime(item.date)} • by {item.byName}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
