import type { RepoResult, RowPatch } from '@/data/result';
import type { Apartment, ApartmentObligation } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface UnitsRepository {
  /**
   * Admin approves or rejects a pending resident join request, optionally overriding/reassigning the apartment in one step
   */
  reviewResidentJoinRequest(residentUserId: string, approve: boolean, overrideApartmentId?: string | null, overrideApartmentNumber?: string | null): Promise<RepoResult<any>>;
  /**
   * Transfers unpaid obligations (and optionally pre-registered occupant_name/occupant_phone) from source apartment to target apartment
   */
  transferApartmentObligations(params: {
    sourceApartmentId: string;
    targetApartmentId: string;
    obligationIds?: string[] | null;
    transferOccupantInfo?: boolean;
  }): Promise<RepoResult<any>>;

  // ---- apartments
  listApartments(): Promise<RepoResult<Apartment[]>>;
  /** Newest apartment in a building matching an id or a number (no match given = newest in the building); at most one row. */
  findLatestApartment(buildingId: string, match: { id?: string; apartmentNumber?: string }): Promise<RepoResult<Apartment[]>>;
  findApartmentId(buildingId: string, apartmentNumber: string): Promise<RepoResult<{ id: string }>>;
  /** Inserts and returns the created apartment row. */
  insertApartment(row: RowPatch): Promise<RepoResult<Apartment>>;
  updateApartment(id: string, patch: RowPatch): Promise<RepoResult<null>>;
  deleteApartment(id: string): Promise<RepoResult<null>>;

  // ---- obligations (debts)
  listObligations(): Promise<RepoResult<ApartmentObligation[]>>;
  listUnpaidObligationAmounts(apartmentId: string): Promise<RepoResult<{ amount: number }[]>>;
  insertObligation(row: RowPatch): Promise<RepoResult<null>>;
  /** Inserts and returns only the new id. */
  insertObligationReturningId(row: RowPatch): Promise<RepoResult<{ id: string }>>;
  updateObligation(id: string, patch: RowPatch): Promise<RepoResult<null>>;
  deleteObligation(id: string): Promise<RepoResult<null>>;

  // ---- residents
  /** Ids of users registered on an apartment (at most one). */
  findResidentIdsByApartment(buildingId: string, apartmentNumber: string): Promise<RepoResult<{ id: string }[]>>;
}
