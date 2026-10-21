import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

interface SubscriptionPlanCardProps {
  setSubscriptionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  effectiveMonthlyPlanPrice: number;
}

export const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({
  setSubscriptionModalVisible,
  effectiveMonthlyPlanPrice,
}) => {
  const { currentBuilding, currentRole } = useAppStore();

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

  return (
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
  );
};
