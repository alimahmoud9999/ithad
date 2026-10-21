import React, { useState } from 'react';
import { View, Text, TouchableOpacity, I18nManager, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Apartment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../payments.styles';

interface UnpaidApartmentsSectionProps {
  handleApprovePayment: (paymentId: string) => Promise<void>;
  handleBulkReminder: () => Promise<void>;
}

export const UnpaidApartmentsSection: React.FC<UnpaidApartmentsSectionProps> = ({
  handleApprovePayment,
  handleBulkReminder,
}) => {
  const { currentBuilding, payments, recordDirectCashPayment, sendIndividualUnpaidReminder } = useAppStore();
  const { unpaidApartments } = useAdminDashboardMetrics();

  const [directCashRecordingAptId, setDirectCashRecordingAptId] = useState<
    string | null
  >(null);

  const handleIndividualReminder = async (apt: Apartment) => {
    try {
      await sendIndividualUnpaidReminder(apt.apartment_number);
      Alert.alert(
        'تم إرسال التذكير بنجاح 🔔',
        `تم إرسال إشعار تذكير فوري لساكن شقة (${apt.apartment_number}) بسداد اشتراك الصيانة.`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال التذكير');
    }
  };

  const handleDirectCashForDefaulter = (apt: Apartment) => {
    const dues = apt.unpaid_amount || currentBuilding.default_monthly_dues || 0;
    Alert.alert(
      'تسجيل سداد نقدي (كاش) 💵',
      `هل استلمت مبلغ ${dues.toLocaleString()} ج.م نقداً من شقة (${apt.apartment_number}) - ${apt.resident_name || apt.occupant_name || 'الساكن'}؟\n\nسيتم تحديث حالة الشقة إلى مسدد فوراً وإضافة المبلغ لخزينة العمارة.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد واستلام المبلغ',
          onPress: async () => {
            setDirectCashRecordingAptId(apt.id);
            try {
              await recordDirectCashPayment({
                apartmentId: apt.id,
                apartmentNumber: apt.apartment_number,
                residentId: apt.resident_id,
                residentName: apt.resident_name || apt.occupant_name,
                amount: dues,
                category: 'monthly_dues',
                billingMonth: new Date().toISOString().slice(0, 7),
                notes: 'سداد نقدي مباشر من قائمة المتأخرات',
              });
              Alert.alert(
                'تم بنجاح ✅',
                `تم اعتماد سداد شقة (${apt.apartment_number}) وإضافته للخزينة.`
              );
            } catch (err: any) {
              Alert.alert('تنبيه', err?.message || 'تعذر تسجيل السداد');
            } finally {
              setDirectCashRecordingAptId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.sectionTitle}>الشقق المتأخرة</Text>
          <View style={styles.redCountBadge}>
            <Text style={styles.redCountText}>
              {unpaidApartments.length} شقق
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <Text style={styles.unpaidTotalText}>
            مستحق:{' '}
            {unpaidApartments
              .reduce((sum, a) => sum + (a.unpaid_amount || 400), 0)
              .toLocaleString()}{' '}
            ج.م
          </Text>
          {unpaidApartments.length > 0 && (
            <TouchableOpacity
              style={styles.bulkReminderBtn}
              onPress={handleBulkReminder}
            >
              <MaterialIcons name="notifications-active" size={16} color={COLORS.primary} />
              <Text style={styles.bulkReminderBtnText}>تذكير الكل 🔔</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {unpaidApartments.map((apt) => {
        const pendingForApt = payments.filter(
          (p) =>
            p.status === 'pending' &&
            ((p.apartment_id && p.apartment_id === apt.id) ||
              (p.apartment_number &&
                String(p.apartment_number).trim() === String(apt.apartment_number).trim()))
        );
        const pendingForAptAmount = pendingForApt.reduce((s, p) => s + (Number(p.amount) || 0), 0);

        return (
          <View key={apt.id} style={styles.defaulterCard}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewRightGroup}>
                <View
                  style={[
                    styles.aptBadgeBox,
                    (apt.unpaid_months_count || 1) >= 3 && {
                      backgroundColor: COLORS.errorContainer,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.aptBadgeLabel,
                      (apt.unpaid_months_count || 1) >= 3 && {
                        color: COLORS.error,
                      },
                    ]}
                  >
                    شقة
                  </Text>
                  <Text
                    style={[
                      styles.aptBadgeNumber,
                      (apt.unpaid_months_count || 1) >= 3 && {
                        color: COLORS.error,
                      },
                    ]}
                  >
                    {apt.apartment_number}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.residentNameText}>
                    {apt.resident_name}
                  </Text>
                  <Text
                    style={[
                      styles.delaySubText,
                      {
                        color:
                          (apt.unpaid_months_count || 1) >= 2 || Number(apt.arrears_amount || 0) > 0
                            ? COLORS.statusUnpaid
                            : COLORS.statusPending,
                      },
                    ]}
                  >
                    {(apt.unpaid_months_count || 1) >= 2
                      ? `متأخر ${apt.unpaid_months_count} أشهر`
                      : Number(apt.arrears_amount || 0) > 0
                      ? `متأخرات: ${(Number(apt.arrears_amount) || 0).toLocaleString()} ج.م`
                      : 'اشتراك الشهر الحالي'}
                  </Text>
                  {pendingForAptAmount > 0 && (
                    <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <MaterialIcons name="hourglass-top" size={12} color="#B45309" />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
                        طلب سداد قيد المراجعة: {pendingForAptAmount.toLocaleString()} ج.م ⏳
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.defaulterAmount}>
                {(apt.unpaid_amount || currentBuilding.default_monthly_dues || 400).toLocaleString()} ج.م
              </Text>
            </View>

            <View style={styles.defaulterActionsRow}>
              {pendingForApt.length > 0 ? (
                <TouchableOpacity
                  style={[styles.manualConfirmBtn, { backgroundColor: '#059669', borderColor: '#059669' }]}
                  onPress={() => handleApprovePayment(pendingForApt[0].id)}
                >
                  <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                  <Text style={[styles.manualConfirmText, { color: '#FFFFFF' }]}>
                    اعتماد ({pendingForApt[0].amount} ج.م)
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.whatsappRemindBtn}
                    onPress={() => handleIndividualReminder(apt)}
                  >
                    <MaterialIcons
                      name="notifications"
                      size={16}
                      color={COLORS.onSurface}
                    />
                    <Text style={styles.whatsappRemindText}>إرسال تذكير</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.manualConfirmBtn}
                    onPress={() => handleDirectCashForDefaulter(apt)}
                    disabled={directCashRecordingAptId === apt.id}
                  >
                    {directCashRecordingAptId === apt.id ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <>
                        <MaterialIcons
                          name="payments"
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text style={styles.manualConfirmText}>تسجيل كاش</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};
