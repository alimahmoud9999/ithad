import { useMemo } from 'react';
import { useAppStore } from '@/store/AppContext';
import type { LedgerFilter } from '../domain/expenses.types';

/** Expense feed + treasury ledger figures for the current building. */
export function useTreasurySummary(selectedCategory: string, ledgerFilter: LedgerFilter) {
  const { currentBuilding, expenses, payments } = useAppStore();

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

  return {
    buildingExpenses,
    totalSpent,
    approvedPayments,
    totalCollected,
    monthlyTargetBudget,
    consumptionPercent,
    surplusAmount,
    cashInSafe,
    bankBalance,
    ledgerTransactions,
  };
}
