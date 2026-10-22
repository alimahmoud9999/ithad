import React from 'react';
import { TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from '../AdminDashboardScreen.styles';

interface QuickActionFabProps {
  setQuickActionsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const QuickActionFab: React.FC<QuickActionFabProps> = ({
  setQuickActionsModalVisible,
}) => {
  return (
    <TouchableOpacity
      style={styles.floatingFab}
      onPress={() => setQuickActionsModalVisible(true)}
      activeOpacity={0.85}
    >
      <MaterialIcons name="add" size={30} color="#FFFFFF" />
    </TouchableOpacity>
  );
};
