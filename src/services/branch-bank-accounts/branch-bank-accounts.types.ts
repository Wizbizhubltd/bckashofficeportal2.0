/**
 * `bank-accounts` tag — backashbackend/src/modules/branches/branch-bank-accounts.controller.ts.
 * A branch may have many accounts, but at most one is ever `active` at a
 * time — that's the one `POST /branch-funding` requires a funding record to
 * target. No delete endpoint: retiring an account is `PATCH { active: false }`.
 * Controller has no response DTOs — returns raw Mongoose documents (`_id`,
 * not `id`); `Raw*` are the wire shapes.
 */
export type BranchBankAccountPurpose = 'REPAYMENT_COLLECTION' | 'DISBURSEMENT_SOURCE' | 'GENERAL';

export interface RawBranchBankAccount {
  _id: string;
  branchId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  purpose: BranchBankAccountPurpose;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BranchBankAccount {
  id: string;
  branchId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  purpose: BranchBankAccountPurpose;
  active: boolean;
  createdAt: string;
}

/**
 * `active` defaults to `true` only when this is the branch's first account
 * — pass it explicitly to make a new account the active one instead
 * (deactivates whichever other account currently holds that spot).
 */
export interface CreateBranchBankAccountPayload {
  branchId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  purpose: BranchBankAccountPurpose;
  active?: boolean;
}

export interface UpdateBranchBankAccountPayload {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  purpose?: BranchBankAccountPurpose;
  active?: boolean;
}
