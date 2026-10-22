import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { CompressedUploadResult, pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../emergency.styles';

interface CloseClaimSheetProps {
  closingClaimId: string | null;
  setClosingClaimId: React.Dispatch<React.SetStateAction<string | null>>;
  closeClaimActualAmount: string;
  setCloseClaimActualAmount: React.Dispatch<React.SetStateAction<string>>;
}

export const CloseClaimSheet: React.FC<CloseClaimSheetProps> = ({
  closingClaimId,
  setClosingClaimId,
  closeClaimActualAmount,
  setCloseClaimActualAmount,
}) => {
  const { closeEmergencyClaimWithInvoice, currentBuilding } = useAppStore();

  const [closeClaimInvoiceNum, setCloseClaimInvoiceNum] = useState('');
  const [closeClaimNotes, setCloseClaimNotes] = useState('');
  const [closeClaimUploading, setCloseClaimUploading] = useState(false);
  const [closeClaimCompressedUpload, setCloseClaimCompressedUpload] =
    useState<CompressedUploadResult | null>(null);
  const [closeClaimSubmitting, setCloseClaimSubmitting] = useState(false);

  const handlePickCloseClaimInvoice = async (source: 'library' | 'camera') => {
    setCloseClaimUploading(true);
    try {
      const result = await pickAndCompressUploadImage({
        bucket: 'expense-invoices',
        buildingId: currentBuilding.id,
        yearMonth: '2024-11',
        source,
      });
      if (result) {
        setCloseClaimCompressedUpload(result);
      }
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر ضغط ورفع فاتورة إغلاق المطالبة');
    } finally {
      setCloseClaimUploading(false);
    }
  };

  const handleConfirmCloseEmergencyClaim = async () => {
    if (!closingClaimId) return;
    setCloseClaimSubmitting(true);
    try {
      await closeEmergencyClaimWithInvoice({
        claimId: closingClaimId,
        actualAmount: parseFloat(closeClaimActualAmount) || undefined,
        invoiceNumber: closeClaimInvoiceNum,
        notes: closeClaimNotes,
        invoiceImageUrl:
          closeClaimCompressedUpload?.publicUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
      });
      setClosingClaimId(null);
      setCloseClaimCompressedUpload(null);
      Alert.alert(
        'تم إغلاق المطالبة الطارئة وتوثيق الفاتورة ✅',
        'تم إغلاق المطالبة الطارئة رسمياً وإدراج الفاتورة المضغوطة في سجل الشفافية والمصروفات.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إغلاق المطالبة الطارئة');
    } finally {
      setCloseClaimSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={Boolean(closingClaimId)}
      title="إغلاق المطالبة الطارئة بفاتورة رسمية"
      subtitle="رفع فاتورة الإصلاح النهائية (تُضغط تلقائياً بعرض 1080px وجودة 60%) وتُسجل في لوحة الشفافية"
      onClose={() => setClosingClaimId(null)}
    >
      <View style={styles.modalForm}>
        <View style={styles.twoCol}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>المبلغ الفعلي للفاتورة (ج.م)</Text>
            <TextInput
              style={[styles.input, { textAlign: 'left' }]}
              value={closeClaimActualAmount}
              onChangeText={setCloseClaimActualAmount}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>رقم فاتورة المورد / الشركة</Text>
            <TextInput
              style={[styles.input, { textAlign: 'left' }]}
              value={closeClaimInvoiceNum}
              onChangeText={setCloseClaimInvoiceNum}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>بيان الإقفال والضمان</Text>
          <TextInput
            style={styles.input}
            value={closeClaimNotes}
            onChangeText={setCloseClaimNotes}
          />
        </View>

        <View style={styles.invoiceAttachCard}>
          <MaterialIcons
            name="receipt-long"
            size={22}
            color={COLORS.secondary}
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.invoiceAttachTitle}>
              {closeClaimCompressedUpload
                ? `فاتورة الإقفال مضغوطة (${closeClaimCompressedUpload.estimatedSizeKb} KB • ${closeClaimCompressedUpload.width}px)`
                : 'صورة فاتورة الإقفال النهائية (ضغط تلقائي 80–150 KB)'}
            </Text>
            <Text style={styles.invoiceAttachSub}>
              {closeClaimCompressedUpload
                ? closeClaimCompressedUpload.storagePath
                : `المسار المنظم: ${currentBuilding.id}/2024-11/invoice_*.jpg`}
            </Text>
          </View>
        </View>

        <View style={styles.uploadButtonsRow}>
          <TouchableOpacity
            style={styles.uploadPickerBtn}
            onPress={() => handlePickCloseClaimInvoice('library')}
            disabled={closeClaimUploading}
          >
            {closeClaimUploading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <MaterialIcons
                  name="photo-library"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.uploadPickerBtnText}>
                  اختر فاتورة الإقفال
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.uploadPickerBtn}
            onPress={() => handlePickCloseClaimInvoice('camera')}
            disabled={closeClaimUploading}
          >
            <MaterialIcons
              name="photo-camera"
              size={16}
              color={COLORS.secondary}
            />
            <Text style={styles.uploadPickerBtnText}>تصوير الفاتورة</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.modalPrimaryBtn}
          onPress={handleConfirmCloseEmergencyClaim}
          disabled={closeClaimSubmitting || closeClaimUploading}
        >
          {closeClaimSubmitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons
                name="verified"
                size={18}
                color={COLORS.onPrimary}
              />
              <Text style={styles.modalPrimaryBtnText}>
                إغلاق المطالبة واعتماد الفاتورة في سجل الشفافية
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
