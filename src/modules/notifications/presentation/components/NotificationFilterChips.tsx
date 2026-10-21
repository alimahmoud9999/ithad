import React, { useMemo } from 'react';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { FilterKey } from '../../domain/notifications.types';
import { styles } from '../NotificationCenterModal.styles';

interface NotificationFilterChipsProps {
  activeFilter: FilterKey;
  setActiveFilter: React.Dispatch<React.SetStateAction<FilterKey>>;
}

export const NotificationFilterChips: React.FC<NotificationFilterChipsProps> = ({
  activeFilter,
  setActiveFilter,
}) => {
  const { currentRoleNotifications } = useAppStore();

  const counts = useMemo(() => {
    return {
      all: currentRoleNotifications.length,
      financial: currentRoleNotifications.filter(
        (n) => n.category === 'financial'
      ).length,
      join_request: currentRoleNotifications.filter(
        (n) => n.category === 'join_request'
      ).length,
      maintenance: currentRoleNotifications.filter(
        (n) => n.category === 'maintenance'
      ).length,
    };
  }, [currentRoleNotifications]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsScrollRow}
    >
      <TouchableOpacity
        onPress={() => setActiveFilter('all')}
        style={[
          styles.filterChip,
          activeFilter === 'all' && styles.filterChipActive,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            activeFilter === 'all' && styles.filterChipTextActive,
          ]}
        >
          الكل ({counts.all})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setActiveFilter('financial')}
        style={[
          styles.filterChip,
          activeFilter === 'financial' && styles.filterChipActive,
        ]}
      >
        <MaterialIcons
          name="payments"
          size={15}
          color={
            activeFilter === 'financial' ? COLORS.onPrimary : COLORS.secondary
          }
        />
        <Text
          style={[
            styles.filterChipText,
            activeFilter === 'financial' && styles.filterChipTextActive,
          ]}
        >
          مالية واشتراكات ({counts.financial})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setActiveFilter('join_request')}
        style={[
          styles.filterChip,
          activeFilter === 'join_request' && styles.filterChipActive,
        ]}
      >
        <MaterialIcons
          name="person-add"
          size={15}
          color={
            activeFilter === 'join_request'
              ? COLORS.onPrimary
              : COLORS.statusPending
          }
        />
        <Text
          style={[
            styles.filterChipText,
            activeFilter === 'join_request' && styles.filterChipTextActive,
          ]}
        >
          طلبات الانضمام ({counts.join_request})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setActiveFilter('maintenance')}
        style={[
          styles.filterChip,
          activeFilter === 'maintenance' && styles.filterChipActive,
        ]}
      >
        <MaterialIcons
          name="construction"
          size={15}
          color={
            activeFilter === 'maintenance'
              ? COLORS.onPrimary
              : COLORS.statusUpcoming
          }
        />
        <Text
          style={[
            styles.filterChipText,
            activeFilter === 'maintenance' && styles.filterChipTextActive,
          ]}
        >
          صيانة وطوارئ ({counts.maintenance})
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
