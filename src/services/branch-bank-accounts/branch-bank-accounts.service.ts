import { api } from '../../app/api';
import type {
  BranchBankAccount,
  CreateBranchBankAccountPayload,
  RawBranchBankAccount,
  UpdateBranchBankAccountPayload,
} from './branch-bank-accounts.types';

const normalize = (raw: RawBranchBankAccount): BranchBankAccount => ({
  id: raw._id,
  branchId: raw.branchId,
  bankName: raw.bankName,
  accountNumber: raw.accountNumber,
  accountName: raw.accountName,
  purpose: raw.purpose,
  active: raw.active,
  createdAt: raw.createdAt,
});

/** `bank-accounts` tag — reads are authenticated-only (anyone recording a repayment needs to see which account to attribute it to); create/update stay gated to `branch:manage_accounts` (ADMIN/SUPERADMIN only). See branch-bank-accounts.types.ts's own doc comment. */
export const branchBankAccountsService = {
  create: async (payload: CreateBranchBankAccountPayload): Promise<BranchBankAccount> =>
    normalize(await api.post<RawBranchBankAccount, CreateBranchBankAccountPayload>('/bank-accounts', payload)),

  /** `active: true` narrows to only the branch's currently-active account (at most one) — e.g. for a "which account was this paid into" dropdown. */
  list: async (branchId?: string, active?: boolean): Promise<BranchBankAccount[]> => {
    const params: Record<string, string> = {};
    if (branchId) params.branchId = branchId;
    if (active !== undefined) params.active = String(active);
    const raw = await api.get<RawBranchBankAccount[]>(
      '/bank-accounts',
      Object.keys(params).length > 0 ? { params } : undefined,
    );
    return raw.map(normalize);
  },

  getById: async (id: string): Promise<BranchBankAccount> =>
    normalize(await api.get<RawBranchBankAccount>(`/bank-accounts/${id}`)),

  /** Setting `active: true` deactivates whichever other account for the same branch currently holds that spot. */
  update: async (id: string, payload: UpdateBranchBankAccountPayload): Promise<BranchBankAccount> =>
    normalize(await api.patch<RawBranchBankAccount, UpdateBranchBankAccountPayload>(`/bank-accounts/${id}`, payload)),
};

export * from './branch-bank-accounts.types';
