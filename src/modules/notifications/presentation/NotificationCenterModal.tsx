import React, { useState } from 'react';
import { useAppStore } from '@/store/AppContext';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { NotificationList } from './components/NotificationList';
import { NotificationFilterChips } from './components/NotificationFilterChips';
import { NotificationActionBar } from './components/NotificationActionBar';
import { PushTokenStatusCard } from './components/PushTokenStatusCard';
import type { FilterKey } from '../domain/notifications.types';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Matches design/stitch_/_17/code.html ("مركز التنبيهات" - Notification Center)
 * Displays all Push & In-App notifications for the active role, filter chips,
 * "تحديد الكل كمقروء" button, and the user's registered `push_token`.
 */
export const NotificationCenterModal: React.FC<
  NotificationCenterModalProps
> = ({ visible, onClose }) => {
  const {
    currentUser,
    currentRole,
  } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const roleTitleAr =
    currentRole === 'admin'
      ? 'إشعارات رئيس الاتحاد'
      : currentRole === 'resident'
      ? `إشعارات الساكن (شقة ${currentUser.apartment_number || '302'})`
      : 'إشعارات الإدارة العليا';

  return (
    <BottomSheetModal
      visible={visible}
      title="مركز التنبيهات والإشعارات الفورية"
      subtitle={`${roleTitleAr} — متزامن مع Expo Push Notifications`}
      onClose={onClose}
    >
      {/* Push Token Status Bar (Verifies requirement 4: push_token stored in users table) */}
      <PushTokenStatusCard />

      {/* Top Status & Mark All Read Action Bar (Matches _17/code.html lines 17-27) */}
      <NotificationActionBar />

      {/* Horizontal Filter Chips (Matches _17/code.html lines 29-49) */}
      <NotificationFilterChips activeFilter={activeFilter} setActiveFilter={setActiveFilter} />

      {/* Notifications List */}
      <NotificationList activeFilter={activeFilter} />
    </BottomSheetModal>
  );
};

