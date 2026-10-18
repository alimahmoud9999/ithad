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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  CashRecipientType,
  EmergencyClaim,
  PaymentCategoryType,
  PaymentMethodType,
} from '../../types/database';
import { pickAndCompressUploadImage } from '../../utils/imageUpload';

interface ResidentHomeScreenProps {
  onNavigateExpenses: () => void;
}

/**
 * Strictly follows:
 * - design/stitch_/design.md (Screen 3: Resident Home & Payment Status)
 * - design/stitch_/._302/code.html (Resident Home layout, Hero card, Emergency claim widget, Recent expenses, Contacts)
 * - design/stitch_/_2/code.html (Electronic Transfer / InstaPay vs Cash recipient modal)
 */
export const ResidentHomeScreen: React.FC<ResidentHomeScreenProps> = ({
  onNavigateExpenses,
}) => {
  const {
    currentUser,
    currentBuilding,
    payments,
    emergencyClaims,
    expenses,
    submitResidentPayment,
    switchRole,
  } = useAppStore();

  // Payment Modal State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentCategory, setPaymentCategory] =
    useState<PaymentCategoryType>('monthly_dues');
  const [selectedClaim, setSelectedClaim] = useState<EmergencyClaim | null>(
    null
  );
  const [paymentAmount, setPaymentAmount] = useState<string>(
    String(currentBuilding.default_monthly_dues || 400)
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>('electronic_transfer');
  const [cashRecipient, setCashRecipient] =
    useState<CashRecipientType>('admin');
  const [receiptAttached, setReceiptAttached] = useState<boolean>(false);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('');
  const [receiptSizeKb, setReceiptSizeKb] = useState<number>(0);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

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
    setPaymentCategory('monthly_dues');
    setSelectedClaim(null);
    setPaymentAmount(String(currentBuilding.default_monthly_dues || 400));
    setPaymentMethod(
      currentBuilding.features_config.receipt_upload
        ? 'electronic_transfer'
        : 'cash'
    );
    setPaymentModalVisible(true);
  };

  const openEmergencyContributionSheet = (claim: EmergencyClaim) => {
    setPaymentCategory('emergency_claim');
    setSelectedClaim(claim);
    setPaymentAmount(String(claim.default_share_amount || 250));
    setPaymentMethod(
      currentBuilding.features_config.receipt_upload
        ? 'electronic_transfer'
        : 'cash'
    );
    setPaymentModalVisible(true);
  };

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

  const handleConfirmPayment = async () => {
    if (paymentCategory === 'monthly_dues') {
      if (monthlyStatus === 'paid') {
        Alert.alert(
          'تم السداد مسبقاً ✅',
          `تم سداد اشتراك شهر (${currentMonthLabel}) بالكامل بالفعل.`
        );
        setPaymentModalVisible(false);
        return;
      }
      if (monthlyStatus === 'pending') {
        Alert.alert(
          'طلب معلق ⏳',
          `لديك إيصال سداد لاشتراك (${currentMonthLabel}) قيد المراجعة بالفعل بانتظار اعتماد رئيس الاتحاد.`
        );
        setPaymentModalVisible(false);
        return;
      }
    }

    const numericAmount = parseFloat(paymentAmount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (paymentMethod === 'electronic_transfer' && !receiptAttached) {
      Alert.alert(
        'صورة الإيصال مطلوبة',
        'يرجى اختيار أو تصوير إيصال التحويل الإلكتروني ليتم ضغطه ورفعه.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitResidentPayment({
        amount: numericAmount,
        paymentMethod,
        billingMonth: currentBillingMonth,
        cashRecipient: paymentMethod === 'cash' ? cashRecipient : undefined,
        receiptImageUrl:
          paymentMethod === 'electronic_transfer'
            ? receiptImageUrl
            : undefined,
        paymentCategory,
        emergencyClaimId: selectedClaim?.id,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      setPaymentModalVisible(false);
      Alert.alert(
        'تم إرسال طلب السداد 🟠',
        'حالة الدفعة الآن "قيد المراجعة" (Pending) وستُضاف لرصيد الصندوق فور اعتمادها من رئيس الاتحاد.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال طلب السداد');
    } finally {
      setSubmitting(false);
    }
  };

  // If Resident account is still pending admin approval
  if (currentUser.status === 'pending') {
    return (
      <View style={styles.pendingAccountScreen}>
        <View style={styles.pendingCard}>
          <View style={styles.pendingIconCircle}>
            <MaterialIcons
              name="hourglass-top"
              size={32}
              color={COLORS.statusPending}
            />
          </View>
          <Text style={styles.pendingScreenTitle}>طلبك قيد الموافقة</Text>
          <Text style={styles.pendingScreenDesc}>
            مرحباً {currentUser.full_name}، طلب انضمامك إلى ({currentBuilding.name}{' '}
            - شقة {currentUser.apartment_number}) بانتظار موافقة رئيس الاتحاد.
          </Text>
          <StatusBadge status="pending" customLabel="في انتظار تفعيل المدير" />
          <TouchableOpacity
            style={styles.previewSwitchBtn}
            onPress={() => switchRole('admin')}
          >
            <MaterialIcons
              name="admin-panel-settings"
              size={18}
              color={COLORS.onPrimary}
            />
            <Text style={styles.previewSwitchBtnText}>
              التبديل لواجهة رئيس الاتحاد للموافقة على الحساب
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const heroStatusBannerColor =
    monthlyStatus === 'paid'
      ? COLORS.secondary
      : monthlyStatus === 'pending'
      ? '#9A3412'
      : COLORS.primaryContainer;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Resident Welcome & Verification Banner (._302/code.html) */}
      <View style={styles.welcomeSection}>
        <View style={styles.badgesTopRow}>
          <View style={styles.badgesRightGroup}>
            <View style={styles.verifiedResidentPill}>
              <MaterialIcons
                name="verified"
                size={14}
                color={COLORS.onSecondaryContainer}
              />
              <Text style={styles.verifiedResidentText}>حساب مفعل وموثق</Text>
            </View>
            <View style={styles.sharePill}>
              <Text style={styles.sharePillText}>
                مالك مقيم ({currentUser.ownership_share_percent}%)
              </Text>
            </View>
          </View>
          <Text style={styles.cycleDateLabel}>{currentMonthLabel}</Text>
        </View>

        <Text style={styles.welcomeHeading}>
          مرحباً، {currentUser.full_name} 👋
        </Text>
        <View style={styles.locationSubRow}>
          <MaterialIcons
            name="location-on"
            size={16}
            color={COLORS.secondary}
          />
          <Text style={styles.locationSubText}>
            شقة {currentUser.apartment_number} •{' '}
            {currentUser.floor_number || 'الدور الثالث (واجهة)'} •{' '}
            {currentBuilding.name}
          </Text>
        </View>
      </View>

      {/* 2. Monthly Due / Subscription Status Hero Card (Screen 3 in design.md & ._302/code.html) */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: heroStatusBannerColor },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroStatusIndicator}>
            <View
              style={[
                styles.pulsingDot,
                {
                  backgroundColor:
                    monthlyStatus === 'paid'
                      ? COLORS.secondaryFixed
                      : monthlyStatus === 'pending'
                      ? COLORS.statusPending
                      : COLORS.statusUnpaid,
                },
              ]}
            />
            <Text style={styles.heroCycleTitle}>
              {monthlyStatus === 'paid'
                ? `اشتراك شهر ${currentMonthLabel}: تم الدفع 🟢`
                : monthlyStatus === 'pending'
                ? `اشتراك شهر ${currentMonthLabel}: قيد المراجعة 🟠`
                : `اشتراك شهر ${currentMonthLabel}: متأخر / مستحق 🔴`}
            </Text>
          </View>

          <View style={styles.heroStatePill}>
            <Text style={styles.heroStatePillText}>
              {monthlyStatus === 'paid'
                ? 'مسدد بالكامل'
                : monthlyStatus === 'pending'
                ? 'بانتظار الاعتماد'
                : 'مستحق السداد'}
            </Text>
          </View>
        </View>

        {/* Main Amount and Due Date */}
        <View style={styles.heroAmountRow}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroAmountCaption}>
              المبلغ المطلوب لدورة {currentMonthLabel}
            </Text>
            <View style={styles.heroAmountValueRow}>
              <Text style={styles.heroAmountNumber}>
                {currentBuilding.default_monthly_dues}
              </Text>
              <Text style={styles.heroAmountCurrency}>ج.م</Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-start' }}>
            <Text style={styles.heroAmountCaption}>تاريخ الاستحقاق</Text>
            <Text style={styles.heroDueDateVal}>1 {currentMonthLabel}</Text>
          </View>
        </View>

        {/* Wallet Subtext Pill */}
        <View style={styles.walletSubPill}>
          <MaterialIcons
            name="account-balance-wallet"
            size={18}
            color={COLORS.secondaryFixed}
          />
          <Text style={styles.walletSubPillText}>
            رصيد خزينة العمارة المعلن:{' '}
            <Text style={{ fontWeight: '700', color: COLORS.onPrimary }}>
              {currentBuilding.fund_balance.toLocaleString()} ج.م
            </Text>
          </Text>
        </View>

        {/* Rejection Reason Banner (if payment was rejected by Admin) */}
        {monthlyStatus === 'rejected' && currentMonthPayment?.rejection_reason ? (
          <View
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.22)',
              borderWidth: 1,
              borderColor: COLORS.statusUnpaid,
              borderRadius: 12,
              padding: 10,
              marginBottom: 4,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="report-problem" size={18} color="#FECACA" />
            <Text
              style={{
                flex: 1,
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '700',
                textAlign: 'right',
              }}
            >
              سبب رفض الدفعة السابقة: {currentMonthPayment.rejection_reason}
            </Text>
          </View>
        ) : null}

        {/* Payment CTA Button or Verified Paid Confirmation Block */}
        {monthlyStatus === 'paid' ? (
          <View style={styles.paidConfirmedBlock}>
            <MaterialIcons
              name="check-circle"
              size={22}
              color={COLORS.onPrimary}
            />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.paidConfirmedTitle}>
                تم سداد اشتراك شهر ({currentMonthLabel}) بالكامل ✅
              </Text>
              <Text style={styles.paidConfirmedSub}>
                دفعتك معتمدة ومودعة في خزينة العمارة (رقم الإيصال:{' '}
                {currentMonthPayment?.reference_number || 'معتمد'})
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.heroCtaBlock}>
            <TouchableOpacity
              style={[
                styles.payNowButton,
                monthlyStatus === 'pending' && styles.payNowButtonDisabled,
              ]}
              onPress={openMonthlyPaymentSheet}
              disabled={monthlyStatus === 'pending'}
            >
              <MaterialIcons
                name={monthlyStatus === 'pending' ? 'schedule' : 'bolt'}
                size={20}
                color={COLORS.onSecondary}
              />
              <Text style={styles.payNowButtonText}>
                {monthlyStatus === 'pending'
                  ? 'طلب السداد قيد مراجعة رئيس الاتحاد...'
                  : monthlyStatus === 'rejected'
                  ? 'إعادة إرسال إيصال السداد ⚡'
                  : 'سداد الاشتراك الآن ⚡'}
              </Text>
            </TouchableOpacity>

            <View style={styles.methodsFooterRow}>
              <Text style={styles.methodHintItem}>✓ إنستاباي</Text>
              <Text style={styles.methodHintDot}>•</Text>
              <Text style={styles.methodHintItem}>✓ فودافون كاش</Text>
              <Text style={styles.methodHintDot}>•</Text>
              <Text style={styles.methodHintItem}>✓ نقداً للخزينة</Text>
            </View>
          </View>
        )}
      </View>

      {/* 3. Active Emergency Fund Widget (صندوق صيانة طارئة نشط - ._302/code.html) */}
      {emergencyClaims
        .filter((c) => c.building_id === currentBuilding.id)
        .map((claim) => {
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
                (p) => p.apartment_number || p.resident_id || p.id
              )
            ).size
          );
          const percent = Math.min(
            Math.round(
              (actualCollected / Math.max(claim.target_amount, 1)) * 100
            ),
            100
          );
          const shareAmount =
            claim.default_share_amount ||
            Math.round(claim.target_amount / currentBuilding.total_apartments);

          const myApt = currentUser.apartment_number || '302';
          const myPayment = payments.find(
            (p) =>
              p.emergency_claim_id === claim.id &&
              ((p.resident_id && currentUser.id && p.resident_id === currentUser.id) ||
                (p.resident_id && p.resident_id === 'usr-res-001') ||
                (Boolean(p.apartment_number) &&
                  String(p.apartment_number).trim() === String(myApt).trim()) ||
                (Boolean(p.apartment_id) &&
                  Boolean(currentUser.apartment_id) &&
                  p.apartment_id === currentUser.apartment_id))
          );

          return (
            <View key={claim.id} style={styles.emergencyCard}>
              <View style={styles.emergencyHeaderRow}>
                <View style={styles.emergencyTitleGroup}>
                  <View style={styles.emergencyIconBox}>
                    <MaterialIcons
                      name="handyman"
                      size={20}
                      color={COLORS.onErrorContainer}
                    />
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.emergencyOverline}>
                      مطالبة طارئة نشطة • {claim.category}
                    </Text>
                    <Text style={styles.emergencyTitle}>{claim.title}</Text>
                  </View>
                </View>
              </View>

              {/* Live Progress Bar */}
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
                    {percent}% مكتمل
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[styles.progressBarFill, { width: `${percent}%` }]}
                  />
                </View>
              </View>

              {/* Contributors & Resident Share */}
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
                        ساهم {actualContributorsCount} من الملاك حتى الآن
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
                    المطلوب:{' '}
                    <Text style={styles.residentShareBold}>
                      {shareAmount} ج.م
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Resident Personal Action / Status */}
              {myPayment?.status === 'paid' ? (
                <View style={styles.myContributionPaidBox}>
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={COLORS.statusPaid}
                  />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.myContributionPaidTitle}>
                      تم سداد مساهمتك بالكامل (
                      {myPayment.amount.toLocaleString()} ج.م) ✅
                    </Text>
                    <Text style={styles.myContributionPaidSub}>
                      تم اعتماد الدفعة وإيداعها رسمياً في خزينة العقار
                    </Text>
                  </View>
                </View>
              ) : myPayment?.status === 'pending' ? (
                <View style={styles.myContributionPendingBox}>
                  <MaterialIcons
                    name="hourglass-top"
                    size={22}
                    color={COLORS.statusPending}
                  />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.myContributionPendingTitle}>
                      إيصال مساهمتك قيد المراجعة والاعتماد (
                      {myPayment.amount.toLocaleString()} ج.م) ⏳
                    </Text>
                    <Text style={styles.myContributionPendingSub}>
                      بانتظار مراجعة رئيس الاتحاد وسيتم التحديث فوراً
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {myPayment?.status === 'rejected' && (
                    <View style={styles.myContributionRejectedBox}>
                      <MaterialIcons
                        name="error-outline"
                        size={22}
                        color={COLORS.statusUnpaid}
                      />
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.myContributionRejectedTitle}>
                          تعذر اعتماد إيصال السداد السابق ({myPayment.amount.toLocaleString()} ج.م) ⚠️
                        </Text>
                        <Text style={styles.myContributionRejectedSub}>
                          سبب الرفض: {myPayment.rejection_reason || 'بيانات الإيصال غير واضحة'}
                        </Text>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.contributeClaimBtn}
                    onPress={() => openEmergencyContributionSheet(claim)}
                  >
                    <MaterialIcons
                      name="payments"
                      size={18}
                      color={COLORS.onSurface}
                    />
                    <Text style={styles.contributeClaimBtnText}>
                      {myPayment?.status === 'rejected'
                        ? `إعادة إرسال مساهمة الطوارئ (${shareAmount} ج.م) ⚡`
                        : `المساهمة في الصندوق الطارئ (${shareAmount} ج.م)`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

      {/* 4. Transparency & Recent Building Expenses Snapshot (._302/code.html) */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sectionHeading}>أحدث مصروفات العقار</Text>
            <Text style={styles.sectionSubheading}>
              الشفافية المالية وصور الفواتير المعتمدة
            </Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllLink}
            onPress={onNavigateExpenses}
          >
            <Text style={styles.seeAllLinkText}>عرض الكل</Text>
            <MaterialIcons
              name="chevron-left"
              size={18}
              color={COLORS.secondary}
            />
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8 }}>
          {expenses
            .filter((e) => e.building_id === currentBuilding.id)
            .slice(0, 3)
            .map((exp) => (
              <TouchableOpacity
                key={exp.id}
                style={styles.expenseSnapCard}
                onPress={onNavigateExpenses}
                activeOpacity={0.85}
              >
                <View style={styles.expenseSnapRight}>
                  <View style={styles.expenseSnapIconBox}>
                    <MaterialIcons
                      name={
                        exp.is_system_generated
                          ? 'verified-user'
                          : 'receipt-long'
                      }
                      size={20}
                      color={
                        exp.is_system_generated
                          ? COLORS.secondary
                          : COLORS.onSurface
                      }
                    />
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.expenseSnapTitle} numberOfLines={1}>
                      {exp.title}
                    </Text>
                    <View style={styles.expenseSnapMeta}>
                      <MaterialIcons
                        name="receipt"
                        size={13}
                        color={COLORS.secondary}
                      />
                      <Text style={styles.expenseSnapMetaText}>
                        {exp.invoice_number || 'فاتورة موثقة'} • {exp.expense_date}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.expenseSnapLeft}>
                  <Text style={styles.expenseSnapAmount}>
                    - {exp.amount.toLocaleString()}
                  </Text>
                  <Text style={styles.expenseSnapCurrency}>ج.م</Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      </View>

      {/* 5. Quick Contacts & Emergency Support (._302/code.html) */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>أرقام الطوارئ وخدمات البرج</Text>
        <View style={styles.contactsGrid}>
          <View style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View style={styles.contactInitialCircle}>
                <Text style={styles.contactInitialText}>ر</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.contactName}>عم رجب</Text>
                <Text style={styles.contactRole}>حارس العقار</Text>
              </View>
            </View>
          </View>

          <View style={styles.contactCard}>
            <View style={styles.contactHeader}>
              <View style={styles.contactInitialCircle}>
                <Text style={styles.contactInitialText}>أ</Text>
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.contactName}>أ. أحمد ممدوح</Text>
                <Text style={styles.contactRole}>رئيس الاتحاد</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ==================================================================== */}
      {/* Payment Slide-up Bottom Sheet Modal (Matches design/stitch_/_2/code.html) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={paymentModalVisible}
        title={
          paymentCategory === 'emergency_claim'
            ? 'المساهمة في مطالبة طارئة'
            : 'سداد الاشتراك الشهري'
        }
        subtitle={
          paymentCategory === 'emergency_claim'
            ? selectedClaim?.title
            : `اشتراك صيانة ونظافة شهر نوفمبر 2024 • شقة ${currentUser.apartment_number}`
        }
        onClose={() => setPaymentModalVisible(false)}
      >
        {/* Amount Highlight Box (_2/code.html) */}
        <View style={styles.sheetAmountHero}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.sheetAmountLabel}>المبلغ الإجمالي المستحق</Text>
            <View style={styles.sheetAmountValueRow}>
              <Text style={styles.sheetAmountNumber}>{paymentAmount}</Text>
              <Text style={styles.sheetAmountCurrency}>ج.م</Text>
            </View>
          </View>
          <View style={styles.sheetAmountIconCircle}>
            <MaterialIcons
              name="receipt-long"
              size={24}
              color={COLORS.secondaryFixed}
            />
          </View>
        </View>

        {/* Payment Method Switcher: Electronic Transfer vs Cash */}
        <Text style={styles.sheetSectionLabel}>اختر وسيلة السداد</Text>
        <View style={styles.methodTabsRow}>
          <TouchableOpacity
            style={[
              styles.methodTabCard,
              paymentMethod === 'electronic_transfer' &&
                styles.methodTabCardActive,
            ]}
            onPress={() => {
              if (!currentBuilding.features_config.receipt_upload) {
                Alert.alert(
                  'الميزة غير مفعلة',
                  'ميزة رفع إيصالات التحويل غير مفعلة في باقة العمارة الحالية.'
                );
                return;
              }
              setPaymentMethod('electronic_transfer');
            }}
          >
            <MaterialIcons
              name="account-balance"
              size={22}
              color={
                paymentMethod === 'electronic_transfer'
                  ? COLORS.secondaryFixed
                  : COLORS.primary
              }
            />
            <Text
              style={[
                styles.methodTabTitle,
                paymentMethod === 'electronic_transfer' &&
                  styles.methodTabTitleActive,
              ]}
            >
              تحويل إلكتروني / إنستاباي
            </Text>
            <Text
              style={[
                styles.methodTabSub,
                paymentMethod === 'electronic_transfer' &&
                  styles.methodTabSubActive,
              ]}
            >
              إرفاق لقطة شاشة الإيصال
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodTabCard,
              paymentMethod === 'cash' && styles.methodTabCardActive,
            ]}
            onPress={() => setPaymentMethod('cash')}
          >
            <MaterialIcons
              name="payments"
              size={22}
              color={
                paymentMethod === 'cash'
                  ? COLORS.secondaryFixed
                  : COLORS.primary
              }
            />
            <Text
              style={[
                styles.methodTabTitle,
                paymentMethod === 'cash' && styles.methodTabTitleActive,
              ]}
            >
              دفع نقدي (كاش)
            </Text>
            <Text
              style={[
                styles.methodTabSub,
                paymentMethod === 'cash' && styles.methodTabSubActive,
              ]}
            >
              لرئيس الاتحاد أو الحارس
            </Text>
          </TouchableOpacity>
        </View>

        {paymentMethod === 'electronic_transfer' ? (
          <View style={styles.electronicSection}>
            {/* Official Building Accounts (_2/code.html) */}
            <View style={styles.accountBox}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.accountBoxLabel}>
                  معرّف إنستاباي (InstaPay IPA)
                </Text>
                <Text style={styles.accountBoxValue}>
                  elamal.tower@instapay
                </Text>
              </View>
              <View style={styles.copyBadge}>
                <MaterialIcons
                  name="content-copy"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.copyBadgeText}>نسخ</Text>
              </View>
            </View>

            <View style={styles.accountBox}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.accountBoxLabel}>
                  محفظة فودافون كاش الخزينة
                </Text>
                <Text style={styles.accountBoxValue}>01012345678</Text>
              </View>
              <View style={styles.copyBadge}>
                <MaterialIcons
                  name="content-copy"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.copyBadgeText}>نسخ</Text>
              </View>
            </View>

            {/* Receipt Image Upload Box (Compressed via compressAndUploadImage: Max 1080px, 60% JPEG) */}
            <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
              <TouchableOpacity
                style={[styles.uploadBox, { flex: 1 }]}
                onPress={() => handlePickAndCompressReceipt('library')}
                disabled={uploadingReceipt}
              >
                <View style={styles.uploadIconCircle}>
                  {uploadingReceipt ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <MaterialIcons
                      name="photo-library"
                      size={22}
                      color={COLORS.primary}
                    />
                  )}
                </View>
                <Text style={styles.uploadTitle}>
                  {uploadingReceipt
                    ? 'جاري ضغط ورفع الصورة...'
                    : 'اختيار إيصال من المعرض'}
                </Text>
                <Text style={styles.uploadSubtitle}>
                  ضغط تلقائي 1080px • JPEG (80-150 KB)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadBox, { flex: 1 }]}
                onPress={() => handlePickAndCompressReceipt('camera')}
                disabled={uploadingReceipt}
              >
                <View style={styles.uploadIconCircle}>
                  <MaterialIcons
                    name="add-a-photo"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.uploadTitle}>تصوير الإيصال بالكاميرا</Text>
                <Text style={styles.uploadSubtitle}>
                  حفظ منظم: {currentBuilding.id}/2024-11
                </Text>
              </TouchableOpacity>
            </View>

            {receiptAttached && (
              <View style={styles.attachedFileRow}>
                <View style={styles.attachedFileRight}>
                  <MaterialIcons
                    name="task"
                    size={22}
                    color={COLORS.secondary}
                  />
                  <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={styles.attachedFileName} numberOfLines={1}>
                      {receiptFileName}
                    </Text>
                    <Text style={styles.attachedFileReady}>
                      تم الضغط (JPEG 60% • {receiptSizeKb} KB) • جاهز للإرسال
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setReceiptAttached(false);
                    setReceiptImageUrl('');
                    setReceiptFileName('');
                  }}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={20}
                    color={COLORS.error}
                  />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ marginTop: 8 }}>
              <Text style={styles.inputLabel}>
                رقم العملية المرجعي / ملاحظة (اختياري)
              </Text>
              <TextInput
                style={styles.sheetInput}
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="مثال: تم التحويل من حساب م. أحمد مصطفى"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>
        ) : (
          /* Cash Recipient Selection (Option 2 in design.md: "رئيس الاتحاد" or "حارس العمارة") */
          <View style={styles.cashSection}>
            <Text style={styles.sheetSectionLabel}>
              حدد مستلم المبلغ النقدي (كاش):
            </Text>
            <View style={styles.recipientRow}>
              <TouchableOpacity
                style={[
                  styles.recipientOption,
                  cashRecipient === 'admin' && styles.recipientOptionActive,
                ]}
                onPress={() => setCashRecipient('admin')}
              >
                <MaterialIcons
                  name="admin-panel-settings"
                  size={22}
                  color={
                    cashRecipient === 'admin'
                      ? COLORS.onPrimary
                      : COLORS.primaryContainer
                  }
                />
                <Text
                  style={[
                    styles.recipientOptionTitle,
                    cashRecipient === 'admin' &&
                      styles.recipientOptionTitleActive,
                  ]}
                >
                  رئيس الاتحاد
                </Text>
                <Text
                  style={[
                    styles.recipientOptionSub,
                    cashRecipient === 'admin' &&
                      styles.recipientOptionSubActive,
                  ]}
                >
                  أ. أحمد ممدوح (شقة 12)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.recipientOption,
                  cashRecipient === 'guard' && styles.recipientOptionActive,
                ]}
                onPress={() => setCashRecipient('guard')}
              >
                <MaterialIcons
                  name="badge"
                  size={22}
                  color={
                    cashRecipient === 'guard'
                      ? COLORS.onPrimary
                      : COLORS.primaryContainer
                  }
                />
                <Text
                  style={[
                    styles.recipientOptionTitle,
                    cashRecipient === 'guard' &&
                      styles.recipientOptionTitleActive,
                  ]}
                >
                  حارس العمارة
                </Text>
                <Text
                  style={[
                    styles.recipientOptionSub,
                    cashRecipient === 'guard' &&
                      styles.recipientOptionSubActive,
                  ]}
                >
                  عم رجب (غرفة الحراسة)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.confirmPaymentBtn}
          onPress={handleConfirmPayment}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={styles.confirmPaymentBtnText}>
                تأكيد وإرسال طلب السداد ({paymentAmount} ج.م)
              </Text>
              <MaterialIcons
                name="arrow-back"
                size={18}
                color={COLORS.onPrimary}
              />
            </>
          )}
        </TouchableOpacity>
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
  pendingAccountScreen: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
    padding: 20,
    justifyContent: 'center',
  },
  pendingCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 12,
  },
  pendingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.statusPendingBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingScreenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  pendingScreenDesc: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
  },
  previewSwitchBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  previewSwitchBtnText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  welcomeSection: {
    gap: 4,
  },
  badgesTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgesRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  verifiedResidentPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  verifiedResidentText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  sharePill: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  sharePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  cycleDateLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  welcomeHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
    marginTop: 4,
  },
  locationSubRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  locationSubText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatusIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  heroCycleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  heroStatePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroStatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.tertiaryFixed,
  },
  heroAmountRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroAmountCaption: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  heroAmountValueRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  heroAmountNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  heroAmountCurrency: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryFixedDim,
  },
  heroDueDateVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onPrimary,
    marginTop: 4,
  },
  walletSubPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(33, 49, 69, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  walletSubPillText: {
    fontSize: 12,
    color: COLORS.inverseOnSurface,
  },
  heroCtaBlock: {
    gap: 8,
  },
  payNowButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payNowButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  payNowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSecondary,
  },
  methodsFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  methodHintItem: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  methodHintDot: {
    fontSize: 11,
    color: COLORS.onPrimaryContainer,
  },
  emergencyCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 12,
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
  miniAvatarTextDark: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSurface,
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
  contributeClaimBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerHigh,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contributeClaimBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  sectionSubheading: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  seeAllLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  seeAllLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  expenseSnapCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  expenseSnapRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  expenseSnapIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseSnapTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  expenseSnapMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expenseSnapMetaText: {
    fontSize: 11,
    color: COLORS.secondary,
  },
  expenseSnapLeft: {
    alignItems: 'flex-start',
  },
  expenseSnapAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.statusUnpaid,
  },
  expenseSnapCurrency: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  contactsGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  contactCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  contactHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  contactInitialCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitialText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  contactRole: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  sheetAmountHero: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetAmountLabel: {
    fontSize: 12,
    color: COLORS.onPrimaryContainer,
  },
  sheetAmountValueRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  sheetAmountNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  sheetAmountCurrency: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  sheetAmountIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    marginBottom: 8,
  },
  methodTabsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 14,
  },
  methodTabCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  methodTabCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  methodTabTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  methodTabTitleActive: {
    color: COLORS.onPrimary,
  },
  methodTabSub: {
    fontSize: 10,
    color: COLORS.outline,
    textAlign: 'center',
  },
  methodTabSubActive: {
    color: COLORS.primaryFixed,
  },
  electronicSection: {
    gap: 10,
    marginBottom: 14,
  },
  accountBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountBoxLabel: {
    fontSize: 10,
    color: COLORS.outline,
  },
  accountBoxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  copyBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  uploadBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primaryContainer,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  uploadSubtitle: {
    fontSize: 11,
    color: COLORS.outline,
    marginTop: 2,
  },
  attachedFileRow: {
    backgroundColor: COLORS.statusPaidBg,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachedFileRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  attachedFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  attachedFileReady: {
    fontSize: 10,
    color: COLORS.statusPaidText,
  },
  inputLabel: {
    fontSize: 11,
    color: COLORS.outline,
    textAlign: 'right',
    marginBottom: 4,
  },
  sheetInput: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  cashSection: {
    marginBottom: 16,
  },
  recipientRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  recipientOption: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
  },
  recipientOptionActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  recipientOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  recipientOptionTitleActive: {
    color: COLORS.onPrimary,
  },
  recipientOptionSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  recipientOptionSubActive: {
    color: COLORS.primaryFixed,
  },
  confirmPaymentBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmPaymentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  myContributionPaidBox: {
    backgroundColor: COLORS.statusPaidBg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  myContributionPaidTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.statusPaidText,
    textAlign: 'right',
  },
  myContributionPaidSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  myContributionPendingBox: {
    backgroundColor: COLORS.statusPendingBg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  myContributionPendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.statusPendingText,
    textAlign: 'right',
  },
  myContributionPendingSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  paidConfirmedBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  paidConfirmedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  paidConfirmedSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'right',
    marginTop: 2,
  },
  myContributionRejectedBox: {
    backgroundColor: COLORS.statusUnpaidBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  myContributionRejectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.statusUnpaidText,
    textAlign: 'right',
  },
  myContributionRejectedSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
});
