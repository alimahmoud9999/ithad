import React from 'react';
import { Modal, TouchableOpacity, View, Text } from 'react-native';
import type { useEditObligationForm } from '../../application/useEditObligationForm';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface YearPickerModalProps {
  obligationYear: number;
  setObligationYear: React.Dispatch<React.SetStateAction<number>>;
  setYearPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  yearPickerVisible: boolean;
  yearPickerTarget: 'add_unit' | 'arrears_modal' | 'edit_obl';
  arrearsModalYear: number;
  setArrearsModalYear: React.Dispatch<React.SetStateAction<number>>;
  editOblForm: ReturnType<typeof useEditObligationForm>;
}

export const YearPickerModal: React.FC<YearPickerModalProps> = ({
  obligationYear,
  setObligationYear,
  setYearPickerVisible,
  yearPickerVisible,
  yearPickerTarget,
  arrearsModalYear,
  setArrearsModalYear,
  editOblForm,
}) => {
  const { editOblYear, setEditOblYear } = editOblForm;

  return (
    <Modal
      visible={yearPickerVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setYearPickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalBackdropDark}
        activeOpacity={1}
        onPress={() => setYearPickerVisible(false)}
      >
        <View style={styles.yearPickerSheet}>
          <View style={styles.sheetGrabBar} />
          <Text style={styles.yearPickerSheetTitle}>اختر السنة المالية</Text>
          <View style={styles.yearChoicesGrid}>
            {[2023, 2024, 2025, 2026, 2027, 2028].map((yr) => {
              const currentYr =
                yearPickerTarget === 'add_unit'
                  ? obligationYear
                  : yearPickerTarget === 'edit_obl'
                  ? editOblYear
                  : arrearsModalYear;
              const isSelected = currentYr === yr;
              return (
                <TouchableOpacity
                  key={yr}
                  style={[styles.yearChoiceCard, isSelected && styles.yearChoiceCardActive]}
                  onPress={() => {
                    if (yearPickerTarget === 'add_unit') {
                      setObligationYear(yr);
                    } else if (yearPickerTarget === 'edit_obl') {
                      setEditOblYear(yr);
                    } else {
                      setArrearsModalYear(yr);
                    }
                    setYearPickerVisible(false);
                  }}
                >
                  <Text style={[styles.yearChoiceCardText, isSelected && styles.yearChoiceCardTextActive]}>
                    {yr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
