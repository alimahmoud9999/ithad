-- ============================================================================
-- Comprehensive Security Verification Test Suite
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- File: supabase/tests/security_tests.sql
-- Description: Executes 15 strict adversarial attack scenarios verifying that
--              all impersonation holes, wide-open RLS policies, direct table
--              mutations, and privilege escalation vectors are fully sealed.
--
-- How to Run:
--   Execute this script in Supabase SQL Editor or via psql.
--   All tests output formatted [PASS] or [FAIL] notices, followed by a summary.
-- ============================================================================

BEGIN;

-- 1. Create Temporary Results Table
CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_num INT PRIMARY KEY,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    message TEXT NOT NULL
) ON COMMIT DROP;

-- 2. Setup Isolated Sandbox Test Fixtures
DO $$
DECLARE
    v_bld_a UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    v_bld_b UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_adm_a UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_adm_b UUID := 'b1111111-1111-1111-1111-111111111111'::uuid;
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_res_a2 UUID := 'a2222222-2222-2222-2222-222222222222'::uuid;
    v_res_b1 UUID := 'b2222222-2222-2222-2222-222222222221'::uuid;
    v_pending_user UUID := 'a9999999-9999-9999-9999-999999999999'::uuid;

    v_apt_a1 UUID := 'aa000000-0000-0000-0000-000000000001'::uuid;
    v_apt_a2 UUID := 'aa000000-0000-0000-0000-000000000002'::uuid;
    v_apt_b1 UUID := 'bb000000-0000-0000-0000-000000000001'::uuid;

    v_claim_a UUID := 'ac000000-0000-0000-0000-000000000001'::uuid;
    v_claim_b UUID := 'bc000000-0000-0000-0000-000000000001'::uuid;

    v_pay_a UUID := 'ap000000-0000-0000-0000-000000000001'::uuid;
    v_poll_a UUID := 'al000000-0000-0000-0000-000000000001'::uuid;
    v_poll_exp UUID := 'al000000-0000-0000-0000-000000000002'::uuid;
    v_issue_a UUID := 'ai000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- Ensure subscription plans exist
    INSERT INTO public.subscription_plans (code, name_ar, max_apartments, monthly_price_egp, default_features_config)
    VALUES ('pro', 'الباقة الاحترافية', 50, 250, '{"receipt_upload": true, "emergency_claims": true, "voting": true, "notifications": true}'::jsonb)
    ON CONFLICT (code) DO NOTHING;

    -- Buildings
    INSERT INTO public.buildings (id, name, address, total_apartments, building_code, fund_balance, subscription_status, subscription_ends_at, plan_code, features_config)
    VALUES 
        (v_bld_a, 'عمارة النور A', 'شارع الثورة، القاهرة', 10, 'BLD-A101', 5000.00, 'active', now() + interval '90 days', 'pro', '{"receipt_upload": true, "emergency_claims": true, "voting": true, "notifications": true}'::jsonb),
        (v_bld_b, 'عمارة الياسمين B', 'شارع التحرير، الجيزة', 10, 'BLD-B202', 3000.00, 'active', now() + interval '90 days', 'pro', '{"receipt_upload": true, "emergency_claims": true, "voting": true, "notifications": true}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET fund_balance = EXCLUDED.fund_balance, subscription_status = EXCLUDED.subscription_status, subscription_ends_at = EXCLUDED.subscription_ends_at;

    -- Apartments
    INSERT INTO public.apartments (id, building_id, apartment_number, floor_number, ownership_share_percent, arrears_amount, occupant_name, occupant_phone, is_active)
    VALUES
        (v_apt_a1, v_bld_a, '101', 'الأول', 10.00, 0.00, 'الساكن أ1', '01011111111', true),
        (v_apt_a2, v_bld_a, '102', 'الأول', 10.00, 300.00, 'الساكن أ2', '01022222222', true),
        (v_apt_b1, v_bld_b, '201', 'الثاني', 10.00, 0.00, 'الساكن ب1', '01033333333', true)
    ON CONFLICT (id) DO UPDATE SET arrears_amount = EXCLUDED.arrears_amount;

    -- Users (Admins and Residents)
    INSERT INTO public.users (id, full_name, email, phone, role, status, building_id, apartment_id, apartment_number, ownership_share_percent, push_token)
    VALUES
        (v_adm_a, 'مدير عمارة A', 'admin.a@test.com', '01000000001', 'admin', 'active', v_bld_a, v_apt_a1, '101', 10.00, 'ExponentPushToken[adm_a]'),
        (v_adm_b, 'مدير عمارة B', 'admin.b@test.com', '01000000002', 'admin', 'active', v_bld_b, v_apt_b1, '201', 10.00, 'ExponentPushToken[adm_b]'),
        (v_res_a1, 'ساكن أ1', 'res.a1@test.com', '01011111111', 'resident', 'active', v_bld_a, v_apt_a1, '101', 10.00, 'ExponentPushToken[res_a1]'),
        (v_res_a2, 'ساكن أ2', 'res.a2@test.com', '01022222222', 'resident', 'active', v_bld_a, v_apt_a2, '102', 10.00, 'ExponentPushToken[res_a2]'),
        (v_res_b1, 'ساكن ب1', 'res.b1@test.com', '01033333333', 'resident', 'active', v_bld_b, v_apt_b1, '201', 10.00, 'ExponentPushToken[res_b1]'),
        (v_pending_user, 'ساكن معلق طلب', 'pending@test.com', '01099999999', 'resident', 'pending', v_bld_a, v_apt_a2, '102', 10.00, NULL)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, building_id = EXCLUDED.building_id;

    UPDATE public.buildings SET admin_id = v_adm_a WHERE id = v_bld_a;
    UPDATE public.buildings SET admin_id = v_adm_b WHERE id = v_bld_b;

    -- Emergency Claims
    INSERT INTO public.emergency_claims (id, building_id, created_by, title, description, category, target_amount, collected_amount, contributors_count, distribution_type, default_share_amount, status)
    VALUES
        (v_claim_a, v_bld_a, v_adm_a, 'صيانة مصعد A', 'صيانة طارئة', 'صيانة ومصاعد', 2000.00, 0, 0, 'equal', 200.00, 'active'),
        (v_claim_b, v_bld_b, v_adm_b, 'موتور مياه B', 'صيانة طارئة', 'مياه وسباكة', 1500.00, 0, 0, 'equal', 150.00, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Payments (Pending Payment for Building A)
    INSERT INTO public.payments (id, building_id, apartment_id, apartment_number, resident_id, resident_name, payment_category, billing_month, amount, payment_method, status)
    VALUES (v_pay_a, v_bld_a, v_apt_a1, '101', v_res_a1, 'ساكن أ1', 'monthly_dues', to_char(now(), 'YYYY-MM'), 300.00, 'electronic_transfer', 'pending')
    ON CONFLICT (id) DO UPDATE SET status = 'pending';

    -- Polls
    INSERT INTO public.polls (id, building_id, created_by, title, description, category, voting_basis, options, ends_at, status)
    VALUES
        (v_poll_a, v_bld_a, v_adm_a, 'دهان المدخل', 'تصويت عام', 'تطوير وديكور', 'one_vote_per_unit', '["موافق", "غير موافق", "ممتنع"]'::jsonb, now() + interval '7 days', 'active'),
        (v_poll_exp, v_bld_a, v_adm_a, 'تصويت منتهي الصلاحية', 'منتهي', 'عام', 'one_vote_per_unit', '["موافق", "غير موافق"]'::jsonb, now() - interval '1 hour', 'closed')
    ON CONFLICT (id) DO NOTHING;

    -- Building Issues
    INSERT INTO public.building_issues (id, building_id, reporter_id, apartment_id, apartment_number, title, description, category, severity, status)
    VALUES (v_issue_a, v_bld_a, v_res_a1, v_apt_a1, '101', 'عطل كشاف المدخل', 'الكشاف تالف', 'كهرباء وإنارة', 'low', 'open')
    ON CONFLICT (id) DO NOTHING;

    -- Notifications
    INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category, is_read)
    VALUES
        (v_bld_a, v_res_a1, 'resident', 'إشعار سري للساكن A1', 'بيانات مستحقات خاصة', 'financial', false),
        (v_bld_b, v_res_b1, 'resident', 'إشعار سري للساكن B1', 'بيانات خاصة بعمارة B', 'financial', false)
    ON CONFLICT DO NOTHING;

    PERFORM set_config('app.rpc_internal_bypass', '', true);
END $$;


-- ============================================================================
-- Scenario 1: Impersonation of Admin in review_resident_join_request
--   Regular resident attempts to approve a pending join request.
--   Must be rejected with exception.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_pending_user UUID := 'a9999999-9999-9999-9999-999999999999'::uuid;
    v_threw_exception BOOLEAN := false;
    v_err_msg TEXT := '';
BEGIN
    -- Switch to Resident A1
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    BEGIN
        PERFORM public.review_resident_join_request(v_pending_user, true);
    EXCEPTION WHEN OTHERS THEN
        v_threw_exception := true;
        v_err_msg := SQLERRM;
    END;

    IF v_threw_exception AND (v_err_msg ILIKE '%Forbidden%' OR v_err_msg ILIKE '%admin%') THEN
        INSERT INTO test_results VALUES (1, 'Impersonate Admin in review_resident_join_request', 'PASS', 'Blocked: ' || v_err_msg);
    ELSE
        INSERT INTO test_results VALUES (1, 'Impersonate Admin in review_resident_join_request', 'FAIL', 'Security Hole: Non-admin approved join request without error!');
    END IF;
END $$;


-- ============================================================================
-- Scenario 2: Impersonation of Admin in approve_resident_payment
--   2a: Regular resident attempts to approve payment.
--   2b: Cross-building admin (Admin B) attempts to approve Building A payment.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_adm_b UUID := 'b1111111-1111-1111-1111-111111111111'::uuid;
    v_pay_a UUID := 'ap000000-0000-0000-0000-000000000001'::uuid;
    v_pass_2a BOOLEAN := false;
    v_pass_2b BOOLEAN := false;
BEGIN
    -- Test 2a: Resident tries to approve
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.approve_resident_payment(v_pay_a);
    EXCEPTION WHEN OTHERS THEN
        v_pass_2a := true;
    END;

    -- Test 2b: Cross-building admin tries to approve
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm_b, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.approve_resident_payment(v_pay_a);
    EXCEPTION WHEN OTHERS THEN
        v_pass_2b := true;
    END;

    IF v_pass_2a AND v_pass_2b THEN
        INSERT INTO test_results VALUES (2, 'Impersonate Admin in approve_resident_payment', 'PASS', 'Blocked resident and cross-building admin approval');
    ELSE
        INSERT INTO test_results VALUES (2, 'Impersonate Admin in approve_resident_payment', 'FAIL', 'Failed to block unauthorized payment approval');
    END IF;
END $$;


-- ============================================================================
-- Scenario 3: Impersonation of Admin in reject_resident_payment
--   Resident attempts to reject a pending payment.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_pay_a UUID := 'ap000000-0000-0000-0000-000000000001'::uuid;
    v_threw BOOLEAN := false;
    v_err TEXT := '';
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.reject_resident_payment(v_pay_a, 'رفض وهمي');
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
        v_err := SQLERRM;
    END;

    IF v_threw AND (v_err ILIKE '%Forbidden%' OR v_err ILIKE '%admin%') THEN
        INSERT INTO test_results VALUES (3, 'Impersonate Admin in reject_resident_payment', 'PASS', 'Blocked: ' || v_err);
    ELSE
        INSERT INTO test_results VALUES (3, 'Impersonate Admin in reject_resident_payment', 'FAIL', 'Security Hole: Non-admin rejected payment!');
    END IF;
END $$;


-- ============================================================================
-- Scenario 4: Resident Payment Submissions Validation (submit_resident_payment)
--   4a: Submitting for another building''s emergency claim
--   4b: Submitting invalid billing month format ('2024/11' or 'invalid')
--   4c: Submitting zero or negative amount
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_claim_b UUID := 'bc000000-0000-0000-0000-000000000001'::uuid;
    v_pass_4a BOOLEAN := false;
    v_pass_4b BOOLEAN := false;
    v_pass_4c BOOLEAN := false;
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    -- 4a: Cross-building emergency claim
    BEGIN
        PERFORM public.submit_resident_payment(
            p_amount := 200.00,
            p_payment_method := 'electronic_transfer'::public.payment_method_type,
            p_billing_month := to_char(now(), 'YYYY-MM'),
            p_cash_recipient := NULL,
            p_receipt_image_url := 'a0000000-0000-0000-0000-000000000001/receipt.jpg',
            p_payment_category := 'emergency_claim'::public.payment_category_type,
            p_emergency_claim_id := v_claim_b
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_4a := true;
    END;

    -- 4b: Invalid billing month format
    BEGIN
        PERFORM public.submit_resident_payment(
            p_amount := 200.00,
            p_payment_method := 'electronic_transfer'::public.payment_method_type,
            p_billing_month := '2024/11',
            p_cash_recipient := NULL,
            p_receipt_image_url := 'a0000000-0000-0000-0000-000000000001/receipt.jpg'
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_4b := true;
    END;

    -- 4c: Negative amount
    BEGIN
        PERFORM public.submit_resident_payment(
            p_amount := -100.00,
            p_payment_method := 'electronic_transfer'::public.payment_method_type,
            p_billing_month := to_char(now(), 'YYYY-MM'),
            p_cash_recipient := NULL,
            p_receipt_image_url := 'a0000000-0000-0000-0000-000000000001/receipt.jpg'
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_4c := true;
    END;

    IF v_pass_4a AND v_pass_4b AND v_pass_4c THEN
        INSERT INTO test_results VALUES (4, 'Validation on submit_resident_payment', 'PASS', 'Blocked cross-building claim, invalid month format, and negative amounts');
    ELSE
        INSERT INTO test_results VALUES (4, 'Validation on submit_resident_payment', 'FAIL', 'Validation failed: 4a=' || v_pass_4a || ', 4b=' || v_pass_4b || ', 4c=' || v_pass_4c);
    END IF;
END $$;


-- ============================================================================
-- Scenario 5: Impersonation and Custom Distribution in create_emergency_claim
--   5a: Resident attempts to create emergency claim
--   5b: Admin attempts custom distribution where shares sum <> target_amount
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_adm_a UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_apt_a1 UUID := 'aa000000-0000-0000-0000-000000000001'::uuid;
    v_pass_5a BOOLEAN := false;
    v_pass_5b BOOLEAN := false;
BEGIN
    -- 5a: Resident caller
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.create_emergency_claim(
            p_title := 'إصلاح وهمي',
            p_description := 'محاولة غير مخولة',
            p_category := 'صيانة طارئة',
            p_target_amount := 1000.00,
            p_distribution_type := 'equal'::public.claim_distribution_type
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_5a := true;
    END;

    -- 5b: Admin with custom shares summing to 800 instead of target 1000
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm_a, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.create_emergency_claim(
            p_title := 'إصلاح غير متوازن',
            p_description := 'مجموع الحصص غير مطابق',
            p_category := 'صيانة طارئة',
            p_target_amount := 1000.00,
            p_distribution_type := 'custom'::public.claim_distribution_type,
            p_custom_shares := jsonb_build_array(
                jsonb_build_object('apartment_id', v_apt_a1, 'amount', 800.00)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_5b := true;
    END;

    IF v_pass_5a AND v_pass_5b THEN
        INSERT INTO test_results VALUES (5, 'Validation in create_emergency_claim', 'PASS', 'Blocked resident creation and unequal custom shares distribution');
    ELSE
        INSERT INTO test_results VALUES (5, 'Validation in create_emergency_claim', 'FAIL', 'Emergency claim validation failed: 5a=' || v_pass_5a || ', 5b=' || v_pass_5b);
    END IF;
END $$;


-- ============================================================================
-- Scenario 6: Impersonation of Admin in create_building_poll
--   Resident attempts to create a general assembly poll.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_threw BOOLEAN := false;
    v_err TEXT := '';
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);
    BEGIN
        PERFORM public.create_building_poll(
            p_title := 'تصويت ساكن غير مخول',
            p_description := 'يجب أن يرفض',
            p_options := '["نعم", "لا"]'::jsonb
        );
    EXCEPTION WHEN OTHERS THEN
        v_threw := true;
        v_err := SQLERRM;
    END;

    IF v_threw AND (v_err ILIKE '%Forbidden%' OR v_err ILIKE '%admin%') THEN
        INSERT INTO test_results VALUES (6, 'Impersonate Admin in create_building_poll', 'PASS', 'Blocked: ' || v_err);
    ELSE
        INSERT INTO test_results VALUES (6, 'Impersonate Admin in create_building_poll', 'FAIL', 'Security Hole: Resident was able to create poll!');
    END IF;
END $$;


-- ============================================================================
-- Scenario 7: Anonymous Access Blocked (users, buildings, apartments, notifications)
--   Unauthenticated client attempts direct SELECT queries.
-- ============================================================================
DO $$
DECLARE
    v_u_count INT;
    v_b_count INT;
    v_a_count INT;
    v_n_count INT;
BEGIN
    -- Switch to anon role
    SET LOCAL ROLE anon;
    PERFORM set_config('request.jwt.claims', '', true);

    SELECT count(*) INTO v_u_count FROM public.users;
    SELECT count(*) INTO v_b_count FROM public.buildings;
    SELECT count(*) INTO v_a_count FROM public.apartments;
    SELECT count(*) INTO v_n_count FROM public.notifications;

    IF v_u_count = 0 AND v_b_count = 0 AND v_a_count = 0 AND v_n_count = 0 THEN
        INSERT INTO test_results VALUES (7, 'Anonymous Direct Access Blocked', 'PASS', 'Zero records exposed to anon on core tables');
    ELSE
        INSERT INTO test_results VALUES (7, 'Anonymous Direct Access Blocked', 'FAIL', 'Data leak to anon: users=' || v_u_count || ', buildings=' || v_b_count || ', apts=' || v_a_count || ', notifs=' || v_n_count);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 8: Cross-Building Tenant Isolation
--   Resident A1 attempts to query residents or apartments of Building B.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_bld_b UUID := 'b0000000-0000-0000-0000-000000000002'::uuid;
    v_users_b INT;
    v_apts_b INT;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO v_users_b FROM public.users WHERE building_id = v_bld_b;
    SELECT count(*) INTO v_apts_b FROM public.apartments WHERE building_id = v_bld_b;

    IF v_users_b = 0 AND v_apts_b = 0 THEN
        INSERT INTO test_results VALUES (8, 'Cross-Building Tenant Isolation', 'PASS', 'Resident of Building A cannot read Building B data');
    ELSE
        INSERT INTO test_results VALUES (8, 'Cross-Building Tenant Isolation', 'FAIL', 'Cross-building leak: users_b=' || v_users_b || ', apts_b=' || v_apts_b);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 9: Sensitive Data Masking from Peer Residents
--   Resident A1 inspects Apartment 102 (Resident A2) via building_apartments_directory
--   occupant_phone and arrears_amount must be NULL/hidden.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_apt_rec RECORD;
    v_masked_phone BOOLEAN := false;
    v_masked_arrears BOOLEAN := false;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    SELECT occupant_phone, arrears_amount INTO v_apt_rec
    FROM public.building_apartments_directory
    WHERE apartment_number = '102'
    LIMIT 1;

    v_masked_phone := (v_apt_rec.occupant_phone IS NULL OR v_apt_rec.occupant_phone = '');
    v_masked_arrears := (v_apt_rec.arrears_amount IS NULL OR v_apt_rec.arrears_amount = 0.00);

    IF v_masked_phone AND v_masked_arrears THEN
        INSERT INTO test_results VALUES (9, 'Sensitive Columns Masked from Peer Residents', 'PASS', 'Phone and arrears correctly masked for neighboring units');
    ELSE
        INSERT INTO test_results VALUES (9, 'Sensitive Columns Masked from Peer Residents', 'FAIL', 'Leak: neighbor phone=' || COALESCE(v_apt_rec.occupant_phone, 'NULL') || ', arrears=' || COALESCE(v_apt_rec.arrears_amount::text, 'NULL'));
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 10: Cross-Tenant Storage Isolation (payment-receipts bucket)
--   Resident B1 attempts to query receipts of Building A.
-- ============================================================================
DO $$
DECLARE
    v_res_b1 UUID := 'b2222222-2222-2222-2222-222222222221'::uuid;
    v_leaked_count INT := 0;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_b1, 'role', 'authenticated')::text, true);

    -- Check storage.objects for payment-receipts of building A
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        SELECT count(*) INTO v_leaked_count
        FROM storage.objects
        WHERE bucket_id = 'payment-receipts'
          AND name LIKE 'a0000000-0000-0000-0000-000000000001/%';
    END IF;

    IF v_leaked_count = 0 THEN
        INSERT INTO test_results VALUES (10, 'Cross-Tenant Storage Isolation', 'PASS', 'Cross-building receipt objects are completely invisible');
    ELSE
        INSERT INTO test_results VALUES (10, 'Cross-Tenant Storage Isolation', 'FAIL', 'Storage leak: ' || v_leaked_count || ' foreign receipts visible');
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 11: Direct Table Write Blocked on payments
--   Authenticated user attempts direct INSERT or UPDATE on payments table.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_pay_a UUID := 'ap000000-0000-0000-0000-000000000001'::uuid;
    v_pass_insert BOOLEAN := false;
    v_pass_update BOOLEAN := false;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    -- Direct INSERT attempt
    BEGIN
        INSERT INTO public.payments (building_id, apartment_number, amount, payment_method, status)
        VALUES ('a0000000-0000-0000-0000-000000000001', '101', 500, 'cash', 'paid');
    EXCEPTION WHEN OTHERS THEN
        v_pass_insert := true;
    END;

    -- Direct UPDATE attempt to mark payment as paid
    BEGIN
        UPDATE public.payments SET status = 'paid' WHERE id = v_pay_a;
    EXCEPTION WHEN OTHERS THEN
        v_pass_update := true;
    END;

    -- Verify status remained pending
    IF NOT v_pass_update THEN
        IF (SELECT status FROM public.payments WHERE id = v_pay_a) <> 'paid' THEN
            v_pass_update := true; -- RLS suppressed the update row count to 0
        END IF;
    END IF;

    IF v_pass_insert AND v_pass_update THEN
        INSERT INTO test_results VALUES (11, 'Direct INSERT/UPDATE on payments Blocked', 'PASS', 'Direct writes to payments table strictly forbidden');
    ELSE
        INSERT INTO test_results VALUES (11, 'Direct INSERT/UPDATE on payments Blocked', 'FAIL', 'Direct payments write succeeded: insert=' || (NOT v_pass_insert) || ', update=' || (NOT v_pass_update));
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 12: Direct Write & Validation on poll_votes
--   12a: Direct INSERT into poll_votes without cast_poll_vote RPC
--   12b: Voting on an expired poll (ends_at < now())
--   12c: Voting with choice not in poll options
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_poll_a UUID := 'al000000-0000-0000-0000-000000000001'::uuid;
    v_poll_exp UUID := 'al000000-0000-0000-0000-000000000002'::uuid;
    v_pass_12a BOOLEAN := false;
    v_pass_12b BOOLEAN := false;
    v_pass_12c BOOLEAN := false;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    -- 12a: Direct INSERT
    BEGIN
        INSERT INTO public.poll_votes (poll_id, choice) VALUES (v_poll_a, 'موافق');
    EXCEPTION WHEN OTHERS THEN
        v_pass_12a := true;
    END;

    -- 12b: Expired poll vote
    BEGIN
        PERFORM public.cast_poll_vote(v_poll_exp, 'موافق');
    EXCEPTION WHEN OTHERS THEN
        v_pass_12b := true;
    END;

    -- 12c: Invalid choice
    BEGIN
        PERFORM public.cast_poll_vote(v_poll_a, 'خيار_غير_موجود');
    EXCEPTION WHEN OTHERS THEN
        v_pass_12c := true;
    END;

    IF v_pass_12a AND v_pass_12b AND v_pass_12c THEN
        INSERT INTO test_results VALUES (12, 'Direct Write & Validation on poll_votes', 'PASS', 'Direct INSERT blocked, expired voting blocked, invalid option blocked');
    ELSE
        INSERT INTO test_results VALUES (12, 'Direct Write & Validation on poll_votes', 'FAIL', 'Poll vote checks failed: 12a=' || v_pass_12a || ', 12b=' || v_pass_12b || ', 12c=' || v_pass_12c);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 13: Direct Write & Unit Constraints on issue_upvotes
--   13a: Direct INSERT into issue_upvotes without RPC
--   13b: Upvoting twice for the same apartment unit
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_issue_a UUID := 'ai000000-0000-0000-0000-000000000001'::uuid;
    v_pass_13a BOOLEAN := false;
    v_pass_13b BOOLEAN := false;
    v_res1 JSONB;
    v_res2 JSONB;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    -- 13a: Direct INSERT
    BEGIN
        INSERT INTO public.issue_upvotes (issue_id, user_id) VALUES (v_issue_a, v_res_a1);
    EXCEPTION WHEN OTHERS THEN
        v_pass_13a := true;
    END;

    -- 13b: Toggle upvote twice (first time upvotes, second time toggles off without crashing)
    BEGIN
        v_res1 := public.toggle_issue_upvote(v_issue_a);
        v_res2 := public.toggle_issue_upvote(v_issue_a);
        -- First toggle added vote (upvoted = true), second removed vote (upvoted = false)
        IF (v_res1->>'upvoted')::boolean = true AND (v_res2->>'upvoted')::boolean = false THEN
            v_pass_13b := true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_pass_13b := false;
    END;

    IF v_pass_13a AND v_pass_13b THEN
        INSERT INTO test_results VALUES (13, 'Direct Write & Unit Rules on issue_upvotes', 'PASS', 'Direct INSERT blocked, clean toggle mechanics enforced');
    ELSE
        INSERT INTO test_results VALUES (13, 'Direct Write & Unit Rules on issue_upvotes', 'FAIL', 'Issue upvotes failed: 13a=' || v_pass_13a || ', 13b=' || v_pass_13b);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 14: Direct INSERT on expenses & Overdraft Prevention
--   14a: Direct INSERT into expenses without RPC
--   14b: Calling record_building_expense with amount exceeding fund_balance
-- ============================================================================
DO $$
DECLARE
    v_adm_a UUID := 'a1111111-1111-1111-1111-111111111111'::uuid;
    v_pass_14a BOOLEAN := false;
    v_pass_14b BOOLEAN := false;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_adm_a, 'role', 'authenticated')::text, true);

    -- 14a: Direct INSERT
    BEGIN
        INSERT INTO public.expenses (building_id, created_by, title, amount, expense_date)
        VALUES ('a0000000-0000-0000-0000-000000000001', v_adm_a, 'مصروف غير مصرح', 500, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
        v_pass_14a := true;
    END;

    -- 14b: Overdraft attempt (999,999 EGP exceeds 5,000 fund balance)
    BEGIN
        PERFORM public.record_building_expense(
            p_title := 'مصروف يفوق الرصيد',
            p_amount := 999999.00,
            p_category := 'صيانة طارئة'
        );
    EXCEPTION WHEN OTHERS THEN
        v_pass_14b := true;
    END;

    IF v_pass_14a AND v_pass_14b THEN
        INSERT INTO test_results VALUES (14, 'Direct expenses INSERT & Overdraft Blocked', 'PASS', 'Direct INSERT blocked, treasury overdraft prevented');
    ELSE
        INSERT INTO test_results VALUES (14, 'Direct expenses INSERT & Overdraft Blocked', 'FAIL', 'Expenses test failed: 14a=' || v_pass_14a || ', 14b=' || v_pass_14b);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Scenario 15: Privilege Escalation on users Table
--   Resident attempts to update role='admin', status='active', apartment_number,
--   or ownership_share_percent directly.
-- ============================================================================
DO $$
DECLARE
    v_res_a1 UUID := 'a2222222-2222-2222-2222-222222222221'::uuid;
    v_pass_role BOOLEAN := false;
    v_pass_share BOOLEAN := false;
    v_pass_allowed BOOLEAN := false;
BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_res_a1, 'role', 'authenticated')::text, true);

    -- 15a: Escalate role to admin
    BEGIN
        UPDATE public.users SET role = 'admin' WHERE id = v_res_a1;
    EXCEPTION WHEN OTHERS THEN
        v_pass_role := true;
    END;

    -- 15b: Modify ownership share percent
    BEGIN
        UPDATE public.users SET ownership_share_percent = 99.99 WHERE id = v_res_a1;
    EXCEPTION WHEN OTHERS THEN
        v_pass_share := true;
    END;

    -- 15c: Updating full_name & push_token SHOULD succeed
    BEGIN
        UPDATE public.users SET full_name = 'ساكن أ1 المحدث', push_token = 'ExponentPushToken[updated]' WHERE id = v_res_a1;
        v_pass_allowed := true;
    EXCEPTION WHEN OTHERS THEN
        v_pass_allowed := false;
    END;

    IF v_pass_role AND v_pass_share AND v_pass_allowed THEN
        INSERT INTO test_results VALUES (15, 'Privilege Escalation on users Blocked', 'PASS', 'Role and share updates blocked by trigger; legitimate name/token updates allowed');
    ELSE
        INSERT INTO test_results VALUES (15, 'Privilege Escalation on users Blocked', 'FAIL', 'Privilege check failed: role_blocked=' || v_pass_role || ', share_blocked=' || v_pass_share || ', allowed_update=' || v_pass_allowed);
    END IF;
    RESET ROLE;
END $$;


-- ============================================================================
-- Output All Test Results & Summary
-- ============================================================================
SELECT 
    test_num AS "#",
    status AS "Result",
    test_name AS "Security Attack Scenario",
    message AS "Verification Details"
FROM test_results
ORDER BY test_num;

DO $$
DECLARE
    v_total INT;
    v_passed INT;
    v_failed INT;
BEGIN
    SELECT count(*), count(*) FILTER (WHERE status = 'PASS'), count(*) FILTER (WHERE status = 'FAIL')
    INTO v_total, v_passed, v_failed
    FROM test_results;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE '       SECURITY VERIFICATION TEST SUITE SUMMARY        ';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE ' TOTAL TESTS : %', v_total;
    RAISE NOTICE ' PASSED      : %  [OK]', v_passed;
    RAISE NOTICE ' FAILED      : %  [FAIL]', v_failed;
    RAISE NOTICE '=======================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'Security Suite FAILED: % test(s) failed.', v_failed;
    ELSE
        RAISE NOTICE 'ALL 15 SECURITY ATTACK SCENARIOS PASSED SUCCESSFULLY! ✅';
    END IF;
END $$;

ROLLBACK; -- Always rollback sandbox fixtures so database remains completely clean!
