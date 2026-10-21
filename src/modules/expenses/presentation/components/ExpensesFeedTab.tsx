import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, Text, View, Image, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Expense } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import { MONTHS_TABS, EXPENSE_CATEGORIES } from '../../domain/expenses.constants';
import type { MainTab } from '../../domain/expenses.types';
import { styles } from '../TransparencyExpensesScreen.styles';

interface ExpensesFeedTabProps {
  activeMainTab: MainTab;
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setSelectedInvoiceExpense: React.Dispatch<React.SetStateAction<Expense | null>>;
  buildingExpenses: Expense[];
  consumptionPercent: number;
  monthlyTargetBudget: number;
  surplusAmount: number;
  totalCollected: number;
  totalSpent: number;
}

export const ExpensesFeedTab: React.FC<ExpensesFeedTabProps> = ({
  activeMainTab,
  selectedCategory,
  setSelectedCategory,
  setSelectedInvoiceExpense,
  buildingExpenses,
  consumptionPercent,
  monthlyTargetBudget,
  surplusAmount,
  totalCollected,
  totalSpent,
}) => {
  const { currentBuilding } = useAppStore();

  const [selectedMonth, setSelectedMonth] = useState('2024-11');

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
      `تم تجهيز كشف الحساب المالي والتدقيق المعتمد لـ (${currentBuilding.name}) شاملاً (${buildingExpenses.length}) فواتير موثقة وسندات الصرف الرسمية.`
    );
  };

  return (
    activeMainTab === 'expenses_feed' && (
    <>
      {/* Horizontal Month Selector */}
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
                <MaterialIcons name="calendar-today" size={14} color={COLORS.onPrimary} />
              )}
              <Text style={[styles.monthTabText, active && styles.monthTabTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Monthly Financial Overview Hero Card (design/_24 lines 52-95) */}
      <View style={styles.heroCard}>
        {/* Surplus Highlight Badge */}
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTopLabel}>موقف الميزانية التشغيلية</Text>
          <View style={styles.surplusPill}>
            <View style={styles.surplusDot} />
            <Text style={styles.surplusPillText}>
              فائض محتجز: + {surplusAmount.toLocaleString()} ج.م
            </Text>
          </View>
        </View>

        {/* Core Totals Comparison */}
        <View style={styles.comparisonGrid}>
          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons name="arrow-outward" size={15} color={COLORS.statusUnpaid} />
              <Text style={styles.compLabel}>المصروفات المنفذة</Text>
            </View>
            <Text style={styles.compSpentVal}>- {totalSpent.toLocaleString()} ج.م</Text>
          </View>

          <View style={styles.compBox}>
            <View style={styles.compHeader}>
              <MaterialIcons name="arrow-downward" size={15} color={COLORS.secondaryFixed} />
              <Text style={styles.compLabel}>المحصل من الملاك</Text>
            </View>
            <Text style={styles.compCollectedVal}>+ {totalCollected.toLocaleString()} ج.م</Text>
          </View>
        </View>

        {/* Budget Consumption Progress Gauge (design/_24 lines 84-93) */}
        <View style={styles.budgetGaugeBlock}>
          <View style={styles.gaugeLabelsRow}>
            <Text style={styles.gaugeLabelText}>استهلاك الميزانية المعتمدة لهذا الشهر</Text>
            <Text style={styles.gaugeValText}>
              {consumptionPercent}% (تم صرف {totalSpent.toLocaleString()} من{' '}
              {monthlyTargetBudget.toLocaleString()} ج.م)
            </Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: `${consumptionPercent}%` }]} />
          </View>
        </View>

        {/* Export PDF Button (Screen 25: design/pdf) */}
        <TouchableOpacity style={styles.exportPdfBtn} onPress={handleExportPdf}>
          <MaterialIcons name="picture-as-pdf" size={17} color={COLORS.onPrimary} />
          <Text style={styles.exportPdfBtnText}>تصدير كشف الحساب المالي المعتمد (PDF)</Text>
        </TouchableOpacity>
      </View>

      {/* Trust & Transparency Assurance Banner (design/_24 lines 97-107) */}
      <View style={styles.trustBanner}>
        <View style={styles.trustIconBox}>
          <MaterialIcons name="verified-user" size={20} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.trustTitle}>مبدأ الشفافية المطلقة</Text>
          <Text style={styles.trustDesc}>
            كل قرش يتم إنفاقه موثق بإيصال رسمي ومعتمد من مجلس الإدارة، ومتاح للمعاينة المباشرة
            لجميع الشركاء بالبرج لضمان النزاهة وحفظ الحقوق.
          </Text>
        </View>
      </View>

      {/* Category Breakdown Horizontal Filters */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterHeading}>توزيع البنود المعتمدة</Text>
          <Text style={styles.filterCount}>{buildingExpenses.length} فواتير مقيدة</Text>
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
                <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Detailed Expenses & Receipts Feed (design/_24 lines 133-172) */}
      <View style={{ gap: 12 }}>
        {buildingExpenses.length > 0 ? (
          buildingExpenses.map((exp) => (
            <View
              key={exp.id}
              style={[styles.expenseCard, exp.is_system_generated && styles.systemExpenseCard]}
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
                        exp.category.includes('مصاعد')
                          ? 'elevator'
                          : exp.category.includes('رواتب')
                          ? 'badge'
                          : exp.category.includes('كهرباء')
                          ? 'bolt'
                          : exp.category.includes('مياه')
                          ? 'water-drop'
                          : exp.is_system_generated
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
                        <Text style={styles.expCategoryTagText}>{exp.category}</Text>
                      </View>
                      <Text style={styles.expDateText}>{exp.expense_date}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.expAmountText}>- {exp.amount.toLocaleString()} ج.م</Text>
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
                  ) : (
                    <View style={styles.noThumbBox}>
                      <MaterialIcons name="receipt" size={16} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invoiceNumberTitle}>
                      فاتورة معتمدة {exp.invoice_number || '#INV-4921'}
                    </Text>
                    <View style={styles.verifiedStripLine}>
                      <MaterialIcons name="check-circle" size={13} color={COLORS.secondary} />
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
                  <Text style={styles.viewInvoiceBtnText}>عرض الفاتورة</Text>
                  <MaterialIcons name="visibility" size={14} color={COLORS.onPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyStateBox}>
            <MaterialIcons name="search-off" size={40} color={COLORS.onSurfaceVariant} />
            <Text style={styles.emptyStateText}>
              لا توجد فواتير مقيدة في هذا التصنيف لهذا الشهر.
            </Text>
          </View>
        )}
      </View>
    </>
    )
  ) || null;
};
