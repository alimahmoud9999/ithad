import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SuperAdminScreen.styles';

interface PlanTemplatesTabProps {
  activeSubTab: 'activations' | 'buildings' | 'plans';
}

export const PlanTemplatesTab: React.FC<PlanTemplatesTabProps> = ({
  activeSubTab,
}) => {
  const { plans, superAdminUpdatePlanTemplate } = useAppStore();

  return (
    activeSubTab === 'plans' && (
    <View style={{ gap: 12 }}>
      {plans.map((plan) => (
        <View key={plan.code} style={styles.configCard}>
          <View style={styles.configCardHeader}>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.configCardTitle}>{plan.name_ar}</Text>
              <Text style={styles.configCardSub}>
                {plan.description_ar}
              </Text>
            </View>
            <View style={styles.planCodeTag}>
              <Text style={styles.planCodeTagText}>
                {plan.code.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.fieldLabel}>
                السعر الشهري الافتراضي (ج.م)
              </Text>
              <TextInput
                style={styles.input}
                value={String(plan.default_monthly_price)}
                keyboardType="numeric"
                onChangeText={(txt) =>
                  superAdminUpdatePlanTemplate(plan.code, {
                    default_monthly_price: parseFloat(txt) || 0,
                  })
                }
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.fieldLabel}>الحد الأقصى للشقق</Text>
              <TextInput
                style={styles.input}
                value={String(plan.max_apartments)}
                keyboardType="numeric"
                onChangeText={(txt) =>
                  superAdminUpdatePlanTemplate(plan.code, {
                    max_apartments: parseInt(txt, 10) || 10,
                  })
                }
              />
            </View>
          </View>
        </View>
      ))}
    </View>
    )
  ) || null;
};
