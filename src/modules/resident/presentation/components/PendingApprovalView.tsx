import React from 'react';
import { View, Text, I18nManager, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../ResidentHomeScreen.styles';

export const PendingApprovalView: React.FC = () => {
  const { currentBuilding, currentUser, logout, refreshData } = useAppStore();

  return (
    <View style={styles.pendingAccountScreen}>
      <View style={styles.pendingCard}>
        <View style={styles.pendingIconCircle}>
          <MaterialIcons name="hourglass-top" size={36} color={COLORS.statusPending} />
        </View>
        <Text style={styles.pendingScreenTitle}>طلبك قيد المراجعة والاعتماد</Text>
        <Text style={styles.pendingScreenDesc}>
          مرحباً {currentUser.full_name}، تم إرسال طلب انضمامك إلى ({currentBuilding.name} - شقة {currentUser.apartment_number || '302'}) وهو بانتظار مراجعة وتفعيل رئيس الاتحاد.
        </Text>
        <View
          style={{
            flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FEF3C7',
            borderWidth: 1,
            borderColor: '#FDE68A',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginTop: 6,
          }}
        >
          <MaterialIcons name="info-outline" size={16} color="#D97706" />
          <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
            سيصلك إشعار فوري عند قيام رئيس الاتحاد باعتماد حسابك
          </Text>
        </View>

        <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14, width: '100%' }}>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: COLORS.primary,
              paddingVertical: 10,
              borderRadius: 10,
            }}
            onPress={async () => {
              await refreshData();
              Alert.alert('جاري التحديث 🔄', 'تم فحص أحدث حالة لطلبك من السيرفر.');
            }}
          >
            <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>تحديث الحالة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#FEE2E2',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#FECACA',
            }}
            onPress={async () => {
              await logout();
            }}
          >
            <MaterialIcons name="logout" size={16} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>خروج</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
