import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon, CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsService, type AppNotification } from '../../services/notifications/notifications.service';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

const CATEGORY_LABEL: Record<AppNotification['category'], string> = {
  BRANCH_MANAGER: 'Branch Manager',
  BRANCH_ADMIN_APPROVER: 'Branch Admin/Approver',
  SUPERADMIN_MIRROR: 'Mirrored',
  GENERAL: 'General',
};

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * SuperAdmin-only (see App.tsx's SUPER_ADMIN_ONLY guard) — every
 * notification already mirrors to every SuperAdmin's own inbox rows
 * server-side (see NotificationInboxService.persistCopies), so this is
 * genuinely just "my inbox, but full-page and paginated," not a separate
 * cross-staff admin view.
 */
export function NotificationCenter() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await notificationsService.listMine({ page, limit: PAGE_SIZE, unreadOnly });
      setNotifications(result.items);
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, unreadOnly]);

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationsService.markAllRead();
      toast.success('All notifications marked as read.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark all as read');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleRowClick = async (notification: AppNotification) => {
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      notificationsService.markRead(notification.id).catch(() => undefined);
    }
    if (notification.branchId) {
      navigate(`/branches/${notification.branchId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-primary">Notification Center</h2>
          <p className="text-gray-500 font-body text-sm mt-1">
            Every notification across the organisation — {unreadCount} unread.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              setUnreadOnly((v) => !v);
            }}
            className={`px-4 py-2 text-sm font-heading font-medium rounded-lg border transition-colors ${
              unreadOnly ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {unreadOnly ? 'Showing Unread' : 'Show Unread Only'}
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || unreadCount === 0}
            className="px-4 py-2 bg-primary text-white text-sm font-heading font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCheckIcon size={15} /> Mark All as Read
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2Icon size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BellIcon size={24} className="mb-2" />
            <p className="text-sm">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                onClick={() => handleRowClick(notification)}
                className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                  notification.isRead ? '' : 'bg-primary/5'
                }`}
              >
                {!notification.isRead && <span className="mt-2 w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                <div className={`min-w-0 flex-1 ${notification.isRead ? 'ml-5' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-body text-gray-800 ${notification.isRead ? '' : 'font-semibold'}`}>
                      {notification.title}
                    </p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                      {CATEGORY_LABEL[notification.category] ?? notification.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{notification.body}</p>
                  <p className="text-[11px] text-gray-300 mt-1">{formatDateTime(notification.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
