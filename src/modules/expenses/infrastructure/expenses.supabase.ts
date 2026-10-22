import { supabase, toResult } from '@/data/supabase/client';
import type { Expense } from '@/shared/types/database';
import type { ExpensesRepository } from '../domain/expenses.repository';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseExpensesRepository: ExpensesRepository = {
  /**
   * Admin records a building expense and deducts from fund_balance
   */
  async recordBuildingExpense(params: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    expenseDate?: string;
    invoiceImageUrl?: string | null;
    invoiceNumber?: string | null;
    voucherNumber?: string | null;
  }) {
    return toResult(await supabase.rpc('record_building_expense', {
      p_title: params.title,
      p_amount: params.amount,
      p_category: params.category,
      p_description: params.description ?? null,
      p_expense_date: params.expenseDate ?? new Date().toISOString().slice(0, 10),
      p_invoice_image_url: params.invoiceImageUrl ?? null,
      p_invoice_number: params.invoiceNumber ?? null,
      p_voucher_number: params.voucherNumber ?? null,
    }));
  },

  async list() {
    return toResult<Expense[]>(await supabase.from('expenses').select('*').order('created_at', { ascending: false }));
  },
};
