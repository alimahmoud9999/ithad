import { useCallback } from 'react';
import type { ClaimDistributionType, EmergencyClaim, Expense } from '@/shared/types/database';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'isCurrentBuildingWritable'
  | 'currentBuilding'
  | 'apartments'
  | 'usersByRole'
  | 'setEmergencyClaims'
  | 'pushAndRecordNotification'
  | 'emergencyClaims'
  | 'setExpenses'
  | 'setBuildings'
>;

export function useEmergencyActions({
  isCurrentBuildingWritable,
  currentBuilding,
  apartments,
  usersByRole,
  setEmergencyClaims,
  pushAndRecordNotification,
  emergencyClaims,
  setExpenses,
  setBuildings,
}: Deps) {
  // 8. Admin creates emergency claim
  const createEmergencyClaim = useCallback(
    async (input: {
      title: string;
      description: string;
      category: string;
      targetAmount: number;
      distributionType: ClaimDistributionType;
      dueDate?: string;
      defaultShareAmount?: number;
      distributionMode?: 'occupied_only' | 'all_units' | 'equal' | 'custom';
      customShares?: Array<{ apartment_id: string; amount: number }>;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }
      if (!currentBuilding.features_config.emergency_claims) {
        throw new Error(
          'ميزة المطالبات الطارئة غير مفعلة في باقة العمارة الحالية.'
        );
      }

      const occupiedApts = apartments.filter(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.is_active &&
          (Boolean(a.resident_id) ||
            (a.occupant_name &&
              a.occupant_name.trim() !== '' &&
              a.occupant_name !== 'وحدة شاغرة' &&
              a.occupant_name !== 'شاغرة'))
      );
      const isOccupiedOnly = input.distributionMode === 'occupied_only';
      const denominator = isOccupiedOnly
        ? Math.max(occupiedApts.length, 1)
        : Math.max(currentBuilding.total_apartments, 1);

      const shareAmount =
        input.defaultShareAmount ??
        Math.round((input.targetAmount / denominator) * 100) / 100;

      let serverClaimId: string | null = null;
      if (isRemoteBackendEnabled) {
        try {
          const rpcRes = await repositories.emergency.createEmergencyClaim({
            title: input.title,
            description: input.description,
            category: input.category,
            targetAmount: input.targetAmount,
            distributionType: input.distributionType,
            customShares: input.customShares,
            dueDate: input.dueDate,
            defaultShareAmount: shareAmount,
            occupiedOnly: isOccupiedOnly,
          });
          if (rpcRes?.data?.claim_id) {
            serverClaimId = String(rpcRes.data.claim_id);
          }
        } catch (rpcErr) {
          console.warn('createEmergencyClaim error:', rpcErr);
          throw rpcErr;
        }
      }

      const assignedClaimId = serverClaimId || ('clm-' + Date.now());
      const newClaim: EmergencyClaim = {
        id: assignedClaimId,
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        target_amount: input.targetAmount,
        collected_amount: 0,
        distribution_type: input.distributionType,
        default_share_amount: shareAmount,
        due_date: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'active',
        contributors_count: 0,
        created_at: new Date().toISOString(),
      };

      setEmergencyClaims((prev) => [newClaim, ...prev]);

      // Notify all residents of the new emergency claim
      await pushAndRecordNotification({
        recipientId: usersByRole.resident.id,
        recipientRole: 'resident',
        recipientPushToken: usersByRole.resident.push_token,
        buildingId: currentBuilding.id,
        title: `مطالبة صيانة طارئة جديدة: ${input.title.trim()} 🚨`,
        body: `تم إطلاق مطالبة طارئة بإجمالي ${input.targetAmount.toLocaleString()} ج.م (نصيب الوحدة: ${shareAmount.toLocaleString()} ج.م). يرجى المساهمة عبر التطبيق.`,
        category: 'maintenance',
        badgeLabel: 'طوارئ عاجلة',
        isUrgent: true,
        metadata: {
          amount: shareAmount,
        },
      });
    },
    [
      apartments,
      currentBuilding,
      isCurrentBuildingWritable,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // 8B. Admin closes an emergency claim with a compressed official invoice
  const closeEmergencyClaimWithInvoice = useCallback(
    async (input: {
      claimId: string;
      invoiceImageUrl: string;
      actualAmount?: number;
      invoiceNumber?: string;
      notes?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      const targetClaim = emergencyClaims.find((c) => c.id === input.claimId);
      if (!targetClaim) {
        throw new Error('المطالبة الطارئة غير موجودة.');
      }

      const finalAmount =
        input.actualAmount && input.actualAmount > 0
          ? input.actualAmount
          : targetClaim.collected_amount || targetClaim.target_amount;

      if (isRemoteBackendEnabled) {
        try {
          await repositories.expenses.recordBuildingExpense({
            title: `إغلاق مطالبة طارئة: ${targetClaim.title}`,
            amount: finalAmount,
            category: targetClaim.category || 'صيانة ومصاعد',
            description:
              input.notes?.trim() ||
              `فاتورة إقفال المطالبة الاستثنائية (${targetClaim.title})`,
            invoiceImageUrl: input.invoiceImageUrl,
            invoiceNumber: input.invoiceNumber,
          });
        } catch {
          // Graceful fallback
        }
      }

      setEmergencyClaims((prev) =>
        prev.map((c) =>
          c.id === input.claimId ? { ...c, status: 'completed' } : c
        )
      );

      const closingExpense: Expense = {
        id: 'exp-clm-' + Date.now(),
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: `إغلاق مطالبة طارئة: ${targetClaim.title}`,
        description:
          input.notes?.trim() ||
          `فاتورة إقفال المطالبة الاستثنائية (${targetClaim.title})`,
        category: targetClaim.category || 'صيانة ومصاعد',
        amount: finalAmount,
        expense_date: new Date().toISOString().slice(0, 10),
        expense_month: new Date().toISOString().slice(0, 7),
        invoice_image_url: input.invoiceImageUrl,
        invoice_number:
          input.invoiceNumber?.trim() ||
          '#CLM-' + Math.floor(1000 + Math.random() * 9000),
        voucher_number: 'PC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
        is_system_generated: false,
        created_at: new Date().toISOString(),
      };

      setExpenses((prev) => [closingExpense, ...prev]);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance - finalAmount }
            : b
        )
      );
    },
    [
      currentBuilding.id,
      emergencyClaims,
      isCurrentBuildingWritable,
      usersByRole.admin.id,
    ]
  );

  return { createEmergencyClaim, closeEmergencyClaimWithInvoice };
}
