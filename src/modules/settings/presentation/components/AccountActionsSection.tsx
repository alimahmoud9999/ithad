import React from 'react';
import { View, TouchableOpacity, Alert, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

export const AccountActionsSection: React.FC = () => {
  const { refreshData, setAuthenticated } = useAppStore();

  return (
    <View style={styles.logoutSection}>
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={async () => {
          await refreshData();
          Alert.alert('تم التحديث بنجاح 🔄', 'تمت مزامنة البيانات مع السيرفر.');
        }}
      >
        <MaterialIcons name="sync" size={18} color={COLORS.primary} />
        <Text style={styles.refreshBtnText}>مزامنة وتحديث البيانات الآن</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert(
            'تسجيل الخروج',
            'هل ترغب في تسجيل الخروج والعودة لشاشة الدخول والرمز؟',
            [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'تسجيل الخروج',
                style: 'destructive',
                onPress: () => setAuthenticated(false),
              },
            ]
          );
        }}
      >
        <MaterialIcons name="logout" size={18} color={COLORS.error} />
        <Text style={styles.logoutBtnText}>تسجيل الخروج من الحساب</Text>
      </TouchableOpacity>

      <Text style={styles.appVersionText}>
        تطبيق "مدير اتحاد الملاك" • Ittihad Trust Mobile
        {'\n'}الإصدار 1.2.0 • حماية وشفافية سحابية كاملة
      </Text>
    </View>
  );
};
