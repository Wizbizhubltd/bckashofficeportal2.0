import { api } from '../../app/api';
import { compressImageFile } from '../../utils/image-compression';
import type {
  CustomerLoanHistoryItem,
  DisbursementVerificationResult,
  EscalationResolution,
  IssuedLoanConsentChallenge,
  ListLoansFilter,
  LoanDetail,
  LoanSummary,
  MemberLoanAccountStatus,
  RaiseLoanApplicationPayload,
  RaiseLoanApplicationResult,
  UpdatePendingLoanApplicationPayload,
} from './loans.types';

/** `loans` tag — backashbackend/src/modules/loans/loans.controller.ts. */
export const loansService = {
  /** Any authenticated staff member — a customer's full loan history, newest first. */
  getHistoryForCustomer: (customerId: string): Promise<CustomerLoanHistoryItem[]> =>
    api.get<CustomerLoanHistoryItem[]>('/loans/member-accounts', { params: { customerId } }),

  /** Row-scoped like `groupsService.list` — see LoanSummary's own doc comment. */
  list: (filter?: ListLoansFilter): Promise<LoanSummary[]> =>
    api.get<LoanSummary[]>('/loans', filter ? { params: filter } : undefined),

  /** Everything the Loan Manager detail page needs — see LoanDetail's own doc comment. */
  getDetail: (loanId: string): Promise<LoanDetail> => api.get<LoanDetail>(`/loans/${loanId}/detail`),

  /** Raiser only, and only while PENDING_APPROVAL — see UpdatePendingLoanApplicationPayload's own doc comment. */
  updatePendingApplication: (
    loanId: string,
    payload: UpdatePendingLoanApplicationPayload,
  ): Promise<{ loan: { _id: string }; memberLoanAccounts: unknown[] }> =>
    api.patch<{ loan: { _id: string }; memberLoanAccounts: unknown[] }, UpdatePendingLoanApplicationPayload>(
      `/loans/${loanId}`,
      payload,
    ),

  /** Raiser only, and only while PENDING_APPROVAL — hard-deletes the loan and every MemberLoanAccount. */
  deleteLoan: (loanId: string): Promise<{ deleted: true }> =>
    api.delete<{ deleted: true }>(`/loans/${loanId}`),

  /**
   * A 6-digit code sent to the customer's phone/email — read back to the
   * marketer, then submitted (with the returned challengeId) alongside
   * `raiseApplication`. Expires after 10 minutes.
   */
  requestConsent: (customerId: string): Promise<IssuedLoanConsentChallenge> =>
    api.post<IssuedLoanConsentChallenge, { customerId: string }>('/loans/consent/request', { customerId }),

  /** Marketer/Manager only (initiateCapability(LOAN)) — see RaiseLoanApplicationPayload's own doc comment. */
  raiseApplication: (payload: RaiseLoanApplicationPayload): Promise<RaiseLoanApplicationResult> =>
    api.post<RaiseLoanApplicationResult, RaiseLoanApplicationPayload>('/loans', payload),

  /** A follow-up call after raiseApplication — a photo of the customer taken at application time. Compressed client-side before upload. */
  uploadApplicantPhoto: async (
    memberLoanAccountId: string,
    image: File,
  ): Promise<{ applicantPhotoImageKey: string }> => {
    const formData = new FormData();
    formData.append('image', await compressImageFile(image));
    return api.post<{ applicantPhotoImageKey: string }, FormData>(
      `/loans/member-accounts/${memberLoanAccountId}/applicant-photo`,
      formData,
    );
  },

  /** A short-lived signed URL for the applicant photo, if one was captured. */
  getApplicantPhotoSignedUrl: (memberLoanAccountId: string): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>(`/loans/member-accounts/${memberLoanAccountId}/applicant-photo-url`),

  /** Live face capture vs. the BVN photo, plus a BVN recheck — see backend LoanVerificationController's own doc comment. Auto-triggers disbursement once every member has passed. */
  verifyMember: async (
    loanId: string,
    customerId: string,
    liveImage: File,
  ): Promise<DisbursementVerificationResult> => {
    const formData = new FormData();
    formData.append('liveImage', await compressImageFile(liveImage));
    return api.post<DisbursementVerificationResult, FormData>(
      `/loans/${loanId}/members/${customerId}/verify`,
      formData,
    );
  },

  /** Admin/Approver only — resolves an ESCALATED verification (failed facial/BVN check). Requires a note. */
  resolveEscalation: (
    verificationId: string,
    resolution: EscalationResolution,
    note: string,
  ): Promise<DisbursementVerificationResult> =>
    api.post<DisbursementVerificationResult, { resolution: EscalationResolution; note: string }>(
      `/loans/verifications/${verificationId}/resolve`,
      { resolution, note },
    ),

  /** A no-op unless every member has now passed verification — for retrying after a transient failure (e.g. insufficient branch funds). */
  checkAndDisburse: (loanId: string): Promise<{ status: string }> =>
    api.post<{ status: string }, Record<string, never>>(`/loans/${loanId}/check-and-disburse`, {}),

  /** CHEQUE_PICKUP only — confirms the physical handover, separate from the verification/disbursement step itself. */
  confirmChequeHandover: (memberLoanAccountId: string): Promise<{ status: MemberLoanAccountStatus }> =>
    api.post<{ status: MemberLoanAccountStatus }, Record<string, never>>(
      `/loans/member-accounts/${memberLoanAccountId}/confirm-cheque-handover`,
      {},
    ),
};

export * from './loans.types';
