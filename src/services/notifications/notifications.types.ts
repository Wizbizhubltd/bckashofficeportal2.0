/**
 * `notifications` tag — backashbackend/src/modules/notifications/notification.controller.ts.
 * A persisted, in-app copy of a notification, layered on top of the
 * existing email/SMS pipeline — every route here is authenticated-only and
 * row-scoped to the caller's own inbox (no capability gate needed, same
 * posture as branch-funding.service.ts's own list endpoint). SuperAdmin
 * sees everything by construction — every notification mirrors to every
 * SuperAdmin's own rows server-side, not a separate admin-only listing.
 * Controller has no response DTOs — returns raw Mongoose documents (`_id`,
 * not `id`); `Raw*` are the wire shapes.
 */
export type NotificationCategory = 'BRANCH_MANAGER' | 'BRANCH_ADMIN_APPROVER' | 'SUPERADMIN_MIRROR' | 'GENERAL';

export interface RawNotification {
  _id: string;
  recipientStaffId: string;
  type: string;
  category: NotificationCategory;
  sourceEntityId: string;
  branchId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  sourceEntityId: string;
  branchId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface RawNotificationsPage {
  items: RawNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface NotificationsPage {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export interface ListMyNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}
