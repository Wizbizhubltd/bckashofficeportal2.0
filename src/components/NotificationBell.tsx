import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellIcon, CheckCheckIcon, LoaderIcon } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useRolePath } from '../hooks/useRolePath';

/** A bell notification — see the API's NotificationsController. */
interface StaffNotification {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  needsAction: boolean;
  read: boolean;
  done: boolean;
  createdAt: string | null;
}

const REFRESH_MS = 60_000;

function timeAgo(value: string | null): string {
  if (!value) return '';
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

/**
 * The top bar's bell: how many things in the staff member's offices are waiting on them (or news they
 * haven't read), and the list behind it. Something asking for action stays counted until it's dealt
 * with — by them or a colleague; news stops counting once opened.
 */
export function NotificationBell() {
  const rolePath = useRolePath();
  const navigate = useNavigate();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StaffNotification[] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    apiClient
      .get<{ openCount: number }>('/notifications/summary')
      .then((response) => setCount(response.data.openCount))
      .catch(() => undefined);
  }, []);

  // On load, every minute, and whenever the page changes — acting on an item usually means navigating.
  useEffect(() => {
    refreshCount();
    const timer = window.setInterval(refreshCount, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [location.pathname, refreshCount]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    apiClient
      .get<StaffNotification[]>('/notifications')
      .then((response) => setItems(response.data))
      .catch(() => setItems([]));

    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openItem = async (item: StaffNotification) => {
    setOpen(false);
    if (!item.read) {
      await apiClient.post(`/notifications/${item.id}/read`).catch(() => undefined);
    }
    refreshCount();
    if (item.link) navigate(rolePath(item.link));
  };

  const readAll = async () => {
    await apiClient.post('/notifications/read-all').catch(() => undefined);
    setItems((prev) => prev?.map((n) => ({ ...n, read: true, done: n.done || !n.needsAction })) ?? prev);
    refreshCount();
  };

  const waiting = items?.filter((n) => !n.done) ?? [];
  const earlier = items?.filter((n) => n.done) ?? [];

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-primary"
        aria-label={count > 0 ? `${count} notification${count === 1 ? '' : 's'}` : 'Notifications'}
      >
        <BellIcon size={20} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-heading text-sm font-bold text-gray-800">Notifications</h2>
            {items && items.some((n) => !n.read) && (
              <button onClick={() => void readAll()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <CheckCheckIcon size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {items === null ? (
              <div className="flex justify-center py-8 text-gray-400">
                <LoaderIcon size={18} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Nothing yet.</p>
            ) : (
              <>
                {waiting.length > 0 && <Section title="Waiting on you" items={waiting} onOpen={openItem} />}
                {earlier.length > 0 && <Section title="Earlier" items={earlier} onOpen={openItem} muted />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, onOpen, muted }: { title: string; items: StaffNotification[]; onOpen: (item: StaffNotification) => void; muted?: boolean }) {
  return (
    <div>
      <p className="bg-gray-50 px-4 py-1.5 text-[11px] font-heading font-bold uppercase tracking-widest text-gray-400">{title}</p>
      <ul className="divide-y divide-gray-50">
        {items.map((item) => (
          <li key={item.id}>
            <button onClick={() => void onOpen(item)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-gray-50 ${muted ? 'opacity-70' : ''}`}>
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.read ? 'bg-transparent' : item.needsAction ? 'bg-accent' : 'bg-primary'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${item.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{item.title}</span>
                {item.body && <span className="mt-0.5 block text-xs text-gray-500">{item.body}</span>}
                <span className="mt-1 block text-[11px] text-gray-400">
                  {timeAgo(item.createdAt)}
                  {item.needsAction && !item.done && ' · needs your action'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
