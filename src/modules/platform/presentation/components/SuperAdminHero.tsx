import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SuperAdminScreen.styles';

interface SuperAdminHeroProps {
  activeSubTab: 'activations' | 'buildings' | 'plans';
  setActiveSubTab: React.Dispatch<React.SetStateAction<'activations' | 'buildings' | 'plans'>>;
}

export const SuperAdminHero: React.FC<SuperAdminHeroProps> = ({
  activeSubTab,
  setActiveSubTab,
}) => {
  const { buildings, subscriptionInvoices } = useAppStore();

  return (
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
  );
};
