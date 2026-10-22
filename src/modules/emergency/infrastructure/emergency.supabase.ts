import { supabase, toResult } from '@/data/supabase/client';
import type { EmergencyClaim } from '@/shared/types/database';
import type { EmergencyRepository } from '../domain/emergency.repository';
import type { ClaimDistributionType } from '@/shared/types/database';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseEmergencyRepository: EmergencyRepository = {
  /**
   * Admin creates an emergency claim with equal or custom share distribution
   * The admin is verified strictly via auth.uid() and building association is resolved from DB.
   */
  async createEmergencyClaim(params: {
    title: string;
    description: string;
    category: string;
    targetAmount: number;
    distributionType: ClaimDistributionType;
    customShares?: Array<{ apartment_id: string; amount: number }> | null;
    dueDate?: string | null;
    defaultShareAmount?: number | null;
    occupiedOnly?: boolean;
  }) {
    const res = await supabase.rpc('create_emergency_claim', {
      p_title: params.title,
      p_description: params.description,
      p_category: params.category,
      p_target_amount: params.targetAmount,
      p_distribution_type: params.distributionType,
      p_custom_shares: params.customShares ?? null,
      p_due_date: params.dueDate ?? null,
      p_default_share_amount: params.defaultShareAmount ?? null,
      p_occupied_only: params.occupiedOnly ?? false,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return toResult(res);
  },

  async listClaims(buildingId) {
    let query = supabase.from('emergency_claims').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<EmergencyClaim[]>(await query.order('created_at', { ascending: false }));
  },
};
