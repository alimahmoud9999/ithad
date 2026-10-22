import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../TransparencyExpensesScreen.styles';

export const ExpensesHeader: React.FC = () => {
  const { currentBuilding, currentRole } = useAppStore();

  return (
    <View style={styles.headerRow}>
      <View style={{ alignItems: 'flex-end', flex: 1 }}>
        <Text style={styles.pageTitle}>لوحة المصروفات والشفافية</Text>
        <Text style={styles.pageSubtitle}>
          {currentBuilding.name} • تقرير المصروفات وسجل الفواتير المعتمدة
        </Text>
      </View>

      <View style={styles.auditPill}>
        <MaterialIcons name="verified" size={15} color={COLORS.secondary} />
        <Text style={styles.auditPillText}>
          {currentRole === 'resident' ? 'عرض شفاف للملاك' : 'تدقيق نشط'}
        </Text>
      </View>
    </View>
  );
};
