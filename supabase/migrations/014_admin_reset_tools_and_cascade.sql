-- ============================================================================
-- Migration: 014_admin_reset_tools_and_cascade.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Testing & Reset RPC for Admin & Super Admin:
--              1. reset_building_data(p_building_id UUID, p_mode TEXT)
--                 - 'residents_only': Wipes all apartments, obligations, payments,
--                   expenses, emergency claims, issues, polls, notifications, and
--                   resident users for the building while preserving the admin
--                   user and the building record (resets fund_balance = 0).
--                 - 'full_delete': Cascade-deletes the entire building, all child
--                   records, and the admin user profile (and auth.users), breaking
--                   circular foreign keys and signing admin out to onboarding.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_building_data(
    p_building_id UUID,
    p_mode TEXT
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
BEGIN
    -- 1. Security Check: Authenticated Caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'يجب تسجيل الدخول أولاً لتنفيذ هذه العملية'
        );
    END IF;

    -- 2. Verify Building Exists
    SELECT * INTO v_building FROM public.buildings WHERE id = p_building_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'العقار المحدد غير موجود في قاعدة البيانات'
        );
    END IF;

    -- 3. Verify Authorization (Super Admin OR Building Admin)
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'super_admin' AND (v_building.admin_id IS NULL OR v_building.admin_id <> v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'غير مصرح لك بإعادة تهيئة أو حذف بيانات هذه العمارة (مخصص لرئيس الاتحاد أو مدير النظام)'
        );
    END IF;

    v_admin_id := v_building.admin_id;

    -- ========================================================================
    -- Mode 1: 'residents_only' (تصفير العمارة مع بقاء حساب رئيس الاتحاد)
    -- ========================================================================
    IF p_mode = 'residents_only' THEN
        -- 1. Community Hub upvotes & votes
        DELETE FROM public.issue_upvotes WHERE building_id = p_building_id;
        DELETE FROM public.poll_votes WHERE building_id = p_building_id;

        -- 2. Community Hub issues & polls
        DELETE FROM public.building_issues WHERE building_id = p_building_id;
        DELETE FROM public.polls WHERE building_id = p_building_id;

        -- 3. Notifications
        DELETE FROM public.notifications WHERE building_id = p_building_id;

        -- 4. Emergency claims & claim shares
        DELETE FROM public.emergency_claim_shares WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claims WHERE building_id = p_building_id;

        -- 5. Payments
        DELETE FROM public.payments WHERE building_id = p_building_id;

        -- 6. Expenses
        DELETE FROM public.expenses WHERE building_id = p_building_id;

        -- 7. App subscription invoices
        DELETE FROM public.app_subscription_invoices WHERE building_id = p_building_id;

        -- 8. Apartment obligations & arrears
        DELETE FROM public.apartment_obligations WHERE building_id = p_building_id;

        -- 9. Disconnect users from apartments before removing apartments
        UPDATE public.users
        SET apartment_id = NULL,
            apartment_number = NULL
        WHERE building_id = p_building_id;

        -- 10. Delete all apartments
        DELETE FROM public.apartments WHERE building_id = p_building_id;

        -- 11. Gather non-admin residents
        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[])
        INTO v_resident_user_ids
        FROM public.users
        WHERE building_id = p_building_id
          AND (v_admin_id IS NULL OR id <> v_admin_id);

        -- Delete non-admin residents from public.users
        IF array_length(v_resident_user_ids, 1) > 0 THEN
            DELETE FROM public.users WHERE id = ANY(v_resident_user_ids);

            -- Attempt to delete from auth.users so their emails/phones are freed up
            BEGIN
                DELETE FROM auth.users WHERE id = ANY(v_resident_user_ids);
            EXCEPTION WHEN OTHERS THEN
                -- If auth delete has external restrictions, public.users is already cleaned
                NULL;
            END;
        END IF;

        -- 12. Reset building fund balance to 0 and clear registration metadata
        UPDATE public.buildings
        SET fund_balance = 0.00,
            updated_at = now()
        WHERE id = p_building_id;

        RETURN jsonb_build_object(
            'success', true,
            'mode', 'residents_only',
            'message', 'تم مسح جميع بيانات الشقق، المديونيات، السكان، والمصروفات بنجاح. العمارة الآن فارغة وجاهزة لإعادة التجربة مع بقاء حساب رئيس الاتحاد.'
        );

    -- ========================================================================
    -- Mode 2: 'full_delete' (حذف العمارة بالكامل وحساب رئيس الاتحاد)
    -- ========================================================================
    ELSIF p_mode = 'full_delete' THEN
        -- 1. Community Hub upvotes & votes
        DELETE FROM public.issue_upvotes WHERE building_id = p_building_id;
        DELETE FROM public.poll_votes WHERE building_id = p_building_id;

        -- 2. Community Hub issues & polls
        DELETE FROM public.building_issues WHERE building_id = p_building_id;
        DELETE FROM public.polls WHERE building_id = p_building_id;

        -- 3. Notifications
        DELETE FROM public.notifications WHERE building_id = p_building_id;

        -- 4. Emergency claims & claim shares
        DELETE FROM public.emergency_claim_shares WHERE building_id = p_building_id;
        DELETE FROM public.emergency_claims WHERE building_id = p_building_id;

        -- 5. Payments
        DELETE FROM public.payments WHERE building_id = p_building_id;

        -- 6. Expenses
        DELETE FROM public.expenses WHERE building_id = p_building_id;

        -- 7. App subscription invoices
        DELETE FROM public.app_subscription_invoices WHERE building_id = p_building_id;

        -- 8. Apartment obligations & arrears
        DELETE FROM public.apartment_obligations WHERE building_id = p_building_id;

        -- 9. Disconnect users from apartments
        UPDATE public.users
        SET apartment_id = NULL,
            apartment_number = NULL
        WHERE building_id = p_building_id;

        -- 10. Delete all apartments
        DELETE FROM public.apartments WHERE building_id = p_building_id;

        -- 11. Break circular foreign key between buildings.admin_id and users.id
        UPDATE public.buildings SET admin_id = NULL WHERE id = p_building_id;

        -- 12. Gather all user IDs of this building (including admin)
        SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[])
        INTO v_all_user_ids
        FROM public.users
        WHERE building_id = p_building_id
           OR (v_admin_id IS NOT NULL AND id = v_admin_id);

        -- 13. Delete the building itself
        DELETE FROM public.buildings WHERE id = p_building_id;

        -- 14. Delete the users from public.users
        IF array_length(v_all_user_ids, 1) > 0 THEN
            DELETE FROM public.users WHERE id = ANY(v_all_user_ids);

            -- Attempt to delete from auth.users to release email/phone logins
            BEGIN
                DELETE FROM auth.users WHERE id = ANY(v_all_user_ids);
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'mode', 'full_delete',
            'message', 'تم حذف العمارة بالكامل وجميع السجلات وحساب رئيس الاتحاد بنجاح. يمكنك الآن البدء من جديد كأنك تسجل لأول مرة.'
        );

    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'نوع العملية غير مدعوم. اختر إما residents_only أو full_delete'
        );
    END IF;
END;
$$;

-- Grant execution to authenticated users (internal checks enforce admin/super_admin role)
GRANT EXECUTE ON FUNCTION public.reset_building_data(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.reset_building_data IS 'دالة آمنة لإعادة تهيئة بيانات العمارة أو حذفها بالكامل مع حساب المدير لتسهيل وتسريع عمليات الاختبار والتطوير';
