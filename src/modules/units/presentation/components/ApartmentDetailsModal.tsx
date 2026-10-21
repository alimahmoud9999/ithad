import React, { useMemo } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, Linking, I18nManager, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { ApartmentObligation, Apartment } from '@/shared/types/database';
import { copyToClipboard } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import type { useArrearsForm } from '../../application/useArrearsForm';
import type { useEditObligationForm } from '../../application/useEditObligationForm';
import type { useEditUnitForm } from '../../application/useEditUnitForm';
import { useUnitFinancials } from '../../application/useUnitFinancials';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface ApartmentDetailsModalProps {
  editOblForm: ReturnType<typeof useEditObligationForm>;
  detailModalVisible: boolean;
  setDetailModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDetailApt: Apartment | null;
  editUnitForm: ReturnType<typeof useEditUnitForm>;
  arrearsForm: ReturnType<typeof useArrearsForm>;
}

export const ApartmentDetailsModal: React.FC<ApartmentDetailsModalProps> = ({
  editOblForm,
  detailModalVisible,
  setDetailModalVisible,
  selectedDetailApt,
  editUnitForm,
  arrearsForm,
}) => {
  const { apartments, approveResidentPayment, currentBuilding, deleteApartmentObligation, payments, recordDirectCashPayment, settleApartmentObligation } = useAppStore();
  const { openEditObligationModal } = editOblForm;
  const { openEditModal } = editUnitForm;
  const { openArrearsModal } = arrearsForm;
  const { getApartmentFinancials } = useUnitFinancials();

  // Fresh resolution of selected detail apartment
  const activeDetailApt = useMemo(() => {
    if (!selectedDetailApt) return null;
    return (
      apartments.find(
        (a) =>
          a.id === selectedDetailApt.id ||
          String(a.apartment_number).trim() ===
            String(selectedDetailApt.apartment_number).trim()
      ) || selectedDetailApt
    );
  }, [apartments, selectedDetailApt]);

  // Delete an existing obligation from Apartment Details (Modal 5)
  const handleDeleteObligation = (obl: ApartmentObligation) => {
    Alert.alert(
      'حذف بند المديونية',
      `هل أنت متأكد من حذف (${obl.title}) بمبلغ (${obl.amount.toLocaleString()} ج.م) نهائياً من سجل مديونيات هذه الشقة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteApartmentObligation(obl.id);
              Alert.alert('تم الحذف بنجاح 🗑️', 'تم حذف بند المديونية وتحديث رصيد الشقة.');
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف المديونية');
            }
          },
        },
      ]
    );
  };

  return (
    activeDetailApt && (
    <Modal
      visible={detailModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setDetailModalVisible(false)}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        {/* Top Back Bar */}
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setDetailModalVisible(false)}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>
            تفاصيل شقة {activeDetailApt.apartment_number}
          </Text>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => {
              setDetailModalVisible(false);
              openEditModal(activeDetailApt);
            }}
          >
            <MaterialIcons name="edit" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Apartment Hero Specs Card */}
        {(() => {
          const f = getApartmentFinancials(activeDetailApt);
          const residentPhoneNum = activeDetailApt.occupant_phone || activeDetailApt.resident_phone || '';
          const detailAptPayments = payments.filter(
            (p) =>
              (Boolean(p.apartment_id) && p.apartment_id === activeDetailApt.id) ||
              (Boolean(p.apartment_number) &&
                String(p.apartment_number).trim() === String(activeDetailApt.apartment_number).trim())
          );

          return (
            <>
              <View style={styles.unitDetailHeroCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowAlign}>
                    <View
                      style={[
                        styles.unitNumberBoxBig,
                        { width: 48, height: 48, borderRadius: 12 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitNumberBoxBigText,
                          { fontSize: 18 },
                        ]}
                      >
                        {activeDetailApt.apartment_number}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.detailCardResidentName}>
                        {activeDetailApt.occupant_name || activeDetailApt.resident_name || 'وحدة شاغرة'}
                      </Text>
                      <Text style={styles.detailCardMetaSub}>
                        {activeDetailApt.floor_number || 'الدور الأول'} • {activeDetailApt.wing_or_direction || 'واجهة'} • {activeDetailApt.area_sqm || 160} م²
                      </Text>
                    </View>
                  </View>

                  {/* Financial Status Badge */}
                  <View
                    style={[
                      styles.statusPillBadge,
                      f.hasDebt && { backgroundColor: '#FEE2E2' },
                      !f.hasDebt && f.isPaid && { backgroundColor: '#ECFDF5' },
                      !f.hasDebt && f.isPending && { backgroundColor: '#FFF7ED' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillBadgeText,
                        f.hasDebt && { color: '#DC2626', fontWeight: '800' },
                        !f.hasDebt && f.isPaid && { color: '#047857' },
                        !f.hasDebt && f.isPending && { color: '#C2410C' },
                      ]}
                    >
                      {f.hasDebt
                        ? `مديونية: ${f.effectiveArrears.toLocaleString()} ج.م`
                        : f.isPending
                        ? 'إيصال معلق'
                        : f.isPaid
                        ? 'مسدد بالكامل'
                        : 'متأخر'}
                    </Text>
                  </View>
                </View>

                {/* Direct Contact Bar */}
                {residentPhoneNum ? (
                  <View style={styles.contactBarRow}>
                    <TouchableOpacity
                      style={styles.contactBtnPill}
                      onPress={() => Linking.openURL(`tel:${residentPhoneNum}`)}
                    >
                      <MaterialIcons name="call" size={16} color="#0F172A" />
                      <Text style={[styles.contactBtnPillText, { color: '#0F172A' }]}>اتصال: {residentPhoneNum}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.contactBtnPill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                      onPress={() => {
                        const clean = residentPhoneNum.replace(/^0+/, '');
                        Linking.openURL(`https://wa.me/20${clean}`);
                      }}
                    >
                      <MaterialIcons name="chat" size={16} color="#059669" />
                      <Text style={[styles.contactBtnPillText, { color: '#059669' }]}>واتساب</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Invite Code Row */}
                <View style={styles.inviteCodeRowBox}>
                  <Text style={styles.inviteCodeLabel}>كود دعوة الشقة:</Text>
                  <Text style={styles.inviteCodeValue}>
                    {activeDetailApt.invite_code || `${currentBuilding.building_code}-${activeDetailApt.apartment_number}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyInviteBtn}
                    onPress={() => copyToClipboard(
                      activeDetailApt.invite_code || `${currentBuilding.building_code}-${activeDetailApt.apartment_number}`,
                      'كود الشقة'
                    )}
                  >
                    <MaterialIcons name="content-copy" size={15} color="#4338CA" />
                    <Text style={styles.copyInviteBtnText}>نسخ</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Financial Overview Card */}
              <View style={styles.formSectionCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowAlign}>
                    <MaterialIcons name="account-balance" size={18} color="#0F172A" />
                    <Text style={styles.sectionHeaderTitle}>الموقف المالي الإجمالي للشقة</Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: f.totalDueAmount > 0 ? '#DC2626' : '#059669',
                    }}
                  >
                    {f.totalDueAmount > 0
                      ? `المستحق: ${f.totalDueAmount.toLocaleString()} ج.م`
                      : 'رصيد منتظم (0 ج.م)'}
                  </Text>
                </View>

                <View style={styles.threeColumnGrid}>
                  <View style={styles.calmMetricTile}>
                    <Text style={styles.calmTileLabel}>المديونيات المسجلة</Text>
                    <Text
                      style={[
                        styles.calmTileAmount,
                        f.effectiveArrears > 0 && { color: '#DC2626' },
                      ]}
                    >
                      {f.effectiveArrears.toLocaleString()} ج.م
                    </Text>
                  </View>

                  <View style={styles.calmMetricTile}>
                    <Text style={styles.calmTileLabel}>اشتراك الشهر</Text>
                    <Text
                      style={[
                        styles.calmTileAmount,
                        f.isPaid && { color: '#059669' },
                      ]}
                    >
                      {f.isPaid ? '0.00 ج.م' : `${f.monthlyDues.toLocaleString()} ج.م`}
                    </Text>
                  </View>

                  <View style={styles.calmMetricTile}>
                    <Text style={styles.calmTileLabel}>إجمالي المطلوب</Text>
                    <Text
                      style={[
                        styles.calmTileAmount,
                        f.totalDueAmount > 0 ? { color: '#DC2626' } : { color: '#059669' },
                      ]}
                    >
                      {f.totalDueAmount.toLocaleString()} ج.م
                    </Text>
                  </View>
                </View>

                {/* Pending Review Banner with direct Approve button */}
                {f.pendingAmount > 0 && (
                  <View style={styles.unitPendingBannerBox}>
                    <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                        <MaterialIcons name="hourglass-top" size={20} color="#B45309" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E', textAlign: I18nManager.isRTL ? 'left' : 'right' }}>
                            يوجد طلب سداد معلق بقيمة {f.pendingAmount.toLocaleString()} ج.م بانتظار الاعتماد ⏳
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#B45309', marginTop: 2, textAlign: I18nManager.isRTL ? 'left' : 'right' }}>
                            الصافي المطلوب بعد الاعتماد: {Math.max(0, f.totalDueAmount - f.pendingAmount).toLocaleString()} ج.م
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.approveNowBtn}
                        onPress={async () => {
                          try {
                            for (const p of f.unitPendingPayments) {
                              await approveResidentPayment(p.id);
                            }
                            Alert.alert('تم الاعتماد بنجاح ✅', 'تم اعتماد السداد وخصم المبلغ وتحديث سجلات الشقة فوراً.');
                          } catch (err: any) {
                            Alert.alert('خطأ أثناء الاعتماد', err?.message || 'تعذر اعتماد السداد');
                          }
                        }}
                      >
                        <MaterialIcons name="check" size={15} color="#FFFFFF" />
                        <Text style={styles.approveNowBtnText}>اعتماد السداد</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Obligations List Section */}
              <View style={styles.formSectionCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowAlign}>
                    <MaterialIcons name="format-list-bulleted" size={18} color="#0F172A" />
                    <Text style={styles.sectionHeaderTitle}>
                      سجل المديونيات والالتزامات ({f.aptObls.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.smallAddObligationBtn}
                    onPress={() => {
                      setDetailModalVisible(false);
                      openArrearsModal(activeDetailApt);
                    }}
                  >
                    <MaterialIcons name="add" size={16} color="#0F172A" />
                    <Text style={styles.smallAddObligationBtnText}>قيد مديونية</Text>
                  </TouchableOpacity>
                </View>

                {f.aptObls.length === 0 ? (
                  <View style={styles.emptyObligationsBox}>
                    <MaterialIcons name="check-circle-outline" size={28} color="#059669" />
                    <Text style={styles.emptyObligationsTitle}>
                      لا توجد مديونيات مسجلة على هذه الشقة
                    </Text>
                    <Text style={styles.emptyObligationsSub}>
                      رصيد الشقة سليم ومنتظم بالكامل ولا توجد أي التزامات سابقة مقيدة.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {f.aptObls.map((o) => {
                      const isUnpaid = o.status === 'unpaid';
                      return (
                        <View
                          key={o.id}
                          style={[
                            styles.obligationDetailCard,
                            isUnpaid && styles.obligationDetailCardUnpaid,
                          ]}
                        >
                          <View style={styles.rowBetween}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.obligationDetailTitle}>{o.title}</Text>
                              <Text style={styles.obligationDetailSub}>
                                عن شهر: {o.billing_month} • تاريخ القيد: {new Date(o.created_at).toLocaleDateString('ar-EG')}
                              </Text>
                              {o.transferred_from_apartment_number && (
                                <Text style={styles.transferredTagText}>
                                  (تم نقل هذا الالتزام من شقة {o.transferred_from_apartment_number})
                                </Text>
                              )}
                              {o.notes && (
                                <Text style={styles.obligationNotesText}>
                                  ملاحظة: {o.notes}
                                </Text>
                              )}
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text
                                style={[
                                  styles.obligationDetailAmount,
                                  isUnpaid && { color: '#DC2626' },
                                ]}
                              >
                                {o.amount.toLocaleString()} ج.م
                              </Text>
                              <View
                                style={[
                                  styles.statusPillBadge,
                                  isUnpaid
                                    ? { backgroundColor: '#FEE2E2' }
                                    : { backgroundColor: '#D1FAE5' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusPillBadgeText,
                                    isUnpaid
                                      ? { color: '#DC2626', fontWeight: '700' }
                                      : { color: '#047857' },
                                  ]}
                                >
                                  {isUnpaid ? 'غير مسدد ⚠️' : 'تم السداد ✅'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Actions Row: Edit, Delete, Settle */}
                          <View style={styles.obligationActionsRow}>
                            <TouchableOpacity
                              style={styles.obligationEditBtn}
                              onPress={() => openEditObligationModal(o)}
                            >
                              <MaterialIcons name="edit" size={13} color="#2563EB" />
                              <Text style={styles.obligationEditBtnText}>تعديل</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.obligationDeleteBtn}
                              onPress={() => handleDeleteObligation(o)}
                            >
                              <MaterialIcons name="delete-outline" size={13} color="#DC2626" />
                              <Text style={styles.obligationDeleteBtnText}>حذف</Text>
                            </TouchableOpacity>

                            {isUnpaid && (
                              <TouchableOpacity
                                style={styles.settleObligationBtn}
                                onPress={() => {
                                  Alert.alert(
                                    'تسوية وسداد المديونية',
                                    `هل تم سداد مبلغ (${o.amount.toLocaleString()} ج.م) الخاص بـ (${o.title}) نقداً لرئيس الاتحاد؟`,
                                    [
                                      { text: 'إلغاء', style: 'cancel' },
                                      {
                                        text: 'نعم، تم استلام المبلغ ✅',
                                        onPress: async () => {
                                          try {
                                            await settleApartmentObligation(o.id, 'تم السداد نقداً لرئيس الاتحاد');
                                            Alert.alert('تمت التسوية بنجاح 🎉', 'تم تحديث رصيد الشقة وتسوية المديونية.');
                                          } catch (err: any) {
                                            Alert.alert('خطأ', err?.message || 'تعذر تسوية المديونية');
                                          }
                                        },
                                      },
                                    ]
                                  );
                                }}
                              >
                                <View style={{ flexDirection: 'row', gap: 4 }}> 
                                <Text style={styles.settleObligationBtnText}>
                                  تسجيل سداد كاش
                                </Text>
                                  <MaterialIcons name="done-all" size={13} color="#059669"  />
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Payment History Section */}
              <View style={styles.formSectionCard}>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="history" size={18} color={COLORS.primary} />
                  <Text style={styles.sectionHeaderTitle}>
                    سجل عمليات السداد والإيصالات ({detailAptPayments.length})
                  </Text>
                </View>

                {detailAptPayments.length === 0 ? (
                  <Text style={styles.emptyObligationsSub}>
                    لم يتم تسجيل أي عمليات سداد أو إيصالات لهذه الشقة بعد.
                  </Text>
                ) : (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {detailAptPayments.map((p) => (
                      <View key={p.id} style={styles.paymentHistoryRow}>
                        <View>
                          <Text style={styles.paymentHistoryTitle}>
                            {p.payment_category === 'emergency_claim'
                              ? 'مساهمة صيانة طارئة'
                              : p.notes?.includes('[سداد بند:')
                              ? `سداد بند: ${p.notes.match(/\[سداد بند:\s*(.*?)(?:\s*#|\s*\])/)?.[1] || 'التزام محدد'}`
                              : p.notes?.includes('مديونية')
                              ? 'سداد مديونية / متأخرات'
                              : `اشتراك شهر ${p.billing_month}`}
                          </Text>
                          <Text style={styles.paymentHistorySub}>
                            {p.payment_method === 'cash' ? 'سداد نقدي (كاش)' : 'تحويل إلكتروني / إنستاباي'} • {new Date(p.created_at).toLocaleDateString('ar-EG')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.paymentHistoryAmount}>
                            {p.amount.toLocaleString()} ج.م
                          </Text>
                          <Text
                            style={[
                              styles.paymentHistoryStatus,
                              p.status === 'paid' && { color: '#059669' },
                              p.status === 'pending' && { color: '#D97706' },
                              p.status === 'rejected' && { color: '#DC2626' },
                            ]}
                          >
                            {p.status === 'paid'
                              ? 'معتمد ✅'
                              : p.status === 'pending'
                              ? 'قيد المراجعة ⏳'
                              : 'مرفوض ❌'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Quick Action Footer in Details Modal */}
              <View style={{ gap: 8, marginTop: 4, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.primaryActionButton, { backgroundColor: '#B45309' }]}
                  activeOpacity={0.88}
                  onPress={() => {
                    setDetailModalVisible(false);
                    openArrearsModal(activeDetailApt);
                  }}
                >
                  <MaterialIcons name="post-add" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>+ قيد مديونية جديدة على الشقة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
                  activeOpacity={0.88}
                  onPress={() => {
                    Alert.prompt
                      ? Alert.prompt(
                          'تسجيل سداد نقدي (كاش)',
                          `أدخل المبلغ المسلم لرئيس الاتحاد لشقة ${activeDetailApt.apartment_number}:`,
                          async (val) => {
                            const num = parseFloat(val);
                            if (!num || num <= 0) return;
                            try {
                              await recordDirectCashPayment({
                                apartmentId: activeDetailApt.id,
                                apartmentNumber: activeDetailApt.apartment_number,
                                residentName: activeDetailApt.occupant_name || activeDetailApt.resident_name,
                                amount: num,
                                category: 'monthly_dues',
                                billingMonth: new Date().toISOString().slice(0, 7),
                              });
                              Alert.alert('تم التسجيل بنجاح 🎉', `تم إيداع مبلغ (${num} ج.م) في خزينة الصندوق.`);
                            } catch (err: any) {
                              Alert.alert('خطأ', err?.message || 'تعذر تسجيل السداد');
                            }
                          },
                          'plain-text',
                          String(currentBuilding.default_monthly_dues || 400),
                          'numeric'
                        )
                      : Alert.alert('تنبيه', 'يرجى تسجيل السداد من شاشة الخزينة أو التحصيل.');
                  }}
                >
                  <MaterialIcons name="monetization-on" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>💵 تسجيل سداد نقدي مباشر (كاش)</Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}
      </ScrollView>
    </Modal>
    )
  ) || null;
};
