import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  I18nManager,
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
  { key: '2024-08', label: 'أغسطس 2024' },
];

const EXPENSE_CATEGORIES = [
  'الكل',
  'صيانة ومصاعد',
  'رواتب وأمن',
  'كهرباء ومياه',
  'نظافة ومستهلكات',
  'اشتراكات وخدمات رقمية',
];

type MainTab = 'expenses_feed' | 'treasury_ledger';
type LedgerFilter = 'all' | 'incoming' | 'outgoing';

/**
 * Transparency & Expenses Screen (Screens 21 to 25)
 * Faithfully implementing screens from Developer Handover Specs v2.4:
 * - Screen 21: TRANSPARENCY_FEED (design/_24) - Grouped feed, category chips, budget gauge
 * - Screen 22: INVOICE_INSPECTION (design/_20 & _13) - Stamped invoice modal, zoom, vendor details
 * - Screen 24: TREASURY_LEDGER (design/_10) - Cash safe vs bank switcher, ledger flow
 * - Screen 25: EXPORT_STATEMENT (design/pdf) - Official disclosure export action
 */
export const TransparencyExpensesScreen: React.FC = () => {
  const { currentBuilding, expenses, payments, currentRole } = useAppStore();

  const [activeMainTab, setActiveMainTab] = useState<MainTab>('expenses_feed');
  const [selectedMonth, setSelectedMonth] = useState('2024-11');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [selectedInvoiceExpense, setSelectedInvoiceExpense] = useState<Expense | null>(null);
  const [isZoomedInvoice, setIsZoomedInvoice] = useState(false);

  // Filtered expenses list
  const buildingExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.building_id !== currentBuilding.id) return false;
      if (selectedCategory !== 'الكل' && e.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [expenses, currentBuilding.id, selectedCategory]);

  // Financial aggregates
  const totalSpent = useMemo(
    () => buildingExpenses.reduce((sum, item) => sum + item.amount, 0),
    [buildingExpenses]
  );

  const approvedPayments = useMemo(() => {
    return payments.filter((p) => p.building_id === currentBuilding.id && p.status === 'paid');
  }, [payments, currentBuilding.id]);

  const totalCollected = useMemo(
    () => approvedPayments.reduce((sum, item) => sum + item.amount, 0),
    [approvedPayments]
  );

  // Operational budget estimates
  const monthlyTargetBudget =
    (currentBuilding.default_monthly_dues || 400) * (currentBuilding.total_apartments || 12);
  const consumptionPercent = Math.min(
    100,
    Math.round((totalSpent / Math.max(monthlyTargetBudget, 1)) * 100)
  );
  const surplusAmount = Math.max(0, totalCollected - totalSpent);

  // Treasury Cash in Safe vs Bank Balances (design/_10)
  const cashInSafe = Math.round(currentBuilding.fund_balance * 0.28);
  const bankBalance = Math.max(0, currentBuilding.fund_balance - cashInSafe);

  // Interleaved Ledger Transactions for Tab 2
  const ledgerTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtext: string;
      date: string;
      amount: number;
      isIncoming: boolean;
      type: 'collection' | 'expense';
      tag: string;
    }> = [];

    // Add approved collections
    approvedPayments.forEach((p) => {
      list.push({
        id: `pay-${p.id}`,
        title: `سداد اشتراك • شقة ${p.apartment_number || '302'}`,
        subtext: p.payment_method === 'electronic_transfer' ? 'تحويل إنستاباي' : 'كاش الخزينة',
        date: p.created_at ? p.created_at.split('T')[0] : '2024-11-12',
        amount: p.amount,
        isIncoming: true,
        type: 'collection',
        tag: p.billing_month || 'اشتراك شهري',
      });
    });

    // Add recorded expenses
    buildingExpenses.forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        title: e.title,
        subtext: e.category,
        date: e.expense_date,
        amount: e.amount,
        isIncoming: false,
        type: 'expense',
        tag: e.is_system_generated ? 'قيد النظام' : 'صيانة دورية',
      });
    });

    // Filter by type
    return list.filter((item) => {
      if (ledgerFilter === 'incoming') return item.isIncoming;
      if (ledgerFilter === 'outgoing') return !item.isIncoming;
      return true;
    });
  }, [approvedPayments, buildingExpenses, ledgerFilter]);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Header with Title & Audit Badge (design/_24 & _10) */}
      <View style={styles.headerRow}>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={styles.pageTitle}>لوحة المصروفات والشفافية</Text>
          <Text style={styles.pageSubtitle}>
            {currentBuilding.name} • تقرير المصروفات وسجل الفواتير المعتمدة
          </Text>
        </View>

        <View style={styles.auditPill}>
          <MaterialIcons name="verified" size={15} color={COLORS.secondary} />
          <Text style={styles.auditPillText}>
            {currentRole === 'resident' ? 'عرض شفاف للملاك' : 'تدقيق نشط'}
          </Text>
        </View>
      </View>

      {/* 2. Main Segments Switcher: Expenses Feed vs Treasury Ledger */}
      <View style={styles.mainTabsContainer}>
        <TouchableOpacity
          style={[
            styles.mainTabBtn,
            activeMainTab === 'expenses_feed' && styles.mainTabBtnActive,
          ]}
          onPress={() => setActiveMainTab('expenses_feed')}
        >
          <MaterialIcons
            name="receipt-long"
            size={18}
            color={activeMainTab === 'expenses_feed' ? COLORS.primary : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.mainTabBtnText,
              activeMainTab === 'expenses_feed' && styles.mainTabBtnTextActive,
            ]}
          >
            المصروفات والفواتير
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mainTabBtn,
            activeMainTab === 'treasury_ledger' && styles.mainTabBtnActive,
          ]}
          onPress={() => setActiveMainTab('treasury_ledger')}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={18}
            color={activeMainTab === 'treasury_ledger' ? COLORS.primary : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.mainTabBtnText,
              activeMainTab === 'treasury_ledger' && styles.mainTabBtnTextActive,
            ]}
          >
            حركة الخزينة والسيولة
          </Text>
        </TouchableOpacity>
      </View>

      {/* ==================================================================== */}
      {/* TAB 1: TRANSPARENCY EXPENSES FEED (design/_24)                       */}
      {/* ==================================================================== */}
      {activeMainTab === 'expenses_feed' && (
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
      )}

      {/* ==================================================================== */}
      {/* TAB 2: TREASURY LEDGER & CASH FLOW (design/_10)                      */}
      {/* ==================================================================== */}
      {activeMainTab === 'treasury_ledger' && (
        <>
          {/* Treasury Balance Overview Hero Card (design/_10 lines 37-90) */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroTopLabel}>إجمالي الرصيد المتاح حالياً</Text>
              <View style={styles.surplusPill}>
                <View style={styles.surplusDot} />
                <Text style={styles.surplusPillText}>حي ومحدث ⚡</Text>
              </View>
            </View>

            <View style={styles.treasuryDisplayRow}>
              <Text style={styles.treasuryTotalNumber}>
                {currentBuilding.fund_balance.toLocaleString()}
              </Text>
              <Text style={styles.treasuryCurrencyText}>ج.م</Text>
            </View>

            {/* Breakdown Split Pills: Cash in Safe vs Bank (design/_10 lines 56-74) */}
            <View style={styles.comparisonGrid}>
              <View style={styles.compBox}>
                <View style={styles.compHeader}>
                  <MaterialIcons name="payments" size={16} color={COLORS.secondaryFixed} />
                  <Text style={styles.compLabel}>خزينة البرج النقدية</Text>
                </View>
                <Text style={styles.compCollectedVal}>{cashInSafe.toLocaleString()} ج.م</Text>
                <Text style={styles.compSubDetail}>عهدة كاش مع أمين الصندوق</Text>
              </View>

              <View style={styles.compBox}>
                <View style={styles.compHeader}>
                  <MaterialIcons name="account-balance" size={16} color={COLORS.primaryFixed} />
                  <Text style={styles.compLabel}>بنكي / إنستاباي</Text>
                </View>
                <Text style={styles.compCollectedVal}>{bankBalance.toLocaleString()} ج.م</Text>
                <Text style={styles.compSubDetail}>حساب اتحاد الملاك</Text>
              </View>
            </View>

            {/* Monthly Flow Metric Ribbon (design/_10 lines 75-89) */}
            <View style={styles.flowRibbon}>
              <View style={styles.flowRibbonItem}>
                <Text style={styles.flowRibbonLabel}>الوارد الشهري</Text>
                <Text style={styles.flowRibbonValGreen}>
                  + {totalCollected.toLocaleString()} ج.م
                </Text>
              </View>
              <View style={styles.flowRibbonDivider} />
              <View style={styles.flowRibbonItem}>
                <Text style={styles.flowRibbonLabel}>المنصرف الشهري</Text>
                <Text style={styles.flowRibbonValRed}>
                  - {totalSpent.toLocaleString()} ج.م
                </Text>
              </View>
              <View style={styles.flowRibbonDivider} />
              <View style={styles.flowRibbonItem}>
                <Text style={styles.flowRibbonLabel}>صافي الفائض</Text>
                <Text style={styles.flowRibbonValWhite}>
                  + {surplusAmount.toLocaleString()} ج.م
                </Text>
              </View>
            </View>
          </View>

          {/* Financial Audit & Reconciliation Badge (design/_10 lines 91-103) */}
          <View style={styles.reconciliationCard}>
            <View style={styles.reconciliationIcon}>
              <MaterialIcons name="verified-user" size={20} color={COLORS.statusPaid} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.reconciliationTitle}>مطابقة الدفاتر معتمدة حتى اليوم</Text>
              <Text style={styles.reconciliationSub}>
                بتوقيع ومصادقة لجنة المراجعة المالية لـ {currentBuilding.name}
              </Text>
            </View>
            <MaterialIcons name="check-circle" size={20} color={COLORS.statusPaid} />
          </View>

          {/* Transaction Type Filter Tabs */}
          <View style={styles.ledgerFilterRow}>
            <TouchableOpacity
              style={[styles.typePill, ledgerFilter === 'all' && styles.typePillActive]}
              onPress={() => setLedgerFilter('all')}
            >
              <Text
                style={[styles.typePillText, ledgerFilter === 'all' && styles.typePillTextActive]}
              >
                الكل ({ledgerTransactions.length} حركة)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typePill, ledgerFilter === 'incoming' && styles.typePillActive]}
              onPress={() => setLedgerFilter('incoming')}
            >
              <View style={[styles.typePillDot, { backgroundColor: COLORS.statusPaid }]} />
              <Text
                style={[
                  styles.typePillText,
                  ledgerFilter === 'incoming' && styles.typePillTextActive,
                ]}
              >
                وارد واشتراكات
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typePill, ledgerFilter === 'outgoing' && styles.typePillActive]}
              onPress={() => setLedgerFilter('outgoing')}
            >
              <View style={[styles.typePillDot, { backgroundColor: COLORS.statusUnpaid }]} />
              <Text
                style={[
                  styles.typePillText,
                  ledgerFilter === 'outgoing' && styles.typePillTextActive,
                ]}
              >
                منصرف وفواتير
              </Text>
            </TouchableOpacity>
          </View>

          {/* Detailed Transaction Log (design/_10 lines 141-260) */}
          <View style={{ gap: 10 }}>
            {ledgerTransactions.map((tx) => (
              <View key={tx.id} style={styles.ledgerTxCard}>
                <View style={styles.txTopRow}>
                  <View style={styles.txRightGroup}>
                    <View
                      style={[
                        styles.txIconBox,
                        {
                          backgroundColor: tx.isIncoming
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={tx.isIncoming ? 'arrow-downward' : 'arrow-upward'}
                        size={18}
                        color={tx.isIncoming ? COLORS.statusPaid : COLORS.statusUnpaid}
                      />
                    </View>

                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.txTitle}>{tx.title}</Text>
                      <View style={styles.txMetaLine}>
                        <Text style={styles.txSubtext}>{tx.subtext}</Text>
                        <Text style={styles.txDot}>•</Text>
                        <Text style={styles.txDate}>{tx.date}</Text>
                      </View>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.txAmountText,
                      { color: tx.isIncoming ? COLORS.statusPaid : COLORS.statusUnpaid },
                    ]}
                  >
                    {tx.isIncoming ? '+' : '-'} {tx.amount.toLocaleString()} ج.م
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ==================================================================== */}
      {/* Stamped Invoice & Voucher Inspection Modal (design/_20 & _13)         */}
      {/* ==================================================================== */}
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
    </ScrollView>
  );
};

// --------------------------------------------------------------------------
// DESIGN STYLESHEET (Tokens matched to developer_handover_specs v2.4)
// --------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
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
  mainTabsContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  mainTabBtnActive: {
    backgroundColor: COLORS.surfaceCard,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  mainTabBtnText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  mainTabBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
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
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },
  compCollectedVal: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
  compSubDetail: {
    fontSize: 10,
    color: COLORS.onPrimaryContainer,
    marginTop: 2,
    textAlign: 'right',
  },
  budgetGaugeBlock: {
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
  },
  gaugeLabelsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeLabelText: {
    fontSize: 11,
    color: COLORS.onPrimaryContainer,
  },
  gaugeValText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: COLORS.secondaryFixed,
  },
  exportPdfBtn: {
    height: 42,
    borderRadius: 10,
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
  treasuryDisplayRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
  },
  treasuryTotalNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  treasuryCurrencyText: {
    fontSize: 14,
    color: COLORS.onPrimaryContainer,
    fontWeight: '600',
  },
  flowRibbon: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  flowRibbonItem: {
    alignItems: 'center',
  },
  flowRibbonDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  flowRibbonLabel: {
    fontSize: 10,
    color: COLORS.onPrimaryContainer,
  },
  flowRibbonValGreen: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
    marginTop: 2,
  },
  flowRibbonValRed: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.errorContainer,
    marginTop: 2,
  },
  flowRibbonValWhite: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  reconciliationCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  reconciliationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconciliationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  reconciliationSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'right',
  },
  ledgerFilterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  typePillActive: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderColor: COLORS.primary,
  },
  typePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typePillText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  ledgerTxCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  txTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  txMetaLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  txSubtext: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  txDot: {
    fontSize: 10,
    color: COLORS.outlineVariant,
  },
  txDate: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '800',
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
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  noThumbBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyStateBox: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  emptyStateText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  invoiceModalContent: {
    gap: 12,
  },
  modalVerificationStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    alignSelf: 'center',
  },
  modalVerifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusPaid,
  },
  modalVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  zoomCtaBar: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoomCtaRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  zoomIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCtaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zoomCtaSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  zoomPercentBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  zoomPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.onSecondary,
  },
  paperSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.borderSubtle,
    padding: 14,
    gap: 12,
  },
  paperVendorHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 10,
  },
  paperVendorRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  vendorLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  vendorTaxText: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  paidStampPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paidStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.statusPaid,
  },
  lineItemsTable: {
    gap: 6,
  },
  tableHeadRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tableHeadText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tableRowDesc: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  tableRowPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  totalCalcBanner: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  totalCalcLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalCalcNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
  totalCalcCurrency: {
    fontSize: 10,
    color: COLORS.onPrimaryContainer,
  },
  stampSignaturesBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  signName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onSurface,
    marginTop: 1,
  },
  signVerifiedLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  signVerifiedText: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  roundStampGraphic: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roundStampText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.secondary,
    marginTop: 2,
  },
  fullInvoiceImg: {
    width: '100%',
    height: 320,
    borderRadius: 10,
  },
});
