-- ============================================================================
-- Migration: 009_tighten_rls_policies.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Step 3 Security Overhaul:
--              1. Tighten open RLS policies on users, buildings, apartments, notifications.
--                 - Remove any TO anon or USING (true) policies.
--                 - Restrict SELECT to authenticated users based on verified membership.
--                 - Protect sensitive fields (push_token, email, phone, arrears_amount).
--              2. Re-author lookup_building_apartments_for_join with auth.uid() check,
--                 masked occupant names (first 2 characters), phone matching boolean,
--                 and zero leakage of phone numbers or arrears.
--              3. Granular Realtime publication per table.
--              4. Restrict storage access for payment-receipts to owner and building admin.
-- ============================================================================

-- ============================================================================
-- 1. Tighten RLS: public.users
-- ============================================================================
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;

-- Direct table select: Self, Admin of the same building, or Super Admin
CREATE POLICY "users_select_policy"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR id = auth.uid()
        OR (
            public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND building_id = public.get_my_building_id()
        )
    );

-- Secure View for building resident directory (Name & Unit only, NO push_token, email, or phone)
CREATE OR REPLACE VIEW public.building_resident_directory
WITH (security_invoker = false)
AS
SELECT
    u.id,
    u.building_id,
    u.apartment_id,
    u.apartment_number,
    u.floor_number,
    u.full_name,
    u.role,
    u.status,
    u.residency_type,
    u.ownership_share_percent,
    u.created_at
FROM public.users u
WHERE u.status = 'active'
  AND (
      public.get_my_role() = 'super_admin'
      OR u.building_id = public.get_my_building_id()
  );

REVOKE ALL ON public.building_resident_directory FROM PUBLIC, anon;
GRANT SELECT ON public.building_resident_directory TO authenticated;

-- ============================================================================
-- 2. Tighten RLS: public.buildings
-- ============================================================================
DROP POLICY IF EXISTS "buildings_select_policy" ON public.buildings;
DROP POLICY IF EXISTS "buildings_select_authenticated" ON public.buildings;

-- Only members of the building or Super Admin can read building details
CREATE POLICY "buildings_select_policy"
    ON public.buildings
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR id = public.get_my_building_id()
    );

-- ============================================================================
-- 3. Tighten RLS: public.apartments
-- ============================================================================
DROP POLICY IF EXISTS "apartments_select_policy" ON public.apartments;
DROP POLICY IF EXISTS "apartments_select_authenticated" ON public.apartments;

CREATE POLICY "apartments_select_policy"
    ON public.apartments
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_status() = 'active'
        )
    );

-- Secure View for apartments directory masking occupant phone and arrears for non-owners/non-admins
CREATE OR REPLACE VIEW public.building_apartments_directory
WITH (security_invoker = false)
AS
SELECT
    a.id,
    a.building_id,
    a.apartment_number,
    a.floor_number,
    a.wing_or_direction,
    a.ownership_share_percent,
    a.resident_id,
    a.is_active,
    a.created_at,
    a.updated_at,
    CASE
        WHEN public.get_my_role() IN ('admin', 'super_admin') OR a.resident_id = auth.uid() THEN a.occupant_name
        WHEN a.occupant_name IS NOT NULL AND length(a.occupant_name) > 2 THEN substring(a.occupant_name from 1 for 2) || '***'
        ELSE a.occupant_name
    END AS occupant_name,
    CASE
        WHEN public.get_my_role() IN ('admin', 'super_admin') OR a.resident_id = auth.uid() THEN a.occupant_phone
        ELSE NULL
    END AS occupant_phone,
    CASE
        WHEN public.get_my_role() IN ('admin', 'super_admin') OR a.resident_id = auth.uid() THEN a.arrears_amount
        ELSE 0.00
    END AS arrears_amount
FROM public.apartments a
WHERE a.building_id = public.get_my_building_id()
  AND public.get_my_status() = 'active';

REVOKE ALL ON public.building_apartments_directory FROM PUBLIC, anon;
GRANT SELECT ON public.building_apartments_directory TO authenticated;

-- ============================================================================
-- 4. Tighten RLS: public.notifications
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;

-- Only recipient or users matching role and building can read notifications
CREATE POLICY "notifications_select_policy"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR recipient_id = auth.uid()
        OR (
            recipient_id IS NULL
            AND recipient_role = public.get_my_role()::text
            AND building_id = public.get_my_building_id()
        )
    );

-- Users can only update their own notifications
CREATE POLICY "notifications_update_policy"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (
        recipient_id = auth.uid()
        OR (
            recipient_id IS NULL
            AND recipient_role = public.get_my_role()::text
            AND building_id = public.get_my_building_id()
        )
    )
    WITH CHECK (
        recipient_id = auth.uid()
        OR (
            recipient_id IS NULL
            AND recipient_role = public.get_my_role()::text
            AND building_id = public.get_my_building_id()
        )
    );

-- Enforce that ONLY is_read column can be updated by clients on notifications
CREATE OR REPLACE FUNCTION public.check_notification_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (OLD.id <> NEW.id OR 
        OLD.building_id IS DISTINCT FROM NEW.building_id OR
        OLD.recipient_id IS DISTINCT FROM NEW.recipient_id OR
        OLD.recipient_role IS DISTINCT FROM NEW.recipient_role OR
        OLD.title <> NEW.title OR
        OLD.body <> NEW.body OR
        OLD.category <> NEW.category OR
        OLD.metadata IS DISTINCT FROM NEW.metadata OR
        OLD.created_at <> NEW.created_at) THEN
        RAISE EXCEPTION 'Only the is_read column can be modified on notifications.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_notification_updates ON public.notifications;
CREATE TRIGGER trg_restrict_notification_updates
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.check_notification_update_columns();

-- Revoke write permissions from public and anon
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon;

-- ============================================================================
-- 5. RPC: lookup_building_apartments_for_join (Secured & Masked)
-- ============================================================================
DROP FUNCTION IF EXISTS public.lookup_building_apartments_for_join(text, text);

CREATE OR REPLACE FUNCTION public.lookup_building_apartments_for_join(
    p_building_code TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_building RECORD;
    v_clean_phone TEXT;
    v_apartments JSONB := '[]'::jsonb;
    v_suggested_apt_id UUID := NULL;
    v_suggested_apt_number TEXT := NULL;
    v_suggested_occupant_name TEXT := NULL;
    v_suggested_floor_number TEXT := NULL;
    v_apt RECORD;
    v_is_match BOOLEAN;
    v_raw_name TEXT;
    v_masked_name TEXT;
BEGIN
    -- 1. Require Authenticated Session
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    -- 2. Find building by building_code or apartment invite_code
    SELECT id, name, address, building_code, total_apartments, default_monthly_dues
    INTO v_building
    FROM public.buildings
    WHERE upper(trim(building_code)) = upper(trim(p_building_code));

    IF NOT FOUND THEN
        SELECT b.id, b.name, b.address, b.building_code, b.total_apartments, b.default_monthly_dues,
               a.id as apt_id, a.apartment_number,
               COALESCE(a.occupant_name, u.full_name) as occupant_name,
               COALESCE(a.floor_number, u.floor_number) as floor_number
        INTO v_apt
        FROM public.apartments a
        JOIN public.buildings b ON b.id = a.building_id
        LEFT JOIN public.users u ON u.id = a.resident_id OR (u.building_id = a.building_id AND u.apartment_number = a.apartment_number AND u.status = 'active')
        WHERE upper(trim(a.invite_code)) = upper(trim(p_building_code))
        LIMIT 1;

        IF FOUND THEN
            v_building.id := v_apt.id;
            v_building.name := v_apt.name;
            v_building.address := v_apt.address;
            v_building.building_code := v_apt.building_code;
            v_building.total_apartments := v_apt.total_apartments;
            v_building.default_monthly_dues := v_apt.default_monthly_dues;
            v_suggested_apt_id := v_apt.apt_id;
            v_suggested_apt_number := v_apt.apartment_number;
            v_raw_name := v_apt.occupant_name;
            IF v_raw_name IS NOT NULL AND length(trim(v_raw_name)) > 2 THEN
                v_suggested_occupant_name := substring(trim(v_raw_name) from 1 for 2) || '****';
            ELSE
                v_suggested_occupant_name := v_raw_name;
            END IF;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;
    END IF;

    IF v_building.id IS NULL AND p_building_code LIKE '%-%-%' THEN
        SELECT id, name, address, building_code, total_apartments, default_monthly_dues
        INTO v_building
        FROM public.buildings
        WHERE upper(trim(building_code)) = upper(trim(split_part(p_building_code, '-', 1) || '-' || split_part(p_building_code, '-', 2)));

        IF FOUND THEN
            v_suggested_apt_number := split_part(p_building_code, '-', 3);
        END IF;
    END IF;

    IF v_building.id IS NULL THEN
        RAISE EXCEPTION 'كود المبنى غير صحيح، يرجى التأكد من الكود من رئيس الاتحاد.';
    END IF;

    v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

    -- 3. Iterate through units: strictly mask name and NEVER leak phone or arrears
    FOR v_apt IN
        SELECT
            a.id,
            a.apartment_number,
            COALESCE(
                a.floor_number,
                u.floor_number,
                CASE
                    WHEN a.apartment_number ~ '^[0-9]+$' AND length(a.apartment_number) >= 2 THEN 'الدور ' || substring(a.apartment_number from 1 for length(a.apartment_number) - 1)
                    WHEN a.apartment_number ~ '^[0-9]+$' THEN 'الدور الأول'
                    ELSE NULL
                END
            ) as floor_number,
            a.wing_or_direction,
            COALESCE(a.occupant_name, u.full_name) as raw_occupant_name,
            COALESCE(a.occupant_phone, u.phone) as raw_occupant_phone,
            a.resident_id
        FROM public.apartments a
        LEFT JOIN public.users u ON u.id = a.resident_id OR (u.building_id = a.building_id AND u.apartment_number = a.apartment_number AND u.status = 'active')
        WHERE a.building_id = v_building.id
          AND a.is_active = true
        ORDER BY a.apartment_number
    LOOP
        -- Matching is done server-side: returns boolean only
        v_is_match := (
            v_clean_phone <> ''
            AND length(v_clean_phone) >= 8
            AND regexp_replace(COALESCE(v_apt.raw_occupant_phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        );

        -- Mask occupant name (first 2 chars + '****')
        IF v_apt.raw_occupant_name IS NOT NULL AND length(trim(v_apt.raw_occupant_name)) > 2 THEN
            v_masked_name := substring(trim(v_apt.raw_occupant_name) from 1 for 2) || '****';
        ELSE
            v_masked_name := v_apt.raw_occupant_name;
        END IF;

        IF v_suggested_apt_number IS NOT NULL AND v_apt.apartment_number = v_suggested_apt_number THEN
            v_suggested_apt_id := v_apt.id;
            v_suggested_occupant_name := v_masked_name;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;

        IF v_is_match AND v_suggested_apt_id IS NULL THEN
            v_suggested_apt_id := v_apt.id;
            v_suggested_apt_number := v_apt.apartment_number;
            v_suggested_occupant_name := v_masked_name;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;

        -- Safe payload: NO occupant_phone and NO arrears_amount
        v_apartments := v_apartments || jsonb_build_object(
            'id', v_apt.id,
            'apartment_number', v_apt.apartment_number,
            'floor_number', v_apt.floor_number,
            'wing_or_direction', v_apt.wing_or_direction,
            'occupant_name', v_masked_name,
            'is_phone_match', v_is_match,
            'is_occupied', (v_apt.resident_id IS NOT NULL)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'building_id', v_building.id,
        'building_name', v_building.name,
        'building_code', v_building.building_code,
        'suggested_apartment_id', v_suggested_apt_id,
        'suggested_apartment_number', v_suggested_apt_number,
        'suggested_occupant_name', v_suggested_occupant_name,
        'suggested_floor_number', v_suggested_floor_number,
        'apartments', v_apartments
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_building_apartments_for_join(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_building_apartments_for_join(text, text) TO authenticated;

-- ============================================================================
-- 6. Storage Security: payment-receipts restricted to owner & building admin
-- ============================================================================
DROP POLICY IF EXISTS "storage_building_members_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_payment_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_general_select" ON storage.objects;

-- Policy 1: payment-receipts is restricted to receipt owner, building admin, or super_admin
CREATE POLICY "storage_payment_receipts_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment-receipts'
        AND (
            public.get_my_role() = 'super_admin'
            OR (
                public.get_my_role() = 'admin'
                AND public.get_my_status() = 'active'
                AND (storage.foldername(name))[1] = public.get_my_building_id()::text
            )
            OR (
                -- Receipt owner: path includes user id or linked to user's payment row
                name LIKE '%' || auth.uid()::text || '%'
                OR (storage.foldername(name))[2] = auth.uid()::text
                OR EXISTS (
                    SELECT 1 FROM public.payments p
                    WHERE p.resident_id = auth.uid()
                      AND (p.receipt_image_url LIKE '%' || name || '%' OR name LIKE '%' || p.id::text || '%')
                )
            )
        )
    );

-- Policy 2: Other building files (expense invoices, documents, tickets)
CREATE POLICY "storage_general_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id IN ('expense-invoices', 'subscription-receipts', 'building-documents', 'issue-attachments')
        AND (
            public.get_my_role() = 'super_admin'
            OR (
                (storage.foldername(name))[1] = public.get_my_building_id()::text
                AND public.get_my_status() = 'active'
            )
        )
    );

-- ============================================================================
-- 7. Realtime Publication: Isolated ALTER PUBLICATION per table
-- ============================================================================
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.apartments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_claims REPLICA IDENTITY FULL;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.apartments;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_claims;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
