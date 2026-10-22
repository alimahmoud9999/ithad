import { supabase, toResult } from '@/data/supabase/client';
import type { Building, SubscriptionPlan } from '@/shared/types/database';
import type { PlatformRepository } from '../domain/platform.repository';
import type { BuildingSubscriptionStatus, FeaturesConfig, PlanTier } from '@/shared/types/database';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabasePlatformRepository: PlatformRepository = {
  /**
   * Admin uploads receipt to renew/activate the building's app subscription
   */
  async submitAppSubscriptionInvoice(params: {
    planCode: PlanTier;
    durationMonths: number;
    receiptImageUrl: string;
    notes?: string;
  }) {
    return toResult(await supabase.rpc('submit_app_subscription_invoice', {
      p_plan_code: params.planCode,
      p_duration_months: params.durationMonths,
      p_receipt_image_url: params.receiptImageUrl,
      p_notes: params.notes ?? null,
    }));
  },

  /**
   * Super Admin activates a building's subscription (via auth.uid()):
   * - Extends subscription_ends_at
   * - Automatically inserts an expense titled "رسوم اشتراك تطبيق إدارة العقار"
   *   and deducts it from the building's fund_balance.
   */
  async activateBuildingSubscription(invoiceId: string) {
    return toResult(await supabase.rpc('activate_building_subscription', {
      p_invoice_id: invoiceId,
    }));
  },

  /**
   * Super Admin rejects a building's app subscription invoice (via auth.uid()):
   * - Sets invoice status to 'rejected'
   * - Records rejection reason and notifies the building admin
   */
  async rejectAppSubscriptionInvoice(invoiceId: string, rejectionReason?: string) {
    return toResult(await (supabase.rpc as any)('reject_app_subscription_invoice', {
      p_invoice_id: invoiceId,
      p_rejection_reason: rejectionReason ?? 'إيصال غير صالح أو لم يصل التحويل',
    }));
  },

  /**
   * Super Admin customizes a building's monthly price, max apartments, and feature flags
   */
  async superAdminConfigureBuilding(params: {
    buildingId: string;
    planCode?: PlanTier;
    customMonthlyPrice?: number | null;
    clearCustomPrice?: boolean;
    maxApartmentsOverride?: number | null;
    featuresConfig?: Partial<FeaturesConfig>;
    subscriptionStatus?: BuildingSubscriptionStatus;
    extendDays?: number;
  }) {
    return toResult(await supabase.rpc('super_admin_configure_building', {
      p_building_id: params.buildingId,
      p_plan_code: params.planCode ?? null,
      p_custom_monthly_price: params.customMonthlyPrice ?? null,
      p_clear_custom_price: params.clearCustomPrice ?? false,
      p_max_apartments_override: params.maxApartmentsOverride ?? null,
      p_features_config: params.featuresConfig ?? null,
      p_subscription_status: params.subscriptionStatus ?? null,
      p_extend_days: params.extendDays ?? 0,
    }));
  },

  /**
   * Testing & Dev Tool: Reset building data (residents_only) or delete building completely (full_delete)
   */
  async resetBuildingData(buildingId: string, mode: 'residents_only' | 'full_delete') {
    return toResult(await (supabase.rpc as any)('reset_building_data', {
      p_building_id: buildingId,
      p_mode: mode,
    }));
  },

  async listBuildings() {
    return toResult<Building[]>(await supabase.from('buildings').select('*').order('created_at', { ascending: false }));
  },

  async listPlans() {
    return toResult<SubscriptionPlan[]>(await supabase.from('subscription_plans').select('*'));
  },

  async setFundBalance(buildingId, fundBalance) {
    return toResult<null>(await supabase.from('buildings').update({ fund_balance: fundBalance }).eq('id', buildingId));
  },
};
