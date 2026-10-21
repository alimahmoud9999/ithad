import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../../../../app/TopHeader.styles';

interface PushToastBannerProps {
  setNotifModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PushToastBanner: React.FC<PushToastBannerProps> = ({
  setNotifModalOpen,
}) => {
  const { activeBannerNotification, currentRole, currentUser, dismissBannerNotification } = useAppStore();

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

  return (
    isBannerForCurrentActiveUser && activeBannerNotification && (
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
    )
  ) || null;
};
