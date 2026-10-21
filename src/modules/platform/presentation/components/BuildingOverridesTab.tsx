import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BuildingSubscriptionStatus, PlanTier, FeaturesConfig } from '@/shared/types/database';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { FEATURE_FLAG_LABELS } from '../../domain/platform.constants';
import { styles } from '../SuperAdminScreen.styles';

interface BuildingOverridesTabProps {
  activeSubTab: 'activations' | 'buildings' | 'plans';
}

export const BuildingOverridesTab: React.FC<BuildingOverridesTabProps> = ({
  activeSubTab,
}) => {
  const { buildings, superAdminConfigureBuilding } = useAppStore();

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
    activeSubTab === 'buildings' && selectedBuilding && (
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
    )
  ) || null;
};
