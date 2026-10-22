import type { RepoResult, RowPatch } from '@/data/result';
import type { EmergencyClaim } from '@/shared/types/database';
import type { ClaimDistributionType } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface EmergencyRepository {
  /**
   * Admin creates an emergency claim with equal or custom share distribution
   * The admin is verified strictly via auth.uid() and building association is resolved from DB.
   */
  createEmergencyClaim(params: {
    title: string;
    description: string;
    category: string;
    targetAmount: number;
    distributionType: ClaimDistributionType;
    customShares?: Array<{ apartment_id: string; amount: number }> | null;
    dueDate?: string | null;
    defaultShareAmount?: number | null;
    occupiedOnly?: boolean;
  }): Promise<RepoResult<any>>;

  listClaims(): Promise<RepoResult<EmergencyClaim[]>>;
}
