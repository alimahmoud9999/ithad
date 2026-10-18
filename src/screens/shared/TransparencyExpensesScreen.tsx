import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { Expense } from '../../types/database';

const MONTHS_TABS = [
  { key: '2024-11', label: 'نوفمبر 2024 (الحالي)' },
  { key: '2024-10', label: 'أكتوبر 2024' },
  { key: '2024-09', label: 'سبتمبر 2024' },
];

const EXPENSE_CATEGORIES = [
  'الكل',
  'صيانة ومصاعد',
  'رواتب وأمن',
  'كهرباء ومياه',
  'نظافة ومستهلكات',
  'اشتراكات وخدمات رقمية',
];

/**
 * Strictly follows:
 * - design/stitch_/design.md (Screen 4: Transparency & Expenses Feed)
 * - design/stitch_/_29/code.html (Monthly selector, Financial overview hero card, Trust banner, Category filters, Expense cards)
 * - design/stitch_/_18/code.html (Full-screen invoice & voucher preview modal)
 */
export const TransparencyExpensesScreen: React.FC = () => {
  const { currentBuilding, expenses, payments, currentRole } = useAppStore();

  const [selectedMonth, setSelectedMonth] = useState('2024-11');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [selectedInvoiceExpense, setSelectedInvoiceExpense] =
    useState<Expense | null>(null);

  const buildingExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.building_id !== currentBuilding.id) return false;
      if (
        selectedCategory !== 'الكل' &&
        e.category !== selectedCategory
      ) {
        return false;
      }
      return true;
    });
  }, [expenses, currentBuilding.id, selectedCategory]);

  const totalSpent = useMemo(
    () => buildingExpenses.reduce((sum, item) => sum + item.amount, 0),
    [buildingExpenses]
  );

  const totalCollected = useMemo(
    () =>
      payments
        .filter((p) => p.building_id === currentBuilding.id && p.status === 'paid')
        .reduce((sum, item) => sum + item.amount, 0),
    [payments, currentBuilding.id]
  );

  const handleExportPdf = () => {
    if (!currentBuilding.features_config.export_reports) {
      Alert.alert(
        'الميزة غير مفعلة 🔒',
        'تصدير التقارير المعتمدة PDF غير مفعل في باقة العمارة الحالية.'
      );
      return;
    }
    Alert.alert(
      'تصدير تقرير الشفافية PDF 📄',
      `تم تجهيز كشف الحساب المعتمد لـ (${currentBuilding.name}) شاملاً (${buildingExpenses.length}) فواتير موثقة.`
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Title Context & Micro Trust Pill (_29/code.html lines 23-34) */}
      <View style={styles.headerRow}>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={styles.pageTitle}>لوحة المصروفات والشفافية</Text>
          <Text style={styles.pageSubtitle}>
            {currentBuilding.name} • تقرير المصروفات وسجل الفواتير المعتمدة
          </Text>
        </View>

        <View style={styles.auditPill}>
          <MaterialIcons
            name="verified"
            size={15}
            color={COLORS.secondary}
          />
          <Text style={styles.auditPillText}>
            {currentRole === 'resident' ? 'عرض شفاف للملاك' : 'تدقيق نشط'}
          </Text>
        </View>
      </View>

      {/* 2. Horizontal Month Selector (_29/code.html lines 36-50) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthsScrollRow}
      >
        {MONTHS_TABS.map((m) => {
          const active = selectedMonth === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setSelectedMonth(m.key)}
              style={[styles.monthTab, active && styles.monthTabActive]}
            >
              {active && (
                <MaterialIcons
                  name="calendar-today"
                  size={14}
                  color={COLORS.onPrimary}
                />
              )}
              <Text
                style={[
                  styles.monthTabText,
                  active && styles.monthTabTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. Monthly Financial Overview Hero Card (_29/code.html lines 52-95) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTopLabel}>موقف الميزانية التشغيلية</Text>
          <View style={styles.surplusPill}>
            <View style={styles.surplusDot} />
            <Text style={styles.surplusPillText}>
              رصيد الصندوق: {currentBuilding.fund_balance.toLocaleString()} ج.م
            </Text>
          </View>
        </View>

        <View style={styles.comparisonGrid}>
          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons
                name="call-made"
                size={15}
                color={COLORS.statusUnpaid}
              />
              <Text style={styles.compLabel}>المصروفات المنفذة</Text>
            </View>
            <Text style={styles.compSpentVal}>
              - {totalSpent.toLocaleString()} ج.م
            </Text>
          </View>

          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons
                name="call-received"
                size={15}
                color={COLORS.statusPaid}
              />
              <Text style={styles.compLabel}>المحصل من الملاك</Text>
            </View>
            <Text style={styles.compCollectedVal}>
              + {totalCollected.toLocaleString()} ج.م
            </Text>
          </View>
        </View>

        {/* Export PDF Button */}
        <TouchableOpacity
          style={styles.exportPdfBtn}
          onPress={handleExportPdf}
        >
          <MaterialIcons
            name="picture-as-pdf"
            size={17}
            color={COLORS.onPrimary}
          />
          <Text style={styles.exportPdfBtnText}>
            تصدير كشف الحساب المعتمد (PDF)
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Trust & Transparency Assurance Banner (_29/code.html lines 97-107) */}
      <View style={styles.trustBanner}>
        <View style={styles.trustIconBox}>
          <MaterialIcons
            name="verified-user"
            size={20}
            color={COLORS.secondary}
          />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.trustTitle}>مبدأ الشفافية المطلقة</Text>
          <Text style={styles.trustDesc}>
            كل قرش يتم إنفاقه موثق بإيصال رسمي ومعتمد من مجلس الإدارة، ومتاح
            للمعاينة المباشرة لجميع الشركاء بالبرج.
          </Text>
        </View>
      </View>

      {/* 5. Category Breakdown Horizontal Filters (_29/code.html lines 109-131) */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterHeading}>توزيع البنود المعتمدة</Text>
          <Text style={styles.filterCount}>
            {buildingExpenses.length} فواتير مقيدة
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {EXPENSE_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.catPill, active && styles.catPillActive]}
              >
                <Text
                  style={[
                    styles.catPillText,
                    active && styles.catPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 6. Detailed Expenses & Receipts Feed (_29/code.html lines 133-280) */}
      <View style={{ gap: 12 }}>
        {buildingExpenses.map((exp) => (
          <View
            key={exp.id}
            style={[
              styles.expenseCard,
              exp.is_system_generated && styles.systemExpenseCard,
            ]}
          >
            <View style={styles.expTopRow}>
              <View style={styles.expRightGroup}>
                <View
                  style={[
                    styles.expIconBox,
                    {
                      backgroundColor: exp.is_system_generated
                        ? COLORS.secondaryContainer
                        : 'rgba(239, 68, 68, 0.1)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      exp.is_system_generated
                        ? 'workspace-premium'
                        : 'receipt-long'
                    }
                    size={22}
                    color={
                      exp.is_system_generated
                        ? COLORS.onSecondaryContainer
                        : COLORS.statusUnpaid
                    }
                  />
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.expTitle}>{exp.title}</Text>
                  <View style={styles.expMetaRow}>
                    <View style={styles.expCategoryTag}>
                      <Text style={styles.expCategoryTagText}>
                        {exp.category}
                      </Text>
                    </View>
                    <Text style={styles.expDateText}>{exp.expense_date}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.expAmountText}>
                - {exp.amount.toLocaleString()} ج.م
              </Text>
            </View>

            {exp.description ? (
              <Text style={styles.expDescriptionText}>{exp.description}</Text>
            ) : null}

            {/* Attachment & Invoice Preview Strip */}
            <View style={styles.attachmentStrip}>
              <View style={styles.attachmentRight}>
                {exp.invoice_image_url ? (
                  <Image
                    source={{ uri: exp.invoice_image_url }}
                    style={styles.invoiceMiniThumb}
                  />
                ) : null}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.invoiceNumberTitle}>
                    فاتورة معتمدة {exp.invoice_number || '#INV-4921'}
                  </Text>
                  <View style={styles.verifiedStripLine}>
                    <MaterialIcons
                      name="check-circle"
                      size={13}
                      color={COLORS.secondary}
                    />
                    <Text style={styles.verifiedStripText}>
                      {exp.is_system_generated
                        ? 'قيد تلقائي عند تفعيل اشتراك التطبيق'
                        : 'معتمدة من مجلس الإدارة'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewInvoiceBtn}
                onPress={() => setSelectedInvoiceExpense(exp)}
              >
                <Text style={styles.viewInvoiceBtnText}>
                  عرض الفاتورة / الصورة
                </Text>
                <MaterialIcons
                  name="visibility"
                  size={14}
                  color={COLORS.onPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* ==================================================================== */}
      {/* Full-screen Invoice & Voucher Modal (Matches design/stitch_/_18/code.html) */}
      {/* ==================================================================== */}
      <BottomSheetModal
        visible={Boolean(selectedInvoiceExpense)}
        title="معاينة الفاتورة وسند الصرف المعتمد"
        subtitle={
          selectedInvoiceExpense
            ? `${selectedInvoiceExpense.title} • ${selectedInvoiceExpense.invoice_number || ''}`
            : ''
        }
        onClose={() => setSelectedInvoiceExpense(null)}
      >
        {selectedInvoiceExpense && (
          <View style={styles.invoiceModalContent}>
            <View style={styles.invoiceMetaRow}>
              <View style={styles.invoiceMetaItem}>
                <Text style={styles.invoiceMetaLabel}>المبلغ المخصوم</Text>
                <Text style={styles.invoiceMetaAmount}>
                  - {selectedInvoiceExpense.amount.toLocaleString()} ج.م
                </Text>
              </View>
              <View style={styles.invoiceMetaItem}>
                <Text style={styles.invoiceMetaLabel}>رقم سند الصرف</Text>
                <Text style={styles.invoiceMetaVal}>
                  {selectedInvoiceExpense.voucher_number || 'PC-2024-884'}
                </Text>
              </View>
              <View style={styles.invoiceMetaItem}>
                <Text style={styles.invoiceMetaLabel}>تاريخ الصرف</Text>
                <Text style={styles.invoiceMetaVal}>
                  {selectedInvoiceExpense.expense_date}
                </Text>
              </View>
            </View>

            {selectedInvoiceExpense.invoice_image_url && (
              <Image
                source={{ uri: selectedInvoiceExpense.invoice_image_url }}
                style={styles.fullInvoiceImg}
                resizeMode="cover"
              />
            )}
          </View>
        )}
      </BottomSheetModal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  pageSubtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  auditPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 108, 73, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  auditPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  monthsScrollRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  monthTab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  monthTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  monthTabTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTopLabel: {
    fontSize: 12,
    color: COLORS.onPrimaryContainer,
  },
  surplusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  surplusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondaryFixed,
  },
  surplusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondaryFixed,
  },
  comparisonGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  compBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-end',
  },
  compHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  compLabel: {
    fontSize: 11,
    color: COLORS.primaryFixedDim,
  },
  compSpentVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  compCollectedVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
  exportPdfBtn: {
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exportPdfBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  trustBanner: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  trustIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 108, 73, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  trustDesc: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  filterSection: {
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  filterCount: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  categoriesScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  catPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  catPillTextActive: {
    color: COLORS.onPrimary,
    fontWeight: '700',
  },
  expenseCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  systemExpenseCard: {
    borderColor: COLORS.secondary,
    borderWidth: 1.5,
  },
  expTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  expRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  expIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  expMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  expCategoryTag: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expCategoryTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  expDateText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  expAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.statusUnpaid,
  },
  expDescriptionText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  attachmentStrip: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachmentRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  invoiceMiniThumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  invoiceNumberTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  verifiedStripLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedStripText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  viewInvoiceBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  viewInvoiceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  invoiceModalContent: {
    gap: 14,
  },
  invoiceMetaRow: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
  },
  invoiceMetaItem: {
    alignItems: 'center',
  },
  invoiceMetaLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  invoiceMetaAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.statusUnpaid,
    marginTop: 2,
  },
  invoiceMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  fullInvoiceImg: {
    width: '100%',
    height: 340,
    borderRadius: 14,
  },
});
