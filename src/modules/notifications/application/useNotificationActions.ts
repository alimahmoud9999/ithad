import { useCallback } from 'react';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'setActiveBannerNotification'
  | 'currentRoleNotifications'
  | 'setNotifications'
>;

export function useNotificationActions({
  setActiveBannerNotification,
  currentRoleNotifications,
  setNotifications,
}: Deps) {
  const dismissBannerNotification = useCallback(() => {
    setActiveBannerNotification(null);
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (isRemoteBackendEnabled) {
      try {
        await repositories.notifications.markAllNotificationsRead();
      } catch {
        // Ignore if offline
      }
    }
    const visibleIds = new Set(currentRoleNotifications.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (visibleIds.has(n.id) ? { ...n, is_read: true } : n))
    );
  }, [currentRoleNotifications]);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, []);

  return { dismissBannerNotification, markAllNotificationsAsRead, markNotificationAsRead };
}
