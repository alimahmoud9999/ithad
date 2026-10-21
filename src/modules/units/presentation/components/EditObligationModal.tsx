import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useEditObligationForm } from '../../application/useEditObligationForm';
import { MONTHS_CHOICES } from '../../domain/units.constants';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface EditObligationModalProps {
  setYearPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setYearPickerTarget: React.Dispatch<React.SetStateAction<'add_unit' | 'arrears_modal' | 'edit_obl'>>;
  editOblForm: ReturnType<typeof useEditObligationForm>;
}

export const EditObligationModal: React.FC<EditObligationModalProps> = ({
  setYearPickerVisible,
  setYearPickerTarget,
  editOblForm,
}) => {
  const { updateApartmentObligation } = useAppStore();
  const { editingObl, editOblAmount, editOblModalVisible, editOblMonth, editOblNotes, editOblTitle, editOblYear, setEditingObl, setEditOblAmount, setEditOblModalVisible, setEditOblMonth, setEditOblNotes, setEditOblTitle } = editOblForm;

  const [isEditingOblLoading, setIsEditingOblLoading] = useState(false);

  // Save changes to registered obligation
  const handleSaveEditObligationSubmit = async () => {
    if (!editingObl) return;
    const amount = parseFloat(editOblAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من صفر.');
      return;
    }
    if (!editOblTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم أو وصف بند المديونية.');
      return;
    }

    try {
      setIsEditingOblLoading(true);
      const billingMonth = `${editOblYear}-${String(editOblMonth).padStart(2, '0')}`;
      await updateApartmentObligation(editingObl.id, {
        title: editOblTitle.trim(),
        amount,
        billingMonth,
        notes: editOblNotes.trim() || undefined,
      });

      setEditOblModalVisible(false);
      setEditingObl(null);
      Alert.alert('تم التعديل بنجاح ✅', 'تم تحديث بيانات المديونية ورصيد الشقة.');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل المديونية.');
    } finally {
      setIsEditingOblLoading(false);
    }
  };

  return (
    <Modal
      visible={editOblModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        if (!isEditingOblLoading) setEditOblModalVisible(false);
      }}
    >
      <View style={styles.modalBackdropDark}>
        <View style={[styles.bottomSheetPanel, { maxHeight: '90%' }]}>
          <View style={styles.sheetGrabBar} />

          {/* Header */}
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={[styles.successIconCircle, { backgroundColor: '#2563EB' }]}>
                <MaterialIcons name="edit" size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.inviteModalTitle}>تعديل بند المديونية</Text>
                <Text style={styles.inviteModalSub}>
                  تعديل القيمة، الشهر أو وصف الالتزام المسجل
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!isEditingOblLoading) setEditOblModalVisible(false);
              }}
            >
              <MaterialIcons name="close" size={22} color={COLORS.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
            {/* Obligation Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>اسم / وصف البند *</Text>
              <TextInput
                style={styles.textInputField}
                value={editOblTitle}
                onChangeText={setEditOblTitle}
                placeholder="مثال: اشتراك شهر 6، صيانة مصعد"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            {/* Amount and Year */}
            <View style={styles.inputsRowAligned}>
              <View style={{ flex: 1.6 }}>
                <Text style={styles.alignedFieldLabel}>المبلغ المستحق (ج.م) *</Text>
                <TextInput
                  style={[styles.alignedTextInput, styles.ltrField]}
                  value={editOblAmount}
                  onChangeText={setEditOblAmount}
                  keyboardType="numeric"
                  placeholder="400"
                  placeholderTextColor={COLORS.outline}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.alignedFieldLabel}>السنة *</Text>
                <TouchableOpacity
                  style={styles.yearPickerButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setYearPickerTarget('edit_obl');
                    setYearPickerVisible(true);
                  }}
                >
                  <MaterialIcons name="calendar-today" size={15} color="#475569" />
                  <Text style={styles.yearPickerText}>{editOblYear}</Text>
                  <MaterialIcons name="arrow-drop-down" size={20} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Month Pills */}
            <View>
              <Text style={[styles.alignedFieldLabel, { marginBottom: 6 }]}>
                عن شهر (اختر من 1 إلى 12):
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthScrollRow}
              >
                {MONTHS_CHOICES.map((m) => {
                  const isSelected = editOblMonth === m.num;
                  return (
                    <TouchableOpacity
                      key={m.num}
                      style={[
                        styles.monthSquarePill,
                        isSelected && styles.monthSquarePillActive,
                      ]}
                      onPress={() => setEditOblMonth(m.num)}
                    >
                      <Text
                        style={[
                          styles.monthSquareNumber,
                          isSelected && styles.monthSquareNumberActive,
                        ]}
                      >
                        {m.num}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>ملاحظات إضافية (اختياري)</Text>
              <TextInput
                style={[styles.textInputField, { height: 60 }]}
                value={editOblNotes}
                onChangeText={setEditOblNotes}
                placeholder="أي ملاحظات تتعلق بالسداد أو أسباب المديونية..."
                placeholderTextColor={COLORS.outline}
                multiline
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                { backgroundColor: '#2563EB', marginTop: 8 },
                isEditingOblLoading && { opacity: 0.6 },
              ]}
              activeOpacity={0.88}
              disabled={isEditingOblLoading}
              onPress={handleSaveEditObligationSubmit}
            >
              {isEditingOblLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>حفظ التعديلات</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
