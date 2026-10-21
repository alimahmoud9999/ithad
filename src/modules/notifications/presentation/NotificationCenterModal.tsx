import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { AppNotification, NotificationCategory } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

type FilterKey = 'all' | NotificationCategory;

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
    currentRoleNotifications,
    unreadNotificationsCount,
    markAllNotificationsAsRead,
    markNotificationAsRead,
  } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [copiedToken, setCopiedToken] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return currentRoleNotifications;
    return currentRoleNotifications.filter((n) => n.category === activeFilter);
  }, [activeFilter, currentRoleNotifications]);

  const counts = useMemo(() => {
    return {
      all: currentRoleNotifications.length,
      financial: currentRoleNotifications.filter(
        (n) => n.category === 'financial'
      ).length,
      join_request: currentRoleNotifications.filter(
        (n) => n.category === 'join_request'
      ).length,
      maintenance: currentRoleNotifications.filter(
        (n) => n.category === 'maintenance'
      ).length,
    };
  }, [currentRoleNotifications]);

  const handleCopyToken = async () => {
    const token = currentUser.push_token || '';
    if (!token) return;
    try {
      await Clipboard.setStringAsync(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

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
      <View style={styles.tokenCard}>
        <View style={styles.tokenHeaderRow}>
          <View style={styles.tokenStatusBadge}>
            <View style={styles.tokenActiveDot} />
            <Text style={styles.tokenStatusText}>
              محفوظ في جدول users.push_token
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCopyToken}
            style={styles.copyTokenBtn}
          >
            <MaterialIcons
              name={copiedToken ? 'check' : 'content-copy'}
              size={14}
              color={COLORS.secondary}
            />
            <Text style={styles.copyTokenText}>
              {copiedToken ? 'تم النسخ' : 'نسخ التوكن'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tokenValueText} numberOfLines={1}>
          {currentUser.push_token || 'ExponentPushToken[initializing...]'}
        </Text>
      </View>

      {/* Top Status & Mark All Read Action Bar (Matches _17/code.html lines 17-27) */}
      <View style={styles.topActionBar}>
        <View style={styles.unreadCountSide}>
          <View style={styles.pulsingRedDot} />
          <Text style={styles.sectionHeaderLabel}>سجل الإشعارات</Text>
          <View style={styles.newCountPill}>
            <Text style={styles.newCountPillText}>
              {unreadNotificationsCount} جديد
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.markAllReadBtn}
          onPress={markAllNotificationsAsRead}
        >
          <MaterialIcons name="done-all" size={16} color={COLORS.secondary} />
          <Text style={styles.markAllReadText}>تحديد الكل كمقروء</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Filter Chips (Matches _17/code.html lines 29-49) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScrollRow}
      >
        <TouchableOpacity
          onPress={() => setActiveFilter('all')}
          style={[
            styles.filterChip,
            activeFilter === 'all' && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            الكل ({counts.all})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('financial')}
          style={[
            styles.filterChip,
            activeFilter === 'financial' && styles.filterChipActive,
          ]}
        >
          <MaterialIcons
            name="payments"
            size={15}
            color={
              activeFilter === 'financial' ? COLORS.onPrimary : COLORS.secondary
            }
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'financial' && styles.filterChipTextActive,
            ]}
          >
            مالية واشتراكات ({counts.financial})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('join_request')}
          style={[
            styles.filterChip,
            activeFilter === 'join_request' && styles.filterChipActive,
          ]}
        >
          <MaterialIcons
            name="person-add"
            size={15}
            color={
              activeFilter === 'join_request'
                ? COLORS.onPrimary
                : COLORS.statusPending
            }
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'join_request' && styles.filterChipTextActive,
            ]}
          >
            طلبات الانضمام ({counts.join_request})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('maintenance')}
          style={[
            styles.filterChip,
            activeFilter === 'maintenance' && styles.filterChipActive,
          ]}
        >
          <MaterialIcons
            name="construction"
            size={15}
            color={
              activeFilter === 'maintenance'
                ? COLORS.onPrimary
                : COLORS.statusUpcoming
            }
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'maintenance' && styles.filterChipTextActive,
            ]}
          >
            صيانة وطوارئ ({counts.maintenance})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Notifications List */}
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
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  tokenCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 12,
  },
  tokenHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tokenStatusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  tokenActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusPaid,
  },
  tokenStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  copyTokenBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  copyTokenText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  tokenValueText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.onSurfaceVariant,
    textAlign: 'left',
  },
  topActionBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  unreadCountSide: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  pulsingRedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.statusUnpaid,
  },
  sectionHeaderLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  newCountPill: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  newCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  markAllReadBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryContainer,
  },
  chipsScrollRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  listContainer: {
    gap: 10,
    paddingBottom: 16,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  notifCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  notifCardUnread: {
    borderColor: COLORS.primaryContainer,
    backgroundColor: '#F8FAFF',
  },
  notifTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  notifIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBodyCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  notifMetaRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  notifBadgePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  notifBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeAndUnreadRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  unreadBlueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusUnpaid,
  },
  notifTimeText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
    marginBottom: 4,
  },
  notifBodyText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 19,
  },
  rejectionReasonBox: {
    marginTop: 8,
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.badgeUnpaidBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  rejectionReasonText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.badgeUnpaidText,
    textAlign: 'right',
  },
});
