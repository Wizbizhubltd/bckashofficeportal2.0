import { api } from '../../app/api';
import type {
  BranchFunding,
  RawBranchFunding,
  RecordBranchFundingPayload,
  RejectBranchFundingPayload,
} from './branch-funding.types';

const normalize = (raw: RawBranchFunding): BranchFunding => ({
  id: raw._id,
  branchId: raw.branchId,
  bankAccountId: raw.bankAccountId,
  amount: raw.amount,
  fundedAt: raw.fundedAt,
  reference: raw.reference,
  source: raw.source,
  status: raw.status,
  recordedBy: raw.recordedBy,
  verifiedBy: raw.verifiedBy,
  verifiedAt: raw.verifiedAt,
  rejectionReason: raw.rejectionReason,
  disputeDetails: raw.disputeDetails,
  lastNudgedAt: raw.lastNudgedAt,
  createdAt: raw.createdAt,
});

/** `branch-funding` tag — see branch-funding.types.ts's own doc comment for the two-party confirmation model. */
export const branchFundingService = {
  /** Requires branch:fund. Pending until the branch's own current manager verifies it — no balance effect yet. */
  record: async (payload: RecordBranchFundingPayload): Promise<BranchFunding> =>
    normalize(await api.post<RawBranchFunding, RecordBranchFundingPayload>('/branch-funding', payload)),

  /** Authenticated-only, row-scoped server-side: Admin/SuperAdmin/Approver see all (optionally filtered by branchId); everyone else (e.g. a Manager) only ever sees their own branch's. */
  list: async (branchId?: string): Promise<BranchFunding[]> => {
    const raw = await api.get<RawBranchFunding[]>('/branch-funding', branchId ? { params: { branchId } } : undefined);
    return raw.map(normalize);
  },

  getById: async (id: string): Promise<BranchFunding> =>
    normalize(await api.get<RawBranchFunding>(`/branch-funding/${id}`)),

  /** Requires branch:verify_funding — only the receiving branch's own current manager may call this. Credits the branch balance. */
  verify: async (id: string): Promise<BranchFunding> =>
    normalize(await api.post<RawBranchFunding, undefined>(`/branch-funding/${id}/verify`, undefined)),

  /** Requires branch:verify_funding — same "current manager only" restriction as verify. No balance effect. */
  reject: async (id: string, payload: RejectBranchFundingPayload): Promise<BranchFunding> =>
    normalize(
      await api.post<RawBranchFunding, RejectBranchFundingPayload>(`/branch-funding/${id}/reject`, payload),
    ),

  /** Requires branch:fund — sends a FUNDING_REMINDER email/SMS to the branch's current manager. Only meaningful while still PENDING_VERIFICATION. */
  nudge: async (id: string): Promise<BranchFunding> =>
    normalize(await api.post<RawBranchFunding, undefined>(`/branch-funding/${id}/nudge`, undefined)),

  /** Requires branch:verify_funding — only the receiving branch's own current manager may raise one. Document evidence is required. */
  raiseDispute: async (id: string, reason: string, evidence: File): Promise<BranchFunding> => {
    const formData = new FormData();
    formData.append('reason', reason);
    formData.append('evidence', evidence);
    return normalize(await api.post<RawBranchFunding, FormData>(`/branch-funding/${id}/disputes`, formData));
  },

  /** Requires branch:fund. */
  resolveDispute: async (id: string, resolution: 'RESOLVED' | 'DISMISSED', note: string): Promise<BranchFunding> =>
    normalize(
      await api.post<RawBranchFunding, { resolution: 'RESOLVED' | 'DISMISSED'; note: string }>(
        `/branch-funding/${id}/disputes/resolve`,
        { resolution, note },
      ),
    ),

  /** A short-lived signed URL for a dispute's evidence document — null if there's no dispute (or it has no evidence, which shouldn't happen). */
  getDisputeEvidenceUrl: (id: string): Promise<{ url: string | null }> =>
    api.get<{ url: string | null }>(`/branch-funding/${id}/disputes/evidence-url`),
};

export * from './branch-funding.types';
