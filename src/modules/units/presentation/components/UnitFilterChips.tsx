import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { COLORS } from '@/shared/theme/colors';
import { useUnitFinancials } from '../../application/useUnitFinancials';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface UnitFilterChipsProps {
  activeFilter: 'all' | 'overdue' | 'paid' | 'pending';
  setActiveFilter: React.Dispatch<React.SetStateAction<'all' | 'overdue' | 'paid' | 'pending'>>;
}

export const UnitFilterChips: React.FC<UnitFilterChipsProps> = ({
  activeFilter,
  setActiveFilter,
}) => {
  const { stats } = useUnitFinancials();

  return (
    <View style={styles.filterPillsRow}>
      <TouchableOpacity
        style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
        onPress={() => setActiveFilter('all')}
      >
        <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
          الكل ({stats.total})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterPill, activeFilter === 'overdue' && styles.filterPillActive]}
        onPress={() => setActiveFilter('overdue')}
      >
        <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusUnpaid }]} />
        <Text style={[styles.filterPillText, activeFilter === 'overdue' && styles.filterPillTextActive]}>
          المديونيات والمتأخرات ({stats.overdueCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterPill, activeFilter === 'paid' && styles.filterPillActive]}
        onPress={() => setActiveFilter('paid')}
      >
        <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusPaid }]} />
        <Text style={[styles.filterPillText, activeFilter === 'paid' && styles.filterPillTextActive]}>
          المسددين ({stats.paidCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterPill, activeFilter === 'pending' && styles.filterPillActive]}
        onPress={() => setActiveFilter('pending')}
      >
        <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusPending }]} />
        <Text style={[styles.filterPillText, activeFilter === 'pending' && styles.filterPillTextActive]}>
          معلق ({stats.pendingCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
};
