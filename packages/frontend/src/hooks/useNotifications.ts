import { useState, useEffect, useCallback } from 'react';
import type { Notification, NewNotificationData } from '@tradeapp/shared';
import { notificationService } from '../services/notificationService';
import { socketService } from '../services/socketService';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationService.getNotifications()
      .then((data) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  }, []);

  // Listen for real-time notifications via socket
  useEffect(() => {
    const handler = (data: NewNotificationData) => {
      const newNotif: Notification = {
        id: data.notificationId,
        userId: '',
        type: data.type,
        title: data.title,
        content: data.content,
        relatedJobId: data.relatedJobId,
        isRead: false,
        createdAt: new Date(data.createdAt),
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socketService.on('new_notification', handler);
    return () => socketService.off('new_notification', handler);
  }, []);

  const markRead = useCallback(async (id: string) => {
    await notificationService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
}
