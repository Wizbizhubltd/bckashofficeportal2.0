import { api } from '../../app/api';
import { compressImageFile } from '../../utils/image-compression';
import type {
  BvnReviewComparison,
  ConfirmBvnVerificationPayload,
  ConfirmBvnVerificationResult,
  Customer,
  CustomerAuditEntry,
  CustomerKycCaptureStatus,
  CustomerRepaymentRisk,
  DisableCustomerPayload,
  IdDocumentType,
  ListCustomersFilter,
  ManuallyVerifyNinPayload,
  MismatchFlag,
  RecordNinPayload,
  ResolveIdentityMismatchPayload,
  ResolveIdentityMismatchResult,
  UpdateOnboardingDetailsPayload,
  VerifyBvnPayload,
  VerifyBvnResult,
} from './customers.types';

/**
 * `customers` tag — backashbackend/src/modules/customers/customer.controller.ts.
 * `list`/`getById` are open to every authenticated role — see
 * ListCustomersFilter's own doc comment for how the row-level scope works.
 */
export const customersService = {
  list: (filter?: ListCustomersFilter): Promise<Customer[]> =>
    api.get<Customer[]>('/customers', filter ? { params: filter } : undefined),

  getById: (id: string): Promise<Customer> => api.get<Customer>(`/customers/${id}`),

  /** Same view scope as getById. See CustomerRepaymentRisk's own doc comment. */
  getRepaymentRisk: (id: string): Promise<CustomerRepaymentRisk> =>
    api.get<CustomerRepaymentRisk>(`/customers/${id}/repayment-risk`),

  /**
   * KYC step 1 — the real BVN provider has no OTP/consent step, just one
   * live lookup. Creates nothing yet: `mismatchFlags` compares whatever
   * fullName/phoneNumber were submitted here against the provider's own
   * resolved values ([] when nothing was submitted, or nothing mismatched),
   * and `previewId` references what the provider resolved, held server-side
   * until `confirmBvnVerification` actually creates the draft Customer
   * record (PENDING_APPROVAL) — see VerifyBvnResult's own doc comment.
   */
  verifyBvn: (payload: VerifyBvnPayload): Promise<VerifyBvnResult> =>
    api.post<VerifyBvnResult, VerifyBvnPayload>('/customers/verify-bvn', payload),

  /** KYC step 2 — see ConfirmBvnVerificationPayload's own doc comment. Only the staff member who ran verifyBvn may confirm it, and only before its preview expires. */
  confirmBvnVerification: (payload: ConfirmBvnVerificationPayload): Promise<ConfirmBvnVerificationResult> =>
    api.post<ConfirmBvnVerificationResult, ConfirmBvnVerificationPayload>('/customers/confirm-bvn-verification', payload),

  /** Creator only. */
  updateOnboardingDetails: (id: string, payload: UpdateOnboardingDetailsPayload): Promise<Customer> =>
    api.patch<Customer, UpdateOnboardingDetailsPayload>(`/customers/${id}/onboarding-details`, payload),

  /** Creator only. Compressed client-side before upload — see utils/image-compression. */
  captureBiometric: async (id: string, image: File): Promise<{ biometricImageKey: string | null }> => {
    const formData = new FormData();
    formData.append('image', await compressImageFile(image));
    return api.post<{ biometricImageKey: string | null }, FormData>(`/customers/${id}/biometric`, formData);
  },

  /** Creator only — a photo of the customer's ID document (NIN slip, voter's card, ...). Never gates kycStatus. Compressed client-side before upload. */
  captureIdDocument: async (
    id: string,
    image: File,
    documentType?: IdDocumentType,
  ): Promise<{ idDocumentImageKey: string | null; idDocumentType: IdDocumentType | null }> => {
    const formData = new FormData();
    formData.append('image', await compressImageFile(image));
    if (documentType) {
      formData.append('documentType', documentType);
    }
    return api.post<{ idDocumentImageKey: string | null; idDocumentType: IdDocumentType | null }, FormData>(
      `/customers/${id}/id-document`,
      formData,
    );
  },

  /** Creator only. */
  recordNin: (id: string, payload: RecordNinPayload): Promise<{ recorded: true }> =>
    api.post<{ recorded: true }, RecordNinPayload>(`/customers/${id}/nin`, payload),

  /** Admin/SuperAdmin/Approver only — a recorded fact, not a maker-checker approval. */
  manuallyVerifyNin: (id: string, payload: ManuallyVerifyNinPayload): Promise<{ verified: true }> =>
    api.post<{ verified: true }, ManuallyVerifyNinPayload>(`/customers/${id}/nin/verify`, payload),

  /** Creator only. */
  submitForApproval: (id: string): Promise<unknown> => api.post(`/customers/${id}/submit`, undefined),

  /** Creator only — for a REJECTED customer. Edit the flagged details first (now allowed while REJECTED), then call this to start a fresh review cycle. */
  resubmitForApproval: (id: string): Promise<unknown> => api.post(`/customers/${id}/resubmit`, undefined),

  /** Every recorded action on this customer, oldest first. Same view scope as getById. */
  getAuditTrail: (id: string): Promise<CustomerAuditEntry[]> =>
    api.get<CustomerAuditEntry[]>(`/customers/${id}/audit-trail`),

  /** Presence-only flags (never the actual value) — same view scope as getById. Drives the "uploaded" + eye-icon state in the KYC tab. */
  getKycCaptureStatus: (id: string): Promise<CustomerKycCaptureStatus> =>
    api.get<CustomerKycCaptureStatus>(`/customers/${id}/kyc-status`),

  /** Reviewer (Manager) or approver only — live re-verifies the stored BVN against the provider, for comparison against what's on record. */
  getBvnReviewComparison: (id: string): Promise<BvnReviewComparison> =>
    api.post<BvnReviewComparison, undefined>(`/customers/${id}/bvn/review-comparison`, undefined),

  /** Creator only, and only before the record has ever gone ACTIVE — withdraws a draft/REJECTED customer. Cancels any still-pending WorkflowRequest first. */
  deleteCustomer: (id: string): Promise<{ deleted: true }> => api.delete<{ deleted: true }>(`/customers/${id}`),

  /** Creator only, ACTIVE customers only — a reason plus a photo of the customer's signature. Only Admin/SuperAdmin/Approver can grant it. Signature compressed client-side before upload. */
  requestEditPrivilege: async (id: string, reason: string, signature: File): Promise<Customer> => {
    const formData = new FormData();
    formData.append('reason', reason);
    formData.append('signature', await compressImageFile(signature));
    return api.post<Customer, FormData>(`/customers/${id}/edit-privilege/request`, formData);
  },

  /** Admin/SuperAdmin/Approver only — grant or reject a pending edit privilege request. */
  decideEditPrivilege: (id: string, approve: boolean, comment?: string): Promise<Customer> =>
    api.post<Customer, { approve: boolean; comment?: string }>(`/customers/${id}/edit-privilege/decide`, { approve, comment }),

  /** Admin/SuperAdmin/Approver only — a short-lived signed URL for the customer's signature on a pending/decided edit privilege request. */
  getEditPrivilegeSignatureUrl: (id: string): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>(`/customers/${id}/edit-privilege/signature-url`),

  /** Admin/SuperAdmin/Approver only. */
  disable: (id: string, payload: DisableCustomerPayload): Promise<Customer> =>
    api.post<Customer, DisableCustomerPayload>(`/customers/${id}/disable`, payload),

  /** Admin/SuperAdmin/Approver only. */
  enable: (id: string): Promise<Customer> => api.post<Customer, undefined>(`/customers/${id}/enable`, undefined),

  /** Admin/SuperAdmin/Approver only. Every read is audit-logged server-side (KYC_DATA_READ). */
  getDecryptedBvn: (id: string): Promise<{ bvn: string }> => api.get<{ bvn: string }>(`/customers/${id}/bvn`),

  /** Same view scope as getById (creator, their branch's Manager, or Admin/SuperAdmin/Approver) — not Admin/Approver-only. Every read is audit-logged server-side (KYC_DATA_READ). */
  getDecryptedNin: (id: string): Promise<{ nin: string | null }> =>
    api.get<{ nin: string | null }>(`/customers/${id}/nin`),

  /** Same view scope as getById — a short-lived signed URL for the captured biometric image. */
  getBiometricSignedUrl: (id: string): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>(`/customers/${id}/biometric-url`),

  /** Same view scope as getById — a short-lived signed URL for the captured ID document image. */
  getIdDocumentSignedUrl: (id: string): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>(`/customers/${id}/id-document-url`),

  /** Admin/SuperAdmin/Approver only — recorded once, at verify-bvn time. Every read is audit-logged (KYC_DATA_READ). */
  getMismatchFlags: (id: string): Promise<{ mismatchFlags: MismatchFlag[] }> =>
    api.get<{ mismatchFlags: MismatchFlag[] }>(`/customers/${id}/mismatch-flags`),

  /** Creator only — pick between the provider's resolved identity (no reason needed) and what was submitted (requires `reason`). */
  resolveIdentityMismatch: (id: string, payload: ResolveIdentityMismatchPayload): Promise<ResolveIdentityMismatchResult> =>
    api.patch<ResolveIdentityMismatchResult, ResolveIdentityMismatchPayload>(`/customers/${id}/resolve-identity-mismatch`, payload),
};

export * from './customers.types';
