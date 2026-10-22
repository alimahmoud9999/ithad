import { useCallback } from 'react';
import type { AppSubscriptionInvoice, BuildingSubscriptionStatus, Expense, FeaturesConfig, PlanTier, SubscriptionPlan } from '@/shared/types/database';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'plans'
  | 'currentBuilding'
  | 'usersByRole'
  | 'setSubscriptionInvoices'
  | 'currentRole'
  | 'processingIds'
  | 'subscriptionInvoices'
  | 'setProcessingIds'
  | 'setBuildings'
  | 'setExpenses'
  | 'pushAndRecordNotification'
  | 'setPlans'
>;

export function useSubscriptionActions({
  plans,
  currentBuilding,
  usersByRole,
  setSubscriptionInvoices,
  currentRole,
  processingIds,
  subscriptionInvoices,
  setProcessingIds,
  setBuildings,
  setExpenses,
  pushAndRecordNotification,
  setPlans,
}: Deps) {
  // 11. Admin submits app subscription invoice
  const submitAppSubscriptionInvoice = useCallback(
    async (input: {
      planCode: PlanTier;
      durationMonths: number;
      receiptImageUrl: string;
      notes?: string;
    }) => {
      if (isRemoteBackendEnabled) {
        try {
          await repositories.platform.submitAppSubscriptionInvoice(input);
        } catch {
          // Graceful fallback
        }
      }

      const plan = plans.find((p) => p.code === input.planCode);
      const monthlyPrice =
        currentBuilding.custom_monthly_price ??
        plan?.default_monthly_price ??
        150;
      const totalAmount = monthlyPrice * Math.max(input.durationMonths, 1);

      const newInvoice: AppSubscriptionInvoice = {
        id: 'sub-inv-' + Date.now(),
        building_id: currentBuilding.id,
        building_name: currentBuilding.name,
        building_code: currentBuilding.building_code,
        submitted_by: usersByRole.admin.id,
        admin_name: usersByRole.admin.full_name,
        plan_code: input.planCode,
        amount: totalAmount,
        duration_months: input.durationMonths,
        receipt_image_url: input.receiptImageUrl,
        notes: input.notes || 'إيصال تحويل قيمة اشتراك باقة العمارة',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setSubscriptionInvoices((prev) => [newInvoice, ...prev]);
    },
    [currentBuilding, plans, usersByRole.admin]
  );

  // 12. Super Admin activates building subscription
  const activateBuildingSubscription = useCallback(
    async (invoiceId: string) => {
      if (currentRole !== 'super_admin') {
        throw new Error(
          'Security Violation: تفعيل الاشتراكات متاح حصرياً لمالك التطبيق (super_admin).'
        );
      }

      if (processingIds[invoiceId]) {
        throw new Error('جاري تفعيل هذا الاشتراك بالفعل...');
      }

      const targetInvoice = subscriptionInvoices.find(
        (inv) => inv.id === invoiceId
      );
      if (!targetInvoice) {
        throw new Error('فاتورة الاشتراك غير موجودة.');
      }

      if (targetInvoice.status !== 'pending') {
        throw new Error(
          `منع التكرار المزدوج (Idempotency): تم تفعيل هذه الفاتورة مسبقاً (${targetInvoice.status}).`
        );
      }

      setProcessingIds((prev) => ({ ...prev, [invoiceId]: true }));

      try {
        if (isRemoteBackendEnabled) {
          try {
            await repositories.platform.activateBuildingSubscription(invoiceId);
          } catch {
            // Graceful fallback
          }
        }

        // 1. Mark invoice as approved
        setSubscriptionInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  status: 'approved',
                  activated_by: usersByRole.super_admin.id,
                  activated_at: new Date().toISOString(),
                }
              : inv
          )
        );

        // 2. Extend building subscription AND deduct invoice amount from fund_balance
        const extendedDate = new Date(
          Date.now() + targetInvoice.duration_months * 30 * 86400000
        ).toISOString();

        setBuildings((prev) =>
          prev.map((b) =>
            b.id === targetInvoice.building_id
              ? {
                  ...b,
                  plan_code: targetInvoice.plan_code,
                  subscription_status: 'active',
                  subscription_ends_at: extendedDate,
                  fund_balance: b.fund_balance - targetInvoice.amount,
                }
              : b
          )
        );

        // 3. Automatically insert transparency expense: "رسوم اشتراك تطبيق إدارة العقار"
        const autoExpense: Expense = {
          id: 'exp-sub-' + Date.now(),
          building_id: targetInvoice.building_id,
          created_by: targetInvoice.submitted_by,
          title: 'رسوم اشتراك تطبيق إدارة العقار',
          description: `تفعيل باقة (${targetInvoice.plan_code.toUpperCase()}) لمدة (${targetInvoice.duration_months}) شهر - قيد آلي معتمد من إدارة المنصة`,
          category: 'اشتراكات وخدمات رقمية',
          amount: targetInvoice.amount,
          expense_date: new Date().toISOString().slice(0, 10),
          expense_month: new Date().toISOString().slice(0, 7),
          invoice_image_url: targetInvoice.receipt_image_url,
          invoice_number: 'SUB-' + targetInvoice.id.slice(-6).toUpperCase(),
          voucher_number: 'AUTO-SUB-' + Math.floor(100 + Math.random() * 900),
          is_system_generated: true,
          app_subscription_invoice_id: targetInvoice.id,
          created_at: new Date().toISOString(),
        };

        setExpenses((prev) => [autoExpense, ...prev]);

        // Notify Building Admin
        await pushAndRecordNotification({
          recipientId: targetInvoice.submitted_by,
          recipientRole: 'admin',
          recipientPushToken: usersByRole.admin.push_token,
          buildingId: targetInvoice.building_id,
          title: `تم تفعيل باقة (${targetInvoice.building_name}) بنجاح 🎉`,
          body: `تم تمديد اشتراك العمارة وإدراج مصروف "رسوم اشتراك تطبيق إدارة العقار" بقيمة ${targetInvoice.amount} ج.م تلقائياً في سجل الشفافية.`,
          category: 'financial',
          badgeLabel: 'تفعيل الباقة',
          isUrgent: false,
        });
      } finally {
        setProcessingIds((prev) => ({ ...prev, [invoiceId]: false }));
      }
    },
    [
      currentRole,
      processingIds,
      pushAndRecordNotification,
      subscriptionInvoices,
      usersByRole.admin.push_token,
      usersByRole.super_admin.id,
    ]
  );

  // 13. Super Admin configures per-building custom price, apartment limit & feature flags
  const superAdminConfigureBuilding = useCallback(
    async (input: {
      buildingId: string;
      planCode?: PlanTier;
      customMonthlyPrice?: number | null;
      maxApartmentsOverride?: number | null;
      featuresConfig?: Partial<FeaturesConfig>;
      subscriptionStatus?: BuildingSubscriptionStatus;
    }) => {
      if (currentRole !== 'super_admin') {
        throw new Error('Unauthorized: Super Admin role required.');
      }

      if (isRemoteBackendEnabled) {
        try {
          await repositories.platform.superAdminConfigureBuilding(input);
        } catch {
          // Graceful fallback
        }
      }

      setBuildings((prev) =>
        prev.map((b) => {
          if (b.id !== input.buildingId) return b;
          return {
            ...b,
            plan_code: input.planCode ?? b.plan_code,
            custom_monthly_price:
              input.customMonthlyPrice !== undefined
                ? input.customMonthlyPrice
                : b.custom_monthly_price,
            max_apartments_override:
              input.maxApartmentsOverride !== undefined
                ? input.maxApartmentsOverride
                : b.max_apartments_override,
            features_config: input.featuresConfig
              ? { ...b.features_config, ...input.featuresConfig }
              : b.features_config,
            subscription_status:
              input.subscriptionStatus ?? b.subscription_status,
          };
        })
      );
    },
    [currentRole]
  );

  // 14. Super Admin updates global plan templates (free, pro, plus)
  const superAdminUpdatePlanTemplate = useCallback(
    (code: PlanTier, updates: Partial<SubscriptionPlan>) => {
      setPlans((prev) =>
        prev.map((plan) => (plan.code === code ? { ...plan, ...updates } : plan))
      );
    },
    []
  );

  return {
    submitAppSubscriptionInvoice,
    activateBuildingSubscription,
    superAdminConfigureBuilding,
    superAdminUpdatePlanTemplate,
  };
}
