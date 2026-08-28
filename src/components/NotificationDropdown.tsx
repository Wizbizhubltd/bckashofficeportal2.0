import { BellIcon, CheckCheckIcon, Loader2Icon } from 'lucide-react';
import type { AppNotification } from '../services/notifications/notifications.service';

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Presentational only — Header.tsx owns fetching/polling/open-state. Kept
 * as its own file since the bell button + panel is a self-contained unit
 * that could plausibly move (e.g. into a mobile nav) without dragging
 * Header's other concerns (search bar, role badges) along with it.
 */
export function NotificationDropdown({
  notifications,
  unreadCount,
  isLoading,
  isSuperAdmin,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  onViewAll,
}: {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isSuperAdmin: boolean;
  onMarkRead: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  onNavigate: (notification: AppNotification) => void;
  onViewAll: () => void;
}) {
  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="text-sm font-heading font-bold text-primary">Notifications</h4>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-accent hover:text-[#e64a19] font-medium flex items-center gap-1"
          >
            <CheckCheckIcon size={13} /> Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
            <Loader2Icon size={16} className="animate-spin mr-2" /> Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <BellIcon size={22} className="mb-2" />
            <p className="text-sm">You're all caught up.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                onClick={() => {
                  if (!notification.isRead) onMarkRead(notification);
                  onNavigate(notification);
                }}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  notification.isRead ? '' : 'bg-primary/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!notification.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                  <div className={`min-w-0 ${notification.isRead ? 'ml-3.5' : ''}`}>
                    <p className={`text-sm font-body text-gray-800 ${notification.isRead ? '' : 'font-semibold'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.body}</p>
                    <p className="text-[11px] text-gray-300 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isSuperAdmin && (
        <button
          onClick={onViewAll}
          className="w-full py-2.5 text-xs font-medium text-primary hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          View all notifications
        </button>
      )}
    </div>
  );
}
