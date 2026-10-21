import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { UserRole } from '../../types/database';
import { NotificationCenterModal } from './NotificationCenterModal';

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
    switchRole,
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

  const isBannerForCurrentActiveUser = useMemo(() => {
    if (!activeBannerNotification) return false;

    // Check specific user ID match
    if (
      activeBannerNotification.recipient_id === currentUser.id ||
      (currentRole === 'resident' && activeBannerNotification.recipient_id === 'usr-res-001')
    ) {
      return true;
    }

    const effectiveApt = currentUser.apartment_number || '302';

    // Check apartment match for resident
    if (
      currentRole === 'resident' &&
      activeBannerNotification.metadata?.apartment_number
    ) {
      return (
        String(activeBannerNotification.metadata.apartment_number).trim() ===
        String(effectiveApt).trim()
      );
    }

    // Check target_apartments array for bulk reminder
    if (
      currentRole === 'resident' &&
      Array.isArray(activeBannerNotification.metadata?.target_apartments)
    ) {
      return activeBannerNotification.metadata.target_apartments
        .map((a: any) => String(a).trim())
        .includes(String(effectiveApt).trim());
    }

    // Role-level match for general broadcasts (excluding join requests which belong to admin)
    if (
      activeBannerNotification.recipient_role === currentRole &&
      activeBannerNotification.category !== 'join_request'
    ) {
      return true;
    }

    return false;
  }, [
    activeBannerNotification,
    currentUser.id,
    currentUser.apartment_number,
    currentRole,
  ]);

  const topSafePadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 0
  );

  const roles: Array<{
    key: UserRole;
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
  }> = [
    { key: 'admin', label: 'رئيس الاتحاد', icon: 'admin-panel-settings' },
    { key: 'resident', label: 'الساكن (شقة 302)', icon: 'home' },
    { key: 'super_admin', label: 'مالك التطبيق (Super)', icon: 'verified-user' },
  ];

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
      {isAuthenticated && currentRole === 'super_admin' && (
        <View style={styles.roleBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rolePillsScroll}
          >
            <Text style={styles.roleBarHint}>المعاينة:</Text>
            {roles.map((r) => {
              const active = currentRole === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => switchRole(r.key)}
                  style={[styles.rolePill, active && styles.rolePillActive]}
                >
                  <MaterialIcons
                    name={r.icon}
                    size={14}
                    color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.rolePillText,
                      active && styles.rolePillTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Live In-App Push Notification Toast Banner */}
      {isBannerForCurrentActiveUser && activeBannerNotification && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            dismissBannerNotification();
            setNotifModalOpen(true);
          }}
          style={styles.pushToastBanner}
        >
          <View style={styles.pushToastIconBox}>
            <MaterialIcons
              name="notifications-active"
              size={20}
              color={COLORS.onPrimary}
            />
          </View>
          <View style={styles.pushToastTextCol}>
            <View style={styles.pushToastHeaderRow}>
              <Text style={styles.pushToastRoleTag}>
                إشعار فوري لـ{' '}
                {activeBannerNotification.recipient_role === 'admin'
                  ? 'رئيس الاتحاد'
                  : 'الساكن'}
              </Text>
              <Text style={styles.pushToastTapHint}>اضغط للعرض ←</Text>
            </View>
            <Text style={styles.pushToastTitle} numberOfLines={1}>
              {activeBannerNotification.title}
            </Text>
            <Text style={styles.pushToastBody} numberOfLines={2}>
              {activeBannerNotification.body}
            </Text>
          </View>
          <TouchableOpacity
            onPress={dismissBannerNotification}
            style={styles.pushToastCloseBtn}
          >
            <MaterialIcons name="close" size={16} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Notification Center Modal (Matches design/stitch_/_17/code.html) */}
      <NotificationCenterModal
        visible={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 50,
  },
  headerBar: {
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandSide: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  buildingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitles: {
    alignItems: 'flex-end',
    flex: 1,
  },
  appLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  buildingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 1,
    textAlign: 'right',
  },
  actionsSide: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  authSwitchBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  authSwitchText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryContainer,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: COLORS.statusUnpaid,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBar: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  rolePillsScroll: {
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  roleBarHint: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    marginLeft: 4,
  },
  rolePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  rolePillActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  rolePillTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  pushToastBanner: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  pushToastIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushToastTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pushToastHeaderRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  pushToastRoleTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6CF8BB',
  },
  pushToastTapHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  pushToastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimary,
    textAlign: 'right',
  },
  pushToastBody: {
    fontSize: 11,
    color: '#E2E8F0',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 16,
  },
  pushToastCloseBtn: {
    padding: 4,
  },
});
