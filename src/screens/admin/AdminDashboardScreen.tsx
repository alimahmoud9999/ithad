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
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  Apartment,
  ClaimDistributionType,
  EmergencyClaim,
  Payment,
  PlanTier,
} from '../../types/database';
import {
  CompressedUploadResult,
  pickAndCompressUploadImage,
} from '../../utils/imageUpload';
import {
  copyToClipboard,
  sendWhatsAppInvite,
  generateInviteMessage,
} from '../../utils/inviteHelper';

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
}) => {
  const {
    currentUser,
    currentBuilding,
    apartments,
    pendingResidents,
    payments,
    emergencyClaims,
    expenses,
    plans,
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
  } = useAppStore();

  // Modals State
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
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

  return (
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
            onPress={() => setSubscriptionModalVisible(true)}
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
          onPress={() => setSubscriptionModalVisible(true)}
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

      {/* 3. Quick Action Buttons (admin_dashboard/code.html lines 79-114) */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <Text style={styles.sectionHint}>اختصارات فورية</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => setExpenseModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: COLORS.surfaceContainerHigh },
              ]}
            >
              <MaterialIcons
                name="post-add"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.quickActionLabel}>إضافة مصروف</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => setEmergencyModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: COLORS.errorContainer },
              ]}
            >
              <MaterialIcons
                name="emergency"
                size={22}
                color={COLORS.error}
              />
            </View>
            <Text style={styles.quickActionLabel}>طوارئ جديدة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={handleBulkReminder}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: COLORS.tertiaryFixed },
              ]}
            >
              <MaterialIcons
                name="campaign"
                size={22}
                color={COLORS.tertiaryContainer}
              />
            </View>
            <Text style={styles.quickActionLabel}>تذكير الكل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => setSubscriptionModalVisible(true)}
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: COLORS.secondaryContainer },
              ]}
            >
              <MaterialIcons
                name="workspace-premium"
                size={22}
                color={COLORS.onSecondaryContainer}
              />
            </View>
            <Text style={styles.quickActionLabel}>باقة التطبيق</Text>
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
            const paymentInfoLabel =
              payment.payment_category === 'emergency_claim'
                ? claimObj
                  ? `طوارئ: ${claimObj.title}`
                  : 'مساهمة طوارئ'
                : payment.billing_month;

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
                        <Text style={styles.paymentTimeText}>
                          {paymentInfoLabel}
                        </Text>
                      </View>
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
                    onPress={() =>
                      setPreviewReceiptUrl(payment.receipt_image_url || null)
                    }
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

        {unpaidApartments.map((apt) => (
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
                          (apt.unpaid_months_count || 1) >= 2
                            ? COLORS.statusUnpaid
                            : COLORS.statusPending,
                      },
                    ]}
                  >
                    متأخر {apt.unpaid_months_count || 1} شهر
                  </Text>
                </View>
              </View>

              <Text style={styles.defaulterAmount}>
                {(apt.unpaid_amount || 400).toLocaleString()} ج.م
              </Text>
            </View>

            <View style={styles.defaulterActionsRow}>
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
                onPress={() =>
                  Alert.alert(
                    'تأكيد يدوي',
                    `لتسجيل السداد النقدي لشقة ${apt.apartment_number}، يمكنك اعتماده من طلبات السداد أو سجل الخزينة.`
                  )
                }
              >
                <MaterialIcons
                  name="edit-note"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.manualConfirmText}>تأكيد يدوي</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
      {/* Modal 4: Full-screen Receipt Image Preview                           */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(previewReceiptUrl)}
        title="معاينة صورة إيصال التحويل"
        subtitle="فحص الإيصال المرفق قبل الاعتماد في الخزينة"
        onClose={() => setPreviewReceiptUrl(null)}
      >
        {previewReceiptUrl && (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Image
              source={{ uri: previewReceiptUrl }}
              style={styles.fullReceiptImage}
              resizeMode="cover"
            />
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
});
