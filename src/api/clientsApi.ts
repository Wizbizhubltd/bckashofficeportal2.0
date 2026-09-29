import apiClient from './apiClient';
import type { PagedResult } from './usersApi';

export type ClientStatus = 'Pending' | 'Active' | 'Inactive' | 'Declined' | 'Closed';
export type GroupStatus = 'Pending' | 'Active' | 'Inactive' | 'Declined' | 'Closed';

/** What the signed-in user may do with a client, as the API decides it. */
export interface ClientActions {
  canEditDetails: boolean;
  canApprove: boolean;
  canDecline: boolean;
  canDelete: boolean;
  canRequestDeletion: boolean;
  canMarkSafe: boolean;
  /** The onboarding staff member can ask a controller for edit privilege on an approved client. */
  canRequestEdit: boolean;
  /** A controller granted edit privilege and the client hasn't been approved again yet. */
  editPrivilegeOpen: boolean;
  /** The viewer is a controller and an edit request is waiting. */
  canReviewEditRequests: boolean;
}

/** A request to edit an approved client. */
export interface ClientEditRequest {
  id: number;
  clientId: number;
  clientName: string | null;
  clientAccountNo: string | null;
  officeName: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedById: number | null;
  requestedByName: string | null;
  createdAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  firstEditedAt: string | null;
  completedAt: string | null;
}

export interface ClientDetail {
  id: number;
  accountNo: string | null;
  oldAccountNo: string | null;
  displayName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  status: ClientStatus;
  clientType: string | null;
  bvn: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  maritalStatus: string | null;
  dob: string | null;
  occupation: string | null;
  externalId: string | null;
  businessAddress: string | null;
  nationality: string | null;
  staffId: number | null;
  /** The account officer (staffId's user). */
  staffName: string | null;
  officeId: number | null;
  officeName: string | null;
  joinedDate: string | null;
  address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  activatedDate: string | null;
  inactiveReason: string | null;
  declinedReason: string | null;
  closedReason: string | null;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string | null;
  activatedByName: string | null;
  bvnVerifiedAt: string | null;
  bvnDetailsSource: 'bvn' | 'client' | null;
  isHighRisk: boolean;
  highRiskReason: string | null;
  highRiskFlaggedAt: string | null;
  highRiskClearedAt: string | null;
  highRiskClearedNote: string | null;
  hasPhoto: boolean;
  actions: ClientActions | null;
  pendingDeletionRequest: boolean | null;
  /** What's still needed before a controller can approve the client, e.g. "1 more guarantor". */
  approvalBlockers: string[] | null;
  /** The edit request waiting for a controller, or the granted one still open. */
  currentEditRequest: ClientEditRequest | null;
  /** The client's loan or application still open, e.g. "Loan LN123 is still running." — null when none. */
  activeLoan: string | null;
  /** When the client's face was enrolled; null until it is. */
  biometricEnrolledAt: string | null;
  /** Why a loan can't be raised for the client (pending approval, face not captured) — null when it can. */
  loanBlocker: string | null;
}

/** What the printed membership/loan form needs besides the client record. */
export interface ClientLoanForm {
  staffName: string | null;
  /** From the client's latest loan application, or their latest loan. */
  proposedLoanAmount: number | null;
  loanTerm: number | null;
  loanTermType: string | null;
  loanProductName: string | null;
  nin: string | null;
  /** The application form fee in force now (Settings → Fees & Payments); null when switched off. */
  formFee: number | null;
  groupId: number | null;
  groupName: string | null;
  groupMembers: { clientId: number; name: string | null; role: string | null }[];
}

/** A guarantor or reference. */
export interface ClientContact {
  id: number;
  kind: 'guarantor' | 'reference';
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  relationship: string | null;
  occupation: string | null;
  gender: string | null;
  hasPhoto: boolean;
  createdAt: string | null;
}

export interface ClientGroupMembership {
  groupId: number;
  groupName: string | null;
  accountNo: string | null;
  status: GroupStatus;
  role: string | null;
  joinedAt: string | null;
}

export interface ClientAuditEntry {
  id: number | null;
  at: string | null;
  action: string | null;
  module: string | null;
  notes: string | null;
  userId: number | null;
  userName: string | null;
}

export interface ClientLoan {
  id: number;
  accountNumber: string | null;
  loanProductId: number | null;
  appliedAmount: number | null;
  approvedAmount: number | null;
  status: string;
}

export interface BvnFieldComparison {
  field: string;
  given: string | null;
  fromBvn: string | null;
  matches: boolean;
}

export interface BvnCheck {
  verificationId: number;
  matches: boolean;
  comparisons: BvnFieldComparison[];
  fromBvn: {
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    phone: string | null;
    birthDate: string | null;
    gender: string | null;
    /** Base64 JPEG from the BVN record, when the provider sends one. */
    photo: string | null;
  };
}

/** One client in an onboarding request; `detailsSource`/`overrideReason` only matter when the BVN didn't match. */
export interface OnboardClientInput {
  fullName: string;
  email: string | null;
  phone: string | null;
  bvn: string;
  bvnVerificationId: number;
  detailsSource: 'bvn' | 'client' | null;
  overrideReason: string | null;
}

export interface OnboardingResult {
  groupId: number | null;
  clients: { id: number; accountNo: string | null; displayName: string | null; isHighRisk: boolean }[];
}

export interface GroupSummaryMember {
  clientId: number;
  displayName: string | null;
  accountNo: string | null;
  status: ClientStatus;
  isHighRisk: boolean;
  role: string | null;
  loanAmount: number;
  pendingRepayment: number;
}

/** A loan or loan application on the group page: a member's own, their share of a group loan, or the group's. */
export interface GroupLoanRecord {
  kind: 'loan' | 'application';
  id: number;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  loanProductName: string | null;
  amount: number;
  status: string;
  date: string | null;
}

export interface GroupSummary {
  cumulativeLoanAmount: number;
  cumulativeLoanCount: number;
  pendingRepaymentAmount: number;
  totalMembers: number;
  approvedMembers: number;
  pendingMembers: number;
  members: GroupSummaryMember[];
  canDelete: boolean;
  canRequestDeletion: boolean;
  pendingDeletionRequest: boolean;
  createdByName: string | null;
  officeName: string | null;
  loanRecords: GroupLoanRecord[];
}

/**
 * The API's field-level onboarding errors: keys are "group", "office", "members", or "members[i]"
 * for the i-th client.
 */
export function onboardingErrors(error: unknown): Record<string, string> {
  const data = (error as { responseData?: { errors?: Record<string, string> } } | undefined)?.responseData;
  return data?.errors ?? {};
}

/** One face capture: an enrollment (the client's face on record) or a loan face match before disbursement. */
export interface FaceCapture {
  id: number;
  purpose: 'enrollment' | 'loan';
  loanId: number | null;
  status: 'pending' | 'passed' | 'failed';
  /** 0–100: how sure AWS is that a live person, not a photo or screen, was in front of the camera. */
  livenessConfidence: number | null;
  /** 0–100: how alike the face is to the enrolled one (loan captures only). */
  similarity: number | null;
  failureReason: string | null;
  capturedByName: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

export interface ClientBiometrics {
  configured: boolean;
  faceMatchThreshold: number;
  livenessThreshold: number;
  enrolled: boolean;
  enrolledAt: string | null;
  enrollment: FaceCapture | null;
  canEnroll: boolean;
  /** Whether face capture is mandatory (control portal → Settings → Loan): needed to approve the client and raise a loan. */
  required: boolean;
  enrollBlockedReason: string | null;
  captures: FaceCapture[];
}

export interface LoanFaceCheck {
  clientId: number;
  clientName: string | null;
  enrolled: boolean;
  verified: boolean;
  similarity: number | null;
  verifiedAt: string | null;
  /** Whether the viewer's role may run this face match (ticked by a super admin in the control portal). */
  canVerify: boolean;
  /** The latest failed attempt since the client last passed — null when there's none. */
  lastFailureReason: string | null;
  lastFailureSimilarity: number | null;
  lastFailedAt: string | null;
  /** Whether face capture is mandatory; when it isn't, the loan can be disbursed without the match. */
  required: boolean;
}

export const biometricsApi = {
  async get(clientId: number): Promise<ClientBiometrics> {
    return (await apiClient.get<ClientBiometrics>(`/clients/${clientId}/biometrics`)).data;
  },

  async start(clientId: number, purpose: 'enrollment' | 'loan', loanId: number | null): Promise<{ captureId: number; sessionId: string; region: string }> {
    return (await apiClient.post(`/clients/${clientId}/biometrics/sessions`, { purpose, loanId })).data;
  },

  async complete(clientId: number, sessionId: string): Promise<FaceCapture> {
    return (await apiClient.post<FaceCapture>(`/clients/${clientId}/biometrics/sessions/${encodeURIComponent(sessionId)}/complete`)).data;
  },

  /** Short-lived AWS credentials the camera component streams with — they allow nothing but the liveness check. */
  async credentials(): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: string }> {
    return (await apiClient.post('/biometrics/credentials')).data;
  },

  async loanChecks(loanId: number): Promise<LoanFaceCheck[]> {
    return (await apiClient.get<LoanFaceCheck[]>(`/loans/${loanId}/face-checks`)).data;
  },
};

export const editRequestsApi = {
  async request(clientId: number, reason: string): Promise<ClientEditRequest> {
    return (await apiClient.post<ClientEditRequest>(`/clients/${clientId}/edit-requests`, { reason })).data;
  },

  async forClient(clientId: number): Promise<ClientEditRequest[]> {
    return (await apiClient.get<ClientEditRequest[]>(`/clients/${clientId}/edit-requests`)).data;
  },

  /** Requests for clients in the viewer's offices; "pending" by default, or "all". */
  async list(status: ClientEditRequest['status'] | 'all', page: number, pageSize: number): Promise<PagedResult<ClientEditRequest>> {
    return (await apiClient.get<PagedResult<ClientEditRequest>>('/client-edit-requests', { params: { status, page, pageSize } })).data;
  },

  /** Controllers only. */
  async approve(id: number, note: string | null): Promise<ClientEditRequest> {
    return (await apiClient.post<ClientEditRequest>(`/client-edit-requests/${id}/approve`, { note })).data;
  },

  /** Controllers only; the note tells the requester why. */
  async reject(id: number, note: string): Promise<ClientEditRequest> {
    return (await apiClient.post<ClientEditRequest>(`/client-edit-requests/${id}/reject`, { note })).data;
  },
};

export const GROUP_ROLE_LABELS: Record<string, string> = {
  leader: 'Leader',
  assistant: 'Assistant',
  organizer: 'Organizer',
  member: 'Member',
};

export const clientsApi = {
  async get(id: number): Promise<ClientDetail> {
    return (await apiClient.get<ClientDetail>(`/clients/${id}`)).data;
  },

  async groups(id: number): Promise<ClientGroupMembership[]> {
    return (await apiClient.get<ClientGroupMembership[]>(`/clients/${id}/groups`)).data;
  },

  async audit(id: number): Promise<ClientAuditEntry[]> {
    return (await apiClient.get<ClientAuditEntry[]>(`/clients/${id}/audit`)).data;
  },

  async loanForm(id: number): Promise<ClientLoanForm> {
    return (await apiClient.get<ClientLoanForm>(`/clients/${id}/loan-form`)).data;
  },

  async contacts(id: number, kind: 'guarantors' | 'references'): Promise<ClientContact[]> {
    return (await apiClient.get<ClientContact[]>(`/clients/${id}/${kind}`)).data;
  },

  /** A guarantor's or reference's passport photo as an object URL (the endpoint needs the auth header); null when there's none. */
  async contactPhotoUrl(clientId: number, kind: 'guarantors' | 'references', contactId: number): Promise<string | null> {
    try {
      const response = await apiClient.get<Blob>(`/clients/${clientId}/${kind}/${contactId}/photo`, { responseType: 'blob' });
      return URL.createObjectURL(response.data);
    } catch {
      return null;
    }
  },

  async uploadContactPhoto(clientId: number, kind: 'guarantors' | 'references', contactId: number, file: File): Promise<ClientContact> {
    const body = new FormData();
    body.append('file', file);
    return (await apiClient.post<ClientContact>(`/clients/${clientId}/${kind}/${contactId}/photo`, body, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },

  /** The application form fee every loan applicant pays now, or null when it's switched off. */
  async applicationFormFee(): Promise<number | null> {
    try {
      const charges = (await apiClient.get<{ id: number; chargeType: string; active: boolean; amount: number | null }[]>('/charges', { params: { product: 'Loan' } })).data;
      const fee = charges.filter((c) => c.chargeType === 'ApplicationFormFee' && c.active && (c.amount ?? 0) > 0).sort((a, b) => b.id - a.id)[0];
      return fee?.amount ?? null;
    } catch {
      return null;
    }
  },

  async loans(id: number): Promise<PagedResult<ClientLoan>> {
    return (await apiClient.get<PagedResult<ClientLoan>>('/loans', { params: { clientId: id, page: 1, pageSize: 100 } })).data;
  },

  /** The profile picture (the enrolled face capture) as an object URL — the endpoint needs the auth header, so an <img src> can't load it directly. Null when there's none. */
  async photoUrl(id: number): Promise<string | null> {
    try {
      const response = await apiClient.get<Blob>(`/clients/${id}/photo`, { responseType: 'blob' });
      return URL.createObjectURL(response.data);
    } catch {
      return null;
    }
  },

  async approve(id: number): Promise<ClientDetail> {
    return (await apiClient.post<ClientDetail>(`/clients/${id}/activate`, { activatedDate: null })).data;
  },

  async decline(id: number, reason: string): Promise<ClientDetail> {
    return (await apiClient.post<ClientDetail>(`/clients/${id}/decline`, { reason })).data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  },

  async requestDeletion(id: number, reason: string): Promise<void> {
    await apiClient.post(`/clients/${id}/deletion-requests`, { reason });
  },

  async checkBvn(bvn: string, fullName: string, phone: string | null): Promise<BvnCheck> {
    return (await apiClient.post<BvnCheck>('/onboarding/bvn-check', { bvn, fullName, phone })).data;
  },

  async onboardClient(officeId: number | null, client: OnboardClientInput): Promise<OnboardingResult> {
    return (await apiClient.post<OnboardingResult>('/onboarding/clients', { officeId, client })).data;
  },

  async onboardGroup(
    officeId: number | null,
    group: { name: string; phone: string | null; email: string | null; address: string | null },
    members: OnboardClientInput[],
  ): Promise<OnboardingResult> {
    return (await apiClient.post<OnboardingResult>('/onboarding/groups', { officeId, group, members })).data;
  },

  async groupSummary(id: number): Promise<GroupSummary> {
    return (await apiClient.get<GroupSummary>(`/groups/${id}/summary`)).data;
  },

  async removeGroup(id: number): Promise<void> {
    await apiClient.delete(`/groups/${id}`);
  },

  async requestGroupDeletion(id: number, reason: string): Promise<void> {
    await apiClient.post(`/groups/${id}/deletion-requests`, { reason });
  },
};
