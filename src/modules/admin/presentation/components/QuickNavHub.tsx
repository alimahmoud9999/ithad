import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { sendWhatsAppInvite } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../application/useAdminDashboardMetrics';
import { styles } from '../AdminDashboardScreen.styles';

interface QuickNavHubProps {
  onNavigateCommunity: (() => void) | undefined;
  onNavigateExpenses: () => void;
  onNavigateUnits: (() => void) | undefined;
}

export const QuickNavHub: React.FC<QuickNavHubProps> = ({
  onNavigateCommunity,
  onNavigateExpenses,
  onNavigateUnits,
}) => {
  const { currentBuilding } = useAppStore();
  const { activeIssuesCount, buildingApartments, unpaidApartments } = useAdminDashboardMetrics();

  return (
    <View style={styles.quickNavSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>أقسام الإدارة والخدمات السريعة</Text>
        <Text style={styles.sectionSubCount}>
          {buildingApartments.length} شقة مسجلة
        </Text>
      </View>

      <View style={styles.quickNavGrid}>
        {/* Card 1: Units & Obligations */}
        <TouchableOpacity
          style={styles.quickNavCard}
          onPress={onNavigateUnits}
          activeOpacity={0.7}
        >
          <View style={styles.quickNavIconBox}>
            <MaterialIcons
              name="meeting-room"
              size={22}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.quickNavCardTitle}>الوحدات والمديونيات</Text>
          <Text style={styles.quickNavCardSub}>
            {unpaidApartments.length > 0
              ? `${unpaidApartments.length} شقة عليها متأخرات`
              : 'جميع الشقق مسددة'}
          </Text>
        </TouchableOpacity>

        {/* Card 2: Treasury & Expenses */}
        <TouchableOpacity
          style={styles.quickNavCard}
          onPress={onNavigateExpenses}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.quickNavIconBox,
              { backgroundColor: 'rgba(0, 108, 73, 0.1)' },
            ]}
          >
            <MaterialIcons
              name="account-balance-wallet"
              size={22}
              color={COLORS.secondary}
            />
          </View>
          <Text style={styles.quickNavCardTitle}>الخزينة والمصروفات</Text>
          <Text style={styles.quickNavCardSub}>
            رصيد {currentBuilding.fund_balance.toLocaleString()} ج.م
          </Text>
        </TouchableOpacity>

        {/* Card 3: Community Hub */}
        <TouchableOpacity
          style={styles.quickNavCard}
          onPress={onNavigateCommunity}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.quickNavIconBox,
              { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
            ]}
          >
            <MaterialIcons
              name="how-to-vote"
              size={22}
              color="#2563EB"
            />
          </View>
          <Text style={styles.quickNavCardTitle}>مجتمع العمارة</Text>
          <Text style={styles.quickNavCardSub}>
            {activeIssuesCount > 0
              ? `${activeIssuesCount} بلاغ صيانة نشط`
              : 'لا توجد بلاغات معلقة'}
          </Text>
        </TouchableOpacity>

        {/* Card 4: WhatsApp Invite */}
        <TouchableOpacity
          style={styles.quickNavCard}
          onPress={() =>
            sendWhatsAppInvite({
              buildingName: currentBuilding.name,
              buildingCode: currentBuilding.building_code,
            })
          }
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.quickNavIconBox,
              { backgroundColor: 'rgba(37, 211, 102, 0.1)' },
            ]}
          >
            <MaterialIcons
              name="share"
              size={22}
              color="#25D366"
            />
          </View>
          <Text style={styles.quickNavCardTitle}>دعوة السكان (واتساب)</Text>
          <Text style={styles.quickNavCardSub}>
            كود: {currentBuilding.building_code}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
