import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../NotificationCenterModal.styles';

export const NotificationActionBar: React.FC = () => {
  const { markAllNotificationsAsRead, unreadNotificationsCount } = useAppStore();

  return (
    <View style={styles.topActionBar}>
      <View style={styles.unreadCountSide}>
        <View style={styles.pulsingRedDot} />
        <Text style={styles.sectionHeaderLabel}>سجل الإشعارات</Text>
        <View style={styles.newCountPill}>
          <Text style={styles.newCountPillText}>
            {unreadNotificationsCount} جديد
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.markAllReadBtn}
        onPress={markAllNotificationsAsRead}
      >
        <MaterialIcons name="done-all" size={16} color={COLORS.secondary} />
        <Text style={styles.markAllReadText}>تحديد الكل كمقروء</Text>
      </TouchableOpacity>
    </View>
  );
};
