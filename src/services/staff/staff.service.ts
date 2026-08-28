import { api } from '../../app/api';
import { compressImageFile } from '../../utils/image-compression';
import type {
  BvnPreview,
  CreateStaffDirectPayload,
  DisableStaffPayload,
  InitiateStaffOnboardingPayload,
  Staff,
  StaffActivityEntry,
  StaffPerformanceSummary,
  UpdateOwnProfilePayload,
  UpdateStaffCompliancePayload,
  UpdateStaffDocumentsPayload,
  UpdateStaffProfilePayload,
  VerifyBvnPayload,
  WorkflowRequestSummary,
} from './staff.types';

/**
 * Builds the multipart/form-data body for onboard/createDirect when either
 * upload field is present — plain object fields go straight in, nested
 * objects/arrays are JSON-encoded (the backend's `parseJsonField` transform
 * un-does this, see backashbackend's identity DTOs), the two files go in as
 * actual file parts (compressed client-side first, see
 * utils/image-compression). Returns `null` when neither file was supplied,
 * so the caller can fall back to a plain JSON POST.
 */
async function toFormDataIfHasFiles<T extends { passportPhoto?: File; idDocument?: File }>(
  payload: T,
): Promise<FormData | null> {
  const { passportPhoto, idDocument, ...rest } = payload;
  if (!passportPhoto && !idDocument) {
    return null;
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) {
      continue;
    }
    formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  if (passportPhoto) {
    formData.append('passportPhoto', await compressImageFile(passportPhoto));
  }
  if (idDocument) {
    formData.append('idDocument', await compressImageFile(idDocument));
  }
  return formData;
}

/** `staff` tag — backashbackend/src/modules/identity/staff.controller.ts. */
export const staffService = {
  /**
   * POST /staff/onboard — Marketer onboarding, workflow-mediated
   * (Admin/Approver must approve). Sent as multipart/form-data automatically
   * when `payload.passportPhoto`/`.idDocument` is set, plain JSON otherwise.
   */
  onboard: async (payload: InitiateStaffOnboardingPayload): Promise<WorkflowRequestSummary> => {
    const formData = await toFormDataIfHasFiles(payload);
    return formData
      ? api.post<WorkflowRequestSummary, FormData>('/staff/onboard', formData)
      : api.post<WorkflowRequestSummary, InitiateStaffOnboardingPayload>('/staff/onboard', payload);
  },

  /**
   * POST /staff/onboard/:requestId/resubmit — the "Edit & Resubmit" action
   * on a REJECTED staff onboarding request. Same multipart/JSON auto-switch
   * as `onboard`; passportPhoto/idDocument stay optional here too — omit
   * either to keep whatever the rejected proposal already had on file.
   */
  resubmitOnboarding: async (
    requestId: string,
    payload: InitiateStaffOnboardingPayload,
  ): Promise<WorkflowRequestSummary> => {
    const formData = await toFormDataIfHasFiles(payload);
    return formData
      ? api.post<WorkflowRequestSummary, FormData>(`/staff/onboard/${requestId}/resubmit`, formData)
      : api.post<WorkflowRequestSummary, InitiateStaffOnboardingPayload>(
          `/staff/onboard/${requestId}/resubmit`,
          payload,
        );
  },

  /** POST /staff/direct — SuperAdmin only, creates immediately, no workflow. Same multipart/JSON auto-switch as onboard. */
  createDirect: async (payload: CreateStaffDirectPayload): Promise<Staff> => {
    const formData = await toFormDataIfHasFiles(payload);
    return formData
      ? api.post<Staff, FormData>('/staff/direct', formData)
      : api.post<Staff, CreateStaffDirectPayload>('/staff/direct', payload);
  },

  /**
   * POST /staff/verify-bvn-preview — usable before a Staff record exists
   * (the onboarding form's "Verify" button). Nothing is persisted; just
   * returns the provider's resolved identity for the onboarder to confirm.
   */
  verifyBvnPreview: (payload: VerifyBvnPayload): Promise<BvnPreview> =>
    api.post<BvnPreview, VerifyBvnPayload>('/staff/verify-bvn-preview', payload),

  /** GET /staff/me — the signed-in staff member's own record; no capability required. */
  getMe: (): Promise<Staff> => api.get<Staff>('/staff/me'),

  /** PATCH /staff/me — self-service subset of fields; no capability required. */
  updateMe: (payload: UpdateOwnProfilePayload): Promise<Staff> =>
    api.patch<Staff, UpdateOwnProfilePayload>('/staff/me', payload),

  /** Optionally scoped to one branch. */
  list: (branchId?: string): Promise<Staff[]> =>
    api.get<Staff[]>('/staff', branchId ? { params: { branchId } } : undefined),

  listWithUnverifiedBvn: (): Promise<Staff[]> => api.get<Staff[]>('/staff/bvn/unverified'),

  getById: (id: string): Promise<Staff> => api.get<Staff>(`/staff/${id}`),

  /** Persists bvnVerified=true onto an existing staff record — see verifyBvnPreview for the pre-creation check. */
  verifyBvn: (id: string, payload: VerifyBvnPayload): Promise<Staff> =>
    api.post<Staff, VerifyBvnPayload>(`/staff/${id}/verify-bvn`, payload),

  /** PATCH /staff/:id/documents — replaces whichever of passportPhoto/idDocument is supplied; always multipart/form-data. */
  updateDocuments: async (id: string, payload: UpdateStaffDocumentsPayload): Promise<Staff> => {
    const formData = new FormData();
    if (payload.passportPhoto) {
      formData.append('passportPhoto', await compressImageFile(payload.passportPhoto));
    }
    if (payload.idDocument) {
      formData.append('idDocument', await compressImageFile(payload.idDocument));
    }
    return api.patch<Staff, FormData>(`/staff/${id}/documents`, formData);
  },

  disable: (id: string, payload: DisableStaffPayload): Promise<Staff> =>
    api.post<Staff, DisableStaffPayload>(`/staff/${id}/disable`, payload),

  enable: (id: string): Promise<Staff> => api.post<Staff, undefined>(`/staff/${id}/enable`, undefined),

  /** PATCH /staff/:id — Admin/SuperAdmin only. Every field optional; see UpdateStaffProfilePayload for what's out of scope here. */
  updateProfile: (id: string, payload: UpdateStaffProfilePayload): Promise<Staff> =>
    api.patch<Staff, UpdateStaffProfilePayload>(`/staff/${id}`, payload),

  /** PATCH /staff/:id/compliance — manual NIN/guarantor-form/offer-letter sign-off toggles. */
  updateCompliance: (id: string, payload: UpdateStaffCompliancePayload): Promise<Staff> =>
    api.patch<Staff, UpdateStaffCompliancePayload>(`/staff/${id}/compliance`, payload),

  /** GET /staff/:id/performance — real, computed-on-request counts. */
  getPerformance: (id: string): Promise<StaffPerformanceSummary> =>
    api.get<StaffPerformanceSummary>(`/staff/${id}/performance`),

  /** GET /staff/:id/activity — sourced from the real audit trail, newest first. */
  getActivity: (id: string): Promise<StaffActivityEntry[]> => api.get<StaffActivityEntry[]>(`/staff/${id}/activity`),
};

export * from './staff.types';
