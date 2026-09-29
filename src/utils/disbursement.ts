/** How a loan is paid out — chosen when it's raised. A bank transfer also needs the account it goes to. */
export type DisbursementMode = 'CashPickup' | 'ChequePickup' | 'BankTransfer';

export const DISBURSEMENT_MODES: { value: DisbursementMode; label: string }[] = [
  { value: 'CashPickup', label: 'Cash pickup' },
  { value: 'ChequePickup', label: 'Cheque pickup' },
  { value: 'BankTransfer', label: 'Bank transfer' },
];

export const disbursementModeLabel = (mode: DisbursementMode | null | undefined): string =>
  DISBURSEMENT_MODES.find((m) => m.value === mode)?.label ?? 'Not recorded';

export const ACCOUNT_NUMBER_LENGTH = 10;

/** What's missing from the payout details, or null when they're complete — the server checks the same. */
export function payoutProblem(mode: DisbursementMode | '', bankName: string, accountNumber: string, accountName: string): string | null {
  if (!mode) return 'Choose how the loan will be disbursed.';
  if (mode !== 'BankTransfer') return null;
  if (!bankName.trim() || !accountName.trim()) return "A bank transfer needs the client's bank name, account number and account name.";
  return new RegExp(`^\\d{${ACCOUNT_NUMBER_LENGTH}}$`).test(accountNumber.trim()) ? null : `The bank account number must be ${ACCOUNT_NUMBER_LENGTH} digits.`;
}
