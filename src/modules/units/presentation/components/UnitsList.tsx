import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Apartment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import type { useArrearsForm } from '../../application/useArrearsForm';
import type { useEditUnitForm } from '../../application/useEditUnitForm';
import { useUnitFinancials } from '../../application/useUnitFinancials';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface UnitsListProps {
  searchQuery: string;
  activeFilter: 'all' | 'overdue' | 'paid' | 'pending';
  setDetailModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedDetailApt: React.Dispatch<React.SetStateAction<Apartment | null>>;
  editUnitForm: ReturnType<typeof useEditUnitForm>;
  arrearsForm: ReturnType<typeof useArrearsForm>;
  setInviteModalApt: React.Dispatch<React.SetStateAction<Apartment | null>>;
}

export const UnitsList: React.FC<UnitsListProps> = ({
  searchQuery,
  activeFilter,
  setDetailModalVisible,
  setSelectedDetailApt,
  editUnitForm,
  arrearsForm,
  setInviteModalApt,
}) => {
  const { deleteApartmentUnit } = useAppStore();
  const { openEditModal } = editUnitForm;
  const { openArrearsModal } = arrearsForm;
  const { buildingApartments, getApartmentFinancials } = useUnitFinancials();

  // Filtered apartments list
  const filteredApartments = useMemo(() => {
    return buildingApartments.filter((apt) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        apt.apartment_number.toLowerCase().includes(q) ||
        (apt.resident_name && apt.resident_name.toLowerCase().includes(q)) ||
        (apt.occupant_name && apt.occupant_name.toLowerCase().includes(q)) ||
        (apt.floor_number && apt.floor_number.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const f = getApartmentFinancials(apt);

      if (activeFilter === 'paid') return f.isPaid;
      if (activeFilter === 'overdue') return f.isOverdue;
      if (activeFilter === 'pending') return f.isPending;
      return true;
    });
  }, [buildingApartments, searchQuery, activeFilter, getApartmentFinancials]);

  return (
    <View style={{ gap: 10 }}>
      {filteredApartments.length > 0 ? (
        filteredApartments.map((apt) => {
          const f = getApartmentFinancials(apt);

          return (
            <TouchableOpacity
              key={apt.id}
              style={[
                styles.unitDirectoryCard,
                f.hasDebt && { borderColor: '#FDE68A', backgroundColor: '#FFFDF5' },
              ]}
              activeOpacity={0.88}
              onPress={() => {
                setSelectedDetailApt(apt);
                setDetailModalVisible(true);
              }}
            >
              <View style={styles.rowBetween}>
                {/* Unit Badge & Details */}
                <View style={styles.rowAlign}>
                  <View style={styles.unitNumberBoxBig}>
                    <Text style={styles.unitNumberBoxBigText}>
                      {apt.apartment_number}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.unitResidentName}>
                      {apt.occupant_name || apt.resident_name || 'وحدة شاغرة'}
                    </Text>
                    <Text style={styles.unitMetaSub}>
                      {apt.floor_number || 'الدور الأول'} • {apt.wing_or_direction || 'واجهة'}
                    </Text>
                  </View>
                </View>

                {/* Payment / Debt Status Pill */}
                <View
                  style={[
                    styles.statusPillBadge,
                    f.hasDebt && { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                    !f.hasDebt && f.isPaid && { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
                    !f.hasDebt && f.isPending && { backgroundColor: 'rgba(249, 115, 22, 0.12)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillBadgeText,
                      f.hasDebt && { color: '#DC2626', fontWeight: '800' },
                      !f.hasDebt && f.isPaid && { color: COLORS.statusPaidText },
                      !f.hasDebt && f.isPending && { color: COLORS.statusPendingText },
                    ]}
                  >
                    {f.hasDebt
                      ? `مديونية: ${f.effectiveArrears.toLocaleString()} ج.م`
                      : f.isPending
                      ? 'إيصال معلق'
                      : f.isPaid
                      ? 'مسدد بالكامل'
                      : 'متأخر عن السداد'}
                  </Text>
                </View>
              </View>

              {/* If unit has registered debt, show detail preview strip */}
              {f.hasDebt && (
                <View style={styles.arrearsAlertBox}>
                  <MaterialIcons name="error-outline" size={15} color="#B45309" />
                  <Text style={styles.arrearsAlertBoxText} numberOfLines={1}>
                    {f.unpaidObls.length > 0
                      ? `${f.unpaidObls.length} التزامات: ${f.unpaidObls.map((o) => o.title).join(' • ')}`
                      : `مديونية سابقة مسجلة: ${f.effectiveArrears.toLocaleString()} ج.م`}
                  </Text>
                  <Text style={styles.viewDetailsHintText}>التفاصيل ›</Text>
                </View>
              )}

              {/* Arrears and Actions Strip */}
              <View style={styles.unitCardBottomStrip}>
                <View>
                  <View style={styles.rowAlign}>
                    <Text style={styles.arrearsLabelText}>المستحق:</Text>
                    <Text
                      style={[
                        styles.arrearsValText,
                        f.isPaid && { color: COLORS.secondary },
                        f.hasDebt && { color: '#DC2626', fontWeight: '800' },
                      ]}
                    >
                      {f.isPaid ? '0.00 ج.م' : `${f.totalDueAmount.toLocaleString()} ج.م`}
                    </Text>
                  </View>
                  {f.hasDebt && !f.isPaid && (
                    <Text style={styles.arrearsBreakdownSubText}>
                      (منها {f.effectiveArrears.toLocaleString()} مديونية)
                    </Text>
                  )}
                </View>

                <View style={styles.rowAlign}>
                  {/* View Details Action Button */}
                  <TouchableOpacity
                    style={[styles.iconActionCircle, { backgroundColor: '#EEF2FF' }]}
                    onPress={() => {
                      setSelectedDetailApt(apt);
                      setDetailModalVisible(true);
                    }}
                  >
                    <MaterialIcons name="receipt-long" size={17} color={COLORS.primary} />
                  </TouchableOpacity>

                  {/* Add Arrears / Debt Action Button */}
                  <TouchableOpacity
                    style={[styles.iconActionCircle, styles.arrearsActionBtn]}
                    onPress={() => openArrearsModal(apt)}
                  >
                    <MaterialIcons name="post-add" size={17} color="#B45309" />
                  </TouchableOpacity>

                  {/* WhatsApp Invite / Reminder */}
                  <TouchableOpacity
                    style={styles.iconActionCircle}
                    onPress={() => setInviteModalApt(apt)}
                  >
                    <MaterialIcons name="share" size={16} color={COLORS.secondary} />
                  </TouchableOpacity>

                  {/* Edit Unit */}
                  <TouchableOpacity
                    style={styles.iconActionCircle}
                    onPress={() => openEditModal(apt)}
                  >
                    <MaterialIcons name="edit" size={16} color={COLORS.primary} />
                  </TouchableOpacity>

                  {/* Delete Unit */}
                  <TouchableOpacity
                    style={styles.iconActionCircle}
                    onPress={() => {
                      Alert.alert(
                        'حذف الوحدة',
                        `هل أنت متأكد من حذف شقة (${apt.apartment_number})؟`,
                        [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: () => deleteApartmentUnit(apt.id),
                          },
                        ]
                      );
                    }}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={COLORS.statusUnpaid} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyStateBox}>
          <MaterialIcons name="apartment" size={36} color={COLORS.outline} />
          <Text style={styles.emptyStateTitle}>لا توجد وحدات تطابق البحث</Text>
          <Text style={styles.emptyStateSub}>جرّب البحث برقم شقة مختلف أو اضغط "إضافة وحدة جديدة".</Text>
        </View>
      )}
    </View>
  );
};
