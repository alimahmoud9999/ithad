/**
 * Composition root: the one place that decides which backend implements each
 * repository. Everything else imports `repositories` and never a backend SDK.
 *
 * To move to another backend (REST API, Firebase, …), add sibling
 * implementations (e.g. `payments.http.ts` next to `payments.supabase.ts`)
 * that satisfy the same domain contracts, and swap them in here.
 */
import { supabaseAuthRepository } from '@/modules/auth/infrastructure/auth.supabase';
import { supabaseOnboardingRepository } from '@/modules/auth/infrastructure/onboarding.supabase';
import { supabaseCommunityRepository } from '@/modules/community/infrastructure/community.supabase';
import { supabaseEmergencyRepository } from '@/modules/emergency/infrastructure/emergency.supabase';
import { supabaseExpensesRepository } from '@/modules/expenses/infrastructure/expenses.supabase';
import { supabaseNotificationsRepository } from '@/modules/notifications/infrastructure/notifications.supabase';
import { supabasePaymentsRepository } from '@/modules/payments/infrastructure/payments.supabase';
import { supabasePlatformRepository } from '@/modules/platform/infrastructure/platform.supabase';
import { supabaseUnitsRepository } from '@/modules/units/infrastructure/units.supabase';
import { supabaseFileStorage } from './supabase/storage.supabase';
import { supabaseRealtime } from './supabase/realtime.supabase';

export const repositories = {
  auth: supabaseAuthRepository,
  onboarding: supabaseOnboardingRepository,
  units: supabaseUnitsRepository,
  payments: supabasePaymentsRepository,
  emergency: supabaseEmergencyRepository,
  expenses: supabaseExpensesRepository,
  community: supabaseCommunityRepository,
  notifications: supabaseNotificationsRepository,
  platform: supabasePlatformRepository,
  storage: supabaseFileStorage,
  realtime: supabaseRealtime,
};
