import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import type { MainTab } from '../../domain/expenses.types';
import { styles } from '../TransparencyExpensesScreen.styles';

interface ExpensesTabSwitcherProps {
  activeMainTab: MainTab;
  setActiveMainTab: React.Dispatch<React.SetStateAction<MainTab>>;
}

export const ExpensesTabSwitcher: React.FC<ExpensesTabSwitcherProps> = ({
  activeMainTab,
  setActiveMainTab,
}) => {
  return (
    <View style={styles.mainTabsContainer}>
      <TouchableOpacity
        style={[
          styles.mainTabBtn,
          activeMainTab === 'expenses_feed' && styles.mainTabBtnActive,
        ]}
        onPress={() => setActiveMainTab('expenses_feed')}
      >
        <MaterialIcons
          name="receipt-long"
          size={18}
          color={activeMainTab === 'expenses_feed' ? COLORS.primary : COLORS.onSurfaceVariant}
        />
        <Text
          style={[
            styles.mainTabBtnText,
            activeMainTab === 'expenses_feed' && styles.mainTabBtnTextActive,
          ]}
        >
          المصروفات والفواتير
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.mainTabBtn,
          activeMainTab === 'treasury_ledger' && styles.mainTabBtnActive,
        ]}
        onPress={() => setActiveMainTab('treasury_ledger')}
      >
        <MaterialIcons
          name="account-balance-wallet"
          size={18}
          color={activeMainTab === 'treasury_ledger' ? COLORS.primary : COLORS.onSurfaceVariant}
        />
        <Text
          style={[
            styles.mainTabBtnText,
            activeMainTab === 'treasury_ledger' && styles.mainTabBtnTextActive,
          ]}
        >
          حركة الخزينة والسيولة
        </Text>
      </TouchableOpacity>
    </View>
  );
};
