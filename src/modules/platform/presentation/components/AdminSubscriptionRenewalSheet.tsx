import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { PlanTier } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { CompressedUploadResult, pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../subscriptionSheet.styles';

interface AdminSubscriptionRenewalSheetProps {
  setSubscriptionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  subscriptionModalVisible: boolean;
}

export const AdminSubscriptionRenewalSheet: React.FC<AdminSubscriptionRenewalSheetProps> = ({
  setSubscriptionModalVisible,
  subscriptionModalVisible,
}) => {
  const { currentBuilding, plans, submitAppSubscriptionInvoice } = useAppStore();

  // Subscription Renewal Form + Compressed Receipt Upload
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentBuilding.plan_code
  );
  const [durationMonths, setDurationMonths] = useState('1');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subUploadingImage, setSubUploadingImage] = useState(false);
  const [subCompressedUpload, setSubCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  const effectiveMonthlyPlanPrice = useMemo(() => {
    if (currentBuilding.custom_monthly_price !== null) {
      return currentBuilding.custom_monthly_price;
    }
    const found = plans.find((p) => p.code === selectedPlan);
    return found?.default_monthly_price ?? 150;
  }, [currentBuilding.custom_monthly_price, plans, selectedPlan]);

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
  );
};
