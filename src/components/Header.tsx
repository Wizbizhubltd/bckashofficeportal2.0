import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MenuIcon, SearchIcon, BellIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import { ProfileAvatar } from './ProfileAvatar';
import { useAppDispatch } from '../store/hooks';
import { setMobileSidebarOpen } from '../store/slices/uiSlice';
import type { StaffUserType } from '../services/auth/auth.types';
import { notificationsService, type AppNotification } from '../services/notifications/notifications.service';

// No websocket/SSE infra exists anywhere in this app — a cheap paginated
// GET on this interval is the honest fit rather than standing up real-time
// infrastructure for a bell icon.
const POLL_INTERVAL_MS = 45_000;
const DROPDOWN_ITEM_LIMIT = 10;

export function Header() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const refreshNotifications = async () => {
    setIsLoadingNotifications(true);
    try {
      const page = await notificationsService.listMine({ limit: DROPDOWN_ITEM_LIMIT });
      setNotifications(page.items);
      setUnreadCount(page.unreadCount);
    } catch {
      // A failed poll shouldn't surface a toast on every tick — the bell
      // just keeps showing its last-known state until the next successful poll.
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    const interval = setInterval(refreshNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationsOpen]);

  const handleToggleNotifications = () => {
    setIsNotificationsOpen((open) => {
      if (!open) refreshNotifications();
      return !open;
    });
  };

  const handleMarkRead = async (notification: AppNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await notificationsService.markRead(notification.id);
    } catch {
      // Best-effort — a failed mark-read just gets corrected on the next poll.
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllRead();
    } catch {
      await refreshNotifications();
    }
  };

  const handleNotificationNavigate = (notification: AppNotification) => {
    setIsNotificationsOpen(false);
    if (notification.branchId) {
      navigate(`/branches/${notification.branchId}`);
    }
  };
  // Determine page title based on route
  const getPageTitle = () => {
    const normalizedPath = location.pathname;
    if (normalizedPath === '/dashboard') return 'Dashboard';
    if (normalizedPath === '/branches') return 'Branch Management';
    if (normalizedPath.startsWith('/customers/') && normalizedPath !== '/customers')
    return 'Customer Profile';
    if (normalizedPath === '/customers') return 'Customers Directory';
    if (normalizedPath === '/onboarding/staff') return 'Staff Onboarding';
    if (normalizedPath === '/onboarding/customer') return 'Customer Onboarding';
    if (normalizedPath.includes('/loan-manager/loans/')) return 'Loan Details';
    if (normalizedPath.includes('/loan-manager/group-loans')) return 'Group Loans';
    if (normalizedPath.includes('/loan-manager/applications')) return 'Loan Applications';
    if (normalizedPath.includes('/loan-manager/disbursement')) return 'Loan Disbursement';
    if (normalizedPath.includes('/loan-manager/repayment')) return 'Loan Repayment';
    if (normalizedPath.includes('/loan-manager/reports')) return 'Loan Reports';
    if (normalizedPath.includes('/loan-manager/approvals')) return 'Loan Approvals';
    if (normalizedPath.startsWith('/staff-management/') && normalizedPath !== '/staff-management')
    return 'Staff Profile';
    if (normalizedPath.includes('/staff-management')) return 'Staff Management';
    if (normalizedPath.includes('/fincon')) return 'Financial Control (FinCon)';
    if (normalizedPath.includes('/settings')) return 'Organisation Settings';
    if (normalizedPath === '/notifications') return 'Notification Center';
    return 'BCKash Portal';
  };
  const getRoleBadge = () => {
    if (!user) return null;
    switch (user.role) {
      case 'super_admin':
        return (
          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
            Super Admin
          </span>);

      case 'manager':
        return (
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
            Manager
          </span>);

      case 'admin':
        return (
          <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-bold">
            Admin
          </span>);

      case 'approver':
        return (
          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">
            Approver
          </span>);

      case 'marketer':
        return (
          <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">
            Marketer
          </span>);

      default:
        return null;
    }
  };
  // Initiator/Authorizer RBAC (see backend StaffUserType) — real access
  // control now, not just a label: Initiator can only ever propose/initiate
  // a workflow request, Authorizer can only ever review/approve one.
  // "Reviewer" is a legacy value only ever seen on a staff record created
  // before this feature existed (never newly assignable — see
  // StaffService.resolveUserType) so it's still rendered here, just styled
  // as a neutral/legacy state rather than either active lane.
  const USER_TYPE_BADGE_STYLE: Record<StaffUserType, string> = {
    Initiator: 'bg-amber-100 text-amber-800',
    Authorizer: 'bg-emerald-100 text-emerald-800',
    Reviewer: 'bg-gray-100 text-gray-600',
  };
  const getUserTypeBadge = () => {
    if (!user?.userType) return null;
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold ${USER_TYPE_BADGE_STYLE[user.userType]}`}>
        {user.userType}
      </span>
    );
  };
  return (
    <header className="bg-white h-20 px-4 lg:px-8 flex items-center justify-between shadow-sm z-30 sticky top-0">
      <div className="flex items-center">
        <button
          className="lg:hidden mr-4 text-gray-600 hover:text-primary"
          onClick={() => dispatch(setMobileSidebarOpen(true))}>
          
          <MenuIcon size={24} />
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl lg:text-2xl font-heading font-bold text-primary">
            {getPageTitle()}
          </h1>
          <div className="hidden md:flex items-center gap-2">
            {getRoleBadge()}
            {getUserTypeBadge()}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 lg:space-x-6">
        {/* Search Bar - Hidden on small mobile */}
        <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 w-64 lg:w-80 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <SearchIcon size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search groups, clients, loans..."
            className="bg-transparent border-none focus:outline-none text-sm font-body w-full text-gray-700" />
          
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={handleToggleNotifications}
            className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-gray-100"
          >
            <BellIcon size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-2 border-white"></span>
            )}
          </button>
          {isNotificationsOpen && (
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              isLoading={isLoadingNotifications}
              isSuperAdmin={isSuperAdmin}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              onNavigate={handleNotificationNavigate}
              onViewAll={() => {
                setIsNotificationsOpen(false);
                navigate('/notifications');
              }}
            />
          )}
        </div>

        {/* Mobile Avatar (Desktop avatar is in sidebar) */}
        <div className="lg:hidden">
          <ProfileAvatar
            src={user?.avatar}
            name={user?.name}
            alt="User Avatar"
            className="w-8 h-8 rounded-full border border-gray-200"
            iconSize={14}
          />
          
        </div>
      </div>
    </header>);

}