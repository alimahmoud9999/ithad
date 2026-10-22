import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Expense } from '@/shared/types/database';
import { styles } from './TransparencyExpensesScreen.styles';
import type { MainTab, LedgerFilter } from '../domain/expenses.types';
import { useTreasurySummary } from '../application/useTreasurySummary';
import { InvoiceInspectionModal } from './components/InvoiceInspectionModal';
import { TreasuryLedgerTab } from './components/TreasuryLedgerTab';
import { ExpensesFeedTab } from './components/ExpensesFeedTab';
import { ExpensesTabSwitcher } from './components/ExpensesTabSwitcher';
import { ExpensesHeader } from './components/ExpensesHeader';

/**
 * Transparency & Expenses Screen (Screens 21 to 25)
 * Faithfully implementing screens from Developer Handover Specs v2.4:
 * - Screen 21: TRANSPARENCY_FEED (design/_24) - Grouped feed, category chips, budget gauge
 * - Screen 22: INVOICE_INSPECTION (design/_20 & _13) - Stamped invoice modal, zoom, vendor details
 * - Screen 24: TREASURY_LEDGER (design/_10) - Cash safe vs bank switcher, ledger flow
 * - Screen 25: EXPORT_STATEMENT (design/pdf) - Official disclosure export action
 */
export const TransparencyExpensesScreen: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('expenses_feed');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [selectedInvoiceExpense, setSelectedInvoiceExpense] = useState<Expense | null>(null);

  const {
    buildingExpenses,
    totalSpent,
    totalCollected,
    monthlyTargetBudget,
    consumptionPercent,
    surplusAmount,
    cashInSafe,
    bankBalance,
    ledgerTransactions,
  } = useTreasurySummary(selectedCategory, ledgerFilter);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Top Header with Title & Audit Badge (design/_24 & _10) */}
      <ExpensesHeader />

      {/* 2. Main Segments Switcher: Expenses Feed vs Treasury Ledger */}
      <ExpensesTabSwitcher activeMainTab={activeMainTab} setActiveMainTab={setActiveMainTab} />

      {/* ==================================================================== */}
      {/* TAB 1: TRANSPARENCY EXPENSES FEED (design/_24)                       */}
      {/* ==================================================================== */}
      <ExpensesFeedTab
        activeMainTab={activeMainTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        setSelectedInvoiceExpense={setSelectedInvoiceExpense}
        buildingExpenses={buildingExpenses}
        consumptionPercent={consumptionPercent}
        monthlyTargetBudget={monthlyTargetBudget}
        surplusAmount={surplusAmount}
        totalCollected={totalCollected}
        totalSpent={totalSpent}
      />

      {/* ==================================================================== */}
      {/* TAB 2: TREASURY LEDGER & CASH FLOW (design/_10)                      */}
      {/* ==================================================================== */}
      <TreasuryLedgerTab
        activeMainTab={activeMainTab}
        ledgerFilter={ledgerFilter}
        setLedgerFilter={setLedgerFilter}
        bankBalance={bankBalance}
        cashInSafe={cashInSafe}
        ledgerTransactions={ledgerTransactions}
        surplusAmount={surplusAmount}
        totalCollected={totalCollected}
        totalSpent={totalSpent}
      />

      {/* ==================================================================== */}
      {/* Stamped Invoice & Voucher Inspection Modal (design/_20 & _13)         */}
      {/* ==================================================================== */}
      <InvoiceInspectionModal
        selectedInvoiceExpense={selectedInvoiceExpense}
        setSelectedInvoiceExpense={setSelectedInvoiceExpense}
      />
    </ScrollView>
  );
};

