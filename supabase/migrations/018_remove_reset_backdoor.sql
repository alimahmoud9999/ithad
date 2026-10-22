-- ============================================================================
-- Migration: 018_remove_reset_backdoor.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust)
-- Description:
--   015 added reset_building_data(UUID, TEXT, TEXT) with a hardcoded secret key
--   that skipped all auth checks and was granted to anon. The key is public in
--   the git history, so anyone with the anon key could wipe any building
--   (including auth.users). Drop that overload; the 2-arg version from 014
--   performs the same reset with a proper super_admin / building-admin check.
-- ============================================================================

DROP FUNCTION IF EXISTS public.reset_building_data(UUID, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.reset_building_data(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_building_data(UUID, TEXT) TO authenticated;
