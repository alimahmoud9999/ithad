import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { CommunityTab } from '../../domain/community.types';
import { styles } from '../CommunityHubScreen.styles';

interface CampaignsTabProps {
  activeTab: CommunityTab;
}

export const CampaignsTab: React.FC<CampaignsTabProps> = ({
  activeTab,
}) => {
  const { currentBuilding, currentUser, emergencyClaims, payments } = useAppStore();

  return (
    activeTab === 'campaigns' && (
    <View style={styles.tabContent}>
      {/* Hero Emergency Status Banner */}
      <View style={styles.emergencyHeroCard}>
        <View style={styles.emergencyHeroTop}>
          <View style={styles.emergencyIconBox}>
            <MaterialIcons name="construction" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={styles.emergencyHeroChip}>
              <View style={styles.pingDotRed} />
              <Text style={styles.emergencyHeroChipText}>صناديق الصيانة الاستثنائية</Text>
            </View>
            <Text style={styles.emergencyHeroTitle}>مطالبات الطوارئ الجماعية</Text>
            <Text style={styles.emergencyHeroSub}>
              جمع التكاليف الطارئة غير المغطاة بالاشتراك الشهري بنظام الحصص العادلة
            </Text>
          </View>
        </View>
      </View>

      {/* Emergency Claims Feed */}
      {emergencyClaims.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="verified-user" size={44} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>لا توجد مطالبات طوارئ نشطة حالياً</Text>
          <Text style={styles.emptySub}>
            صندوق الطوارئ مستقر ولا توجد أعطال جسيمة تستدعي جمع مساهمات استثنائية.
          </Text>
        </View>
      ) : (
        emergencyClaims.map((claim) => {
          const approvedPayments = payments.filter(
            (p) => p.emergency_claim_id === claim.id && p.status === 'paid'
          );
          const actualCollected = Math.max(
            claim.collected_amount,
            approvedPayments.reduce((acc, p) => acc + p.amount, 0)
          );
          const totalUnits = currentBuilding.total_apartments || 16;
          const pct = Math.min(
            100,
            Math.round((actualCollected / Math.max(claim.target_amount, 1)) * 100)
          );
          const isUserPaid = approvedPayments.some(
            (p) =>
              p.resident_id === currentUser.id ||
              p.apartment_number === currentUser.apartment_number
          );
          const userShare =
            claim.default_share_amount ||
            Math.round(claim.target_amount / Math.max(totalUnits, 1));

          return (
            <View key={claim.id} style={styles.claimCard}>
              <View style={styles.claimHeaderRow}>
                <View style={styles.claimCategoryBadge}>
                  <MaterialIcons name="handyman" size={14} color={COLORS.error} />
                  <Text style={styles.claimCategoryBadgeText}>{claim.category}</Text>
                </View>
                <View
                  style={[
                    styles.claimStatusPill,
                    isUserPaid ? styles.claimStatusPillPaid : styles.claimStatusPillPending,
                  ]}
                >
                  <MaterialIcons
                    name={isUserPaid ? 'check-circle' : 'pending'}
                    size={13}
                    color={isUserPaid ? COLORS.statusPaid : COLORS.statusPending}
                  />
                  <Text
                    style={[
                      styles.claimStatusPillText,
                      isUserPaid
                        ? styles.claimStatusPillTextPaid
                        : styles.claimStatusPillTextPending,
                    ]}
                  >
                    {isUserPaid ? 'مسددة منكم ✓' : 'مستحقة للسداد'}
                  </Text>
                </View>
              </View>

              <Text style={styles.claimTitleText}>{claim.title}</Text>
              {Boolean(claim.description) && (
                <Text style={styles.claimDescText}>{claim.description}</Text>
              )}

              {/* Progress Gauge */}
              <View style={styles.claimProgressContainer}>
                <View style={styles.claimProgressLabels}>
                  <Text style={styles.claimProgressVal}>
                    {actualCollected.toLocaleString()} من{' '}
                    {claim.target_amount.toLocaleString()} ج.م
                  </Text>
                  <Text style={styles.claimProgressPct}>{pct}% مكتمل</Text>
                </View>
                <View style={styles.claimProgressBarTrack}>
                  <View style={[styles.claimProgressBarFill, { width: `${pct}%` }]} />
                </View>
              </View>

              {/* Share per unit & action */}
              <View style={styles.claimFooterRow}>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.claimShareLabel}>حصة وحدتكم المقررة</Text>
                  <Text style={styles.claimShareValue}>{userShare.toLocaleString()} ج.م</Text>
                </View>

                {!isUserPaid && (
                  <View style={styles.claimActionBadge}>
                    <Text style={styles.claimActionBadgeText}>سداد عبر تطبيق الساكن 💳</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
    )
  ) || null;
};
