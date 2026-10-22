import { useCallback } from 'react';
import type { Expense } from '@/shared/types/database';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'isCurrentBuildingWritable'
  | 'currentBuilding'
  | 'usersByRole'
  | 'setExpenses'
  | 'setBuildings'
>;

export function useExpenseActions({
  isCurrentBuildingWritable,
  currentBuilding,
  usersByRole,
  setExpenses,
  setBuildings,
}: Deps) {
  // 9. Admin records building expense & deducts from fund_balance
  const recordBuildingExpense = useCallback(
    async (input: {
      title: string;
      amount: number;
      category: string;
      description?: string;
      invoiceImageUrl?: string;
      invoiceNumber?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). لا يمكن إضافة مصروفات جديدة قبل تجديد الاشتراك.'
        );
      }

      if (isRemoteBackendEnabled) {
        try {
          await repositories.expenses.recordBuildingExpense(input);
        } catch {
          // Graceful fallback
        }
      }

      const newExpense: Expense = {
        id: 'exp-' + Date.now(),
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: input.title.trim(),
        description:
          input.description?.trim() || 'قيد مصروف معتمد من مجلس الاتحاد',
        category: input.category,
        amount: input.amount,
        expense_date: new Date().toISOString().slice(0, 10),
        expense_month: new Date().toISOString().slice(0, 7),
        invoice_image_url:
          input.invoiceImageUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        invoice_number:
          input.invoiceNumber ||
          '#INV-' + Math.floor(1000 + Math.random() * 9000),
        voucher_number: 'PC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
        is_system_generated: false,
        created_at: new Date().toISOString(),
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance - input.amount }
            : b
        )
      );
    },
    [currentBuilding.id, isCurrentBuildingWritable, usersByRole.admin.id]
  );

  return { recordBuildingExpense };
}
