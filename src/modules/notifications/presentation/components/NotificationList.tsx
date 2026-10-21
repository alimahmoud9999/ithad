import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { AppNotification } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import type { FilterKey } from '../../domain/notifications.types';
import { styles } from '../NotificationCenterModal.styles';

interface NotificationListProps {
  activeFilter: FilterKey;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  activeFilter,
}) => {
  const { currentRoleNotifications, markNotificationAsRead } = useAppStore();

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return currentRoleNotifications;
    return currentRoleNotifications.filter((n) => n.category === activeFilter);
  }, [activeFilter, currentRoleNotifications]);

  const getVisualStyle = (item: AppNotification) => {
    if (item.is_urgent) {
      return {
        iconName: 'warning' as const,
        iconBg: COLORS.badgeUnpaidBg,
        iconColor: COLORS.badgeUnpaidText,
        badgeBg: COLORS.badgeUnpaidBg,
        badgeText: COLORS.badgeUnpaidText,
        dotColor: COLORS.statusUnpaid,
      };
    }
    if (item.category === 'join_request') {
      return {
        iconName: 'person-add-alt-1' as const,
        iconBg: COLORS.badgePendingBg,
        iconColor: COLORS.badgePendingText,
        badgeBg: COLORS.badgePendingBg,
        badgeText: COLORS.badgePendingText,
        dotColor: COLORS.statusPending,
      };
    }
    if (item.category === 'financial') {
      return {
        iconName: 'verified' as const,
        iconBg: COLORS.badgePaidBg,
        iconColor: COLORS.badgePaidText,
        badgeBg: COLORS.badgePaidBg,
        badgeText: COLORS.badgePaidText,
        dotColor: COLORS.statusPaid,
      };
    }
    return {
      iconName: 'notifications-active' as const,
      iconBg: COLORS.surfaceContainerHigh,
      iconColor: COLORS.primaryContainer,
      badgeBg: COLORS.surfaceContainerLow,
      badgeText: COLORS.primaryContainer,
      dotColor: COLORS.primaryContainer,
    };
  };

  return (
    <View style={styles.listContainer}>
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialIcons
            name="notifications-none"
            size={38}
            color={COLORS.onSurfaceVariant}
          />
          <Text style={styles.emptyTitle}>لا توجد إشعارات في هذا القسم</Text>
        </View>
      ) : (
        filteredNotifications.map((item) => {
          const visual = getVisualStyle(item);
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => markNotificationAsRead(item.id)}
              style={[
                styles.notifCard,
                !item.is_read && styles.notifCardUnread,
              ]}
            >
              <View style={styles.notifTopRow}>
                <View
                  style={[
                    styles.notifIconBox,
                    { backgroundColor: visual.iconBg },
                  ]}
                >
                  <MaterialIcons
                    name={visual.iconName}
                    size={22}
                    color={visual.iconColor}
                  />
                </View>

                <View style={styles.notifBodyCol}>
                  <View style={styles.notifMetaRow}>
                    <View
                      style={[
                        styles.notifBadgePill,
                        { backgroundColor: visual.badgeBg },
                      ]}
                    >
                      <View
                        style={[
                          styles.notifBadgeDot,
                          { backgroundColor: visual.dotColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.notifBadgeText,
                          { color: visual.badgeText },
                        ]}
                      >
                        {item.badge_label || 'إشعار'}
                      </Text>
                    </View>

                    <View style={styles.timeAndUnreadRow}>
                      {!item.is_read && <View style={styles.unreadBlueDot} />}
                      <Text style={styles.notifTimeText}>الآن / اليوم</Text>
                    </View>
                  </View>

                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifBodyText}>{item.body}</Text>

                  {item.metadata?.rejection_reason ? (
                    <View style={styles.rejectionReasonBox}>
                      <MaterialIcons
                        name="error-outline"
                        size={15}
                        color={COLORS.badgeUnpaidText}
                      />
                      <Text style={styles.rejectionReasonText}>
                        سبب الرفض: {item.metadata.rejection_reason}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};
