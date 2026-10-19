-- ============================================================================
-- Migration: 015_setup_superadmin_and_dev_reset.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust)
-- Description: 
--   1. Fix protect_user_sensitive_columns trigger to permit 'admin' role creation
--      during building onboarding, and allow SQL Editor / internal RPC bypass.
--   2. Update create_building_for_admin with internal bypass flag.
--   3. Provision superadmin user in public.users for Supabase Auth account.
--   4. Update reset_building_data to accept p_secret_key bypass for one-click dev resets.
--   5. Grant execution permissions to authenticated and anon for dev resets.
-- ============================================================================

-- 1. Fix protect_user_sensitive_columns trigger
CREATE OR REPLACE FUNCTION public.protect_user_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
    v_caller_building UUID;
    v_bypass TEXT;
BEGIN
    -- Allow direct maintenance from SQL Editor (where auth.uid() is NULL)
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Allow execution inside trusted internal RPCs (like create_building_for_admin)
    v_bypass := current_setting('app.rpc_internal_bypass', true);
    IF v_bypass = 'true' THEN
        RETURN NEW;
    END IF;

    SELECT role, building_id INTO v_caller_role, v_caller_building
    FROM public.users
    WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        -- Only super_admin role is strictly restricted from self-assignment
        IF NEW.role = 'super_admin' AND COALESCE(v_caller_role, 'resident'::public.user_role) <> 'super_admin' THEN
            RAISE EXCEPTION 'Security Violation: Cannot self-assign privileged role (super_admin).';
        END IF;

        -- If regular resident registration, default to pending
        IF NEW.role = 'resident' AND NEW.status IS NULL THEN
            NEW.status := 'pending';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Prevent unauthorized promotion to super_admin
        IF NEW.role = 'super_admin' AND v_caller_role IS DISTINCT FROM 'super_admin' THEN
            RAISE EXCEPTION 'Security Violation: Modifying user role to super_admin is strictly prohibited.';
        END IF;

        IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
            -- Regular resident cannot modify their assigned building directly
            IF NEW.building_id IS DISTINCT FROM OLD.building_id AND OLD.building_id IS NOT NULL AND OLD.role = 'resident' THEN
                RAISE EXCEPTION 'Security Violation: Cannot change assigned building_id.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Update check_user_update_permissions
CREATE OR REPLACE FUNCTION public.check_user_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
    v_bypass TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    v_bypass := current_setting('app.rpc_internal_bypass', true);
    IF v_bypass = 'true' THEN
        RETURN NEW;
    END IF;

    v_caller_role := public.get_my_role();
    IF v_caller_role = 'super_admin' THEN
        RETURN NEW;
    END IF;

    IF auth.uid() = OLD.id THEN
        IF (OLD.role IS DISTINCT FROM NEW.role OR
            OLD.status IS DISTINCT FROM NEW.status OR
            OLD.building_id IS DISTINCT FROM NEW.building_id OR
            OLD.apartment_id IS DISTINCT FROM NEW.apartment_id OR
            OLD.apartment_number IS DISTINCT FROM NEW.apartment_number OR
            OLD.ownership_share_percent IS DISTINCT FROM NEW.ownership_share_percent) THEN
            RAISE EXCEPTION 'Forbidden: You cannot modify role, status, building_id, or apartment assignments directly.';
        END IF;

        IF OLD.role = 'resident' THEN
            IF (OLD.email IS DISTINCT FROM NEW.email OR
                OLD.phone IS DISTINCT FROM NEW.phone OR
                OLD.floor_number IS DISTINCT FROM NEW.floor_number OR
                OLD.residency_type IS DISTINCT FROM NEW.residency_type) THEN
                RAISE EXCEPTION 'Forbidden: Residents can only update full_name and push_token directly.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    IF v_caller_role = 'admin' AND public.get_my_status() = 'active' AND OLD.building_id = public.get_my_building_id() THEN
        IF (OLD.role IS DISTINCT FROM NEW.role OR
            OLD.building_id IS DISTINCT FROM NEW.building_id) THEN
            RAISE EXCEPTION 'Forbidden: Building admins cannot modify role or building_id of users directly.';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Forbidden: Unauthorized update on users table.';
END;
$$;

-- 3. Update create_building_for_admin to set internal bypass flag
CREATE OR REPLACE FUNCTION public.create_building_for_admin(
    p_full_name TEXT,
    p_phone TEXT,
    p_building_name TEXT,
    p_address TEXT,
    p_total_apartments INTEGER DEFAULT 16,
    p_default_monthly_dues NUMERIC(12, 2) DEFAULT 300.00,
    p_admin_apartment_number TEXT DEFAULT '1',
    p_registration_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_existing_building UUID;
    v_building_id UUID;
    v_building_code TEXT;
    v_apartment_id UUID;
    v_pro_features JSONB;
    v_share_percent NUMERIC(5, 2);
BEGIN
    -- Set bypass flag for internal operations within this transaction
    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    v_caller_email := COALESCE(auth.jwt()->>'email', (SELECT email FROM public.users WHERE id = v_caller_id));

    -- 2. Verify caller is not already assigned as admin of any building
    SELECT building_id INTO v_existing_building
    FROM public.users
    WHERE id = v_caller_id;

    IF v_existing_building IS NOT NULL THEN
        RAISE EXCEPTION 'User is already assigned to a building.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.buildings WHERE admin_id = v_caller_id) THEN
        RAISE EXCEPTION 'User is already an administrator of a building.';
    END IF;

    IF p_total_apartments IS NULL OR p_total_apartments <= 0 THEN
        RAISE EXCEPTION 'Total apartments must be greater than zero.';
    END IF;

    -- Generate unique building code
    LOOP
        v_building_code := 'BLD-' || floor(100000 + random() * 900000)::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.buildings WHERE building_code = v_building_code);
    END LOOP;

    -- Calculate equal ownership share
    v_share_percent := ROUND((100.0 / p_total_apartments)::NUMERIC, 2);

    -- Fetch default pro features config
    SELECT default_features_config INTO v_pro_features
    FROM public.subscription_plans
    WHERE code = 'pro';

    IF v_pro_features IS NULL THEN
        v_pro_features := '{"receipt_upload": true, "emergency_claims": true, "export_reports": true, "voting": true, "maintenance_tickets": true, "documents_archive": true}'::jsonb;
    END IF;

    -- 3. Create the building with 60-day Pro trial
    INSERT INTO public.buildings (
        name,
        address,
        building_code,
        registration_number,
        default_monthly_dues,
        fund_balance,
        total_apartments,
        plan_code,
        subscription_status,
        subscription_ends_at,
        trial_ends_at,
        features_config
    ) VALUES (
        trim(p_building_name),
        trim(p_address),
        v_building_code,
        trim(p_registration_number),
        COALESCE(p_default_monthly_dues, 300.00),
        0.00,
        p_total_apartments,
        'pro',
        'trial',
        now() + INTERVAL '60 days',
        now() + INTERVAL '60 days',
        v_pro_features
    )
    RETURNING id INTO v_building_id;

    -- 4. Create the admin's apartment unit
    INSERT INTO public.apartments (
        building_id,
        apartment_number,
        ownership_share_percent,
        occupant_name,
        occupant_phone,
        invite_code,
        is_active
    ) VALUES (
        v_building_id,
        trim(p_admin_apartment_number),
        v_share_percent,
        trim(p_full_name),
        trim(p_phone),
        v_building_code || '-' || trim(p_admin_apartment_number),
        true
    )
    RETURNING id INTO v_apartment_id;

    -- 5. Promote user to role = 'admin' and status = 'active' in public.users
    INSERT INTO public.users (
        id,
        full_name,
        email,
        phone,
        role,
        status,
        building_id,
        apartment_id,
        apartment_number,
        ownership_share_percent
    ) VALUES (
        v_caller_id,
        trim(p_full_name),
        v_caller_email,
        trim(p_phone),
        'admin',
        'active',
        v_building_id,
        v_apartment_id,
        trim(p_admin_apartment_number),
        v_share_percent
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = COALESCE(EXCLUDED.email, public.users.email),
        phone = EXCLUDED.phone,
        role = 'admin',
        status = 'active',
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        apartment_number = EXCLUDED.apartment_number,
        ownership_share_percent = EXCLUDED.ownership_share_percent;

    -- 6. Link building.admin_id and apartment.resident_id
    UPDATE public.buildings SET admin_id = v_caller_id WHERE id = v_building_id;
    UPDATE public.apartments SET resident_id = v_caller_id WHERE id = v_apartment_id;

    RETURN jsonb_build_object(
        'building_id', v_building_id,
        'building_code', v_building_code,
        'apartment_id', v_apartment_id,
        'trial_ends_at', (now() + INTERVAL '60 days'),
        'plan_code', 'pro',
        'role', 'admin',
        'status', 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_building_for_admin(text, text, text, text, integer, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_building_for_admin(text, text, text, text, integer, numeric, text, text) TO authenticated;

-- 4. Provision superadmin user in public.users
INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    created_at,
    updated_at
) VALUES (
    'befe7800-2b0e-4aaa-bec0-9fde531a33d3',
    'المدير العام للمنصة',
    'superadmin@ittihad.app',
    '01000000000',
    'super_admin',
    'active',
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin',
    status = 'active',
    email = 'superadmin@ittihad.app',
    updated_at = now();

UPDATE public.users
SET role = 'super_admin',
    status = 'active',
    updated_at = now()
WHERE email = 'superadmin@ittihad.app';

-- 5. Enhanced reset_building_data RPC with dev secret bypass
CREATE OR REPLACE FUNCTION public.reset_building_data(
    p_building_id UUID,
    p_mode TEXT,
    p_secret_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_building RECORD;
    v_admin_id UUID;
    v_resident_user_ids UUID[];
    v_all_user_ids UUID[];
    v_bypass_auth BOOLEAN := FALSE;
BEGIN
    IF p_secret_key = 'ITTIHAD_DEV_RESET_2026' THEN
        v_bypass_auth := TRUE;
    END IF;

    v_caller_id := auth.uid();
    IF NOT v_bypass_auth THEN
        IF v_caller_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'يجب تسجيل الدخول أولاً لتنفيذ هذه العملية'
            );
        END IF;
    END IF;

    SELECT * INTO v_building FROM public.buildings WHERE id = p_building_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'العقار المحدد غير موجود في قاعدة البيانات'
        );
    END IF;

    IF NOT v_bypass_auth THEN
        SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
        IF v_caller_role <> 'super_admin' AND (v_building.admin_id IS NULL OR v_building.admin_id <> v_caller_id) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'غير مصرح لك بإعادة تهيئة أو حذف بيانات هذه العمارة'
            );
        END IF;
    END IF;

    v_admin_id := v_building.admin_id;

    -- Mode 1: تصفير السكان والشقق مع بقاء العمارة ورئيس الاتحاد
    IF p_mode = 'residents_only' THEN
        DELETE FROM public.issue_upvotes WHERE building_id = p_building_id;
        DELETE FROM public.poll_votes WHERE building_id = p_building_id;
        DELETE FROM public.building_issues WHERE building_id = p_building_id;
        DELETE FROM public.polls WHERE building_id = p_building_id;
        DELETE FROM public.notifications WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claim_shares WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claims WHERE building_id = p_building_id;
        DELETE FROM public.payments WHERE building_id = p_building_id;
        DELETE FROM public.expenses WHERE building_id = p_building_id;
        DELETE FROM public.app_subscription_invoices WHERE building_id = p_building_id;
        DELETE FROM public.apartment_obligations WHERE building_id = p_building_id;

        UPDATE public.users
        SET apartment_id = NULL, apartment_number = NULL
        WHERE building_id = p_building_id;

        DELETE FROM public.apartments WHERE building_id = p_building_id;

        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[])
        INTO v_resident_user_ids
        FROM public.users
        WHERE building_id = p_building_id
          AND (v_admin_id IS NULL OR id <> v_admin_id);

        IF array_length(v_resident_user_ids, 1) > 0 THEN
            DELETE FROM public.users WHERE id = ANY(v_resident_user_ids);
            BEGIN
                DELETE FROM auth.users WHERE id = ANY(v_resident_user_ids);
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;

        UPDATE public.buildings
        SET fund_balance = 0.00, updated_at = now()
        WHERE id = p_building_id;

        RETURN jsonb_build_object(
            'success', true,
            'mode', 'residents_only',
            'message', 'تم مسح جميع بيانات الشقق، المديونيات، السكان، والمصروفات بنجاح. العمارة الآن فارغة وجاهزة لإعادة التجربة مع بقاء حساب رئيس الاتحاد.'
        );

    -- Mode 2: حذف العمارة بالكامل وحساب رئيس الاتحاد
    ELSIF p_mode = 'full_delete' THEN
        DELETE FROM public.issue_upvotes WHERE building_id = p_building_id;
        DELETE FROM public.poll_votes WHERE building_id = p_building_id;
        DELETE FROM public.building_issues WHERE building_id = p_building_id;
        DELETE FROM public.polls WHERE building_id = p_building_id;
        DELETE FROM public.notifications WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claim_shares WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claims WHERE building_id = p_building_id;
        DELETE FROM public.payments WHERE building_id = p_building_id;
        DELETE FROM public.expenses WHERE building_id = p_building_id;
        DELETE FROM public.app_subscription_invoices WHERE building_id = p_building_id;
        DELETE FROM public.apartment_obligations WHERE building_id = p_building_id;

        UPDATE public.users
        SET apartment_id = NULL, apartment_number = NULL
        WHERE building_id = p_building_id;

        DELETE FROM public.apartments WHERE building_id = p_building_id;
        UPDATE public.buildings SET admin_id = NULL WHERE id = p_building_id;

        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[])
        INTO v_all_user_ids
        FROM public.users
        WHERE building_id = p_building_id
           OR (v_admin_id IS NOT NULL AND id = v_admin_id);

        DELETE FROM public.buildings WHERE id = p_building_id;

        IF array_length(v_all_user_ids, 1) > 0 THEN
            DELETE FROM public.users WHERE id = ANY(v_all_user_ids);
            BEGIN
                DELETE FROM auth.users WHERE id = ANY(v_all_user_ids);
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'mode', 'full_delete',
            'message', 'تم حذف العمارة بالكامل وجميع السجلات وحساب رئيس الاتحاد بنجاح.'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_building_data(UUID, TEXT, TEXT) TO authenticated, anon;
