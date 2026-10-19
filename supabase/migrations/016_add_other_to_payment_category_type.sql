-- ============================================================================
-- Migration 016: Comprehensive Schema Healing & Missing Columns Patch
-- ============================================================================
-- 1. Add missing apartment_number & resident_name to public.payments
--    Fixes: column "apartment_number" of relation "payments" does not exist
-- 2. Add missing contributors_count to public.emergency_claims
-- 3. Add missing apartment_number to public.apartment_obligations
-- 4. Add missing recipient_role & metadata to public.notifications
-- 5. Add 'other' to public.payment_category_type enum (for custom items)
-- 6. Enable Realtime publication on apartment_obligations
-- ============================================================================

-- 1. Fix payments table columns
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS apartment_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS resident_name TEXT;

-- 2. Fix emergency_claims table columns
ALTER TABLE public.emergency_claims ADD COLUMN IF NOT EXISTS contributors_count INTEGER NOT NULL DEFAULT 0;

-- 3. Fix apartment_obligations table columns
ALTER TABLE public.apartment_obligations ADD COLUMN IF NOT EXISTS apartment_number TEXT;

-- 4. Fix notifications table columns & constraints
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ALTER COLUMN recipient_id DROP NOT NULL;

-- 5. Support 'other' for custom obligations / arrears
DO $$ 
BEGIN
    ALTER TYPE public.payment_category_type ADD VALUE IF NOT EXISTS 'other';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 6. Enable Realtime publication on apartment_obligations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'apartment_obligations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.apartment_obligations;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
