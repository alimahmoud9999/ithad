import 'react-native-url-polyfill/auto';
import type { RepoResult } from '../result';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id')
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Validates that an authenticated Supabase Auth session exists and the user actually exists in auth.users.
 * Clears stale or deleted sessions automatically.
 */
export async function ensureSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData?.user?.id) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Converts a Supabase `{ data, error }` response into the backend-neutral RepoResult. */
export function toResult<T>(res: { data: unknown; error: { message: string } | null }): RepoResult<T> {
  return { data: (res.data ?? null) as T | null, error: res.error ? { message: res.error.message } : null };
}
