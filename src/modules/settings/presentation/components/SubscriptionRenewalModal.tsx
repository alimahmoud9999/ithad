import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { PlanTier } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { CompressedUploadResult, pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

interface SubscriptionRenewalModalProps {
  setSubscriptionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  subscriptionModalVisible: boolean;
  selectedPlan: PlanTier;
  setSelectedPlan: React.Dispatch<React.SetStateAction<PlanTier>>;
  effectiveMonthlyPlanPrice: number;
  handleCopy: (text: string, label: string) => void;
}

export const SubscriptionRenewalModal: React.FC<SubscriptionRenewalModalProps> = ({
  setSubscriptionModalVisible,
  subscriptionModalVisible,
  selectedPlan,
  setSelectedPlan,
  effectiveMonthlyPlanPrice,
  handleCopy,
}) => {
  const { currentBuilding, submitAppSubscriptionInvoice } = useAppStore();

  const [durationMonths, setDurationMonths] = useState('1');

  const [subSubmitting, setSubSubmitting] = useState(false);

  const [subUploadingImage, setSubUploadingImage] = useState(false);

  const [subCompressedUpload, setSubCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  const totalCalculatedRenewalPrice = useMemo(() => {
    const months = Math.max(parseInt(durationMonths, 10) || 1, 1);
    return effectiveMonthlyPlanPrice * months;
  }, [effectiveMonthlyPlanPrice, durationMonths]);

  // Pick receipt for subscription
  const handlePickSubscriptionReceipt = async (
    source: 'camera' | 'library'
  ) => {
    setSubUploadingImage(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'subscription-receipts',
        buildingId: currentBuilding.id,
        source,
      });
      if (result) {
        setSubCompressedUpload(result);
        Alert.alert(
          'تم اختيار وضغط صورة الإيصال ✅',
          `الحجم المخفض: ${result.estimatedSizeKb} KB (توفير مساحة بنسبة 96%).`
        );
      }
    } catch (err: any) {
      Alert.alert('خطأ أثناء رفع الإيصال', err?.message || 'تعذر رفع الصورة');
    } finally {
      setSubUploadingImage(false);
    }
  };

  // Submit subscription renewal
  const handleSubmitSubscriptionRenewal = async () => {
    const months = parseInt(durationMonths, 10);
    if (!months || months <= 0) {
      Alert.alert('تنبيه', 'يرجى تحديد عدد أشهر صالح.');
      return;
    }
    if (!subCompressedUpload) {
      Alert.alert(
        'إيصال التحويل مطلوب ⚠️',
        'يرجى إرفاق صورة إيصال تحويل إنستاباي أو المحفظة الإلكترونية لإتمام طلب التجديد.'
      );
      return;
    }

    setSubSubmitting(true);
    try {
      await submitAppSubscriptionInvoice({
        planCode: selectedPlan,
        durationMonths: months,
        receiptImageUrl: subCompressedUpload.publicUrl,
      });
      setSubCompressedUpload(null);
      setSubscriptionModalVisible(false);
      Alert.alert(
        'تم رفع إيصال الاشتراك بنجاح 📤',
        'تم إرسال الإيصال لمالك التطبيق (Super Admin). بمجرد الاعتماد، سيتم تمديد الاشتراك تلقائياً وخصم القيمة من رصيد الخزينة كمصروف رسمي شفاف.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر رفع طلب الاشتراك');
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={subscriptionModalVisible}
      title="تجديد اشتراك باقة التطبيق"
      subtitle={`الباقة: ${selectedPlan.toUpperCase()} • السعر: ${effectiveMonthlyPlanPrice} ج.م/شهرياً`}
      onClose={() => setSubscriptionModalVisible(false)}
    >
      <ScrollView style={styles.modalScroll}>
        <View style={styles.subInfoBox}>
          <Text style={styles.subInfoTitle}>
            آلية التفعيل الشفافة والخصم التلقائي:
          </Text>
          <Text style={styles.subInfoDesc}>
            عند تحويل قيمة الباقة ورفع الإيصال، يقوم مالك المنصة (Super Admin)
            باعتماد التحويل، فيتم تمديد اشتراك العمارة تلقائياً وإدراج مصروف رسمي
            باسم "رسوم اشتراك تطبيق إدارة العقار" في ميزانية العمارة دون أي
            تدخل يدوي.
          </Text>
        </View>

        {/* Payment Account Details */}
        <View style={styles.instapayCard}>
          <View style={styles.instapayHeader}>
            <MaterialIcons name="account-balance" size={20} color="#047857" />
            <Text style={styles.instapayTitle}>
              حسابات تحويل قيمة اشتراك التطبيق:
            </Text>
          </View>
          <View style={styles.instapayRow}>
            <Text style={styles.instapayVal}>ittihad.trust@instapay</Text>
            <TouchableOpacity
              onPress={() =>
                handleCopy('ittihad.trust@instapay', 'معرف إنستاباي')
              }
            >
              <Text style={styles.copyLink}>نسخ المعرف</Text>
            </TouchableOpacity>
            <Text style={styles.instapayLbl}>إنستاباي (InstaPay):</Text>
          </View>
          <View style={styles.instapayRow}>
            <Text style={styles.instapayVal}>01023456789</Text>
            <TouchableOpacity
              onPress={() => handleCopy('01023456789', 'رقم المحفظة')}
            >
              <Text style={styles.copyLink}>نسخ الرقم</Text>
            </TouchableOpacity>
            <Text style={styles.instapayLbl}>فودافون كاش:</Text>
          </View>
        </View>

        {/* Plan Selection */}
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
                باقة {tier.toUpperCase()}{' '}
                {tier === 'plus' ? '(350 ج.م)' : '(250 ج.م)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration & Total Price */}
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
                {totalCalculatedRenewalPrice} ج.م
              </Text>
            </View>
          </View>
        </View>

        {/* Compressed Receipt Upload Card */}
        <View style={styles.invoiceAttachCard}>
          <MaterialIcons
            name="verified"
            size={22}
            color={subCompressedUpload ? '#10B981' : COLORS.onSurfaceVariant}
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.invoiceAttachTitle}>
              {subCompressedUpload
                ? `تم ضغط وحفظ الإيصال (${subCompressedUpload.estimatedSizeKb} KB • ${subCompressedUpload.width}px)`
                : 'إرفاق إيصال التحويل (ضغط تلقائي 60% • 1080px)'}
            </Text>
            <Text style={styles.invoiceAttachSub}>
              {subCompressedUpload
                ? subCompressedUpload.storagePath
                : `يتم ضغط الصورة وحفظها تلقائياً لتوفير المساحة`}
            </Text>
          </View>
        </View>

        {/* Upload Buttons */}
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
                  اختيار من المعرض
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

        {/* Submit Button */}
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
      </ScrollView>
    </BottomSheetModal>
  );
};
