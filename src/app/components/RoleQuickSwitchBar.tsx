import React from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { UserRole } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../TopHeader.styles';

export const RoleQuickSwitchBar: React.FC = () => {
  const { currentRole, isAuthenticated, switchRole } = useAppStore();

  const roles: Array<{
    key: UserRole;
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
  }> = [
    { key: 'admin', label: 'رئيس الاتحاد', icon: 'admin-panel-settings' },
    { key: 'resident', label: 'الساكن (شقة 302)', icon: 'home' },
    { key: 'super_admin', label: 'مالك التطبيق (Super)', icon: 'verified-user' },
  ];

  return (
    isAuthenticated && currentRole === 'super_admin' && (
    <View style={styles.roleBar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rolePillsScroll}
      >
        <Text style={styles.roleBarHint}>المعاينة:</Text>
        {roles.map((r) => {
          const active = currentRole === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => switchRole(r.key)}
              style={[styles.rolePill, active && styles.rolePillActive]}
            >
              <MaterialIcons
                name={r.icon}
                size={14}
                color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.rolePillText,
                  active && styles.rolePillTextActive,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
    )
  ) || null;
};
