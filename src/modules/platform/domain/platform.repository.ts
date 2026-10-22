import type { RepoResult, RowPatch } from '@/data/result';
import type { Building, SubscriptionPlan } from '@/shared/types/database';
import type { BuildingSubscriptionStatus, FeaturesConfig, PlanTier } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface PlatformRepository {
  /**
   * Admin uploads receipt to renew/activate the building's app subscription
   */
  submitAppSubscriptionInvoice(params: {
    planCode: PlanTier;
    durationMonths: number;
    receiptImageUrl: string;
    notes?: string;
  }): Promise<RepoResult<any>>;
  /**
   * Super Admin activates a building's subscription (via auth.uid()):
   * - Extends subscription_ends_at
   * - Automatically inserts an expense titled "رسوم اشتراك تطبيق إدارة العقار"
   *   and deducts it from the building's fund_balance.
   */
  activateBuildingSubscription(invoiceId: string): Promise<RepoResult<any>>;
  /**
   * Super Admin rejects a building's app subscription invoice (via auth.uid()):
   * - Sets invoice status to 'rejected'
   * - Records rejection reason and notifies the building admin
   */
  rejectAppSubscriptionInvoice(invoiceId: string, rejectionReason?: string): Promise<RepoResult<any>>;
  /**
   * Super Admin customizes a building's monthly price, max apartments, and feature flags
   */
  superAdminConfigureBuilding(params: {
    buildingId: string;
    planCode?: PlanTier;
    customMonthlyPrice?: number | null;
    clearCustomPrice?: boolean;
    maxApartmentsOverride?: number | null;
    featuresConfig?: Partial<FeaturesConfig>;
    subscriptionStatus?: BuildingSubscriptionStatus;
    extendDays?: number;
  }): Promise<RepoResult<any>>;
  /**
   * Testing & Dev Tool: Reset building data (residents_only) or delete building completely (full_delete)
   */
  resetBuildingData(buildingId: string, mode: 'residents_only' | 'full_delete'): Promise<RepoResult<any>>;

  listBuildings(): Promise<RepoResult<Building[]>>;
  listPlans(): Promise<RepoResult<SubscriptionPlan[]>>;
  /** Overwrites the building's fund balance (client-side bookkeeping; see audit). */
  setFundBalance(buildingId: string, fundBalance: number): Promise<RepoResult<null>>;
}
