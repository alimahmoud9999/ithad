import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useResidentLedger } from '../../application/useResidentLedger';
import { styles } from '../ResidentHomeScreen.styles';

export const ResidentHeader: React.FC = () => {
  const { currentBuilding, currentUser } = useAppStore();
  const { currentMonthLabel } = useResidentLedger();

  return (
    <View style={styles.residentHeaderSection}>
      <View style={styles.rowBetween}>
        <View style={styles.rowAlign}>
          <View style={styles.verifiedGreenCapsule}>
            <MaterialIcons name="verified" size={14} color={COLORS.secondary} />
            <Text style={styles.verifiedGreenText}>حساب مفعل وموثق</Text>
          </View>
          <View style={styles.sharePercentCapsule}>
            <Text style={styles.sharePercentText}>مالك مقيم (6.25%)</Text>
          </View>
        </View>
        <Text style={styles.cycleDateText}>{currentMonthLabel}</Text>
      </View>

      <View style={{ marginTop: 6 }}>
        <Text style={styles.residentGreeting}>
          مرحباً، {currentUser.full_name || 'م. أحمد مصطفى'} 👋
        </Text>
        <View style={[styles.rowAlign, { marginTop: 2 }]}>
          <MaterialIcons name="location-on" size={16} color={COLORS.secondary} />
          <Text style={styles.unitLocationText}>
            شقة {currentUser.apartment_number || '302'} • {currentUser.floor_number || 'الدور الثالث'} (واجهة) • {currentBuilding.name}
          </Text>
        </View>
      </View>
    </View>
  );
};
