import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { styles } from './SuperAdminScreen.styles';
import { PlanTemplatesTab } from './components/PlanTemplatesTab';
import { BuildingOverridesTab } from './components/BuildingOverridesTab';
import { SubscriptionActivationsTab } from './components/SubscriptionActivationsTab';
import { SuperAdminHero } from './components/SuperAdminHero';

/**
 * In-app Super Admin Mobile Screen (مالك التطبيق - super_admin)
 * Follows PROMPT.md.txt Section 2 & 3 and uses the exact Ittihad Trust Mobile design system:
 * 1. Activate Building Subscriptions (with automatic insertion of expense "رسوم اشتراك تطبيق إدارة العقار" & deduction from fund_balance)
 * 2. Customize per-building pricing (custom_monthly_price), apartment limits (max_apartments_override), and independent Feature Flags (features_config JSONB)
 * 3. Manage global plan templates (free, pro, plus)
 */
export const SuperAdminScreen: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'activations' | 'buildings' | 'plans'
  >('activations');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Hero Banner */}
      <SuperAdminHero activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />

      {/* ==================================================================== */}
      {/* TAB 1: Subscription Activations (التفعيل التلقائي وخصم مصروف التطبيق) */}
      {/* ==================================================================== */}
      <SubscriptionActivationsTab activeSubTab={activeSubTab} />

      {/* ==================================================================== */}
      {/* TAB 2: Per-Building Custom Pricing & Feature Flags                   */}
      {/* ==================================================================== */}
      <BuildingOverridesTab activeSubTab={activeSubTab} />

      {/* ==================================================================== */}
      {/* TAB 3: Global Plan Templates (free, pro, plus)                       */}
      {/* ==================================================================== */}
      <PlanTemplatesTab activeSubTab={activeSubTab} />
    </ScrollView>
  );
};

