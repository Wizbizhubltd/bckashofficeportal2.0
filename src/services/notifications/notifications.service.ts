import { api } from '../../app/api';
import type {
  AppNotification,
  ListMyNotificationsParams,
  NotificationsPage,
  RawNotification,
  RawNotificationsPage,
} from './notifications.types';

const normalize = (raw: RawNotification): AppNotification => ({
  id: raw._id,
  type: raw.type,
  category: raw.category,
  sourceEntityId: raw.sourceEntityId,
  branchId: raw.branchId,
  title: raw.title,
  body: raw.body,
  isRead: raw.isRead,
  readAt: raw.readAt,
  createdAt: raw.createdAt,
});

/** `notifications` tag — see notifications.types.ts's own doc comment. */
export const notificationsService = {
  /** My own paginated inbox, newest first. */
  listMine: async (params: ListMyNotificationsParams = {}): Promise<NotificationsPage> => {
    const raw = await api.get<RawNotificationsPage>('/notifications/me', {
      params: {
        page: params.page,
        limit: params.limit,
        unreadOnly: params.unreadOnly ? 'true' : undefined,
      },
    });
    return { ...raw, items: raw.items.map(normalize) };
  },

  markRead: async (id: string): Promise<AppNotification> =>
    normalize(await api.patch<RawNotification>(`/notifications/${id}/read`)),

  markAllRead: (): Promise<{ modifiedCount: number }> =>
    api.post<{ modifiedCount: number }>('/notifications/mark-all-read'),
};

export * from './notifications.types';
