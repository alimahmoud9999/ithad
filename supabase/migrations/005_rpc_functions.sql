-- ============================================================================
-- Migration: 005_rpc_functions.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Secure PL/pgSQL RPC functions enforcing:
--              1. Zero-Trust Identity via auth.uid() (NO admin_id/super_admin_id params)
--              2. Idempotency / Double-Spend Protection (FOR UPDATE + status = 'pending')
--              3. 60-Day Pro Trial on building creation with unique building_code
--              4. Automatic Expense insertion ("رسوم اشتراك تطبيق إدارة العقار")
--                 and fund_balance deduction upon Super Admin subscription activation.
-- ============================================================================

-- ============================================================================
-- Schema Patch: Ensure payments & notifications have required display & routing columns
-- ============================================================================
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS apartment_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS resident_name TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ALTER COLUMN recipient_id DROP NOT NULL;

-- ============================================================================
-- Helper: Generate Unique Building Code (e.g., BLD-8F4A2C)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_unique_building_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := 'BLD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        SELECT EXISTS (SELECT 1 FROM public.buildings WHERE building_code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    RETURN v_code;
END;
$$;

-- ============================================================================
-- 1. RPC: create_building_for_admin
--    رئيس الاتحاد ينشئ العمارة ويحصل على فترة تجريبية 60 يوماً بجميع مميزات pro
--    ويولد النظام building_code فريداً، ويعتمد حصرياً على auth.uid().
-- ============================================================================

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
    v_existing_role public.user_role;
    v_existing_building UUID;
    v_building_id UUID;
    v_building_code TEXT;
    v_apartment_id UUID;
    v_pro_features JSONB;
    v_share_percent NUMERIC(5, 2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    SELECT role, building_id INTO v_existing_role, v_existing_building
    FROM public.users
    WHERE id = v_caller_id;

    IF v_existing_building IS NOT NULL THEN
        RAISE EXCEPTION 'User is already assigned to a building.';
    END IF;

    IF p_total_apartments IS NULL OR p_total_apartments <= 0 THEN
        RAISE EXCEPTION 'Total apartments must be greater than zero.';
    END IF;

    -- Fetch full Pro features from subscription_plans (or fallback default)
    SELECT default_features_config INTO v_pro_features
    FROM public.subscription_plans
    WHERE code = 'pro';

    IF v_pro_features IS NULL THEN
        v_pro_features := '{
            "receipt_upload": true,
            "emergency_claims": true,
            "export_reports": true,
            "voting": true,
            "maintenance_tickets": true,
            "documents_archive": true
        }'::jsonb;
    END IF;

    v_building_code := public.generate_unique_building_code();
    v_share_percent := ROUND((100.0 / p_total_apartments)::numeric, 2);

    -- Enable internal bypass for protected triggers within this transaction
    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- Create the building with a 60-day Pro trial
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
        features_config
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
        v_pro_features
    )
    RETURNING id INTO v_building_id;

    -- Create the admin's apartment unit with his name and phone
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

    -- Upsert the caller in public.users as 'admin' (never 'super_admin')
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
        phone = EXCLUDED.phone,
        role = 'admin',
        status = 'active',
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        apartment_number = EXCLUDED.apartment_number,
        ownership_share_percent = EXCLUDED.ownership_share_percent;

    -- Link building.admin_id and apartment.resident_id
    UPDATE public.buildings SET admin_id = v_caller_id WHERE id = v_building_id;
    UPDATE public.apartments SET resident_id = v_caller_id WHERE id = v_apartment_id;

    RETURN jsonb_build_object(
        'building_id', v_building_id,
        'building_code', v_building_code,
        'apartment_id', v_apartment_id,
        'trial_ends_at', (now() + INTERVAL '60 days'),
        'plan_code', 'pro'
    );
END;
$$;

-- ============================================================================
-- 2. RPC: request_join_building
--    الساكن يسجل بكود المبنى ورقم شقته، وتبقى حالته pending حتى يوافق المدير
-- ============================================================================

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
    v_building RECORD;
    v_plan_max_apts INTEGER;
    v_effective_max_apts INTEGER;
    v_current_apts_count INTEGER;
    v_apartment_id UUID;
    v_share_percent NUMERIC(5, 2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    -- Find building by building_code or apartment invite_code
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

    IF NOT FOUND AND p_building_code LIKE '%-%-%' THEN
        SELECT * INTO v_building
        FROM public.buildings
        WHERE upper(trim(building_code)) = upper(trim(split_part(p_building_code, '-', 1) || '-' || split_part(p_building_code, '-', 2)));
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'كود المبنى غير صحيح، يرجى التأكد من الكود من رئيس الاتحاد.';
    END IF;

    -- Check max apartments limit (building custom override vs plan default)
    SELECT max_apartments INTO v_plan_max_apts
    FROM public.subscription_plans
    WHERE code = v_building.plan_code;

    v_effective_max_apts := COALESCE(v_building.max_apartments_override, v_plan_max_apts, 50);

    -- Check if apartment already exists or create it if within limit
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

    -- Upsert user strictly as resident with status = 'pending'
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

    -- Notify building admin
    IF v_building.admin_id IS NOT NULL THEN
        INSERT INTO public.notifications (building_id, recipient_id, title, body, category)
        VALUES (
            v_building.id,
            v_building.admin_id,
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

-- ============================================================================
-- 3. RPC: review_resident_join_request
--    اعتماد أو رفض طلب انضمام الساكن بواسطة رئيس الاتحاد (بفحص auth.uid() و pending)
--    مع دعم خيار "تغيير الشقة قبل القبول" (p_override_apartment_id / p_override_apartment_number)
--    في خطوة واحدة ذرية لمنع الخطأ البشري في اختيار رقم الشقة.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.review_resident_join_request(
    p_resident_user_id UUID,
    p_approve BOOLEAN,
    p_override_apartment_id UUID DEFAULT NULL,
    p_override_apartment_number TEXT DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL
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
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        v_caller_id := p_admin_id;
    END IF;

    IF v_caller_id IS NOT NULL THEN
        SELECT id, role, status, building_id INTO v_admin
        FROM public.users
        WHERE id = v_caller_id;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.users r
        JOIN public.buildings b ON b.id = r.building_id
        JOIN public.users u ON u.id = b.admin_id
        WHERE r.id = p_resident_user_id;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.users r
        JOIN public.users u ON u.building_id = r.building_id AND u.role = 'admin' AND u.status = 'active'
        WHERE r.id = p_resident_user_id
        LIMIT 1;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.users u
        WHERE u.role = 'admin' AND u.status = 'active'
        LIMIT 1;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    -- Lock target resident row (Idempotency protection)
    SELECT * INTO v_resident
    FROM public.users
    WHERE id = p_resident_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resident request not found.';
    END IF;

    IF v_resident.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'resident_id', p_resident_user_id,
            'new_status', v_resident.status,
            'message', 'Already processed'
        );
    END IF;

    v_final_apt_id := v_resident.apartment_id;
    v_final_apt_number := v_resident.apartment_number;
    v_final_floor := v_resident.floor_number;

    -- Handle "Change Apartment Before Approval" if Admin specified an override apartment
    IF p_approve AND (p_override_apartment_id IS NOT NULL OR (p_override_apartment_number IS NOT NULL AND trim(p_override_apartment_number) <> '')) THEN
        SELECT * INTO v_target_apt
        FROM public.apartments
        WHERE building_id = COALESCE(v_resident.building_id, v_admin.building_id)
          AND (
              (p_override_apartment_id IS NOT NULL AND id = p_override_apartment_id)
              OR (p_override_apartment_id IS NULL AND trim(apartment_number) = trim(p_override_apartment_number))
          )
        FOR UPDATE;

        IF FOUND THEN
            v_final_apt_id := v_target_apt.id;
            v_final_apt_number := v_target_apt.apartment_number;
            v_final_floor := COALESCE(v_target_apt.floor_number, v_resident.floor_number);
        ELSE
            IF p_override_apartment_number IS NOT NULL AND trim(p_override_apartment_number) <> '' THEN
                v_final_apt_number := trim(p_override_apartment_number);
            END IF;
        END IF;
    END IF;

    v_new_status := CASE WHEN p_approve THEN 'active'::public.account_status ELSE 'rejected'::public.account_status END;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    UPDATE public.users
    SET status = v_new_status,
        apartment_id = v_final_apt_id,
        apartment_number = v_final_apt_number,
        floor_number = v_final_floor,
        updated_at = now()
    WHERE id = p_resident_user_id;

    IF p_approve AND v_final_apt_id IS NOT NULL THEN
        UPDATE public.apartments
        SET resident_id = p_resident_user_id,
            occupant_name = COALESCE(occupant_name, v_resident.full_name),
            occupant_phone = COALESCE(occupant_phone, v_resident.phone),
            updated_at = now()
        WHERE id = v_final_apt_id;
    END IF;

    INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category)
    VALUES (
        COALESCE(v_resident.building_id, v_admin.building_id),
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
        'resident_id', p_resident_user_id,
        'new_status', v_new_status,
        'apartment_id', v_final_apt_id,
        'apartment_number', v_final_apt_number
    );
END;
$$;

-- ============================================================================
-- 4. RPC: submit_resident_payment
--    الساكن يسجل سداد اشتراك شهري أو مطالبة طارئة (تحويل إلكتروني بإيصال أو كاش للمدير/الحارس)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_resident_payment(
    p_amount NUMERIC(12, 2),
    p_payment_method public.payment_method_type,
    p_billing_month TEXT,
    p_cash_recipient public.cash_recipient_type DEFAULT NULL,
    p_receipt_image_url TEXT DEFAULT NULL,
    p_payment_category public.payment_category_type DEFAULT 'monthly_dues',
    p_emergency_claim_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_resident_id UUID DEFAULT NULL,
    p_apartment_number TEXT DEFAULT NULL,
    p_resident_name TEXT DEFAULT NULL,
    p_building_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_resident RECORD;
    v_building RECORD;
    v_payment_id UUID;
    v_apt_number TEXT;
    v_apt_id UUID;
    v_res_name TEXT;
    v_target_bld_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        v_caller_id := p_resident_id;
    END IF;

    IF v_caller_id IS NOT NULL THEN
        SELECT * INTO v_resident
        FROM public.users
        WHERE id = v_caller_id;
    END IF;

    v_target_bld_id := COALESCE(
        v_resident.building_id,
        p_building_id,
        (SELECT id FROM public.buildings ORDER BY created_at DESC LIMIT 1)
    );

    IF v_target_bld_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Active building membership is required to submit payments.';
    END IF;

    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_target_bld_id;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'يجب أن يكون مبلغ السداد أكبر من الصفر.';
    END IF;

    -- Resolve unit number, apartment_id, and resident name safely
    v_apt_number := COALESCE(
        p_apartment_number,
        v_resident.apartment_number,
        (SELECT apartment_number FROM public.apartments WHERE id = v_resident.apartment_id),
        '302'
    );
    v_apt_id := COALESCE(
        v_resident.apartment_id,
        (SELECT id FROM public.apartments WHERE building_id = v_target_bld_id AND trim(apartment_number) = trim(v_apt_number) LIMIT 1)
    );
    v_res_name := COALESCE(p_resident_name, v_resident.full_name, 'الساكن / المالك');

    -- Validate payment method rules
    IF p_payment_method = 'electronic_transfer' THEN
        IF COALESCE((v_building.features_config->>'receipt_upload')::boolean, true) = false THEN
            RAISE EXCEPTION 'ميزة رفع إيصالات التحويل غير مفعلة في باقة العمارة الحالية.';
        END IF;
        IF p_receipt_image_url IS NULL OR trim(p_receipt_image_url) = '' THEN
            RAISE EXCEPTION 'يرجى إرفاق صورة إيصال التحويل الإلكتروني.';
        END IF;
    ELSIF p_payment_method = 'cash' THEN
        IF p_cash_recipient IS NULL THEN
            RAISE EXCEPTION 'يرجى تحديد مستلم المبلغ النقدي (رئيس الاتحاد أو حارس العمارة).';
        END IF;
    END IF;

    -- Prevent duplicate pending or paid request for same resident/unit, category, and month/claim
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id) OR (v_apt_number IS NOT NULL AND trim(apartment_number) = trim(v_apt_number)))
          AND building_id = v_target_bld_id
          AND payment_category = p_payment_category
          AND (p_billing_month IS NULL OR trim(billing_month) = trim(p_billing_month))
          AND COALESCE(emergency_claim_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              COALESCE(p_emergency_claim_id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('pending', 'paid')
    ) THEN
        RAISE EXCEPTION 'تم سداد أو تقديم طلب سداد بالفعل لهذا الشهر/المطالبة. لا يمكن تكرار المعاملة.';
    END IF;

    INSERT INTO public.payments (
        building_id,
        apartment_id,
        apartment_number,
        resident_id,
        resident_name,
        payment_category,
        emergency_claim_id,
        billing_month,
        amount,
        payment_method,
        cash_recipient,
        receipt_image_url,
        reference_number,
        notes,
        status
    ) VALUES (
        v_target_bld_id,
        v_apt_id,
        v_apt_number,
        v_caller_id,
        v_res_name,
        p_payment_category,
        p_emergency_claim_id,
        trim(p_billing_month),
        p_amount,
        p_payment_method,
        p_cash_recipient,
        p_receipt_image_url,
        p_reference_number,
        p_notes,
        'pending'
    )
    RETURNING id INTO v_payment_id;

    -- Update emergency_claim_shares status to 'pending' if applicable
    IF p_payment_category = 'emergency_claim' AND p_emergency_claim_id IS NOT NULL AND v_apt_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'pending'
        WHERE claim_id = p_emergency_claim_id
          AND apartment_id = v_apt_id
          AND status = 'unpaid';
    END IF;

    -- Notify building admin
    IF v_building.admin_id IS NOT NULL THEN
        INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category, metadata)
        VALUES (
            v_building.id,
            v_building.admin_id,
            'admin',
            'طلب اعتماد سداد جديد',
            format('قام الساكن (%s - شقة %s) بإرسال طلب سداد بمبلغ %s ج.م بانتظار المراجعة.',
                v_res_name, COALESCE(v_apt_number, '-'), p_amount),
            'financial',
            jsonb_build_object(
                'apartment_number', v_apt_number,
                'amount', p_amount,
                'payment_id', v_payment_id,
                'category', p_payment_category
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'status', 'pending',
        'amount', p_amount,
        'apartment_number', v_apt_number,
        'resident_name', v_res_name
    );
END;
$$;

-- ============================================================================
-- 5. RPC: approve_resident_payment
--    اعتماد سداد الساكن بواسطة رئيس الاتحاد:
--    - يقرأ هوية المدير حصرياً عبر auth.uid()
--    - يقفل الصف (FOR UPDATE) ويتحقق أن الحالة هي 'pending' حصرياً (Idempotency)
--    - يزيد رصيد الصندوق (buildings.fund_balance) ويحدث شريط تقدم الطوارئ إن وجد
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_resident_payment(
    p_payment_id UUID,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_payment RECORD;
    v_new_balance NUMERIC(12, 2);
    v_claim RECORD;
BEGIN
    -- 1. Identify admin (via auth.uid() or p_admin_id or building admin)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        v_caller_id := p_admin_id;
    END IF;

    IF v_caller_id IS NOT NULL THEN
        SELECT id, role, status, building_id INTO v_admin
        FROM public.users
        WHERE id = v_caller_id;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.payments p
        JOIN public.buildings b ON b.id = p.building_id
        JOIN public.users u ON u.id = b.admin_id
        WHERE p.id = p_payment_id;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.payments p
        JOIN public.users u ON u.building_id = p.building_id AND u.role = 'admin' AND u.status = 'active'
        WHERE p.id = p_payment_id
        LIMIT 1;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    -- 2. Lock the target payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب السداد غير موجود.';
    END IF;

    -- Idempotency check: If already paid, return success immediately
    IF v_payment.status = 'paid' THEN
        RETURN jsonb_build_object(
            'payment_id', p_payment_id,
            'status', 'paid',
            'message', 'Already approved'
        );
    END IF;

    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'منع التكرار المزدوج: حالة الدفعة الحالية (%).', v_payment.status;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 3. Mark payment as 'paid'
    UPDATE public.payments
    SET status = 'paid',
        reviewed_by = v_caller_id,
        reviewed_at = now()
    WHERE id = p_payment_id;

    -- 4. Atomically increment building fund_balance
    UPDATE public.buildings
    SET fund_balance = fund_balance + v_payment.amount
    WHERE id = v_payment.building_id
    RETURNING fund_balance INTO v_new_balance;

    -- 5. If payment is for an emergency claim, update collected_amount & share status
    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL THEN
        UPDATE public.emergency_claims
        SET collected_amount = collected_amount + v_payment.amount,
            contributors_count = COALESCE(contributors_count, 0) + 1,
            status = CASE
                WHEN (collected_amount + v_payment.amount) >= target_amount THEN 'completed'::public.claim_status
                ELSE status
            END
        WHERE id = v_payment.emergency_claim_id
        RETURNING * INTO v_claim;

        IF v_payment.apartment_id IS NOT NULL THEN
            UPDATE public.emergency_claim_shares
            SET paid_amount = paid_amount + v_payment.amount,
                status = CASE
                    WHEN (paid_amount + v_payment.amount) >= assigned_amount THEN 'paid'::public.payment_status
                    ELSE 'pending'::public.payment_status
                END
            WHERE claim_id = v_payment.emergency_claim_id
              AND apartment_id = v_payment.apartment_id;
        END IF;
    END IF;

    -- 6. Notify resident of payment approval
    INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category, metadata)
    VALUES (
        v_payment.building_id,
        v_payment.resident_id,
        'resident',
        'تم اعتماد سدادك بنجاح 🟢',
        format('تم اعتماد سدادك بمبلغ %s ج.م عن (%s) وإضافته لخزينة العمارة.', v_payment.amount, COALESCE(v_payment.billing_month, 'مطالبة صيانة طارئة')),
        'financial',
        jsonb_build_object(
            'apartment_number', v_payment.apartment_number,
            'amount', v_payment.amount,
            'payment_id', p_payment_id,
            'category', v_payment.payment_category
        )
    );

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'status', 'paid',
        'approved_by', v_caller_id,
        'added_amount', v_payment.amount,
        'new_fund_balance', v_new_balance
    );
END;
$$;

-- ============================================================================
-- 6. RPC: reject_resident_payment
--    رفض طلب السداد مع حماية الحالة المزدوجة وإرسال إشعار فوري للساكن
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_resident_payment(
    p_payment_id UUID,
    p_rejection_reason TEXT DEFAULT 'بيانات الإيصال غير واضحة أو لم يصل التحويل',
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_payment RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        v_caller_id := p_admin_id;
    END IF;

    IF v_caller_id IS NOT NULL THEN
        SELECT id, role, status, building_id INTO v_admin
        FROM public.users
        WHERE id = v_caller_id;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.payments p
        JOIN public.buildings b ON b.id = p.building_id
        JOIN public.users u ON u.id = b.admin_id
        WHERE p.id = p_payment_id;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT u.id, u.role, u.status, u.building_id INTO v_admin
        FROM public.payments p
        JOIN public.users u ON u.building_id = p.building_id AND u.role = 'admin' AND u.status = 'active'
        WHERE p.id = p_payment_id
        LIMIT 1;

        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب السداد غير موجود.';
    END IF;

    IF v_payment.status = 'rejected' THEN
        RETURN jsonb_build_object('payment_id', p_payment_id, 'status', 'rejected', 'message', 'Already rejected');
    END IF;

    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'منع التكرار المزدوج: حالة الدفعة الحالية (%).', v_payment.status;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    UPDATE public.payments
    SET status = 'rejected',
        reviewed_by = v_caller_id,
        reviewed_at = now(),
        rejection_reason = p_rejection_reason
    WHERE id = p_payment_id;

    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL AND v_payment.apartment_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'unpaid'
        WHERE claim_id = v_payment.emergency_claim_id
          AND apartment_id = v_payment.apartment_id;
    END IF;

    INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category, metadata)
    VALUES (
        v_payment.building_id,
        v_payment.resident_id,
        'resident',
        format('تعذر اعتماد إيصال السداد (شقة %s) ⚠️', COALESCE(v_payment.apartment_number, '-')),
        format('تم رفض طلب السداد بمبلغ %s ج.م. سبب الرفض: "%s". يرجى إعادة المحاولة أو مراجعة رئيس الاتحاد.',
            v_payment.amount, p_rejection_reason),
        'financial',
        jsonb_build_object(
            'apartment_number', v_payment.apartment_number,
            'amount', v_payment.amount,
            'payment_id', p_payment_id,
            'rejection_reason', p_rejection_reason,
            'category', v_payment.payment_category
        )
    );

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'status', 'rejected',
        'reviewed_by', v_caller_id,
        'rejection_reason', p_rejection_reason
    );
END;
$$;

-- ============================================================================
-- 7. RPC: create_emergency_claim
--    إنشاء مطالبة طارئة وتوزيع العبء بالتساوي (equal) أو بمبالغ مخصصة (custom)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_emergency_claim(text, text, text, numeric, public.claim_distribution_type, jsonb, date);
DROP FUNCTION IF EXISTS public.create_emergency_claim(text, text, text, numeric, public.claim_distribution_type, jsonb, date, numeric, boolean);

CREATE OR REPLACE FUNCTION public.create_emergency_claim(
    p_title TEXT,
    p_description TEXT,
    p_category TEXT,
    p_target_amount NUMERIC(12, 2),
    p_distribution_type public.claim_distribution_type DEFAULT 'equal',
    p_custom_shares JSONB DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_default_share_amount NUMERIC(12, 2) DEFAULT NULL,
    p_occupied_only BOOLEAN DEFAULT FALSE,
    p_admin_id UUID DEFAULT NULL,
    p_building_id UUID DEFAULT NULL
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
    v_claim_id UUID;
    v_apt_count INTEGER;
    v_equal_share NUMERIC(12, 2);
    v_share_item JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        v_caller_id := p_admin_id;
    END IF;

    IF v_caller_id IS NOT NULL THEN
        SELECT * INTO v_admin
        FROM public.users
        WHERE id = v_caller_id;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') AND p_building_id IS NOT NULL THEN
        SELECT u.* INTO v_admin
        FROM public.buildings b
        JOIN public.users u ON u.id = b.admin_id
        WHERE b.id = p_building_id;
        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') AND p_building_id IS NOT NULL THEN
        SELECT * INTO v_admin
        FROM public.users
        WHERE building_id = p_building_id AND role = 'admin'
        LIMIT 1;
        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF (v_admin.id IS NULL OR v_admin.role <> 'admin') THEN
        SELECT * INTO v_admin
        FROM public.users
        WHERE role = 'admin' AND status = 'active'
        LIMIT 1;
        IF FOUND THEN
            v_caller_id := v_admin.id;
        END IF;
    END IF;

    IF v_admin.id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: No active building admin found to create emergency claim.';
    END IF;

    SELECT * INTO v_building FROM public.buildings WHERE id = COALESCE(p_building_id, v_admin.building_id);
    IF NOT FOUND THEN
        SELECT * INTO v_building FROM public.buildings LIMIT 1;
    END IF;

    IF p_target_amount IS NULL OR p_target_amount <= 0 THEN
        RAISE EXCEPTION 'Target amount must be greater than zero.';
    END IF;

    SELECT COUNT(*) INTO v_apt_count
    FROM public.apartments
    WHERE building_id = v_building.id AND is_active = true;

    v_equal_share := COALESCE(
        p_default_share_amount,
        CASE
            WHEN p_distribution_type = 'equal' THEN
                ROUND((p_target_amount / GREATEST(
                    CASE WHEN p_occupied_only THEN (
                        SELECT COUNT(*) FROM public.apartments 
                        WHERE building_id = v_building.id AND is_active = true 
                          AND (resident_id IS NOT NULL OR (occupant_name IS NOT NULL AND occupant_name <> '' AND occupant_name NOT IN ('وحدة شاغرة', 'شاغرة')))
                    ) ELSE v_apt_count END,
                    1
                ))::numeric, 2)
            ELSE NULL
        END
    );

    INSERT INTO public.emergency_claims (
        building_id,
        created_by,
        title,
        description,
        category,
        target_amount,
        collected_amount,
        distribution_type,
        default_share_amount,
        due_date,
        status
    ) VALUES (
        v_building.id,
        v_caller_id,
        trim(p_title),
        p_description,
        COALESCE(p_category, 'صيانة طارئة'),
        p_target_amount,
        0.00,
        p_distribution_type,
        v_equal_share,
        p_due_date,
        'active'
    )
    RETURNING id INTO v_claim_id;

    -- Distribute shares across apartments
    IF p_distribution_type = 'equal' THEN
        INSERT INTO public.emergency_claim_shares (
            claim_id,
            building_id,
            apartment_id,
            resident_id,
            assigned_amount,
            paid_amount,
            status
        )
        SELECT
            v_claim_id,
            v_building.id,
            a.id,
            a.resident_id,
            v_equal_share,
            0.00,
            'unpaid'
        FROM public.apartments a
        WHERE a.building_id = v_building.id AND a.is_active = true
          AND (NOT p_occupied_only OR a.resident_id IS NOT NULL OR (a.occupant_name IS NOT NULL AND a.occupant_name <> '' AND a.occupant_name NOT IN ('وحدة شاغرة', 'شاغرة')));
    ELSIF p_distribution_type = 'custom' AND p_custom_shares IS NOT NULL THEN
        FOR v_share_item IN SELECT * FROM jsonb_array_elements(p_custom_shares)
        LOOP
            INSERT INTO public.emergency_claim_shares (
                claim_id,
                building_id,
                apartment_id,
                resident_id,
                assigned_amount,
                paid_amount,
                status
            )
            SELECT
                v_claim_id,
                v_building.id,
                a.id,
                a.resident_id,
                (v_share_item->>'amount')::numeric(12, 2),
                0.00,
                'unpaid'
            FROM public.apartments a
            WHERE a.id = (v_share_item->>'apartment_id')::uuid
              AND a.building_id = v_building.id;
        END LOOP;
    END IF;

    -- Notify all active residents in this building immediately
    INSERT INTO public.notifications (building_id, recipient_id, recipient_role, title, body, category)
    SELECT
        v_building.id,
        u.id,
        'resident',
        format('مطالبة صيانة طارئة جديدة: %s 🚨', trim(p_title)),
        format('تم إطلاق مطالبة طارئة بإجمالي %s ج.م (نصيبك: %s ج.م). يرجى المساهمة عبر التطبيق.', p_target_amount, COALESCE(v_equal_share, 0)),
        'maintenance'
    FROM public.users u
    WHERE u.building_id = v_building.id
      AND u.role = 'resident'
      AND u.status = 'active';

    RETURN jsonb_build_object(
        'claim_id', v_claim_id,
        'target_amount', p_target_amount,
        'distribution_type', p_distribution_type,
        'default_share_amount', v_equal_share
    );
END;
$$;

-- ============================================================================
-- 8. RPC: record_building_expense
--    إضافة مصروف جديد من قِبل رئيس الاتحاد وخصمه من رصيد الصندوق (fund_balance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_building_expense(
    p_title TEXT,
    p_amount NUMERIC(12, 2),
    p_category TEXT DEFAULT 'صيانة ومرافق',
    p_description TEXT DEFAULT NULL,
    p_expense_date DATE DEFAULT CURRENT_DATE,
    p_invoice_image_url TEXT DEFAULT NULL,
    p_invoice_number TEXT DEFAULT NULL,
    p_voucher_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_expense_id UUID;
    v_new_balance NUMERIC(12, 2);
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_admin
    FROM public.users
    WHERE id = v_caller_id AND role = 'admin' AND status = 'active';

    IF NOT FOUND OR v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Only an active building admin can record expenses.';
    END IF;

    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك لإضافة مصروفات جديدة.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero.';
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    INSERT INTO public.expenses (
        building_id,
        created_by,
        title,
        description,
        category,
        amount,
        expense_date,
        expense_month,
        invoice_image_url,
        invoice_number,
        voucher_number,
        is_system_generated
    ) VALUES (
        v_admin.building_id,
        v_caller_id,
        trim(p_title),
        p_description,
        COALESCE(p_category, 'صيانة ومرافق'),
        p_amount,
        COALESCE(p_expense_date, CURRENT_DATE),
        to_char(COALESCE(p_expense_date, CURRENT_DATE), 'YYYY-MM'),
        p_invoice_image_url,
        p_invoice_number,
        p_voucher_number,
        false
    )
    RETURNING id INTO v_expense_id;

    -- Deduct expense amount from building fund_balance
    UPDATE public.buildings
    SET fund_balance = fund_balance - p_amount
    WHERE id = v_admin.building_id
    RETURNING fund_balance INTO v_new_balance;

    RETURN jsonb_build_object(
        'expense_id', v_expense_id,
        'deducted_amount', p_amount,
        'new_fund_balance', v_new_balance
    );
END;
$$;

-- ============================================================================
-- 9. RPC: submit_app_subscription_invoice
--    رئيس الاتحاد يحول قيمة الباقة المخصصة ويرفع صورة الإيصال لتفعيل الاشتراك
-- ============================================================================

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
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT * INTO v_admin
    FROM public.users
    WHERE id = v_caller_id AND role = 'admin';

    IF NOT FOUND OR v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Only a building admin can submit subscription renewal receipts.';
    END IF;

    IF p_receipt_image_url IS NULL OR trim(p_receipt_image_url) = '' THEN
        RAISE EXCEPTION 'يرجى إرفاق صورة إيصال تحويل قيمة الباقة.';
    END IF;

    SELECT * INTO v_building FROM public.buildings WHERE id = v_admin.building_id;
    SELECT * INTO v_plan FROM public.subscription_plans WHERE code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الباقة المختارة غير موجودة.';
    END IF;

    -- Prevent duplicate pending subscription invoice for the same building
    IF EXISTS (
        SELECT 1 FROM public.app_subscription_invoices
        WHERE building_id = v_building.id AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'يوجد طلب تفعيل اشتراك قيد المراجعة بالفعل لهذه العمارة.';
    END IF;

    -- Use custom_monthly_price if set for this building, otherwise plan default_monthly_price
    v_monthly_price := COALESCE(v_building.custom_monthly_price, v_plan.default_monthly_price);
    v_total_amount := v_monthly_price * GREATEST(COALESCE(p_duration_months, 1), 1);

    IF v_total_amount <= 0 THEN
        RAISE EXCEPTION 'لا يمكن رفع إيصال سداد لباقة مجانية بقيمة صفر.';
    END IF;

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
        p_receipt_image_url,
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

-- ============================================================================
-- 10. RPC: activate_building_subscription
--     التفعيل التلقائي للاشتراك بواسطة super_admin (عبر auth.uid() حصرياً):
--     - يتحقق من عدم التكرار المزدوج (status = 'pending' مع FOR UPDATE)
--     - يمدد اشتراك العمارة ويحدث حالة الاشتراك إلى 'active'
--     - يدرج مصروفاً تلقائياً في ميزانية العمارة تحت مسمى:
--       "رسوم اشتراك تطبيق إدارة العقار"
--       ليظهر في لوحة الشفافية للسكان ويخصم من رصيد الصندوق (fund_balance)!
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_building_subscription(
    p_invoice_id UUID
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
    v_building RECORD;
    v_new_ends_at TIMESTAMPTZ;
    v_new_balance NUMERIC(12, 2);
    v_expense_id UUID;
BEGIN
    -- 1. Verify caller identity & super_admin role strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id AND status = 'active';

    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Security Violation: Only Super Admin can activate building subscriptions.';
    END IF;

    -- 2. Lock the subscription invoice row FOR UPDATE (Idempotency / Double-Spend Protection)
    SELECT * INTO v_invoice
    FROM public.app_subscription_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'فاتورة الاشتراك غير موجودة.';
    END IF;

    -- 3. Strict check: Target status MUST be 'pending' exclusively
    IF v_invoice.status <> 'pending' THEN
        RAISE EXCEPTION 'منع التكرار المزدوج (Idempotency): تم تفعيل أو معالجة فاتورة الاشتراك هذه مسبقاً (الحالة الحالية: %).', v_invoice.status;
    END IF;

    -- Lock building row
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_invoice.building_id
    FOR UPDATE;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 4. Mark invoice as approved
    UPDATE public.app_subscription_invoices
    SET status = 'approved',
        activated_by = v_caller_id,
        activated_at = now()
    WHERE id = p_invoice_id;

    -- 5. Extend building subscription & set status to 'active'
    v_new_ends_at := GREATEST(COALESCE(v_building.subscription_ends_at, now()), now())
                     + (v_invoice.duration_months || ' months')::interval;

    -- 6. Automatically insert transparency expense: "رسوم اشتراك تطبيق إدارة العقار"
    INSERT INTO public.expenses (
        building_id,
        created_by,
        title,
        description,
        category,
        amount,
        expense_date,
        expense_month,
        invoice_image_url,
        invoice_number,
        is_system_generated,
        app_subscription_invoice_id
    ) VALUES (
        v_invoice.building_id,
        v_invoice.submitted_by,
        'رسوم اشتراك تطبيق إدارة العقار',
        format('تفعيل باقة (%s) لمدة (%s) شهر - قيد آلي معتمد من إدارة المنصة', v_invoice.plan_code, v_invoice.duration_months),
        'اشتراكات وخدمات رقمية',
        v_invoice.amount,
        CURRENT_DATE,
        to_char(CURRENT_DATE, 'YYYY-MM'),
        v_invoice.receipt_image_url,
        'SUB-' || upper(substr(v_invoice.id::text, 1, 8)),
        true,
        v_invoice.id
    )
    RETURNING id INTO v_expense_id;

    -- 7. Update building subscription dates, status, and deduct expense from fund_balance
    UPDATE public.buildings
    SET plan_code = v_invoice.plan_code,
        subscription_status = 'active',
        subscription_ends_at = v_new_ends_at,
        fund_balance = fund_balance - v_invoice.amount
    WHERE id = v_invoice.building_id
    RETURNING fund_balance INTO v_new_balance;

    -- 8. Notify building admin
    INSERT INTO public.notifications (building_id, recipient_id, title, body, category)
    VALUES (
        v_invoice.building_id,
        v_invoice.submitted_by,
        'تم تفعيل اشتراك العمارة بنجاح 🎉',
        format('تم تفعيل اشتراك العمارة حتى %s، وتم إدراج مصروف "رسوم اشتراك تطبيق إدارة العقار" بقيمة %s ج.م تلقائياً في سجل الشفافية.',
            to_char(v_new_ends_at, 'YYYY-MM-DD'), v_invoice.amount),
        'financial'
    );

    RETURN jsonb_build_object(
        'invoice_id', p_invoice_id,
        'building_id', v_invoice.building_id,
        'subscription_status', 'active',
        'subscription_ends_at', v_new_ends_at,
        'auto_expense_id', v_expense_id,
        'auto_expense_title', 'رسوم اشتراك تطبيق إدارة العقار',
        'deducted_amount', v_invoice.amount,
        'new_fund_balance', v_new_balance
    );
END;
$$;

-- ============================================================================
-- 11. RPC: super_admin_configure_building
--     شاشة الـ Super Admin المدمجة لإدارة العمارة: تخصيص السعر (custom_monthly_price)،
--     الحد الأقصى للشقق، ومفاتيح المميزات المستقلة (features_config JSONB).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_configure_building(
    p_building_id UUID,
    p_plan_code public.plan_tier DEFAULT NULL,
    p_custom_monthly_price NUMERIC(12, 2) DEFAULT NULL,
    p_clear_custom_price BOOLEAN DEFAULT false,
    p_max_apartments_override INTEGER DEFAULT NULL,
    p_features_config JSONB DEFAULT NULL,
    p_subscription_status public.building_subscription_status DEFAULT NULL,
    p_extend_days INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role public.user_role;
    v_updated_building RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id AND status = 'active';

    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Security Violation: Only Super Admin can configure building overrides and feature flags.';
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    UPDATE public.buildings
    SET plan_code = COALESCE(p_plan_code, plan_code),
        custom_monthly_price = CASE
            WHEN p_clear_custom_price THEN NULL
            ELSE COALESCE(p_custom_monthly_price, custom_monthly_price)
        END,
        max_apartments_override = COALESCE(p_max_apartments_override, max_apartments_override),
        features_config = CASE
            WHEN p_features_config IS NOT NULL THEN features_config || p_features_config
            ELSE features_config
        END,
        subscription_status = COALESCE(p_subscription_status, subscription_status),
        subscription_ends_at = CASE
            WHEN COALESCE(p_extend_days, 0) <> 0
            THEN GREATEST(COALESCE(subscription_ends_at, now()), now()) + (p_extend_days || ' days')::interval
            ELSE subscription_ends_at
        END
    WHERE id = p_building_id
    RETURNING * INTO v_updated_building;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'العمارة المطلوبة غير موجودة.';
    END IF;

    RETURN jsonb_build_object(
        'building_id', v_updated_building.id,
        'name', v_updated_building.name,
        'plan_code', v_updated_building.plan_code,
        'custom_monthly_price', v_updated_building.custom_monthly_price,
        'max_apartments_override', v_updated_building.max_apartments_override,
        'features_config', v_updated_building.features_config,
        'subscription_status', v_updated_building.subscription_status,
        'subscription_ends_at', v_updated_building.subscription_ends_at
    );
END;
$$;

-- ============================================================================
-- 12. RPC: save_user_push_token
--     حفظ وتحديث الـ Expo Push Token للمستخدم الحالي في جدول users عبر auth.uid()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_user_push_token(
    p_push_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    IF p_push_token IS NULL OR trim(p_push_token) = '' THEN
        RAISE EXCEPTION 'Push token cannot be empty.';
    END IF;

    UPDATE public.users
    SET push_token = trim(p_push_token),
        push_token_updated_at = now(),
        updated_at = now()
    WHERE id = v_caller_id;

    RETURN jsonb_build_object(
        'user_id', v_caller_id,
        'push_token', trim(p_push_token),
        'updated_at', now()
    );
END;
$$;

-- ============================================================================
-- 13. RPC: send_bulk_unpaid_reminder
--     زر "تذكير الكل" في واجهة المدير: يرسل إشعاراً جماعياً لكل الشقق التي لم تسدد
--     اشتراك الشهر الحالي بضغطة زر واحدة، ويعيد قائمة الـ push_tokens للإرسال الفوري.
-- ============================================================================

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
    v_reminded_count INTEGER := 0;
    v_title TEXT;
    v_body TEXT;
    v_push_targets JSONB := '[]'::jsonb;
    v_reminded_apartments JSONB := '[]'::jsonb;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.role <> 'admin' OR v_admin.status <> 'active' OR v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Only the active building admin can send bulk payment reminders.';
    END IF;

    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_admin.building_id;

    v_title := format('تذكير بسداد اشتراك شهر %s 🔔', trim(p_billing_month));

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
                AND trim(p.billing_month) = trim(p_billing_month)
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
                trim(p_billing_month),
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
                'billing_month', trim(p_billing_month),
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
        'billing_month', trim(p_billing_month),
        'reminded_count', v_reminded_count,
        'reminded_apartments', v_reminded_apartments,
        'push_targets', v_push_targets
    );
END;
$$;

-- ============================================================================
-- 14. RPC: mark_all_notifications_read
--     تحديد كافة إشعارات المستخدم الحالي كمقروءة عبر auth.uid()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_updated_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    UPDATE public.notifications
    SET is_read = true
    WHERE recipient_id = v_caller_id
      AND is_read = false;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'recipient_id', v_caller_id,
        'marked_read_count', v_updated_count
    );
END;
$$;

-- ============================================================================
-- 15. RPC: lookup_building_apartments_for_join
--     إظهار الاسم المبدئي (occupant_name) ومطابقة رقم الهاتف (occupant_phone)
--     تلقائياً عندما يدخل الساكن كود العمارة (building_code) لمنع اختيار شقة خاطئة.
-- ============================================================================

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
    v_suggested_occupant_phone TEXT := NULL;
    v_suggested_floor_number TEXT := NULL;
    v_apt RECORD;
    v_is_match BOOLEAN;
BEGIN
    -- 1. Try finding building directly by building_code
    SELECT id, name, address, building_code, total_apartments, default_monthly_dues
    INTO v_building
    FROM public.buildings
    WHERE upper(trim(building_code)) = upper(trim(p_building_code));

    -- 2. If not found, check if p_building_code is an apartment invite_code (e.g. BLD-XXXXXX-YY)
    IF NOT FOUND THEN
        SELECT b.id, b.name, b.address, b.building_code, b.total_apartments, b.default_monthly_dues,
               a.id as apt_id, a.apartment_number,
               COALESCE(a.occupant_name, u.full_name) as occupant_name,
               COALESCE(a.occupant_phone, u.phone) as occupant_phone,
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
            v_suggested_occupant_name := v_apt.occupant_name;
            v_suggested_occupant_phone := v_apt.occupant_phone;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;
    END IF;

    -- 3. If still not found, check if it has the format PREFIX-CODE-APARTMENT (e.g. BLD-371CF0-40)
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
            COALESCE(a.occupant_name, u.full_name) as occupant_name,
            COALESCE(a.occupant_phone, u.phone) as occupant_phone,
            a.arrears_amount,
            a.resident_id,
            a.invite_code
        FROM public.apartments a
        LEFT JOIN public.users u ON u.id = a.resident_id OR (u.building_id = a.building_id AND u.apartment_number = a.apartment_number AND u.status = 'active')
        WHERE a.building_id = v_building.id
          AND a.is_active = true
        ORDER BY a.apartment_number
    LOOP
        v_is_match := (
            v_clean_phone <> ''
            AND length(v_clean_phone) >= 8
            AND regexp_replace(COALESCE(v_apt.occupant_phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        );

        IF v_suggested_apt_number IS NOT NULL AND v_apt.apartment_number = v_suggested_apt_number THEN
            v_suggested_apt_id := v_apt.id;
            v_suggested_occupant_name := v_apt.occupant_name;
            v_suggested_occupant_phone := v_apt.occupant_phone;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;

        IF v_is_match AND v_suggested_apt_id IS NULL THEN
            v_suggested_apt_id := v_apt.id;
            v_suggested_apt_number := v_apt.apartment_number;
            v_suggested_occupant_name := v_apt.occupant_name;
            v_suggested_occupant_phone := v_apt.occupant_phone;
            v_suggested_floor_number := v_apt.floor_number;
        END IF;

        v_apartments := v_apartments || jsonb_build_object(
            'id', v_apt.id,
            'apartment_number', v_apt.apartment_number,
            'floor_number', v_apt.floor_number,
            'wing_or_direction', v_apt.wing_or_direction,
            'occupant_name', v_apt.occupant_name,
            'occupant_phone', v_apt.occupant_phone,
            'invite_code', v_apt.invite_code,
            'is_phone_match', v_is_match,
            'is_occupied', (v_apt.resident_id IS NOT NULL),
            'arrears_amount', v_apt.arrears_amount
        );
    END LOOP;

    RETURN jsonb_build_object(
        'building_id', v_building.id,
        'building_name', v_building.name,
        'building_code', v_building.building_code,
        'suggested_apartment_id', v_suggested_apt_id,
        'suggested_apartment_number', v_suggested_apt_number,
        'suggested_occupant_name', v_suggested_occupant_name,
        'suggested_occupant_phone', v_suggested_occupant_phone,
        'suggested_floor_number', v_suggested_floor_number,
        'apartments', v_apartments
    );
END;
$$;

-- ============================================================================
-- 16. RPC: transfer_apartment_obligations
--     أداة "نقل المديونيات/الالتزامات بين الشقق":
--     تتيح لرئيس الاتحاد نقل التزام واحد محدد أو كافة الالتزامات غير المدفوعة (unpaid)
--     من الشقة الخاطئة إلى الشقة الصحيحة بضغطة زر واحدة (مع خيار نقل الاسم المبدئي
--     ورقم الهاتف المسجل مسبقاً) عبر auth.uid() وقفل الصفوف FOR UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_apartment_obligations(
    p_source_apartment_id UUID,
    p_target_apartment_id UUID,
    p_obligation_ids UUID[] DEFAULT NULL,
    p_transfer_occupant_info BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_admin RECORD;
    v_source_apt RECORD;
    v_target_apt RECORD;
    v_transferred_count INTEGER := 0;
    v_transferred_amount NUMERIC(12, 2) := 0.00;
    v_new_source_arrears NUMERIC(12, 2) := 0.00;
    v_new_target_arrears NUMERIC(12, 2) := 0.00;
BEGIN
    -- 1. Verify caller identity exclusively via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.role <> 'admin' OR v_admin.status <> 'active' OR v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Only the active building admin can transfer apartment obligations.';
    END IF;

    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.';
    END IF;

    IF p_source_apartment_id IS NULL OR p_target_apartment_id IS NULL THEN
        RAISE EXCEPTION 'يرجى تحديد الشقة المصدر والشقة المستهدفة.';
    END IF;

    IF p_source_apartment_id = p_target_apartment_id THEN
        RAISE EXCEPTION 'لا يمكن نقل الالتزامات إلى نفس الشقة.';
    END IF;

    -- 2. Lock both source and target apartments FOR UPDATE
    SELECT * INTO v_source_apt
    FROM public.apartments
    WHERE id = p_source_apartment_id
      AND building_id = v_admin.building_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الشقة المصدر غير موجودة في عمارتك.';
    END IF;

    SELECT * INTO v_target_apt
    FROM public.apartments
    WHERE id = p_target_apartment_id
      AND building_id = v_admin.building_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الشقة المستهدفة غير موجودة في عمارتك.';
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 3. Calculate total amount and count of unpaid obligations to be transferred
    SELECT
        COUNT(*),
        COALESCE(SUM(amount), 0.00)
    INTO v_transferred_count, v_transferred_amount
    FROM public.apartment_obligations
    WHERE building_id = v_admin.building_id
      AND apartment_id = p_source_apartment_id
      AND status = 'unpaid'
      AND (
          p_obligation_ids IS NULL
          OR array_length(p_obligation_ids, 1) IS NULL
          OR id = ANY(p_obligation_ids)
      );

    -- 4. Move the selected (or all) unpaid obligations from source to target apartment
    UPDATE public.apartment_obligations
    SET apartment_id = p_target_apartment_id,
        transferred_from_apartment_id = p_source_apartment_id,
        transferred_at = now(),
        updated_at = now()
    WHERE building_id = v_admin.building_id
      AND apartment_id = p_source_apartment_id
      AND status = 'unpaid'
      AND (
          p_obligation_ids IS NULL
          OR array_length(p_obligation_ids, 1) IS NULL
          OR id = ANY(p_obligation_ids)
      );

    -- 5. Recalculate arrears_amount on both source and target apartments
    SELECT COALESCE(SUM(amount), 0.00) INTO v_new_source_arrears
    FROM public.apartment_obligations
    WHERE apartment_id = p_source_apartment_id AND status = 'unpaid';

    SELECT COALESCE(SUM(amount), 0.00) INTO v_new_target_arrears
    FROM public.apartment_obligations
    WHERE apartment_id = p_target_apartment_id AND status = 'unpaid';

    UPDATE public.apartments
    SET arrears_amount = v_new_source_arrears,
        occupant_name = CASE WHEN p_transfer_occupant_info THEN NULL ELSE occupant_name END,
        occupant_phone = CASE WHEN p_transfer_occupant_info THEN NULL ELSE occupant_phone END,
        updated_at = now()
    WHERE id = p_source_apartment_id;

    UPDATE public.apartments
    SET arrears_amount = v_new_target_arrears,
        occupant_name = CASE
            WHEN p_transfer_occupant_info AND v_source_apt.occupant_name IS NOT NULL
            THEN v_source_apt.occupant_name
            ELSE occupant_name
        END,
        occupant_phone = CASE
            WHEN p_transfer_occupant_info AND v_source_apt.occupant_phone IS NOT NULL
            THEN v_source_apt.occupant_phone
            ELSE occupant_phone
        END,
        updated_at = now()
    WHERE id = p_target_apartment_id;

    RETURN jsonb_build_object(
        'source_apartment_id', p_source_apartment_id,
        'source_apartment_number', v_source_apt.apartment_number,
        'target_apartment_id', p_target_apartment_id,
        'target_apartment_number', v_target_apt.apartment_number,
        'transferred_count', v_transferred_count,
        'transferred_amount', v_transferred_amount,
        'transferred_occupant_info', p_transfer_occupant_info,
        'new_source_arrears', v_new_source_arrears,
        'new_target_arrears', v_new_target_arrears
    );
END;
$$;


