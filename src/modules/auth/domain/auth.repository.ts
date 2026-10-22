import type { RepoResult } from '@/data/result';
import type { Apartment, Building, UserProfile } from '@/shared/types/database';

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface SignUpMetadata {
  fullName?: string;
  phone?: string;
  role?: string;
}

export interface AuthRepository {
  /** Throws a user-facing (Arabic) error on bad credentials. */
  signIn(email: string, password: string): Promise<{ user: SessionUser | null }>;
  /** Throws a user-facing (Arabic) error, e.g. when the email is taken. */
  signUp(email: string, password: string, metadata?: SignUpMetadata): Promise<void>;
  signOut(): Promise<void>;
  /** The signed-in user from the stored session, without a network round trip. */
  getSessionUser(): Promise<SessionUser | null>;
  /** Verifies the session with the backend; clears a stale/deleted session and returns false. */
  ensureSession(): Promise<boolean>;
  getUserProfile(userId: string): Promise<RepoResult<UserProfile>>;
  /** Scoped to one building when `buildingId` is given; everything visible otherwise. */
  listUserProfiles(buildingId?: string): Promise<RepoResult<UserProfile[]>>;
}

export interface CreateBuildingParams {
  fullName: string;
  phone: string;
  buildingName: string;
  address: string;
  totalApartments: number;
  defaultMonthlyDues: number;
  adminApartmentNumber: string;
  registrationNumber?: string;
}

export interface JoinBuildingParams {
  fullName: string;
  phone: string;
  buildingCode: string;
  apartmentNumber: string;
  floorNumber?: string;
  residencyType?: 'owner_resident' | 'tenant' | 'non_resident_owner';
}

// Server identity always comes from the session; never pass user ids as params.
export interface OnboardingRepository {
  /** Admin creates a building (60-day trial + unique building_code). Throws without a session. */
  createBuildingForAdmin(params: CreateBuildingParams): Promise<RepoResult<any>>;
  /** Resident asks to join a building (status = pending). Throws without a session. */
  requestJoinBuilding(params: JoinBuildingParams): Promise<RepoResult<any>>;
  /** Building + its apartments (occupant names masked) for a building code. */
  lookupBuildingApartmentsForJoin(buildingCode: string, phone?: string): Promise<RepoResult<any>>;
  /** Full building row for a building code (case-insensitive). */
  findBuildingByCode(code: string): Promise<RepoResult<Building>>;
  /** Building matching a code (case-insensitive) or, when given, an id. */
  findBuildingByCodeOrId(code: string, id: string | null): Promise<RepoResult<Building>>;
  /** All apartments of a building. */
  listBuildingApartments(buildingId: string): Promise<RepoResult<Apartment[]>>;
}
