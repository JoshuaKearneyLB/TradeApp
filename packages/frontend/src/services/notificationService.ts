import api from './api';
import type { Notification } from '@tradeapp/shared';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    const res = await api.get<{ notifications: Notification[] }>('/notifications');
    return res.data.notifications;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },
};
