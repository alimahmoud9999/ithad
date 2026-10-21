import React from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useEditUnitForm } from '../../application/useEditUnitForm';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface EditUnitModalProps {
  editUnitForm: ReturnType<typeof useEditUnitForm>;
}

export const EditUnitModal: React.FC<EditUnitModalProps> = ({
  editUnitForm,
}) => {
  const { addApartmentObligation, updateApartmentUnit } = useAppStore();
  const { editAddArrears, editAptNumber, editAreaSqm, editArrearsTitle, editFloorNumber, editingApt, editModalVisible, editOrientation, editResidentName, editResidentPhone, setEditAddArrears, setEditAptNumber, setEditAreaSqm, setEditArrearsTitle, setEditFloorNumber, setEditingApt, setEditModalVisible, setEditOrientation, setEditResidentName, setEditResidentPhone } = editUnitForm;

  // Handle Edit Submit
  const handleEditUnitSubmit = async () => {
    if (!editingApt) return;
    try {
      await updateApartmentUnit(editingApt.id, {
        apartmentNumber: editAptNumber.trim(),
        floorNumber: editFloorNumber.trim(),
        residentName: editResidentName.trim() || 'وحدة شاغرة',
        residentPhone: editResidentPhone.trim(),
        areaSqm: parseFloat(editAreaSqm) || editingApt.area_sqm,
        wingOrDirection: editOrientation,
      });

      // If arrears were also added during edit:
      const arrearsToAdd = parseFloat(editAddArrears) || 0;
      if (arrearsToAdd > 0) {
        await addApartmentObligation({
          apartmentId: editingApt.id,
          apartmentNumber: editAptNumber.trim() || editingApt.apartment_number,
          title: editArrearsTitle.trim() || 'مديونية مسجلة من إدارة الاتحاد',
          amount: arrearsToAdd,
          billingMonth: new Date().toISOString().slice(0, 7),
          notes: 'إضافة مديونية أثناء تعديل ملف الشقة',
        });
      }

      setEditModalVisible(false);
      setEditingApt(null);
      setEditAddArrears('');
      Alert.alert(
        'تم الحفظ بنجاح 👍',
        `تم تحديث بيانات شقة (${editAptNumber.trim()}) بنجاح.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل بيانات الوحدة');
    }
  };

  return (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setEditModalVisible(false)}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>تعديل بيانات الشقة {editAptNumber}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>تعديل بيانات الوحدة والموقع</Text>

          <View style={styles.twoColumnGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>رقم الشقة *</Text>
              <TextInput
                style={[styles.textInputField, styles.codeFieldStyle]}
                value={editAptNumber}
                onChangeText={setEditAptNumber}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>الطابق / الدور</Text>
              <TextInput
                style={styles.textInputField}
                value={editFloorNumber}
                onChangeText={setEditFloorNumber}
              />
            </View>
          </View>

          <View style={styles.twoColumnGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>المساحة (م²)</Text>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={editAreaSqm}
                onChangeText={setEditAreaSqm}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>نوع الواجهة</Text>
              <View style={styles.rowAlign}>
                {(['واجهة', 'بحري', 'قبلي'] as const).map((dir) => (
                  <TouchableOpacity
                    key={dir}
                    style={[
                      styles.dirChoicePill,
                      editOrientation === dir && styles.dirChoicePillActive,
                    ]}
                    onPress={() => setEditOrientation(dir)}
                  >
                    <Text
                      style={[
                        styles.dirChoiceText,
                        editOrientation === dir && styles.dirChoiceTextActive,
                      ]}
                    >
                      {dir}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>بيانات الساكن / المالك</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>اسم الساكن / المالك</Text>
            <TextInput
              style={styles.textInputField}
              value={editResidentName}
              onChangeText={setEditResidentName}
              placeholder="اسم الساكن أو مالك الوحدة"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم الهاتف</Text>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={editResidentPhone}
              onChangeText={setEditResidentPhone}
              keyboardType="phone-pad"
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Arrears Addition During Edit */}
        <View style={styles.formSectionCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionHeaderTitle}>إضافة مديونية / التزام مالي على الشقة</Text>
            <Text style={styles.optionalTagText}>اختياري</Text>
          </View>
          <Text style={styles.inputHelpSubText}>
            المديونية الحالية المسجلة: {editingApt?.arrears_amount || editingApt?.unpaid_amount || 0} ج.م
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>المبلغ المراد إضافته (ج.م)</Text>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={editAddArrears}
              onChangeText={setEditAddArrears}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          {editAddArrears && parseFloat(editAddArrears) > 0 ? (
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>بند أو سبب المديونية</Text>
              <TextInput
                style={styles.textInputField}
                value={editArrearsTitle}
                onChangeText={setEditArrearsTitle}
                placeholder="مثال: اشتراك متأخر أو صيانة مصعد"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleEditUnitSubmit}
        >
          <MaterialIcons name="save" size={20} color={COLORS.onPrimary} />
          <Text style={styles.primaryActionText}>حفظ كافة التعديلات والمديونية</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
};
