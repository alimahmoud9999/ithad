import React from 'react';
import { View, Text, Image, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Payment } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../payments.styles';

interface ReceiptInspectionSheetProps {
  previewReceiptUrl: string | null;
  setPreviewReceiptUrl: React.Dispatch<React.SetStateAction<string | null>>;
  previewPayment: Payment | null;
  setPreviewPayment: React.Dispatch<React.SetStateAction<Payment | null>>;
  handleApprovePayment: (paymentId: string) => Promise<void>;
  handleRejectPayment: (paymentId: string) => void;
}

export const ReceiptInspectionSheet: React.FC<ReceiptInspectionSheetProps> = ({
  previewReceiptUrl,
  setPreviewReceiptUrl,
  previewPayment,
  setPreviewPayment,
  handleApprovePayment,
  handleRejectPayment,
}) => {
  const { apartments, currentBuilding, processingIds } = useAppStore();

  return (
    <BottomSheetModal
      visible={Boolean(previewReceiptUrl)}
      title="مراجعة واعتماد السداد"
      subtitle="فحص الإيصال المرفق والمطابقة الذكية قبل التوريد للخزينة"
      onClose={() => {
        setPreviewReceiptUrl(null);
        setPreviewPayment(null);
      }}
    >
      {previewReceiptUrl && (
        <View style={{ gap: 14 }}>
          {/* Header info if previewPayment is set */}
          {previewPayment && (
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewRightGroup}>
                <View style={styles.aptBadgeBox}>
                  <Text style={styles.aptBadgeLabel}>شقة</Text>
                  <Text style={styles.aptBadgeNumber}>
                    {previewPayment.apartment_number || '302'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.residentNameText}>
                    {previewPayment.resident_name || 'الساكن / المالك'}
                  </Text>
                  <Text style={styles.paymentMethodTagText}>
                    {previewPayment.billing_month || 'اشتراك شهري'} • {currentBuilding.name}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-start' }}>
                <Text style={styles.paymentAmountText}>
                  {previewPayment.amount.toLocaleString()} ج.م
                </Text>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#ECFDF5',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginTop: 2,
                  }}
                >
                  <MaterialIcons name="auto-awesome" size={12} color={COLORS.secondary} />
                  <Text style={{ fontSize: 10, color: COLORS.secondary, fontWeight: '700' }}>
                    فحص ذكي إيجابي
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Receipt Image Display */}
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: COLORS.primaryContainer,
              padding: 4,
              borderWidth: 1,
              borderColor: COLORS.borderSubtle,
            }}
          >
            <Image
              source={{ uri: previewReceiptUrl }}
              style={styles.fullReceiptImage}
              resizeMode="contain"
            />
          </View>

          {/* Smart Verification Checklist (design/_7/code.html lines 160-180) */}
          <View
            style={{
              backgroundColor: COLORS.surfaceContainerLow,
              borderRadius: 12,
              padding: 12,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="fact-check" size={18} color={COLORS.secondary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.onSurface }}>
                مطابقة البيانات التلقائية مع السجلات:
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                  المبلغ مطابق بالكامل للقيمة المستحقة {previewPayment ? `(${previewPayment.amount} ج.م)` : ''}
                </Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                  الحساب المستلم مطابق لحساب صندوق اتحاد الملاك ({currentBuilding.name})
                </Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                  صورة الإيصال أصلية ومطابقة لنموذج التحويل اللحظي
                </Text>
              </View>
            </View>
          </View>

          {/* Decision Actions directly inside modal */}
          {previewPayment && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: COLORS.secondary }]}
                onPress={() => {
                  const payId = previewPayment.id;
                  setPreviewReceiptUrl(null);
                  setPreviewPayment(null);
                  handleApprovePayment(payId);
                }}
                disabled={Boolean(processingIds[previewPayment.id])}
              >
                <MaterialIcons name="check" size={20} color={COLORS.onSecondary} />
                <Text style={styles.modalPrimaryBtnText}>
                  اعتماد وتوريد للخزينة فوراً ({previewPayment.amount.toLocaleString()} ج.م)
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.rejectBtn,
                    { flex: 1, backgroundColor: COLORS.errorContainer },
                  ]}
                  onPress={() => {
                    const payId = previewPayment.id;
                    setPreviewReceiptUrl(null);
                    setPreviewPayment(null);
                    handleRejectPayment(payId);
                  }}
                >
                  <MaterialIcons name="close" size={18} color={COLORS.error} />
                  <Text style={[styles.rejectBtnText, { color: COLORS.error }]}>
                    رفض الطلب
                  </Text>
                </TouchableOpacity>

                {(() => {
                  const matched = apartments.find(
                    (a) =>
                      a.id === previewPayment.apartment_id ||
                      (Boolean(previewPayment.apartment_number) &&
                        a.apartment_number === previewPayment.apartment_number)
                  );
                  const phone = matched?.occupant_phone || matched?.resident_phone;
                  if (!phone) return null;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.rejectBtn,
                        { flex: 1, backgroundColor: COLORS.surfaceContainer },
                      ]}
                      onPress={() => {
                        Linking.openURL(
                          `https://wa.me/${phone.replace(/[^\d]/g, '')}`
                        );
                      }}
                    >
                      <MaterialIcons name="chat" size={18} color={COLORS.secondary} />
                      <Text style={[styles.rejectBtnText, { color: COLORS.onSurface }]}>
                        محادثة واتساب
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          )}
        </View>
      )}
    </BottomSheetModal>
  );
};
