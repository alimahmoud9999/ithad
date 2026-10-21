import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../ResidentHomeScreen.styles';

interface RecentExpensesSectionProps {
  onNavigateExpenses: () => void;
}

export const RecentExpensesSection: React.FC<RecentExpensesSectionProps> = ({
  onNavigateExpenses,
}) => {
  const { expenses } = useAppStore();

  return (
    <View style={styles.expensesSection}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.expensesSectionTitle}>أحدث مصروفات العقار</Text>
          <Text style={styles.expensesSectionSub}>الشفافية المالية المعتمدة للبرج</Text>
        </View>
        <TouchableOpacity
          style={styles.rowAlign}
          onPress={onNavigateExpenses}
        >
          <Text style={styles.viewAllExpensesLink}>عرض الكل</Text>
          <MaterialIcons name="chevron-left" size={18} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8, marginTop: 8 }}>
        {expenses.slice(0, 3).map((exp) => (
          <View key={exp.id} style={styles.expenseSnapshotCard}>
            <View style={styles.rowAlign}>
              <View style={styles.expenseIconBox}>
                <MaterialIcons name="receipt" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.expenseItemTitle}>{exp.title}</Text>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="verified" size={13} color={COLORS.secondary} />
                  <Text style={styles.expenseItemSub}>{(exp as any).category_display || (exp as any).category || 'فاتورة رسمية مدققة'}</Text>
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.expenseAmountText}>{exp.amount.toLocaleString()}</Text>
              <Text style={styles.expenseCurrencyText}>ج.م</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};
