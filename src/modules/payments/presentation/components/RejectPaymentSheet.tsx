import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../payments.styles';

interface RejectPaymentSheetProps {
  rejectModalPaymentId: string | null;
  setRejectModalPaymentId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const RejectPaymentSheet: React.FC<RejectPaymentSheetProps> = ({
  rejectModalPaymentId,
  setRejectModalPaymentId,
}) => {
  const { rejectResidentPayment } = useAppStore();

  const [rejectReason, setRejectReason] = useState(
    'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد'
  );

  const confirmRejectPayment = async () => {
    if (!rejectModalPaymentId) return;
    try {
      await rejectResidentPayment(rejectModalPaymentId, rejectReason);
      setRejectModalPaymentId(null);
      Alert.alert(
        'تم رفض الطلب وإشعار الساكن 🔔',
        `تم إرسال إشعار فوري للساكن يتضمن سبب الرفض: "${rejectReason}"`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ');
    }
  };

  return (
    <BottomSheetModal
      visible={Boolean(rejectModalPaymentId)}
      title="تحديد سبب رفض طلب السداد"
      subtitle="سيصل إشعار فوري للساكن يتضمن سبب الرفض الموضح أدناه"
      onClose={() => setRejectModalPaymentId(null)}
    >
      <View style={{ gap: 12 }}>
        <Text style={styles.fieldLabel}>اختر سبباً سريعاً أو اكتب السبب</Text>
        <View style={{ gap: 8 }}>
          {[
            'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد',
            'المبلغ المحول أقل من قيمة الاشتراك الشهري المقررة',
            'رقم المرجع في الإيصال غير مطابق لكشف حساب البنك / إنستاباي',
          ].map((preset) => (
            <TouchableOpacity
              key={preset}
              onPress={() => setRejectReason(preset)}
              style={[
                styles.categoryChip,
                rejectReason === preset && styles.categoryChipActive,
                { width: '100%', justifyContent: 'flex-start' },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  rejectReason === preset && styles.categoryChipTextActive,
                  { textAlign: 'right' },
                ]}
              >
                {preset}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>تفاصيل سبب الرفض المرسلة للساكن</Text>
        <TextInput
          style={[styles.textInput, { minHeight: 72, textAlignVertical: 'top' }]}
          value={rejectReason}
          onChangeText={setRejectReason}
          multiline
          placeholder="اكتب سبب الرفض ليظهر للساكن في الإشعار..."
          placeholderTextColor={COLORS.outline}
          textAlign="right"
        />

        <TouchableOpacity
          style={[
            styles.modalPrimaryBtn,
            { backgroundColor: COLORS.statusUnpaid },
          ]}
          onPress={confirmRejectPayment}
        >
          <MaterialIcons name="cancel" size={18} color={COLORS.onPrimary} />
          <Text style={styles.modalPrimaryBtnText}>
            تأكيد الرفض وإرسال إشعار للساكن
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
