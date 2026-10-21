import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { NotificationCenterModal } from '@/modules/notifications/presentation/NotificationCenterModal';
import { styles } from './TopHeader.styles';
import { PushToastBanner } from '../modules/notifications/presentation/components/PushToastBanner';
import { RoleQuickSwitchBar } from './components/RoleQuickSwitchBar';

interface TopHeaderProps {
  onOpenAuthScreen?: () => void;
}

/**
 * Matches the Top Bar in design/stitch_/admin_dashboard/code.html and ._302/code.html:
 * - Right side (RTL start): Building icon in Deep Navy (#1E293B) + "مدير اتحاد الملاك" + Building/Apartment title
 * - Left side (RTL end): Interactive Notification Bell with live unread count badge (#EF4444) + User Avatar
 * - Includes an interactive Role Switcher bar below header for testing all 3 roles (admin, resident, super_admin) + Auth flow
 * - Includes an In-App Push Notification Banner + NotificationCenterModal (_17/code.html)
 */
export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenAuthScreen }) => {
  const insets = useSafeAreaInsets();
  const {
    currentRole,
    currentUser,
    currentBuilding,
    isAuthenticated,
    logout,
    unreadNotificationsCount,
    activeBannerNotification,
    dismissBannerNotification,
  } = useAppStore();

  const [notifModalOpen, setNotifModalOpen] = useState(false);

  // Auto-hide floating in-app toast banner after 6 seconds
  useEffect(() => {
    if (!activeBannerNotification) return;
    const timer = setTimeout(() => {
      dismissBannerNotification();
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeBannerNotification, dismissBannerNotification]);

  const topSafePadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 0
  );

  const subtitleText =
    currentRole === 'super_admin'
      ? 'لوحة تحكم مالك المنصة والباقات'
      : `${currentBuilding.name} - شقة ${currentUser.apartment_number || '12'}`;

  return (
    <View style={[styles.wrapper, { paddingTop: topSafePadding }]}>
      {/* Main Top Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.brandSide}>
          <View style={styles.buildingIconBox}>
            <MaterialIcons name="apartment" size={20} color={COLORS.onPrimary} />
          </View>
          <View style={styles.brandTitles}>
            <Text style={styles.appLabel}>مدير اتحاد الملاك</Text>
            <Text style={styles.buildingTitle} numberOfLines={1}>
              {subtitleText}
            </Text>
          </View>
        </View>

        <View style={styles.actionsSide}>
          {/* Logged-out users must go through login; never flip auth state client-side */}
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.authSwitchBtn}
              onPress={() => {
                onOpenAuthScreen ? onOpenAuthScreen() : logout();
              }}
            >
              <MaterialIcons name="logout" size={16} color={COLORS.primaryContainer} />
              <Text style={styles.authSwitchText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setNotifModalOpen(true)}
            accessibilityLabel="مركز التنبيهات"
          >
            <MaterialIcons
              name={
                unreadNotificationsCount > 0
                  ? 'notifications-active'
                  : 'notifications-none'
              }
              size={22}
              color={
                unreadNotificationsCount > 0
                  ? COLORS.primary
                  : COLORS.onSurfaceVariant
              }
            />
            {unreadNotificationsCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadNotificationsCount > 9
                    ? '9+'
                    : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarCircle}>
            <MaterialIcons name="person" size={18} color={COLORS.onPrimary} />
          </View>
        </View>
      </View>

      {/* Quick Role Switcher Bar (Available only for Super Admin) */}
      <RoleQuickSwitchBar />

      {/* Live In-App Push Notification Toast Banner */}
      <PushToastBanner setNotifModalOpen={setNotifModalOpen} />

      {/* Notification Center Modal (Matches design/stitch_/_17/code.html) */}
      <NotificationCenterModal
        visible={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </View>
  );
};

