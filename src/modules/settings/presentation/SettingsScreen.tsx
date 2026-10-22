import React, { useState, useMemo } from 'react';
import { ScrollView, Alert } from 'react-native';
import { useAppStore } from '@/store/AppContext';
import { PlanTier } from '@/shared/types/database';
import { styles } from './SettingsScreen.styles';
import { SubscriptionRenewalModal } from './components/SubscriptionRenewalModal';
import { AccountActionsSection } from './components/AccountActionsSection';
import { RoleSwitcherCard } from './components/RoleSwitcherCard';
import { BuildingStatsCard } from './components/BuildingStatsCard';
import { SubscriptionPlanCard } from './components/SubscriptionPlanCard';
import { ProfileCard } from './components/ProfileCard';

interface SettingsScreenProps {
  onNavigateTab?: (tabKey: any) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigateTab }) => {
  const { currentBuilding } = useAppStore();

  // Subscription Renewal Modal State
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentBuilding.plan_code || 'pro'
  );

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

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    Alert.alert('تم النسخ بنجاح 📋', `تم نسخ ${label}: ${text}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header Profile Card */}
      <ProfileCard handleCopy={handleCopy} />

      {/* 2. App Subscription & Building Plan (Requested Highlight) */}
      <SubscriptionPlanCard
        setSubscriptionModalVisible={setSubscriptionModalVisible}
        effectiveMonthlyPlanPrice={effectiveMonthlyPlanPrice}
      />

      {/* 3. General & Building Settings */}
      <BuildingStatsCard />

      {/* 4. Switch Role (Demo & Multi-Role Testing) */}
      <RoleSwitcherCard />

      {/* 5. Account Actions & Logout */}
      <AccountActionsSection />

      {/* ==================================================================== */}
      {/* SUBSCRIPTION RENEWAL MODAL                                           */}
      {/* ==================================================================== */}
      <SubscriptionRenewalModal
        setSubscriptionModalVisible={setSubscriptionModalVisible}
        subscriptionModalVisible={subscriptionModalVisible}
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        effectiveMonthlyPlanPrice={effectiveMonthlyPlanPrice}
        handleCopy={handleCopy}
      />
    </ScrollView>
  );
};

