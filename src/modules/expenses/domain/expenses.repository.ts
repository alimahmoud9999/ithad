import type { RepoResult, RowPatch } from '@/data/result';
import type { Expense } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface ExpensesRepository {
  /**
   * Admin records a building expense and deducts from fund_balance
   */
  recordBuildingExpense(params: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    expenseDate?: string;
    invoiceImageUrl?: string | null;
    invoiceNumber?: string | null;
    voucherNumber?: string | null;
  }): Promise<RepoResult<any>>;

  list(): Promise<RepoResult<Expense[]>>;
}
