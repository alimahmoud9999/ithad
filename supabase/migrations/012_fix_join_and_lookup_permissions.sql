-- ============================================================================
-- Migration: 012_fix_join_and_lookup_permissions.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Allow prospective residents to look up building apartments using 
--              the building invite code before having an active account.
--              1. Allow public.lookup_building_apartments_for_join for anon & authenticated.
--              2. Allow SELECT on public.buildings for anon & authenticated.
-- ============================================================================

-- 1. Ensure buildings table can be read by invite code for prospective residents
DROP POLICY IF EXISTS "buildings_select_policy" ON public.buildings;
DROP POLICY IF EXISTS "buildings_select_authenticated" ON public.buildings;
DROP POLICY IF EXISTS "buildings_select_by_code" ON public.buildings;

CREATE POLICY "buildings_select_policy"
    ON public.buildings
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- 2. Rewrite lookup_building_apartments_for_join to allow prospective users
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
    -- 1. Clean inputs
    IF p_phone IS NOT NULL THEN
        v_clean_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
        IF length(v_clean_phone) > 10 THEN
            v_clean_phone := right(v_clean_phone, 10);
        END IF;
    END IF;

    -- 2. Find building by exact building_code or apartment invite_code
    SELECT id, name, address, building_code, total_apartments, default_monthly_dues
    INTO v_building
    FROM public.buildings
    WHERE upper(trim(building_code)) = upper(trim(p_building_code));

    IF NOT FOUND THEN
        SELECT b.id, b.name, b.address, b.building_code, b.total_apartments, b.default_monthly_dues
        INTO v_building
        FROM public.apartments a
        JOIN public.buildings b ON b.id = a.building_id
        WHERE upper(trim(a.invite_code)) = upper(trim(p_building_code))
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'كود المبنى غير صحيح أو غير مسجل في قاعدة البيانات.'
        );
    END IF;

    -- 3. Fetch apartments for this building with safe occupant masking
    FOR v_apt IN
        SELECT 
            a.id,
            a.apartment_number,
            a.floor_number,
            a.wing_or_direction,
            a.occupant_name,
            a.occupant_phone,
            a.arrears_amount,
            (a.resident_id IS NOT NULL) AS is_occupied
        FROM public.apartments a
        WHERE a.building_id = v_building.id
          AND a.is_active = true
        ORDER BY 
            CASE WHEN a.apartment_number ~ '^\d+$' THEN a.apartment_number::INTEGER ELSE 99999 END,
            a.apartment_number
    LOOP
        v_is_match := false;
        IF v_clean_phone IS NOT NULL AND v_apt.occupant_phone IS NOT NULL THEN
            IF right(regexp_replace(v_apt.occupant_phone, '[^0-9]', '', 'g'), 10) = v_clean_phone THEN
                v_is_match := true;
                v_suggested_apt_id := v_apt.id;
                v_suggested_apt_number := v_apt.apartment_number;
                v_suggested_occupant_name := v_apt.occupant_name;
                v_suggested_floor_number := v_apt.floor_number;
            END IF;
        END IF;

        -- Safe name masking
        v_raw_name := COALESCE(v_apt.occupant_name, '');
        IF length(v_raw_name) > 3 THEN
            v_masked_name := left(v_raw_name, 2) || '***' || right(v_raw_name, 1);
        ELSE
            v_masked_name := v_raw_name;
        END IF;

        v_apartments := v_apartments || jsonb_build_object(
            'id', v_apt.id,
            'apartment_number', v_apt.apartment_number,
            'floor_number', v_apt.floor_number,
            'wing_or_direction', v_apt.wing_or_direction,
            'occupant_name', CASE WHEN v_is_match THEN v_apt.occupant_name ELSE v_masked_name END,
            'is_occupied', v_apt.is_occupied,
            'arrears_amount', v_apt.arrears_amount
        );
    END LOOP;

    RETURN jsonb_build_object(
        'building_id', v_building.id,
        'building_name', v_building.name,
        'building_code', v_building.building_code,
        'total_apartments', v_building.total_apartments,
        'default_monthly_dues', v_building.default_monthly_dues,
        'apartments', v_apartments,
        'suggested_apartment_id', v_suggested_apt_id,
        'suggested_apartment_number', v_suggested_apt_number,
        'suggested_occupant_name', v_suggested_occupant_name,
        'suggested_floor_number', v_suggested_floor_number
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_building_apartments_for_join(text, text) TO authenticated, anon;
