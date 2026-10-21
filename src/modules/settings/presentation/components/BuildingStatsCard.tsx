import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

export const BuildingStatsCard: React.FC = () => {
  const { apartments } = useAppStore();

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.iconBoxPrimary}>
          <MaterialIcons name="apartment" size={24} color={COLORS.primary} />
        </View>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={styles.sectionTitle}>بيانات العقار والوحدات</Text>
          <Text style={styles.sectionSubtitle}>
            إحصائيات الوحدات السكنية المسجلة
          </Text>
        </View>
      </View>

      <View style={styles.buildingStatsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{apartments.length}</Text>
          <Text style={styles.statLbl}>إجمالي الشقق</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#10B981' }]}>
            {
              apartments.filter((a) =>
                Boolean(a.resident_id || a.occupant_name || a.resident_name)
              ).length
            }
          </Text>
          <Text style={styles.statLbl}>شقق مأهولة</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#F59E0B' }]}>
            {
              apartments.filter(
                (a) =>
                  !a.resident_id && !a.occupant_name && !a.resident_name
              ).length
            }
          </Text>
          <Text style={styles.statLbl}>شقق شاغرة</Text>
        </View>
      </View>
    </View>
  );
};
