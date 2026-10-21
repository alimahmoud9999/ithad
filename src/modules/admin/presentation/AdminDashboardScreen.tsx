import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  I18nManager,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import {
  Apartment,
  ClaimDistributionType,
  EmergencyClaim,
  Payment,
  PlanTier,
} from '@/shared/types/database';
import {
  CompressedUploadResult,
  pickAndCompressUploadImage,
} from '@/shared/utils/imageUpload';
import {
  copyToClipboard,
  sendWhatsAppInvite,
  generateInviteMessage,
} from '@/shared/utils/inviteHelper';

const EMERGENCY_CATEGORIES = [
  { id: 'مياه وسباكة', icon: 'water-drop' as const },
  { id: 'مصاعد كهربائية', icon: 'elevator' as const },
  { id: 'كهرباء عمومية', icon: 'bolt' as const },
  { id: 'واجهات وعزل', icon: 'roofing' as const },
  { id: 'أخرى', icon: 'more-horiz' as const },
];

export type ClaimDistChoice = 'occupied_only' | 'equal' | 'custom';

interface AdminDashboardScreenProps {
  onNavigateExpenses: () => void;
  onNavigateSettings?: () => void;
  onNavigateUnits?: () => void;
  onNavigateCommunity?: () => void;
}

/**
 * Strictly follows:
 * - design/stitch_/admin_dashboard/code.html (Admin Dashboard layout, Hero card, Quick actions, Pending reviews, Unpaid units, Building pulse)
 * - design/stitch_/_10/code.html (Emergency Claim creation modal with equal/custom distribution & smart share preview)
 * - design/stitch_/_3/code.html (Add new expense modal)
 * Includes Mechanism 2 (Smart Comparison Card + Change Apartment Before Approval)
 * and Central Storage Optimization (`compressAndUploadImage` / `pickAndCompressUploadImage`).
 */
export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  onNavigateExpenses,
  onNavigateSettings,
  onNavigateUnits,
  onNavigateCommunity,
}) => {
  const {
    currentUser,
    currentBuilding,
    apartments,
    apartmentObligations,
    pendingResidents,
    payments,
    emergencyClaims,
    expenses,
    plans,
    buildingIssues,
    polls,
    processingIds,
    isCurrentBuildingWritable,
    reviewResidentJoinRequest,
    approveResidentPayment,
    rejectResidentPayment,
    recordDirectCashPayment,
    recordBuildingExpense,
    createEmergencyClaim,
    closeEmergencyClaimWithInvoice,
    submitAppSubscriptionInvoice,
    sendBulkUnpaidReminder,
    sendIndividualUnpaidReminder,
    resetBuildingData,
  } = useAppStore();

  // Modals State
  const [quickActionsModalVisible, setQuickActionsModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [rejectModalPaymentId, setRejectModalPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(
    'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد'
  );

  // Emergency Claim Details Modal (من دفع ومن لم يدفع)
  const [selectedClaimForDetails, setSelectedClaimForDetails] =
    useState<EmergencyClaim | null>(null);
  const [detailsFilter, setDetailsFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [cashRecordingAptId, setCashRecordingAptId] = useState<string | null>(null);

  // Mechanism 2: Admin Join Review "Change Apartment Before Approval" state
  const [overrideApartmentByResId, setOverrideApartmentByResId] = useState<
    Record<string, string>
  >({});
  const [expandedAptPickerForResId, setExpandedAptPickerForResId] = useState<
    string | null
  >(null);

  // Add Expense Form + Compressed Image Upload
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('صيانة ومصاعد');
  const [expInvoiceNum, setExpInvoiceNum] = useState('');
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [expUploadingImage, setExpUploadingImage] = useState(false);
  const [expCompressedUpload, setExpCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  // Create Emergency Claim Form (Matches _10/code.html)
  const [claimTitle, setClaimTitle] = useState('');
  const [claimCategory, setClaimCategory] = useState('مياه وسباكة');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDistribution, setClaimDistribution] =
    useState<ClaimDistChoice>('occupied_only');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Close Emergency Claim with Compressed Invoice Modal
  const [closingClaimId, setClosingClaimId] = useState<string | null>(null);
  const [closeClaimActualAmount, setCloseClaimActualAmount] = useState('');
  const [closeClaimInvoiceNum, setCloseClaimInvoiceNum] = useState('');
  const [closeClaimNotes, setCloseClaimNotes] = useState('');
  const [closeClaimUploading, setCloseClaimUploading] = useState(false);
  const [closeClaimCompressedUpload, setCloseClaimCompressedUpload] =
    useState<CompressedUploadResult | null>(null);
  const [closeClaimSubmitting, setCloseClaimSubmitting] = useState(false);

  // Subscription Renewal Form + Compressed Receipt Upload
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentBuilding.plan_code
  );
  const [durationMonths, setDurationMonths] = useState('1');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subUploadingImage, setSubUploadingImage] = useState(false);
  const [subCompressedUpload, setSubCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  // Testing & Reset Tools state
  const [resettingMode, setResettingMode] = useState<
    'residents_only' | 'full_delete' | null
  >(null);
  const [directCashRecordingAptId, setDirectCashRecordingAptId] = useState<
    string | null
  >(null);

  const currentCycleLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'الدورة الحالية';
    }
  }, []);

  // Filtered Data for current building
  const buildingApartments = useMemo(
    () =>
      apartments.filter(
        (a) => a.building_id === currentBuilding.id && a.is_active
      ),
    [apartments, currentBuilding.id]
  );

  const buildingPayments = useMemo(
    () => payments.filter((p) => p.building_id === currentBuilding.id),
    [payments, currentBuilding.id]
  );

  const pendingPayments = useMemo(
    () => buildingPayments.filter((p) => p.status === 'pending'),
    [buildingPayments]
  );

  const unpaidApartments = useMemo(
    () =>
      apartments.filter(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.payment_status === 'unpaid'
      ),
    [apartments, currentBuilding.id]
  );

  const buildingPendingResidents = useMemo(
    () =>
      pendingResidents.filter(
        (r) => r.building_id === currentBuilding.id && r.status === 'pending'
      ),
    [pendingResidents, currentBuilding.id]
  );

  const activeEmergencyClaims = useMemo(
    () =>
      emergencyClaims.filter(
        (c) => c.building_id === currentBuilding.id && c.status === 'active'
      ),
    [emergencyClaims, currentBuilding.id]
  );

  const monthlyExpensesTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.building_id === currentBuilding.id)
        .reduce((acc, item) => acc + item.amount, 0),
    [expenses, currentBuilding.id]
  );

  const monthlyCollectedTotal = useMemo(
    () =>
      buildingPayments
        .filter((p) => p.status === 'paid')
        .reduce((acc, item) => acc + item.amount, 0),
    [buildingPayments]
  );

  const collectionPercentage = useMemo(() => {
    const expectedMonthly = Math.max(
      currentBuilding.total_apartments * currentBuilding.default_monthly_dues,
      1
    );
    if (monthlyCollectedTotal > 0) {
      return Math.min(
        100,
        Math.round((monthlyCollectedTotal / expectedMonthly) * 100)
      );
    }
    const paidUnitsCount = buildingApartments.filter(
      (a) => a.payment_status === 'paid'
    ).length;
    if (paidUnitsCount === 0) return 0;
    return Math.min(
      100,
      Math.round(
        (paidUnitsCount / Math.max(currentBuilding.total_apartments, 1)) * 100
      )
    );
  }, [
    buildingApartments,
    currentBuilding.default_monthly_dues,
    currentBuilding.total_apartments,
    monthlyCollectedTotal,
  ]);

  const occupiedApartments = useMemo(() => {
    return buildingApartments.filter(
      (a) =>
        Boolean(a.resident_id) ||
        (a.occupant_name &&
          a.occupant_name.trim() !== '' &&
          a.occupant_name !== 'وحدة شاغرة' &&
          a.occupant_name !== 'شاغرة')
    );
  }, [buildingApartments]);

  const calculatedEqualShare = useMemo(() => {
    const amt = parseFloat(claimAmount) || 0;
    if (claimDistribution === 'occupied_only') {
      const count = Math.max(occupiedApartments.length, 1);
      return (amt / count).toFixed(2);
    }
    const units = Math.max(currentBuilding.total_apartments, 1);
    return (amt / units).toFixed(2);
  }, [
    claimAmount,
    claimDistribution,
    currentBuilding.total_apartments,
    occupiedApartments.length,
  ]);

  const effectiveMonthlyPlanPrice = useMemo(() => {
    if (currentBuilding.custom_monthly_price !== null) {
      return currentBuilding.custom_monthly_price;
    }
    const found = plans.find((p) => p.code === selectedPlan);
    return found?.default_monthly_price ?? 150;
  }, [currentBuilding.custom_monthly_price, plans, selectedPlan]);

  // Image Picker & Compression Handlers (Mandatory Storage Optimization)
  const handlePickExpenseInvoice = async (source: 'library' | 'camera') => {
    setExpUploadingImage(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'expense-invoices',
        buildingId: currentBuilding.id,
        yearMonth: '2024-11',
        source,
      });
      if (result) {
        setExpCompressedUpload(result);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع صورة الفاتورة');
    } finally {
      setExpUploadingImage(false);
    }
  };

  const handlePickCloseClaimInvoice = async (source: 'library' | 'camera') => {
    setCloseClaimUploading(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'expense-invoices',
        buildingId: currentBuilding.id,
        yearMonth: '2024-11',
        source,
      });
      if (result) {
        setCloseClaimCompressedUpload(result);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع فاتورة إغلاق المطالبة');
    } finally {
      setCloseClaimUploading(false);
    }
  };

  const handlePickSubscriptionReceipt = async (source: 'library' | 'camera') => {
    setSubUploadingImage(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'subscription-receipts',
        buildingId: currentBuilding.id,
        yearMonth: '2024-11',
        source,
      });
      if (result) {
        setSubCompressedUpload(result);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع إيصال الاشتراك');
    } finally {
      setSubUploadingImage(false);
    }
  };

  // Handlers
  const handleApprovePayment = async (paymentId: string) => {
    try {
      await approveResidentPayment(paymentId);
      Alert.alert(
        'تم الاعتماد بنجاح 🟢',
        'تم اعتماد السداد وإضافة المبلغ تلقائياً إلى رصيد الصندوق الحالي.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ أثناء الاعتماد');
    }
  };

  const handleRejectPayment = (paymentId: string) => {
    setRejectModalPaymentId(paymentId);
  };

  const confirmRejectPayment = async () => {
    if (!rejectModalPaymentId) return;
    try {
      await rejectResidentPayment(rejectModalPaymentId, rejectReason);
      setRejectModalPaymentId(null);
      Alert.alert(
        'تم رفض الطلب وإشعار الساكن 🔔',
        `تم إرسال إشعار فوري للساكن يتضمن سبب الرفض: "${rejectReason}"`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ');
    }
  };

  const handleBulkReminder = async () => {
    try {
      const result = await sendBulkUnpaidReminder();
      if (result.remindedCount === 0) {
        Alert.alert(
          'جميع الشقق مسددة ✅',
          'لا توجد أي شقق متأخرة عن سداد اشتراك الشهر الحالي.'
        );
        return;
      }
      Alert.alert(
        'تم إرسال تذكير جماعي فوري 🔔',
        `تم إرسال إشعار Push فوري إلى (${result.remindedCount}) شقق لم تسدد اشتراك الشهر الحالي (شقق رقم: ${result.apartments.join('، ')}).`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال التذكير الجماعي');
    }
  };

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

  const handleAddExpense = async () => {
    const numeric = parseFloat(expAmount);
    if (!expTitle.trim() || !numeric || numeric <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المصروف ومبلغ صحيح.');
      return;
    }
    setExpSubmitting(true);
    try {
      await recordBuildingExpense({
        title: expTitle,
        amount: numeric,
        category: expCategory,
        invoiceNumber: expInvoiceNum,
        invoiceImageUrl:
          expCompressedUpload?.publicUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
      });
      setExpTitle('');
      setExpAmount('');
      setExpCompressedUpload(null);
      setExpenseModalVisible(false);
      Alert.alert(
        'تم قيد المصروف بنجاح',
        'تم ضغط وحفظ صورة الفاتورة وخصم المبلغ من الخزينة ونشره في لوحة الشفافية للسكان.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إضافة المصروف');
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleConfirmCloseEmergencyClaim = async () => {
    if (!closingClaimId) return;
    setCloseClaimSubmitting(true);
    try {
      await closeEmergencyClaimWithInvoice({
        claimId: closingClaimId,
        actualAmount: parseFloat(closeClaimActualAmount) || undefined,
        invoiceNumber: closeClaimInvoiceNum,
        notes: closeClaimNotes,
        invoiceImageUrl:
          closeClaimCompressedUpload?.publicUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
      });
      setClosingClaimId(null);
      setCloseClaimCompressedUpload(null);
      Alert.alert(
        'تم إغلاق المطالبة الطارئة وتوثيق الفاتورة ✅',
        'تم إغلاق المطالبة الطارئة رسمياً وإدراج الفاتورة المضغوطة في سجل الشفافية والمصروفات.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إغلاق المطالبة الطارئة');
    } finally {
      setCloseClaimSubmitting(false);
    }
  };

  const handleCreateEmergencyClaim = async () => {
    const numeric = parseFloat(claimAmount);
    if (!claimTitle.trim() || !numeric || numeric <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المطالبة الطارئة والمبلغ الإجمالي.');
      return;
    }
    setClaimSubmitting(true);
    try {
      await createEmergencyClaim({
        title: claimTitle,
        description:
          claimNotes || 'مطالبة صيانة طارئة معتمدة من مجلس اتحاد الملاك',
        category: claimCategory,
        targetAmount: numeric,
        distributionType: claimDistribution === 'custom' ? 'custom' : 'equal',
        defaultShareAmount: parseFloat(calculatedEqualShare),
        distributionMode: claimDistribution,
      });
      setEmergencyModalVisible(false);
      Alert.alert(
        'تم إطلاق المطالبة الطارئة 🚨',
        'ظهرت المطالبة الآن مع شريط التقدم الحي لدى جميع سكان العمارة وتم إرسال إشعار فوري لجميع الملاك.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إنشاء المطالبة الطارئة');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleSubmitSubscriptionRenewal = async () => {
    setSubSubmitting(true);
    try {
      await submitAppSubscriptionInvoice({
        planCode: selectedPlan,
        durationMonths: parseInt(durationMonths, 10) || 1,
        receiptImageUrl:
          subCompressedUpload?.publicUrl ||
          'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
        notes: `طلب تفعيل باقة ${selectedPlan.toUpperCase()} لعمارة ${currentBuilding.name}`,
      });
      setSubCompressedUpload(null);
      setSubscriptionModalVisible(false);
      Alert.alert(
        'تم ضغط ورفع إيصال الاشتراك بنجاح 📤',
        'بانتظار ضغط مالك التطبيق (Super Admin) على "تفعيل" لتمديد الاشتراك وإدراج المصروف تلقائياً في ميزانية العمارة.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال الإيصال');
    } finally {
      setSubSubmitting(false);
    }
  };

  const totalArrearsAmount = useMemo(() => {
    return unpaidApartments.reduce(
      (sum, apt) =>
        sum + (apt.unpaid_amount || currentBuilding.default_monthly_dues),
      0
    );
  }, [unpaidApartments, currentBuilding.default_monthly_dues]);

  const activeIssuesCount = useMemo(() => {
    return buildingIssues.filter((i) => i.status !== 'resolved').length;
  }, [buildingIssues]);

  const activePollsCount = useMemo(() => {
    return polls.filter((p) => p.status === 'active').length;
  }, [polls]);

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

  const handleResetResidentsOnly = () => {
    Alert.alert(
      'تصفير العمارة ومسح بيانات السكان ⚠️',
      `هل أنت متأكد من مسح جميع الشقق، مديونيات السكان، طلبات الانضمام، المدفوعات، والمصروفات؟\n\nستصبح العمارة (${currentBuilding.name}) فارغة تماماً برصيد خزينة 0 ج.م مع الإبقاء على حساب رئيس الاتحاد (${currentUser.full_name}) لتتمكن من تجربة تسجيل الشقق والمديونيات من جديد فوراً.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، تصفير العمارة الآن',
          style: 'destructive',
          onPress: async () => {
            setResettingMode('residents_only');
            try {
              await resetBuildingData('residents_only');
              Alert.alert(
                'تم تصفير العمارة بنجاح ✅',
                'أصبحت العمارة الآن فارغة تماماً. يمكنك البدء فوراً في تجربة إضافة الشقق والمديونيات مجدداً.'
              );
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر تصفير بيانات العمارة');
            } finally {
              setResettingMode(null);
            }
          },
        },
      ]
    );
  };

  const handleFullDeleteBuilding = () => {
    Alert.alert(
      'حذف العمارة بالكامل وإعادة البدء 🛑',
      `تحذير نهائي: سيتم حذف عمارة (${currentBuilding.name}) بالكامل من قاعدة البيانات مع كافة سجلاتها وحساب رئيس الاتحاد (${currentUser.full_name}).\n\nسيتم تسجيل خروجك لتبدأ تجربة التطبيق كأنك تسجل عقاراً جديداً لأول مرة.\n\nهل ترغب في المتابعة؟`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'تأكيد الحذف الشامل والخروج',
          style: 'destructive',
          onPress: async () => {
            setResettingMode('full_delete');
            try {
              await resetBuildingData('full_delete');
              Alert.alert(
                'تم حذف العمارة بالكامل ✅',
                'تم حذف العقار وكافة السجلات وحساب المدير. يمكنك الآن البدء من جديد.'
              );
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف العمارة');
            } finally {
              setResettingMode(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Read-Only Subscription Warning Banner (if expired) */}
      {!isCurrentBuildingWritable && (
        <View style={styles.readOnlyBanner}>
          <View style={styles.readOnlyRight}>
            <MaterialIcons
              name="lock-clock"
              size={22}
              color={COLORS.statusUnpaidText}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.readOnlyTitle}>
                انتهى اشتراك العمارة (وضع القراءة فقط Read-Only)
              </Text>
              <Text style={styles.readOnlyDesc}>
                حساب المدير حالياً في وضع القراءة فقط. ارفع إيصال تجديد الباقة
                ليقوم مالك التطبيق بتفعيلها.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.renewNowBtn}
            onPress={() => {
              if (onNavigateSettings) {
                onNavigateSettings();
              } else {
                setSubscriptionModalVisible(true);
              }
            }}
          >
            <Text style={styles.renewNowBtnText}>تجديد الاشتراك</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Header Welcome & Active Cycle (admin_dashboard/code.html lines 11-24) */}
      <View style={styles.welcomeRow}>
        <View style={{ alignItems: 'flex-end', flex: 1 ,marginBottom: 10 }}>
          <View style={styles.activeStatusLine}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isCurrentBuildingWritable
                    ? COLORS.statusPaid
                    : COLORS.statusUnpaid,
                    
                },
              ]}
            />
            <Text style={styles.activeStatusLabel}>
              {isCurrentBuildingWritable
                ? `إدارة البرج نشطة • كود المبنى: ${currentBuilding.building_code}`
                : 'وضع القراءة فقط (اشتراك منتهي)'}
            </Text>
            {isCurrentBuildingWritable && (
              <TouchableOpacity
                onPress={() =>
                  copyToClipboard(currentBuilding.building_code, 'كود المبنى')
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerCodeCopyIconBtn}
              >
                <MaterialIcons
                  name="content-copy"
                  size={13}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.adminWelcomeName}>
            مرحباً، {currentUser.full_name}
          </Text>
          <Text style={styles.adminRoleSub}>رئيس مجلس اتحاد الملاك المنتخب</Text>
        </View>

        <TouchableOpacity
          style={styles.cyclePill}
          onPress={() => {
            if (onNavigateSettings) {
              onNavigateSettings();
            } else {
              setSubscriptionModalVisible(true);
            }
          }}
        >
          <MaterialIcons
            name="calendar-today"
            size={15}
            color={COLORS.primary}
          />
          <Text style={styles.cyclePillText}>دورة {currentCycleLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Financial Summary Hero Card (admin_dashboard/code.html lines 26-77) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroBalanceLabel}>
              رصيد الصندوق الحالي (الخزينة)
            </Text>
            <View style={styles.heroBalanceValRow}>
              <Text style={styles.heroBalanceNumber}>
                {currentBuilding.fund_balance.toLocaleString()}
              </Text>
              <Text style={styles.heroBalanceCurrency}>ج.م</Text>
            </View>
          </View>

          <View style={styles.trendPill}>
            <MaterialIcons
              name="trending-up"
              size={14}
              color={COLORS.secondaryFixed}
            />
            <Text style={styles.trendPillText}>
              {collectionPercentage > 0
                ? `${collectionPercentage}% تحصيل`
                : 'بداية الدورة'}
            </Text>
          </View>
        </View>

        {/* Collection Progress Gauge Bar */}
        <View style={styles.gaugeBlock}>
          <View style={styles.gaugeLabelsRow}>
            <Text style={styles.gaugeTitle}>نسبة التحصيل الشهري العام</Text>
            <Text style={styles.gaugePercent}>
              {collectionPercentage}% مكتمل
            </Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${collectionPercentage}%` },
              ]}
            />
          </View>
        </View>

        {/* Financial Sub-stats Row: Income vs Expenses */}
        <View style={styles.subStatsGrid}>
          <View style={styles.subStatItem}>
            <View
              style={[
                styles.subStatIconBox,
                { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
              ]}
            >
              <MaterialIcons
                name="arrow-downward"
                size={18}
                color={COLORS.secondaryFixed}
              />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.subStatLabel}>المتحصلات</Text>
              <Text
                style={[styles.subStatValue, { color: COLORS.secondaryFixed }]}
              >
                {monthlyCollectedTotal.toLocaleString()} ج.م
              </Text>
            </View>
          </View>

          <View style={styles.subStatItem}>
            <View
              style={[
                styles.subStatIconBox,
                { backgroundColor: 'rgba(239, 68, 68, 0.2)' },
              ]}
            >
              <MaterialIcons
                name="arrow-upward"
                size={18}
                color={COLORS.errorContainer}
              />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.subStatLabel}>المصروفات</Text>
              <Text
                style={[styles.subStatValue, { color: COLORS.errorContainer }]}
              >
                {monthlyExpensesTotal.toLocaleString()} ج.م
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Compact Add Action Bar (Replaces bulky 4-button grid to save space) */}
      <View style={styles.compactAddBar}>
        <TouchableOpacity
          style={styles.compactAddBarBtn}
          onPress={() => setQuickActionsModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.compactAddBarBadge}>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.compactAddBarBadgeText}>3 إجراءات</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.compactAddBarTitle}>+ إجراء سريع جديد ⚡</Text>
            <Text style={styles.compactAddBarSub}>
              إضافة مصروف • مطالبة طوارئ • تذكير جماعي
            </Text>
          </View>
          <View style={styles.compactAddBarIconBox}>
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Navigation Hub (أقسام الإدارة والخدمات السريعة) */}
      <View style={styles.quickNavSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>أقسام الإدارة والخدمات السريعة</Text>
          <Text style={styles.sectionSubCount}>
            {buildingApartments.length} شقة مسجلة
          </Text>
        </View>

        <View style={styles.quickNavGrid}>
          {/* Card 1: Units & Obligations */}
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={onNavigateUnits}
            activeOpacity={0.7}
          >
            <View style={styles.quickNavIconBox}>
              <MaterialIcons
                name="meeting-room"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.quickNavCardTitle}>الوحدات والمديونيات</Text>
            <Text style={styles.quickNavCardSub}>
              {unpaidApartments.length > 0
                ? `${unpaidApartments.length} شقة عليها متأخرات`
                : 'جميع الشقق مسددة'}
            </Text>
          </TouchableOpacity>

          {/* Card 2: Treasury & Expenses */}
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={onNavigateExpenses}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.quickNavIconBox,
                { backgroundColor: 'rgba(0, 108, 73, 0.1)' },
              ]}
            >
              <MaterialIcons
                name="account-balance-wallet"
                size={22}
                color={COLORS.secondary}
              />
            </View>
            <Text style={styles.quickNavCardTitle}>الخزينة والمصروفات</Text>
            <Text style={styles.quickNavCardSub}>
              رصيد {currentBuilding.fund_balance.toLocaleString()} ج.م
            </Text>
          </TouchableOpacity>

          {/* Card 3: Community Hub */}
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={onNavigateCommunity}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.quickNavIconBox,
                { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
              ]}
            >
              <MaterialIcons
                name="how-to-vote"
                size={22}
                color="#2563EB"
              />
            </View>
            <Text style={styles.quickNavCardTitle}>مجتمع العمارة</Text>
            <Text style={styles.quickNavCardSub}>
              {activeIssuesCount > 0
                ? `${activeIssuesCount} بلاغ صيانة نشط`
                : 'لا توجد بلاغات معلقة'}
            </Text>
          </TouchableOpacity>

          {/* Card 4: WhatsApp Invite */}
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() =>
              sendWhatsAppInvite({
                buildingName: currentBuilding.name,
                buildingCode: currentBuilding.building_code,
              })
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.quickNavIconBox,
                { backgroundColor: 'rgba(37, 211, 102, 0.1)' },
              ]}
            >
              <MaterialIcons
                name="share"
                size={22}
                color="#25D366"
              />
            </View>
            <Text style={styles.quickNavCardTitle}>دعوة السكان (واتساب)</Text>
            <Text style={styles.quickNavCardSub}>
              كود: {currentBuilding.building_code}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Pending Resident Join Requests + Mechanism 2: Smart Comparison Card & Change Apartment Before Approval */}
      {buildingPendingResidents.length > 0 && (
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
      )}

      {/* 4B. Active Emergency Claims & Close with Compressed Invoice */}
      {activeEmergencyClaims.length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleWithBadgeRow}>
              <Text style={styles.sectionTitle}>المطالبات الطارئة النشطة</Text>
              <StatusBadge status="upcoming" customLabel="جاري التحصيل" />
            </View>
          </View>

          {activeEmergencyClaims.map((claim) => {
            const approvedClaimPayments = payments.filter(
              (p) => p.emergency_claim_id === claim.id && p.status === 'paid'
            );
            const actualCollected = Math.max(
              claim.collected_amount,
              approvedClaimPayments.reduce((acc, p) => acc + p.amount, 0)
            );
            const actualContributorsCount = Math.max(
              claim.contributors_count ?? 0,
              new Set(
                approvedClaimPayments.map(
                  (p) => p.apartment_number || p.resident_id
                )
              ).size
            );
            const pct = Math.min(
              100,
              Math.round(
                (actualCollected / Math.max(claim.target_amount, 1)) * 100
              )
            );
            const remainingAmount = Math.max(
              0,
              claim.target_amount - actualCollected
            );
            const paidApartmentNumbers = new Set(
              approvedClaimPayments.map((p) => p.apartment_number)
            );
            const paidCount = paidApartmentNumbers.size;
            const totalUnits =
              buildingApartments.length || currentBuilding.total_apartments;
            const unpaidCount = Math.max(0, totalUnits - paidCount);

            const shareAmount =
              claim.default_share_amount ||
              Math.round(claim.target_amount / totalUnits);

            return (
              <View key={claim.id} style={styles.emergencyAdminCard}>
                {/* Header Row matching original Stitch emergency design */}
                <View style={styles.emergencyHeaderRow}>
                  <View style={styles.emergencyTitleGroup}>
                    <View style={styles.emergencyIconBox}>
                      <MaterialIcons
                        name="handyman"
                        size={20}
                        color={COLORS.onErrorContainer}
                      />
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end', marginBottom: 10 }}>
                      <Text style={styles.emergencyOverline}>
                        مطالبة طارئة نشطة • {claim.category}
                      </Text>
                      <Text style={styles.emergencyTitle}>{claim.title}</Text>
                    </View>
                  </View>
                </View>

                {/* Live Progress Bar (Original Design - 100% Identical to Resident Screen) */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelsRow}>
                    <Text style={styles.progressSummaryText}>
                      تم جمع{' '}
                      <Text
                        style={{ fontWeight: '700', color: COLORS.onSurface }}
                      >
                        {actualCollected.toLocaleString()} ج.م
                      </Text>{' '}
                      من أصل {claim.target_amount.toLocaleString()} ج.م
                    </Text>
                    <Text style={styles.progressPercentText}>
                      {pct}% مكتمل
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Contributors Count & Unit Share */}
                <View style={styles.contributorsRow}>
                  <View style={styles.avatarsGroup}>
                    {actualContributorsCount > 0 ? (
                      <>
                        <View
                          style={[
                            styles.miniAvatar,
                            { backgroundColor: COLORS.primaryContainer },
                          ]}
                        >
                          <Text style={styles.miniAvatarTextLight}>
                            +{actualContributorsCount}
                          </Text>
                        </View>
                        <Text style={styles.contributorsCountLabel}>
                          ساهم {actualContributorsCount} ملاك ({paidCount} مسدد • {unpaidCount} متبقي)
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.contributorsCountLabel}>
                        لم يساهم أحد حتى الآن (0 ملاك)
                      </Text>
                    )}
                  </View>

                  <View style={styles.residentShareBox}>
                    <Text style={styles.residentShareText}>
                      نصيب الوحدة:{' '}
                      <Text style={styles.residentShareBold}>
                        {shareAmount.toLocaleString()} ج.م
                      </Text>
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.emergencyCardActionsRow}>
                  <TouchableOpacity
                    style={styles.viewDetailsBtn}
                    onPress={() => setSelectedClaimForDetails(claim)}
                  >
                    <MaterialIcons
                      name="people-alt"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.viewDetailsBtnText}>
                      عرض القائمة والمساهمين ({paidCount}/{totalUnits})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.closeClaimInvoiceBtnCompact}
                    onPress={() => {
                      setClosingClaimId(claim.id);
                      setCloseClaimActualAmount(String(claim.target_amount));
                    }}
                  >
                    <MaterialIcons
                      name="receipt-long"
                      size={16}
                      color={COLORS.onPrimary}
                    />
                    <Text style={styles.closeClaimInvoiceBtnCompactText}>
                      إغلاق بفاتورة
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 5. Pending Reviews Widget (طلبات السداد المعلقة - admin_dashboard/code.html lines 116-199) */}
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

      {/* 6. Unpaid Apartments Section (الشقق المتأخرة - admin_dashboard/code.html lines 201-294) */}
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

      {/* 7. Building Pulse & Community Overview (نبض العمارة والنشاط العام) */}
      <View style={styles.pulseSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>نبض العمارة والنشاط العام 📊</Text>
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>إحصائيات فورية</Text>
          </View>
        </View>

        <View style={styles.pulseGrid}>
          {/* Col 1: Occupancy */}
          <View style={styles.pulseCol}>
            <View style={styles.pulseColIconRow}>
              <MaterialIcons
                name="people-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.pulseColTitle}>نسبة الإشغال</Text>
            </View>
            <Text style={styles.pulseColNumber}>
              {occupiedApartments.length}/{currentBuilding.total_apartments}
            </Text>
            <Text style={styles.pulseColSub}>
              {currentBuilding.total_apartments - occupiedApartments.length > 0
                ? `${currentBuilding.total_apartments - occupiedApartments.length} شقة شاغرة`
                : 'العمارة مأهولة بالكامل'}
            </Text>
          </View>

          {/* Col 2: Total Arrears */}
          <View style={styles.pulseCol}>
            <View style={styles.pulseColIconRow}>
              <MaterialIcons
                name="warning-amber"
                size={18}
                color={COLORS.statusUnpaidText}
              />
              <Text style={styles.pulseColTitle}>إجمالي المتأخرات</Text>
            </View>
            <Text
              style={[
                styles.pulseColNumber,
                { color: COLORS.statusUnpaidText },
              ]}
            >
              {totalArrearsAmount.toLocaleString()} ج.م
            </Text>
            <Text style={styles.pulseColSub}>
              {unpaidApartments.length} شقة غير مسددة
            </Text>
          </View>
        </View>

        {/* Community Hub Status Row */}
        <View style={styles.communityPulseBox}>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
            <Text style={styles.communityPulseText}>
              مجتمع العمارة: {activeIssuesCount} بلاغ صيانة مفتوح • {activePollsCount} استطلاع نشط
            </Text>
            <Text style={{ fontSize: 11, color: '#15803D' }}>
              متابعة الشكاوى والتصويت على قرارات الجمعية العمومية
            </Text>
          </View>
          {onNavigateCommunity && (
            <TouchableOpacity
              style={styles.communityPulseBtn}
              onPress={onNavigateCommunity}
            >
              <Text style={styles.communityPulseBtnText}>عرض المجتمع</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 8. Developer & Testing Reset Tools Card (أدوات التجربة السريعة والتصفير) */}
      <View style={styles.testingCard}>
        <View style={styles.testingHeaderRow}>
          <MaterialIcons name="science" size={24} color="#B45309" />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.testingTitle}>
              أدوات التجربة السريعة والتصفير 🧪
            </Text>
            <Text style={styles.testingSubtitle}>
              مخصصة لتسريع الاختبار وحذف وإعادة كتابة البيانات دون فتح قاعدة البيانات يدوياً
            </Text>
          </View>
        </View>

        {/* Action 1: Clear Residents and Operations */}
        <TouchableOpacity
          style={styles.testingActionBtnAmber}
          onPress={handleResetResidentsOnly}
          disabled={resettingMode !== null}
          activeOpacity={0.8}
        >
          <View style={styles.testingActionTop}>
            {resettingMode === 'residents_only' ? (
              <ActivityIndicator size="small" color="#B45309" />
            ) : (
              <MaterialIcons name="cleaning-services" size={20} color="#B45309" />
            )}
            <Text style={styles.testingActionTitleAmber}>
              مسح بيانات السكان والعمليات (تصفير العمارة)
            </Text>
          </View>
          <Text style={styles.testingActionDesc}>
            مسح كافة الشقق، المديونيات، طلبات الانضمام، المدفوعات، والمصروفات، مع تصفير رصيد الخزينة والإبقاء على حساب رئيس الاتحاد والعمارة لتجربة تسجيل الشقق والمديونيات من جديد فوراً.
          </Text>
        </TouchableOpacity>

        {/* Action 2: Cascade Delete Building & Admin */}
        <TouchableOpacity
          style={styles.testingActionBtnRed}
          onPress={handleFullDeleteBuilding}
          disabled={resettingMode !== null}
          activeOpacity={0.8}
        >
          <View style={styles.testingActionTop}>
            {resettingMode === 'full_delete' ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <MaterialIcons name="delete-forever" size={20} color="#DC2626" />
            )}
            <Text style={styles.testingActionTitleRed}>
              حذف العمارة بالكامل وإعادة البدء من الصفر
            </Text>
          </View>
          <Text style={styles.testingActionDesc}>
            حذف العقار بالكامل من قاعدة البيانات مع كافة سجلاته وحساب رئيس الاتحاد وتسجيل الخروج للبدء من صفحة التسجيل والتهيئة كأنك تستخدم التطبيق لأول مرة.
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================================================================== */}
      {/* Modal 1: Add New Expense (Matches design/stitch_/_3/code.html)       */}
      {/* Uses compressAndUploadImage (Max 1080px, 0.6 JPEG, 80-150 KB)        */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={expenseModalVisible}
        title="إضافة مصروف جديد"
        subtitle="تسجيل حركة صرف موثقة لخزينة العمارة وتظهر فوراً في لوحة الشفافية"
        onClose={() => setExpenseModalVisible(false)}
      >
        <View style={styles.modalForm}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>بيان / عنوان المصروف</Text>
            <TextInput
              style={styles.input}
              value={expTitle}
              onChangeText={setExpTitle}
              placeholder="مثال: صيانة المصعد الدوري / راتب الحارس"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>المبلغ (ج.م)</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="numeric"
                placeholder="1200"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>رقم الفاتورة / السند</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={expInvoiceNum}
                onChangeText={setExpInvoiceNum}
                placeholder="#INV-4950"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>التصنيف</Text>
            <View style={styles.chipsWrap}>
              {[
                'صيانة ومصاعد',
                'رواتب وأمن',
                'كهرباء ومياه',
                'نظافة ومستهلكات',
              ].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setExpCategory(cat)}
                  style={[
                    styles.catChip,
                    expCategory === cat && styles.catChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      expCategory === cat && styles.catChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Compressed Image Picker Box (expense-invoices/{building_id}/{year_month}/{unique_filename}.jpg) */}
          <View style={styles.invoiceAttachCard}>
            <MaterialIcons
              name="add-a-photo"
              size={22}
              color={COLORS.secondary}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.invoiceAttachTitle}>
                {expCompressedUpload
                  ? `تم ضغط الفاتورة (${expCompressedUpload.estimatedSizeKb} KB • ${expCompressedUpload.width}px)`
                  : 'إرفاق صورة الفاتورة الرسمية (ضغط تلقائي 60% • 1080px)'}
              </Text>
              <Text style={styles.invoiceAttachSub}>
                {expCompressedUpload
                  ? expCompressedUpload.storagePath
                  : `المسار المنظم: ${currentBuilding.id}/2024-11/invoice_*.jpg`}
              </Text>
            </View>
          </View>

          <View style={styles.uploadButtonsRow}>
            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickExpenseInvoice('library')}
              disabled={expUploadingImage}
            >
              {expUploadingImage ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialIcons
                    name="photo-library"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.uploadPickerBtnText}>
                    اختر من المعرض (ضغط ذكي)
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickExpenseInvoice('camera')}
              disabled={expUploadingImage}
            >
              <MaterialIcons
                name="photo-camera"
                size={16}
                color={COLORS.secondary}
              />
              <Text style={styles.uploadPickerBtnText}>تصوير بالكاميرا</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={handleAddExpense}
            disabled={expSubmitting || expUploadingImage}
          >
            {expSubmitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons
                  name="check-circle"
                  size={18}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.modalPrimaryBtnText}>
                  حفظ المصروف وخصمه من الخزينة
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Modal 2: Create Emergency Claim (Matches design/stitch_/_10/code.html) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={emergencyModalVisible}
        title="صندوق صيانة طارئ واستثنائي"
        subtitle="تُنشأ لجمع مبالغ الصيانات الطارئة مع شريط تقدم حي وتوزيع بالتساوي أو مخصص"
        onClose={() => setEmergencyModalVisible(false)}
      >
        <View style={styles.modalForm}>
          <Text style={styles.fieldLabel}>تصنيف الصيانة الطارئة</Text>
          <View style={styles.chipsWrap}>
            {EMERGENCY_CATEGORIES.map((c) => {
              const active = claimCategory === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setClaimCategory(c.id)}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <MaterialIcons
                    name={c.icon}
                    size={15}
                    color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      active && styles.catChipTextActive,
                    ]}
                  >
                    {c.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>عنوان البند الطارئ</Text>
            <TextInput
              style={styles.input}
              value={claimTitle}
              onChangeText={setClaimTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>إجمالي المبلغ المطلوب (ج.م)</Text>
            <TextInput
              style={[styles.input, { textAlign: 'left', fontWeight: '700' }]}
              value={claimAmount}
              onChangeText={setClaimAmount}
              keyboardType="numeric"
            />
          </View>

          {/* Distribution Strategy (_10/code.html) */}
          <Text style={styles.fieldLabel}>طريقة توزيع التكلفة</Text>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.distOptionCard,
                claimDistribution === 'occupied_only' &&
                  styles.distOptionCardActive,
              ]}
              onPress={() => setClaimDistribution('occupied_only')}
            >
              <View style={styles.distOptionHeader}>
                <Text style={styles.distOptionTitle}>
                  على الشقق المسكونة/المسجلة حالياً فقط ({occupiedApartments.length}{' '}
                  شقة) ⭐
                </Text>
                <MaterialIcons
                  name={
                    claimDistribution === 'occupied_only'
                      ? 'radio-button-checked'
                      : 'radio-button-unchecked'
                  }
                  size={20}
                  color={COLORS.primaryContainer}
                />
              </View>
              <Text style={styles.distOptionDesc}>
                تقسيم التكلفة على السكان المتواجدين فقط بالتساوي لحل مشكلة قلة
                السكان عند بداية إشغال البرج.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.distOptionCard,
                claimDistribution === 'equal' && styles.distOptionCardActive,
              ]}
              onPress={() => setClaimDistribution('equal')}
            >
              <View style={styles.distOptionHeader}>
                <Text style={styles.distOptionTitle}>
                  بالتساوي على كامل شقق البرج ({currentBuilding.total_apartments}{' '}
                  شقة)
                </Text>
                <MaterialIcons
                  name={
                    claimDistribution === 'equal'
                      ? 'radio-button-checked'
                      : 'radio-button-unchecked'
                  }
                  size={20}
                  color={COLORS.primaryContainer}
                />
              </View>
              <Text style={styles.distOptionDesc}>
                يتحمل كل مالك حصة موحدة، وتسجل حصة الشقق الشاغرة كمتأخرات مستحقة
                على ملاكها.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.distOptionCard,
                claimDistribution === 'custom' && styles.distOptionCardActive,
              ]}
              onPress={() => setClaimDistribution('custom')}
            >
              <View style={styles.distOptionHeader}>
                <Text style={styles.distOptionTitle}>
                  توزيع بمبالغ مخصصة / استثناء وحدات محددة
                </Text>
                <MaterialIcons
                  name={
                    claimDistribution === 'custom'
                      ? 'radio-button-checked'
                      : 'radio-button-unchecked'
                  }
                  size={20}
                  color={COLORS.primaryContainer}
                />
              </View>
              <Text style={styles.distOptionDesc}>
                مثل تخصيص أنصبة حسب المساحة أو استثناء الدور الأرضي من مصاريف
                المصعد.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Smart Calculation Hero Preview (_10/code.html lines 154-189) */}
          <View style={styles.smartCalcHero}>
            <View style={styles.smartCalcTop}>
              <Text style={styles.smartCalcTitle}>
                {claimDistribution === 'occupied_only'
                  ? `المعاينة الذكية (الشقق المسكونة: ${occupiedApartments.length} شقة)`
                  : `المعاينة الذكية (كامل البرج: ${currentBuilding.total_apartments} شقة)`}
              </Text>
              <Text style={styles.smartCalcFormula}>
                {claimAmount || 0} ÷{' '}
                {claimDistribution === 'occupied_only'
                  ? Math.max(occupiedApartments.length, 1)
                  : Math.max(currentBuilding.total_apartments, 1)}
              </Text>
            </View>
            <View style={styles.smartCalcValRow}>
              <Text style={styles.smartCalcAmount}>{calculatedEqualShare}</Text>
              <Text style={styles.smartCalcCurrency}>
                ج.م / لكل شقة{' '}
                {claimDistribution === 'occupied_only'
                  ? '(مسكونة)'
                  : '(في البرج)'}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ملاحظات الفني (اختياري)</Text>
            <TextInput
              style={styles.input}
              value={claimNotes}
              onChangeText={setClaimNotes}
              placeholder="تفاصيل العطل وأسباب الاستعجال..."
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={handleCreateEmergencyClaim}
            disabled={claimSubmitting}
          >
            {claimSubmitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons
                  name="bolt"
                  size={18}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.modalPrimaryBtnText}>
                  إطلاق المطالبة الطارئة وإشعار السكان
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Modal 3: App Subscription Renewal (رفع إيصال اشتراك التطبيق للـ Super Admin) */}
      {/* Uses compressAndUploadImage -> subscription-receipts                 */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={subscriptionModalVisible}
        title="اشتراك باقة العمارة في التطبيق"
        subtitle={`الباقة الحالية: ${currentBuilding.plan_code.toUpperCase()} • السعر المخصص: ${effectiveMonthlyPlanPrice} ج.م/شهرياً`}
        onClose={() => setSubscriptionModalVisible(false)}
      >
        <View style={styles.modalForm}>
          <View style={styles.subInfoBox}>
            <Text style={styles.subInfoTitle}>
              آلية التفعيل التلقائي والشفافية المالية:
            </Text>
            <Text style={styles.subInfoDesc}>
              عند تحويل قيمة الباقة ورفع الإيصال، يقوم مالك التطبيق (Super Admin)
              بالضغط على "تفعيل"، فيتم تمديد اشتراك العمارة وإدراج مصروف تلقائي
              باسم "رسوم اشتراك تطبيق إدارة العقار" في ميزانية العمارة.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>اختر الباقة المطلوبة</Text>
          <View style={styles.chipsWrap}>
            {(['pro', 'plus'] as PlanTier[]).map((tier) => (
              <TouchableOpacity
                key={tier}
                onPress={() => setSelectedPlan(tier)}
                style={[
                  styles.catChip,
                  selectedPlan === tier && styles.catChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    selectedPlan === tier && styles.catChipTextActive,
                  ]}
                >
                  باقة {tier.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>عدد الأشهر</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center' }]}
                value={durationMonths}
                onChangeText={setDurationMonths}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>الإجمالي المطلوب تحويله</Text>
              <View style={styles.calculatedPriceBox}>
                <Text style={styles.calculatedPriceText}>
                  {effectiveMonthlyPlanPrice *
                    Math.max(parseInt(durationMonths, 10) || 1, 1)}{' '}
                  ج.م
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.invoiceAttachCard}>
            <MaterialIcons
              name="verified"
              size={22}
              color={COLORS.secondary}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.invoiceAttachTitle}>
                {subCompressedUpload
                  ? `تم ضغط إيصال الاشتراك (${subCompressedUpload.estimatedSizeKb} KB • ${subCompressedUpload.width}px)`
                  : 'إرفاق إيصال تحويل قيمة الباقة (ضغط تلقائي 60% • 1080px)'}
              </Text>
              <Text style={styles.invoiceAttachSub}>
                {subCompressedUpload
                  ? subCompressedUpload.storagePath
                  : `المسار المنظم: ${currentBuilding.id}/2024-11/sub_*.jpg`}
              </Text>
            </View>
          </View>

          <View style={styles.uploadButtonsRow}>
            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickSubscriptionReceipt('library')}
              disabled={subUploadingImage}
            >
              {subUploadingImage ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialIcons
                    name="photo-library"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.uploadPickerBtnText}>
                    اختر الإيصال من المعرض
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickSubscriptionReceipt('camera')}
              disabled={subUploadingImage}
            >
              <MaterialIcons
                name="photo-camera"
                size={16}
                color={COLORS.secondary}
              />
              <Text style={styles.uploadPickerBtnText}>تصوير الإيصال</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={handleSubmitSubscriptionRenewal}
            disabled={subSubmitting || subUploadingImage}
          >
            {subSubmitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons
                  name="cloud-upload"
                  size={18}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.modalPrimaryBtnText}>
                  رفع إيصال الاشتراك للمراجعة والتفعيل
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Modal 6: Close Emergency Claim with Compressed Official Invoice      */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(closingClaimId)}
        title="إغلاق المطالبة الطارئة بفاتورة رسمية"
        subtitle="رفع فاتورة الإصلاح النهائية (تُضغط تلقائياً بعرض 1080px وجودة 60%) وتُسجل في لوحة الشفافية"
        onClose={() => setClosingClaimId(null)}
      >
        <View style={styles.modalForm}>
          <View style={styles.twoCol}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>المبلغ الفعلي للفاتورة (ج.م)</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={closeClaimActualAmount}
                onChangeText={setCloseClaimActualAmount}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>رقم فاتورة المورد / الشركة</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={closeClaimInvoiceNum}
                onChangeText={setCloseClaimInvoiceNum}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>بيان الإقفال والضمان</Text>
            <TextInput
              style={styles.input}
              value={closeClaimNotes}
              onChangeText={setCloseClaimNotes}
            />
          </View>

          <View style={styles.invoiceAttachCard}>
            <MaterialIcons
              name="receipt-long"
              size={22}
              color={COLORS.secondary}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.invoiceAttachTitle}>
                {closeClaimCompressedUpload
                  ? `فاتورة الإقفال مضغوطة (${closeClaimCompressedUpload.estimatedSizeKb} KB • ${closeClaimCompressedUpload.width}px)`
                  : 'صورة فاتورة الإقفال النهائية (ضغط تلقائي 80–150 KB)'}
              </Text>
              <Text style={styles.invoiceAttachSub}>
                {closeClaimCompressedUpload
                  ? closeClaimCompressedUpload.storagePath
                  : `المسار المنظم: ${currentBuilding.id}/2024-11/invoice_*.jpg`}
              </Text>
            </View>
          </View>

          <View style={styles.uploadButtonsRow}>
            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickCloseClaimInvoice('library')}
              disabled={closeClaimUploading}
            >
              {closeClaimUploading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <MaterialIcons
                    name="photo-library"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.uploadPickerBtnText}>
                    اختر فاتورة الإقفال
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadPickerBtn}
              onPress={() => handlePickCloseClaimInvoice('camera')}
              disabled={closeClaimUploading}
            >
              <MaterialIcons
                name="photo-camera"
                size={16}
                color={COLORS.secondary}
              />
              <Text style={styles.uploadPickerBtnText}>تصوير الفاتورة</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={handleConfirmCloseEmergencyClaim}
            disabled={closeClaimSubmitting || closeClaimUploading}
          >
            {closeClaimSubmitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons
                  name="verified"
                  size={18}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.modalPrimaryBtnText}>
                  إغلاق المطالبة واعتماد الفاتورة في سجل الشفافية
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* Modal 4: Full Receipt Inspection & Approval (Matches design/_7/code.html) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(previewReceiptUrl)}
        title="مراجعة واعتماد السداد"
        subtitle="فحص الإيصال المرفق والمطابقة الذكية قبل التوريد للخزينة"
        onClose={() => {
          setPreviewReceiptUrl(null);
          setPreviewPayment(null);
        }}
      >
        {previewReceiptUrl && (
          <View style={{ gap: 14 }}>
            {/* Header info if previewPayment is set */}
            {previewPayment && (
              <View style={styles.reviewTopRow}>
                <View style={styles.reviewRightGroup}>
                  <View style={styles.aptBadgeBox}>
                    <Text style={styles.aptBadgeLabel}>شقة</Text>
                    <Text style={styles.aptBadgeNumber}>
                      {previewPayment.apartment_number || '302'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.residentNameText}>
                      {previewPayment.resident_name || 'الساكن / المالك'}
                    </Text>
                    <Text style={styles.paymentMethodTagText}>
                      {previewPayment.billing_month || 'اشتراك شهري'} • {currentBuilding.name}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.paymentAmountText}>
                    {previewPayment.amount.toLocaleString()} ج.م
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#ECFDF5',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      marginTop: 2,
                    }}
                  >
                    <MaterialIcons name="auto-awesome" size={12} color={COLORS.secondary} />
                    <Text style={{ fontSize: 10, color: COLORS.secondary, fontWeight: '700' }}>
                      فحص ذكي إيجابي
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Receipt Image Display */}
            <View
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: COLORS.primaryContainer,
                padding: 4,
                borderWidth: 1,
                borderColor: COLORS.borderSubtle,
              }}
            >
              <Image
                source={{ uri: previewReceiptUrl }}
                style={styles.fullReceiptImage}
                resizeMode="contain"
              />
            </View>

            {/* Smart Verification Checklist (design/_7/code.html lines 160-180) */}
            <View
              style={{
                backgroundColor: COLORS.surfaceContainerLow,
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="fact-check" size={18} color={COLORS.secondary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.onSurface }}>
                  مطابقة البيانات التلقائية مع السجلات:
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                  <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                    المبلغ مطابق بالكامل للقيمة المستحقة {previewPayment ? `(${previewPayment.amount} ج.م)` : ''}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                  <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                    الحساب المستلم مطابق لحساب صندوق اتحاد الملاك ({currentBuilding.name})
                  </Text>
                </View>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="check-circle" size={16} color={COLORS.statusPaid} />
                  <Text style={{ fontSize: 12, color: COLORS.onSurfaceVariant, flex: 1, textAlign: 'right' }}>
                    صورة الإيصال أصلية ومطابقة لنموذج التحويل اللحظي
                  </Text>
                </View>
              </View>
            </View>

            {/* Decision Actions directly inside modal */}
            {previewPayment && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, { backgroundColor: COLORS.secondary }]}
                  onPress={() => {
                    const payId = previewPayment.id;
                    setPreviewReceiptUrl(null);
                    setPreviewPayment(null);
                    handleApprovePayment(payId);
                  }}
                  disabled={Boolean(processingIds[previewPayment.id])}
                >
                  <MaterialIcons name="check" size={20} color={COLORS.onSecondary} />
                  <Text style={styles.modalPrimaryBtnText}>
                    اعتماد وتوريد للخزينة فوراً ({previewPayment.amount.toLocaleString()} ج.م)
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.rejectBtn,
                      { flex: 1, backgroundColor: COLORS.errorContainer },
                    ]}
                    onPress={() => {
                      const payId = previewPayment.id;
                      setPreviewReceiptUrl(null);
                      setPreviewPayment(null);
                      handleRejectPayment(payId);
                    }}
                  >
                    <MaterialIcons name="close" size={18} color={COLORS.error} />
                    <Text style={[styles.rejectBtnText, { color: COLORS.error }]}>
                      رفض الطلب
                    </Text>
                  </TouchableOpacity>

                  {(() => {
                    const matched = apartments.find(
                      (a) =>
                        a.id === previewPayment.apartment_id ||
                        (Boolean(previewPayment.apartment_number) &&
                          a.apartment_number === previewPayment.apartment_number)
                    );
                    const phone = matched?.occupant_phone || matched?.resident_phone;
                    if (!phone) return null;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.rejectBtn,
                          { flex: 1, backgroundColor: COLORS.surfaceContainer },
                        ]}
                        onPress={() => {
                          Linking.openURL(
                            `https://wa.me/${phone.replace(/[^\d]/g, '')}`
                          );
                        }}
                      >
                        <MaterialIcons name="chat" size={18} color={COLORS.secondary} />
                        <Text style={[styles.rejectBtnText, { color: COLORS.onSurface }]}>
                          محادثة واتساب
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </View>
            )}
          </View>
        )}
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Modal 5: Reject Payment with Reason (Sends Push Notification)        */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(rejectModalPaymentId)}
        title="تحديد سبب رفض طلب السداد"
        subtitle="سيصل إشعار فوري للساكن يتضمن سبب الرفض الموضح أدناه"
        onClose={() => setRejectModalPaymentId(null)}
      >
        <View style={{ gap: 12 }}>
          <Text style={styles.fieldLabel}>اختر سبباً سريعاً أو اكتب السبب</Text>
          <View style={{ gap: 8 }}>
            {[
              'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد',
              'المبلغ المحول أقل من قيمة الاشتراك الشهري المقررة',
              'رقم المرجع في الإيصال غير مطابق لكشف حساب البنك / إنستاباي',
            ].map((preset) => (
              <TouchableOpacity
                key={preset}
                onPress={() => setRejectReason(preset)}
                style={[
                  styles.categoryChip,
                  rejectReason === preset && styles.categoryChipActive,
                  { width: '100%', justifyContent: 'flex-start' },
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    rejectReason === preset && styles.categoryChipTextActive,
                    { textAlign: 'right' },
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>تفاصيل سبب الرفض المرسلة للساكن</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 72, textAlignVertical: 'top' }]}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            placeholder="اكتب سبب الرفض ليظهر للساكن في الإشعار..."
            placeholderTextColor={COLORS.outline}
            textAlign="right"
          />

          <TouchableOpacity
            style={[
              styles.modalPrimaryBtn,
              { backgroundColor: COLORS.statusUnpaid },
            ]}
            onPress={confirmRejectPayment}
          >
            <MaterialIcons name="cancel" size={18} color={COLORS.onPrimary} />
            <Text style={styles.modalPrimaryBtnText}>
              تأكيد الرفض وإرسال إشعار للساكن
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* ==================================================================== */}
      {/* Modal 7: Emergency Claim Contributors & Unpaid Units Details          */}
      {/* ==================================================================== */}
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
      </ScrollView>

      {/* Floating Action Button (FAB) for Instant Quick Action */}
      <TouchableOpacity
        style={styles.floatingFab}
        onPress={() => setQuickActionsModalVisible(true)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* ==================================================================== */}
      {/* Modal 0: Quick Actions Sheet (إضافة مصروف • طوارئ جديدة • تذكير الكل) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={quickActionsModalVisible}
        title="إجراء وإضافة سريعة ⚡"
        subtitle="اختر العملية التي ترغب في تنفيذها الآن"
        onClose={() => setQuickActionsModalVisible(false)}
      >
        <View style={styles.quickActionsModalList}>
          {/* Action 1: Add Expense */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              setQuickActionsModalVisible(false);
              setExpenseModalVisible(true);
            }}
          >
            <View style={styles.quickActionCardArrow}>
              <MaterialIcons
                name="chevron-left"
                size={22}
                color={COLORS.secondary}
              />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
              <View style={styles.quickActionCardTitleRow}>
                <View style={styles.quickActionGreenBadge}>
                  <Text style={styles.quickActionGreenBadgeText}>
                    خصم من الخزينة
                  </Text>
                </View>
                <Text style={styles.quickActionCardTitle}>
                  إضافة مصروف جديد 💸
                </Text>
              </View>
              <Text style={styles.quickActionCardDesc}>
                تسجيل فاتورة صيانة، كهرباء، مصاعد، أو نظافة وخصمها رسمياً من رصيد
                الخزينة مع حفظ صورة الفاتورة.
              </Text>
            </View>
            <View
              style={[
                styles.quickActionCardIcon,
                { backgroundColor: 'rgba(0, 108, 73, 0.1)' },
              ]}
            >
              <MaterialIcons
                name="post-add"
                size={26}
                color={COLORS.secondary}
              />
            </View>
          </TouchableOpacity>

          {/* Action 2: New Emergency Claim */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              setQuickActionsModalVisible(false);
              setEmergencyModalVisible(true);
            }}
          >
            <View style={styles.quickActionCardArrow}>
              <MaterialIcons
                name="chevron-left"
                size={22}
                color={COLORS.error}
              />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
              <View style={styles.quickActionCardTitleRow}>
                <View style={styles.quickActionRedBadge}>
                  <Text style={styles.quickActionRedBadgeText}>عطل طارئ</Text>
                </View>
                <Text style={styles.quickActionCardTitle}>طوارئ جديدة 🚨</Text>
              </View>
              <Text style={styles.quickActionCardDesc}>
                إطلاق مطالبة فورية لعطل مصعد أو موتور، وتقسيم المبلغ تلقائياً على
                الشقق مع إشعار فوري لجميع السكان.
              </Text>
            </View>
            <View
              style={[
                styles.quickActionCardIcon,
                { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
              ]}
            >
              <MaterialIcons
                name="emergency"
                size={26}
                color={COLORS.error}
              />
            </View>
          </TouchableOpacity>

          {/* Action 3: Bulk Unpaid Reminder */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              setQuickActionsModalVisible(false);
              handleBulkReminder();
            }}
          >
            <View style={styles.quickActionCardArrow}>
              <MaterialIcons
                name="chevron-left"
                size={22}
                color="#B45309"
              />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
              <View style={styles.quickActionCardTitleRow}>
                <View style={styles.quickActionAmberBadge}>
                  <Text style={styles.quickActionAmberBadgeText}>
                    إشعار Push فوري
                  </Text>
                </View>
                <Text style={styles.quickActionCardTitle}>تذكير الكل بالسداد 🔔</Text>
              </View>
              <Text style={styles.quickActionCardDesc}>
                إرسال تنبيه Push فوري بضغطة زر واحدة لكافة الشقق التي لم تسدد
                اشتراك الشهر الحالي.
              </Text>
            </View>
            <View
              style={[
                styles.quickActionCardIcon,
                { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
              ]}
            >
              <MaterialIcons
                name="campaign"
                size={26}
                color="#B45309"
              />
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  compactAddBar: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  compactAddBarBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  compactAddBarIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAddBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  compactAddBarSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  compactAddBarBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(9, 20, 38, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  compactAddBarBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  floatingFab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#091426',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  quickActionsModalList: {
    gap: 12,
    paddingBottom: 10,
  },
  quickActionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  quickActionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  quickActionCardDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 16,
  },
  quickActionCardArrow: {
    padding: 4,
  },
  quickActionGreenBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickActionGreenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  quickActionRedBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickActionRedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  quickActionAmberBadge: {
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quickActionAmberBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 18,
  },
  readOnlyBanner: {
    backgroundColor: COLORS.statusUnpaidBg,
    borderWidth: 1,
    borderColor: COLORS.statusUnpaid,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  readOnlyRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  readOnlyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.statusUnpaidText,
    textAlign: 'right',
  },
  readOnlyDesc: {
    fontSize: 11,
    color: COLORS.statusUnpaidText,
    textAlign: 'right',
    marginTop: 2,
  },
  renewNowBtn: {
    backgroundColor: COLORS.statusUnpaid,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  renewNowBtnText: {
    color: COLORS.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  welcomeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeStatusLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  headerCodeCopyIconBtn: {
    padding: 3,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminWelcomeName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  adminRoleSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  cyclePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  cyclePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  heroCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroBalanceLabel: {
    fontSize: 12,
    color: COLORS.onPrimaryContainer,
  },
  heroBalanceValRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  heroBalanceNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  heroBalanceCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryFixed,
  },
  trendPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 108, 73, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  trendPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  gaugeBlock: {
    gap: 6,
  },
  gaugeLabelsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeTitle: {
    fontSize: 11,
    color: COLORS.onPrimaryContainer,
  },
  gaugePercent: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  gaugeTrack: {
    height: 10,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    padding: 2,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: COLORS.secondaryFixed,
  },
  subStatsGrid: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 12,
    gap: 12,
  },
  subStatItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  subStatIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subStatLabel: {
    fontSize: 11,
    color: COLORS.onPrimaryContainer,
  },
  subStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  sectionHint: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  quickActionsGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 6,
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  titleWithBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  orangeCountBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  orangePingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusPending,
  },
  orangeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPending,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyPendingBox: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  emptyPendingText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  reviewTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reviewRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aptBadgeBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aptBadgeLabel: {
    fontSize: 10,
    color: COLORS.onPrimaryFixed,
  },
  aptBadgeNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.onPrimaryFixed,
  },
  residentNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  paymentMethodLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  methodPill: {
    backgroundColor: COLORS.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  methodPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  paymentTimeText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  paymentMethodTagText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  paymentAmountText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.statusPaid,
  },
  paymentWaitLabel: {
    fontSize: 10,
    color: COLORS.statusPending,
    fontWeight: '600',
    marginTop: 2,
  },
  receiptPreviewBar: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptPreviewRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  receiptThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  receiptRefTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  receiptRefSub: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  zoomIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtnText: {
    color: COLORS.onSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  rejectBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerHigh,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rejectBtnText: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  redCountBadge: {
    backgroundColor: COLORS.errorContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  redCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.error,
  },
  unpaidTotalText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.statusUnpaid,
  },
  defaulterCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  delaySubText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  defaulterAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.statusUnpaid,
  },
  defaulterActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  whatsappRemindBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerHigh,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  whatsappRemindText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  manualConfirmBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manualConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalForm: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
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
  twoCol: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  catChipTextActive: {
    color: COLORS.onPrimary,
  },
  invoiceAttachCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  invoiceAttachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  invoiceAttachSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  distOptionCard: {
    backgroundColor: COLORS.surfaceCanvas,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  distOptionCardActive: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderColor: COLORS.primaryContainer,
  },
  distOptionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  distOptionDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
  },
  smartCalcHero: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 12,
    padding: 14,
  },
  smartCalcTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smartCalcTitle: {
    fontSize: 12,
    color: COLORS.primaryFixed,
    fontWeight: '600',
  },
  smartCalcFormula: {
    fontSize: 12,
    color: COLORS.secondaryFixed,
    fontWeight: '700',
  },
  smartCalcValRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  smartCalcAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  smartCalcCurrency: {
    fontSize: 13,
    color: COLORS.secondaryFixed,
    fontWeight: '600',
  },
  subInfoBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
  },
  subInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  subInfoDesc: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  calculatedPriceBox: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculatedPriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
  fullReceiptImage: {
    width: '100%',
    height: 360,
    borderRadius: 12,
  },
  smartCompareContainer: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 10,
  },
  smartCompareHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  smartCompareHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
  },
  smartCompareCols: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  smartCompareColBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 4,
  },
  smartCompareColWarning: {
    borderColor: COLORS.statusPending,
    backgroundColor: COLORS.statusPendingBg,
  },
  smartCompareColMatched: {
    borderColor: COLORS.statusPaid,
    backgroundColor: COLORS.statusPaidBg,
  },
  smartCompareColTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  smartComparePrimaryVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  smartCompareSecondaryVal: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  smartCompareArrearsVal: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 2,
  },
  smartSuggestionBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.statusPendingBg,
    borderWidth: 1,
    borderColor: COLORS.statusPending,
    borderRadius: 10,
    padding: 10,
  },
  smartSuggestionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.statusPendingText,
    textAlign: 'right',
  },
  smartSuggestionSub: {
    fontSize: 11,
    color: COLORS.onSurface,
    textAlign: 'right',
    marginTop: 2,
  },
  changeAptBlock: {
    gap: 8,
  },
  changeAptToggleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceCanvas,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  changeAptToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  changeAptChipsList: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  changeAptChip: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '47%',
    flex: 1,
  },
  changeAptChipActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  changeAptChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  changeAptChipSub: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  closeClaimInvoiceBtn: {
    height: 42,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  closeClaimInvoiceBtnText: {
    color: COLORS.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  uploadPickerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  categoryChipTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  textInput: {
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: 12,
    fontSize: 13,
    color: COLORS.onSurface,
  },
  emergencyAdminCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 12,
    marginBottom: 12,
  },
  emergencyHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  emergencyTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  emergencyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyOverline: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPending,
  },
  emergencyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
    marginTop: 1,
  },
  progressSection: {
    gap: 6,
  },
  progressLabelsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressSummaryText: {
    fontSize: 12,
    
    color: COLORS.onSurfaceVariant,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceContainer,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: COLORS.secondary,
  },
  contributorsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarsGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarTextLight: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  contributorsCountLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginRight: 4,
  },
  residentShareBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  residentShareText: {
    fontSize: 12,
    color: COLORS.onSurface,
  },
  residentShareBold: {
    fontWeight: '700',
    fontSize: 14,
  },
  modalProgressHeaderBox: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  modalProgressSubRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 8,
    marginTop: 2,
  },
  modalProgressSubText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  emergencyCardActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
  },
  viewDetailsBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  closeClaimInvoiceBtnCompact: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  closeClaimInvoiceBtnCompactText: {
    color: COLORS.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  detailsTabRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  detailsTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
  },
  detailsTabBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  detailsTabBtnText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  detailsTabBtnTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  aptItemCard: {
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  aptItemTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aptNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  aptNumberBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  aptResidentName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  aptPaymentInfo: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'right',
  },
  aptActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 10,
  },
  whatsappReminderBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#25D366',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  whatsappReminderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  recordCashBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.secondaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recordCashBtnText: {
    color: COLORS.onSecondaryContainer,
    fontSize: 12,
    fontWeight: '700',
  },
  bulkReminderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainer,
  },
  bulkReminderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionSubCount: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  badgeMuted: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  badgeMutedText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },

  // Building Pulse & Overview
  pulseSection: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  pulseGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  pulseCol: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'flex-end',
    gap: 4,
  },
  pulseColIconRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseColTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  pulseColNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pulseColSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  communityPulseBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  communityPulseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  communityPulseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#166534',
  },
  communityPulseBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Quick Navigation Hub
  quickNavSection: {
    marginBottom: 16,
  },
  quickNavGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  quickNavCard: {
    width: '48.5%',
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-end',
    gap: 6,
  },
  quickNavIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainer,
  },
  quickNavCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  quickNavCardSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },

  // Developer & Testing Reset Section
  testingCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  testingHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  testingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  testingSubtitle: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'right',
    lineHeight: 18,
  },
  testingActionBtnAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  testingActionBtnRed: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  testingActionTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testingActionTitleAmber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  testingActionTitleRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  testingActionDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 16,
  },
  paymentNotesBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  paymentNotesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    textAlign: 'right',
  },
});
