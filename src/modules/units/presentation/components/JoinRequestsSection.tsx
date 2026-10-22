import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../joinRequests.styles';

export const JoinRequestsSection: React.FC = () => {
  const { processingIds, reviewResidentJoinRequest } = useAppStore();
  const { buildingApartments, buildingPendingResidents } = useAdminDashboardMetrics();

  // Mechanism 2: Admin Join Review "Change Apartment Before Approval" state
  const [overrideApartmentByResId, setOverrideApartmentByResId] = useState<
    Record<string, string>
  >({});
  const [expandedAptPickerForResId, setExpandedAptPickerForResId] = useState<
    string | null
  >(null);

  return (
    buildingPendingResidents.length > 0 && (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.sectionTitle}>
            طلبات انضمام السكان (بطاقة المقارنة الذكية)
          </Text>
          <StatusBadge
            status="pending"
            customLabel={`${buildingPendingResidents.length} بانتظار التفعيل`}
          />
        </View>
      </View>

      {buildingPendingResidents.map((res) => {
        const effectiveAptNumber =
          overrideApartmentByResId[res.id] || res.apartment_number || '-';
        const wasChanged =
          Boolean(overrideApartmentByResId[res.id]) &&
          overrideApartmentByResId[res.id] !== res.apartment_number;

        const selectedAptData = buildingApartments.find(
          (a) => a.apartment_number === effectiveAptNumber
        );

        const normalizedResPhone = (res.phone || '').replace(/\D/g, '');
        const phoneMatchedApt =
          normalizedResPhone.length >= 8
            ? buildingApartments.find(
                (a) =>
                  (a.occupant_phone || a.resident_phone || '').replace(
                    /\D/g,
                    ''
                  ) === normalizedResPhone
              )
            : undefined;

        const preName = (
          selectedAptData?.occupant_name ||
          selectedAptData?.resident_name ||
          ''
        ).trim();
        const prePhone = (
          selectedAptData?.occupant_phone ||
          selectedAptData?.resident_phone ||
          ''
        ).replace(/\D/g, '');
        const hasPreRegisteredData = Boolean(
          selectedAptData &&
            (selectedAptData.occupant_name || selectedAptData.occupant_phone)
        );

        const isNameMatched = preName
          ? preName.includes(res.full_name.trim()) ||
            res.full_name.trim().includes(preName)
          : true;
        const isPhoneMatched =
          prePhone.length >= 8 ? prePhone === normalizedResPhone : true;

        const isExactMatch =
          hasPreRegisteredData && isNameMatched && isPhoneMatched;
        const hasMismatchWarning =
          hasPreRegisteredData && (!isNameMatched || !isPhoneMatched);

        const isPickerOpen = expandedAptPickerForResId === res.id;

        return (
          <View key={res.id} style={styles.reviewCard}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewRightGroup}>
                <View
                  style={[
                    styles.aptBadgeBox,
                    wasChanged && { backgroundColor: COLORS.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.aptBadgeLabel,
                      wasChanged && { color: COLORS.onPrimary },
                    ]}
                  >
                    شقة
                  </Text>
                  <Text
                    style={[
                      styles.aptBadgeNumber,
                      wasChanged && { color: COLORS.onPrimary },
                    ]}
                  >
                    {effectiveAptNumber}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={styles.residentNameText}>
                    {res.full_name}
                  </Text>
                  <Text style={styles.paymentMethodTagText}>
                    {res.floor_number || 'طلب انضمام بكود المبنى'} •{' '}
                    {res.phone}
                  </Text>
                </View>
              </View>
              <StatusBadge
                status={hasMismatchWarning ? 'upcoming' : 'paid'}
                customLabel={
                  wasChanged
                    ? `تم تعديلها إلى ${effectiveAptNumber}`
                    : hasMismatchWarning
                    ? 'اختلاف بيانات ⚠️'
                    : isExactMatch
                    ? 'بيانات متطابقة ✅'
                    : 'تسجيل جديد 🆕'
                }
              />
            </View>

            {/* Mechanism 2A: Smart Side-by-Side Comparison Card */}
            <View style={styles.smartCompareContainer}>
              <View
                style={[
                  styles.smartCompareHeader,
                  isExactMatch
                    ? { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
                    : hasMismatchWarning
                    ? { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }
                    : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                <MaterialIcons
                  name={
                    isExactMatch
                      ? 'verified'
                      : hasMismatchWarning
                      ? 'warning'
                      : 'assignment-ind'
                  }
                  size={17}
                  color={
                    isExactMatch
                      ? '#10B981'
                      : hasMismatchWarning
                      ? '#D97706'
                      : COLORS.primary
                  }
                />
                <Text
                  style={[
                    styles.smartCompareHeaderTitle,
                    isExactMatch
                      ? { color: '#065F46', fontWeight: '700' }
                      : hasMismatchWarning
                      ? { color: '#92400E', fontWeight: '700' }
                      : { color: COLORS.onSurface },
                  ]}
                >
                  {isExactMatch
                    ? `البيانات متطابقة تماماً مع المسجل مسبقاً لدى الاتحاد على شقة (${effectiveAptNumber}) ✅`
                    : hasMismatchWarning
                    ? `تنبيه اختلاف بيانات: طالب الانضمام أدخل بيانات تختلف عما سجله الاتحاد على شقة (${effectiveAptNumber}) ⚠️`
                    : `تسجيل لأول مرة على شقة (${effectiveAptNumber}) — لا توجد بيانات سابقة للمقارنة`}
                </Text>
              </View>

              {hasPreRegisteredData && (
                <View style={styles.smartCompareCols}>
                  {/* Column 1: New Resident Request */}
                  <View style={styles.smartCompareColBox}>
                    <Text style={styles.smartCompareColTag}>
                      بيانات الساكن الجديد
                    </Text>
                    <Text style={styles.smartComparePrimaryVal}>
                      {res.full_name}
                    </Text>
                    <Text style={styles.smartCompareSecondaryVal}>
                      هاتف: {res.phone}
                    </Text>
                    <Text style={styles.smartCompareSecondaryVal}>
                      الشقة المطلوبة: شقة {res.apartment_number}
                    </Text>
                  </View>

                  {/* Column 2: Pre-registered Apartment Record */}
                  <View
                    style={[
                      styles.smartCompareColBox,
                      hasMismatchWarning
                        ? styles.smartCompareColWarning
                        : styles.smartCompareColMatched,
                    ]}
                  >
                    <Text style={styles.smartCompareColTag}>
                      المسجل مسبقاً بشقة {effectiveAptNumber}
                    </Text>
                    <Text style={styles.smartComparePrimaryVal}>
                      {selectedAptData?.occupant_name ||
                        selectedAptData?.resident_name ||
                        'وحدة غير مسجل لها اسم مبدئي'}
                    </Text>
                    <Text style={styles.smartCompareSecondaryVal}>
                      هاتف مبدئي:{' '}
                      {selectedAptData?.occupant_phone ||
                        selectedAptData?.resident_phone ||
                        'غير مسجل'}
                    </Text>
                    <Text
                      style={[
                        styles.smartCompareArrearsVal,
                        {
                          color:
                            (selectedAptData?.arrears_amount ??
                              selectedAptData?.unpaid_amount ??
                              0) > 0
                              ? COLORS.statusUnpaidText
                              : COLORS.statusPaidText,
                        },
                      ]}
                    >
                      المتأخرات المسجلة:{' '}
                      {(
                        selectedAptData?.arrears_amount ??
                        selectedAptData?.unpaid_amount ??
                        0
                      ).toLocaleString()}{' '}
                      ج.م
                    </Text>
                  </View>
                </View>
              )}

              {/* Smart Phone Suggestion Alert if resident picked wrong apartment */}
              {phoneMatchedApt &&
                phoneMatchedApt.apartment_number !== effectiveAptNumber && (
                  <TouchableOpacity
                    style={styles.smartSuggestionBanner}
                    onPress={() =>
                      setOverrideApartmentByResId((prev) => ({
                        ...prev,
                        [res.id]: phoneMatchedApt.apartment_number,
                      }))
                    }
                  >
                    <MaterialIcons
                      name="lightbulb"
                      size={18}
                      color={COLORS.statusPendingText}
                    />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.smartSuggestionTitle}>
                        تنبيه تطابق الهاتف: هذا الساكن مسجل مسبقاً على شقة (
                        {phoneMatchedApt.apartment_number})!
                      </Text>
                      <Text style={styles.smartSuggestionSub}>
                        اضغط هنا لتصحيح الشقة تلقائياً إلى شقة{' '}
                        {phoneMatchedApt.apartment_number} (باسم:{' '}
                        {phoneMatchedApt.occupant_name}) قبل القبول.
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
            </View>

            {/* Mechanism 2B: "تغيير الشقة قبل القبول" Inline Selector */}
            <View style={styles.changeAptBlock}>
              <TouchableOpacity
                style={styles.changeAptToggleBtn}
                onPress={() =>
                  setExpandedAptPickerForResId(
                    isPickerOpen ? null : res.id
                  )
                }
              >
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialIcons
                    name="swap-horiz"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.changeAptToggleText}>
                    تغيير الشقة قبل القبول (الحالية: شقة {effectiveAptNumber}
                    )
                  </Text>
                </View>
                <MaterialIcons
                  name={isPickerOpen ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={COLORS.onSurfaceVariant}
                />
              </TouchableOpacity>

              {isPickerOpen && (
                <View style={styles.changeAptChipsList}>
                  {buildingApartments.map((apt) => {
                    const isSelected =
                      apt.apartment_number === effectiveAptNumber;
                    return (
                      <TouchableOpacity
                        key={apt.id}
                        style={[
                          styles.changeAptChip,
                          isSelected && styles.changeAptChipActive,
                        ]}
                        onPress={() => {
                          setOverrideApartmentByResId((prev) => ({
                            ...prev,
                            [res.id]: apt.apartment_number,
                          }));
                          setExpandedAptPickerForResId(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.changeAptChipTitle,
                            isSelected && { color: COLORS.onPrimary },
                          ]}
                        >
                          شقة {apt.apartment_number} —{' '}
                          {apt.occupant_name ||
                            apt.resident_name ||
                            'شاغرة'}
                        </Text>
                        <Text
                          style={[
                            styles.changeAptChipSub,
                            isSelected && { color: '#E2E8F0' },
                          ]}
                        >
                          متأخرات:{' '}
                          {(
                            apt.arrears_amount ??
                            apt.unpaid_amount ??
                            0
                          ).toLocaleString()}{' '}
                          ج.م
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.reviewButtonsRow}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={async () => {
                  try {
                    await reviewResidentJoinRequest(
                      res.id,
                      true,
                      effectiveAptNumber
                    );
                    Alert.alert(
                      'تم اعتماد الساكن وتفعيل الحساب ✅',
                      wasChanged
                        ? `تم تعديل شقة (${res.full_name}) إلى شقة (${effectiveAptNumber}) بدلاً من (${res.apartment_number}) واعتماده في خطوة واحدة.`
                        : `تم تفعيل حساب (${res.full_name}) على شقة (${effectiveAptNumber}) بنجاح.`
                    );
                  } catch (err: any) {
                    Alert.alert('تنبيه', err?.message || 'حدث خطأ');
                  }
                }}
                disabled={Boolean(processingIds[res.id])}
              >
                <MaterialIcons
                  name="check-circle"
                  size={18}
                  color={COLORS.onSecondary}
                />
                <Text style={styles.approveBtnText}>
                  {wasChanged
                    ? `تغيير لشقة ${effectiveAptNumber} واعتماد الساكن`
                    : `اعتماد الساكن على شقة ${effectiveAptNumber}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => reviewResidentJoinRequest(res.id, false)}
                disabled={Boolean(processingIds[res.id])}
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
      })}
    </View>
    )
  ) || null;
};
