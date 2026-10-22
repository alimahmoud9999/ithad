import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { EmergencyClaim } from '@/shared/types/database';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../emergency.styles';

interface ActiveEmergencyClaimsSectionProps {
  setSelectedClaimForDetails: React.Dispatch<React.SetStateAction<EmergencyClaim | null>>;
  setClosingClaimId: React.Dispatch<React.SetStateAction<string | null>>;
  setCloseClaimActualAmount: React.Dispatch<React.SetStateAction<string>>;
}

export const ActiveEmergencyClaimsSection: React.FC<ActiveEmergencyClaimsSectionProps> = ({
  setSelectedClaimForDetails,
  setClosingClaimId,
  setCloseClaimActualAmount,
}) => {
  const { currentBuilding, payments } = useAppStore();
  const { activeEmergencyClaims, buildingApartments } = useAdminDashboardMetrics();

  return (
    activeEmergencyClaims.length > 0 && (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.titleWithBadgeRow}>
          <Text style={styles.sectionTitle}>المطالبات الطارئة النشطة</Text>
          <StatusBadge status="upcoming" customLabel="جاري التحصيل" />
        </View>
      </View>

      {activeEmergencyClaims.map((claim) => {
        const approvedClaimPayments = payments.filter(
          (p) => p.emergency_claim_id === claim.id && p.status === 'paid'
        );
        const actualCollected = Math.max(
          claim.collected_amount,
          approvedClaimPayments.reduce((acc, p) => acc + p.amount, 0)
        );
        const actualContributorsCount = Math.max(
          claim.contributors_count ?? 0,
          new Set(
            approvedClaimPayments.map(
              (p) => p.apartment_number || p.resident_id
            )
          ).size
        );
        const pct = Math.min(
          100,
          Math.round(
            (actualCollected / Math.max(claim.target_amount, 1)) * 100
          )
        );
        const remainingAmount = Math.max(
          0,
          claim.target_amount - actualCollected
        );
        const paidApartmentNumbers = new Set(
          approvedClaimPayments.map((p) => p.apartment_number)
        );
        const paidCount = paidApartmentNumbers.size;
        const totalUnits =
          buildingApartments.length || currentBuilding.total_apartments;
        const unpaidCount = Math.max(0, totalUnits - paidCount);

        const shareAmount =
          claim.default_share_amount ||
          Math.round(claim.target_amount / totalUnits);

        return (
          <View key={claim.id} style={styles.emergencyAdminCard}>
            {/* Header Row matching original Stitch emergency design */}
            <View style={styles.emergencyHeaderRow}>
              <View style={styles.emergencyTitleGroup}>
                <View style={styles.emergencyIconBox}>
                  <MaterialIcons
                    name="handyman"
                    size={20}
                    color={COLORS.onErrorContainer}
                  />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end', marginBottom: 10 }}>
                  <Text style={styles.emergencyOverline}>
                    مطالبة طارئة نشطة • {claim.category}
                  </Text>
                  <Text style={styles.emergencyTitle}>{claim.title}</Text>
                </View>
              </View>
            </View>

            {/* Live Progress Bar (Original Design - 100% Identical to Resident Screen) */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelsRow}>
                <Text style={styles.progressSummaryText}>
                  تم جمع{' '}
                  <Text
                    style={{ fontWeight: '700', color: COLORS.onSurface }}
                  >
                    {actualCollected.toLocaleString()} ج.م
                  </Text>{' '}
                  من أصل {claim.target_amount.toLocaleString()} ج.م
                </Text>
                <Text style={styles.progressPercentText}>
                  {pct}% مكتمل
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${pct}%` },
                  ]}
                />
              </View>
            </View>

            {/* Contributors Count & Unit Share */}
            <View style={styles.contributorsRow}>
              <View style={styles.avatarsGroup}>
                {actualContributorsCount > 0 ? (
                  <>
                    <View
                      style={[
                        styles.miniAvatar,
                        { backgroundColor: COLORS.primaryContainer },
                      ]}
                    >
                      <Text style={styles.miniAvatarTextLight}>
                        +{actualContributorsCount}
                      </Text>
                    </View>
                    <Text style={styles.contributorsCountLabel}>
                      ساهم {actualContributorsCount} ملاك ({paidCount} مسدد • {unpaidCount} متبقي)
                    </Text>
                  </>
                ) : (
                  <Text style={styles.contributorsCountLabel}>
                    لم يساهم أحد حتى الآن (0 ملاك)
                  </Text>
                )}
              </View>

              <View style={styles.residentShareBox}>
                <Text style={styles.residentShareText}>
                  نصيب الوحدة:{' '}
                  <Text style={styles.residentShareBold}>
                    {shareAmount.toLocaleString()} ج.م
                  </Text>
                </Text>
              </View>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.emergencyCardActionsRow}>
              <TouchableOpacity
                style={styles.viewDetailsBtn}
                onPress={() => setSelectedClaimForDetails(claim)}
              >
                <MaterialIcons
                  name="people-alt"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.viewDetailsBtnText}>
                  عرض القائمة والمساهمين ({paidCount}/{totalUnits})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeClaimInvoiceBtnCompact}
                onPress={() => {
                  setClosingClaimId(claim.id);
                  setCloseClaimActualAmount(String(claim.target_amount));
                }}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={16}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.closeClaimInvoiceBtnCompactText}>
                  إغلاق بفاتورة
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
    )
  ) || null;
};
