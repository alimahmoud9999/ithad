import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useResidentLedger } from '../../application/useResidentLedger';
import type { ApartmentObligation } from '@/shared/types/database';
import { styles } from '../ResidentHomeScreen.styles';

interface ArrearsCardProps {
  openArrearsPaymentSheet: (amount?: number, isPartial?: boolean) => void;
  openObligationPaymentSheet: (obligation: ApartmentObligation) => void;
}

export const ArrearsCard: React.FC<ArrearsCardProps> = ({
  openArrearsPaymentSheet,
  openObligationPaymentSheet,
}) => {
  const { effectiveArrears, myActiveObligations, myUnpaidObligations, totalPendingArrearsAmount } = useResidentLedger();

  return (
    (effectiveArrears > 0 || myActiveObligations.length > 0) && (
    <View style={styles.residentArrearsCard}>
      {/* Header */}
      <View style={styles.arrearsMainHeader}>
        <View style={styles.arrearsMainHeaderRight}>
          <View
            style={[
              styles.arrearsAlertIconBox,
              totalPendingArrearsAmount > 0 && { backgroundColor: '#FEF3C7' },
            ]}
          >
            <MaterialIcons
              name={totalPendingArrearsAmount > 0 ? 'hourglass-top' : 'error-outline'}
              size={22}
              color={totalPendingArrearsAmount > 0 ? '#B45309' : '#DC2626'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.residentArrearsTitle} numberOfLines={1}>
              سجل المديونيات والالتزامات المستحقة
            </Text>
            <Text style={styles.residentArrearsSub} numberOfLines={1}>
              {totalPendingArrearsAmount > 0
                ? `طلب سداد (${totalPendingArrearsAmount.toLocaleString()} ج.م) قيد المراجعة ⏳`
                : myUnpaidObligations.length > 0
                ? `يوجد ${myUnpaidObligations.length} بند مطلوب سداده`
                : myActiveObligations.some((o) => o.status === 'pending')
                ? 'يوجد بنود قيد مراجعة واعتماد الإدارة ⏳'
                : 'مديونية مسجلة على الوحدة بالاتحاد'}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={styles.arrearsTotalBadge}>
            <Text style={styles.arrearsTotalBadgeText}>
              {effectiveArrears.toLocaleString()} ج.م
            </Text>
          </View>
          {totalPendingArrearsAmount > 0 && (
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>
              المتبقي: {Math.max(0, effectiveArrears - totalPendingArrearsAmount).toLocaleString()} ج.م
            </Text>
          )}
        </View>
      </View>

      {/* Pending Arrears Banner */}
      {totalPendingArrearsAmount > 0 && (
        <View style={styles.arrearsPendingBanner}>
          <MaterialIcons name="hourglass-top" size={18} color="#B45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.arrearsPendingBannerTitle}>
              يوجد طلب سداد بقيمة {totalPendingArrearsAmount.toLocaleString()} ج.م قيد المراجعة لدى رئيس الاتحاد ⏳
            </Text>
            <Text style={styles.arrearsPendingBannerSub}>
              المتبقي المتوقع بعد الاعتماد: {Math.max(0, effectiveArrears - totalPendingArrearsAmount).toLocaleString()} ج.م
            </Text>
          </View>
        </View>
      )}

      {/* Obligations Breakdown List */}
      <View style={{ gap: 10, marginTop: 4 }}>
        {myActiveObligations.length > 0 ? (
          myActiveObligations.map((o, idx) => (
            <View
              key={o.id || String(idx)}
              style={[
                styles.residentObligationItem,
                o.status === 'unpaid' && styles.residentObligationItemUnpaid,
                o.status === 'pending' && styles.residentObligationItemPending,
              ]}
            >
              {o.status === 'pending' && (
                <View style={styles.obligationPendingOverlayBanner}>
                  <MaterialIcons name="hourglass-top" size={13} color="#B45309" />
                  <Text style={styles.obligationPendingOverlayText}>
                    تم تقديم طلب السداد • قيد مراجعة واعتماد رئيس الاتحاد ⏳
                  </Text>
                </View>
              )}

              {/* Top Row: Icon + Title on Right, Amount on Left */}
              <View style={styles.obligationItemTopRow}>
                <View style={styles.obligationItemTitleBox}>
                  <View
                    style={[
                      styles.obligationTypeIcon,
                      o.category === 'monthly_dues'
                        ? { backgroundColor: '#EFF6FF' }
                        : { backgroundColor: '#FEF3C7' },
                    ]}
                  >
                    <MaterialIcons
                      name={o.category === 'monthly_dues' ? 'event-repeat' : 'handyman'}
                      size={18}
                      color={o.category === 'monthly_dues' ? '#2563EB' : '#D97706'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.residentObligationTitle}>
                      {o.title}
                    </Text>
                    <View style={styles.obligationMetaRow}>
                      <View
                        style={[
                          styles.obligationCategoryTag,
                          o.category === 'monthly_dues'
                            ? { backgroundColor: '#DBEAFE' }
                            : { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.obligationCategoryTagText,
                            o.category === 'monthly_dues'
                              ? { color: '#1D4ED8' }
                              : { color: '#B91C1C' },
                          ]}
                        >
                          {o.category === 'monthly_dues' ? 'اشتراك عمارة' : 'بند مخصص'}
                        </Text>
                      </View>
                      {o.billing_month ? (
                        <Text style={styles.residentObligationMeta}>
                          دورة: شهر {o.billing_month}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.obligationAmountBox}>
                  <Text style={styles.residentObligationAmount}>
                    {o.amount.toLocaleString()}
                  </Text>
                  <Text style={styles.residentObligationCurrency}>ج.م</Text>
                </View>
              </View>

              {/* Middle Notes or Transferred Info */}
              {(Boolean(o.notes) || Boolean(o.transferred_from_apartment_number)) && (
                <View style={styles.obligationNoteCallout}>
                  {o.transferred_from_apartment_number ? (
                    <View style={styles.obligationNoteLine}>
                      <MaterialIcons name="swap-horiz" size={13} color="#D97706" />
                      <Text style={styles.transferredTagSmall}>
                        مرحّلة من شقة {o.transferred_from_apartment_number}
                      </Text>
                    </View>
                  ) : null}
                  {o.notes ? (
                    <View style={styles.obligationNoteLine}>
                      <MaterialIcons name="info-outline" size={13} color="#64748B" />
                      <Text style={styles.residentObligationNotes}>
                        ملاحظة: {o.notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Divider */}
              <View style={styles.obligationCardDivider} />

              {/* Bottom Row: Status Pill on Right, Action Button on Left */}
              <View style={styles.obligationBottomActionRow}>
                <View
                  style={[
                    styles.obligationStatusPill,
                    o.status === 'unpaid' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                    o.status === 'paid' && { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
                    o.status === 'pending' && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          o.status === 'unpaid'
                            ? '#DC2626'
                            : o.status === 'paid'
                            ? '#059669'
                            : '#D97706',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.obligationStatusPillText,
                      o.status === 'unpaid' && { color: '#DC2626' },
                      o.status === 'paid' && { color: '#059669' },
                      o.status === 'pending' && { color: '#D97706' },
                    ]}
                  >
                    {o.status === 'unpaid'
                      ? 'مستحق السداد'
                      : o.status === 'paid'
                      ? 'تمت التسوية بنجاح'
                      : 'قيد مراجعة الإدارة'}
                  </Text>
                </View>

                {o.status === 'unpaid' && (
                  <TouchableOpacity
                    style={styles.paySingleObligationBtn}
                    activeOpacity={0.85}
                    onPress={() => openObligationPaymentSheet(o)}
                  >
                    <MaterialIcons name="credit-card" size={13} color="#FFFFFF" />
                    <Text style={styles.paySingleObligationText}>سداد هذا البند</Text>
                  </TouchableOpacity>
                )}

                {o.status === 'pending' && (
                  <View style={styles.pendingReviewMiniBadge}>
                    <MaterialIcons name="hourglass-top" size={12} color="#D97706" />
                    <Text style={styles.pendingReviewMiniBadgeText}>بانتظار تأكيد الإدارة ⏳</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.unspecifiedArrearsBox}>
            <Text style={styles.unspecifiedArrearsText}>
              يوجد رصيد مديونية سابقة مسجل على الوحدة بإجمالي ({effectiveArrears.toLocaleString()} ج.م). يُرجى سداده لتسوية حساب الشقة بالكامل.
            </Text>
          </View>
        )}
      </View>

      {/* Quick Settle Actions */}
      {effectiveArrears > 0 && (
        <View style={styles.arrearsActionsContainer}>
          <View style={styles.arrearsButtonGroup}>
            <TouchableOpacity
              style={styles.payArrearsButton}
              activeOpacity={0.88}
              onPress={() => openArrearsPaymentSheet(effectiveArrears)}
            >
              <MaterialIcons name="bolt" size={18} color="#FFFFFF" />
              <Text style={styles.payArrearsButtonText}>
                سداد كامل المديونية ({effectiveArrears.toLocaleString()} ج.م) ⚡
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.payPartialArrearsButton}
              activeOpacity={0.88}
              onPress={() => openArrearsPaymentSheet(undefined, true)}
            >
              <MaterialIcons name="tune" size={18} color="#2563EB" />
              <Text style={styles.payPartialArrearsButtonText}>
                سداد جزئي أو تقسيط مرن 💵
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
    )
  ) || null;
};
