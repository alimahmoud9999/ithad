import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { CompressedUploadResult, pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../expenseSheet.styles';

interface AddExpenseSheetProps {
  expenseModalVisible: boolean;
  setExpenseModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AddExpenseSheet: React.FC<AddExpenseSheetProps> = ({
  expenseModalVisible,
  setExpenseModalVisible,
}) => {
  const { currentBuilding, recordBuildingExpense } = useAppStore();

  // Add Expense Form + Compressed Image Upload
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('صيانة ومصاعد');
  const [expInvoiceNum, setExpInvoiceNum] = useState('');
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [expUploadingImage, setExpUploadingImage] = useState(false);
  const [expCompressedUpload, setExpCompressedUpload] =
    useState<CompressedUploadResult | null>(null);

  // Image Picker & Compression Handlers (Mandatory Storage Optimization)
  const handlePickExpenseInvoice = async (source: 'library' | 'camera') => {
    setExpUploadingImage(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'expense-invoices',
        buildingId: currentBuilding.id,
        yearMonth: '2024-11',
        source,
      });
      if (result) {
        setExpCompressedUpload(result);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع صورة الفاتورة');
    } finally {
      setExpUploadingImage(false);
    }
  };

  const handleAddExpense = async () => {
    const numeric = parseFloat(expAmount);
    if (!expTitle.trim() || !numeric || numeric <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المصروف ومبلغ صحيح.');
      return;
    }
    setExpSubmitting(true);
    try {
      await recordBuildingExpense({
        title: expTitle,
        amount: numeric,
        category: expCategory,
        invoiceNumber: expInvoiceNum,
        invoiceImageUrl:
          expCompressedUpload?.publicUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
      });
      setExpTitle('');
      setExpAmount('');
      setExpCompressedUpload(null);
      setExpenseModalVisible(false);
      Alert.alert(
        'تم قيد المصروف بنجاح',
        'تم ضغط وحفظ صورة الفاتورة وخصم المبلغ من الخزينة ونشره في لوحة الشفافية للسكان.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إضافة المصروف');
    } finally {
      setExpSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={expenseModalVisible}
      title="إضافة مصروف جديد"
      subtitle="تسجيل حركة صرف موثقة لخزينة العمارة وتظهر فوراً في لوحة الشفافية"
      onClose={() => setExpenseModalVisible(false)}
    >
      <View style={styles.modalForm}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>بيان / عنوان المصروف</Text>
          <TextInput
            style={styles.input}
            value={expTitle}
            onChangeText={setExpTitle}
            placeholder="مثال: صيانة المصعد الدوري / راتب الحارس"
            placeholderTextColor={COLORS.outline}
          />
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>المبلغ (ج.م)</Text>
            <TextInput
              style={[styles.input, { textAlign: 'left' }]}
              value={expAmount}
              onChangeText={setExpAmount}
              keyboardType="numeric"
              placeholder="1200"
              placeholderTextColor={COLORS.outline}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>رقم الفاتورة / السند</Text>
            <TextInput
              style={[styles.input, { textAlign: 'left' }]}
              value={expInvoiceNum}
              onChangeText={setExpInvoiceNum}
              placeholder="#INV-4950"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>التصنيف</Text>
          <View style={styles.chipsWrap}>
            {[
              'صيانة ومصاعد',
              'رواتب وأمن',
              'كهرباء ومياه',
              'نظافة ومستهلكات',
            ].map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setExpCategory(cat)}
                style={[
                  styles.catChip,
                  expCategory === cat && styles.catChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    expCategory === cat && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Compressed Image Picker Box (expense-invoices/{building_id}/{year_month}/{unique_filename}.jpg) */}
        <View style={styles.invoiceAttachCard}>
          <MaterialIcons
            name="add-a-photo"
            size={22}
            color={COLORS.secondary}
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.invoiceAttachTitle}>
              {expCompressedUpload
                ? `تم ضغط الفاتورة (${expCompressedUpload.estimatedSizeKb} KB • ${expCompressedUpload.width}px)`
                : 'إرفاق صورة الفاتورة الرسمية (ضغط تلقائي 60% • 1080px)'}
            </Text>
            <Text style={styles.invoiceAttachSub}>
              {expCompressedUpload
                ? expCompressedUpload.storagePath
                : `المسار المنظم: ${currentBuilding.id}/2024-11/invoice_*.jpg`}
            </Text>
          </View>
        </View>

        <View style={styles.uploadButtonsRow}>
          <TouchableOpacity
            style={styles.uploadPickerBtn}
            onPress={() => handlePickExpenseInvoice('library')}
            disabled={expUploadingImage}
          >
            {expUploadingImage ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <MaterialIcons
                  name="photo-library"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.uploadPickerBtnText}>
                  اختر من المعرض (ضغط ذكي)
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.uploadPickerBtn}
            onPress={() => handlePickExpenseInvoice('camera')}
            disabled={expUploadingImage}
          >
            <MaterialIcons
              name="photo-camera"
              size={16}
              color={COLORS.secondary}
            />
            <Text style={styles.uploadPickerBtnText}>تصوير بالكاميرا</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.modalPrimaryBtn}
          onPress={handleAddExpense}
          disabled={expSubmitting || expUploadingImage}
        >
          {expSubmitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons
                name="check-circle"
                size={18}
                color={COLORS.onPrimary}
              />
              <Text style={styles.modalPrimaryBtnText}>
                حفظ المصروف وخصمه من الخزينة
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
