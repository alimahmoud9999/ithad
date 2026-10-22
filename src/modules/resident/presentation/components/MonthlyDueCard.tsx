import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useResidentLedger } from '../../application/useResidentLedger';
import { styles } from '../ResidentHomeScreen.styles';

interface MonthlyDueCardProps {
  openMonthlyPaymentSheet: () => void;
}

export const MonthlyDueCard: React.FC<MonthlyDueCardProps> = ({
  openMonthlyPaymentSheet,
}) => {
  const { currentBuilding } = useAppStore();
  const { currentMonthLabel, effectiveArrears, monthlyStatus } = useResidentLedger();

  return (
    <View style={styles.heroDueCard}>
      <View style={styles.heroGlowAccent} />
      <View style={{ zIndex: 2, gap: 14 }}>
        {/* Top Row: Badge & Cycle */}
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <View
              style={[
                styles.statusIndicatorDot,
                monthlyStatus === 'paid' && { backgroundColor: COLORS.statusPaid },
                monthlyStatus === 'pending' && { backgroundColor: COLORS.statusPending },
              ]}
            />
            <Text style={styles.cycleSubHeading}>اشتراك الشهر الحالي</Text>
          </View>
          <View
            style={[
              styles.dueStatusBadge,
              monthlyStatus === 'paid' && { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
            ]}
          >
            <Text
              style={[
                styles.dueStatusBadgeText,
                monthlyStatus === 'paid' && { color: COLORS.statusPaid },
              ]}
            >
              {monthlyStatus === 'paid'
                ? 'تم السداد ✅'
                : monthlyStatus === 'pending'
                ? 'قيد المراجعة ⏳'
                : 'مستحق السداد'}
            </Text>
          </View>
        </View>

        {/* Amount and Due Date */}
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.amountLabelLight}>المبلغ المطلوب لدورة {currentMonthLabel}</Text>
            <View style={styles.rowAlign}>
              <Text style={styles.amountHeroNumber}>
                {currentBuilding.default_monthly_dues || 400}
              </Text>
              <Text style={styles.currencyHeroSub}>ج.م</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabelLight}>تاريخ الاستحقاق</Text>
            <Text style={styles.dueDateText}>1 {currentMonthLabel}</Text>
          </View>
        </View>

        {/* Status Subtext Pill */}
        <View
          style={[
            styles.balanceStatusPill,
            effectiveArrears > 0 && styles.balanceStatusPillArrears,
          ]}
        >
          <MaterialIcons
            name={effectiveArrears > 0 ? 'warning' : 'account-balance-wallet'}
            size={18}
            color={effectiveArrears > 0 ? '#FCA5A5' : COLORS.secondaryFixed}
          />
          <Text style={styles.balanceStatusText}>
            {effectiveArrears > 0 ? (
              <>
                مديونية ومتأخرات سابقة مسجلة:{' '}
                <Text style={{ color: '#FCA5A5', fontWeight: '800' }}>
                  {effectiveArrears.toLocaleString()} ج.م
                </Text>
              </>
            ) : (
              <>
                الرصيد المالي السابق: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>0.00 ج.م</Text> (حساب منتظم)
              </>
            )}
          </Text>
        </View>

        {/* Primary Action Button */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.payNowMainBtn,
              monthlyStatus === 'paid' && styles.payNowMainBtnDisabled,
            ]}
            activeOpacity={0.88}
            onPress={openMonthlyPaymentSheet}
          >
            <MaterialIcons name="bolt" size={20} color={COLORS.onSecondary} />
            <Text style={styles.payNowMainBtnText}>
              {monthlyStatus === 'paid'
                ? 'تم سداد الاشتراك واعتماده بالخزينة ✅'
                : monthlyStatus === 'pending'
                ? 'إيصالك قيد المراجعة من رئيس الاتحاد ⏳'
                : 'سداد الاشتراك ورفع الإيصال ⚡'}
            </Text>
          </TouchableOpacity>

          <View style={styles.paymentMethodsChipsRow}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
              <Text style={styles.methodChipLabel}>إنستاباي</Text>
            </View>
            <View style={styles.dotDivider} />
            <View style={styles.rowAlign}>
              <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
              <Text style={styles.methodChipLabel}>فودافون كاش</Text>
            </View>
            <View style={styles.dotDivider} />
            <View style={styles.rowAlign}>
              <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
              <Text style={styles.methodChipLabel}>نقداً للخزينة</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};
