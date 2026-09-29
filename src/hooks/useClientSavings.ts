import { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';

export type EntryType = 'Contribution' | 'ContributionReversal' | 'Withdrawal' | 'EarlyWithdrawalFee' | 'Forfeiture';

export interface SavingsEntry {
  id: number;
  type: EntryType;
  amount: number;
  loanId: number | null;
  loanNumber: string | null;
  notes: string | null;
  createdAt: string | null;
  createdByName: string | null;
}

/** A client's loan savings — see the API's ClientSavingsController. */
export interface ClientSavings {
  balance: number;
  hasRunningLoan: boolean;
  /** What an early cash-out keeps, as a fraction (0.15 = 15%) — Settings → Loan → Client savings. */
  earlyWithdrawalFeeRate: number;
  withdrawalFee: number;
  withdrawalPayout: number;
  canWithdraw: boolean;
  entries: SavingsEntry[];
}

/** Loads the client's savings; reloads when <paramref name="version"/> changes. */
export function useClientSavings(clientId: number, version = 0): ClientSavings | null {
  const [savings, setSavings] = useState<ClientSavings | null>(null);
  useEffect(() => {
    apiClient
      .get<ClientSavings>(`/clients/${clientId}/savings`)
      .then((response) => setSavings(response.data))
      .catch(() => setSavings(null));
  }, [clientId, version]);
  return savings;
}
