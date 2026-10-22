import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../AdminDashboardScreen.styles';

interface ReadOnlyBannerProps {
  onNavigateSettings: (() => void) | undefined;
  setSubscriptionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ReadOnlyBanner: React.FC<ReadOnlyBannerProps> = ({
  onNavigateSettings,
  setSubscriptionModalVisible,
}) => {
  const { isCurrentBuildingWritable } = useAppStore();

  return (
    !isCurrentBuildingWritable && (
    <View style={styles.readOnlyBanner}>
      <View style={styles.readOnlyRight}>
        <MaterialIcons
          name="lock-clock"
          size={22}
          color={COLORS.statusUnpaidText}
        />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.readOnlyTitle}>
            انتهى اشتراك العمارة (وضع القراءة فقط Read-Only)
          </Text>
          <Text style={styles.readOnlyDesc}>
            حساب المدير حالياً في وضع القراءة فقط. ارفع إيصال تجديد الباقة
            ليقوم مالك التطبيق بتفعيلها.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.renewNowBtn}
        onPress={() => {
          if (onNavigateSettings) {
            onNavigateSettings();
          } else {
            setSubscriptionModalVisible(true);
          }
        }}
      >
        <Text style={styles.renewNowBtnText}>تجديد الاشتراك</Text>
      </TouchableOpacity>
    </View>
    )
  ) || null;
};
