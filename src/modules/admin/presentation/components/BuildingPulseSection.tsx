import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../application/useAdminDashboardMetrics';
import { styles } from '../AdminDashboardScreen.styles';

interface BuildingPulseSectionProps {
  onNavigateCommunity: (() => void) | undefined;
}

export const BuildingPulseSection: React.FC<BuildingPulseSectionProps> = ({
  onNavigateCommunity,
}) => {
  const { currentBuilding } = useAppStore();
  const { activeIssuesCount, activePollsCount, occupiedApartments, totalArrearsAmount, unpaidApartments } = useAdminDashboardMetrics();

  return (
    <View style={styles.pulseSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>نبض العمارة والنشاط العام 📊</Text>
        <View style={styles.badgeMuted}>
          <Text style={styles.badgeMutedText}>إحصائيات فورية</Text>
        </View>
      </View>

      <View style={styles.pulseGrid}>
        {/* Col 1: Occupancy */}
        <View style={styles.pulseCol}>
          <View style={styles.pulseColIconRow}>
            <MaterialIcons
              name="people-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.pulseColTitle}>نسبة الإشغال</Text>
          </View>
          <Text style={styles.pulseColNumber}>
            {occupiedApartments.length}/{currentBuilding.total_apartments}
          </Text>
          <Text style={styles.pulseColSub}>
            {currentBuilding.total_apartments - occupiedApartments.length > 0
              ? `${currentBuilding.total_apartments - occupiedApartments.length} شقة شاغرة`
              : 'العمارة مأهولة بالكامل'}
          </Text>
        </View>

        {/* Col 2: Total Arrears */}
        <View style={styles.pulseCol}>
          <View style={styles.pulseColIconRow}>
            <MaterialIcons
              name="warning-amber"
              size={18}
              color={COLORS.statusUnpaidText}
            />
            <Text style={styles.pulseColTitle}>إجمالي المتأخرات</Text>
          </View>
          <Text
            style={[
              styles.pulseColNumber,
              { color: COLORS.statusUnpaidText },
            ]}
          >
            {totalArrearsAmount.toLocaleString()} ج.م
          </Text>
          <Text style={styles.pulseColSub}>
            {unpaidApartments.length} شقة غير مسددة
          </Text>
        </View>
      </View>

      {/* Community Hub Status Row */}
      <View style={styles.communityPulseBox}>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.communityPulseText}>
            مجتمع العمارة: {activeIssuesCount} بلاغ صيانة مفتوح • {activePollsCount} استطلاع نشط
          </Text>
          <Text style={{ fontSize: 11, color: '#15803D' }}>
            متابعة الشكاوى والتصويت على قرارات الجمعية العمومية
          </Text>
        </View>
        {onNavigateCommunity && (
          <TouchableOpacity
            style={styles.communityPulseBtn}
            onPress={onNavigateCommunity}
          >
            <Text style={styles.communityPulseBtnText}>عرض المجتمع</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
