import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { styles } from '../AdminDashboardScreen.styles';

interface CompactAddBarProps {
  setQuickActionsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CompactAddBar: React.FC<CompactAddBarProps> = ({
  setQuickActionsModalVisible,
}) => {
  return (
    <View style={styles.compactAddBar}>
      <TouchableOpacity
        style={styles.compactAddBarBtn}
        onPress={() => setQuickActionsModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.compactAddBarBadge}>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.compactAddBarBadgeText}>3 إجراءات</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
          <Text style={styles.compactAddBarTitle}>+ إجراء سريع جديد ⚡</Text>
          <Text style={styles.compactAddBarSub}>
            إضافة مصروف • مطالبة طوارئ • تذكير جماعي
          </Text>
        </View>
        <View style={styles.compactAddBarIconBox}>
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};
