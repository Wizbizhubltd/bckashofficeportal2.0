import { useSyncExternalStore } from 'react';
import apiClient from '../api/apiClient';

/**
 * Currency display (Settings → Organisation → "Currency display"), applied to every amount in the
 * portal. Loaded once after sign-in (see Layout) and again whenever the setting is saved; until then
 * it falls back to ₦ before the amount.
 */
export interface CurrencyDisplay {
  symbol: string;
  position: 'left' | 'right';
}

let current: CurrencyDisplay = { symbol: '₦', position: 'left' };
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getCurrencyDisplay = () => current;

/** Re-renders the caller when the currency display changes. */
export const useCurrencyDisplay = () => useSyncExternalStore(subscribe, getCurrencyDisplay);

export async function loadCurrencyDisplay(): Promise<void> {
  try {
    const { data } = await apiClient.get<{ currencySymbol: string; currencyPosition: string }>('/settings/display');
    current = { symbol: data.currencySymbol || '₦', position: data.currencyPosition === 'right' ? 'right' : 'left' };
    listeners.forEach((listener) => listener());
  } catch {
    // Keep the fallback — amounts still show, just with the default symbol.
  }
}

const whole = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Puts the currency symbol on the configured side of an already-formatted number. */
export function withSymbol(number: string, negative = false): string {
  const { symbol, position } = current;
  const gap = symbol.length > 1 ? ' ' : '';
  const text = position === 'left' ? `${symbol}${gap}${number}` : `${number}${gap}${symbol}`;
  return negative ? `-${text}` : text;
}

/**
 * An amount with the configured symbol, e.g. "₦5,000". Whole amounts drop the kobo; `decimals`
 * forces 2 (ledgers) or 0 (dashboard tiles). Null/undefined show as "—".
 */
export function formatMoney(amount: number | null | undefined, decimals: 'auto' | 0 | 2 = 'auto'): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  const useCents = decimals === 2 || (decimals === 'auto' && abs % 1 !== 0);
  return withSymbol((useCents ? cents : whole).format(abs), amount < 0);
}

/** For money inputs: the symbol as a prefix or a suffix, whichever side it's configured on. */
export function currencyAffix(): { prefix?: string; suffix?: string } {
  return current.position === 'left' ? { prefix: current.symbol } : { suffix: current.symbol };
}

const compact = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 });

/** Short form for dashboard tiles, e.g. "₦1.2M". */
export function formatMoneyCompact(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return withSymbol(compact.format(Math.abs(amount)), amount < 0);
}
