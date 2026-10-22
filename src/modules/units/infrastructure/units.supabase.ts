import { supabase, toResult } from '@/data/supabase/client';
import type { Apartment, ApartmentObligation } from '@/shared/types/database';
import type { UnitsRepository } from '../domain/units.repository';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseUnitsRepository: UnitsRepository = {
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
    return toResult(res);
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
    return toResult(await supabase.rpc('transfer_apartment_obligations', {
      p_source_apartment_id: params.sourceApartmentId,
      p_target_apartment_id: params.targetApartmentId,
      p_obligation_ids: params.obligationIds ?? null,
      p_transfer_occupant_info: params.transferOccupantInfo ?? false,
    }));
  },

  async listApartments() {
    return toResult<Apartment[]>(await supabase.from('apartments').select('*').order('apartment_number', { ascending: true }));
  },

  async findLatestApartment(buildingId, match) {
    let query = supabase.from('apartments').select('*').eq('building_id', buildingId);
    if (match.id) query = query.eq('id', match.id);
    else if (match.apartmentNumber) query = query.eq('apartment_number', match.apartmentNumber);
    return toResult<Apartment[]>(await query.order('created_at', { ascending: false }).limit(1));
  },

  async findApartmentId(buildingId, apartmentNumber) {
    return toResult<{ id: string }>(
      await supabase.from('apartments').select('id').eq('building_id', buildingId).eq('apartment_number', apartmentNumber).maybeSingle()
    );
  },

  async insertApartment(row) {
    return toResult<Apartment>(await supabase.from('apartments').insert(row).select().maybeSingle());
  },

  async updateApartment(id, patch) {
    return toResult<null>(await supabase.from('apartments').update(patch).eq('id', id));
  },

  async deleteApartment(id) {
    return toResult<null>(await supabase.from('apartments').delete().eq('id', id));
  },

  async listObligations() {
    return toResult<ApartmentObligation[]>(await supabase.from('apartment_obligations').select('*').order('created_at', { ascending: false }));
  },

  async listUnpaidObligationAmounts(apartmentId) {
    return toResult<{ amount: number }[]>(
      await supabase.from('apartment_obligations').select('amount').eq('apartment_id', apartmentId).eq('status', 'unpaid')
    );
  },

  async insertObligation(row) {
    return toResult<null>(await supabase.from('apartment_obligations').insert(row));
  },

  async insertObligationReturningId(row) {
    return toResult<{ id: string }>(await supabase.from('apartment_obligations').insert(row).select('id').maybeSingle());
  },

  async updateObligation(id, patch) {
    return toResult<null>(await supabase.from('apartment_obligations').update(patch).eq('id', id));
  },

  async deleteObligation(id) {
    return toResult<null>(await supabase.from('apartment_obligations').delete().eq('id', id));
  },

  async findResidentIdsByApartment(buildingId, apartmentNumber) {
    return toResult<{ id: string }[]>(
      await supabase.from('users').select('id').eq('building_id', buildingId).eq('apartment_number', apartmentNumber).limit(1)
    );
  },
};
