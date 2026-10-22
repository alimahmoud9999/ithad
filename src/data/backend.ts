/**
 * Which backend the app talks to. The rest of the app only asks "is a remote
 * backend configured?" — false means the offline demo mode with local seed data.
 * To move off Supabase, point this (and src/data/repositories.ts) at the new backend.
 */
export { isSupabaseConfigured as isRemoteBackendEnabled } from './supabase/client';
