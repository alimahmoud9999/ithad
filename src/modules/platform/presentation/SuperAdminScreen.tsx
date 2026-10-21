import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import {
  BuildingSubscriptionStatus,
  FeaturesConfig,
  PlanTier,
} from '@/shared/types/database';

const FEATURE_FLAG_LABELS: Array<{
  key: keyof FeaturesConfig;
  label: string;
  desc: string;
}> = [
  {
    key: 'receipt_upload',
    label: 'رفع إيصالات التحويل الإلكتروني',
    desc: 'السماح للسكان برفع لقطات شاشة إنستاباي والتحويلات البنكية',
  },
  {
    key: 'emergency_claims',
    label: 'نظام المطالبات والصيانات الطارئة',
    desc: 'إنشاء صناديق الطوارئ بشريط التقدم الحي وتوزيع الأنصبة',
  },
  {
    key: 'export_reports',
    label: 'تصدير التقارير وكشوف الحساب (PDF)',
    desc: 'توليد تقارير الشفافية المالية الرسمية المعتمدة',
  },
  {
    key: 'voting',
    label: 'التصويت وقرارات الجمعية العمومية',
    desc: 'احتساب الأصوات القانوني وفق الحصة العقارية بالأرض',
  },
  {
    key: 'maintenance_tickets',
    label: 'بلاغات الأعطال والصيانة الفورية',
    desc: 'استقبال وتكليف الفنيين بمتابعة أعطال المرافق المشتركة',
  },
  {
    key: 'documents_archive',
    label: 'أرشيف اللائحة والعقود الرسمية',
    desc: 'حفظ ومشاركة لائحة اتحاد الشاغلين وعقود الصيانة',
  },
];

/**
 * In-app Super Admin Mobile Screen (مالك التطبيق - super_admin)
 * Follows PROMPT.md.txt Section 2 & 3 and uses the exact Ittihad Trust Mobile design system:
 * 1. Activate Building Subscriptions (with automatic insertion of expense "رسوم اشتراك تطبيق إدارة العقار" & deduction from fund_balance)
 * 2. Customize per-building pricing (custom_monthly_price), apartment limits (max_apartments_override), and independent Feature Flags (features_config JSONB)
 * 3. Manage global plan templates (free, pro, plus)
 */
export const SuperAdminScreen: React.FC = () => {
  const {
    buildings,
    plans,
    subscriptionInvoices,
    processingIds,
    activateBuildingSubscription,
    superAdminConfigureBuilding,
    superAdminUpdatePlanTemplate,
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<
    'activations' | 'buildings' | 'plans'
  >('activations');

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    buildings[0]?.id || 'bld-amal-001'
  );

  const selectedBuilding =
    buildings.find((b) => b.id === selectedBuildingId) || buildings[0];

  const [customPriceInput, setCustomPriceInput] = useState<string>(
    selectedBuilding?.custom_monthly_price != null
      ? String(selectedBuilding.custom_monthly_price)
      : ''
  );
  const [maxAptsInput, setMaxAptsInput] = useState<string>(
    selectedBuilding?.max_apartments_override != null
      ? String(selectedBuilding.max_apartments_override)
      : String(selectedBuilding?.total_apartments || 24)
  );

  const selectBuildingForEdit = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    const bld = buildings.find((b) => b.id === buildingId);
    if (bld) {
      setCustomPriceInput(
        bld.custom_monthly_price !== null
          ? String(bld.custom_monthly_price)
          : ''
      );
      setMaxAptsInput(
        bld.max_apartments_override !== null
          ? String(bld.max_apartments_override)
          : String(bld.total_apartments)
      );
    }
  };

  const handleActivateSubscription = async (invoiceId: string) => {
    try {
      await activateBuildingSubscription(invoiceId);
      Alert.alert(
        'تم تفعيل اشتراك العمارة بنجاح 🎉',
        'تم تمديد اشتراك العمارة، وتم إدراج مصروف تلقائي بعنوان "رسوم اشتراك تطبيق إدارة العقار" في سجل الشفافية وخصمه من رصيد الصندوق!'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ أثناء التفعيل');
    }
  };

  const handleSaveBuildingOverrides = async () => {
    if (!selectedBuilding) return;
    try {
      const parsedPrice =
        customPriceInput.trim() === '' ? null : parseFloat(customPriceInput);
      const parsedMaxApts =
        maxAptsInput.trim() === '' ? null : parseInt(maxAptsInput, 10);

      await superAdminConfigureBuilding({
        buildingId: selectedBuilding.id,
        customMonthlyPrice: parsedPrice,
        maxApartmentsOverride: parsedMaxApts,
      });

      Alert.alert(
        'تم حفظ التخصيص بنجاح ✓',
        `تم تحديث السعر المخصص وحد الشقق لعمارة (${selectedBuilding.name}).`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر حفظ الإعدادات');
    }
  };

  const handleToggleBuildingFeature = async (
    featureKey: keyof FeaturesConfig,
    value: boolean
  ) => {
    if (!selectedBuilding) return;
    await superAdminConfigureBuilding({
      buildingId: selectedBuilding.id,
      featuresConfig: {
        [featureKey]: value,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroTop}>
          <View style={{ alignItems: 'flex-end', flex: 1 }}>
            <View style={styles.superBadge}>
              <MaterialIcons
                name="verified-user"
                size={14}
                color={COLORS.secondaryFixed}
              />
              <Text style={styles.superBadgeText}>
                صلاحية مالك التطبيق (Super Admin)
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              إدارة العمارات والتسعير المرن والباقات
            </Text>
            <Text style={styles.heroSub}>
              تفعيل الاشتراكات، تخصيص الأسعار، والتحكم في مفاتيح المميزات لكل
              عمارة
            </Text>
          </View>
        </View>

        {/* Sub-navigation Tabs */}
        <View style={styles.subTabsBar}>
          <TouchableOpacity
            style={[
              styles.subTabBtn,
              activeSubTab === 'activations' && styles.subTabBtnActive,
            ]}
            onPress={() => setActiveSubTab('activations')}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === 'activations' && styles.subTabTextActive,
              ]}
            >
              تفعيل الاشتراكات (
              {
                subscriptionInvoices.filter((i) => i.status === 'pending')
                  .length
              }
              )
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabBtn,
              activeSubTab === 'buildings' && styles.subTabBtnActive,
            ]}
            onPress={() => setActiveSubTab('buildings')}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === 'buildings' && styles.subTabTextActive,
              ]}
            >
              تخصيص العمارات ({buildings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabBtn,
              activeSubTab === 'plans' && styles.subTabBtnActive,
            ]}
            onPress={() => setActiveSubTab('plans')}
          >
            <Text
              style={[
                styles.subTabText,
                activeSubTab === 'plans' && styles.subTabTextActive,
              ]}
            >
              قوالب الباقات
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ==================================================================== */}
      {/* TAB 1: Subscription Activations (التفعيل التلقائي وخصم مصروف التطبيق) */}
      {/* ==================================================================== */}
      {activeSubTab === 'activations' && (
        <View style={{ gap: 12 }}>
          <View style={styles.infoNoticeCard}>
            <MaterialIcons
              name="auto-awesome"
              size={20}
              color={COLORS.secondary}
            />
            <Text style={styles.infoNoticeText}>
              عند الضغط على "تفعيل"، تقوم دالة RPC آمنة بتمديد الاشتراك وإدراج
              مصروف تلقائي في ميزانية العمارة تحت مسمى "رسوم اشتراك تطبيق إدارة
              العقار" ليظهر في الشفافية ويخصم من الصندوق.
            </Text>
          </View>

          {subscriptionInvoices.map((inv) => {
            const isLocked = Boolean(processingIds[inv.id]);
            const isPending = inv.status === 'pending';

            return (
              <View key={inv.id} style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={styles.invoiceBldName}>
                      {inv.building_name} ({inv.building_code})
                    </Text>
                    <Text style={styles.invoiceAdminSub}>
                      رئيس الاتحاد: {inv.admin_name} • باقة{' '}
                      {inv.plan_code.toUpperCase()} ({inv.duration_months} شهر)
                    </Text>
                  </View>

                  <StatusBadge
                    status={inv.status === 'approved' ? 'paid' : 'pending'}
                    customLabel={
                      inv.status === 'approved'
                        ? 'تم التفعيل والخصم'
                        : 'بانتظار التفعيل'
                    }
                  />
                </View>

                <View style={styles.invoiceReceiptBox}>
                  <View style={styles.invoiceReceiptRight}>
                    <Image
                      source={{ uri: inv.receipt_image_url }}
                      style={styles.invoiceThumb}
                    />
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.invoiceAmountLabel}>
                        قيمة الباقة المحولة: {inv.amount} ج.م
                      </Text>
                      <Text style={styles.invoiceNotesLabel}>
                        {inv.notes || 'إيصال تحويل إنستاباي مرفوع من المدير'}
                      </Text>
                    </View>
                  </View>
                </View>

                {isPending ? (
                  <TouchableOpacity
                    style={[
                      styles.activateCtaBtn,
                      isLocked && { opacity: 0.6 },
                    ]}
                    onPress={() => handleActivateSubscription(inv.id)}
                    disabled={isLocked}
                  >
                    {isLocked ? (
                      <ActivityIndicator color={COLORS.onSecondary} />
                    ) : (
                      <>
                        <MaterialIcons
                          name="bolt"
                          size={20}
                          color={COLORS.onSecondary}
                        />
                        <Text style={styles.activateCtaText}>
                          تفعيل الاشتراك وإدراج المصروف تلقائياً ({inv.amount}{' '}
                          ج.م)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.activatedDoneBar}>
                    <MaterialIcons
                      name="check-circle"
                      size={16}
                      color={COLORS.statusPaidText}
                    />
                    <Text style={styles.activatedDoneText}>
                      تم التفعيل وإدراج مصروف "رسوم اشتراك تطبيق إدارة العقار" في
                      ميزانية العمارة
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: Per-Building Custom Pricing & Feature Flags                   */}
      {/* ==================================================================== */}
      {activeSubTab === 'buildings' && selectedBuilding && (
        <View style={{ gap: 14 }}>
          <Text style={styles.sectionTitle}>اختر العمارة لتخصيص إعداداتها:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8 }}
          >
            {buildings.map((b) => {
              const active = b.id === selectedBuilding.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => selectBuildingForEdit(b.id)}
                  style={[
                    styles.buildingSelectChip,
                    active && styles.buildingSelectChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.buildingSelectChipText,
                      active && styles.buildingSelectChipTextActive,
                    ]}
                  >
                    {b.name} ({b.building_code})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Building Pricing & Status Card */}
          <View style={styles.configCard}>
            <View style={styles.configCardHeader}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.configCardTitle}>
                  {selectedBuilding.name}
                </Text>
                <Text style={styles.configCardSub}>
                  رصيد الصندوق الحالي:{' '}
                  {selectedBuilding.fund_balance.toLocaleString()} ج.م
                </Text>
              </View>
              <StatusBadge status={selectedBuilding.subscription_status} />
            </View>

            {/* Subscription Status Switcher (Trial / Active / Read-Only) */}
            <Text style={styles.fieldLabel}>
              حالة اشتراك العمارة (تحويل المدير إلى Read-Only عند الانتهاء):
            </Text>
            <View style={styles.statusSwitchRow}>
              {(
                [
                  { key: 'trial', label: 'فترة تجريبية (60 يوم)' },
                  { key: 'active', label: 'نشط (Active)' },
                  { key: 'read_only', label: 'قراءة فقط (Read-Only)' },
                ] as Array<{
                  key: BuildingSubscriptionStatus;
                  label: string;
                }>
              ).map((st) => {
                const active = selectedBuilding.subscription_status === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    style={[
                      styles.statusSwitchBtn,
                      active && styles.statusSwitchBtnActive,
                    ]}
                    onPress={() =>
                      superAdminConfigureBuilding({
                        buildingId: selectedBuilding.id,
                        subscriptionStatus: st.key,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.statusSwitchText,
                        active && styles.statusSwitchTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Plan Template Tier */}
            <Text style={styles.fieldLabel}>الباقة المسندة للعمارة:</Text>
            <View style={styles.statusSwitchRow}>
              {(['free', 'pro', 'plus'] as PlanTier[]).map((tier) => {
                const active = selectedBuilding.plan_code === tier;
                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.statusSwitchBtn,
                      active && styles.statusSwitchBtnActive,
                    ]}
                    onPress={() =>
                      superAdminConfigureBuilding({
                        buildingId: selectedBuilding.id,
                        planCode: tier,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.statusSwitchText,
                        active && styles.statusSwitchTextActive,
                      ]}
                    >
                      {tier.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Monthly Price & Max Apartments Override */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.fieldLabel}>
                  سعر اشتراك مخصص (custom_monthly_price)
                </Text>
                <TextInput
                  style={styles.input}
                  value={customPriceInput}
                  onChangeText={setCustomPriceInput}
                  keyboardType="numeric"
                  placeholder="اتركه فارغاً للسعر الافتراضي"
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.fieldLabel}>الحد الأقصى للشقق</Text>
                <TextInput
                  style={styles.input}
                  value={maxAptsInput}
                  onChangeText={setMaxAptsInput}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveOverridesBtn}
              onPress={handleSaveBuildingOverrides}
            >
              <MaterialIcons name="save" size={18} color={COLORS.onPrimary} />
              <Text style={styles.saveOverridesBtnText}>
                حفظ السعر المخصص وحد الشقق
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feature Flags (features_config JSONB) */}
          <View style={styles.configCard}>
            <Text style={styles.configCardTitle}>
              مفاتيح المميزات المستقلة للعمارة (features_config JSONB)
            </Text>
            <Text style={styles.configCardSub}>
              تفعيل أو إيقاف فوري لأي ميزة لهذه العمارة بشكل مستقل عن الباقة
              العامة
            </Text>

            <View style={{ gap: 10, marginTop: 8 }}>
              {FEATURE_FLAG_LABELS.map((feat) => {
                const enabled = Boolean(
                  selectedBuilding.features_config[feat.key]
                );
                return (
                  <View key={feat.key} style={styles.featureToggleRow}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.featureToggleTitle}>
                        {feat.label}
                      </Text>
                      <Text style={styles.featureToggleDesc}>{feat.desc}</Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={(val) =>
                        handleToggleBuildingFeature(feat.key, val)
                      }
                      trackColor={{
                        false: COLORS.borderSubtle,
                        true: COLORS.secondaryContainer,
                      }}
                      thumbColor={
                        enabled ? COLORS.secondary : COLORS.neutralSlate
                      }
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: Global Plan Templates (free, pro, plus)                       */}
      {/* ==================================================================== */}
      {activeSubTab === 'plans' && (
        <View style={{ gap: 12 }}>
          {plans.map((plan) => (
            <View key={plan.code} style={styles.configCard}>
              <View style={styles.configCardHeader}>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                  <Text style={styles.configCardTitle}>{plan.name_ar}</Text>
                  <Text style={styles.configCardSub}>
                    {plan.description_ar}
                  </Text>
                </View>
                <View style={styles.planCodeTag}>
                  <Text style={styles.planCodeTagText}>
                    {plan.code.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.fieldLabel}>
                    السعر الشهري الافتراضي (ج.م)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={String(plan.default_monthly_price)}
                    keyboardType="numeric"
                    onChangeText={(txt) =>
                      superAdminUpdatePlanTemplate(plan.code, {
                        default_monthly_price: parseFloat(txt) || 0,
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.fieldLabel}>الحد الأقصى للشقق</Text>
                  <TextInput
                    style={styles.input}
                    value={String(plan.max_apartments)}
                    keyboardType="numeric"
                    onChangeText={(txt) =>
                      superAdminUpdatePlanTemplate(plan.code, {
                        max_apartments: parseInt(txt, 10) || 10,
                      })
                    }
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
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
  heroBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  superBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(111, 251, 190, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 6,
  },
  superBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.onPrimary,
    textAlign: 'right',
  },
  heroSub: {
    fontSize: 12,
    color: COLORS.primaryFixedDim,
    textAlign: 'right',
    marginTop: 2,
  },
  subTabsBar: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  subTabBtnActive: {
    backgroundColor: COLORS.secondary,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryFixedDim,
  },
  subTabTextActive: {
    color: COLORS.onSecondary,
    fontWeight: '700',
  },
  infoNoticeCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.onSurface,
    textAlign: 'right',
    lineHeight: 18,
  },
  invoiceCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  invoiceHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  invoiceBldName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  invoiceAdminSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  invoiceReceiptBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceReceiptRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  invoiceThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  invoiceAmountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  invoiceNotesLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  activateCtaBtn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activateCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSecondary,
  },
  activatedDoneBar: {
    backgroundColor: COLORS.statusPaidBg,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  activatedDoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPaidText,
    flex: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  buildingSelectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  buildingSelectChipActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  buildingSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  buildingSelectChipTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  configCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  configCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  configCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  configCardSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  statusSwitchRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  statusSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  statusSwitchBtnActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  statusSwitchText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  statusSwitchTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  twoColRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  input: {
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  saveOverridesBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveOverridesBtnText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  featureToggleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceCanvas,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  featureToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  featureToggleDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  planCodeTag: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planCodeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
});
