import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface NewUnitSuccessBannerProps {
  lastAddedAptNumber: string | null;
  setLastAddedAptNumber: React.Dispatch<React.SetStateAction<string | null>>;
}

export const NewUnitSuccessBanner: React.FC<NewUnitSuccessBannerProps> = ({
  lastAddedAptNumber,
  setLastAddedAptNumber,
}) => {
  const { currentBuilding } = useAppStore();

  return (
    lastAddedAptNumber && (
    <View style={styles.successBanner}>
      <View style={styles.rowAlign}>
        <View style={styles.successIconCircle}>
          <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowAlign}>
            <Text style={styles.successBannerTitle}>
              تمت إضافة شقة {lastAddedAptNumber} بنجاح لسجل {currentBuilding.name}
            </Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>جديدة</Text>
            </View>
          </View>
          <Text style={styles.successBannerSub}>تم توليد كود الدعوة وتجهيز ملف الشقة</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setLastAddedAptNumber(null)}>
        <MaterialIcons name="close" size={18} color={COLORS.onSecondaryContainer} />
      </TouchableOpacity>
    </View>
    )
  ) || null;
};
