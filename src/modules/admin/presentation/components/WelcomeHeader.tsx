import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { copyToClipboard } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../application/useAdminDashboardMetrics';
import { styles } from '../AdminDashboardScreen.styles';

interface WelcomeHeaderProps {
  onNavigateSettings: (() => void) | undefined;
  setSubscriptionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
  onNavigateSettings,
  setSubscriptionModalVisible,
}) => {
  const { currentBuilding, currentUser, isCurrentBuildingWritable } = useAppStore();
  const { currentCycleLabel } = useAdminDashboardMetrics();

  return (
    <View style={styles.welcomeRow}>
      <View style={{ alignItems: 'flex-end', flex: 1 ,marginBottom: 10 }}>
        <View style={styles.activeStatusLine}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isCurrentBuildingWritable
                  ? COLORS.statusPaid
                  : COLORS.statusUnpaid,
                  
              },
            ]}
          />
          <Text style={styles.activeStatusLabel}>
            {isCurrentBuildingWritable
              ? `إدارة البرج نشطة • كود المبنى: ${currentBuilding.building_code}`
              : 'وضع القراءة فقط (اشتراك منتهي)'}
          </Text>
          {isCurrentBuildingWritable && (
            <TouchableOpacity
              onPress={() =>
                copyToClipboard(currentBuilding.building_code, 'كود المبنى')
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerCodeCopyIconBtn}
            >
              <MaterialIcons
                name="content-copy"
                size={13}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.adminWelcomeName}>
          مرحباً، {currentUser.full_name}
        </Text>
        <Text style={styles.adminRoleSub}>رئيس مجلس اتحاد الملاك المنتخب</Text>
      </View>

      <TouchableOpacity
        style={styles.cyclePill}
        onPress={() => {
          if (onNavigateSettings) {
            onNavigateSettings();
          } else {
            setSubscriptionModalVisible(true);
          }
        }}
      >
        <MaterialIcons
          name="calendar-today"
          size={15}
          color={COLORS.primary}
        />
        <Text style={styles.cyclePillText}>دورة {currentCycleLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};
