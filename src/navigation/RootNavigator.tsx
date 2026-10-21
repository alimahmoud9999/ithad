import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useAppStore } from '../store/AppContext';
import { TopHeader } from '../components/ui/TopHeader';
import { AuthAndOnboardingScreen } from '../screens/auth/AuthAndOnboardingScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { ApartmentsUnitsScreen } from '../screens/admin/ApartmentsUnitsScreen';
import { ResidentHomeScreen } from '../screens/resident/ResidentHomeScreen';
import { TransparencyExpensesScreen } from '../screens/shared/TransparencyExpensesScreen';
import { CommunityHubScreen } from '../screens/shared/CommunityHubScreen';
import { SuperAdminScreen } from '../screens/superadmin/SuperAdminScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';

export type ActiveTabKey =
  | 'dashboard'
  | 'units'
  | 'community'
  | 'expenses'
  | 'settings'
  | 'super_admin';

/**
 * Role-based Navigation Shell matching the Bottom Navigation Bar in:
 * - design/stitch_/admin_dashboard/code.html
 * - design/stitch_/._302/code.html
 * Respects bottom safe area insets on Android (edge-to-edge / 3-button nav / gesture bar) and iOS Home indicator.
 */
export const RootNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { currentRole, isAuthenticated, setAuthenticated } = useAppStore();
  const [activeTab, setActiveTab] = useState<ActiveTabKey>('dashboard');

  const bottomSafePadding = Math.max(insets.bottom, 12);

  useEffect(() => {
    if (currentRole === 'super_admin') {
      setActiveTab('super_admin');
    } else {
      setActiveTab('dashboard');
    }
  }, [currentRole]);

  const renderMainScreen = () => {
    if (!isAuthenticated) {
      return (
        <AuthAndOnboardingScreen onClose={() => setAuthenticated(true)} />
      );
    }

    if (currentRole === 'super_admin') {
      if (activeTab === 'expenses') {
        return <TransparencyExpensesScreen />;
      }
      if (activeTab === 'settings') {
        return <SettingsScreen onNavigateTab={(tab) => setActiveTab(tab)} />;
      }
      return <SuperAdminScreen />;
    }

    if (currentRole === 'resident') {
      if (activeTab === 'community') {
        return <CommunityHubScreen />;
      }
      if (activeTab === 'expenses') {
        return <TransparencyExpensesScreen />;
      }
      if (activeTab === 'settings') {
        return <SettingsScreen onNavigateTab={(tab) => setActiveTab(tab)} />;
      }
      return (
        <ResidentHomeScreen
          onNavigateExpenses={() => setActiveTab('expenses')}
        />
      );
    }

    // Admin Role
    switch (activeTab) {
      case 'units':
        return <ApartmentsUnitsScreen />;
      case 'community':
        return <CommunityHubScreen />;
      case 'expenses':
        return <TransparencyExpensesScreen />;
      case 'settings':
        return <SettingsScreen onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'dashboard':
      default:
        return (
          <AdminDashboardScreen
            onNavigateExpenses={() => setActiveTab('expenses')}
            onNavigateSettings={() => setActiveTab('settings')}
            onNavigateUnits={() => setActiveTab('units')}
            onNavigateCommunity={() => setActiveTab('community')}
          />
        );
    }
  };

  return (
    <View style={styles.rootContainer}>
      <TopHeader />

      <View
        style={[
          styles.contentArea,
          !isAuthenticated && { paddingBottom: bottomSafePadding },
        ]}
      >
        {renderMainScreen()}
      </View>

      {/* Bottom Tab Bar (Matches design/stitch_/admin_dashboard/code.html & ._302/code.html) */}
      {isAuthenticated && (
        <View
          style={[
            styles.bottomNav,
            {
              paddingBottom: bottomSafePadding,
              minHeight: 62 + bottomSafePadding,
            },
          ]}
        >
          {currentRole === 'admin' && (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('dashboard')}
              >
                <MaterialIcons
                  name="dashboard"
                  size={22}
                  color={
                    activeTab === 'dashboard'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'dashboard' && styles.navLabelActive,
                  ]}
                >
                  الرئيسية
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('community')}
              >
                <MaterialIcons
                  name="how-to-vote"
                  size={22}
                  color={
                    activeTab === 'community'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'community' && styles.navLabelActive,
                  ]}
                >
                  مجتمع العمارة
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('units')}
              >
                <MaterialIcons
                  name="meeting-room"
                  size={22}
                  color={
                    activeTab === 'units'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'units' && styles.navLabelActive,
                  ]}
                >
                  الوحدات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('expenses')}
              >
                <MaterialIcons
                  name="account-balance-wallet"
                  size={22}
                  color={
                    activeTab === 'expenses'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'expenses' && styles.navLabelActive,
                  ]}
                >
                  المصروفات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('settings')}
              >
                <MaterialIcons
                  name="settings"
                  size={22}
                  color={
                    activeTab === 'settings'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'settings' && styles.navLabelActive,
                  ]}
                >
                  الإعدادات
                </Text>
              </TouchableOpacity>
            </>
          )}

          {currentRole === 'resident' && (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('dashboard')}
              >
                <MaterialIcons
                  name="home"
                  size={23}
                  color={
                    activeTab === 'dashboard'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'dashboard' && styles.navLabelActive,
                  ]}
                >
                  الرئيسية والسداد
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('community')}
              >
                <MaterialIcons
                  name="how-to-vote"
                  size={23}
                  color={
                    activeTab === 'community'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'community' && styles.navLabelActive,
                  ]}
                >
                  مجتمع العمارة
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('expenses')}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={23}
                  color={
                    activeTab === 'expenses'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'expenses' && styles.navLabelActive,
                  ]}
                >
                  المصروفات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('settings')}
              >
                <MaterialIcons
                  name="settings"
                  size={23}
                  color={
                    activeTab === 'settings'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'settings' && styles.navLabelActive,
                  ]}
                >
                  الإعدادات
                </Text>
              </TouchableOpacity>
            </>
          )}

          {currentRole === 'super_admin' && (
            <>
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('super_admin')}
              >
                <MaterialIcons
                  name="verified-user"
                  size={22}
                  color={
                    activeTab === 'super_admin'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'super_admin' && styles.navLabelActive,
                  ]}
                >
                  إدارة المنصة والباقات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('expenses')}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={22}
                  color={
                    activeTab === 'expenses'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'expenses' && styles.navLabelActive,
                  ]}
                >
                  معاينة الشفافية والمصروفات
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navItem}
                onPress={() => setActiveTab('settings')}
              >
                <MaterialIcons
                  name="settings"
                  size={22}
                  color={
                    activeTab === 'settings'
                      ? COLORS.primary
                      : COLORS.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.navLabel,
                    activeTab === 'settings' && styles.navLabelActive,
                  ]}
                >
                  الإعدادات
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  contentArea: {
    flex: 1,
  },
  bottomNav: {
    paddingTop: 8,
    backgroundColor: COLORS.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    flex: 1,
    gap: 2,
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
    textAlign: 'center',
  },
  navLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
