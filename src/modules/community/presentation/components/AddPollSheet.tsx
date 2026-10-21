import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../CommunityHubScreen.styles';

interface AddPollSheetProps {
  isAddPollModalOpen: boolean;
  setIsAddPollModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AddPollSheet: React.FC<AddPollSheetProps> = ({
  isAddPollModalOpen,
  setIsAddPollModalOpen,
}) => {
  const { createBuildingPoll } = useAppStore();

  // New Poll Form State (Admin)
  const [newPollTitle, setNewPollTitle] = useState('');

  const [newPollDesc, setNewPollDesc] = useState('');

  const [newPollCategory, setNewPollCategory] = useState('أمني وعقاري');

  const [newPollEstimatedCost, setNewPollEstimatedCost] = useState('');

  const [newPollSharePerUnit, setNewPollSharePerUnit] = useState('');

  const [newPollDurationDays, setNewPollDurationDays] = useState('7');

  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);

  // Handlers for Poll Creation (Admin)
  const handleSavePoll = async () => {
    if (!newPollTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان القرار أو موضوع الاستطلاع.');
      return;
    }

    try {
      setIsSubmittingPoll(true);
      const cost = parseFloat(newPollEstimatedCost) || 0;
      const share = parseFloat(newPollSharePerUnit) || 0;
      const days = parseInt(newPollDurationDays, 10) || 7;

      await createBuildingPoll({
        title: newPollTitle.trim(),
        description: newPollDesc.trim() || undefined,
        category: newPollCategory,
        estimatedCost: cost,
        sharePerUnit: share,
        durationDays: days,
        quorumPercent: 51,
        options: [
          { id: 'approve', title: 'موافق على القرار والعرض المقترح' },
          { id: 'reject', title: 'معترض أو متحفظ على القرار' },
          { id: 'abstain', title: 'ممتنع عن التصويت' },
        ],
      });

      Alert.alert('تم طرح التصويت بنجاح 🗳️', 'تم بث التنبيه لجميع سكان العمارة للمشاركة بأصوات وحداتهم.');
      setIsAddPollModalOpen(false);
      setNewPollTitle('');
      setNewPollDesc('');
      setNewPollEstimatedCost('');
      setNewPollSharePerUnit('');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر طرح التصويت.');
    } finally {
      setIsSubmittingPoll(false);
    }
  };

  return (
    <BottomSheetModal
      visible={isAddPollModalOpen}
      onClose={() => setIsAddPollModalOpen(false)}
      title="طرح قرار أو تصويت جديد 🗳️"
    >
      <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.fieldLabel}>عنوان القرار أو موضوع الاستطلاع *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="مثال: تركيب منظومة كاميرات مراقبة حديثة للمداخل والمصعد"
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={newPollTitle}
          onChangeText={setNewPollTitle}
          textAlign="right"
        />

        <Text style={styles.fieldLabel}>تصنيف القرار</Text>
        <TextInput
          style={styles.textInput}
          placeholder="مثال: قرار أمني وعقاري، ترشيد واستهلاك، تطوير الواجهة"
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={newPollCategory}
          onChangeText={setNewPollCategory}
          textAlign="right"
        />

        <View style={styles.twoInputsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>التكلفة التقديرية (ج.م)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="12,000"
              placeholderTextColor={COLORS.onSurfaceVariant}
              keyboardType="numeric"
              value={newPollEstimatedCost}
              onChangeText={setNewPollEstimatedCost}
              textAlign="right"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>حصة الشقة (ج.م)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="750"
              placeholderTextColor={COLORS.onSurfaceVariant}
              keyboardType="numeric"
              value={newPollSharePerUnit}
              onChangeText={setNewPollSharePerUnit}
              textAlign="right"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>مدة التصويت (بالأيام)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="7"
          placeholderTextColor={COLORS.onSurfaceVariant}
          keyboardType="numeric"
          value={newPollDurationDays}
          onChangeText={setNewPollDurationDays}
          textAlign="right"
        />

        <Text style={styles.fieldLabel}>التفاصيل والمواصفات المقترحة</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="توضيح تفاصيل العرض، الشركات المتقدمة، شروط الضمان ومدة التنفيذ..."
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={newPollDesc}
          onChangeText={setNewPollDesc}
          multiline
          numberOfLines={4}
          textAlign="right"
        />

        <TouchableOpacity
          style={styles.modalSubmitBtn}
          onPress={handleSavePoll}
          disabled={isSubmittingPoll}
          activeOpacity={0.88}
        >
          {isSubmittingPoll ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialIcons name="how-to-vote" size={20} color="#FFFFFF" />
              <Text style={styles.modalSubmitBtnText}>
                اعتماد وبث التصويت للجمعية العمومية
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};
