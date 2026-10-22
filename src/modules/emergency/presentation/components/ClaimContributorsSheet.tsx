import React, { useState } from 'react';
import { Linking, Alert, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Payment, Apartment, EmergencyClaim } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../emergency.styles';

interface ClaimContributorsSheetProps {
  selectedClaimForDetails: EmergencyClaim | null;
  setSelectedClaimForDetails: React.Dispatch<React.SetStateAction<EmergencyClaim | null>>;
}

export const ClaimContributorsSheet: React.FC<ClaimContributorsSheetProps> = ({
  selectedClaimForDetails,
  setSelectedClaimForDetails,
}) => {
  const { currentBuilding, payments, recordDirectCashPayment } = useAppStore();
  const { buildingApartments } = useAdminDashboardMetrics();

  const [detailsFilter, setDetailsFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [cashRecordingAptId, setCashRecordingAptId] = useState<string | null>(null);

  return (
    <BottomSheetModal
      visible={Boolean(selectedClaimForDetails)}
      title={
        selectedClaimForDetails
          ? `تفاصيل سداد: ${selectedClaimForDetails.title}`
          : ''
      }
      subtitle={
        selectedClaimForDetails
          ? `المستهدف: ${selectedClaimForDetails.target_amount.toLocaleString()} ج.م • نصيب الشقة: ${selectedClaimForDetails.default_share_amount?.toLocaleString() ?? 0} ج.م`
          : ''
      }
      onClose={() => setSelectedClaimForDetails(null)}
    >
      {selectedClaimForDetails && (() => {
        const approvedClaimPayments = payments.filter(
          (p) =>
            p.emergency_claim_id === selectedClaimForDetails.id &&
            p.status === 'paid'
        );
        const actualCollected = Math.max(
          selectedClaimForDetails.collected_amount,
          approvedClaimPayments.reduce((acc, p) => acc + p.amount, 0)
        );
        const pct = Math.min(
          100,
          Math.round(
            (actualCollected /
              Math.max(selectedClaimForDetails.target_amount, 1)) *
              100
          )
        );
        const remainingAmount = Math.max(
          0,
          selectedClaimForDetails.target_amount - actualCollected
        );

        const paidMap: Record<string, Payment> = {};
        for (const p of approvedClaimPayments) {
          if (p.apartment_number) {
            paidMap[p.apartment_number] = p;
          }
        }

        const paidList = buildingApartments.filter((a) =>
          Boolean(paidMap[a.apartment_number])
        );
        const unpaidList = buildingApartments.filter(
          (a) => !paidMap[a.apartment_number]
        );

        const displayList =
          detailsFilter === 'paid'
            ? paidList
            : detailsFilter === 'unpaid'
            ? unpaidList
            : buildingApartments;

        const handleWhatsAppReminder = (apt: Apartment) => {
          const rawPhone = apt.resident_phone || apt.occupant_phone || '';
          const clean = rawPhone.replace(/[^0-9]/g, '');
          const intlPhone = clean.startsWith('0')
            ? '20' + clean.slice(1)
            : clean.length === 10
            ? '20' + clean
            : clean;

          const text = encodeURIComponent(
            `السلام عليكم ورحمة الله، أ/ ${
              apt.resident_name || apt.occupant_name || 'الجار العزيز'
            }\nتحية طيبة من مجلس اتحاد ملاك ${currentBuilding.name}.\n\nنود تذكير سيادتكم بمساهمة الصيانة الطارئة (${
              selectedClaimForDetails.title
            }) المقررة لشقة (${apt.apartment_number}) وقيمتها (${
              selectedClaimForDetails.default_share_amount ?? 0
            } ج.م).\nشاكرين ومقدرين حسن تعاونكم وحرصكم الدائم على صيانة عقارنا المشترك.`
          );
          Linking.openURL(`https://wa.me/${intlPhone}?text=${text}`);
        };

        const handleDirectCashRecord = (apt: Apartment) => {
          const share = selectedClaimForDetails.default_share_amount || 0;
          Alert.alert(
            'تسجيل سداد نقدي (كاش) 💵',
            `هل تم استلام مبلغ ${share.toLocaleString()} ج.م نقداً من شقة (${apt.apartment_number})؟ سيتم تحديث حالة الشقة إلى مسدد فوراً وإضافة المبلغ لخزينة العمارة.`,
            [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'تأكيد الاستلام',
                onPress: async () => {
                  setCashRecordingAptId(apt.id);
                  try {
                    await recordDirectCashPayment({
                      apartmentId: apt.id,
                      apartmentNumber: apt.apartment_number,
                      residentId: apt.resident_id,
                      residentName: apt.resident_name || apt.occupant_name,
                      amount: share,
                      category: 'emergency_claim',
                      emergencyClaimId: selectedClaimForDetails.id,
                      billingMonth: new Date().toISOString().slice(0, 7),
                      notes: `سداد نقدي مباشر لمطالبة: ${selectedClaimForDetails.title}`,
                    });
                    Alert.alert(
                      'تم تسجيل السداد بنجاح ✅',
                      `تم اعتماد مساهمة شقة (${apt.apartment_number}) وإضافتها رسمياً لخزينة العمارة.`
                    );
                  } catch (err: any) {
                    Alert.alert('تنبيه', err?.message || 'تعذر تسجيل السداد');
                  } finally {
                    setCashRecordingAptId(null);
                  }
                },
              },
            ]
          );
        };

        const modalShareAmount =
          selectedClaimForDetails.default_share_amount ||
          Math.round(
            selectedClaimForDetails.target_amount /
              (buildingApartments.length || currentBuilding.total_apartments)
          );

        return (
          <View style={{ gap: 14 }}>
            {/* Header Stats Box (Matching Original Design Progress Bar) */}
            <View style={styles.modalProgressHeaderBox}>
              <View style={styles.progressLabelsRow}>
                <Text style={styles.progressSummaryText}>
                  تم جمع{' '}
                  <Text
                    style={{ fontWeight: '700', color: COLORS.onSurface }}
                  >
                    {actualCollected.toLocaleString()} ج.م
                  </Text>{' '}
                  من أصل {selectedClaimForDetails.target_amount.toLocaleString()} ج.م
                </Text>
                <Text style={styles.progressPercentText}>{pct}% مكتمل</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[styles.progressBarFill, { width: `${pct}%` }]}
                />
              </View>
              <View style={styles.modalProgressSubRow}>
                <Text style={styles.modalProgressSubText}>
                  المتبقي:{' '}
                  <Text
                    style={{
                      fontWeight: '700',
                      color: COLORS.statusUnpaidText,
                    }}
                  >
                    {remainingAmount.toLocaleString()} ج.م
                  </Text>
                </Text>
                <Text style={styles.modalProgressSubText}>
                  نصيب الوحدة:{' '}
                  <Text
                    style={{ fontWeight: '700', color: COLORS.onSurface }}
                  >
                    {modalShareAmount.toLocaleString()} ج.م
                  </Text>
                </Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.detailsTabRow}>
              <TouchableOpacity
                style={[
                  styles.detailsTabBtn,
                  detailsFilter === 'all' && styles.detailsTabBtnActive,
                ]}
                onPress={() => setDetailsFilter('all')}
              >
                <Text
                  style={[
                    styles.detailsTabBtnText,
                    detailsFilter === 'all' && styles.detailsTabBtnTextActive,
                  ]}
                >
                  الكل ({buildingApartments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.detailsTabBtn,
                  detailsFilter === 'paid' && styles.detailsTabBtnActive,
                ]}
                onPress={() => setDetailsFilter('paid')}
              >
                <Text
                  style={[
                    styles.detailsTabBtnText,
                    detailsFilter === 'paid' &&
                      styles.detailsTabBtnTextActive,
                  ]}
                >
                  من دفع ({paidList.length}) ✅
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.detailsTabBtn,
                  detailsFilter === 'unpaid' && styles.detailsTabBtnActive,
                ]}
                onPress={() => setDetailsFilter('unpaid')}
              >
                <Text
                  style={[
                    styles.detailsTabBtnText,
                    detailsFilter === 'unpaid' &&
                      styles.detailsTabBtnTextActive,
                  ]}
                >
                  لم يدفع ({unpaidList.length}) ⏳
                </Text>
              </TouchableOpacity>
            </View>

            {/* Units List */}
            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              {displayList.map((apt) => {
                const payment = paidMap[apt.apartment_number];
                const isPaid = Boolean(payment);
                const isRecording = cashRecordingAptId === apt.id;

                return (
                  <View key={apt.id} style={styles.aptItemCard}>
                    <View style={styles.aptItemTop}>
                      <View style={styles.aptNumberBadge}>
                        <Text style={styles.aptNumberBadgeText}>
                          شقة {apt.apartment_number}
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          alignItems: 'flex-end',
                          marginHorizontal: 8,
                        }}
                      >
                        <Text style={styles.aptResidentName}>
                          {apt.resident_name ||
                            apt.occupant_name ||
                            'وحدة شاغرة'}
                        </Text>
                        <Text style={styles.aptPaymentInfo}>
                          {isPaid
                            ? `تم سداد ${payment.amount.toLocaleString()} ج.م • (${
                                payment.payment_method === 'cash'
                                  ? 'نقدي كاش'
                                  : 'تحويل إلكتروني'
                              })`
                            : `المطلوب: ${(
                                selectedClaimForDetails.default_share_amount ??
                                0
                              ).toLocaleString()} ج.م`}
                        </Text>
                      </View>
                      <StatusBadge
                        status={isPaid ? 'paid' : 'unpaid'}
                        customLabel={isPaid ? 'تم السداد' : 'مستحق'}
                      />
                    </View>

                    {!isPaid && (
                      <View style={styles.aptActionsRow}>
                        <TouchableOpacity
                          style={styles.whatsappReminderBtn}
                          onPress={() => handleWhatsAppReminder(apt)}
                        >
                          <MaterialIcons
                            name="chat"
                            size={16}
                            color="#FFFFFF"
                          />
                          <Text style={styles.whatsappReminderBtnText}>
                            تذكير واتساب
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.recordCashBtn}
                          onPress={() => handleDirectCashRecord(apt)}
                          disabled={isRecording}
                        >
                          {isRecording ? (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.onSecondaryContainer}
                            />
                          ) : (
                            <>
                              <MaterialIcons
                                name="payments"
                                size={16}
                                color={COLORS.onSecondaryContainer}
                              />
                              <Text style={styles.recordCashBtnText}>
                                تسجيل كاش
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        );
      })()}
    </BottomSheetModal>
  );
};
