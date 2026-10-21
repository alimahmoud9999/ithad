import { supabase } from '@/shared/lib/supabase';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const unitsApi = {
  /**
   * Admin approves or rejects a pending resident join request, optionally overriding/reassigning the apartment in one step
   */
  async reviewResidentJoinRequest(
    residentUserId: string,
    approve: boolean,
    overrideApartmentId?: string | null,
    overrideApartmentNumber?: string | null
  ) {
    const res = await supabase.rpc('review_resident_join_request', {
      p_resident_user_id: residentUserId,
      p_approve: approve,
      p_override_apartment_id: overrideApartmentId ?? null,
      p_override_apartment_number: overrideApartmentNumber ?? null,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Transfers unpaid obligations (and optionally pre-registered occupant_name/occupant_phone) from source apartment to target apartment
   */
  async transferApartmentObligations(params: {
    sourceApartmentId: string;
    targetApartmentId: string;
    obligationIds?: string[] | null;
    transferOccupantInfo?: boolean;
  }) {
    return supabase.rpc('transfer_apartment_obligations', {
      p_source_apartment_id: params.sourceApartmentId,
      p_target_apartment_id: params.targetApartmentId,
      p_obligation_ids: params.obligationIds ?? null,
      p_transfer_occupant_info: params.transferOccupantInfo ?? false,
    });
  },
};
