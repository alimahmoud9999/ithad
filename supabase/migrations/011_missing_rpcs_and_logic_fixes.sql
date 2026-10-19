-- ============================================================================
-- Migration: 011_missing_rpcs_and_logic_fixes.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Step 5 Security & Business Logic Hardening:
--              1. Drop unused legacy table maintenance_tickets (superseded by building_issues).
--              2. Rewrite request_join_building:
--                 - Requires auth.uid().
--                 - Removes split_part hack on building_code.
--                 - Checks if user is already an active member of another building.
--                 - Enforces max_apartments_override / subscription plan limits.
--              3. Rewrite create_building_for_admin:
--                 - Reads email safely from auth.jwt() or public.users (not raw auth.users).
--                 - Prevents admin from creating multiple buildings.
--                 - Promotes user profile to role = 'admin' and status = 'active'.
--              4. Add reject_app_subscription_invoice (Super Admin only, FOR UPDATE, notify admin).
--              5. Rewrite submit_app_subscription_invoice:
--                 - Active admin only, building strictly from DB, FOR UPDATE lock,
--                 - Validates receipt image, prevents duplicate pending invoices.
--              6. Rewrite send_bulk_unpaid_reminder:
--                 - Active admin only, checks notifications feature flag & writability,
--                 - Generates reminders for overdue apartments only for target month.
--              7. Enforce feature flags across all workflows.
-- ============================================================================

-- ============================================================================
-- 1. Drop Legacy Unused maintenance_tickets Table
--    (Superseded by building_issues in 007_community_hub_issues_and_polls.sql)
-- ============================================================================
DROP TABLE IF EXISTS public.maintenance_tickets CASCADE;

-- ============================================================================
-- 2. RPC: request_join_building (Secured & Enforced Limits)
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_join_building(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.request_join_building(
    p_full_name TEXT,
    p_phone TEXT,
    p_building_code TEXT,
    p_apartment_number TEXT,
    p_floor_number TEXT DEFAULT NULL,
    p_residency_type TEXT DEFAULT 'owner_resident'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_existing_user RECORD;
    v_building RECORD;
    v_plan_max_apts INTEGER;
    v_effective_max_apts INTEGER;
    v_current_apts_count INTEGER;
    v_apartment_id UUID;
    v_share_percent NUMERIC(5, 2);
BEGIN
    -- 1. Require Authenticated Session
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    -- Retrieve caller email safely without accessing private auth.users table directly
    v_caller_email := COALESCE(auth.jwt()->>'email', (SELECT email FROM public.users WHERE id = v_caller_id));

    -- 2. Verify caller is not already an active member of another building
    SELECT building_id, status, role INTO v_existing_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_existing_user.building_id IS NOT NULL AND v_existing_user.status = 'active' THEN
        RAISE EXCEPTION 'User is already an active member of an existing building.';
    END IF;

    -- 3. Find building by exact building_code or apartment invite_code (NO split_part hacks)
    SELECT * INTO v_building
    FROM public.buildings
    WHERE upper(trim(building_code)) = upper(trim(p_building_code));

    IF NOT FOUND THEN
        SELECT b.* INTO v_building
        FROM public.apartments a
        JOIN public.buildings b ON b.id = a.building_id
        WHERE upper(trim(a.invite_code)) = upper(trim(p_building_code))
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'كود المبنى غير صحيح، يرجى التأكد من الكود من رئيس الاتحاد.';
    END IF;

    -- 4. Check max apartments limit (building custom override vs plan tier)
    SELECT max_apartments INTO v_plan_max_apts
    FROM public.subscription_plans
    WHERE code = v_building.plan_code;

    v_effective_max_apts := COALESCE(v_building.max_apartments_override, v_plan_max_apts, 50);

    -- 5. Find or create apartment within plan limits
    SELECT id INTO v_apartment_id
    FROM public.apartments
    WHERE building_id = v_building.id
      AND trim(apartment_number) = trim(p_apartment_number);

    v_share_percent := ROUND((100.0 / GREATEST(v_building.total_apartments, 1))::numeric, 2);

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    IF v_apartment_id IS NULL THEN
        SELECT COUNT(*) INTO v_current_apts_count
        FROM public.apartments
        WHERE building_id = v_building.id AND is_active = true;

        IF v_current_apts_count >= v_effective_max_apts THEN
            RAISE EXCEPTION 'تم الوصول للحد الأقصى للشقق المسموح به في باقة هذه العمارة (%).', v_effective_max_apts;
        END IF;

        INSERT INTO public.apartments (
            building_id,
            apartment_number,
            floor_number,
            ownership_share_percent,
            invite_code,
            is_active
        ) VALUES (
            v_building.id,
            trim(p_apartment_number),
            p_floor_number,
            v_share_percent,
            v_building.building_code || '-' || trim(p_apartment_number),
            true
        )
        RETURNING id INTO v_apartment_id;
    END IF;

    -- 6. Upsert user profile strictly as resident with status = 'pending'
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
        floor_number,
        residency_type,
        ownership_share_percent
    ) VALUES (
        v_caller_id,
        trim(p_full_name),
        v_caller_email,
        trim(p_phone),
        'resident',
        'pending',
        v_building.id,
        v_apartment_id,
        trim(p_apartment_number),
        p_floor_number,
        COALESCE(p_residency_type, 'owner_resident'),
        v_share_percent
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        role = 'resident',
        status = 'pending',
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        apartment_number = EXCLUDED.apartment_number,
        floor_number = EXCLUDED.floor_number,
        residency_type = EXCLUDED.residency_type;

    -- 7. Notify building admin
    IF v_building.admin_id IS NOT NULL THEN
        INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category)
        VALUES (
            v_building.id,
            v_building.admin_id,
            'admin',
            'طلب انضمام ساكن جديد',
            format('طلب الساكن (%s) الانضمام لشقة رقم (%s) وهو بانتظار موافقتك.', trim(p_full_name), trim(p_apartment_number)),
            'general'
        );
    END IF;

    RETURN jsonb_build_object(
        'user_id', v_caller_id,
        'building_id', v_building.id,
        'building_name', v_building.name,
        'apartment_id', v_apartment_id,
        'apartment_number', trim(p_apartment_number),
        'status', 'pending'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_join_building(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_join_building(text, text, text, text, text, text) TO authenticated;

-- ============================================================================
-- 3. RPC: create_building_for_admin (Safe Caller Email & Role Promotion)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_building_for_admin(text, text, text, text, integer, numeric, text, text);

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
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    -- Retrieve caller email safely from JWT / public.users
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

    -- Fetch full Pro features from subscription_plans
    SELECT default_features_config INTO v_pro_features
    FROM public.subscription_plans
    WHERE code = 'pro';

    IF v_pro_features IS NULL THEN
        v_pro_features := '{
            "receipt_upload": true,
            "emergency_claims": true,
            "export_reports": true,
            "voting": true,
            "notifications": true,
            "documents_archive": true
        }'::jsonb;
    END IF;

    v_building_code := public.generate_unique_building_code();
    v_share_percent := ROUND((100.0 / p_total_apartments)::numeric, 2);

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 3. Create the building with a 60-day Pro trial
    INSERT INTO public.buildings (
        name,
        address,
        registration_number,
        building_code,
        fund_balance,
        default_monthly_dues,
        total_apartments,
        plan_code,
        subscription_status,
        trial_ends_at,
        subscription_ends_at,
        features_config,
        admin_id
    ) VALUES (
        trim(p_building_name),
        trim(p_address),
        p_registration_number,
        v_building_code,
        0.00,
        COALESCE(p_default_monthly_dues, 0.00),
        p_total_apartments,
        'pro',
        'trial',
        now() + INTERVAL '60 days',
        now() + INTERVAL '60 days',
        v_pro_features,
        v_caller_id
    )
    RETURNING id INTO v_building_id;

    -- 4. Create the admin's apartment unit
    INSERT INTO public.apartments (
        building_id,
        apartment_number,
        ownership_share_percent,
        occupant_name,
        occupant_phone,
        resident_id,
        invite_code,
        is_active
    ) VALUES (
        v_building_id,
        trim(p_admin_apartment_number),
        v_share_percent,
        trim(p_full_name),
        trim(p_phone),
        v_caller_id,
        v_building_code || '-' || trim(p_admin_apartment_number),
        true
    )
    RETURNING id INTO v_apartment_id;

    -- 5. Promote user to role = 'admin' and status = 'active'
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
        email = COALESCE(EXCLUDED.email, users.email),
        phone = EXCLUDED.phone,
        role = 'admin',
        status = 'active',
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        apartment_number = EXCLUDED.apartment_number,
        ownership_share_percent = EXCLUDED.ownership_share_percent;

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

-- ============================================================================
-- 4. RPC: reject_app_subscription_invoice (Super Admin only, FOR UPDATE)
-- ============================================================================
DROP FUNCTION IF EXISTS public.reject_app_subscription_invoice(uuid, text);

CREATE OR REPLACE FUNCTION public.reject_app_subscription_invoice(
    p_invoice_id UUID,
    p_rejection_reason TEXT DEFAULT 'بيانات التحويل غير مطابقة أو لم يصل المبلغ'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role public.user_role;
    v_invoice RECORD;
    v_reason TEXT;
BEGIN
    -- 1. Identify super_admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id AND status = 'active';

    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Security Violation: Only Super Admin can reject building subscriptions.';
    END IF;

    v_reason := trim(COALESCE(p_rejection_reason, ''));
    IF v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    -- 2. Lock the target invoice FOR UPDATE
    SELECT * INTO v_invoice
    FROM public.app_subscription_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'فاتورة الاشتراك غير موجودة.';
    END IF;

    IF v_invoice.status = 'rejected' THEN
        RETURN jsonb_build_object('invoice_id', p_invoice_id, 'status', 'rejected', 'message', 'Already rejected');
    END IF;

    IF v_invoice.status <> 'pending' THEN
        RAISE EXCEPTION 'منع التكرار المزدوج: حالة الفاتورة الحالية (%).', v_invoice.status;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 3. Mark invoice as rejected
    UPDATE public.app_subscription_invoices
    SET status = 'rejected',
        notes = COALESCE(notes, '') || ' [سبب الرفض: ' || v_reason || ']'
    WHERE id = p_invoice_id;

    -- 4. Send official notification to building admin
    INSERT INTO public.notifications (
        building_id,
        recipient_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    ) VALUES (
        v_invoice.building_id,
        v_invoice.submitted_by,
        'admin',
        'تعذر اعتماد تجديد باقة العمارة ⚠️',
        format('تم رفض طلب تجديد الباقة بمبلغ %s ج.م. سبب الرفض: "%s". يرجى إعادة المحاولة من صفحة باقة واشتراك التطبيق.',
            v_invoice.amount, v_reason),
        'subscription',
        jsonb_build_object('invoice_id', p_invoice_id, 'reason', v_reason)
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'status', 'rejected',
        'rejection_reason', v_reason
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_app_subscription_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_app_subscription_invoice(uuid, text) TO authenticated;

-- ============================================================================
-- 5. RPC: submit_app_subscription_invoice (Secured Building & Receipt Check)
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_app_subscription_invoice(public.plan_tier, integer, text, text);

CREATE OR REPLACE FUNCTION public.submit_app_subscription_invoice(
    p_plan_code public.plan_tier,
    p_duration_months INTEGER DEFAULT 1,
    p_receipt_image_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_building RECORD;
    v_plan RECORD;
    v_monthly_price NUMERIC(12, 2);
    v_total_amount NUMERIC(12, 2);
    v_invoice_id UUID;
    v_receipt TEXT;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only an active building admin can submit subscription invoices.';
    END IF;

    IF v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Admin is not assigned to a building.';
    END IF;

    v_receipt := trim(COALESCE(p_receipt_image_url, ''));
    IF v_receipt = '' THEN
        RAISE EXCEPTION 'صورة إيصال التحويل مطلوبة لتقديم طلب التجديد.';
    END IF;

    -- 2. Lock building row FOR UPDATE
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_admin.building_id
    FOR UPDATE;

    -- 3. Prevent duplicate pending invoices
    IF EXISTS (
        SELECT 1 FROM public.app_subscription_invoices
        WHERE building_id = v_admin.building_id AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'يوجد طلب تجديد اشتراك قيد المراجعة بالفعل لهذه العمارة. يرجى انتظار رد الإدارة العليا.';
    END IF;

    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription plan not found.';
    END IF;

    v_monthly_price := COALESCE(v_building.custom_monthly_price, v_plan.default_monthly_price);
    v_total_amount := v_monthly_price * GREATEST(COALESCE(p_duration_months, 1), 1);

    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'لا يمكن رفع إيصال سداد لباقة بقيمة صفر.';
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 4. Insert subscription invoice
    INSERT INTO public.app_subscription_invoices (
        building_id,
        submitted_by,
        plan_code,
        amount,
        duration_months,
        receipt_image_url,
        notes,
        status
    ) VALUES (
        v_building.id,
        v_caller_id,
        p_plan_code,
        v_total_amount,
        GREATEST(COALESCE(p_duration_months, 1), 1),
        v_receipt,
        p_notes,
        'pending'
    )
    RETURNING id INTO v_invoice_id;

    RETURN jsonb_build_object(
        'invoice_id', v_invoice_id,
        'building_id', v_building.id,
        'plan_code', p_plan_code,
        'amount', v_total_amount,
        'status', 'pending'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_app_subscription_invoice(public.plan_tier, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_app_subscription_invoice(public.plan_tier, integer, text, text) TO authenticated;

-- ============================================================================
-- 6. RPC: send_bulk_unpaid_reminder (Enforce Feature Flag & Unpaid Targeting)
-- ============================================================================
DROP FUNCTION IF EXISTS public.send_bulk_unpaid_reminder(text, text);

CREATE OR REPLACE FUNCTION public.send_bulk_unpaid_reminder(
    p_billing_month TEXT,
    p_custom_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_building RECORD;
    v_unpaid_rec RECORD;
    v_title TEXT;
    v_body TEXT;
    v_reminded_count INTEGER := 0;
    v_push_targets JSONB := '[]'::jsonb;
    v_reminded_apartments JSONB := '[]'::jsonb;
    v_month TEXT;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' OR v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Only the active building admin can send bulk payment reminders.';
    END IF;

    -- 2. Check building writability
    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_admin.building_id;

    -- 3. Check notifications feature flag
    IF COALESCE((v_building.features_config->>'notifications')::boolean, true) = false THEN
        RAISE EXCEPTION 'ميزة التنبيهات والإشعارات غير مفعلة في باقة العمارة الحالية.';
    END IF;

    v_month := trim(COALESCE(p_billing_month, ''));
    IF NOT (v_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') THEN
        RAISE EXCEPTION 'صيغة الشهر غير صالحة. يجب أن تكون بصيغة YYYY-MM (مثال: 2026-05).';
    END IF;

    v_title := format('تذكير بسداد اشتراك شهر %s 🔔', v_month);

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 4. Target ONLY units that have NOT paid or submitted pending payment for target month
    FOR v_unpaid_rec IN
        SELECT
            a.id AS apartment_id,
            a.apartment_number,
            u.id AS resident_id,
            u.full_name,
            u.push_token
        FROM public.apartments a
        LEFT JOIN public.users u
            ON (u.id = a.resident_id OR (u.building_id = a.building_id AND trim(u.apartment_number) = trim(a.apartment_number)))
            AND u.status = 'active'
        WHERE a.building_id = v_admin.building_id
          AND a.is_active = true
          AND NOT EXISTS (
              SELECT 1
              FROM public.payments p
              WHERE p.building_id = v_admin.building_id
                AND p.apartment_id = a.id
                AND p.payment_category = 'monthly_dues'
                AND trim(p.billing_month) = v_month
                AND p.status IN ('paid', 'pending')
          )
        ORDER BY a.apartment_number
    LOOP
        v_body := COALESCE(
            NULLIF(trim(p_custom_message), ''),
            format(
                'مرحباً %s (شقة %s)، نود تذكيركم بسداد اشتراك الصيانة الشهري عن (%s) بقيمة %s ج.م لضمان انتظام خدمات العمارة.',
                COALESCE(v_unpaid_rec.full_name, 'ساكن الوحدة'),
                v_unpaid_rec.apartment_number,
                v_month,
                v_building.default_monthly_dues
            )
        );

        INSERT INTO public.notifications (
            building_id,
            recipient_id,
            title,
            body,
            category,
            metadata
        ) VALUES (
            v_admin.building_id,
            v_unpaid_rec.resident_id,
            v_title,
            v_body,
            'financial',
            jsonb_build_object(
                'apartment_number', v_unpaid_rec.apartment_number,
                'billing_month', v_month,
                'amount', v_building.default_monthly_dues
            )
        );

        v_reminded_count := v_reminded_count + 1;
        v_reminded_apartments := v_reminded_apartments || to_jsonb(v_unpaid_rec.apartment_number);

        IF v_unpaid_rec.push_token IS NOT NULL AND trim(v_unpaid_rec.push_token) <> '' THEN
            v_push_targets := v_push_targets || jsonb_build_object(
                'resident_id', v_unpaid_rec.resident_id,
                'apartment_number', v_unpaid_rec.apartment_number,
                'push_token', v_unpaid_rec.push_token,
                'title', v_title,
                'body', v_body
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'building_id', v_admin.building_id,
        'billing_month', v_month,
        'reminded_count', v_reminded_count,
        'reminded_apartments', v_reminded_apartments,
        'push_targets', v_push_targets
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_bulk_unpaid_reminder(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_bulk_unpaid_reminder(text, text) TO authenticated;
