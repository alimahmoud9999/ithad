import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { styles } from '../AdminDashboardScreen.styles';

interface QuickActionsSheetProps {
  quickActionsModalVisible: boolean;
  setQuickActionsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setExpenseModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setEmergencyModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  handleBulkReminder: () => Promise<void>;
}

export const QuickActionsSheet: React.FC<QuickActionsSheetProps> = ({
  quickActionsModalVisible,
  setQuickActionsModalVisible,
  setExpenseModalVisible,
  setEmergencyModalVisible,
  handleBulkReminder,
}) => {
  return (
    <BottomSheetModal
      visible={quickActionsModalVisible}
      title="إجراء وإضافة سريعة ⚡"
      subtitle="اختر العملية التي ترغب في تنفيذها الآن"
      onClose={() => setQuickActionsModalVisible(false)}
    >
      <View style={styles.quickActionsModalList}>
        {/* Action 1: Add Expense */}
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => {
            setQuickActionsModalVisible(false);
            setExpenseModalVisible(true);
          }}
        >
          <View style={styles.quickActionCardArrow}>
            <MaterialIcons
              name="chevron-left"
              size={22}
              color={COLORS.secondary}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
            <View style={styles.quickActionCardTitleRow}>
              <View style={styles.quickActionGreenBadge}>
                <Text style={styles.quickActionGreenBadgeText}>
                  خصم من الخزينة
                </Text>
              </View>
              <Text style={styles.quickActionCardTitle}>
                إضافة مصروف جديد 💸
              </Text>
            </View>
            <Text style={styles.quickActionCardDesc}>
              تسجيل فاتورة صيانة، كهرباء، مصاعد، أو نظافة وخصمها رسمياً من رصيد
              الخزينة مع حفظ صورة الفاتورة.
            </Text>
          </View>
          <View
            style={[
              styles.quickActionCardIcon,
              { backgroundColor: 'rgba(0, 108, 73, 0.1)' },
            ]}
          >
            <MaterialIcons
              name="post-add"
              size={26}
              color={COLORS.secondary}
            />
          </View>
        </TouchableOpacity>

        {/* Action 2: New Emergency Claim */}
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => {
            setQuickActionsModalVisible(false);
            setEmergencyModalVisible(true);
          }}
        >
          <View style={styles.quickActionCardArrow}>
            <MaterialIcons
              name="chevron-left"
              size={22}
              color={COLORS.error}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
            <View style={styles.quickActionCardTitleRow}>
              <View style={styles.quickActionRedBadge}>
                <Text style={styles.quickActionRedBadgeText}>عطل طارئ</Text>
              </View>
              <Text style={styles.quickActionCardTitle}>طوارئ جديدة 🚨</Text>
            </View>
            <Text style={styles.quickActionCardDesc}>
              إطلاق مطالبة فورية لعطل مصعد أو موتور، وتقسيم المبلغ تلقائياً على
              الشقق مع إشعار فوري لجميع السكان.
            </Text>
          </View>
          <View
            style={[
              styles.quickActionCardIcon,
              { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
            ]}
          >
            <MaterialIcons
              name="emergency"
              size={26}
              color={COLORS.error}
            />
          </View>
        </TouchableOpacity>

        {/* Action 3: Bulk Unpaid Reminder */}
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => {
            setQuickActionsModalVisible(false);
            handleBulkReminder();
          }}
        >
          <View style={styles.quickActionCardArrow}>
            <MaterialIcons
              name="chevron-left"
              size={22}
              color="#B45309"
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
            <View style={styles.quickActionCardTitleRow}>
              <View style={styles.quickActionAmberBadge}>
                <Text style={styles.quickActionAmberBadgeText}>
                  إشعار Push فوري
                </Text>
              </View>
              <Text style={styles.quickActionCardTitle}>تذكير الكل بالسداد 🔔</Text>
            </View>
            <Text style={styles.quickActionCardDesc}>
              إرسال تنبيه Push فوري بضغطة زر واحدة لكافة الشقق التي لم تسدد
              اشتراك الشهر الحالي.
            </Text>
          </View>
          <View
            style={[
              styles.quickActionCardIcon,
              { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
            ]}
          >
            <MaterialIcons
              name="campaign"
              size={26}
              color="#B45309"
            />
          </View>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
