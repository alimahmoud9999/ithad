import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

export const RoleSwitcherCard: React.FC = () => {
  const { currentRole, switchRole } = useAppStore();

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.iconBoxAmber}>
          <MaterialIcons
            name="swap-horiz"
            size={24}
            color={COLORS.statusUpcoming}
          />
        </View>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={styles.sectionTitle}>تبديل الحساب والدور (تجريبي)</Text>
          <Text style={styles.sectionSubtitle}>
            التبديل بين دور المدير والساكن لتجربة التفاعل
          </Text>
        </View>
      </View>

      <View style={styles.roleChipsRow}>
        <TouchableOpacity
          style={[
            styles.roleChip,
            currentRole === 'admin' && styles.roleChipActive,
          ]}
          onPress={() => switchRole('admin')}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={18}
            color={
              currentRole === 'admin' ? COLORS.primary : COLORS.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.roleChipText,
              currentRole === 'admin' && styles.roleChipTextActive,
            ]}
          >
            رئيس الاتحاد
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleChip,
            currentRole === 'resident' && styles.roleChipActive,
          ]}
          onPress={() => switchRole('resident')}
        >
          <MaterialIcons
            name="home"
            size={18}
            color={
              currentRole === 'resident'
                ? COLORS.primary
                : COLORS.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.roleChipText,
              currentRole === 'resident' && styles.roleChipTextActive,
            ]}
          >
            الساكن (شقة 302)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleChip,
            currentRole === 'super_admin' && styles.roleChipActive,
          ]}
          onPress={() => switchRole('super_admin')}
        >
          <MaterialIcons
            name="verified-user"
            size={18}
            color={
              currentRole === 'super_admin'
                ? COLORS.primary
                : COLORS.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.roleChipText,
              currentRole === 'super_admin' && styles.roleChipTextActive,
            ]}
          >
            إدارة المنصة
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
