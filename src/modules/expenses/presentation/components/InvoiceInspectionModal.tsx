import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Expense } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { styles } from '../TransparencyExpensesScreen.styles';

interface InvoiceInspectionModalProps {
  selectedInvoiceExpense: Expense | null;
  setSelectedInvoiceExpense: React.Dispatch<React.SetStateAction<Expense | null>>;
}

export const InvoiceInspectionModal: React.FC<InvoiceInspectionModalProps> = ({
  selectedInvoiceExpense,
  setSelectedInvoiceExpense,
}) => {
  const [isZoomedInvoice, setIsZoomedInvoice] = useState(false);

  return (
    <BottomSheetModal
      visible={Boolean(selectedInvoiceExpense)}
      title="معاينة الفاتورة وسند الصرف المعتمد"
      subtitle={
        selectedInvoiceExpense
          ? `${selectedInvoiceExpense.title} • ${selectedInvoiceExpense.invoice_number || '#INV-4921'}`
          : ''
      }
      onClose={() => {
        setSelectedInvoiceExpense(null);
        setIsZoomedInvoice(false);
      }}
    >
      {selectedInvoiceExpense && (
        <View style={styles.invoiceModalContent}>
          {/* Top Verification Status Badge */}
          <View style={styles.modalVerificationStrip}>
            <View style={styles.modalVerifiedDot} />
            <Text style={styles.modalVerifiedText}>معتمدة ومطابقة للمواصفات الفنية والمالية</Text>
          </View>

          {/* Quick Zoom Bar CTA (design/_20 lines 66-82) */}
          <TouchableOpacity
            style={styles.zoomCtaBar}
            onPress={() => setIsZoomedInvoice(!isZoomedInvoice)}
          >
            <View style={styles.zoomCtaRight}>
              <View style={styles.zoomIconBox}>
                <MaterialIcons name="zoom-in" size={20} color={COLORS.secondaryFixed} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.zoomCtaTitle}>تكبير الورقة وفحص الختم المعتمد</Text>
                <Text style={styles.zoomCtaSub}>انقر للتبديل بين المعاينة العادية والتكبير التفاعلي</Text>
              </View>
            </View>
            <View style={styles.zoomPercentBadge}>
              <Text style={styles.zoomPercentText}>{isZoomedInvoice ? '200%' : '100%'}</Text>
            </View>
          </TouchableOpacity>

          {/* Paper Invoice Simulation (design/_20 lines 84-142) */}
          <View style={styles.paperSheetContainer}>
            {/* Vendor Header */}
            <View style={styles.paperVendorHeader}>
              <View style={styles.paperVendorRight}>
                <View style={styles.vendorLogoBox}>
                  <MaterialIcons
                    name={
                      selectedInvoiceExpense.category.includes('مصاعد')
                        ? 'elevator'
                        : selectedInvoiceExpense.category.includes('كهرباء')
                        ? 'bolt'
                        : 'business'
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.vendorNameText}>
                    {selectedInvoiceExpense.category.includes('مصاعد')
                      ? 'شركة شيندلر للمصاعد والهندسة'
                      : selectedInvoiceExpense.category.includes('رواتب')
                      ? 'إدارة الأمن وخدمات العقار'
                      : 'شركة الخدمات والمرافق المعتمدة'}
                  </Text>
                  <Text style={styles.vendorTaxText}>س.ت: 104882 • ب.ض: 493-201-990</Text>
                </View>
              </View>
              <View style={styles.paidStampPill}>
                <Text style={styles.paidStampText}>خالصة الدفع</Text>
              </View>
            </View>

            {/* Line Items Breakdown Table */}
            <View style={styles.lineItemsTable}>
              <View style={styles.tableHeadRow}>
                <Text style={styles.tableHeadText}>البيان وتفاصيل الصيانة</Text>
                <Text style={styles.tableHeadText}>القيمة (ج.م)</Text>
              </View>

              <View style={styles.tableRow}>
                <Text style={styles.tableRowDesc}>{selectedInvoiceExpense.title}</Text>
                <Text style={styles.tableRowPrice}>
                  {selectedInvoiceExpense.amount.toLocaleString()}
                </Text>
              </View>

              {selectedInvoiceExpense.description ? (
                <View style={styles.tableRow}>
                  <Text style={[styles.tableRowDesc, { color: COLORS.onSurfaceVariant }]}>
                    ملاحظات فنية: {selectedInvoiceExpense.description}
                  </Text>
                  <Text style={styles.tableRowPrice}>مشمول</Text>
                </View>
              ) : null}

              {/* Total Calculation Banner */}
              <View style={styles.totalCalcBanner}>
                <Text style={styles.totalCalcLabel}>الإجمالي المسدد بالكامل:</Text>
                <Text style={styles.totalCalcNumber}>
                  {selectedInvoiceExpense.amount.toLocaleString()}{' '}
                  <Text style={styles.totalCalcCurrency}>جنيه مصري</Text>
                </Text>
              </View>
            </View>

            {/* Official Certified Stamp & Signatures Container */}
            <View style={styles.stampSignaturesBox}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.signLabel}>اعتماد مهندس الموقع:</Text>
                <Text style={styles.signName}>م. تامر الشاذلي</Text>
                <View style={styles.signVerifiedLine}>
                  <MaterialIcons name="check-circle" size={14} color={COLORS.secondary} />
                  <Text style={styles.signVerifiedText}>ختم معتمد ومطابق لأصل الفاتورة</Text>
                </View>
              </View>

              <View style={styles.roundStampGraphic}>
                <MaterialIcons name="verified" size={24} color={COLORS.secondary} />
                <Text style={styles.roundStampText}>معتمد رسمياً</Text>
              </View>
            </View>

            {/* High-res Image Preview if Available */}
            {selectedInvoiceExpense.invoice_image_url && (
              <View style={{ marginTop: 14 }}>
                <Image
                  source={{ uri: selectedInvoiceExpense.invoice_image_url }}
                  style={[styles.fullInvoiceImg, isZoomedInvoice && { height: 480 }]}
                  resizeMode={isZoomedInvoice ? 'cover' : 'contain'}
                />
              </View>
            )}
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
};
