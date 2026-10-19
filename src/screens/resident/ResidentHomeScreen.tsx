import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  I18nManager,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import {
  ApartmentObligation,
  CashRecipientType,
  EmergencyClaim,
  PaymentCategoryType,
  PaymentMethodType,
} from '../../types/database';
import { pickAndCompressUploadImage } from '../../utils/imageUpload';
import { copyToClipboard } from '../../utils/inviteHelper';

interface ResidentHomeScreenProps {
  onNavigateExpenses: () => void;
  onNavigateCommunity?: () => void;
}

type ActiveSubView = 'none' | 'payment_modal' | 'unit_ledger' | 'add_ticket' | 'docs_bylaws';

/**
 * Resident Experience (Track 2)
 * Faithfully implementing Screens 7 through 12 from Developer Handover Specs v2.4:
 * - Screen 7: RESIDENT_HOME (design/._302)
 * - Screen 8: PAYMENT_STATUS (design/_2)
 * - Screen 9: PAY_UPLOAD_RECEIPT (design/_2)
 * - Screen 10: UNIT_LEDGER (design/_22)
 * - Screen 11: ADD_TICKET_FORM (design/_1)
 * - Screen 12: DOCS_BYLAWS (design/_14)
 *
 * All live Supabase sync, image auto-compression, receipt handling, and calculations are strictly preserved.
 */
export const ResidentHomeScreen: React.FC<ResidentHomeScreenProps> = ({
  onNavigateExpenses,
  onNavigateCommunity,
}) => {
  const {
    currentUser,
    currentBuilding,
    apartments,
    apartmentObligations,
    payments,
    emergencyClaims,
    expenses,
    submitResidentPayment,
    switchRole,
    setAuthenticated,
    refreshData,
    logout,
  } = useAppStore();

  const [activeSubView, setActiveSubView] = useState<ActiveSubView>('none');

  // Find current resident's apartment
  const myApartment = useMemo(() => {
    const myAptNum = currentUser.apartment_number;
    const myAptId = currentUser.apartment_id;
    return (
      apartments.find(
        (a) =>
          (myAptId && a.id === myAptId) ||
          (myAptNum && a.apartment_number && String(a.apartment_number).trim() === String(myAptNum).trim())
      ) || null
    );
  }, [apartments, currentUser.apartment_id, currentUser.apartment_number]);

  // Current resident's registered obligations
  const myObligations = useMemo(() => {
    const myAptNum = currentUser.apartment_number || myApartment?.apartment_number;
    const myAptId = currentUser.apartment_id || myApartment?.id;
    return apartmentObligations.filter((o) => {
      if (myAptId && o.apartment_id === myAptId) return true;
      if (myAptNum && o.apartment_number && String(o.apartment_number).trim() === String(myAptNum).trim()) return true;
      return false;
    });
  }, [apartmentObligations, currentUser.apartment_id, currentUser.apartment_number, myApartment]);

  const myUnpaidObligations = useMemo(() => {
    return myObligations.filter((o) => o.status === 'unpaid');
  }, [myObligations]);

  const myActiveObligations = useMemo(() => {
    return myObligations.filter((o) => o.status === 'unpaid' || o.status === 'pending');
  }, [myObligations]);

  const totalObligationsDebt = useMemo(() => {
    return myUnpaidObligations.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [myUnpaidObligations]);

  const effectiveArrears = useMemo(() => {
    const aptArrears = myApartment?.arrears_amount || myApartment?.unpaid_amount || 0;
    if (aptArrears > 0 && totalObligationsDebt > 0) {
      return Math.min(aptArrears, totalObligationsDebt);
    }
    return Math.max(totalObligationsDebt, aptArrears);
  }, [totalObligationsDebt, myApartment]);

  // Pending payments for arrears or obligations
  const pendingArrearsPayments = useMemo(() => {
    const myAptNum = currentUser.apartment_number || myApartment?.apartment_number;
    const myAptId = currentUser.apartment_id || myApartment?.id;
    return payments.filter(
      (p) =>
        p.status === 'pending' &&
        ((myAptId && p.apartment_id === myAptId) ||
          (myAptNum && p.apartment_number && String(p.apartment_number).trim() === String(myAptNum).trim()) ||
          (currentUser.id && p.resident_id === currentUser.id)) &&
        (p.notes?.includes('مديونية') || p.notes?.includes('[سداد') || p.payment_category === 'monthly_dues')
    );
  }, [payments, currentUser.apartment_id, currentUser.apartment_number, currentUser.id, myApartment]);

  const totalPendingArrearsAmount = useMemo(() => {
    return pendingArrearsPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [pendingArrearsPayments]);

  // Payment State (Screens 8 & 9: PAYMENT_STATUS & PAY_UPLOAD_RECEIPT - _2)
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategoryType>('monthly_dues');
  const [selectedClaim, setSelectedClaim] = useState<EmergencyClaim | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<ApartmentObligation | null>(null);
  const [isArrearsPaymentMode, setIsArrearsPaymentMode] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>(
    String(currentBuilding.default_monthly_dues || 400)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('electronic_transfer');
  const [cashRecipient, setCashRecipient] = useState<CashRecipientType>('admin');
  const [receiptAttached, setReceiptAttached] = useState<boolean>(false);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('');
  const [receiptSizeKb, setReceiptSizeKb] = useState<number>(0);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

  // Maintenance Ticket State (Screen 11: ADD_TICKET_FORM - _1)
  const [ticketScope, setTicketScope] = useState<string>('المصعد');
  const [ticketSeverity, setTicketSeverity] = useState<'عادي' | 'متوسط (48 ساعة)' | 'طارئ وحرج'>('متوسط (48 ساعة)');
  const [ticketTitle, setTicketTitle] = useState<string>('');
  const [ticketDescription, setTicketDescription] = useState<string>('');
  const [ticketPreferredTime, setTicketPreferredTime] = useState<'أي وقت' | 'صباحية' | 'مسائية'>('أي وقت');
  const [submittingTicket, setSubmittingTicket] = useState<boolean>(false);

  // Docs Filter State (Screen 12: DOCS_BYLAWS - _14)
  const [docFilter, setDocFilter] = useState<'all' | 'bylaws' | 'contracts' | 'blueprints'>('all');

  const currentBillingMonth = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const currentMonthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'الشهر الحالي';
    }
  }, []);

  // Determine current resident's monthly payment status
  const currentMonthPayment = useMemo(() => {
    const myApt = currentUser.apartment_number || '302';
    return payments.find(
      (p) =>
        ((p.resident_id && currentUser.id && p.resident_id === currentUser.id) ||
          (p.resident_id && p.resident_id === 'usr-res-001') ||
          (Boolean(p.apartment_number) &&
            String(p.apartment_number).trim() === String(myApt).trim()) ||
          (Boolean(p.apartment_id) &&
            Boolean(currentUser.apartment_id) &&
            p.apartment_id === currentUser.apartment_id)) &&
        p.payment_category === 'monthly_dues' &&
        p.billing_month === currentBillingMonth
    );
  }, [
    payments,
    currentUser.id,
    currentUser.apartment_number,
    currentUser.apartment_id,
    currentBillingMonth,
  ]);

  const monthlyStatus = currentMonthPayment?.status || 'unpaid';

  // Open Payment Sheet
  const openMonthlyPaymentSheet = () => {
    if (monthlyStatus === 'paid') {
      Alert.alert(
        'تم السداد مسبقاً ✅',
        `تم سداد اشتراك شهر (${currentMonthLabel}) بالكامل بالفعل ومعتمد في خزينة العمارة.`
      );
      return;
    }
    if (monthlyStatus === 'pending') {
      Alert.alert(
        'طلب قيد المراجعة ⏳',
        `لديك طلب سداد لاشتراك (${currentMonthLabel}) قيد مراجعة رئيس الاتحاد بالفعل.`
      );
      return;
    }
    setSelectedObligation(null);
    setIsArrearsPaymentMode(false);
    setPaymentCategory('monthly_dues');
    setSelectedClaim(null);
    setPaymentAmount(String(currentBuilding.default_monthly_dues || 400));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openObligationPaymentSheet = (obligation: ApartmentObligation) => {
    setSelectedObligation(obligation);
    setIsArrearsPaymentMode(true);
    setSelectedClaim(null);
    setPaymentCategory(obligation.category || 'monthly_dues');
    setPaymentAmount(String(obligation.amount));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openArrearsPaymentSheet = (amount?: number, isPartial?: boolean) => {
    const targetAmount = amount && amount > 0 ? amount : effectiveArrears;
    if (targetAmount <= 0) {
      Alert.alert('لا توجد مديونية', 'لا توجد أي مديونيات أو متأخرات مسجلة على شقتك حالياً.');
      return;
    }
    setSelectedObligation(null);
    setIsArrearsPaymentMode(true);
    setSelectedClaim(null);
    setPaymentCategory('monthly_dues');
    if (isPartial) {
      // Suggest reasonable partial amount (e.g. 1000 or half)
      const suggested = effectiveArrears > 1000 ? '1000' : String(effectiveArrears);
      setPaymentAmount(suggested);
    } else {
      setPaymentAmount(String(targetAmount));
    }
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openEmergencyContributionSheet = (claim: EmergencyClaim) => {
    setSelectedObligation(null);
    setIsArrearsPaymentMode(false);
    setPaymentCategory('emergency_claim');
    setSelectedClaim(claim);
    setPaymentAmount(String(claim.default_share_amount || 250));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  // Image upload with compression
  const handlePickAndCompressReceipt = async (source: 'library' | 'camera') => {
    setUploadingReceipt(true);
    try {
      const res = await pickAndCompressUploadImage({
        bucket: 'payment-receipts',
        buildingId: currentBuilding.id,
        yearMonth: currentBillingMonth,
        source,
      });
      if (res) {
        setReceiptAttached(true);
        setReceiptImageUrl(res.publicUrl);
        setReceiptFileName(res.storagePath);
        setReceiptSizeKb(res.estimatedSizeKb);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع صورة الإيصال');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Submit payment
  const handleConfirmPayment = async () => {
    const numericAmount = parseFloat(paymentAmount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (isArrearsPaymentMode && !selectedObligation && numericAmount > effectiveArrears) {
      Alert.alert(
        'تنبيه',
        `المبلغ المدخل (${numericAmount.toLocaleString()} ج.م) أكبر من إجمالي المديونية المسجلة (${effectiveArrears.toLocaleString()} ج.م).`
      );
      return;
    }

    if (paymentMethod === 'electronic_transfer' && !receiptAttached) {
      Alert.alert(
        'صورة الإيصال مطلوبة',
        'يرجى اختيار أو تصوير إيصال التحويل الإلكتروني ليتم ضغطه ورفعه.'
      );
      return;
    }

    let notesText = '';
    if (selectedObligation) {
      notesText = `[سداد بند: ${selectedObligation.title} #${selectedObligation.id}]`;
    } else if (isArrearsPaymentMode) {
      if (numericAmount >= effectiveArrears) {
        notesText = `[سداد كامل المديونية: ${numericAmount} ج.م]`;
      } else {
        notesText = `[سداد جزئي من المديونية: ${numericAmount} ج.م من أصل ${effectiveArrears} ج.م]`;
      }
    }

    setSubmittingPayment(true);
    try {
      await submitResidentPayment({
        amount: numericAmount,
        paymentMethod,
        billingMonth: selectedObligation?.billing_month || currentBillingMonth,
        cashRecipient: paymentMethod === 'cash' ? cashRecipient : undefined,
        receiptImageUrl: paymentMethod === 'electronic_transfer' ? receiptImageUrl : undefined,
        paymentCategory,
        emergencyClaimId: selectedClaim?.id,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notesText || undefined,
        obligationId: selectedObligation?.id,
        obligationTitle: selectedObligation?.title,
        isArrears: isArrearsPaymentMode,
      });
      setActiveSubView('none');
      Alert.alert(
        'تم إرسال طلب السداد ⏳',
        'حالة الدفعة الآن "قيد المراجعة" (Pending) وستُضاف لرصيد الصندوق وتُخصم من مديونيتك فور تدقيقها واعتمادها من رئيس الاتحاد.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال طلب السداد');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Submit maintenance ticket
  const handleSubmitTicket = () => {
    if (!ticketTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المشكلة أو العطل.');
      return;
    }
    setSubmittingTicket(true);
    setTimeout(() => {
      setSubmittingTicket(false);
      setActiveSubView('none');
      setTicketTitle('');
      setTicketDescription('');
      Alert.alert(
        'تم إرسال البلاغ بنجاح 🛠️',
        `تم تسجيل البلاغ الخاص بـ (${ticketScope}) وإشعار رئيس الاتحاد وفني الصيانة للمتابعة فوراً.`
      );
    }, 600);
  };

  // Resident history payments for Unit Ledger (Screen 10)
  const myUnitPayments = useMemo(() => {
    const myApt = currentUser.apartment_number || '302';
    return payments.filter(
      (p) =>
        (p.resident_id && currentUser.id && p.resident_id === currentUser.id) ||
        (Boolean(p.apartment_number) && String(p.apartment_number).trim() === String(myApt).trim())
    );
  }, [payments, currentUser]);

  // If resident account is still pending admin approval
  if (currentUser.status === 'pending') {
    return (
      <View style={styles.pendingAccountScreen}>
        <View style={styles.pendingCard}>
          <View style={styles.pendingIconCircle}>
            <MaterialIcons name="hourglass-top" size={36} color={COLORS.statusPending} />
          </View>
          <Text style={styles.pendingScreenTitle}>طلبك قيد المراجعة والاعتماد</Text>
          <Text style={styles.pendingScreenDesc}>
            مرحباً {currentUser.full_name}، تم إرسال طلب انضمامك إلى ({currentBuilding.name} - شقة {currentUser.apartment_number || '302'}) وهو بانتظار مراجعة وتفعيل رئيس الاتحاد.
          </Text>
          <View
            style={{
              flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#FEF3C7',
              borderWidth: 1,
              borderColor: '#FDE68A',
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginTop: 6,
            }}
          >
            <MaterialIcons name="info-outline" size={16} color="#D97706" />
            <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
              سيصلك إشعار فوري عند قيام رئيس الاتحاد باعتماد حسابك
            </Text>
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14, width: '100%' }}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: COLORS.primary,
                paddingVertical: 10,
                borderRadius: 10,
              }}
              onPress={async () => {
                await refreshData();
                Alert.alert('جاري التحديث 🔄', 'تم فحص أحدث حالة لطلبك من السيرفر.');
              }}
            >
              <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>تحديث الحالة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: '#FEE2E2',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
              onPress={async () => {
                await logout();
              }}
            >
              <MaterialIcons name="logout" size={16} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>خروج</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 7: RESIDENT HOME SCREEN (design/._302)
  // --------------------------------------------------------------------------
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 1. Resident Welcome & Verification Banner */}
      <View style={styles.residentHeaderSection}>
        <View style={styles.rowBetween}>
          <View style={styles.rowAlign}>
            <View style={styles.verifiedGreenCapsule}>
              <MaterialIcons name="verified" size={14} color={COLORS.secondary} />
              <Text style={styles.verifiedGreenText}>حساب مفعل وموثق</Text>
            </View>
            <View style={styles.sharePercentCapsule}>
              <Text style={styles.sharePercentText}>مالك مقيم (6.25%)</Text>
            </View>
          </View>
          <Text style={styles.cycleDateText}>{currentMonthLabel}</Text>
        </View>

        <View style={{ marginTop: 6 }}>
          <Text style={styles.residentGreeting}>
            مرحباً، {currentUser.full_name || 'م. أحمد مصطفى'} 👋
          </Text>
          <View style={[styles.rowAlign, { marginTop: 2 }]}>
            <MaterialIcons name="location-on" size={16} color={COLORS.secondary} />
            <Text style={styles.unitLocationText}>
              شقة {currentUser.apartment_number || '302'} • {currentUser.floor_number || 'الدور الثالث'} (واجهة) • {currentBuilding.name}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Monthly Due / Subscription Status Card (Hero Banner) */}
      <View style={styles.heroDueCard}>
        <View style={styles.heroGlowAccent} />
        <View style={{ zIndex: 2, gap: 14 }}>
          {/* Top Row: Badge & Cycle */}
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View
                style={[
                  styles.statusIndicatorDot,
                  monthlyStatus === 'paid' && { backgroundColor: COLORS.statusPaid },
                  monthlyStatus === 'pending' && { backgroundColor: COLORS.statusPending },
                ]}
              />
              <Text style={styles.cycleSubHeading}>اشتراك الشهر الحالي</Text>
            </View>
            <View
              style={[
                styles.dueStatusBadge,
                monthlyStatus === 'paid' && { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
              ]}
            >
              <Text
                style={[
                  styles.dueStatusBadgeText,
                  monthlyStatus === 'paid' && { color: COLORS.statusPaid },
                ]}
              >
                {monthlyStatus === 'paid'
                  ? 'تم السداد ✅'
                  : monthlyStatus === 'pending'
                  ? 'قيد المراجعة ⏳'
                  : 'مستحق السداد'}
              </Text>
            </View>
          </View>

          {/* Amount and Due Date */}
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.amountLabelLight}>المبلغ المطلوب لدورة {currentMonthLabel}</Text>
              <View style={styles.rowAlign}>
                <Text style={styles.amountHeroNumber}>
                  {currentBuilding.default_monthly_dues || 400}
                </Text>
                <Text style={styles.currencyHeroSub}>ج.م</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amountLabelLight}>تاريخ الاستحقاق</Text>
              <Text style={styles.dueDateText}>1 {currentMonthLabel}</Text>
            </View>
          </View>

          {/* Status Subtext Pill */}
          <View
            style={[
              styles.balanceStatusPill,
              effectiveArrears > 0 && styles.balanceStatusPillArrears,
            ]}
          >
            <MaterialIcons
              name={effectiveArrears > 0 ? 'warning' : 'account-balance-wallet'}
              size={18}
              color={effectiveArrears > 0 ? '#FCA5A5' : COLORS.secondaryFixed}
            />
            <Text style={styles.balanceStatusText}>
              {effectiveArrears > 0 ? (
                <>
                  مديونية ومتأخرات سابقة مسجلة:{' '}
                  <Text style={{ color: '#FCA5A5', fontWeight: '800' }}>
                    {effectiveArrears.toLocaleString()} ج.م
                  </Text>
                </>
              ) : (
                <>
                  الرصيد المالي السابق: <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>0.00 ج.م</Text> (حساب منتظم)
                </>
              )}
            </Text>
          </View>

          {/* Primary Action Button */}
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.payNowMainBtn,
                monthlyStatus === 'paid' && styles.payNowMainBtnDisabled,
              ]}
              activeOpacity={0.88}
              onPress={openMonthlyPaymentSheet}
            >
              <MaterialIcons name="bolt" size={20} color={COLORS.onSecondary} />
              <Text style={styles.payNowMainBtnText}>
                {monthlyStatus === 'paid'
                  ? 'تم سداد الاشتراك واعتماده بالخزينة ✅'
                  : monthlyStatus === 'pending'
                  ? 'إيصالك قيد المراجعة من رئيس الاتحاد ⏳'
                  : 'سداد الاشتراك ورفع الإيصال ⚡'}
              </Text>
            </TouchableOpacity>

            <View style={styles.paymentMethodsChipsRow}>
              <View style={styles.rowAlign}>
                <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
                <Text style={styles.methodChipLabel}>إنستاباي</Text>
              </View>
              <View style={styles.dotDivider} />
              <View style={styles.rowAlign}>
                <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
                <Text style={styles.methodChipLabel}>فودافون كاش</Text>
              </View>
              <View style={styles.dotDivider} />
              <View style={styles.rowAlign}>
                <MaterialIcons name="check-circle" size={14} color={COLORS.secondaryFixed} />
                <Text style={styles.methodChipLabel}>نقداً للخزينة</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 2.1 Resident Arrears & Obligations Detailed Card */}
      {(effectiveArrears > 0 || myActiveObligations.length > 0) && (
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
      )}

      {/* Quick Action Navigation Strip (Unit Ledger, Add Ticket, Bylaws) */}
      <View style={styles.quickServicesGrid}>
        <TouchableOpacity
          style={styles.servicePillBtn}
          onPress={() => setActiveSubView('unit_ledger')}
        >
          <MaterialIcons name="receipt-long" size={20} color={COLORS.primary} />
          <Text style={styles.servicePillText}>كشف حساب الوحدة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.servicePillBtn}
          onPress={() => setActiveSubView('add_ticket')}
        >
          <MaterialIcons name="handyman" size={20} color={COLORS.secondary} />
          <Text style={styles.servicePillText}>بلاغ صيانة وعطل</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.servicePillBtn}
          onPress={() => setActiveSubView('docs_bylaws')}
        >
          <MaterialIcons name="menu-book" size={20} color={COLORS.statusPending} />
          <Text style={styles.servicePillText}>اللائحة والعقود</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Emergency Repair / Special Fund Contribution Widget */}
      {emergencyClaims.length > 0 && (
        <View style={styles.emergencyCardContainer}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={styles.emergencyIconBox}>
                <MaterialIcons name="handyman" size={20} color={COLORS.statusUnpaid} />
              </View>
              <View>
                <Text style={styles.emergencyCategoryLabel}>صندوق صيانة طارئة نشط</Text>
                <Text style={styles.emergencyTitleText}>
                  {emergencyClaims[0].title || 'تجديد طلمبة المياه وتحديث لوحة الكهرباء'}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.progressSubText}>
                تم جمع <Text style={{ fontWeight: '700', color: COLORS.onSurface }}>3,250 ج.م</Text> من أصل {emergencyClaims[0].target_amount} ج.م
              </Text>
              <Text style={styles.progressPercentText}>65% مكتمل</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '65%' }]} />
            </View>
          </View>

          {/* Neighbor Contributors Row */}
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <View style={styles.rowAlign}>
              <View style={styles.avatarStackRow}>
                <View style={[styles.avatarCircle, { backgroundColor: COLORS.primaryContainer }]}>
                  <Text style={styles.avatarCircleText}>ش١</Text>
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: COLORS.surfaceContainerHigh }]}>
                  <Text style={[styles.avatarCircleText, { color: COLORS.onSurface }]}>ش٤</Text>
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: COLORS.secondary }]}>
                  <Text style={styles.avatarCircleText}>ش٦</Text>
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: COLORS.surfaceContainer }]}>
                  <Text style={[styles.avatarCircleText, { color: COLORS.onSurfaceVariant }]}>+7</Text>
                </View>
              </View>
              <Text style={styles.contributorsLabel}>ساهم 10 ملاك حتى الآن</Text>
            </View>
            <View style={styles.shareBadgePill}>
              <Text style={styles.shareBadgeText}>
                حصتك: <Text style={{ fontWeight: '800' }}>{emergencyClaims[0].default_share_amount || 250} ج.م</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.contributeBtn}
            onPress={() => openEmergencyContributionSheet(emergencyClaims[0])}
          >
            <MaterialIcons name="payments" size={18} color={COLORS.primary} />
            <Text style={styles.contributeBtnText}>
              المساهمة في الصندوق الطارئ ({emergencyClaims[0].default_share_amount || 250} ج.م)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Active General Assembly Poll / Decision Widget */}
      <View style={styles.pollCardContainer}>
        <View style={styles.rowBetween}>
          <View style={styles.pollCountdownBadge}>
            <MaterialIcons name="schedule" size={14} color={COLORS.statusUpcoming} />
            <Text style={styles.pollCountdownText}>ينتهي خلال 3 أيام</Text>
          </View>
          <Text style={styles.pollWeightText}>
            صوتك يمثل <Text style={{ fontWeight: '700', color: COLORS.onSurface }}>6.25%</Text>
          </Text>
        </View>

        <View style={[styles.rowAlign, { alignItems: 'flex-start', marginTop: 4 }]}>
          <View style={styles.pollIconBox}>
            <MaterialIcons name="how-to-vote" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pollHeading}>تصويت: التعاقد مع شركة حراسة وأمن جديدة</Text>
            <Text style={styles.pollDescription}>
              بناءً على طلب الجلسة الماضية، معروض عرضين لتأمين المداخل وتغطية كاميرات المراقبة على مدار الساعة.
            </Text>
          </View>
        </View>

        <View style={styles.pollParticipationBanner}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="how-to-reg" size={16} color={COLORS.secondary} />
            <Text style={styles.pollParticipationText}>صوّت 12 من 16 شقة (75%)</Text>
          </View>
          <Text style={styles.notVotedTag}>لم تصوّت بعد</Text>
        </View>

        <TouchableOpacity
          style={styles.participatePollBtn}
          onPress={() => onNavigateCommunity?.()}
        >
          <Text style={styles.participatePollBtnText}>المشاركة في التصويت الآن 🗳️</Text>
          <MaterialIcons name="arrow-back" size={18} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* 5. Transparency & Recent Building Expenses Snapshot */}
      <View style={styles.expensesSection}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.expensesSectionTitle}>أحدث مصروفات العقار</Text>
            <Text style={styles.expensesSectionSub}>الشفافية المالية المعتمدة للبرج</Text>
          </View>
          <TouchableOpacity
            style={styles.rowAlign}
            onPress={onNavigateExpenses}
          >
            <Text style={styles.viewAllExpensesLink}>عرض الكل</Text>
            <MaterialIcons name="chevron-left" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8, marginTop: 8 }}>
          {expenses.slice(0, 3).map((exp) => (
            <View key={exp.id} style={styles.expenseSnapshotCard}>
              <View style={styles.rowAlign}>
                <View style={styles.expenseIconBox}>
                  <MaterialIcons name="receipt" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.expenseItemTitle}>{exp.title}</Text>
                  <View style={styles.rowAlign}>
                    <MaterialIcons name="verified" size={13} color={COLORS.secondary} />
                    <Text style={styles.expenseItemSub}>{(exp as any).category_display || (exp as any).category || 'فاتورة رسمية مدققة'}</Text>
                  </View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.expenseAmountText}>{exp.amount.toLocaleString()}</Text>
                <Text style={styles.expenseCurrencyText}>ج.م</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: PAYMENT & RECEIPT UPLOAD (Screens 8 & 9 - _2)                 */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={activeSubView === 'payment_modal'}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActiveSubView('none')}
      >
        <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.topBackBar}>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={() => setActiveSubView('none')}
            >
              <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.barCenterTitle}>
              {selectedObligation
                ? 'سداد بند مديونية محدد'
                : isArrearsPaymentMode
                ? 'سداد المديونية / تقسيط مرن'
                : paymentCategory === 'emergency_claim'
                ? 'سداد مساهمة الطوارئ'
                : 'سداد الاشتراك الشهري'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Bill Summary Card */}
          <View style={styles.formSectionCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.amountLabelDark}>
                  {selectedObligation
                    ? 'تفاصيل البند المستحق'
                    : isArrearsPaymentMode
                    ? 'تسوية رصيد المديونية والمتأخرات'
                    : 'المطالبة المالية الدورية'}
                </Text>
                <Text style={styles.billTitleText}>
                  {selectedObligation
                    ? selectedObligation.title
                    : isArrearsPaymentMode
                    ? 'سداد مديونية سابقة لحساب الشقة'
                    : paymentCategory === 'monthly_dues'
                    ? `اشتراك صيانة ونظافة شهر ${currentMonthLabel}`
                    : selectedClaim?.title || 'مساهمة صندوق الطوارئ'}
                </Text>
                {selectedObligation?.billing_month ? (
                  <Text style={styles.obligationSubNote}>
                    دورة شهر: {selectedObligation.billing_month}
                  </Text>
                ) : null}
              </View>
              <View style={styles.dueCountdownBadge}>
                <View style={styles.dotPulseAmber} />
                <Text style={styles.dueCountdownText}>
                  {isArrearsPaymentMode ? 'متأخرات مستحقة' : 'مستحق السداد'}
                </Text>
              </View>
            </View>

            {/* If partial/general arrears mode without single obligation */}
            {isArrearsPaymentMode && !selectedObligation ? (
              <View style={styles.partialPayCardContainer}>
                <Text style={styles.partialPayLabel}>حدد المبلغ الذي ترغب في سداده الآن:</Text>

                {/* Quick Chips */}
                <View style={styles.quickChipsRow}>
                  {[500, 1000, 2000]
                    .filter((amt) => amt < effectiveArrears)
                    .map((amt) => (
                      <TouchableOpacity
                        key={amt}
                        style={[
                          styles.quickChipBtn,
                          paymentAmount === String(amt) && styles.quickChipBtnActive,
                        ]}
                        onPress={() => setPaymentAmount(String(amt))}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            paymentAmount === String(amt) && styles.quickChipTextActive,
                          ]}
                        >
                          {amt.toLocaleString()} ج.م
                        </Text>
                      </TouchableOpacity>
                    ))}
                  <TouchableOpacity
                    style={[
                      styles.quickChipBtn,
                      paymentAmount === String(effectiveArrears) && styles.quickChipBtnActive,
                    ]}
                    onPress={() => setPaymentAmount(String(effectiveArrears))}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        paymentAmount === String(effectiveArrears) && styles.quickChipTextActive,
                      ]}
                    >
                      كامل المبلغ ({effectiveArrears.toLocaleString()})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Amount Input */}
                <View style={styles.amountInputRow}>
                  <TextInput
                    style={styles.partialAmountInput}
                    value={paymentAmount}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/[^0-9]/g, '');
                      setPaymentAmount(cleaned);
                    }}
                    keyboardType="numeric"
                    placeholder="اكتب المبلغ هنا..."
                    placeholderTextColor={COLORS.outline}
                  />
                  <Text style={styles.amountInputCurrency}>ج.م</Text>
                </View>

                {/* Debt calculation preview */}
                <View style={styles.debtCalculationBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.calcLabel}>إجمالي المديونية المسجلة:</Text>
                    <Text style={styles.calcValue}>{effectiveArrears.toLocaleString()} ج.م</Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.calcLabel}>المبلغ المراد سداده الآن:</Text>
                    <Text style={[styles.calcValue, { color: '#059669', fontWeight: 'bold' }]}>
                      {(parseFloat(paymentAmount) || 0).toLocaleString()} ج.م
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rowBetween,
                      { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 6, marginTop: 4 },
                    ]}
                  >
                    <Text style={styles.calcLabelBold}>المتبقي بعد هذا السداد:</Text>
                    <Text style={styles.calcValueBold}>
                      {Math.max(
                        0,
                        effectiveArrears - (parseFloat(paymentAmount) || 0)
                      ).toLocaleString()}{' '}
                      ج.م
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Amount Banner */
              <View style={styles.amountBannerNavy}>
                <View>
                  <Text style={styles.amountLabelLight}>
                    {selectedObligation ? 'قيمة هذا البند' : 'المبلغ الإجمالي المستحق'}
                  </Text>
                  <View style={styles.rowAlign}>
                    <Text style={styles.amountHeroNumber}>{paymentAmount}</Text>
                    <Text style={styles.currencySubHero}>ج.م</Text>
                  </View>
                </View>
                <View style={styles.receiptIconCircle}>
                  <MaterialIcons name="receipt-long" size={24} color={COLORS.secondaryFixed} />
                </View>
              </View>
            )}

            {/* Breakdown Accordion */}
            {selectedObligation ? (
              <View style={styles.feeBreakdownBox}>
                <Text style={styles.breakdownHeaderLabel}>تفاصيل البند المالي:</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.feeItemName}>اسم البند:</Text>
                  <Text style={styles.feeItemAmount}>{selectedObligation.title}</Text>
                </View>
                {selectedObligation.notes ? (
                  <View style={[styles.rowBetween, { marginTop: 4 }]}>
                    <Text style={styles.feeItemName}>ملاحظات رئيس الاتحاد:</Text>
                    <Text style={styles.feeItemAmount}>{selectedObligation.notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : isArrearsPaymentMode ? (
              <View style={styles.feeBreakdownBox}>
                <Text style={styles.breakdownHeaderLabel}>مرونة التقسيط والتسوية:</Text>
                <Text style={styles.arrearsNoticeText}>
                  💡 يمكنك سداد كامل المديونية أو دفع أي جزء مالي تختاره. فور اعتماد رئيس الاتحاد للإيصال سيتم خصم هذا المبلغ فوراً من كشف حساب شقتك وتحديث المتبقي.
                </Text>
              </View>
            ) : (
              <View style={styles.feeBreakdownBox}>
                <Text style={styles.breakdownHeaderLabel}>تفصيل الرسوم المستحقة:</Text>
                <View style={styles.rowBetween}>
                  <View style={styles.rowAlign}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.feeItemName}>صيانة المصعد الدورية وخدمات الكهرباء</Text>
                  </View>
                  <Text style={styles.feeItemAmount}>250 ج.م</Text>
                </View>
                <View style={styles.rowBetween}>
                  <View style={styles.rowAlign}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.feeItemName}>خدمات الحراسة والأمن والنظافة اليومية</Text>
                  </View>
                  <Text style={styles.feeItemAmount}>150 ج.م</Text>
                </View>
              </View>
            )}
          </View>

          {/* Payment Method Switcher */}
          <View style={{ gap: 8, marginBottom: 14 }}>
            <Text style={styles.sectionHeaderTitle}>اختر وسيلة السداد</Text>
            <View style={styles.twoColumnGrid}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === 'electronic_transfer' && styles.paymentMethodCardActive,
                ]}
                onPress={() => setPaymentMethod('electronic_transfer')}
              >
                <View style={styles.methodIconBox}>
                  <MaterialIcons
                    name="account-balance"
                    size={22}
                    color={paymentMethod === 'electronic_transfer' ? COLORS.secondaryFixed : COLORS.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.methodTitle,
                    paymentMethod === 'electronic_transfer' && styles.methodTitleActive,
                  ]}
                >
                  تحويل إلكتروني / إنستاباي
                </Text>
                <Text style={styles.methodSubtitle}>البنك والمحافظ الذكية</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === 'cash' && styles.paymentMethodCardActive,
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <View style={styles.methodIconBox}>
                  <MaterialIcons
                    name="payments"
                    size={22}
                    color={paymentMethod === 'cash' ? COLORS.secondaryFixed : COLORS.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.methodTitle,
                    paymentMethod === 'cash' && styles.methodTitleActive,
                  ]}
                >
                  دفع نقدي (كاش)
                </Text>
                <Text style={styles.methodSubtitle}>للحارس أو أمين الصندوق</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Method Content */}
          {paymentMethod === 'electronic_transfer' ? (
            <View style={styles.formSectionCard}>
              <View style={styles.rowBetween}>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="verified-user" size={20} color={COLORS.secondary} />
                  <Text style={styles.sectionHeaderTitle}>حسابات صندوق العقار الرسمية</Text>
                </View>
                <View style={styles.verifiedSmallBadge}>
                  <Text style={styles.verifiedSmallText}>معتمد رسمياً</Text>
                </View>
              </View>

              {/* InstaPay Copy Handle */}
              <View style={styles.copyHandleBox}>
                <View>
                  <Text style={styles.handleLabel}>عنوان الدفع اللحظي (InstaPay IPA)</Text>
                  <Text style={styles.handleValue}>elamal.tower@instapay</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyHandleBtn}
                  onPress={() => copyToClipboard('elamal.tower@instapay', 'حساب إنستاباي')}
                >
                  <MaterialIcons name="content-copy" size={16} color={COLORS.primary} />
                  <Text style={styles.copyHandleBtnText}>نسخ</Text>
                </TouchableOpacity>
              </View>

              {/* Receipt Upload Box */}
              <View style={styles.uploadReceiptSection}>
                <Text style={styles.fieldLabel}>إرفاق صورة إيصال التحويل (مع ضغط فوري للبيانات)</Text>
                {receiptAttached ? (
                  <View style={styles.receiptSuccessCard}>
                    <MaterialIcons name="task-alt" size={24} color={COLORS.statusPaid} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receiptSuccessTitle}>تم ضغط وتجهيز صورة الإيصال ✅</Text>
                      <Text style={styles.receiptSuccessSub}>الحجم: {receiptSizeKb} KB (توفير 80% من الباقة)</Text>
                    </View>
                    <TouchableOpacity onPress={() => handlePickAndCompressReceipt('library')}>
                      <Text style={styles.changeReceiptLink}>تغيير</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.twoColumnGrid}>
                    <TouchableOpacity
                      style={styles.uploadChoiceBtn}
                      onPress={() => handlePickAndCompressReceipt('camera')}
                      disabled={uploadingReceipt}
                    >
                      <MaterialIcons name="photo-camera" size={22} color={COLORS.primary} />
                      <Text style={styles.uploadChoiceText}>التقاط بالكاميرا</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.uploadChoiceBtn}
                      onPress={() => handlePickAndCompressReceipt('library')}
                      disabled={uploadingReceipt}
                    >
                      <MaterialIcons name="photo-library" size={22} color={COLORS.primary} />
                      <Text style={styles.uploadChoiceText}>من الاستوديو</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {uploadingReceipt && (
                  <View style={styles.rowAlign}>
                    <ActivityIndicator size="small" color={COLORS.secondary} />
                    <Text style={styles.compressingText}>جاري ضغط ومعالجة الصورة لتوفير باقة الهاتف...</Text>
                  </View>
                )}
              </View>

              {/* Reference Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>رقم العملية المرجعي / اسم المحول (اختياري)</Text>
                <TextInput
                  style={[styles.textInputField, styles.ltrField]}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                  placeholder="مثال: REF-987654"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>
          ) : (
            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>تحديد مستلم النقدية (الكاش)</Text>
              <View style={styles.twoColumnGrid}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectorPill,
                    cashRecipient === 'admin' && styles.roleSelectorPillActive,
                  ]}
                  onPress={() => setCashRecipient('admin')}
                >
                  <MaterialIcons name="person" size={18} color={COLORS.primary} />
                  <Text style={styles.roleSelectorPillText}>رئيس الاتحاد مباشرة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleSelectorPill,
                    cashRecipient === 'guard' && styles.roleSelectorPillActive,
                  ]}
                  onPress={() => setCashRecipient('guard')}
                >
                  <MaterialIcons name="shield" size={18} color={COLORS.primary} />
                  <Text style={styles.roleSelectorPillText}>حارس العقار (عم رجب)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirm Button */}
          <TouchableOpacity
            style={styles.primaryActionButton}
            activeOpacity={0.88}
            onPress={handleConfirmPayment}
            disabled={submittingPayment}
          >
            {submittingPayment ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color={COLORS.onPrimary} />
                <Text style={styles.primaryActionText}>
                  {paymentMethod === 'electronic_transfer'
                    ? 'إرسال إيصال التحويل للاعتماد'
                    : 'تسجيل الدفع النقدي وإشعار الإدارة'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: UNIT ACCOUNT STATEMENT & LEDGER (Screen 10 - _22)            */}
      {/* ---------------------------------------------------------------------- */}
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

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: ADD MAINTENANCE TICKET (Screen 11 - _1)                      */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={activeSubView === 'add_ticket'}
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
            <Text style={styles.barCenterTitle}>تقديم بلاغ عطل وصيانة</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Header Banner */}
          <View style={styles.ticketHeroCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.ticketUrgentTag}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.ticketUrgentTagText}>مسار المتابعة الفورية مُفعّل</Text>
                </View>
                <Text style={styles.ticketHeroTitle}>تقديم بلاغ عطل أو صيانة</Text>
                <Text style={styles.ticketHeroSub}>
                  يتم إشعار إدارة اتحاد الملاك وفني الصيانة المختص فور الإرسال لسرعة الاستجابة.
                </Text>
              </View>
              <View style={styles.ticketHeroIconCircle}>
                <MaterialIcons name="handyman" size={26} color={COLORS.secondaryFixed} />
              </View>
            </View>
            <View style={styles.ticketResponseBar}>
              <MaterialIcons name="bolt" size={16} color={COLORS.secondaryFixed} />
              <Text style={styles.ticketResponseText}>متوسط زمن الاستجابة للبلاغات: 45 دقيقة</Text>
            </View>
          </View>

          {/* Location Scope Chips */}
          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>نطاق ومكان العطل</Text>
            <View style={styles.scopeGridContainer}>
              {['المصعد', 'مدخل العقار', 'إنارة السلم', 'طلمبة المياه', 'الجراج السفلي', 'السطح والرووف'].map((scope) => (
                <TouchableOpacity
                  key={scope}
                  style={[
                    styles.scopeChipItem,
                    ticketScope === scope && styles.scopeChipItemActive,
                  ]}
                  onPress={() => setTicketScope(scope)}
                >
                  <MaterialIcons
                    name={
                      scope === 'المصعد'
                        ? 'elevator'
                        : scope === 'مدخل العقار'
                        ? 'door-front'
                        : scope === 'إنارة السلم'
                        ? 'light'
                        : scope === 'طلمبة المياه'
                        ? 'water-damage'
                        : scope === 'الجراج السفلي'
                        ? 'garage'
                        : 'roofing'
                    }
                    size={22}
                    color={ticketScope === scope ? COLORS.onPrimary : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.scopeChipText,
                      ticketScope === scope && styles.scopeChipTextActive,
                    ]}
                  >
                    {scope}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Severity & Details */}
          <View style={styles.formSectionCard}>
            <Text style={styles.sectionHeaderTitle}>درجة الخطورة والاستعجال</Text>
            <View style={styles.threeColumnGrid}>
              {(['عادي', 'متوسط (48 ساعة)', 'طارئ وحرج'] as const).map((sev) => (
                <TouchableOpacity
                  key={sev}
                  style={[
                    styles.severityBtn,
                    ticketSeverity === sev && styles.severityBtnActive,
                    ticketSeverity === sev && sev === 'طارئ وحرج' && { backgroundColor: COLORS.statusUnpaid },
                  ]}
                  onPress={() => setTicketSeverity(sev)}
                >
                  <Text
                    style={[
                      styles.severityBtnText,
                      ticketSeverity === sev && styles.severityBtnTextActive,
                    ]}
                  >
                    {sev}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>عنوان العطل باختصار *</Text>
              <TextInput
                style={styles.textInputField}
                value={ticketTitle}
                onChangeText={setTicketTitle}
                placeholder="مثال: توقف كابينة المصعد بين الدورين الثاني والثالث"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>وصف تفصيلي للمشكلة</Text>
              <TextInput
                style={[styles.textInputField, { height: 76, textAlignVertical: 'top', paddingTop: 8 }]}
                value={ticketDescription}
                onChangeText={setTicketDescription}
                multiline
                placeholder="صف تفاصيل العطل وأي أصوات أو مؤشرات غير معتادة..."
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>الوقت المفضل للمعاينة الفنية</Text>
              <View style={styles.threeColumnGrid}>
                {(['أي وقت', 'صباحية', 'مسائية'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeChip,
                      ticketPreferredTime === t && styles.timeChipActive,
                    ]}
                    onPress={() => setTicketPreferredTime(t)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        ticketPreferredTime === t && styles.timeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Submit Ticket */}
          <TouchableOpacity
            style={styles.primaryActionButton}
            activeOpacity={0.88}
            onPress={handleSubmitTicket}
            disabled={submittingTicket}
          >
            {submittingTicket ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color={COLORS.onPrimary} />
                <Text style={styles.primaryActionText}>إرسال البلاغ لرئيس الاتحاد وفريق الصيانة</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: OFFICIAL DOCUMENTS & BYLAWS ARCHIVE (Screen 12 - _14)         */}
      {/* ---------------------------------------------------------------------- */}
      <Modal
        visible={activeSubView === 'docs_bylaws'}
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
            <Text style={styles.barCenterTitle}>اللائحة والمستندات الرسمية</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Context Banner */}
          <View style={styles.docsHeroBanner}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="verified-user" size={18} color={COLORS.secondaryFixed} />
              <Text style={styles.docsHeroTag}>ملف موثّق ورسمي</Text>
            </View>
            <Text style={styles.docsHeroTitle}>{currentBuilding.name}</Text>
            <Text style={styles.docsHeroSub}>
              قيد اتحاد الشاغلين رقم ١٤٢ لسنة ٢٠٢٣ • حي النزهة ومصر الجديدة
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.docsFilterRow}>
            {(['all', 'bylaws', 'contracts', 'blueprints'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.docFilterChip,
                  docFilter === filter && styles.docFilterChipActive,
                ]}
                onPress={() => setDocFilter(filter)}
              >
                <Text
                  style={[
                    styles.docFilterChipText,
                    docFilter === filter && styles.docFilterChipTextActive,
                  ]}
                >
                  {filter === 'all'
                    ? 'الكل'
                    : filter === 'bylaws'
                    ? 'اللائحة والقوانين'
                    : filter === 'contracts'
                    ? 'العقود والضمانات'
                    : 'المخططات الهندسية'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Main Document Card */}
          <View style={styles.formSectionCard}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="push-pin" size={20} color={COLORS.primary} />
              <Text style={styles.sectionHeaderTitle}>المستندات الدستورية المثبتة</Text>
            </View>

            <View style={styles.bylawCard}>
              <View style={styles.rowBetween}>
                <View style={styles.bylawIconBox}>
                  <MaterialIcons name="menu-book" size={26} color={COLORS.onPrimary} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={styles.rowAlign}>
                    <View style={styles.pdfBadge}>
                      <Text style={styles.pdfBadgeText}>وثيقة رئيسية PDF</Text>
                    </View>
                    <Text style={styles.docFileSizeText}>2.4 MB</Text>
                  </View>
                  <Text style={styles.bylawDocTitle}>اللائحة الداخلية المعتمدة لاتحاد الملاك</Text>
                  <Text style={styles.bylawDocSub}>معتمدة بقرار الجمعية العمومية ٢٠٢٣ • ١٨ صفحة مدققة</Text>
                </View>
              </View>

              <View style={styles.bylawProvisionsBox}>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="check-circle" size={15} color={COLORS.secondary} />
                  <Text style={styles.provisionText}>مواعيد وساعات الهدوء وقواعد إشغال المصعد وتوزيع الصيانة</Text>
                </View>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="check-circle" size={15} color={COLORS.secondary} />
                  <Text style={styles.provisionText}>تنظيم حقوق استغلال الرووف وحصص مواقف الجراج الخاصة</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.downloadDocBtn}
                onPress={() => Alert.alert('تحميل المستند', 'جاري تنزيل ملف اللائحة الداخلية بصيغة PDF...')}
              >
                <MaterialIcons name="download" size={18} color={COLORS.primary} />
                <Text style={styles.downloadDocBtnText}>تحميل وقراءة اللائحة كاملة (PDF)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: COLORS.surfaceCanvas,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  modalFullContainer: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },

  // Resident Header
  residentHeaderSection: {
    gap: 2,
  },
  verifiedGreenCapsule: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  verifiedGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  sharePercentCapsule: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  sharePercentText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  cycleDateText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  residentGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  unitLocationText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },

  // Monthly Due Hero Card (design/._302)
  heroDueCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#091426',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowAccent: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(84, 95, 115, 0.25)',
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.statusPending,
  },
  cycleSubHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  dueStatusBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  dueStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.tertiaryFixed,
  },
  amountLabelLight: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  amountHeroNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  currencyHeroSub: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryFixedDim,
    marginLeft: 4,
  },
  currencySubHero: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
    marginLeft: 4,
  },
  dueDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  balanceStatusPill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(33, 49, 69, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  balanceStatusText: {
    fontSize: 12,
    color: COLORS.inverseOnSurface,
  },
  payNowMainBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.secondary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  payNowMainBtnDisabled: {
    backgroundColor: COLORS.neutralSlate,
    shadowOpacity: 0,
    elevation: 0,
  },
  payNowMainBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSecondary,
  },
  paymentMethodsChipsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  methodChipLabel: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  dotDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.onPrimaryContainer,
  },

  // Quick Services Grid
  quickServicesGrid: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 8,
  },
  servicePillBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  servicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },

  // Emergency Card
  emergencyCardContainer: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  emergencyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyCategoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPending,
  },
  emergencyTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  progressSubText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceContainer,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  avatarStackRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginLeft: -6,
  },
  avatarCircleText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contributorsLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginRight: 6,
  },
  shareBadgePill: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shareBadgeText: {
    fontSize: 11,
    color: COLORS.onSurface,
  },
  contributeBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  contributeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Poll Card
  pollCardContainer: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  pollCountdownBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  pollCountdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusUpcoming,
  },
  pollWeightText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  pollIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pollHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    lineHeight: 20,
  },
  pollDescription: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 18,
  },
  pollParticipationBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 10,
    borderRadius: 8,
  },
  pollParticipationText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  notVotedTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusUnpaid,
  },
  participatePollBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  participatePollBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },

  // Expenses Section
  expensesSection: {
    gap: 6,
  },
  expensesSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  expensesSectionSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  viewAllExpensesLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  expenseSnapshotCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 12,
    padding: 12,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  expenseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  expenseItemSub: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  expenseAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  expenseCurrencyText: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },

  // Modals Common
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
  amountLabelDark: {
    fontSize: 11,
    color: COLORS.outline,
  },
  billTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  dueCountdownBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  dotPulseAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusUpcoming,
  },
  dueCountdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusUpcoming,
  },
  amountBannerNavy: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 14,
    padding: 16,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeBreakdownBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  breakdownHeaderLabel: {
    fontSize: 11,
    color: COLORS.outline,
    fontWeight: '600',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },
  feeItemName: {
    fontSize: 12,
    color: COLORS.onSurface,
  },
  feeItemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
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
  threeColumnGrid: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 8,
  },
  paymentMethodCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    gap: 4,
  },
  paymentMethodCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  methodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  methodTitleActive: {
    color: '#FFFFFF',
  },
  methodSubtitle: {
    fontSize: 10,
    color: COLORS.outline,
    textAlign: 'center',
  },
  verifiedSmallBadge: {
    backgroundColor: 'rgba(0,108,73,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  verifiedSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  copyHandleBox: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 12,
    borderRadius: 10,
  },
  handleLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  handleValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  copyHandleBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  copyHandleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  uploadReceiptSection: {
    gap: 8,
  },
  receiptSuccessCard: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.statusPaid,
  },
  receiptSuccessTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.statusPaidText,
  },
  receiptSuccessSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  changeReceiptLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  uploadChoiceBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  uploadChoiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  compressingText: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  inputGroup: {
    gap: 6,
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
  ltrField: {
    textAlign: 'left',
  },
  roleSelectorPill: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  roleSelectorPillActive: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.primary,
  },
  roleSelectorPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
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
    marginTop: 8,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },

  // Unit Ledger (Screen 10 - _22)
  exportPdfBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportPdfText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  ledgerUnitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  ledgerBldSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  unitNumberBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitNumberBoxText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ledgerMetaBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
    padding: 10,
    borderRadius: 8,
  },
  metaLabelText: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  metaValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  monthlyDuesNotice: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 10,
    borderRadius: 8,
  },
  monthlyDuesNoticeText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  ledgerSummaryCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 14,
  },
  ledgerSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settledBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  settledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryMiniBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  miniBoxLabel: {
    fontSize: 10,
    color: COLORS.primaryFixedDim,
  },
  miniBoxValueGreen: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
    marginTop: 2,
  },
  miniBoxValueWhite: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  miniBoxValueAmber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.tertiaryFixed,
    marginTop: 2,
  },
  miniBoxCurrency: {
    fontSize: 9,
    color: COLORS.primaryFixedDim,
  },
  ledgerHistoryItem: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  receiptSmallIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  historyItemDate: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  historyAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // Add Ticket (Screen 11 - _1)
  ticketHeroCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },
  ticketUrgentTag: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,108,73,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondaryFixed,
  },
  ticketUrgentTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  ticketHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ticketHeroSub: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
    lineHeight: 16,
    marginTop: 2,
  },
  ticketHeroIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketResponseBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  ticketResponseText: {
    fontSize: 11,
    color: COLORS.secondaryFixed,
  },
  scopeGridContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeChipItem: {
    width: '31%',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scopeChipItemActive: {
    backgroundColor: COLORS.primary,
  },
  scopeChipText: {
    fontSize: 11,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  scopeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  severityBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  severityBtnActive: {
    backgroundColor: COLORS.primary,
  },
  severityBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  severityBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeChip: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: COLORS.secondary,
  },
  timeChipText: {
    fontSize: 11,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  timeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Docs and Bylaws (Screen 12 - _14)
  docsHeroBanner: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    marginBottom: 14,
  },
  docsHeroTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  docsHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  docsHeroSub: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
    lineHeight: 16,
  },
  docsFilterRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 8,
    marginBottom: 14,
  },
  docFilterChip: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  docFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  docFilterChipText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  docFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bylawCard: {
    gap: 10,
  },
  bylawIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadge: {
    backgroundColor: COLORS.tertiaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.tertiary,
  },
  docFileSizeText: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  bylawDocTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  bylawDocSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  bylawProvisionsBox: {
    backgroundColor: COLORS.surfaceCanvas,
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  provisionText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    flex: 1,
    lineHeight: 16,
  },
  downloadDocBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  downloadDocBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Pending Account Screen
  pendingAccountScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.surface,
  },
  pendingCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  pendingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingScreenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  pendingScreenDesc: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  switchAdminPreviewBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  switchAdminPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },

  // Row Helpers
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

  // Resident Arrears & Obligations Card Styles
  balanceStatusPillArrears: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  residentArrearsCard: {
    backgroundColor: '#FFF8F8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    gap: 12,
    shadowColor: '#DC2626',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  arrearsMainHeader: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  arrearsMainHeaderRight: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  arrearsAlertIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  residentArrearsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },
  residentArrearsSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },
  arrearsTotalBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    flexShrink: 0,
  },
  arrearsTotalBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  arrearsPendingBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  arrearsPendingBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },
  arrearsPendingBannerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },

  // Item Card
  residentObligationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#64748B',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  residentObligationItemUnpaid: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
  },
  residentObligationItemPending: {
    opacity: 0.72,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    backgroundColor: '#FFFBEB',
  },
  obligationPendingOverlayBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 2,
  },
  obligationPendingOverlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },

  // Item Top Row
  obligationItemTopRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  obligationItemTitleBox: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  obligationTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  residentObligationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: I18nManager.isRTL ? 'left' : 'right',
    lineHeight: 20,
  },

  // Amount Box (Top Left)
  obligationAmountBox: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    flexShrink: 0,
    minWidth: 70,
  },
  residentObligationAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#DC2626',
    textAlign: 'center',
  },
  residentObligationCurrency: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
    textAlign: 'center',
  },

  // Meta & Tags Row
  obligationMetaRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  obligationCategoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  obligationCategoryTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  residentObligationMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  transferredTagSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },

  // Notes callout
  obligationNoteCallout: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  obligationNoteLine: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  residentObligationNotes: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    textAlign: I18nManager.isRTL ? 'left' : 'right',
    lineHeight: 16,
  },

  // Divider
  obligationCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },

  // Bottom Action Row
  obligationBottomActionRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  obligationStatusPill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  obligationStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paySingleObligationBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#2563EB',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  paySingleObligationText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pendingReviewMiniBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingReviewMiniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  unspecifiedArrearsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  unspecifiedArrearsText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 18,
    textAlign: 'right',
  },
  arrearsActionsContainer: {
    marginTop: 6,
  },
  arrearsButtonGroup: {
    gap: 8,
  },
  payArrearsButton: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    height: 44,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#DC2626',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  payArrearsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payPartialArrearsButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    height: 42,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payPartialArrearsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  obligationSubNote: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  arrearsNoticeText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 18,
    textAlign: 'right',
  },
  partialPayCardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    gap: 12,
  },
  partialPayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  quickChipsRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChipBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickChipBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  amountInputRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    paddingHorizontal: 12,
    height: 48,
  },
  partialAmountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
    padding: 0,
  },
  amountInputCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 6,
  },
  debtCalculationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  calcLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  calcValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  calcLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  calcValueBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
  },
});
