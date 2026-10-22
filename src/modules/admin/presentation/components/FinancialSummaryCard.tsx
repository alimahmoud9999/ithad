import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../application/useAdminDashboardMetrics';
import { styles } from '../AdminDashboardScreen.styles';

export const FinancialSummaryCard: React.FC = () => {
  const { currentBuilding } = useAppStore();
  const { collectionPercentage, monthlyCollectedTotal, monthlyExpensesTotal } = useAdminDashboardMetrics();

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.heroBalanceLabel}>
            رصيد الصندوق الحالي (الخزينة)
          </Text>
          <View style={styles.heroBalanceValRow}>
            <Text style={styles.heroBalanceNumber}>
              {currentBuilding.fund_balance.toLocaleString()}
            </Text>
            <Text style={styles.heroBalanceCurrency}>ج.م</Text>
          </View>
        </View>

        <View style={styles.trendPill}>
          <MaterialIcons
            name="trending-up"
            size={14}
            color={COLORS.secondaryFixed}
          />
          <Text style={styles.trendPillText}>
            {collectionPercentage > 0
              ? `${collectionPercentage}% تحصيل`
              : 'بداية الدورة'}
          </Text>
        </View>
      </View>

      {/* Collection Progress Gauge Bar */}
      <View style={styles.gaugeBlock}>
        <View style={styles.gaugeLabelsRow}>
          <Text style={styles.gaugeTitle}>نسبة التحصيل الشهري العام</Text>
          <Text style={styles.gaugePercent}>
            {collectionPercentage}% مكتمل
          </Text>
        </View>
        <View style={styles.gaugeTrack}>
          <View
            style={[
              styles.gaugeFill,
              { width: `${collectionPercentage}%` },
            ]}
          />
        </View>
      </View>

      {/* Financial Sub-stats Row: Income vs Expenses */}
      <View style={styles.subStatsGrid}>
        <View style={styles.subStatItem}>
          <View
            style={[
              styles.subStatIconBox,
              { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
            ]}
          >
            <MaterialIcons
              name="arrow-downward"
              size={18}
              color={COLORS.secondaryFixed}
            />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.subStatLabel}>المتحصلات</Text>
            <Text
              style={[styles.subStatValue, { color: COLORS.secondaryFixed }]}
            >
              {monthlyCollectedTotal.toLocaleString()} ج.م
            </Text>
          </View>
        </View>

        <View style={styles.subStatItem}>
          <View
            style={[
              styles.subStatIconBox,
              { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
            ]}
          >
            <MaterialIcons
              name="arrow-upward"
              size={18}
              color={COLORS.errorContainer}
            />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.subStatLabel}>المصروفات</Text>
            <Text
              style={[styles.subStatValue, { color: COLORS.errorContainer }]}
            >
              {monthlyExpensesTotal.toLocaleString()} ج.م
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
