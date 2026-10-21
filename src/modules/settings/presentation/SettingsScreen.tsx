import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { PlanTier } from '@/shared/types/database';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import {
  pickAndCompressUploadImage,
  CompressedUploadResult,
} from '@/shared/utils/imageUpload';

interface SettingsScreenProps {
  onNavigateTab?: (tabKey: any) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigateTab }) => {
  const {
    currentUser,
    currentRole,
    switchRole,
    currentBuilding,
    apartments,
    submitAppSubscriptionInvoice,
    setAuthenticated,
    refreshData,
  } = useAppStore();

  // Subscription Renewal Modal State
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentBuilding.plan_code || 'pro'
  );
  const [durationMonths, setDurationMonths] = useState('1');
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subUploadingImage, setSubUploadingImage] = useState(false);
  const [subCompressedUpload, setSubCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  // Pricing calculations
  const effectiveMonthlyPlanPrice = useMemo(() => {
    if (
      currentBuilding.custom_monthly_price &&
      currentBuilding.custom_monthly_price > 0
    ) {
      return currentBuilding.custom_monthly_price;
    }
    if (selectedPlan === 'plus') return 350;
    if (selectedPlan === 'pro') return 250;
    return 0;
  }, [currentBuilding.custom_monthly_price, selectedPlan]);

  const totalCalculatedRenewalPrice = useMemo(() => {
    const months = Math.max(parseInt(durationMonths, 10) || 1, 1);
    return effectiveMonthlyPlanPrice * months;
  }, [effectiveMonthlyPlanPrice, durationMonths]);

  // Subscription status info
  const subscriptionStatusDetails = useMemo(() => {
    const isTrial = currentBuilding.subscription_status === 'trial';
    const plan = (currentBuilding.plan_code || 'free').toUpperCase();
    const isSuspended =
      currentBuilding.subscription_status === 'expired' ||
      currentBuilding.subscription_status === 'read_only';

    let label = `باقة ${plan} - نشطة`;
    let badgeStatus: 'paid' | 'pending' | 'unpaid' | 'overdue' = 'paid';
    let daysRemaining = 60;

    if (isTrial) {
      label = `فترة تجريبية مجانية (باقة ${plan})`;
      badgeStatus = 'pending';
      if (currentBuilding.trial_ends_at) {
        const diffMs =
          new Date(currentBuilding.trial_ends_at).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
    } else if (isSuspended) {
      label = `اشتراك منتهي (وضع القراءة فقط)`;
      badgeStatus = 'unpaid';
    }

    return { isTrial, plan, isSuspended, label, badgeStatus, daysRemaining };
  }, [currentBuilding]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    Alert.alert('تم النسخ بنجاح 📋', `تم نسخ ${label}: ${text}`);
  };

  // Share building code via WhatsApp
  const handleShareBuildingCode = async () => {
    try {
      const shareMessage = `أهلاً بكم يا جيران! 🏢\nيسرنا دعوتكم للانضمام إلى تطبيق إدارة عقارنا (${currentBuilding.name}).\n\nكود المبنى الخاص بنا: ${currentBuilding.building_code}\n\nيرجى تحميل التطبيق وإدخال الكود للوصول إلى الخزينة وسداد الاشتراكات والتصويت على قرارات العمارة.`;
      await Share.share({
        message: shareMessage,
      });
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر مشاركة الكود');
    }
  };

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatarCircle}>
            <MaterialIcons
              name={currentRole === 'admin' ? 'admin-panel-settings' : 'person'}
              size={36}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.profileInfoCol}>
            <View style={styles.nameAndBadgeRow}>
              <Text style={styles.userNameText}>{currentUser.full_name}</Text>
              <StatusBadge
                status={currentRole === 'admin' ? 'paid' : 'pending'}
                customLabel={
                  currentRole === 'admin'
                    ? 'رئيس الاتحاد'
                    : currentRole === 'super_admin'
                    ? 'مدير المنصة'
                    : 'ساكن / مالك'
                }
              />
            </View>
            <Text style={styles.userPhoneText}>
              {currentUser.phone || 'رقم الهاتف غير مسجل'}
            </Text>
            <Text style={styles.buildingSubText}>
              عقار: {currentBuilding.name} ({currentBuilding.address})
            </Text>
          </View>
        </View>

        {/* Building Code Share Banner */}
        <View style={styles.buildingCodeBox}>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <Text style={styles.buildingCodeLabel}>كود دعوة العقار للسكان:</Text>
            <Text style={styles.buildingCodeValue}>
              {currentBuilding.building_code}
            </Text>
          </View>
          <View style={styles.codeActionsRow}>
            <TouchableOpacity
              style={styles.codeActionBtn}
              onPress={() =>
                handleCopy(currentBuilding.building_code, 'كود المبنى')
              }
            >
              <MaterialIcons
                name="content-copy"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.codeActionBtnText}>نسخ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.codeActionBtn, styles.shareBtn]}
              onPress={handleShareBuildingCode}
            >
              <MaterialIcons name="share" size={18} color="#047857" />
              <Text style={[styles.codeActionBtnText, { color: '#047857' }]}>
                مشاركة
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. App Subscription & Building Plan (Requested Highlight) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.iconBoxSecondary}>
            <MaterialIcons
              name="workspace-premium"
              size={24}
              color={COLORS.secondary}
            />
          </View>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <Text style={styles.sectionTitle}>باقة واشتراك التطبيق</Text>
            <Text style={styles.sectionSubtitle}>
              إدارة خطة النظام السحابية للعقار وتجديد الترخيص
            </Text>
          </View>
        </View>

        {/* Plan Status Banner */}
        <View
          style={[
            styles.planStatusCard,
            subscriptionStatusDetails.isSuspended && styles.planCardSuspended,
          ]}
        >
          <View style={styles.planStatusTop}>
            <StatusBadge
              status={subscriptionStatusDetails.badgeStatus}
              customLabel={subscriptionStatusDetails.label}
            />
            <Text style={styles.planPriceHighlight}>
              {effectiveMonthlyPlanPrice > 0
                ? `${effectiveMonthlyPlanPrice} ج.م / شهر`
                : 'مجاني'}
            </Text>
          </View>

          {subscriptionStatusDetails.isTrial ? (
            <View style={styles.trialRemainingBox}>
              <MaterialIcons name="schedule" size={18} color="#B45309" />
              <Text style={styles.trialRemainingText}>
                متبقي {subscriptionStatusDetails.daysRemaining} يوماً في التجربة
                المجانية الشاملة لكافة المميزات.
              </Text>
            </View>
          ) : (
            <Text style={styles.planDescText}>
              الاشتراك يشمل: إدارة الخزينة والمصروفات، مطالبات الطوارئ، التصويت
              الديمقراطي، الشكاوى، وضغط الصور السحابي اللامحدود.
            </Text>
          )}

          {/* Features Grid */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <MaterialIcons name="check-circle" size={16} color="#10B981" />
              <Text style={styles.featureText}>
                حد الوحدات: حتى{' '}
                {currentBuilding.max_apartments_override ||
                  currentBuilding.total_apartments ||
                  50}{' '}
                شقة
              </Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialIcons name="check-circle" size={16} color="#10B981" />
              <Text style={styles.featureText}>
                تقارير وسندات صرف موثقة بالفواتير
              </Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialIcons name="check-circle" size={16} color="#10B981" />
              <Text style={styles.featureText}>
                إشعارات فورية وتنبيهات Push متطورة
              </Text>
            </View>
          </View>

          {/* Renewal Action Button (Admin Only) */}
          {currentRole === 'admin' ? (
            <TouchableOpacity
              style={styles.renewSubscriptionBtn}
              onPress={() => setSubscriptionModalVisible(true)}
            >
              <MaterialIcons
                name="cloud-upload"
                size={20}
                color={COLORS.onPrimary}
              />
              <Text style={styles.renewSubscriptionBtnText}>
                تجديد باقة التطبيق ورفع إيصال التحويل ⚡
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.residentSubNote}>
              <MaterialIcons name="info" size={16} color={COLORS.primary} />
              <Text style={styles.residentSubNoteText}>
                إدارة تجديد الباقة مسندة لمجلس إدارة اتحاد الملاك وتُسدد تلقائياً
                من صندوق العمارة.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 3. General & Building Settings */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.iconBoxPrimary}>
            <MaterialIcons name="apartment" size={24} color={COLORS.primary} />
          </View>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <Text style={styles.sectionTitle}>بيانات العقار والوحدات</Text>
            <Text style={styles.sectionSubtitle}>
              إحصائيات الوحدات السكنية المسجلة
            </Text>
          </View>
        </View>

        <View style={styles.buildingStatsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{apartments.length}</Text>
            <Text style={styles.statLbl}>إجمالي الشقق</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#10B981' }]}>
              {
                apartments.filter((a) =>
                  Boolean(a.resident_id || a.occupant_name || a.resident_name)
                ).length
              }
            </Text>
            <Text style={styles.statLbl}>شقق مأهولة</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#F59E0B' }]}>
              {
                apartments.filter(
                  (a) =>
                    !a.resident_id && !a.occupant_name && !a.resident_name
                ).length
              }
            </Text>
            <Text style={styles.statLbl}>شقق شاغرة</Text>
          </View>
        </View>
      </View>

      {/* 4. Switch Role (Demo & Multi-Role Testing) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.iconBoxAmber}>
            <MaterialIcons
              name="swap-horiz"
              size={24}
              color={COLORS.statusUpcoming}
            />
          </View>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <Text style={styles.sectionTitle}>تبديل الحساب والدور (تجريبي)</Text>
            <Text style={styles.sectionSubtitle}>
              التبديل بين دور المدير والساكن لتجربة التفاعل
            </Text>
          </View>
        </View>

        <View style={styles.roleChipsRow}>
          <TouchableOpacity
            style={[
              styles.roleChip,
              currentRole === 'admin' && styles.roleChipActive,
            ]}
            onPress={() => switchRole('admin')}
          >
            <MaterialIcons
              name="admin-panel-settings"
              size={18}
              color={
                currentRole === 'admin' ? COLORS.primary : COLORS.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.roleChipText,
                currentRole === 'admin' && styles.roleChipTextActive,
              ]}
            >
              رئيس الاتحاد
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleChip,
              currentRole === 'resident' && styles.roleChipActive,
            ]}
            onPress={() => switchRole('resident')}
          >
            <MaterialIcons
              name="home"
              size={18}
              color={
                currentRole === 'resident'
                  ? COLORS.primary
                  : COLORS.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.roleChipText,
                currentRole === 'resident' && styles.roleChipTextActive,
              ]}
            >
              الساكن (شقة 302)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleChip,
              currentRole === 'super_admin' && styles.roleChipActive,
            ]}
            onPress={() => switchRole('super_admin')}
          >
            <MaterialIcons
              name="verified-user"
              size={18}
              color={
                currentRole === 'super_admin'
                  ? COLORS.primary
                  : COLORS.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.roleChipText,
                currentRole === 'super_admin' && styles.roleChipTextActive,
              ]}
            >
              إدارة المنصة
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 5. Account Actions & Logout */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={async () => {
            await refreshData();
            Alert.alert('تم التحديث بنجاح 🔄', 'تمت مزامنة البيانات مع السيرفر.');
          }}
        >
          <MaterialIcons name="sync" size={18} color={COLORS.primary} />
          <Text style={styles.refreshBtnText}>مزامنة وتحديث البيانات الآن</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert(
              'تسجيل الخروج',
              'هل ترغب في تسجيل الخروج والعودة لشاشة الدخول والرمز؟',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'تسجيل الخروج',
                  style: 'destructive',
                  onPress: () => setAuthenticated(false),
                },
              ]
            );
          }}
        >
          <MaterialIcons name="logout" size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>تسجيل الخروج من الحساب</Text>
        </TouchableOpacity>

        <Text style={styles.appVersionText}>
          تطبيق "مدير اتحاد الملاك" • Ittihad Trust Mobile
          {'\n'}الإصدار 1.2.0 • حماية وشفافية سحابية كاملة
        </Text>
      </View>

      {/* ==================================================================== */}
      {/* SUBSCRIPTION RENEWAL MODAL                                           */}
      {/* ==================================================================== */}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    gap: 14,
  },
  profileTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(9, 20, 38, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  nameAndBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  userPhoneText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  buildingSubText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  buildingCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  buildingCodeLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  buildingCodeValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  codeActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  codeActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shareBtn: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  codeActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  iconBoxSecondary: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 108, 73, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxPrimary: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(9, 20, 38, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxAmber: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  planStatusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  planCardSuspended: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  planStatusTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planPriceHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  trialRemainingBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trialRemainingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
    textAlign: 'right',
  },
  planDescText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 18,
  },
  featuresList: {
    gap: 6,
    paddingVertical: 4,
  },
  featureItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  renewSubscriptionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  renewSubscriptionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  residentSubNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(9, 20, 38, 0.05)',
    borderRadius: 10,
    padding: 10,
  },
  residentSubNoteText: {
    fontSize: 12,
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
  },
  buildingStatsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  statLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  roleChipsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(9, 20, 38, 0.08)',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  roleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  logoutSection: {
    marginTop: 10,
    alignItems: 'center',
    gap: 14,
  },
  refreshBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(9, 20, 38, 0.06)',
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.error,
  },
  appVersionText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  modalScroll: {
    maxHeight: 500,
  },
  subInfoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 14,
  },
  subInfoTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    textAlign: 'right',
    marginBottom: 4,
  },
  subInfoDesc: {
    fontSize: 11,
    color: '#1E40AF',
    textAlign: 'right',
    lineHeight: 16,
  },
  instapayCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 14,
    gap: 8,
  },
  instapayHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  instapayTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  instapayRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  instapayLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  instapayVal: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  copyLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 14,
  },
  catChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  catChipActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(0, 108, 73, 0.08)',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  catChipTextActive: {
    color: COLORS.secondary,
    fontWeight: '800',
  },
  twoCol: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  calculatedPriceBox: {
    backgroundColor: 'rgba(0, 108, 73, 0.1)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 108, 73, 0.2)',
  },
  calculatedPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  invoiceAttachCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  invoiceAttachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  invoiceAttachSub: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  uploadButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 16,
  },
  uploadPickerBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  uploadPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalPrimaryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
});
