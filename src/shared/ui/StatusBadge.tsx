import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/shared/theme/colors';
import { PaymentStatus } from '@/shared/types/database';

interface StatusBadgeProps {
  status: PaymentStatus | 'upcoming' | 'trial' | 'active' | 'expired' | 'read_only';
  customLabel?: string;
}

/**
 * Exact Status Badges from design/stitch_/ittihad_trust_mobile/DESIGN.md:
 * - Paid (مدفوع): #ECFDF5 bg with #047857 text & #10B981 dot
 * - Pending (قيد المراجعة): #FFF7ED bg with #C2410C text & #F97316 dot
 * - Unpaid / Overdue (متأخر): #FEF2F2 bg with #B91C1C text & #EF4444 dot
 * - Notice / Upcoming (تنبيه): #FFFBEB bg with #B45309 text & #F59E0B dot
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customLabel }) => {
  const getConfig = () => {
    switch (status) {
      case 'paid':
      case 'active':
        return {
          bg: COLORS.statusPaidBg,
          text: COLORS.statusPaidText,
          dot: COLORS.statusPaid,
          label: customLabel || (status === 'active' ? 'اشتراك نشط' : 'تم الدفع'),
        };
      case 'pending':
        return {
          bg: COLORS.statusPendingBg,
          text: COLORS.statusPendingText,
          dot: COLORS.statusPending,
          label: customLabel || 'قيد المراجعة',
        };
      case 'upcoming':
      case 'trial':
        return {
          bg: COLORS.statusUpcomingBg,
          text: COLORS.statusUpcomingText,
          dot: COLORS.statusUpcoming,
          label: customLabel || (status === 'trial' ? 'فترة تجريبية 60 يوم' : 'مستحق قريباً'),
        };
      case 'unpaid':
      case 'rejected':
      case 'expired':
      case 'read_only':
      default:
        return {
          bg: COLORS.statusUnpaidBg,
          text: COLORS.statusUnpaidText,
          dot: COLORS.statusUnpaid,
          label:
            customLabel ||
            (status === 'read_only' || status === 'expired'
              ? 'وضع القراءة فقط (منتهي)'
              : status === 'rejected'
              ? 'مرفوض'
              : 'متأخر السداد'),
        };
    }
  };

  const cfg = getConfig();

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
});
