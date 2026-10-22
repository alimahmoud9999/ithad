import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { EmergencyClaim } from '@/shared/types/database';
import { styles } from '../ResidentHomeScreen.styles';

interface EmergencyContributionCardProps {
  openEmergencyContributionSheet: (claim: EmergencyClaim) => void;
}

export const EmergencyContributionCard: React.FC<EmergencyContributionCardProps> = ({
  openEmergencyContributionSheet,
}) => {
  const { emergencyClaims } = useAppStore();

  return (
    emergencyClaims.length > 0 && (
    <View style={styles.emergencyCardContainer}>
      <View style={styles.rowBetween}>
        <View style={styles.rowAlign}>
          <View style={styles.emergencyIconBox}>
            <MaterialIcons name="handyman" size={20} color={COLORS.statusUnpaid} />
          </View>
          <View>
            <Text style={styles.emergencyCategoryLabel}>صندوق صيانة طارئة نشط</Text>
            <Text style={styles.emergencyTitleText}>
              {emergencyClaims[0].title || 'تجديد طلمبة المياه وتحديث لوحة الكهرباء'}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={{ gap: 6, marginTop: 4 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.progressSubText}>
            تم جمع <Text style={{ fontWeight: '700', color: COLORS.onSurface }}>3,250 ج.م</Text> من أصل {emergencyClaims[0].target_amount} ج.م
          </Text>
          <Text style={styles.progressPercentText}>65% مكتمل</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '65%' }]} />
        </View>
      </View>

      {/* Neighbor Contributors Row */}
      <View style={[styles.rowBetween, { marginTop: 4 }]}>
        <View style={styles.rowAlign}>
          <View style={styles.avatarStackRow}>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.primaryContainer }]}>
              <Text style={styles.avatarCircleText}>ش١</Text>
            </View>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.surfaceContainerHigh }]}>
              <Text style={[styles.avatarCircleText, { color: COLORS.onSurface }]}>ش٤</Text>
            </View>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.secondary }]}>
              <Text style={styles.avatarCircleText}>ش٦</Text>
            </View>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.surfaceContainer }]}>
              <Text style={[styles.avatarCircleText, { color: COLORS.onSurfaceVariant }]}>+7</Text>
            </View>
          </View>
          <Text style={styles.contributorsLabel}>ساهم 10 ملاك حتى الآن</Text>
        </View>
        <View style={styles.shareBadgePill}>
          <Text style={styles.shareBadgeText}>
            حصتك: <Text style={{ fontWeight: '800' }}>{emergencyClaims[0].default_share_amount || 250} ج.م</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.contributeBtn}
        onPress={() => openEmergencyContributionSheet(emergencyClaims[0])}
      >
        <MaterialIcons name="payments" size={18} color={COLORS.primary} />
        <Text style={styles.contributeBtnText}>
          المساهمة في الصندوق الطارئ ({emergencyClaims[0].default_share_amount || 250} ج.م)
        </Text>
      </TouchableOpacity>
    </View>
    )
  ) || null;
};
