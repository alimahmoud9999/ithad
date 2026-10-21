import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import type { ActiveSubView } from '../../domain/resident.types';
import { styles } from '../ResidentHomeScreen.styles';

interface QuickServicesGridProps {
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
}

export const QuickServicesGrid: React.FC<QuickServicesGridProps> = ({
  setActiveSubView,
}) => {
  return (
    <View style={styles.quickServicesGrid}>
      <TouchableOpacity
        style={styles.servicePillBtn}
        onPress={() => setActiveSubView('unit_ledger')}
      >
        <MaterialIcons name="receipt-long" size={20} color={COLORS.primary} />
        <Text style={styles.servicePillText}>كشف حساب الوحدة</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.servicePillBtn}
        onPress={() => setActiveSubView('add_ticket')}
      >
        <MaterialIcons name="handyman" size={20} color={COLORS.secondary} />
        <Text style={styles.servicePillText}>بلاغ صيانة وعطل</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.servicePillBtn}
        onPress={() => setActiveSubView('docs_bylaws')}
      >
        <MaterialIcons name="menu-book" size={20} color={COLORS.statusPending} />
        <Text style={styles.servicePillText}>اللائحة والعقود</Text>
      </TouchableOpacity>
    </View>
  );
};
