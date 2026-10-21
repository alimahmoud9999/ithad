import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useUnitFinancials } from '../../application/useUnitFinancials';
import { styles } from '../ApartmentsUnitsScreen.styles';

export const CollectionSummaryCard: React.FC = () => {
  const { currentBuilding, sendBulkUnpaidReminder } = useAppStore();
  const { stats } = useUnitFinancials();

  return (
    <View style={styles.collectionHeroCard}>
      <View style={styles.heroGlow1} />
      <View style={styles.heroGlow2} />

      <View style={{ zIndex: 2, gap: 14 }}>
        {/* Top Title & Total Apartments Badge */}
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="analytics" size={20} color={COLORS.primaryFixed} />
            <Text style={styles.heroTitleText}>تحصيل دورة {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={styles.unitsCountBadge}>
            <Text style={styles.unitsCountBadgeText}>{stats.total} وحدة مسجلة</Text>
          </View>
        </View>

        {/* Main Gauge & Collected Sum */}
        <View style={styles.rowBetween}>
          {/* Progress Percentage */}
          <View style={styles.rowAlign}>
            <View style={styles.circularGaugeBox}>
              <Text style={styles.circularGaugePercent}>{stats.percent}%</Text>
            </View>
            <View>
              <Text style={styles.gaugePaidText}>{stats.paidCount} من {stats.total} شقة</Text>
              <Text style={styles.gaugeSubText}>تم السداد بالكامل</Text>
            </View>
          </View>

          {/* Total Collected */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.collectedLabelText}>المُحصّل الفعلي</Text>
            <View style={styles.rowAlign}>
              <Text style={styles.collectedSumText}>{stats.collected.toLocaleString('en-US')}</Text>
              <Text style={styles.currencyHeroSub}>ج.م</Text>
            </View>
          </View>
        </View>

        {/* Sub Metric Tiles (Paid / Overdue / Pending) */}
        <View style={styles.threeColumnGrid}>
          <View style={styles.metricTile}>
            <View style={styles.rowAlign}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.statusPaid }]} />
              <Text style={[styles.tileLabel, { color: COLORS.secondaryFixed }]}>مسدد ({stats.paidCount})</Text>
            </View>
            <Text style={styles.tileAmount}>{(stats.paidCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
          </View>

          <View style={styles.metricTile}>
            <View style={styles.rowAlign}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.statusUnpaid }]} />
              <Text style={[styles.tileLabel, { color: COLORS.errorContainer }]}>متأخر ({stats.overdueCount})</Text>
            </View>
            <Text style={styles.tileAmount}>{(stats.overdueCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
          </View>

          <View style={styles.metricTile}>
            <View style={styles.rowAlign}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.statusPending }]} />
              <Text style={[styles.tileLabel, { color: COLORS.tertiaryFixed }]}>تدقيق ({stats.pendingCount})</Text>
            </View>
            <Text style={styles.tileAmount}>{(stats.pendingCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
          </View>
        </View>

        {/* Bulk WhatsApp Reminder Button */}
        {stats.overdueCount > 0 && (
          <TouchableOpacity
            style={styles.batchWhatsAppBtn}
            activeOpacity={0.88}
            onPress={() => sendBulkUnpaidReminder()}
          >
            <MaterialIcons name="chat" size={18} color="#FFFFFF" />
            <Text style={styles.batchWhatsAppBtnText}>
              إرسال تذكير واتساب للمتأخرين ({stats.overdueCount} شقق) 📲
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
