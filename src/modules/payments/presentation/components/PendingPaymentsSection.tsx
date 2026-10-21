import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Payment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../payments.styles';

interface PendingPaymentsSectionProps {
  onNavigateExpenses: () => void;
  setPreviewReceiptUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewPayment: React.Dispatch<React.SetStateAction<Payment | null>>;
  handleApprovePayment: (paymentId: string) => Promise<void>;
  handleRejectPayment: (paymentId: string) => void;
}

export const PendingPaymentsSection: React.FC<PendingPaymentsSectionProps> = ({
  onNavigateExpenses,
  setPreviewReceiptUrl,
  setPreviewPayment,
  handleApprovePayment,
  handleRejectPayment,
}) => {
  const { apartments, emergencyClaims, processingIds } = useAppStore();
  const { pendingPayments } = useAdminDashboardMetrics();

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.sectionTitle}>طلبات السداد المعلقة</Text>
          <View style={styles.orangeCountBadge}>
            <View style={styles.orangePingDot} />
            <Text style={styles.orangeCountText}>
              {pendingPayments.length} للمراجعة
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onNavigateExpenses}>
          <Text style={styles.linkText}>سجل الخزينة</Text>
        </TouchableOpacity>
      </View>

      {pendingPayments.length === 0 ? (
        <View style={styles.emptyPendingBox}>
          <MaterialIcons
            name="verified"
            size={26}
            color={COLORS.statusPaid}
          />
          <Text style={styles.emptyPendingText}>
            تمت مراجعة واعتماد جميع طلبات السداد المعلقة بالكامل!
          </Text>
        </View>
      ) : (
        pendingPayments.map((payment) => {
          const isLocked = Boolean(processingIds[payment.id]);
          const matchedApt = apartments.find(
            (a) =>
              a.id === payment.apartment_id ||
              (Boolean(payment.apartment_number) &&
                String(a.apartment_number).trim() ===
                  String(payment.apartment_number).trim())
          );
          const aptNumber =
            payment.apartment_number ||
            matchedApt?.apartment_number ||
            '302';
          const resName =
            payment.resident_name ||
            matchedApt?.occupant_name ||
            matchedApt?.resident_name ||
            'الساكن / المالك';
          const claimObj = payment.emergency_claim_id
            ? emergencyClaims.find((c) => c.id === payment.emergency_claim_id)
            : null;
          const matchObl = payment.notes?.match(/\[سداد بند:\s*(.*?)(?:\s*#|\s*\])/);
          const isArrearsPay = payment.notes?.includes('مديونية');
          const paymentInfoLabel =
            payment.payment_category === 'emergency_claim'
              ? claimObj
                ? `طوارئ: ${claimObj.title}`
                : 'مساهمة طوارئ'
              : matchObl
              ? `سداد بند: ${matchObl[1]}`
              : isArrearsPay
              ? 'سداد مديونية / متأخرات'
              : `اشتراك شهر ${payment.billing_month}`;

          return (
            <View key={payment.id} style={styles.reviewCard}>
              <View style={styles.reviewTopRow}>
                <View style={styles.reviewRightGroup}>
                  <View style={styles.aptBadgeBox}>
                    <Text style={styles.aptBadgeLabel}>شقة</Text>
                    <Text style={styles.aptBadgeNumber}>
                      {aptNumber}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.residentNameText}>
                      {resName}
                    </Text>
                    <View style={styles.paymentMethodLine}>
                      <View style={styles.methodPill}>
                        <Text style={styles.methodPillText}>
                          {payment.payment_method === 'electronic_transfer'
                            ? 'تحويل إنستاباي'
                            : `كاش طرف ${
                                payment.cash_recipient === 'admin'
                                  ? 'رئيس الاتحاد'
                                  : 'الحارس (عم رجب)'
                              }`}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.methodPill,
                          matchObl
                            ? { backgroundColor: '#FEF3C7' }
                            : isArrearsPay
                            ? { backgroundColor: '#FEE2E2' }
                            : { backgroundColor: '#EFF6FF' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.methodPillText,
                            matchObl
                              ? { color: '#B45309', fontWeight: 'bold' }
                              : isArrearsPay
                              ? { color: '#DC2626', fontWeight: 'bold' }
                              : { color: '#1D4ED8' },
                          ]}
                        >
                          {paymentInfoLabel}
                        </Text>
                      </View>
                    </View>
                    {payment.notes ? (
                      <View style={styles.paymentNotesBadge}>
                        <Text style={styles.paymentNotesBadgeText}>
                          📌 {payment.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.paymentAmountText}>
                    {payment.amount.toLocaleString()} ج.م
                  </Text>
                  <Text style={styles.paymentWaitLabel}>بانتظار التأكيد</Text>
                </View>
              </View>

              {/* Receipt Preview Micro Box (if electronic transfer) */}
              {payment.receipt_image_url && (
                <TouchableOpacity
                  style={styles.receiptPreviewBar}
                  onPress={() => {
                    setPreviewPayment(payment);
                    setPreviewReceiptUrl(payment.receipt_image_url || null);
                  }}
                >
                  <View style={styles.receiptPreviewRight}>
                    <Image
                      source={{ uri: payment.receipt_image_url }}
                      style={styles.receiptThumb}
                    />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.receiptRefTitle}>
                        إيصال تحويل رقم {payment.reference_number || '#IP-88421'}
                      </Text>
                      <Text style={styles.receiptRefSub}>
                        انقر لمعاينة الصورة المكبرة
                      </Text>
                    </View>
                  </View>
                  <View style={styles.zoomIconCircle}>
                    <MaterialIcons
                      name="zoom-in"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>
                </TouchableOpacity>
              )}

              {/* Action Buttons with Double-Spend / Idempotency Protection */}
              <View style={styles.reviewButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.approveBtn,
                    isLocked && { opacity: 0.6 },
                  ]}
                  onPress={() => handleApprovePayment(payment.id)}
                  disabled={isLocked}
                >
                  {isLocked ? (
                    <ActivityIndicator size="small" color={COLORS.onSecondary} />
                  ) : (
                    <>
                      <MaterialIcons
                        name="check-circle"
                        size={18}
                        color={COLORS.onSecondary}
                      />
                      <Text style={styles.approveBtnText}>
                        {payment.payment_method === 'cash'
                          ? 'تأكيد استلام المبلغ بالخزينة'
                          : 'اعتماد السداد'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleRejectPayment(payment.id)}
                  disabled={isLocked}
                >
                  <MaterialIcons
                    name="close"
                    size={18}
                    color={COLORS.onSurface}
                  />
                  <Text style={styles.rejectBtnText}>رفض</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
};
