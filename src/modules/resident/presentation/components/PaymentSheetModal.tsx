import React, { useState } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { CashRecipientType } from '@/shared/types/database';
import { pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { copyToClipboard } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import { useResidentLedger } from '../../application/useResidentLedger';
import type { ActiveSubView } from '../../domain/resident.types';
import type { ApartmentObligation, EmergencyClaim, PaymentCategoryType, PaymentMethodType } from '@/shared/types/database';
import { styles } from '../ResidentHomeScreen.styles';

interface PaymentSheetModalProps {
  activeSubView: ActiveSubView;
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
  isArrearsPaymentMode: boolean;
  paymentAmount: string;
  paymentCategory: PaymentCategoryType;
  paymentMethod: PaymentMethodType;
  selectedClaim: EmergencyClaim | null;
  selectedObligation: ApartmentObligation | null;
  setPaymentAmount: React.Dispatch<React.SetStateAction<string>>;
  setPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethodType>>;
}

export const PaymentSheetModal: React.FC<PaymentSheetModalProps> = ({
  activeSubView,
  setActiveSubView,
  isArrearsPaymentMode,
  paymentAmount,
  paymentCategory,
  paymentMethod,
  selectedClaim,
  selectedObligation,
  setPaymentAmount,
  setPaymentMethod,
}) => {
  const { currentBuilding, submitResidentPayment } = useAppStore();
  const { currentBillingMonth, currentMonthLabel, effectiveArrears } = useResidentLedger();

  const [cashRecipient, setCashRecipient] = useState<CashRecipientType>('admin');
  const [receiptAttached, setReceiptAttached] = useState<boolean>(false);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('');
  const [receiptSizeKb, setReceiptSizeKb] = useState<number>(0);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState<boolean>(false);

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

  return (
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
  );
};
