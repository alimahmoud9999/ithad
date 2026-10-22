import { ensureSupabaseSession, supabase, toResult } from '@/data/supabase/client';
import type { Apartment, Building } from '@/shared/types/database';
import type { OnboardingRepository } from '../domain/auth.repository';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseOnboardingRepository: OnboardingRepository = {
  /**
   * Admin creates a new building and receives a 60-day Pro trial + unique building_code
   */
  async createBuildingForAdmin(params) {
    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
      throw new Error('يجب تسجيل الدخول أولاً بحساب معتمد لإنشاء العقار.');
    }
    return toResult(await supabase.rpc('create_building_for_admin', {
      p_full_name: params.fullName,
      p_phone: params.phone,
      p_building_name: params.buildingName,
      p_address: params.address,
      p_total_apartments: params.totalApartments,
      p_default_monthly_dues: params.defaultMonthlyDues,
      p_admin_apartment_number: params.adminApartmentNumber,
      p_registration_number: params.registrationNumber ?? null,
    }));
  },

  /**
   * Resident requests to join a building using building_code and apartment_number (status = 'pending')
   */
  async requestJoinBuilding(params) {
    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
      throw new Error('يجب تسجيل الدخول أولاً بحساب معتمد لتقديم طلب الانضمام.');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const rpcRes = await supabase.rpc('request_join_building', {
      p_full_name: params.fullName,
      p_phone: params.phone,
      p_building_code: params.buildingCode,
      p_apartment_number: params.apartmentNumber,
      p_floor_number: params.floorNumber ?? null,
      p_residency_type: params.residencyType ?? 'owner_resident',
    });
    return {
      data: {
        ...(typeof rpcRes.data === 'object' && rpcRes.data ? rpcRes.data : {}),
        user_id: sessionData?.session?.user?.id ?? null,
      },
      error: rpcRes.error ? { message: rpcRes.error.message } : null,
    };
  },

  /**
   * Looks up building apartments by building_code and auto-matches phone against pre-registered occupant_phone
   */
  async lookupBuildingApartmentsForJoin(buildingCode, phone) {
    return toResult(await supabase.rpc('lookup_building_apartments_for_join', {
      p_building_code: buildingCode,
      p_phone: phone ?? null,
    }));
  },

  /**
   * Full building row for an invite / building code (case-insensitive)
   */
  async findBuildingByCode(code) {
    return toResult<Building>(await supabase.from('buildings').select('*').ilike('building_code', code).maybeSingle());
  },

  /**
   * All apartments of a building (fallback when the lookup RPC finds nothing)
   */
  async listBuildingApartments(buildingId) {
    return toResult<Apartment[]>(await supabase.from('apartments').select('*').eq('building_id', buildingId));
  },

  async findBuildingByCodeOrId(code, id) {
    return toResult<Building>(
      await supabase
        .from('buildings')
        .select('*')
        .or(`building_code.ilike.${code}${id ? `,id.eq.${id}` : ''}`)
        .maybeSingle()
    );
  },
};
