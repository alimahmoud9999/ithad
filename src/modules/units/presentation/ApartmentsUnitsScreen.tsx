import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  I18nManager,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { Apartment, ApartmentObligation, Payment } from '@/shared/types/database';
import {
  copyToClipboard,
  sendWhatsAppInvite,
  generateInviteMessage,
} from '@/shared/utils/inviteHelper';

export interface StagedObligation {
  id: string;
  type: 'monthly_dues' | 'custom';
  title: string;
  amount: number;
  month: number; // 1 to 12
  year: number; // e.g. 2026
}

export const MONTHS_CHOICES = [
  { num: 1, name: 'شهر 1 (يناير)' },
  { num: 2, name: 'شهر 2 (فبراير)' },
  { num: 3, name: 'شهر 3 (مارس)' },
  { num: 4, name: 'شهر 4 (أبريل)' },
  { num: 5, name: 'شهر 5 (مايو)' },
  { num: 6, name: 'شهر 6 (يونيو)' },
  { num: 7, name: 'شهر 7 (يوليو)' },
  { num: 8, name: 'شهر 8 (أغسطس)' },
  { num: 9, name: 'شهر 9 (سبتمبر)' },
  { num: 10, name: 'شهر 10 (أكتوبر)' },
  { num: 11, name: 'شهر 11 (نوفمبر)' },
  { num: 12, name: 'شهر 12 (ديسمبر)' },
];

/**
 * Units Directory & Management (Screens 14 to 18)
 * Faithfully implementing screens from Developer Handover Specs v2.4:
 * - Screen 14: UNITS_DIRECTORY (design/_28 & _21)
 * - Screen 15: ADD_UNIT_FORM (design/_4 & _29)
 * - Screen 16: UNITS_AFTER_ADD (design/_21)
 * - Screen 17: SHARE_INVITE_MODAL (design/302)
 * - Screen 18: EDIT_UNIT_FORM & OBLIGATION TRANSFER (design/_18)
 *
 * Preserves 100% of the underlying state management, Supabase sync, and WhatsApp deep links.
 */
export const ApartmentsUnitsScreen: React.FC = () => {
  const {
    currentUser,
    currentBuilding,
    apartments,
    apartmentObligations,
    payments,
    addApartmentUnit,
    updateApartmentUnit,
    deleteApartmentUnit,
    addApartmentObligation,
    settleApartmentObligation,
    deleteApartmentObligation,
    updateApartmentObligation,
    recordDirectCashPayment,
    transferApartmentObligations,
    sendBulkUnpaidReminder,
    approveResidentPayment,
  } = useAppStore();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'paid' | 'pending'>('all');

  // Add Unit Modal State (Screen 15: _4)
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [aptNumber, setAptNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [orientation, setOrientation] = useState<'بحري' | 'قبلي' | 'شرقي' | 'واجهة'>('واجهة');
  const [areaSqm, setAreaSqm] = useState('165');
  const [residentName, setResidentName] = useState('');
  const [residentPhone, setResidentPhone] = useState('');
  const [residentRole, setResidentRole] = useState<'مالك مقيم' | 'مستأجر'>('مالك مقيم');

  // Staged Obligations for Add Unit Form (User requested dynamic builder)
  const [isAddingArrearsOpen, setIsAddingArrearsOpen] = useState(false);
  const [stagedObligations, setStagedObligations] = useState<StagedObligation[]>([]);
  const [editingStagedId, setEditingStagedId] = useState<string | null>(null);
  const [obligationType, setObligationType] = useState<'monthly_dues' | 'custom'>('monthly_dues');
  const [obligationAmount, setObligationAmount] = useState(String(currentBuilding.default_monthly_dues || 400));
  const [obligationMonth, setObligationMonth] = useState<number>(new Date().getMonth() + 1);
  const [obligationYear, setObligationYear] = useState<number>(new Date().getFullYear());
  const [obligationCustomTitle, setObligationCustomTitle] = useState('');

  // Year Picker State
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [yearPickerTarget, setYearPickerTarget] = useState<'add_unit' | 'arrears_modal' | 'edit_obl'>('add_unit');
  const [arrearsModalYear, setArrearsModalYear] = useState<number>(new Date().getFullYear());

  // Edit Registered Obligation State (MODAL 6)
  const [editOblModalVisible, setEditOblModalVisible] = useState(false);
  const [editingObl, setEditingObl] = useState<ApartmentObligation | null>(null);
  const [editOblTitle, setEditOblTitle] = useState('');
  const [editOblAmount, setEditOblAmount] = useState('');
  const [editOblMonth, setEditOblMonth] = useState<number>(new Date().getMonth() + 1);
  const [editOblYear, setEditOblYear] = useState<number>(new Date().getFullYear());
  const [editOblNotes, setEditOblNotes] = useState('');
  const [isEditingOblLoading, setIsEditingOblLoading] = useState(false);

  // Unit Details Modal State (MODAL 5: تفاصيل الشقة وسجل المديونيات)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailApt, setSelectedDetailApt] = useState<Apartment | null>(null);

  // Edit Unit Modal State (Screen 18: _18)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApt, setEditingApt] = useState<Apartment | null>(null);
  const [editAptNumber, setEditAptNumber] = useState('');
  const [editFloorNumber, setEditFloorNumber] = useState('');
  const [editResidentName, setEditResidentName] = useState('');
  const [editResidentPhone, setEditResidentPhone] = useState('');
  const [editAreaSqm, setEditAreaSqm] = useState('165');
  const [editOrientation, setEditOrientation] = useState<'بحري' | 'قبلي' | 'شرقي' | 'واجهة'>('واجهة');
  const [editAddArrears, setEditAddArrears] = useState('');
  const [editArrearsTitle, setEditArrearsTitle] = useState('اشتراك شهري متأخر');

  // Dedicated Add Arrears Modal State (MODAL 4)
  const [arrearsModalVisible, setArrearsModalVisible] = useState(false);
  const [arrearsTargetApt, setArrearsTargetApt] = useState<Apartment | null>(null);
  const [arrearsModalType, setArrearsModalType] = useState<'monthly_dues' | 'custom'>('monthly_dues');
  const [arrearsAmountInput, setArrearsAmountInput] = useState('');
  const [arrearsMonthNum, setArrearsMonthNum] = useState<number>(new Date().getMonth() + 1);
  const [arrearsCustomTitleInput, setArrearsCustomTitleInput] = useState('');
  const [arrearsNotesInput, setArrearsNotesInput] = useState('');
  const [modalStagedObligations, setModalStagedObligations] = useState<StagedObligation[]>([]);

  // WhatsApp Invite Modal State (Screen 17: 302)
  const [inviteModalApt, setInviteModalApt] = useState<Apartment | null>(null);

  // Success Banner after adding unit
  const [lastAddedAptNumber, setLastAddedAptNumber] = useState<string | null>(null);
  const [isAddingUnitLoading, setIsAddingUnitLoading] = useState(false);

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

  // Robust building apartments resolution:
  const buildingApartments = useMemo(() => {
    if (!currentBuilding || !currentBuilding.id) {
      return apartments;
    }
    const filtered = apartments.filter(
      (a) => !a.building_id || a.building_id === currentBuilding.id
    );
    return filtered.length > 0 ? filtered : apartments;
  }, [apartments, currentBuilding]);

  // Financial calculations helper for any apartment
  const getApartmentFinancials = useCallback(
    (apt: Apartment) => {
      const aptObls = apartmentObligations.filter(
        (o) =>
          (o.apartment_id && o.apartment_id === apt.id) ||
          (o.apartment_number &&
            String(o.apartment_number).trim() === String(apt.apartment_number).trim())
      );
      const unpaidObls = aptObls.filter((o) => o.status === 'unpaid');
      const paidObls = aptObls.filter((o) => o.status === 'paid');
      const totalOblsDebt = unpaidObls.reduce(
        (sum, o) => sum + (Number(o.amount) || 0),
        0
      );
      const dbArrears = Number(apt.arrears_amount) || 0;
      const effectiveArrears = dbArrears > 0 && totalOblsDebt > 0
        ? Math.min(dbArrears, totalOblsDebt)
        : Math.max(dbArrears, totalOblsDebt);
      const hasDebt = effectiveArrears > 0;
      const isPending =
        apt.payment_status === 'pending' ||
        (apt.payment_status as any) === 'pending_review';
      const isPaid = apt.payment_status === 'paid' && !hasDebt;
      const isOverdue =
        hasDebt ||
        apt.payment_status === 'unpaid' ||
        (apt.payment_status as any) === 'overdue';
      const monthlyDues = currentBuilding.default_monthly_dues || 400;
      const totalDueAmount = effectiveArrears + (isPaid ? 0 : monthlyDues);

      const unitPendingPayments = payments.filter(
        (p) =>
          p.status === 'pending' &&
          ((p.apartment_id && p.apartment_id === apt.id) ||
            (p.apartment_number &&
              String(p.apartment_number).trim() === String(apt.apartment_number).trim()))
      );
      const pendingAmount = unitPendingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      return {
        aptObls,
        unpaidObls,
        paidObls,
        totalOblsDebt,
        effectiveArrears,
        hasDebt,
        isPending,
        isPaid,
        isOverdue,
        monthlyDues,
        totalDueAmount,
        unitPendingPayments,
        pendingAmount,
      };
    },
    [apartmentObligations, currentBuilding.default_monthly_dues, payments]
  );

  // Statistics calculation for the collection hero card (design/_28)
  const stats = useMemo(() => {
    const total = buildingApartments.length;
    let paidCount = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    buildingApartments.forEach((apt) => {
      const f = getApartmentFinancials(apt);
      if (f.isPending) pendingCount++;
      else if (f.isOverdue) overdueCount++;
      else if (f.isPaid) paidCount++;
      else overdueCount++;
    });

    const percent = total > 0 ? Math.round((paidCount / total) * 100) : 0;
    const collected = paidCount * (currentBuilding.default_monthly_dues || 400);

    return { total, paidCount, overdueCount, pendingCount, percent, collected };
  }, [buildingApartments, currentBuilding, getApartmentFinancials]);

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

  // Add or Update Staged Obligation in Add Unit Modal
  const handleAddStagedObligation = () => {
    const amount = parseFloat(obligationAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى كتابة مبلغ المديونية بشكل صحيح.');
      return;
    }

    let finalTitle = '';
    const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === obligationMonth);
    const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${obligationMonth}`;

    if (obligationType === 'monthly_dues') {
      finalTitle = `اشتراك العمارة (${monthLabel} ${obligationYear})`;
    } else {
      if (!obligationCustomTitle.trim()) {
        Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
        return;
      }
      finalTitle = `${obligationCustomTitle.trim()} (${monthLabel} ${obligationYear})`;
    }

    if (editingStagedId) {
      setStagedObligations((prev) =>
        prev.map((o) =>
          o.id === editingStagedId
            ? {
                ...o,
                type: obligationType,
                title: finalTitle,
                amount,
                month: obligationMonth,
                year: obligationYear,
              }
            : o
        )
      );
      setEditingStagedId(null);
      setObligationCustomTitle('');
      Alert.alert('تم التعديل 👍', 'تم تحديث بيانات البند بنجاح في القائمة.');
      return;
    }

    const newItem: StagedObligation = {
      id: 'stg-' + Date.now() + Math.floor(Math.random() * 1000),
      type: obligationType,
      title: finalTitle,
      amount,
      month: obligationMonth,
      year: obligationYear,
    };

    setStagedObligations((prev) => [...prev, newItem]);
    setObligationCustomTitle('');
    // Advance month to next month for convenience!
    setObligationMonth((prev) => (prev < 12 ? prev + 1 : 1));
  };

  const handleEditStagedObligation = (item: StagedObligation) => {
    setEditingStagedId(item.id);
    setObligationType(item.type);
    setObligationAmount(String(item.amount));
    setObligationMonth(item.month);
    setObligationYear(item.year);
    if (item.type === 'custom') {
      const match = item.title.match(/^(.*?)\s*\(/);
      setObligationCustomTitle(match ? match[1].trim() : item.title);
    } else {
      setObligationCustomTitle('');
    }
    setIsAddingArrearsOpen(true);
  };

  const handleCancelEditStagedObligation = () => {
    setEditingStagedId(null);
    setObligationCustomTitle('');
    setObligationAmount(String(currentBuilding.default_monthly_dues || 400));
  };

  const handleRemoveStagedObligation = (id: string) => {
    if (editingStagedId === id) {
      handleCancelEditStagedObligation();
    }
    setStagedObligations((prev) => prev.filter((o) => o.id !== id));
  };

  // Handle Add Unit Submit (Screen 15: _4)
  const handleAddUnitSubmit = async () => {
    if (isAddingUnitLoading) return;
    if (!aptNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الشقة.');
      return;
    }

    const totalStagedArrears = stagedObligations.reduce((sum, item) => sum + item.amount, 0);

    try {
      setIsAddingUnitLoading(true);

      await addApartmentUnit({
        apartmentNumber: aptNumber.trim(),
        floorNumber: floorNumber.trim() || 'الدور الأول',
        wingOrDirection: orientation,
        areaSqm: parseFloat(areaSqm) || 160,
        residentName: residentName.trim() || 'وحدة شاغرة',
        residentPhone: residentPhone.trim() || '',
        arrearsAmount: totalStagedArrears,
        stagedObligations: stagedObligations.map((obl) => ({
          id: obl.id,
          type: obl.type === 'monthly_dues' ? 'monthly_dues' : 'other',
          title: obl.title,
          amount: obl.amount,
          year: obl.year,
          month: obl.month,
          notes: `قيد مديونية مسجل عند تأسيس شقة (${aptNumber.trim()})`,
        })),
      });

      // Clear search and reset filter so the new unit is guaranteed visible below!
      setActiveFilter('all');
      setSearchQuery('');
      setLastAddedAptNumber(aptNumber.trim());
      setAddModalVisible(false);
      setAptNumber('');
      setFloorNumber('');
      setResidentName('');
      setResidentPhone('');
      setStagedObligations([]);
      setIsAddingArrearsOpen(false);

      Alert.alert(
        'تمت إضافة الوحدة بنجاح 🎉',
        stagedObligations.length > 0
          ? `تم تسجيل شقة (${aptNumber.trim()}) بنجاح وإدراج (${stagedObligations.length}) بنود مديونية بإجمالي (${totalStagedArrears.toLocaleString()} ج.م).`
          : `تم تسجيل شقة (${aptNumber.trim()}) بنجاح وإدراجها ضمن سجل وحدات العقار.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إضافة الوحدة');
    } finally {
      setIsAddingUnitLoading(false);
    }
  };

  // Open Edit Modal (Screen 18: _18)
  const openEditModal = (apt: Apartment) => {
    setEditingApt(apt);
    setEditAptNumber(apt.apartment_number);
    setEditFloorNumber(apt.floor_number || '');
    setEditResidentName(apt.occupant_name || apt.resident_name || '');
    setEditResidentPhone(apt.occupant_phone || apt.resident_phone || '');
    setEditAreaSqm(String(apt.area_sqm || 165));
    setEditOrientation((apt.wing_or_direction as any) || 'واجهة');
    setEditAddArrears('');
    setEditArrearsTitle('اشتراك شهري متأخر');
    setEditModalVisible(true);
  };

  // Handle Edit Submit
  const handleEditUnitSubmit = async () => {
    if (!editingApt) return;
    try {
      await updateApartmentUnit(editingApt.id, {
        apartmentNumber: editAptNumber.trim(),
        floorNumber: editFloorNumber.trim(),
        residentName: editResidentName.trim() || 'وحدة شاغرة',
        residentPhone: editResidentPhone.trim(),
        areaSqm: parseFloat(editAreaSqm) || editingApt.area_sqm,
        wingOrDirection: editOrientation,
      });

      // If arrears were also added during edit:
      const arrearsToAdd = parseFloat(editAddArrears) || 0;
      if (arrearsToAdd > 0) {
        await addApartmentObligation({
          apartmentId: editingApt.id,
          apartmentNumber: editAptNumber.trim() || editingApt.apartment_number,
          title: editArrearsTitle.trim() || 'مديونية مسجلة من إدارة الاتحاد',
          amount: arrearsToAdd,
          billingMonth: new Date().toISOString().slice(0, 7),
          notes: 'إضافة مديونية أثناء تعديل ملف الشقة',
        });
      }

      setEditModalVisible(false);
      setEditingApt(null);
      setEditAddArrears('');
      Alert.alert(
        'تم الحفظ بنجاح 👍',
        `تم تحديث بيانات شقة (${editAptNumber.trim()}) بنجاح.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل بيانات الوحدة');
    }
  };

  // Open Dedicated Arrears Modal
  const openArrearsModal = (apt: Apartment) => {
    setArrearsTargetApt(apt);
    setArrearsModalType('monthly_dues');
    setArrearsAmountInput(String(currentBuilding.default_monthly_dues || 400));
    setArrearsMonthNum(new Date().getMonth() + 1);
    setArrearsCustomTitleInput('');
    setArrearsNotesInput('');
    setModalStagedObligations([]);
    setArrearsModalVisible(true);
  };

  const handleAddModalStagedObligation = () => {
    const amount = parseFloat(arrearsAmountInput);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى كتابة مبلغ المديونية بشكل صحيح.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === arrearsMonthNum);
    const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${arrearsMonthNum}`;

    let title = '';
    if (arrearsModalType === 'monthly_dues') {
      title = `اشتراك العمارة (${monthLabel} ${currentYear})`;
    } else {
      if (!arrearsCustomTitleInput.trim()) {
        Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
        return;
      }
      title = `${arrearsCustomTitleInput.trim()} (${monthLabel} ${currentYear})`;
    }

    const newItem: StagedObligation = {
      id: 'mstg-' + Date.now() + Math.floor(Math.random() * 1000),
      type: arrearsModalType,
      title,
      amount,
      month: arrearsMonthNum,
      year: currentYear,
    };

    setModalStagedObligations((prev) => [...prev, newItem]);
    setArrearsCustomTitleInput('');
    setArrearsMonthNum((prev) => (prev < 12 ? prev + 1 : 1));
  };

  const handleRemoveModalStagedObligation = (id: string) => {
    setModalStagedObligations((prev) => prev.filter((o) => o.id !== id));
  };

  // Handle Add Arrears Submit (Handles both staged items or single active item!)
  const handleAddArrearsSubmit = async () => {
    if (!arrearsTargetApt) return;

    let itemsToAdd = [...modalStagedObligations];
    const singleAmount = parseFloat(arrearsAmountInput);
    if (itemsToAdd.length === 0) {
      if (!singleAmount || singleAmount <= 0) {
        Alert.alert('تنبيه', 'يرجى إدخال مبلغ المديونية أو إضافة بنود مديونية للقائمة.');
        return;
      }
      const currentYear = new Date().getFullYear();
      const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === arrearsMonthNum);
      const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${arrearsMonthNum}`;

      let title = '';
      if (arrearsModalType === 'monthly_dues') {
        title = `اشتراك العمارة (${monthLabel} ${currentYear})`;
      } else {
        if (!arrearsCustomTitleInput.trim()) {
          Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
          return;
        }
        title = `${arrearsCustomTitleInput.trim()} (${monthLabel} ${currentYear})`;
      }

      itemsToAdd.push({
        id: 'single-' + Date.now(),
        type: arrearsModalType,
        title,
        amount: singleAmount,
        month: arrearsMonthNum,
        year: currentYear,
      });
    }

    try {
      let totalAmountAdded = 0;
      for (const item of itemsToAdd) {
        const billingMonth = `${item.year}-${String(item.month).padStart(2, '0')}`;
        await addApartmentObligation({
          apartmentId: arrearsTargetApt.id,
          apartmentNumber: arrearsTargetApt.apartment_number,
          title: item.title,
          amount: item.amount,
          billingMonth,
          category: item.type === 'monthly_dues' ? 'monthly_dues' : 'other',
          notes: arrearsNotesInput.trim() || undefined,
        });
        totalAmountAdded += item.amount;
      }

      setArrearsModalVisible(false);
      const targetAptNum = arrearsTargetApt.apartment_number;
      setArrearsTargetApt(null);
      setArrearsAmountInput('');
      setArrearsCustomTitleInput('');
      setArrearsNotesInput('');
      setModalStagedObligations([]);

      Alert.alert(
        'تم تسجيل المديونية بنجاح 📋',
        `تم قيد (${itemsToAdd.length}) بنود مديونية بإجمالي (${totalAmountAdded.toLocaleString('en-US')} ج.م) على شقة (${targetAptNum}).`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إضافة المديونية.');
    }
  };

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

  // Open Edit Modal for a registered obligation (Modal 6)
  const openEditObligationModal = (obl: ApartmentObligation) => {
    setEditingObl(obl);
    setEditOblTitle(obl.title);
    setEditOblAmount(String(obl.amount));
    if (obl.billing_month && obl.billing_month.includes('-')) {
      const parts = obl.billing_month.split('-');
      setEditOblYear(parseInt(parts[0], 10) || new Date().getFullYear());
      setEditOblMonth(parseInt(parts[1], 10) || new Date().getMonth() + 1);
    } else {
      setEditOblYear(new Date().getFullYear());
      setEditOblMonth(new Date().getMonth() + 1);
    }
    setEditOblNotes(obl.notes || '');
    setEditOblModalVisible(true);
  };

  // Save changes to registered obligation
  const handleSaveEditObligationSubmit = async () => {
    if (!editingObl) return;
    const amount = parseFloat(editOblAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من صفر.');
      return;
    }
    if (!editOblTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم أو وصف بند المديونية.');
      return;
    }

    try {
      setIsEditingOblLoading(true);
      const billingMonth = `${editOblYear}-${String(editOblMonth).padStart(2, '0')}`;
      await updateApartmentObligation(editingObl.id, {
        title: editOblTitle.trim(),
        amount,
        billingMonth,
        notes: editOblNotes.trim() || undefined,
      });

      setEditOblModalVisible(false);
      setEditingObl(null);
      Alert.alert('تم التعديل بنجاح ✅', 'تم تحديث بيانات المديونية ورصيد الشقة.');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل المديونية.');
    } finally {
      setIsEditingOblLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Newly Added Unit Success Banner (Screen 16: _21) */}
      {lastAddedAptNumber && (
        <View style={styles.successBanner}>
          <View style={styles.rowAlign}>
            <View style={styles.successIconCircle}>
              <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowAlign}>
                <Text style={styles.successBannerTitle}>
                  تمت إضافة شقة {lastAddedAptNumber} بنجاح لسجل {currentBuilding.name}
                </Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>جديدة</Text>
                </View>
              </View>
              <Text style={styles.successBannerSub}>تم توليد كود الدعوة وتجهيز ملف الشقة</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setLastAddedAptNumber(null)}>
            <MaterialIcons name="close" size={18} color={COLORS.onSecondaryContainer} />
          </TouchableOpacity>
        </View>
      )}

      {/* Financial Summary Hero Card (design/_28) */}
      <View style={styles.collectionHeroCard}>
        <View style={styles.heroGlow1} />
        <View style={styles.heroGlow2} />

        <View style={{ zIndex: 2, gap: 14 }}>
          {/* Top Title & Total Apartments Badge */}
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="analytics" size={20} color={COLORS.primaryFixed} />
              <Text style={styles.heroTitleText}>تحصيل دورة {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</Text>
            </View>
            <View style={styles.unitsCountBadge}>
              <Text style={styles.unitsCountBadgeText}>{stats.total} وحدة مسجلة</Text>
            </View>
          </View>

          {/* Main Gauge & Collected Sum */}
          <View style={styles.rowBetween}>
            {/* Progress Percentage */}
            <View style={styles.rowAlign}>
              <View style={styles.circularGaugeBox}>
                <Text style={styles.circularGaugePercent}>{stats.percent}%</Text>
              </View>
              <View>
                <Text style={styles.gaugePaidText}>{stats.paidCount} من {stats.total} شقة</Text>
                <Text style={styles.gaugeSubText}>تم السداد بالكامل</Text>
              </View>
            </View>

            {/* Total Collected */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.collectedLabelText}>المُحصّل الفعلي</Text>
              <View style={styles.rowAlign}>
                <Text style={styles.collectedSumText}>{stats.collected.toLocaleString('en-US')}</Text>
                <Text style={styles.currencyHeroSub}>ج.م</Text>
              </View>
            </View>
          </View>

          {/* Sub Metric Tiles (Paid / Overdue / Pending) */}
          <View style={styles.threeColumnGrid}>
            <View style={styles.metricTile}>
              <View style={styles.rowAlign}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.statusPaid }]} />
                <Text style={[styles.tileLabel, { color: COLORS.secondaryFixed }]}>مسدد ({stats.paidCount})</Text>
              </View>
              <Text style={styles.tileAmount}>{(stats.paidCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
            </View>

            <View style={styles.metricTile}>
              <View style={styles.rowAlign}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.statusUnpaid }]} />
                <Text style={[styles.tileLabel, { color: COLORS.errorContainer }]}>متأخر ({stats.overdueCount})</Text>
              </View>
              <Text style={styles.tileAmount}>{(stats.overdueCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
            </View>

            <View style={styles.metricTile}>
              <View style={styles.rowAlign}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.statusPending }]} />
                <Text style={[styles.tileLabel, { color: COLORS.tertiaryFixed }]}>تدقيق ({stats.pendingCount})</Text>
              </View>
              <Text style={styles.tileAmount}>{(stats.pendingCount * (currentBuilding.default_monthly_dues || 400)).toLocaleString()} ج.م</Text>
            </View>
          </View>

          {/* Bulk WhatsApp Reminder Button */}
          {stats.overdueCount > 0 && (
            <TouchableOpacity
              style={styles.batchWhatsAppBtn}
              activeOpacity={0.88}
              onPress={() => sendBulkUnpaidReminder()}
            >
              <MaterialIcons name="chat" size={18} color="#FFFFFF" />
              <Text style={styles.batchWhatsAppBtnText}>
                إرسال تذكير واتساب للمتأخرين ({stats.overdueCount} شقق) 📲
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar & Add Unit Action */}
      <View style={styles.rowAlign}>
        <View style={styles.searchBarWrapper}>
          <MaterialIcons name="search" size={20} color={COLORS.onSurfaceVariant} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInputField}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="بحث برقم الشقة، الدور، أو اسم الساكن..."
            placeholderTextColor={COLORS.outline}
          />
        </View>
        <TouchableOpacity
          style={styles.addUnitTopBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <MaterialIcons name="add" size={20} color={COLORS.onPrimary} />
          <Text style={styles.addUnitTopBtnText}>إضافة</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterPillsRow}>
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
            الكل ({stats.total})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'overdue' && styles.filterPillActive]}
          onPress={() => setActiveFilter('overdue')}
        >
          <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusUnpaid }]} />
          <Text style={[styles.filterPillText, activeFilter === 'overdue' && styles.filterPillTextActive]}>
            المديونيات والمتأخرات ({stats.overdueCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'paid' && styles.filterPillActive]}
          onPress={() => setActiveFilter('paid')}
        >
          <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusPaid }]} />
          <Text style={[styles.filterPillText, activeFilter === 'paid' && styles.filterPillTextActive]}>
            المسددين ({stats.paidCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'pending' && styles.filterPillActive]}
          onPress={() => setActiveFilter('pending')}
        >
          <View style={[styles.statusDotSmall, { backgroundColor: COLORS.statusPending }]} />
          <Text style={[styles.filterPillText, activeFilter === 'pending' && styles.filterPillTextActive]}>
            معلق ({stats.pendingCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Units List Cards */}
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

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW UNIT FORM (Screen 15: _4)                             */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBackBar}>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={() => setAddModalVisible(false)}
            >
              <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.barCenterTitle}>إضافة وحدة سكنية جديدة</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>بيانات الوحدة والموقع</Text>

            <View style={styles.twoColumnGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>رقم الشقة *</Text>
                <TextInput
                  style={[styles.textInputField, styles.codeFieldStyle]}
                  value={aptNumber}
                  onChangeText={setAptNumber}
                  placeholder="مثال: 302"
                  placeholderTextColor={COLORS.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>الطابق / الدور</Text>
                <TextInput
                  style={styles.textInputField}
                  value={floorNumber}
                  onChangeText={setFloorNumber}
                  placeholder="مثال: الدور الثالث"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>

            <View style={styles.twoColumnGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>المساحة (م²)</Text>
                <TextInput
                  style={[styles.textInputField, styles.ltrField]}
                  value={areaSqm}
                  onChangeText={setAreaSqm}
                  keyboardType="numeric"
                  placeholder="165"
                  placeholderTextColor={COLORS.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>نوع الواجهة</Text>
                <View style={styles.rowAlign}>
                  {(['واجهة', 'بحري', 'قبلي'] as const).map((dir) => (
                    <TouchableOpacity
                      key={dir}
                      style={[
                        styles.dirChoicePill,
                        orientation === dir && styles.dirChoicePillActive,
                      ]}
                      onPress={() => setOrientation(dir)}
                    >
                      <Text
                        style={[
                          styles.dirChoiceText,
                          orientation === dir && styles.dirChoiceTextActive,
                        ]}
                      >
                        {dir}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>بيانات الساكن أو المالك (اختياري)</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>الاسم بالكامل</Text>
              <TextInput
                style={styles.textInputField}
                value={residentName}
                onChangeText={setResidentName}
                placeholder="مثال: م. أحمد مصطفى"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>رقم هاتف الواتساب</Text>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={residentPhone}
                onChangeText={setResidentPhone}
                keyboardType="phone-pad"
                placeholder="010XXXXXXXX"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.twoColumnGrid}>
              <TouchableOpacity
                style={[
                  styles.roleSelectorPill,
                  residentRole === 'مالك مقيم' && styles.roleSelectorPillActive,
                ]}
                onPress={() => setResidentRole('مالك مقيم')}
              >
                <MaterialIcons name="home" size={18} color={COLORS.primary} />
                <Text style={styles.roleSelectorPillText}>مالك مقيم</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleSelectorPill,
                  residentRole === 'مستأجر' && styles.roleSelectorPillActive,
                ]}
                onPress={() => setResidentRole('مستأجر')}
              >
                <MaterialIcons name="key" size={18} color={COLORS.primary} />
                <Text style={styles.roleSelectorPillText}>مستأجر</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dynamic Arrears & Debt Section */}
          <View style={styles.formSectionCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowAlign}>
                <MaterialIcons name="account-balance-wallet" size={18} color="#B45309" />
                <Text style={[styles.sectionHeaderTitle, { color: '#B45309' }]}>
                  المديونيات والمتأخرات السابقة على الشقة
                </Text>
              </View>
              <Text style={styles.optionalTagText}>اختياري</Text>
            </View>

            <Text style={styles.inputHelpSubText}>
              إذا كانت على الشقة اشتراكات شهور سابقة لم تسدد أو صيانة متراكمة، يمكنك قيدها هنا لتظهر للساكن في حسابه.
            </Text>

            {/* Staged Obligations List (if any already added) */}
            {stagedObligations.length > 0 && (
              <View style={styles.stagedListContainer}>
                <Text style={styles.stagedListHeader}>
                  قائمة المديونيات المقيدة ({stagedObligations.length}):
                </Text>
                {stagedObligations.map((obl, idx) => (
                  <View key={obl.id} style={styles.stagedItemRow}>
                    <View style={styles.rowAlign}>
                      <View style={styles.stagedIndexBadge}>
                        <Text style={styles.stagedIndexBadgeText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stagedItemTitle}>{obl.title}</Text>
                        <Text style={styles.stagedItemSub}>
                          {obl.type === 'monthly_dues' ? 'اشتراك شهري' : 'بند مخصص'} • {obl.year}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rowAlign}>
                      <Text style={styles.stagedItemAmount}>
                        {obl.amount.toLocaleString()} ج.م
                      </Text>
                      <TouchableOpacity
                        style={styles.editStagedBtn}
                        onPress={() => handleEditStagedObligation(obl)}
                      >
                        <MaterialIcons name="edit" size={15} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeStagedBtn}
                        onPress={() => handleRemoveStagedObligation(obl.id)}
                      >
                        <MaterialIcons name="close" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={styles.stagedTotalStrip}>
                  <Text style={styles.stagedTotalLabel}>إجمالي المديونية المسجلة:</Text>
                  <Text style={styles.stagedTotalValue}>
                    {stagedObligations.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} ج.م
                  </Text>
                </View>
              </View>
            )}

            {/* Toggle / Add Arrears Button if not open */}
            {!isAddingArrearsOpen && stagedObligations.length === 0 ? (
              <TouchableOpacity
                style={styles.openAddArrearsBtn}
                onPress={() => setIsAddingArrearsOpen(true)}
              >
                <MaterialIcons name="add-circle-outline" size={18} color="#B45309" />
                <Text style={styles.openAddArrearsBtnText}>+ إضافة مديونية على الشقة</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addArrearsBox}>
                <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                  نوع المديونية المراد إضافتها:
                </Text>

                {/* Two options: اشتراك العمارة vs أخرى */}
                <View style={styles.twoColumnGrid}>
                  <TouchableOpacity
                    style={[
                      styles.arrearsTypeChoiceBtn,
                      obligationType === 'monthly_dues' && styles.arrearsTypeChoiceBtnActive,
                    ]}
                    onPress={() => {
                      setObligationType('monthly_dues');
                      setObligationAmount(String(currentBuilding.default_monthly_dues || 400));
                    }}
                  >
                    <MaterialIcons
                      name="apartment"
                      size={18}
                      color={obligationType === 'monthly_dues' ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.arrearsTypeChoiceText,
                        obligationType === 'monthly_dues' && styles.arrearsTypeChoiceTextActive,
                      ]}
                    >
                      اشتراك العمارة
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.arrearsTypeChoiceBtn,
                      obligationType === 'custom' && styles.arrearsTypeChoiceBtnActive,
                    ]}
                    onPress={() => setObligationType('custom')}
                  >
                    <MaterialIcons
                      name="post-add"
                      size={18}
                      color={obligationType === 'custom' ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.arrearsTypeChoiceText,
                        obligationType === 'custom' && styles.arrearsTypeChoiceTextActive,
                      ]}
                    >
                      أخرى (بند مخصص)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* If "أخرى" is chosen, show full-width input for title */}
                {obligationType === 'custom' && (
                  <View style={[styles.inputGroup, { marginTop: 10 }]}>
                    <Text style={styles.fieldLabel}>اسم البند أو وصف المديونية *</Text>
                    <TextInput
                      style={styles.textInputField}
                      value={obligationCustomTitle}
                      onChangeText={setObligationCustomTitle}
                      placeholder="مثال: صيانة مصعد، استهلاك مياه، إصلاح تسريب"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                )}

                {/* Two inputs side-by-side: Amount and Year */}
                <View style={[styles.inputsRowAligned, { marginTop: 10 }]}>
                  {/* Amount */}
                  <View style={{ flex: 1.6 }}>
                    <Text style={styles.alignedFieldLabel}>المبلغ المستحق (ج.م) *</Text>
                    <TextInput
                      style={[styles.alignedTextInput, styles.ltrField]}
                      value={obligationAmount}
                      onChangeText={setObligationAmount}
                      keyboardType="numeric"
                      placeholder="400"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>

                  {/* Year */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alignedFieldLabel}>السنة *</Text>
                    <TouchableOpacity
                      style={styles.yearPickerButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        setYearPickerTarget('add_unit');
                        setYearPickerVisible(true);
                      }}
                    >
                      <MaterialIcons name="calendar-today" size={15} color="#475569" />
                      <Text style={styles.yearPickerText}>{obligationYear}</Text>
                      <MaterialIcons name="arrow-drop-down" size={20} color="#475569" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Month Select Pills 1 to 12 */}
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.alignedFieldLabel, { marginBottom: 6 }]}>
                    عن شهر (اختر من 1 إلى 12):
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.monthScrollRow}
                  >
                    {MONTHS_CHOICES.map((m) => {
                      const isSelected = obligationMonth === m.num;
                      return (
                        <TouchableOpacity
                          key={m.num}
                          style={[
                            styles.monthSquarePill,
                            isSelected && styles.monthSquarePillActive,
                          ]}
                          onPress={() => setObligationMonth(m.num)}
                        >
                          <Text
                            style={[
                              styles.monthSquareNumber,
                              isSelected && styles.monthSquareNumberActive,
                            ]}
                          >
                            {m.num}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Add / Save Staged Obligation Button */}
                <TouchableOpacity
                  style={[styles.addStagedItemBtn, editingStagedId ? { backgroundColor: '#2563EB' } : null]}
                  activeOpacity={0.88}
                  onPress={handleAddStagedObligation}
                >
                  <MaterialIcons name={editingStagedId ? 'check' : 'add'} size={18} color="#FFFFFF" />
                  <Text style={styles.addStagedItemBtnText}>
                    {editingStagedId ? 'حفظ تعديل هذا البند 💾' : '+ إضافة هذا البند إلى المديونيات'}
                  </Text>
                </TouchableOpacity>

                {editingStagedId && (
                  <TouchableOpacity
                    style={[styles.openAddArrearsBtn, { marginTop: 4, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                    onPress={handleCancelEditStagedObligation}
                  >
                    <Text style={[styles.openAddArrearsBtnText, { color: '#64748B' }]}>إلغاء تعديل هذا البند</Text>
                  </TouchableOpacity>
                )}

                {/* Option to close form if staged items exist */}
                {stagedObligations.length > 0 && (
                  <TouchableOpacity
                    style={styles.cancelArrearsBoxBtn}
                    onPress={() => setIsAddingArrearsOpen(false)}
                  >
                    <Text style={styles.cancelArrearsBoxBtnText}>
                      اكتفاء بالبنود المضافة أعلاه ({stagedObligations.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* If items exist and form is closed, offer "+ إضافة بند مديونية آخر" */}
            {!isAddingArrearsOpen && stagedObligations.length > 0 && (
              <TouchableOpacity
                style={[styles.openAddArrearsBtn, { marginTop: 10 }]}
                onPress={() => setIsAddingArrearsOpen(true)}
              >
                <MaterialIcons name="add-circle-outline" size={18} color="#B45309" />
                <Text style={styles.openAddArrearsBtnText}>+ إضافة بند مديونية آخر للشقة</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryActionButton, isAddingUnitLoading && { opacity: 0.7 }]}
            activeOpacity={0.88}
            onPress={handleAddUnitSubmit}
            disabled={isAddingUnitLoading}
          >
            {isAddingUnitLoading ? (
              <ActivityIndicator size="small" color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="add-home" size={20} color={COLORS.onPrimary} />
                <Text style={styles.primaryActionText}>حفظ وإضافة الوحدة للسجل</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: EDIT UNIT DETAILS (Screen 18: _18)                           */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBackBar}>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={() => setEditModalVisible(false)}
            >
              <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.barCenterTitle}>تعديل بيانات الشقة {editAptNumber}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>تعديل بيانات الوحدة والموقع</Text>

            <View style={styles.twoColumnGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>رقم الشقة *</Text>
                <TextInput
                  style={[styles.textInputField, styles.codeFieldStyle]}
                  value={editAptNumber}
                  onChangeText={setEditAptNumber}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>الطابق / الدور</Text>
                <TextInput
                  style={styles.textInputField}
                  value={editFloorNumber}
                  onChangeText={setEditFloorNumber}
                />
              </View>
            </View>

            <View style={styles.twoColumnGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>المساحة (م²)</Text>
                <TextInput
                  style={[styles.textInputField, styles.ltrField]}
                  value={editAreaSqm}
                  onChangeText={setEditAreaSqm}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>نوع الواجهة</Text>
                <View style={styles.rowAlign}>
                  {(['واجهة', 'بحري', 'قبلي'] as const).map((dir) => (
                    <TouchableOpacity
                      key={dir}
                      style={[
                        styles.dirChoicePill,
                        editOrientation === dir && styles.dirChoicePillActive,
                      ]}
                      onPress={() => setEditOrientation(dir)}
                    >
                      <Text
                        style={[
                          styles.dirChoiceText,
                          editOrientation === dir && styles.dirChoiceTextActive,
                        ]}
                      >
                        {dir}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>بيانات الساكن / المالك</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>اسم الساكن / المالك</Text>
              <TextInput
                style={styles.textInputField}
                value={editResidentName}
                onChangeText={setEditResidentName}
                placeholder="اسم الساكن أو مالك الوحدة"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>رقم الهاتف</Text>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={editResidentPhone}
                onChangeText={setEditResidentPhone}
                keyboardType="phone-pad"
                placeholder="010XXXXXXXX"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Arrears Addition During Edit */}
          <View style={styles.formSectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionHeaderTitle}>إضافة مديونية / التزام مالي على الشقة</Text>
              <Text style={styles.optionalTagText}>اختياري</Text>
            </View>
            <Text style={styles.inputHelpSubText}>
              المديونية الحالية المسجلة: {editingApt?.arrears_amount || editingApt?.unpaid_amount || 0} ج.م
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>المبلغ المراد إضافته (ج.م)</Text>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={editAddArrears}
                onChangeText={setEditAddArrears}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            {editAddArrears && parseFloat(editAddArrears) > 0 ? (
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>بند أو سبب المديونية</Text>
                <TextInput
                  style={styles.textInputField}
                  value={editArrearsTitle}
                  onChangeText={setEditArrearsTitle}
                  placeholder="مثال: اشتراك متأخر أو صيانة مصعد"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.primaryActionButton}
            activeOpacity={0.88}
            onPress={handleEditUnitSubmit}
          >
            <MaterialIcons name="save" size={20} color={COLORS.onPrimary} />
            <Text style={styles.primaryActionText}>حفظ كافة التعديلات والمديونية</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: DEDICATED ADD ARREARS MODAL (إضافة مديونية على الشقة)         */}
      {/* ---------------------------------------------------------------------- */}
      {arrearsTargetApt && (
        <Modal
          visible={arrearsModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setArrearsModalVisible(false)}
        >
          <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
            <View style={styles.topBackBar}>
              <TouchableOpacity
                style={styles.backIconButton}
                onPress={() => setArrearsModalVisible(false)}
              >
                <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
              <Text style={styles.barCenterTitle}>
                إضافة مديونية على شقة {arrearsTargetApt.apartment_number}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Target Apartment Hero Banner */}
            <View style={styles.modalHeroBox}>
              <View style={styles.rowBetween}>
                <View style={styles.rowAlign}>
                  <View style={styles.unitNumberBoxBig}>
                    <Text style={styles.unitNumberBoxBigText}>
                      {arrearsTargetApt.apartment_number}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.modalHeroTitle}>
                      {arrearsTargetApt.occupant_name || arrearsTargetApt.resident_name || 'وحدة شاغرة'}
                    </Text>
                    <Text style={styles.modalHeroSub}>
                      {arrearsTargetApt.floor_number || 'الدور الأول'} • كود الدعوة: {arrearsTargetApt.invite_code || `${currentBuilding.building_code}-${arrearsTargetApt.apartment_number}`}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusPillBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.statusPillBadgeText, { color: '#B45309' }]}>
                    المديونية: {arrearsTargetApt.arrears_amount || arrearsTargetApt.unpaid_amount || 0} ج.م
                  </Text>
                </View>
              </View>
            </View>

            {/* Arrears Input Card */}
            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>تفاصيل المديونية أو الالتزام المالي</Text>
              <Text style={styles.inputHelpSubText}>
                يمكنك قيد اشتراك شهري متأخر أو بند مخصص (صيانة مصعد، استهلاك مياه، إلخ) مع إمكانية إضافة أكثر من بند.
              </Text>

              {/* Staged Obligations List inside Modal (if any) */}
              {modalStagedObligations.length > 0 && (
                <View style={styles.stagedListContainer}>
                  <Text style={styles.stagedListHeader}>
                    البنود المجهزة للقيد ({modalStagedObligations.length}):
                  </Text>
                  {modalStagedObligations.map((obl, idx) => (
                    <View key={obl.id} style={styles.stagedItemRow}>
                      <View style={styles.rowAlign}>
                        <View style={styles.stagedIndexBadge}>
                          <Text style={styles.stagedIndexBadgeText}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stagedItemTitle}>{obl.title}</Text>
                          <Text style={styles.stagedItemSub}>
                            {obl.type === 'monthly_dues' ? 'اشتراك شهري' : 'بند مخصص'} • {obl.year}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rowAlign}>
                        <Text style={styles.stagedItemAmount}>
                          {obl.amount.toLocaleString()} ج.م
                        </Text>
                        <TouchableOpacity
                          style={styles.removeStagedBtn}
                          onPress={() => handleRemoveModalStagedObligation(obl.id)}
                        >
                          <MaterialIcons name="close" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  <View style={styles.stagedTotalStrip}>
                    <Text style={styles.stagedTotalLabel}>إجمالي البنود المجهزة:</Text>
                    <Text style={styles.stagedTotalValue}>
                      {modalStagedObligations.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} ج.م
                    </Text>
                  </View>
                </View>
              )}

              {/* Type Selection: اشتراك العمارة vs أخرى */}
              <Text style={[styles.fieldLabel, { marginBottom: 6, marginTop: 4 }]}>
                نوع المديونية:
              </Text>
              <View style={styles.twoColumnGrid}>
                <TouchableOpacity
                  style={[
                    styles.arrearsTypeChoiceBtn,
                    arrearsModalType === 'monthly_dues' && styles.arrearsTypeChoiceBtnActive,
                  ]}
                  onPress={() => {
                    setArrearsModalType('monthly_dues');
                    setArrearsAmountInput(String(currentBuilding.default_monthly_dues || 400));
                  }}
                >
                  <MaterialIcons
                    name="apartment"
                    size={18}
                    color={arrearsModalType === 'monthly_dues' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.arrearsTypeChoiceText,
                      arrearsModalType === 'monthly_dues' && styles.arrearsTypeChoiceTextActive,
                    ]}
                  >
                    اشتراك العمارة
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.arrearsTypeChoiceBtn,
                    arrearsModalType === 'custom' && styles.arrearsTypeChoiceBtnActive,
                  ]}
                  onPress={() => setArrearsModalType('custom')}
                >
                  <MaterialIcons
                    name="post-add"
                    size={18}
                    color={arrearsModalType === 'custom' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.arrearsTypeChoiceText,
                      arrearsModalType === 'custom' && styles.arrearsTypeChoiceTextActive,
                    ]}
                  >
                    أخرى (بند مخصص)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* If "أخرى" is chosen, show full-width input for title */}
              {arrearsModalType === 'custom' && (
                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <Text style={styles.fieldLabel}>اسم البند أو وصف المديونية *</Text>
                  <TextInput
                    style={styles.textInputField}
                    value={arrearsCustomTitleInput}
                    onChangeText={setArrearsCustomTitleInput}
                    placeholder="مثال: صيانة مصعد، استهلاك مياه، إصلاح تسريب"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>
              )}

              {/* Amount & Year Side-by-Side */}
              <View style={[styles.inputsRowAligned, { marginTop: 10 }]}>
                {/* Amount Input */}
                <View style={{ flex: 1.6 }}>
                  <Text style={styles.alignedFieldLabel}>مبلغ المديونية (ج.م) *</Text>
                  <TextInput
                    style={[styles.alignedTextInput, styles.ltrField]}
                    value={arrearsAmountInput}
                    onChangeText={setArrearsAmountInput}
                    keyboardType="numeric"
                    placeholder="400"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>

                {/* Year Picker */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.alignedFieldLabel}>السنة *</Text>
                  <TouchableOpacity
                    style={styles.yearPickerButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      setYearPickerTarget('arrears_modal');
                      setYearPickerVisible(true);
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={15} color="#475569" />
                    <Text style={styles.yearPickerText}>{arrearsModalYear}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Month Select Pills 1 to 12 */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.alignedFieldLabel, { marginBottom: 6 }]}>
                  عن شهر (اختر من 1 إلى 12):
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthScrollRow}
                >
                  {MONTHS_CHOICES.map((m) => {
                    const isSelected = arrearsMonthNum === m.num;
                    return (
                      <TouchableOpacity
                        key={m.num}
                        style={[
                          styles.monthSquarePill,
                          isSelected && styles.monthSquarePillActive,
                        ]}
                        onPress={() => setArrearsMonthNum(m.num)}
                      >
                        <Text
                          style={[
                            styles.monthSquareNumber,
                            isSelected && styles.monthSquareNumberActive,
                          ]}
                        >
                          {m.num}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Add item to staged list button */}
              <TouchableOpacity
                style={[styles.addStagedItemBtn, { marginTop: 12 }]}
                activeOpacity={0.88}
                onPress={handleAddModalStagedObligation}
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.addStagedItemBtnText}>
                  + إضافة هذا البند إلى قائمة المديونيات
                </Text>
              </TouchableOpacity>

              {/* Notes */}
              <View style={[styles.inputGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>ملاحظات إضافية (اختياري)</Text>
                <TextInput
                  style={[styles.textInputField, { minHeight: 50 }]}
                  value={arrearsNotesInput}
                  onChangeText={setArrearsNotesInput}
                  placeholder="أي ملاحظات لسجل الحسابات"
                  placeholderTextColor={COLORS.outline}
                  multiline
                />
              </View>
            </View>

            {/* Submit Arrears Button */}
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={handleAddArrearsSubmit}
            >
              <MaterialIcons name="add-task" size={20} color={COLORS.onPrimary} />
              <Text style={styles.primaryActionText}>
                {modalStagedObligations.length > 0
                  ? `ترحيل (${modalStagedObligations.length}) بنود مديونية على الشقة`
                  : 'تسجيل المديونية وترحيلها على الشقة'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Modal>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 5: APARTMENT DETAILS & OBLIGATIONS BREAKDOWN (تفاصيل الشقة)       */}
      {/* ---------------------------------------------------------------------- */}
      {activeDetailApt && (
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
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: SHARE WHATSAPP INVITE LINK (Screen 17: 302)                  */}
      {/* ---------------------------------------------------------------------- */}
      {inviteModalApt && (
        <Modal
          visible={Boolean(inviteModalApt)}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setInviteModalApt(null)}
        >
          <View style={styles.modalBackdropDark}>
            <View style={styles.bottomSheetPanel}>
              <View style={styles.sheetGrabBar} />

              <View style={styles.rowBetween}>
                <View style={styles.rowAlign}>
                  <View style={styles.inviteIconCircle}>
                    <MaterialIcons name="person-add" size={22} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.inviteModalTitle}>مشاركة رابط انضمام الساكن</Text>
                    <Text style={styles.inviteModalSub}>
                      شقة {inviteModalApt.apartment_number} • {inviteModalApt.floor_number || 'الدور الأول'} ({inviteModalApt.resident_name || 'مالك جديد'})
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setInviteModalApt(null)}>
                  <MaterialIcons name="close" size={22} color={COLORS.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {/* Code Box */}
              <View style={styles.codeBentoBox}>
                <Text style={styles.codeBentoLabel}>كود الانضمام المباشر للشقة:</Text>
                <Text style={styles.codeBentoText}>
                  {currentBuilding.building_code}-{inviteModalApt.apartment_number}
                </Text>
              </View>

              {/* Share Actions */}
              <View style={styles.twoColumnGrid}>
                <TouchableOpacity
                  style={styles.outlineActionBtn}
                  onPress={() =>
                    copyToClipboard(
                      `${currentBuilding.building_code}-${inviteModalApt.apartment_number}`,
                      'كود دعوة الشقة'
                    )
                  }
                >
                  <MaterialIcons name="content-copy" size={18} color={COLORS.primary} />
                  <Text style={styles.outlineActionBtnText}>نسخ الكود</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsAppActionBtn}
                  onPress={() =>
                    sendWhatsAppInvite({
                      buildingName: currentBuilding.name,
                      buildingCode: `${currentBuilding.building_code}-${inviteModalApt.apartment_number}`,
                      apartmentNumber: inviteModalApt.apartment_number,
                      residentName: inviteModalApt.resident_name || undefined,
                      phone: inviteModalApt.resident_phone || undefined,
                    })
                  }
                >
                  <MaterialIcons name="chat" size={18} color="#FFFFFF" />
                  <Text style={styles.whatsAppActionBtnText}>مشاركة واتساب 📲</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL 6: EDIT REGISTERED OBLIGATION */}
      <Modal
        visible={editOblModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isEditingOblLoading) setEditOblModalVisible(false);
        }}
      >
        <View style={styles.modalBackdropDark}>
          <View style={[styles.bottomSheetPanel, { maxHeight: '90%' }]}>
            <View style={styles.sheetGrabBar} />

            {/* Header */}
            <View style={styles.rowBetween}>
              <View style={styles.rowAlign}>
                <View style={[styles.successIconCircle, { backgroundColor: '#2563EB' }]}>
                  <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.inviteModalTitle}>تعديل بند المديونية</Text>
                  <Text style={styles.inviteModalSub}>
                    تعديل القيمة، الشهر أو وصف الالتزام المسجل
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isEditingOblLoading) setEditOblModalVisible(false);
                }}
              >
                <MaterialIcons name="close" size={22} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
              {/* Obligation Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>اسم / وصف البند *</Text>
                <TextInput
                  style={styles.textInputField}
                  value={editOblTitle}
                  onChangeText={setEditOblTitle}
                  placeholder="مثال: اشتراك شهر 6، صيانة مصعد"
                  placeholderTextColor={COLORS.outline}
                />
              </View>

              {/* Amount and Year */}
              <View style={styles.inputsRowAligned}>
                <View style={{ flex: 1.6 }}>
                  <Text style={styles.alignedFieldLabel}>المبلغ المستحق (ج.م) *</Text>
                  <TextInput
                    style={[styles.alignedTextInput, styles.ltrField]}
                    value={editOblAmount}
                    onChangeText={setEditOblAmount}
                    keyboardType="numeric"
                    placeholder="400"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.alignedFieldLabel}>السنة *</Text>
                  <TouchableOpacity
                    style={styles.yearPickerButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      setYearPickerTarget('edit_obl');
                      setYearPickerVisible(true);
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={15} color="#475569" />
                    <Text style={styles.yearPickerText}>{editOblYear}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Month Pills */}
              <View>
                <Text style={[styles.alignedFieldLabel, { marginBottom: 6 }]}>
                  عن شهر (اختر من 1 إلى 12):
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthScrollRow}
                >
                  {MONTHS_CHOICES.map((m) => {
                    const isSelected = editOblMonth === m.num;
                    return (
                      <TouchableOpacity
                        key={m.num}
                        style={[
                          styles.monthSquarePill,
                          isSelected && styles.monthSquarePillActive,
                        ]}
                        onPress={() => setEditOblMonth(m.num)}
                      >
                        <Text
                          style={[
                            styles.monthSquareNumber,
                            isSelected && styles.monthSquareNumberActive,
                          ]}
                        >
                          {m.num}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>ملاحظات إضافية (اختياري)</Text>
                <TextInput
                  style={[styles.textInputField, { height: 60 }]}
                  value={editOblNotes}
                  onChangeText={setEditOblNotes}
                  placeholder="أي ملاحظات تتعلق بالسداد أو أسباب المديونية..."
                  placeholderTextColor={COLORS.outline}
                  multiline
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  { backgroundColor: '#2563EB', marginTop: 8 },
                  isEditingOblLoading && { opacity: 0.6 },
                ]}
                activeOpacity={0.88}
                disabled={isEditingOblLoading}
                onPress={handleSaveEditObligationSubmit}
              >
                {isEditingOblLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryActionText}>حفظ التعديلات</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* YEAR PICKER MODAL */}
      <Modal
        visible={yearPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdropDark}
          activeOpacity={1}
          onPress={() => setYearPickerVisible(false)}
        >
          <View style={styles.yearPickerSheet}>
            <View style={styles.sheetGrabBar} />
            <Text style={styles.yearPickerSheetTitle}>اختر السنة المالية</Text>
            <View style={styles.yearChoicesGrid}>
              {[2023, 2024, 2025, 2026, 2027, 2028].map((yr) => {
                const currentYr =
                  yearPickerTarget === 'add_unit'
                    ? obligationYear
                    : yearPickerTarget === 'edit_obl'
                    ? editOblYear
                    : arrearsModalYear;
                const isSelected = currentYr === yr;
                return (
                  <TouchableOpacity
                    key={yr}
                    style={[styles.yearChoiceCard, isSelected && styles.yearChoiceCardActive]}
                    onPress={() => {
                      if (yearPickerTarget === 'add_unit') {
                        setObligationYear(yr);
                      } else if (yearPickerTarget === 'edit_obl') {
                        setEditOblYear(yr);
                      } else {
                        setArrearsModalYear(yr);
                      }
                      setYearPickerVisible(false);
                    }}
                  >
                    <Text style={[styles.yearChoiceCardText, isSelected && styles.yearChoiceCardTextActive]}>
                      {yr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

// --------------------------------------------------------------------------
// DESIGN STYLESHEET (Tokens matched to developer_handover_specs v2.4)
// --------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },
  modalFullContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  // Success Banner (Screen 16: _21)
  successBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 108, 73, 0.1)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 108, 73, 0.25)',
  },
  successIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  successBannerSub: {
    fontSize: 11,
    color: COLORS.onSecondaryContainer,
    marginTop: 2,
  },
  newBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Collection Hero Card (design/_28)
  collectionHeroCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#091426',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow1: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -20,
    right: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 108, 73, 0.15)',
  },
  heroTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unitsCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  unitsCountBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryFixed,
  },
  circularGaugeBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.statusPaid,
  },
  circularGaugePercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gaugePaidText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gaugeSubText: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  collectedLabelText: {
    fontSize: 10,
    color: COLORS.primaryFixedDim,
  },
  collectedSumText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
    letterSpacing: -0.5,
  },
  currencyHeroSub: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryFixed,
    marginLeft: 4,
  },
  threeColumnGrid: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 8,
  },
  metricTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  tileAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  batchWhatsAppBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: COLORS.secondary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  batchWhatsAppBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Search Bar
  searchBarWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
  searchInputField: {
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 12,
    paddingRight: 38,
    fontSize: 13,
    color: COLORS.onSurface,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  addUnitTopBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addUnitTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },

  // Filter Pills
  filterPillsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 6,
  },
  filterPill: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPillText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Unit Cards
  unitDirectoryCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
    gap: 10,
  },
  unitNumberBoxBig: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitNumberBoxBigText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  unitResidentName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  unitMetaSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  statusPillBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusPillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.statusUnpaidText,
  },
  unitCardBottomStrip: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  arrearsLabelText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  arrearsValText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.statusUnpaid,
  },
  iconActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  emptyStateSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },

  // Common Modal Styles
  topBackBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCenterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  formSectionCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 12,
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  twoColumnGrid: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  textInputField: {
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCanvas,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.onSurface,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  codeFieldStyle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  ltrField: {
    textAlign: 'left',
  },
  dirChoicePill: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirChoicePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dirChoiceText: {
    fontSize: 12,
    color: COLORS.onSurface,
  },
  dirChoiceTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roleSelectorPill: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleSelectorPillActive: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.primary,
  },
  roleSelectorPillText: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  primaryActionButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1E293B',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },

  // WhatsApp Invite Sheet (Screen 17: 302)
  modalBackdropDark: {
    flex: 1,
    backgroundColor: 'rgba(9, 20, 38, 0.65)',
    justifyContent: 'flex-end',
  },
  bottomSheetPanel: {
    backgroundColor: COLORS.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  sheetGrabBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderSubtle,
    alignSelf: 'center',
    marginBottom: 4,
  },
  inviteIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  inviteModalSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  codeBentoBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  codeBentoLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  codeBentoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  outlineActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.primaryContainer,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  whatsAppActionBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#25D366',
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#25D366',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  whatsAppActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Helpers
  rowAlign: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Arrears Modal & Action styles
  arrearsActionBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  arrearsChoicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  arrearsChoicePillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  arrearsChoiceText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  arrearsChoiceTextActive: {
    color: '#B45309',
    fontWeight: '700',
  },
  modalHeroBox: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 14,
    gap: 6,
  },
  modalHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  modalHeroSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  inputHelpSubText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginBottom: 8,
  },
  optionalTagText: {
    fontSize: 11,
    color: COLORS.outline,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },

  // Staged Obligations List & Builder Styles
  stagedListContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginTop: 4,
  },
  stagedListHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },
  stagedItemRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  stagedIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stagedIndexBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  stagedItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  stagedItemSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 1,
  },
  stagedItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  removeStagedBtn: {
    padding: 4,
  },
  editStagedBtn: {
    padding: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    marginRight: 4,
  },
  stagedTotalStrip: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 4,
  },
  stagedTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  stagedTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
  openAddArrearsBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  openAddArrearsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  addArrearsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    gap: 10,
    marginTop: 8,
  },
  arrearsTypeChoiceBtn: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  arrearsTypeChoiceBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  arrearsTypeChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  arrearsTypeChoiceTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  monthScrollRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 6,
    paddingVertical: 4,
  },
  monthChoicePill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minWidth: 54,
  },
  monthChoicePillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#0F172A',
  },
  monthChoiceNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  monthChoiceNumberActive: {
    color: '#FFFFFF',
  },
  monthChoiceName: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  monthChoiceNameActive: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  addStagedItemBtn: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  addStagedItemBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelArrearsBoxBtn: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelArrearsBoxBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  arrearsAlertBox: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 4,
  },
  arrearsAlertBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
    textAlign: 'right',
  },
  viewDetailsHintText: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  arrearsBreakdownSubText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'right',
  },

  // Apartment Details Modal Styles
  unitDetailHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  detailCardResidentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailCardMetaSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  calmMetricTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 4,
  },
  calmTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  calmTileAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  contactBarRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 8,
    marginTop: 6,
  },
  contactBtnPill: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  contactBtnPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inviteCodeRowBox: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  inviteCodeLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  inviteCodeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  copyInviteBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyInviteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  smallAddObligationBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  smallAddObligationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputsRowAligned: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
    alignItems: 'flex-start',
  },
  alignedFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
    marginBottom: 6,
    textAlign: 'right',
  },
  alignedTextInput: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.onSurface,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  yearPickerButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  yearPickerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  monthSquarePill: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthSquarePillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  monthSquareNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  monthSquareNumberActive: {
    color: '#FFFFFF',
  },
  yearPickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  yearPickerSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  yearChoicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  yearChoiceCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 90,
    alignItems: 'center',
  },
  yearChoiceCardActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  yearChoiceCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  yearChoiceCardTextActive: {
    color: '#FFFFFF',
  },
  emptyObligationsBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  emptyObligationsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  emptyObligationsSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  obligationDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  obligationDetailCardUnpaid: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  obligationDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  obligationDetailSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  transferredTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
  obligationNotesText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'right',
  },
  obligationDetailAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
  obligationActionsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  obligationEditBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  obligationEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  obligationDeleteBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  obligationDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  settleObligationBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  settleObligationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  paymentHistoryRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentHistoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  paymentHistorySub: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  paymentHistoryAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  paymentHistoryStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  unitPendingBannerBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  approveNowBtn: {
    backgroundColor: '#059669',
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  approveNowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

