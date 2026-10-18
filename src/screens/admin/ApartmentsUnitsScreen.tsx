import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  I18nManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';

import { Apartment } from '../../types/database';
import {
  copyToClipboard,
  sendWhatsAppInvite,
  generateInviteMessage,
} from '../../utils/inviteHelper';

/**
 * Matches design/stitch_/302/code.html, _4/code.html, _19/code.html, _24/code.html
 * (إدارة الوحدات السكنية، إضافة وحدة سكنية جديدة، كشف حساب الشقة، وأداة نقل المديونيات/الالتزامات بين الشقق).
 */
export const ApartmentsUnitsScreen: React.FC = () => {
  const {
    currentUser,
    currentBuilding,
    apartments,
    apartmentObligations,
    addApartmentUnit,
    updateApartmentUnit,
    deleteApartmentUnit,
    addApartmentObligation,
    transferApartmentObligations,
  } = useAppStore();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [aptNumber, setAptNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [wing, setWing] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [residentName, setResidentName] = useState('');
  const [residentPhone, setResidentPhone] = useState('');

  // Edit Unit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editAptNumber, setEditAptNumber] = useState('');
  const [editFloorNumber, setEditFloorNumber] = useState('');
  const [editWing, setEditWing] = useState('');
  const [editAreaSqm, setEditAreaSqm] = useState('');
  const [editResidentName, setEditResidentName] = useState('');
  const [editResidentPhone, setEditResidentPhone] = useState('');

  // Apartment Statement & Arrears Modal State
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(
    null
  );
  const [showAddObligationForm, setShowAddObligationForm] = useState(false);
  const [newObligationTitle, setNewObligationTitle] = useState('');
  const [newObligationAmount, setNewObligationAmount] = useState('');
  const [newObligationMonth, setNewObligationMonth] = useState('');

  // Transfer Obligations Modal State (Mechanism 3)
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [selectedObligationIds, setSelectedObligationIds] = useState<string[]>(
    []
  );
  const [targetApartmentNumber, setTargetApartmentNumber] =
    useState<string>('');
  const [transferOccupantInfo, setTransferOccupantInfo] =
    useState<boolean>(true);
  const [transferring, setTransferring] = useState<boolean>(false);

  // Unit WhatsApp Invite State
  const [whatsAppTargetApt, setWhatsAppTargetApt] = useState<Apartment | null>(
    null
  );
  const [inputResidentPhone, setInputResidentPhone] = useState('');

  const buildingApartments = apartments.filter(
    (a) => a.building_id === currentBuilding.id
  );

  const selectedApartment: Apartment | undefined = buildingApartments.find(
    (a) => a.id === selectedApartmentId
  );

  const selectedAptObligations = selectedApartment
    ? apartmentObligations.filter(
        (o) =>
          o.building_id === currentBuilding.id &&
          (o.apartment_id === selectedApartment.id ||
            o.apartment_number === selectedApartment.apartment_number)
      )
    : [];

  const unpaidSelectedAptObligations = selectedAptObligations.filter(
    (o) => o.status === 'unpaid'
  );

  const handleOpenStatement = (apt: Apartment) => {
    setSelectedApartmentId(apt.id);
    setShowAddObligationForm(false);
  };

  const handleOpenTransferModal = (apt: Apartment) => {
    const unpaidList = apartmentObligations.filter(
      (o) =>
        o.building_id === currentBuilding.id &&
        (o.apartment_id === apt.id ||
          o.apartment_number === apt.apartment_number) &&
        o.status === 'unpaid'
    );
    // Select all unpaid obligations by default
    setSelectedObligationIds(unpaidList.map((o) => o.id));
    const otherApt = buildingApartments.find(
      (a) => a.apartment_number !== apt.apartment_number
    );
    setTargetApartmentNumber(otherApt?.apartment_number || '');
    setTransferOccupantInfo(true);
    setTransferModalVisible(true);
  };

  const toggleObligationSelection = (id: string) => {
    setSelectedObligationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddObligation = async () => {
    if (!selectedApartment) return;
    const numericAmount = parseFloat(newObligationAmount);
    if (!newObligationTitle.trim() || !numericAmount || numericAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان ومبلغ صحيح للالتزام.');
      return;
    }
    try {
      await addApartmentObligation({
        apartmentId: selectedApartment.id,
        title: newObligationTitle.trim(),
        amount: numericAmount,
        category: 'monthly_dues',
        billingMonth: newObligationMonth.trim() || '2024-10',
      });
      setShowAddObligationForm(false);
      Alert.alert(
        'تم تسجيل الالتزام بنجاح ✅',
        `تمت إضافة (${newObligationTitle}) بقيمة ${numericAmount} ج.م على شقة ${selectedApartment.apartment_number}.`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر تسجيل الالتزام');
    }
  };

  const handleConfirmTransferObligations = async () => {
    if (!selectedApartment) return;
    const targetApt = buildingApartments.find(
      (a) => a.apartment_number === targetApartmentNumber
    );
    if (!targetApartmentNumber || !targetApt) {
      Alert.alert('تنبيه', 'يرجى اختيار الشقة الصحيحة المراد النقل إليها.');
      return;
    }
    if (
      selectedObligationIds.length === 0 &&
      unpaidSelectedAptObligations.length > 0 &&
      !transferOccupantInfo
    ) {
      Alert.alert(
        'تنبيه',
        'يرجى تحديد التزام واحد على الأقل أو تفعيل نقل الاسم المبدئي.'
      );
      return;
    }

    setTransferring(true);
    try {
      const res = await transferApartmentObligations({
        sourceApartmentId: selectedApartment.id,
        targetApartmentId: targetApt.id,
        obligationIds:
          selectedObligationIds.length === unpaidSelectedAptObligations.length
            ? undefined // NULL = transfer all unpaid
            : selectedObligationIds,
        transferOccupantInfo,
      });

      setTransferModalVisible(false);
      setSelectedApartmentId(targetApt.id);

      Alert.alert(
        'تم نقل الالتزامات بنجاح ⇄',
        `تم نقل (${res.transferredCount}) التزام بقيمة إجمالية (${res.transferredAmount.toLocaleString()} ج.م) من شقة (${selectedApartment.apartment_number}) إلى شقة (${targetApartmentNumber})${
          transferOccupantInfo ? ' مع نقل الاسم المبدئي ورقم الهاتف.' : '.'
        }`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر نقل الالتزامات');
    } finally {
      setTransferring(false);
    }
  };

  const handleAddUnit = async () => {
    if (!aptNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الشقة.');
      return;
    }
    try {
      await addApartmentUnit({
        apartmentNumber: aptNumber,
        floorNumber,
        wingOrDirection: wing,
        areaSqm: parseFloat(areaSqm) || 160,
        residentName,
        residentPhone,
      });
      setAddModalVisible(false);
      Alert.alert(
        'تمت إضافة الوحدة السكنية 🎉',
        `تم تسجيل شقة (${aptNumber}) وتوليد كود الدعوة (${currentBuilding.building_code}-${aptNumber}).`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إضافة الوحدة');
    }
  };

  const handleOpenEditModal = (apt: Apartment) => {
    setEditingAptId(apt.id);
    setEditAptNumber(apt.apartment_number);
    setEditFloorNumber(apt.floor_number);
    setEditWing(apt.wing_or_direction || '');
    setEditAreaSqm(String(apt.area_sqm || 150));
    setEditResidentName(apt.occupant_name || '');
    setEditResidentPhone(apt.occupant_phone || '');
    setEditModalVisible(true);
  };

  const handleSaveEditUnit = async () => {
    if (!editingAptId || !editAptNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الشقة.');
      return;
    }
    try {
      await updateApartmentUnit(editingAptId, {
        apartmentNumber: editAptNumber.trim(),
        floorNumber: editFloorNumber.trim(),
        wingOrDirection: editWing.trim(),
        areaSqm: parseFloat(editAreaSqm) || 150,
        residentName: editResidentName.trim(),
        residentPhone: editResidentPhone.trim(),
      });
      setEditModalVisible(false);
      Alert.alert(
        'تم التعديل بنجاح ✅',
        `تم تحديث بيانات شقة (${editAptNumber}) بنجاح.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل الشقة');
    }
  };

  const handleDeleteUnit = (apt: Apartment) => {
    Alert.alert(
      'حذف الوحدة السكنية',
      `هل أنت متأكد من حذف شقة (${apt.apartment_number}) من سجل البرج نهائياً؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، حذف',
          style: 'destructive',
          onPress: async () => {
            await deleteApartmentUnit(apt.id);
            setEditModalVisible(false);
            if (selectedApartmentId === apt.id) {
              setSelectedApartmentId(null);
            }
            Alert.alert('تم الحذف', `تم حذف شقة (${apt.apartment_number}) بنجاح.`);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header & Add Unit Button */}
      <View style={styles.headerRow}>
        <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 8 }}>
          <Text style={styles.title}>سجل الوحدات السكنية والملاك</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {currentBuilding.name} • كود: {currentBuilding.building_code}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              copyToClipboard(currentBuilding.building_code, 'كود المبنى')
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="content-copy"
              size={17}
              color={COLORS.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconBtn, styles.shareIconBtn]}
            onPress={() =>
              sendWhatsAppInvite({
                buildingName: currentBuilding.name,
                buildingCode: currentBuilding.building_code,
              })
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="share" size={17} color="#25D366" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <MaterialIcons name="add" size={18} color={COLORS.onPrimary} />
            <Text style={styles.addBtnText}>إضافة شقة</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{buildingApartments.length}</Text>
          <Text style={styles.statLabel}>شقة مسجلة</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: COLORS.secondary }]}>
            {currentBuilding.total_apartments}
          </Text>
          <Text style={styles.statLabel}>إجمالي وحدات البرج</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statVal}>
            {currentBuilding.default_monthly_dues} ج.م
          </Text>
          <Text style={styles.statLabel}>الاشتراك الشهري</Text>
        </View>
      </View>

      {/* Units List */}
      <View style={{ gap: 10 }}>
        {buildingApartments.map((apt) => {
          const aptUnpaidObligations = apartmentObligations.filter(
            (o) =>
              o.building_id === currentBuilding.id &&
              (o.apartment_id === apt.id ||
                o.apartment_number === apt.apartment_number) &&
              o.status === 'unpaid'
          );
          const totalArrears =
            aptUnpaidObligations.reduce((sum, o) => sum + o.amount, 0) ||
            apt.arrears_amount ||
            0;

          return (
            <TouchableOpacity
              key={apt.id}
              style={styles.unitCard}
              activeOpacity={0.88}
              onPress={() => handleOpenStatement(apt)}
            >
              <View style={styles.unitTopRow}>
                <View style={styles.unitRight}>
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeLabel}>شقة</Text>
                    <Text style={styles.unitBadgeNum}>
                      {apt.apartment_number}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={styles.unitResidentName}>
                      {apt.resident_name ||
                        apt.occupant_name ||
                        (currentUser.apartment_number &&
                        apt.apartment_number === currentUser.apartment_number
                          ? `${currentUser.full_name} (رئيس الاتحاد)`
                          : 'وحدة شاغرة')}
                    </Text>
                    {apt.resident_name ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: COLORS.secondary,
                          fontWeight: '600',
                        }}
                      >
                        {apt.apartment_number === currentUser.apartment_number
                          ? 'رئيس مجلس اتحاد الملاك'
                          : 'الساكن المعتمد'}
                        {apt.resident_phone ? ` • ${apt.resident_phone}` : ''}
                      </Text>
                    ) : apt.occupant_name && !apt.resident_id ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: COLORS.primary,
                          fontWeight: '600',
                        }}
                      >
                        الاسم المبدئي المسجل: {apt.occupant_name}
                        {apt.occupant_phone ? ` (${apt.occupant_phone})` : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.unitMeta}>
                      {apt.floor_number} • {apt.wing_or_direction || 'واجهة'} •{' '}
                      {apt.area_sqm || 160} م² ({apt.ownership_share_percent}%)
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-start', gap: 4 }}>
                  <StatusBadge status={apt.payment_status || 'unpaid'} />
                  {totalArrears > 0 && (
                    <View
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: COLORS.statusUnpaid,
                        }}
                      >
                        متأخرات: {totalArrears.toLocaleString()} ج.م
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.unitFooter}>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={styles.inviteCodeLabel}>
                    رمز الدعوة:{' '}
                    {apt.invite_code ||
                      `${currentBuilding.building_code}-${apt.apartment_number}`}
                  </Text>
                  <TouchableOpacity
                    style={{
                      padding: 4,
                      backgroundColor: COLORS.surfaceContainerLow,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: COLORS.primaryContainer,
                    }}
                    onPress={() =>
                      copyToClipboard(
                        apt.invite_code ||
                          `${currentBuilding.building_code}-${apt.apartment_number}`,
                        `كود شقة ${apt.apartment_number}`
                      )
                    }
                  >
                    <MaterialIcons
                      name="content-copy"
                      size={12}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* WhatsApp button for this specific unit */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#25D366',
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: 6,
                    }}
                    onPress={() => {
                      if (apt.occupant_phone) {
                        sendWhatsAppInvite({
                          buildingName: currentBuilding.name,
                          buildingCode: currentBuilding.building_code,
                          apartmentNumber: apt.apartment_number,
                          residentName:
                            (apt.resident_name || apt.occupant_name) ??
                            undefined,
                          phone: apt.occupant_phone ?? undefined,
                        });
                      } else {
                        setWhatsAppTargetApt(apt);
                        setInputResidentPhone('');
                      }
                    }}
                  >
                    <MaterialIcons name="chat" size={13} color="#FFFFFF" />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#FFFFFF',
                      }}
                    >
                      {apt.occupant_phone
                        ? 'واتساب الساكن 📲'
                        : 'دعوة واتساب 📲'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: COLORS.surfaceContainerLow,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: COLORS.borderSubtle,
                    }}
                    onPress={() => handleOpenEditModal(apt)}
                  >
                    <MaterialIcons
                      name="edit"
                      size={12}
                      color={COLORS.onSurfaceVariant}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: COLORS.onSurfaceVariant,
                      }}
                    >
                      تعديل
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: COLORS.surfaceContainerLow,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: COLORS.borderSubtle,
                    }}
                    onPress={() => handleOpenStatement(apt)}
                  >
                    <MaterialIcons
                      name="account-balance-wallet"
                      size={13}
                      color={COLORS.primary}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: COLORS.primary,
                      }}
                    >
                      كشف حساب الشقة ({aptUnpaidObligations.length})
                    </Text>
                  </TouchableOpacity>

                  {(aptUnpaidObligations.length > 0 || apt.occupant_name) && (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: 'rgba(0, 108, 73, 0.1)',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                      }}
                      onPress={() => {
                        setSelectedApartmentId(apt.id);
                        handleOpenTransferModal(apt);
                      }}
                    >
                      <MaterialIcons
                        name="swap-horiz"
                        size={14}
                        color={COLORS.secondary}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: COLORS.secondary,
                        }}
                      >
                        ⇄ نقل التزامات
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ==================================================================== */}
      {/* Apartment Statement Modal (كشف حساب الشقة + زر نقل التزامات لشقة أخرى) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(selectedApartment) && !transferModalVisible}
        title={
          selectedApartment
            ? `كشف حساب شقة (${selectedApartment.apartment_number})`
            : 'كشف حساب الشقة'
        }
        subtitle={
          selectedApartment
            ? `${selectedApartment.floor_number} • الاسم المسجل: ${
                selectedApartment.occupant_name ||
                selectedApartment.resident_name ||
                'غير مسجل'
              }`
            : ''
        }
        onClose={() => setSelectedApartmentId(null)}
      >
        {selectedApartment && (
          <View style={{ gap: 12 }}>
            {/* Pre-registered Occupant & Arrears Summary */}
            <View
              style={{
                backgroundColor: COLORS.surfaceContainerLow,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
                gap: 6,
              }}
            >
              <View
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.onSurfaceVariant,
                    }}
                  >
                    الاسم المبدئي / الساكن المسجل على الوحدة
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: COLORS.onSurface,
                    }}
                  >
                    {selectedApartment.occupant_name ||
                      selectedApartment.resident_name ||
                      'وحدة شاغرة'}
                  </Text>
                  {selectedApartment.occupant_phone ||
                  selectedApartment.resident_phone ? (
                    <Text
                      style={{
                        fontSize: 11,
                        color: COLORS.secondary,
                        fontWeight: '600',
                      }}
                    >
                      هاتف المالك:{' '}
                      {selectedApartment.occupant_phone ||
                        selectedApartment.resident_phone}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-start' }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: COLORS.onSurfaceVariant,
                    }}
                  >
                    إجمالي المتأخرات غير المسددة
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color:
                        unpaidSelectedAptObligations.length > 0
                          ? COLORS.statusUnpaid
                          : COLORS.secondary,
                    }}
                  >
                    {unpaidSelectedAptObligations
                      .reduce((s, o) => s + o.amount, 0)
                      .toLocaleString()}{' '}
                    ج.م
                  </Text>
                </View>
              </View>

              {/* Action Buttons inside Statement: Transfer Obligations & Add Obligation */}
              <View
                style={{
                  flexDirection: 'row-reverse',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.primaryContainer,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onPress={() => handleOpenTransferModal(selectedApartment)}
                >
                  <MaterialIcons
                    name="swap-horiz"
                    size={18}
                    color={COLORS.secondaryFixed}
                  />
                  <Text
                    style={{
                      color: COLORS.onPrimary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    ⇄ نقل التزامات لشقة أخرى
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.surfaceCard,
                    borderWidth: 1,
                    borderColor: COLORS.borderSubtle,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  onPress={() =>
                    setShowAddObligationForm(!showAddObligationForm)
                  }
                >
                  <MaterialIcons
                    name={showAddObligationForm ? 'close' : 'add'}
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    تسجيل مديونية
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Add Arrears / Obligation Form */}
            {showAddObligationForm && (
              <View
                style={{
                  backgroundColor: COLORS.surfaceCard,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: COLORS.secondary,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: COLORS.primary,
                    textAlign: 'right',
                  }}
                >
                  إضافة التزام / متأخرات سابقة على شقة{' '}
                  {selectedApartment.apartment_number}
                </Text>
                <TextInput
                  style={styles.input}
                  value={newObligationTitle}
                  onChangeText={setNewObligationTitle}
                  placeholder="بيان المديونية (مثال: متأخرات شهر أكتوبر)"
                  placeholderTextColor={COLORS.outline}
                />
                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={newObligationAmount}
                      onChangeText={setNewObligationAmount}
                      keyboardType="numeric"
                      placeholder="المبلغ (ج.م)"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={newObligationMonth}
                      onChangeText={setNewObligationMonth}
                      placeholder="الشهر (2024-10)"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { height: 42 }]}
                  onPress={handleAddObligation}
                >
                  <Text style={styles.saveBtnText}>حفظ الالتزام في كشف الشقة</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Obligations List */}
            <Text style={styles.label}>
              سجل الالتزامات والمديونيات المقيدة ({selectedAptObligations.length})
            </Text>

            {selectedAptObligations.length === 0 ? (
              <View
                style={{
                  padding: 18,
                  backgroundColor: COLORS.surfaceContainerLow,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.onSurfaceVariant,
                  }}
                >
                  لا توجد التزامات غير مدفوعة مقيدة على هذه الشقة حالياً.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {selectedAptObligations.map((ob) => (
                  <View
                    key={ob.id}
                    style={{
                      backgroundColor: COLORS.surfaceCard,
                      borderRadius: 10,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: COLORS.borderSubtle,
                      flexDirection: 'row-reverse',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ alignItems: 'flex-end', flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: COLORS.onSurface,
                        }}
                      >
                        {ob.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: COLORS.onSurfaceVariant,
                          marginTop: 2,
                        }}
                      >
                        دورة الاستحقاق: {ob.billing_month || '2024-11'} •{' '}
                        {ob.status === 'paid' ? 'مسدد 🟢' : 'غير مدفوع 🔴'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color:
                          ob.status === 'paid'
                            ? COLORS.secondary
                            : COLORS.statusUnpaid,
                      }}
                    >
                      {ob.amount.toLocaleString()} ج.م
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Mechanism 3: Transfer Apartment Obligations Modal (`transfer_apartment_obligations` RPC) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={transferModalVisible && Boolean(selectedApartment)}
        title="⇄ نقل التزامات ومديونيات لشقة أخرى"
        subtitle={
          selectedApartment
            ? `نقل المديونيات المسجلة بالخطأ من شقة (${selectedApartment.apartment_number}) إلى الشقة الصحيحة بضغطة زر`
            : ''
        }
        onClose={() => setTransferModalVisible(false)}
      >
        {selectedApartment && (
          <View style={{ gap: 12 }}>
            {/* Step 1: Select Unpaid Obligations (One or All) */}
            <View
              style={{
                flexDirection: 'row-reverse',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={styles.label}>
                1. حدد الالتزامات غير المدفوعة المراد نقلها:
              </Text>
              {unpaidSelectedAptObligations.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (
                      selectedObligationIds.length ===
                      unpaidSelectedAptObligations.length
                    ) {
                      setSelectedObligationIds([]);
                    } else {
                      setSelectedObligationIds(
                        unpaidSelectedAptObligations.map((o) => o.id)
                      );
                    }
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: COLORS.secondary,
                    }}
                  >
                    {selectedObligationIds.length ===
                    unpaidSelectedAptObligations.length
                      ? 'إلغاء تحديد الكل'
                      : 'تحديد كل الالتزامات'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {unpaidSelectedAptObligations.length === 0 ? (
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.onSurfaceVariant,
                  textAlign: 'right',
                }}
              >
                لا توجد التزامات غير مدفوعة على هذه الشقة (يمكنك نقل الاسم
                المبدئي فقط).
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {unpaidSelectedAptObligations.map((ob) => {
                  const checked = selectedObligationIds.includes(ob.id);
                  return (
                    <TouchableOpacity
                      key={ob.id}
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: checked
                          ? 'rgba(0, 108, 73, 0.08)'
                          : COLORS.surfaceCanvas,
                        borderWidth: 1,
                        borderColor: checked
                          ? COLORS.secondary
                          : COLORS.borderSubtle,
                      }}
                      onPress={() => toggleObligationSelection(ob.id)}
                    >
                      <View
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        <MaterialIcons
                          name={
                            checked ? 'check-box' : 'check-box-outline-blank'
                          }
                          size={20}
                          color={
                            checked ? COLORS.secondary : COLORS.onSurfaceVariant
                          }
                        />
                        <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: COLORS.onSurface,
                            }}
                          >
                            {ob.title}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: COLORS.onSurfaceVariant,
                            }}
                          >
                            {ob.billing_month || '2024-11'}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '800',
                          color: COLORS.statusUnpaid,
                        }}
                      >
                        {ob.amount.toLocaleString()} ج.م
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Step 2: Select Target Apartment */}
            <Text style={styles.label}>
              2. اختر الشقة الصحيحة المراد النقل إليها:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row-reverse',
                gap: 8,
                paddingVertical: 4,
              }}
            >
              {buildingApartments
                .filter(
                  (a) =>
                    a.apartment_number !== selectedApartment.apartment_number
                )
                .map((apt) => {
                  const isTarget =
                    targetApartmentNumber === apt.apartment_number;
                  return (
                    <TouchableOpacity
                      key={apt.id}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isTarget
                          ? COLORS.primaryContainer
                          : COLORS.surfaceCanvas,
                        borderWidth: 1,
                        borderColor: isTarget
                          ? COLORS.primaryContainer
                          : COLORS.borderSubtle,
                        alignItems: 'flex-end',
                      }}
                      onPress={() =>
                        setTargetApartmentNumber(apt.apartment_number)
                      }
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '800',
                          color: isTarget ? COLORS.onPrimary : COLORS.onSurface,
                        }}
                      >
                        شقة {apt.apartment_number}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: isTarget
                            ? COLORS.secondaryFixed
                            : COLORS.onSurfaceVariant,
                        }}
                      >
                        {apt.occupant_name || apt.resident_name || 'شاغرة'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            {/* Step 3: Toggle transferring pre-registered occupant_name & occupant_phone */}
            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 10,
                backgroundColor: COLORS.surfaceContainerLow,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
              }}
              onPress={() => setTransferOccupantInfo(!transferOccupantInfo)}
            >
              <MaterialIcons
                name={
                  transferOccupantInfo
                    ? 'check-box'
                    : 'check-box-outline-blank'
                }
                size={20}
                color={
                  transferOccupantInfo
                    ? COLORS.secondary
                    : COLORS.onSurfaceVariant
                }
              />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: COLORS.onSurface,
                  }}
                >
                  نقل الاسم المبدئي ورقم الهاتف أيضاً إلى الشقة الجديدة
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: COLORS.onSurfaceVariant,
                  }}
                >
                  ينقل ({selectedApartment.occupant_name || 'الاسم المسجل'}) من
                  شقة {selectedApartment.apartment_number} إلى شقة{' '}
                  {targetApartmentNumber || '...'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Confirm Transfer CTA */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: COLORS.secondary },
                transferring && { opacity: 0.7 },
              ]}
              onPress={handleConfirmTransferObligations}
              disabled={transferring}
            >
              <Text style={styles.saveBtnText}>
                {transferring
                  ? 'جاري النقل الآمن عبر RPC...'
                  : `تأكيد النقل الفوري إلى شقة (${targetApartmentNumber || '...'}) ⇄`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetModal>

      {/* Add New Unit Modal (Matches _4/code.html) */}
      <BottomSheetModal
        visible={addModalVisible}
        title="إضافة وحدة سكنية جديدة"
        subtitle={`تسجيل وحدة جديدة في ${currentBuilding.name}`}
        onClose={() => setAddModalVisible(false)}
      >
        <View style={{ gap: 12 }}>
          <View style={styles.twoCol}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>رقم الشقة</Text>
              <TextInput
                style={styles.input}
                value={aptNumber}
                onChangeText={setAptNumber}
                placeholder="مثال: 401"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>الطابق / الدور</Text>
              <TextInput
                style={styles.input}
                value={floorNumber}
                onChangeText={setFloorNumber}
                placeholder="مثال: الدور الرابع"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>الاتجاه / الموقع</Text>
              <TextInput
                style={styles.input}
                value={wing}
                onChangeText={setWing}
                placeholder="مثال: واجهة بحري"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>المساحة الفعلية (م²)</Text>
              <TextInput
                style={styles.input}
                value={areaSqm}
                onChangeText={setAreaSqm}
                keyboardType="numeric"
                placeholder="مثال: 165"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={styles.label}>
              الاسم المبدئي للساكن (`occupant_name` - لتأكيد هوية الوحدة)
            </Text>
            <TextInput
              style={styles.input}
              value={residentName}
              onChangeText={setResidentName}
              placeholder="مثال: د. طارق السعدني"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={styles.label}>
              رقم هاتف الساكن (`occupant_phone` - للمطابقة التلقائية عند التسجيل)
            </Text>
            <TextInput
              style={styles.input}
              value={residentPhone}
              onChangeText={setResidentPhone}
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleAddUnit}>
            <Text style={styles.saveBtnText}>حفظ الوحدة وتوليد كود الدعوة</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* WhatsApp Invite for Specific Apartment Modal */}
      <BottomSheetModal
        visible={Boolean(whatsAppTargetApt)}
        title={
          whatsAppTargetApt
            ? `دعوة ساكن شقة (${whatsAppTargetApt.apartment_number}) عبر واتساب 📲`
            : 'دعوة الساكن عبر واتساب'
        }
        subtitle="فتح محادثة واتساب وإرسال رسالة ترحيبية تتضمن كود المبنى ورقم الشقة"
        onClose={() => setWhatsAppTargetApt(null)}
      >
        {whatsAppTargetApt && (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>
                رقم هاتف ساكن شقة {whatsAppTargetApt.apartment_number} (واتساب)
              </Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={inputResidentPhone}
                onChangeText={setInputResidentPhone}
                placeholder="010XXXXXXXX أو +2010XXXXXXXX"
                placeholderTextColor={COLORS.outline}
                keyboardType="phone-pad"
              />
              <Text
                style={{
                  fontSize: 11,
                  color: COLORS.onSurfaceVariant,
                  textAlign: 'right',
                }}
              >
                💡 سيفتح تطبيق واتساب على هذا الرقم مباشرة، أو اتركه فارغاً لاختيار جهة الاتصال يدوياً.
              </Text>
            </View>

            {/* Preview Box */}
            <View
              style={{
                backgroundColor: COLORS.surfaceContainerLow,
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: COLORS.secondary,
                  textAlign: 'right',
                }}
              >
                معاينة نص الدعوة:
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: COLORS.onSurface,
                  lineHeight: 18,
                  textAlign: 'right',
                }}
              >
                {generateInviteMessage({
                  buildingName: currentBuilding.name,
                  buildingCode: currentBuilding.building_code,
                  apartmentNumber: whatsAppTargetApt.apartment_number,
                  residentName:
                    whatsAppTargetApt.occupant_name ||
                    whatsAppTargetApt.resident_name ||
                    undefined,
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#25D366',
                paddingVertical: 12,
                borderRadius: 10,
                shadowColor: '#25D366',
                shadowOpacity: 0.25,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 3,
                elevation: 2,
              }}
              onPress={() => {
                sendWhatsAppInvite({
                  buildingName: currentBuilding.name,
                  buildingCode: currentBuilding.building_code,
                  apartmentNumber: whatsAppTargetApt.apartment_number,
                  residentName:
                    whatsAppTargetApt.occupant_name ||
                    whatsAppTargetApt.resident_name ||
                    undefined,
                  phone: inputResidentPhone.trim(),
                });
                setWhatsAppTargetApt(null);
              }}
            >
              <MaterialIcons name="send" size={18} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: '#FFFFFF',
                }}
              >
                {inputResidentPhone.trim()
                  ? 'إرسال الدعوة للرقم عبر واتساب 📲'
                  : 'مشاركة الدعوة عبر واتساب 📲'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: COLORS.surfaceContainerLow,
                borderWidth: 1,
                borderColor: COLORS.primaryContainer,
                borderRadius: 8,
                paddingVertical: 9,
              }}
              onPress={() => {
                copyToClipboard(
                  generateInviteMessage({
                    buildingName: currentBuilding.name,
                    buildingCode: currentBuilding.building_code,
                    apartmentNumber: whatsAppTargetApt.apartment_number,
                    residentName:
                      whatsAppTargetApt.occupant_name ||
                      whatsAppTargetApt.resident_name ||
                      undefined,
                  }),
                  'رسالة الدعوة'
                );
              }}
            >
              <MaterialIcons
                name="content-copy"
                size={14}
                color={COLORS.primary}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: COLORS.primary,
                }}
              >
                نسخ نص الدعوة
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetModal>

      {/* Edit Apartment Modal */}
      <BottomSheetModal
        visible={editModalVisible}
        title={
          editingAptId
            ? `تعديل بيانات شقة (${editAptNumber}) ✏️`
            : 'تعديل بيانات الشقة'
        }
        subtitle="تحديث أو تصحيح بيانات الشقة أو الساكن المبدئي"
        onClose={() => setEditModalVisible(false)}
      >
        <View style={{ gap: 12 }}>
          <View style={styles.twoCol}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>رقم الشقة</Text>
              <TextInput
                style={styles.input}
                value={editAptNumber}
                onChangeText={setEditAptNumber}
                placeholder="مثال: 401"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>الطابق / الدور</Text>
              <TextInput
                style={styles.input}
                value={editFloorNumber}
                onChangeText={setEditFloorNumber}
                placeholder="مثال: الدور الرابع"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>الاتجاه / الموقع</Text>
              <TextInput
                style={styles.input}
                value={editWing}
                onChangeText={setEditWing}
                placeholder="مثال: واجهة بحري"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.label}>المساحة الفعلية (م²)</Text>
              <TextInput
                style={styles.input}
                value={editAreaSqm}
                onChangeText={setEditAreaSqm}
                keyboardType="numeric"
                placeholder="مثال: 165"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={styles.label}>الاسم المبدئي للساكن</Text>
            <TextInput
              style={styles.input}
              value={editResidentName}
              onChangeText={setEditResidentName}
              placeholder="مثال: د. طارق السعدني"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={styles.label}>رقم هاتف الساكن</Text>
            <TextInput
              style={styles.input}
              value={editResidentPhone}
              onChangeText={setEditResidentPhone}
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={{ gap: 10, marginTop: 6 }}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEditUnit}>
              <Text style={styles.saveBtnText}>حفظ التعديلات ✅</Text>
            </TouchableOpacity>

            {editingAptId && (
              <TouchableOpacity
                style={{
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: COLORS.statusUnpaidBg,
                  borderWidth: 1,
                  borderColor: COLORS.statusUnpaid,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row-reverse',
                  gap: 6,
                }}
                onPress={() => {
                  const targetApt = apartments.find((a) => a.id === editingAptId);
                  if (targetApt) {
                    handleDeleteUnit(targetApt);
                  }
                }}
              >
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color={COLORS.statusUnpaid}
                />
                <Text
                  style={{
                    color: COLORS.statusUnpaid,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  حذف هذه الوحدة من سجل البرج 🗑️
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BottomSheetModal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: {
    color: COLORS.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconBtn: {
    borderColor: 'rgba(37, 211, 102, 0.4)',
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
  },
  statsCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.borderSubtle,
  },
  unitCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 10,
  },
  unitTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  unitBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadgeLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  unitBadgeNum: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  unitResidentName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  unitMeta: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  unitFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  inviteCodeLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  twoCol: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  input: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  saveBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
