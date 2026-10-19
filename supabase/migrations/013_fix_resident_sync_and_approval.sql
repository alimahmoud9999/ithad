-- ============================================================================
-- Migration: 013_fix_resident_sync_and_approval.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: 
--   1. Allow pending residents to read apartments & obligations of their building.
--   2. Fix review_resident_join_request to overwrite apartment occupant_name & occupant_phone
--      with the approved resident's actual full_name and phone.
--   3. Auto-sync any existing approved resident names onto their apartments.
-- ============================================================================

-- 1. Update RLS: public.apartments (Allow building members, even if pending, to see building apartments)
DROP POLICY IF EXISTS "apartments_select_policy" ON public.apartments;
DROP POLICY IF EXISTS "apartments_select_authenticated" ON public.apartments;

CREATE POLICY "apartments_select_policy"
    ON public.apartments
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR building_id = public.get_my_building_id()
    );

-- 2. Update RLS: public.apartment_obligations (Allow building members to view their building obligations)
DROP POLICY IF EXISTS "apartment_obligations_select" ON public.apartment_obligations;
DROP POLICY IF EXISTS "apartment_obligations_select_authenticated" ON public.apartment_obligations;

CREATE POLICY "apartment_obligations_select"
    ON public.apartment_obligations
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR building_id = public.get_my_building_id()
    );

-- 3. Fix review_resident_join_request RPC to update occupant_name with the resident's actual name
CREATE OR REPLACE FUNCTION public.review_resident_join_request(
    p_resident_user_id UUID,
    p_approve BOOLEAN,
    p_override_apartment_id UUID DEFAULT NULL,
    p_override_apartment_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_resident RECORD;
    v_target_apt RECORD;
    v_final_apt_id UUID;
    v_final_apt_number TEXT;
    v_final_floor TEXT;
    v_new_status public.account_status;
BEGIN
    -- 1. Strict Identity Check via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only active building admins can review join requests.';
    END IF;

    -- 2. Validate Building Subscription / Writability
    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'Building subscription has expired (read-only mode). Cannot approve residents.';
    END IF;

    -- 3. Lock resident row FOR UPDATE
    SELECT * INTO v_resident
    FROM public.users
    WHERE id = p_resident_user_id
      AND building_id = v_admin.building_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending resident not found or belongs to another building.';
    END IF;

    IF v_resident.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Resident was already reviewed.',
            'status', v_resident.status
        );
    END IF;

    -- 4. Determine final apartment assignment
    v_final_apt_id := COALESCE(p_override_apartment_id, v_resident.apartment_id);
    v_final_apt_number := COALESCE(trim(p_override_apartment_number), v_resident.apartment_number);
    v_final_floor := v_resident.floor_number;

    IF p_override_apartment_id IS NOT NULL OR p_override_apartment_number IS NOT NULL THEN
        SELECT * INTO v_target_apt
        FROM public.apartments
        WHERE building_id = v_admin.building_id
          AND (
              (p_override_apartment_id IS NOT NULL AND id = p_override_apartment_id)
              OR
              (p_override_apartment_number IS NOT NULL AND apartment_number = trim(p_override_apartment_number))
          )
        LIMIT 1;

        IF FOUND THEN
            v_final_apt_id := v_target_apt.id;
            v_final_apt_number := v_target_apt.apartment_number;
            v_final_floor := COALESCE(v_target_apt.floor_number, v_resident.floor_number);
        ELSE
            IF p_override_apartment_id IS NOT NULL THEN
                RAISE EXCEPTION 'Specified override apartment does not exist in this building.';
            END IF;
            v_final_apt_number := trim(p_override_apartment_number);
        END IF;
    END IF;

    v_new_status := CASE WHEN p_approve THEN 'active'::public.account_status ELSE 'rejected'::public.account_status END;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 5. Update resident status and assigned unit
    UPDATE public.users
    SET status = v_new_status,
        apartment_id = v_final_apt_id,
        apartment_number = v_final_apt_number,
        floor_number = v_final_floor,
        updated_at = now()
    WHERE id = p_resident_user_id;

    -- 6. If approved, bind resident to unit and OVERWRITE occupant_name with resident's actual name
    IF p_approve AND v_final_apt_id IS NOT NULL THEN
        UPDATE public.apartments
        SET resident_id = p_resident_user_id,
            occupant_name = COALESCE(NULLIF(trim(v_resident.full_name), ''), occupant_name),
            occupant_phone = COALESCE(NULLIF(trim(v_resident.phone), ''), occupant_phone),
            updated_at = now()
        WHERE id = v_final_apt_id;
    END IF;

    -- 7. Send notification to resident
    INSERT INTO public.notifications (
        building_id,
        recipient_id,
        recipient_role,
        title,
        body,
        category
    ) VALUES (
        v_admin.building_id,
        p_resident_user_id,
        'resident',
        CASE WHEN p_approve THEN 'تم تفعيل حسابك بنجاح 🎉' ELSE 'تم رفض طلب الانضمام' END,
        CASE WHEN p_approve
            THEN format('تمت موافقة رئيس اتحاد الملاك على انضمامك وتسكينك على شقة رقم (%s). يمكنك الآن استخدام كافة خدمات التطبيق.', COALESCE(v_final_apt_number, '-'))
            ELSE 'نعتذر، لم تتم الموافقة على طلب انضمامك. يرجى التواصل مع رئيس اتحاد الملاك.'
        END,
        'join_request'
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', v_new_status,
        'resident_id', p_resident_user_id,
        'apartment_id', v_final_apt_id,
        'apartment_number', v_final_apt_number
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_resident_join_request(uuid, boolean, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_resident_join_request(uuid, boolean, uuid, text) TO authenticated;

-- 4. One-time fix: Sync any existing approved resident name onto their apartment
UPDATE public.apartments a
SET occupant_name = u.full_name,
    occupant_phone = u.phone,
    updated_at = now()
FROM public.users u
WHERE a.resident_id = u.id
  AND u.status = 'active'
  AND u.full_name IS NOT NULL
  AND u.full_name <> '';
