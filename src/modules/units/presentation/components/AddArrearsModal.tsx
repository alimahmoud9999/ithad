import React from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useArrearsForm } from '../../application/useArrearsForm';
import { MONTHS_CHOICES } from '../../domain/units.constants';
import type { StagedObligation } from '../../domain/units.types';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface AddArrearsModalProps {
  setYearPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setYearPickerTarget: React.Dispatch<React.SetStateAction<'add_unit' | 'arrears_modal' | 'edit_obl'>>;
  arrearsModalYear: number;
  arrearsForm: ReturnType<typeof useArrearsForm>;
}

export const AddArrearsModal: React.FC<AddArrearsModalProps> = ({
  setYearPickerVisible,
  setYearPickerTarget,
  arrearsModalYear,
  arrearsForm,
}) => {
  const { addApartmentObligation, currentBuilding } = useAppStore();
  const { arrearsAmountInput, arrearsCustomTitleInput, arrearsModalType, arrearsModalVisible, arrearsMonthNum, arrearsNotesInput, arrearsTargetApt, modalStagedObligations, setArrearsAmountInput, setArrearsCustomTitleInput, setArrearsModalType, setArrearsModalVisible, setArrearsMonthNum, setArrearsNotesInput, setArrearsTargetApt, setModalStagedObligations } = arrearsForm;

  const handleAddModalStagedObligation = () => {
    const amount = parseFloat(arrearsAmountInput);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى كتابة مبلغ المديونية بشكل صحيح.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === arrearsMonthNum);
    const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${arrearsMonthNum}`;

    let title = '';
    if (arrearsModalType === 'monthly_dues') {
      title = `اشتراك العمارة (${monthLabel} ${currentYear})`;
    } else {
      if (!arrearsCustomTitleInput.trim()) {
        Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
        return;
      }
      title = `${arrearsCustomTitleInput.trim()} (${monthLabel} ${currentYear})`;
    }

    const newItem: StagedObligation = {
      id: 'mstg-' + Date.now() + Math.floor(Math.random() * 1000),
      type: arrearsModalType,
      title,
      amount,
      month: arrearsMonthNum,
      year: currentYear,
    };

    setModalStagedObligations((prev) => [...prev, newItem]);
    setArrearsCustomTitleInput('');
    setArrearsMonthNum((prev) => (prev < 12 ? prev + 1 : 1));
  };

  const handleRemoveModalStagedObligation = (id: string) => {
    setModalStagedObligations((prev) => prev.filter((o) => o.id !== id));
  };

  // Handle Add Arrears Submit (Handles both staged items or single active item!)
  const handleAddArrearsSubmit = async () => {
    if (!arrearsTargetApt) return;

    let itemsToAdd = [...modalStagedObligations];
    const singleAmount = parseFloat(arrearsAmountInput);
    if (itemsToAdd.length === 0) {
      if (!singleAmount || singleAmount <= 0) {
        Alert.alert('تنبيه', 'يرجى إدخال مبلغ المديونية أو إضافة بنود مديونية للقائمة.');
        return;
      }
      const currentYear = new Date().getFullYear();
      const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === arrearsMonthNum);
      const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${arrearsMonthNum}`;

      let title = '';
      if (arrearsModalType === 'monthly_dues') {
        title = `اشتراك العمارة (${monthLabel} ${currentYear})`;
      } else {
        if (!arrearsCustomTitleInput.trim()) {
          Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
          return;
        }
        title = `${arrearsCustomTitleInput.trim()} (${monthLabel} ${currentYear})`;
      }

      itemsToAdd.push({
        id: 'single-' + Date.now(),
        type: arrearsModalType,
        title,
        amount: singleAmount,
        month: arrearsMonthNum,
        year: currentYear,
      });
    }

    try {
      let totalAmountAdded = 0;
      for (const item of itemsToAdd) {
        const billingMonth = `${item.year}-${String(item.month).padStart(2, '0')}`;
        await addApartmentObligation({
          apartmentId: arrearsTargetApt.id,
          apartmentNumber: arrearsTargetApt.apartment_number,
          title: item.title,
          amount: item.amount,
          billingMonth,
          category: item.type === 'monthly_dues' ? 'monthly_dues' : 'other',
          notes: arrearsNotesInput.trim() || undefined,
        });
        totalAmountAdded += item.amount;
      }

      setArrearsModalVisible(false);
      const targetAptNum = arrearsTargetApt.apartment_number;
      setArrearsTargetApt(null);
      setArrearsAmountInput('');
      setArrearsCustomTitleInput('');
      setArrearsNotesInput('');
      setModalStagedObligations([]);

      Alert.alert(
        'تم تسجيل المديونية بنجاح 📋',
        `تم قيد (${itemsToAdd.length}) بنود مديونية بإجمالي (${totalAmountAdded.toLocaleString('en-US')} ج.م) على شقة (${targetAptNum}).`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إضافة المديونية.');
    }
  };

  return (
    arrearsTargetApt && (
    <Modal
      visible={arrearsModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setArrearsModalVisible(false)}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setArrearsModalVisible(false)}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>
            إضافة مديونية على شقة {arrearsTargetApt.apartment_number}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Target Apartment Hero Banner */}
        <View style={styles.modalHeroBox}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={styles.unitNumberBoxBig}>
                <Text style={styles.unitNumberBoxBigText}>
                  {arrearsTargetApt.apartment_number}
                </Text>
              </View>
              <View>
                <Text style={styles.modalHeroTitle}>
                  {arrearsTargetApt.occupant_name || arrearsTargetApt.resident_name || 'وحدة شاغرة'}
                </Text>
                <Text style={styles.modalHeroSub}>
                  {arrearsTargetApt.floor_number || 'الدور الأول'} • كود الدعوة: {arrearsTargetApt.invite_code || `${currentBuilding.building_code}-${arrearsTargetApt.apartment_number}`}
                </Text>
              </View>
            </View>
            <View style={[styles.statusPillBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statusPillBadgeText, { color: '#B45309' }]}>
                المديونية: {arrearsTargetApt.arrears_amount || arrearsTargetApt.unpaid_amount || 0} ج.م
              </Text>
            </View>
          </View>
        </View>

        {/* Arrears Input Card */}
        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>تفاصيل المديونية أو الالتزام المالي</Text>
          <Text style={styles.inputHelpSubText}>
            يمكنك قيد اشتراك شهري متأخر أو بند مخصص (صيانة مصعد، استهلاك مياه، إلخ) مع إمكانية إضافة أكثر من بند.
          </Text>

          {/* Staged Obligations List inside Modal (if any) */}
          {modalStagedObligations.length > 0 && (
            <View style={styles.stagedListContainer}>
              <Text style={styles.stagedListHeader}>
                البنود المجهزة للقيد ({modalStagedObligations.length}):
              </Text>
              {modalStagedObligations.map((obl, idx) => (
                <View key={obl.id} style={styles.stagedItemRow}>
                  <View style={styles.rowAlign}>
                    <View style={styles.stagedIndexBadge}>
                      <Text style={styles.stagedIndexBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stagedItemTitle}>{obl.title}</Text>
                      <Text style={styles.stagedItemSub}>
                        {obl.type === 'monthly_dues' ? 'اشتراك شهري' : 'بند مخصص'} • {obl.year}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowAlign}>
                    <Text style={styles.stagedItemAmount}>
                      {obl.amount.toLocaleString()} ج.م
                    </Text>
                    <TouchableOpacity
                      style={styles.removeStagedBtn}
                      onPress={() => handleRemoveModalStagedObligation(obl.id)}
                    >
                      <MaterialIcons name="close" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.stagedTotalStrip}>
                <Text style={styles.stagedTotalLabel}>إجمالي البنود المجهزة:</Text>
                <Text style={styles.stagedTotalValue}>
                  {modalStagedObligations.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} ج.م
                </Text>
              </View>
            </View>
          )}

          {/* Type Selection: اشتراك العمارة vs أخرى */}
          <Text style={[styles.fieldLabel, { marginBottom: 6, marginTop: 4 }]}>
            نوع المديونية:
          </Text>
          <View style={styles.twoColumnGrid}>
            <TouchableOpacity
              style={[
                styles.arrearsTypeChoiceBtn,
                arrearsModalType === 'monthly_dues' && styles.arrearsTypeChoiceBtnActive,
              ]}
              onPress={() => {
                setArrearsModalType('monthly_dues');
                setArrearsAmountInput(String(currentBuilding.default_monthly_dues || 400));
              }}
            >
              <MaterialIcons
                name="apartment"
                size={18}
                color={arrearsModalType === 'monthly_dues' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.arrearsTypeChoiceText,
                  arrearsModalType === 'monthly_dues' && styles.arrearsTypeChoiceTextActive,
                ]}
              >
                اشتراك العمارة
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.arrearsTypeChoiceBtn,
                arrearsModalType === 'custom' && styles.arrearsTypeChoiceBtnActive,
              ]}
              onPress={() => setArrearsModalType('custom')}
            >
              <MaterialIcons
                name="post-add"
                size={18}
                color={arrearsModalType === 'custom' ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.arrearsTypeChoiceText,
                  arrearsModalType === 'custom' && styles.arrearsTypeChoiceTextActive,
                ]}
              >
                أخرى (بند مخصص)
              </Text>
            </TouchableOpacity>
          </View>

          {/* If "أخرى" is chosen, show full-width input for title */}
          {arrearsModalType === 'custom' && (
            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Text style={styles.fieldLabel}>اسم البند أو وصف المديونية *</Text>
              <TextInput
                style={styles.textInputField}
                value={arrearsCustomTitleInput}
                onChangeText={setArrearsCustomTitleInput}
                placeholder="مثال: صيانة مصعد، استهلاك مياه، إصلاح تسريب"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          )}

          {/* Amount & Year Side-by-Side */}
          <View style={[styles.inputsRowAligned, { marginTop: 10 }]}>
            {/* Amount Input */}
            <View style={{ flex: 1.6 }}>
              <Text style={styles.alignedFieldLabel}>مبلغ المديونية (ج.م) *</Text>
              <TextInput
                style={[styles.alignedTextInput, styles.ltrField]}
                value={arrearsAmountInput}
                onChangeText={setArrearsAmountInput}
                keyboardType="numeric"
                placeholder="400"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            {/* Year Picker */}
            <View style={{ flex: 1 }}>
              <Text style={styles.alignedFieldLabel}>السنة *</Text>
              <TouchableOpacity
                style={styles.yearPickerButton}
                activeOpacity={0.8}
                onPress={() => {
                  setYearPickerTarget('arrears_modal');
                  setYearPickerVisible(true);
                }}
              >
                <MaterialIcons name="calendar-today" size={15} color="#475569" />
                <Text style={styles.yearPickerText}>{arrearsModalYear}</Text>
                <MaterialIcons name="arrow-drop-down" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Select Pills 1 to 12 */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.alignedFieldLabel, { marginBottom: 6 }]}>
              عن شهر (اختر من 1 إلى 12):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthScrollRow}
            >
              {MONTHS_CHOICES.map((m) => {
                const isSelected = arrearsMonthNum === m.num;
                return (
                  <TouchableOpacity
                    key={m.num}
                    style={[
                      styles.monthSquarePill,
                      isSelected && styles.monthSquarePillActive,
                    ]}
                    onPress={() => setArrearsMonthNum(m.num)}
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

          {/* Add item to staged list button */}
          <TouchableOpacity
            style={[styles.addStagedItemBtn, { marginTop: 12 }]}
            activeOpacity={0.88}
            onPress={handleAddModalStagedObligation}
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addStagedItemBtnText}>
              + إضافة هذا البند إلى قائمة المديونيات
            </Text>
          </TouchableOpacity>

          {/* Notes */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>ملاحظات إضافية (اختياري)</Text>
            <TextInput
              style={[styles.textInputField, { minHeight: 50 }]}
              value={arrearsNotesInput}
              onChangeText={setArrearsNotesInput}
              placeholder="أي ملاحظات لسجل الحسابات"
              placeholderTextColor={COLORS.outline}
              multiline
            />
          </View>
        </View>

        {/* Submit Arrears Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleAddArrearsSubmit}
        >
          <MaterialIcons name="add-task" size={20} color={COLORS.onPrimary} />
          <Text style={styles.primaryActionText}>
            {modalStagedObligations.length > 0
              ? `ترحيل (${modalStagedObligations.length}) بنود مديونية على الشقة`
              : 'تسجيل المديونية وترحيلها على الشقة'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
    )
  ) || null;
};
