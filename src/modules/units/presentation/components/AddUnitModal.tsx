import React, { useState } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { MONTHS_CHOICES } from '../../domain/units.constants';
import type { StagedObligation } from '../../domain/units.types';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface AddUnitModalProps {
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveFilter: React.Dispatch<React.SetStateAction<'all' | 'overdue' | 'paid' | 'pending'>>;
  addModalVisible: boolean;
  setAddModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  obligationYear: number;
  setObligationYear: React.Dispatch<React.SetStateAction<number>>;
  setYearPickerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setYearPickerTarget: React.Dispatch<React.SetStateAction<'add_unit' | 'arrears_modal' | 'edit_obl'>>;
  setLastAddedAptNumber: React.Dispatch<React.SetStateAction<string | null>>;
}

export const AddUnitModal: React.FC<AddUnitModalProps> = ({
  setSearchQuery,
  setActiveFilter,
  addModalVisible,
  setAddModalVisible,
  obligationYear,
  setObligationYear,
  setYearPickerVisible,
  setYearPickerTarget,
  setLastAddedAptNumber,
}) => {
  const { addApartmentUnit, currentBuilding } = useAppStore();

  const [aptNumber, setAptNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [orientation, setOrientation] = useState<'بحري' | 'قبلي' | 'شرقي' | 'واجهة'>('واجهة');
  const [areaSqm, setAreaSqm] = useState('165');
  const [residentName, setResidentName] = useState('');
  const [residentPhone, setResidentPhone] = useState('');
  const [residentRole, setResidentRole] = useState<'مالك مقيم' | 'مستأجر'>('مالك مقيم');

  // Staged Obligations for Add Unit Form (User requested dynamic builder)
  const [isAddingArrearsOpen, setIsAddingArrearsOpen] = useState(false);
  const [stagedObligations, setStagedObligations] = useState<StagedObligation[]>([]);
  const [editingStagedId, setEditingStagedId] = useState<string | null>(null);
  const [obligationType, setObligationType] = useState<'monthly_dues' | 'custom'>('monthly_dues');
  const [obligationAmount, setObligationAmount] = useState(String(currentBuilding.default_monthly_dues || 400));
  const [obligationMonth, setObligationMonth] = useState<number>(new Date().getMonth() + 1);

  const [obligationCustomTitle, setObligationCustomTitle] = useState('');

  const [isAddingUnitLoading, setIsAddingUnitLoading] = useState(false);

  // Add or Update Staged Obligation in Add Unit Modal
  const handleAddStagedObligation = () => {
    const amount = parseFloat(obligationAmount);
    if (!amount || amount <= 0) {
      Alert.alert('تنبيه', 'يرجى كتابة مبلغ المديونية بشكل صحيح.');
      return;
    }

    let finalTitle = '';
    const selectedMonthObj = MONTHS_CHOICES.find((m) => m.num === obligationMonth);
    const monthLabel = selectedMonthObj ? selectedMonthObj.name : `شهر ${obligationMonth}`;

    if (obligationType === 'monthly_dues') {
      finalTitle = `اشتراك العمارة (${monthLabel} ${obligationYear})`;
    } else {
      if (!obligationCustomTitle.trim()) {
        Alert.alert('تنبيه', 'يرجى كتابة بند المديونية أولاً (مثل: صيانة مصعد، استهلاك مياه، إصلاحات).');
        return;
      }
      finalTitle = `${obligationCustomTitle.trim()} (${monthLabel} ${obligationYear})`;
    }

    if (editingStagedId) {
      setStagedObligations((prev) =>
        prev.map((o) =>
          o.id === editingStagedId
            ? {
                ...o,
                type: obligationType,
                title: finalTitle,
                amount,
                month: obligationMonth,
                year: obligationYear,
              }
            : o
        )
      );
      setEditingStagedId(null);
      setObligationCustomTitle('');
      Alert.alert('تم التعديل 👍', 'تم تحديث بيانات البند بنجاح في القائمة.');
      return;
    }

    const newItem: StagedObligation = {
      id: 'stg-' + Date.now() + Math.floor(Math.random() * 1000),
      type: obligationType,
      title: finalTitle,
      amount,
      month: obligationMonth,
      year: obligationYear,
    };

    setStagedObligations((prev) => [...prev, newItem]);
    setObligationCustomTitle('');
    // Advance month to next month for convenience!
    setObligationMonth((prev) => (prev < 12 ? prev + 1 : 1));
  };

  const handleEditStagedObligation = (item: StagedObligation) => {
    setEditingStagedId(item.id);
    setObligationType(item.type);
    setObligationAmount(String(item.amount));
    setObligationMonth(item.month);
    setObligationYear(item.year);
    if (item.type === 'custom') {
      const match = item.title.match(/^(.*?)\s*\(/);
      setObligationCustomTitle(match ? match[1].trim() : item.title);
    } else {
      setObligationCustomTitle('');
    }
    setIsAddingArrearsOpen(true);
  };

  const handleCancelEditStagedObligation = () => {
    setEditingStagedId(null);
    setObligationCustomTitle('');
    setObligationAmount(String(currentBuilding.default_monthly_dues || 400));
  };

  const handleRemoveStagedObligation = (id: string) => {
    if (editingStagedId === id) {
      handleCancelEditStagedObligation();
    }
    setStagedObligations((prev) => prev.filter((o) => o.id !== id));
  };

  // Handle Add Unit Submit (Screen 15: _4)
  const handleAddUnitSubmit = async () => {
    if (isAddingUnitLoading) return;
    if (!aptNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الشقة.');
      return;
    }

    const totalStagedArrears = stagedObligations.reduce((sum, item) => sum + item.amount, 0);

    try {
      setIsAddingUnitLoading(true);

      await addApartmentUnit({
        apartmentNumber: aptNumber.trim(),
        floorNumber: floorNumber.trim() || 'الدور الأول',
        wingOrDirection: orientation,
        areaSqm: parseFloat(areaSqm) || 160,
        residentName: residentName.trim() || 'وحدة شاغرة',
        residentPhone: residentPhone.trim() || '',
        arrearsAmount: totalStagedArrears,
        stagedObligations: stagedObligations.map((obl) => ({
          id: obl.id,
          type: obl.type === 'monthly_dues' ? 'monthly_dues' : 'other',
          title: obl.title,
          amount: obl.amount,
          year: obl.year,
          month: obl.month,
          notes: `قيد مديونية مسجل عند تأسيس شقة (${aptNumber.trim()})`,
        })),
      });

      // Clear search and reset filter so the new unit is guaranteed visible below!
      setActiveFilter('all');
      setSearchQuery('');
      setLastAddedAptNumber(aptNumber.trim());
      setAddModalVisible(false);
      setAptNumber('');
      setFloorNumber('');
      setResidentName('');
      setResidentPhone('');
      setStagedObligations([]);
      setIsAddingArrearsOpen(false);

      Alert.alert(
        'تمت إضافة الوحدة بنجاح 🎉',
        stagedObligations.length > 0
          ? `تم تسجيل شقة (${aptNumber.trim()}) بنجاح وإدراج (${stagedObligations.length}) بنود مديونية بإجمالي (${totalStagedArrears.toLocaleString()} ج.م).`
          : `تم تسجيل شقة (${aptNumber.trim()}) بنجاح وإدراجها ضمن سجل وحدات العقار.`
      );
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إضافة الوحدة');
    } finally {
      setIsAddingUnitLoading(false);
    }
  };

  return (
    <Modal
      visible={addModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setAddModalVisible(false)}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setAddModalVisible(false)}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>إضافة وحدة سكنية جديدة</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>بيانات الوحدة والموقع</Text>

          <View style={styles.twoColumnGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>رقم الشقة *</Text>
              <TextInput
                style={[styles.textInputField, styles.codeFieldStyle]}
                value={aptNumber}
                onChangeText={setAptNumber}
                placeholder="مثال: 302"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>الطابق / الدور</Text>
              <TextInput
                style={styles.textInputField}
                value={floorNumber}
                onChangeText={setFloorNumber}
                placeholder="مثال: الدور الثالث"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          <View style={styles.twoColumnGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>المساحة (م²)</Text>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={areaSqm}
                onChangeText={setAreaSqm}
                keyboardType="numeric"
                placeholder="165"
                placeholderTextColor={COLORS.outline}
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
                      orientation === dir && styles.dirChoicePillActive,
                    ]}
                    onPress={() => setOrientation(dir)}
                  >
                    <Text
                      style={[
                        styles.dirChoiceText,
                        orientation === dir && styles.dirChoiceTextActive,
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
          <Text style={styles.sectionHeaderTitle}>بيانات الساكن أو المالك (اختياري)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>الاسم بالكامل</Text>
            <TextInput
              style={styles.textInputField}
              value={residentName}
              onChangeText={setResidentName}
              placeholder="مثال: م. أحمد مصطفى"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم هاتف الواتساب</Text>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={residentPhone}
              onChangeText={setResidentPhone}
              keyboardType="phone-pad"
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.twoColumnGrid}>
            <TouchableOpacity
              style={[
                styles.roleSelectorPill,
                residentRole === 'مالك مقيم' && styles.roleSelectorPillActive,
              ]}
              onPress={() => setResidentRole('مالك مقيم')}
            >
              <MaterialIcons name="home" size={18} color={COLORS.primary} />
              <Text style={styles.roleSelectorPillText}>مالك مقيم</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleSelectorPill,
                residentRole === 'مستأجر' && styles.roleSelectorPillActive,
              ]}
              onPress={() => setResidentRole('مستأجر')}
            >
              <MaterialIcons name="key" size={18} color={COLORS.primary} />
              <Text style={styles.roleSelectorPillText}>مستأجر</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Arrears & Debt Section */}
        <View style={styles.formSectionCard}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="account-balance-wallet" size={18} color="#B45309" />
              <Text style={[styles.sectionHeaderTitle, { color: '#B45309' }]}>
                المديونيات والمتأخرات السابقة على الشقة
              </Text>
            </View>
            <Text style={styles.optionalTagText}>اختياري</Text>
          </View>

          <Text style={styles.inputHelpSubText}>
            إذا كانت على الشقة اشتراكات شهور سابقة لم تسدد أو صيانة متراكمة، يمكنك قيدها هنا لتظهر للساكن في حسابه.
          </Text>

          {/* Staged Obligations List (if any already added) */}
          {stagedObligations.length > 0 && (
            <View style={styles.stagedListContainer}>
              <Text style={styles.stagedListHeader}>
                قائمة المديونيات المقيدة ({stagedObligations.length}):
              </Text>
              {stagedObligations.map((obl, idx) => (
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
                      style={styles.editStagedBtn}
                      onPress={() => handleEditStagedObligation(obl)}
                    >
                      <MaterialIcons name="edit" size={15} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeStagedBtn}
                      onPress={() => handleRemoveStagedObligation(obl.id)}
                    >
                      <MaterialIcons name="close" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.stagedTotalStrip}>
                <Text style={styles.stagedTotalLabel}>إجمالي المديونية المسجلة:</Text>
                <Text style={styles.stagedTotalValue}>
                  {stagedObligations.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} ج.م
                </Text>
              </View>
            </View>
          )}

          {/* Toggle / Add Arrears Button if not open */}
          {!isAddingArrearsOpen && stagedObligations.length === 0 ? (
            <TouchableOpacity
              style={styles.openAddArrearsBtn}
              onPress={() => setIsAddingArrearsOpen(true)}
            >
              <MaterialIcons name="add-circle-outline" size={18} color="#B45309" />
              <Text style={styles.openAddArrearsBtnText}>+ إضافة مديونية على الشقة</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addArrearsBox}>
              <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                نوع المديونية المراد إضافتها:
              </Text>

              {/* Two options: اشتراك العمارة vs أخرى */}
              <View style={styles.twoColumnGrid}>
                <TouchableOpacity
                  style={[
                    styles.arrearsTypeChoiceBtn,
                    obligationType === 'monthly_dues' && styles.arrearsTypeChoiceBtnActive,
                  ]}
                  onPress={() => {
                    setObligationType('monthly_dues');
                    setObligationAmount(String(currentBuilding.default_monthly_dues || 400));
                  }}
                >
                  <MaterialIcons
                    name="apartment"
                    size={18}
                    color={obligationType === 'monthly_dues' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.arrearsTypeChoiceText,
                      obligationType === 'monthly_dues' && styles.arrearsTypeChoiceTextActive,
                    ]}
                  >
                    اشتراك العمارة
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.arrearsTypeChoiceBtn,
                    obligationType === 'custom' && styles.arrearsTypeChoiceBtnActive,
                  ]}
                  onPress={() => setObligationType('custom')}
                >
                  <MaterialIcons
                    name="post-add"
                    size={18}
                    color={obligationType === 'custom' ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.arrearsTypeChoiceText,
                      obligationType === 'custom' && styles.arrearsTypeChoiceTextActive,
                    ]}
                  >
                    أخرى (بند مخصص)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* If "أخرى" is chosen, show full-width input for title */}
              {obligationType === 'custom' && (
                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <Text style={styles.fieldLabel}>اسم البند أو وصف المديونية *</Text>
                  <TextInput
                    style={styles.textInputField}
                    value={obligationCustomTitle}
                    onChangeText={setObligationCustomTitle}
                    placeholder="مثال: صيانة مصعد، استهلاك مياه، إصلاح تسريب"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>
              )}

              {/* Two inputs side-by-side: Amount and Year */}
              <View style={[styles.inputsRowAligned, { marginTop: 10 }]}>
                {/* Amount */}
                <View style={{ flex: 1.6 }}>
                  <Text style={styles.alignedFieldLabel}>المبلغ المستحق (ج.م) *</Text>
                  <TextInput
                    style={[styles.alignedTextInput, styles.ltrField]}
                    value={obligationAmount}
                    onChangeText={setObligationAmount}
                    keyboardType="numeric"
                    placeholder="400"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>

                {/* Year */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.alignedFieldLabel}>السنة *</Text>
                  <TouchableOpacity
                    style={styles.yearPickerButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      setYearPickerTarget('add_unit');
                      setYearPickerVisible(true);
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={15} color="#475569" />
                    <Text style={styles.yearPickerText}>{obligationYear}</Text>
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
                    const isSelected = obligationMonth === m.num;
                    return (
                      <TouchableOpacity
                        key={m.num}
                        style={[
                          styles.monthSquarePill,
                          isSelected && styles.monthSquarePillActive,
                        ]}
                        onPress={() => setObligationMonth(m.num)}
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

              {/* Add / Save Staged Obligation Button */}
              <TouchableOpacity
                style={[styles.addStagedItemBtn, editingStagedId ? { backgroundColor: '#2563EB' } : null]}
                activeOpacity={0.88}
                onPress={handleAddStagedObligation}
              >
                <MaterialIcons name={editingStagedId ? 'check' : 'add'} size={18} color="#FFFFFF" />
                <Text style={styles.addStagedItemBtnText}>
                  {editingStagedId ? 'حفظ تعديل هذا البند 💾' : '+ إضافة هذا البند إلى المديونيات'}
                </Text>
              </TouchableOpacity>

              {editingStagedId && (
                <TouchableOpacity
                  style={[styles.openAddArrearsBtn, { marginTop: 4, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                  onPress={handleCancelEditStagedObligation}
                >
                  <Text style={[styles.openAddArrearsBtnText, { color: '#64748B' }]}>إلغاء تعديل هذا البند</Text>
                </TouchableOpacity>
              )}

              {/* Option to close form if staged items exist */}
              {stagedObligations.length > 0 && (
                <TouchableOpacity
                  style={styles.cancelArrearsBoxBtn}
                  onPress={() => setIsAddingArrearsOpen(false)}
                >
                  <Text style={styles.cancelArrearsBoxBtnText}>
                    اكتفاء بالبنود المضافة أعلاه ({stagedObligations.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* If items exist and form is closed, offer "+ إضافة بند مديونية آخر" */}
          {!isAddingArrearsOpen && stagedObligations.length > 0 && (
            <TouchableOpacity
              style={[styles.openAddArrearsBtn, { marginTop: 10 }]}
              onPress={() => setIsAddingArrearsOpen(true)}
            >
              <MaterialIcons name="add-circle-outline" size={18} color="#B45309" />
              <Text style={styles.openAddArrearsBtnText}>+ إضافة بند مديونية آخر للشقة</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryActionButton, isAddingUnitLoading && { opacity: 0.7 }]}
          activeOpacity={0.88}
          onPress={handleAddUnitSubmit}
          disabled={isAddingUnitLoading}
        >
          {isAddingUnitLoading ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="add-home" size={20} color={COLORS.onPrimary} />
              <Text style={styles.primaryActionText}>حفظ وإضافة الوحدة للسجل</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
};
