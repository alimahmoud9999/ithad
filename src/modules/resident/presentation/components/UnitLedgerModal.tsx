import React from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { useResidentLedger } from '../../application/useResidentLedger';
import type { ActiveSubView } from '../../domain/resident.types';
import { styles } from '../ResidentHomeScreen.styles';

interface UnitLedgerModalProps {
  activeSubView: ActiveSubView;
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
}

export const UnitLedgerModal: React.FC<UnitLedgerModalProps> = ({
  activeSubView,
  setActiveSubView,
}) => {
  const { currentBuilding, currentUser } = useAppStore();
  const { effectiveArrears, myObligations, myUnitPayments } = useResidentLedger();

  return (
    <Modal
      visible={activeSubView === 'unit_ledger'}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setActiveSubView('none')}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setActiveSubView('none')}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>كشف حساب الوحدة {currentUser.apartment_number || '302'}</Text>
          <TouchableOpacity
            style={styles.exportPdfBtn}
            onPress={() => Alert.alert('تصدير PDF', 'جاري إعداد وتحميل كشف الحساب المعتمد بصيغة PDF...')}
          >
            <MaterialIcons name="download" size={18} color={COLORS.primary} />
            <Text style={styles.exportPdfText}>تقرير PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Unit Identity Card */}
        <View style={styles.formSectionCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.ledgerUnitTitle}>
                شقة {currentUser.apartment_number || '302'} - {currentUser.floor_number || 'الدور الثالث'}
              </Text>
              <Text style={styles.ledgerBldSub}>{currentBuilding.name} • المعادي الجديدة</Text>
            </View>
            <View style={styles.unitNumberBox}>
              <Text style={styles.unitNumberBoxText}>{currentUser.apartment_number || '302'}</Text>
            </View>
          </View>

          <View style={styles.twoColumnGrid}>
            <View style={styles.ledgerMetaBox}>
              <Text style={styles.metaLabelText}>المالك المسجل</Text>
              <Text style={styles.metaValueText}>{currentUser.full_name || 'م. أحمد مصطفى'}</Text>
            </View>
            <View style={styles.ledgerMetaBox}>
              <Text style={styles.metaLabelText}>الحصة بالأرض</Text>
              <Text style={styles.metaValueText}>6.25%</Text>
            </View>
          </View>

          <View style={styles.monthlyDuesNotice}>
            <MaterialIcons name="event-repeat" size={18} color={COLORS.primary} />
            <Text style={styles.monthlyDuesNoticeText}>
              الاشتراك الشهري المعتمد: <Text style={{ fontWeight: '800' }}>{currentBuilding.default_monthly_dues || 400} ج.م / شهر</Text>
            </Text>
          </View>
        </View>

        {/* Ledger Financial Summary Card */}
        <View style={styles.ledgerSummaryCard}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.secondaryContainer} />
              <Text style={styles.ledgerSummaryTitle}>الموقف المالي العام ({new Date().getFullYear()})</Text>
            </View>
            <View style={[styles.settledBadge, effectiveArrears > 0 && { backgroundColor: '#DC2626' }]}>
              <MaterialIcons name={effectiveArrears > 0 ? "error-outline" : "check-circle"} size={14} color="#FFFFFF" />
              <Text style={styles.settledBadgeText}>
                {effectiveArrears > 0 ? 'توجد متأخرات' : 'منتظم ومسدد'}
              </Text>
            </View>
          </View>

          <View style={styles.threeColumnGrid}>
            <View style={styles.summaryMiniBox}>
              <Text style={styles.miniBoxLabel}>إجمالي المسدد</Text>
              <Text style={styles.miniBoxValueGreen}>
                {myUnitPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}
              </Text>
              <Text style={styles.miniBoxCurrency}>ج.م</Text>
            </View>
            <View style={styles.summaryMiniBox}>
              <Text style={styles.miniBoxLabel}>المتأخرات</Text>
              <Text style={[styles.miniBoxValueWhite, effectiveArrears > 0 && { color: '#FCA5A5' }]}>
                {effectiveArrears.toLocaleString()}
              </Text>
              <Text style={styles.miniBoxCurrency}>ج.م</Text>
            </View>
            <View style={styles.summaryMiniBox}>
              <Text style={styles.miniBoxLabel}>صناديق طارئة</Text>
              <Text style={styles.miniBoxValueAmber}>
                {myUnitPayments.filter(p => p.payment_category === 'emergency_claim' && p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}
              </Text>
              <Text style={styles.miniBoxCurrency}>ج.م</Text>
            </View>
          </View>
        </View>

        {/* Itemized Obligations Section in Ledger */}
        {myObligations.length > 0 && (
          <View style={styles.formSectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionHeaderTitle}>بنود المديونيات والالتزامات المسجلة</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                إجمالي المديونية: {effectiveArrears.toLocaleString()} ج.م
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 4 }}>
              {myObligations.map((o) => (
                <View key={o.id} style={styles.ledgerHistoryItem}>
                  <View style={styles.rowAlign}>
                    <View
                      style={[
                        styles.receiptSmallIcon,
                        {
                          backgroundColor: o.status === 'unpaid' ? '#FEE2E2' : '#DCFCE7',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={o.category === 'monthly_dues' ? 'event-repeat' : 'handyman'}
                        size={18}
                        color={o.status === 'unpaid' ? '#DC2626' : '#059669'}
                      />
                    </View>
                    <View>
                      <Text style={styles.historyItemTitle}>{o.title}</Text>
                      <Text style={styles.historyItemDate}>
                        {o.billing_month ? `دورة ${o.billing_month} • ` : ''}
                        {new Date(o.created_at).toLocaleDateString('ar-EG')}
                        {o.transferred_from_apartment_number ? ` • مرحلة من شقة ${o.transferred_from_apartment_number}` : ''}
                      </Text>
                      {o.notes ? (
                        <Text style={{ fontSize: 10, color: COLORS.onSurfaceVariant, marginTop: 2 }}>
                          {o.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.historyAmountText,
                        o.status === 'unpaid' && { color: '#DC2626' },
                      ]}
                    >
                      {o.amount.toLocaleString()} ج.م
                    </Text>
                    <Text
                      style={[
                        styles.historyStatusText,
                        o.status === 'paid' && { color: COLORS.statusPaid },
                        o.status === 'unpaid' && { color: COLORS.statusUnpaid },
                        o.status === 'pending' && { color: COLORS.statusPending },
                      ]}
                    >
                      {o.status === 'paid'
                        ? 'تمت التسوية ✅'
                        : o.status === 'unpaid'
                        ? 'مستحق السداد 🔴'
                        : 'قيد المراجعة ⏳'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment History Log */}
        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>سجل الحركات والإيصالات السابقة</Text>
          {myUnitPayments.length > 0 ? (
            myUnitPayments.map((p) => (
              <View key={p.id} style={styles.ledgerHistoryItem}>
                <View style={styles.rowAlign}>
                  <View style={styles.receiptSmallIcon}>
                    <MaterialIcons name="receipt" size={18} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.historyItemTitle}>
                      {p.payment_category === 'emergency_claim'
                        ? 'مساهمة صيانة طارئة'
                        : p.notes?.includes('[سداد بند:')
                        ? `سداد بند: ${p.notes.match(/\[سداد بند:\s*(.*?)(?:\s*#|\s*\])/)?.[1] || 'التزام محدد'}`
                        : p.notes?.includes('مديونية')
                        ? 'سداد مديونية / متأخرات'
                        : `اشتراك شهر ${p.billing_month || '-'}`}
                    </Text>
                    <Text style={styles.historyItemDate}>{new Date(p.created_at).toLocaleDateString('ar-EG')}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.historyAmountText}>{p.amount} ج.م</Text>
                  <Text
                    style={[
                      styles.historyStatusText,
                      p.status === 'paid' && { color: COLORS.statusPaid },
                      p.status === 'pending' && { color: COLORS.statusPending },
                    ]}
                  >
                    {p.status === 'paid' ? 'معتمد' : 'قيد المراجعة'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant }}>
                لم يتم تسجيل عمليات سداد سابقة لهذه الوحدة بعد.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
};
