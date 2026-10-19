-- ============================================================================
-- Migration: 008_security_patch_impersonation_rpcs.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Step 2 Security Patch:
--              1. Adds contributors_count to emergency_claims.
--              2. Rewrites the 5 impersonation RPC functions:
--                 - review_resident_join_request
--                 - approve_resident_payment
--                 - reject_resident_payment
--                 - submit_resident_payment
--                 - create_emergency_claim
--                 - create_building_poll
--              3. Strictly enforces caller identity via auth.uid() ONLY.
--                 Eliminates p_admin_id / p_resident_id / fallback to any admin or building.
--              4. Enforces subscription validity via is_building_writable().
--              5. Adds FOR UPDATE concurrency locks and idempotency checks.
--              6. Enforces REVOKE FROM PUBLIC, anon and GRANT TO authenticated.
-- ============================================================================

-- ============================================================================
-- 1. Schema Patch: Ensure contributors_count column exists on emergency_claims
-- ============================================================================
ALTER TABLE public.emergency_claims 
ADD COLUMN IF NOT EXISTS contributors_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. RPC: review_resident_join_request
--    Only active building admin can approve/reject resident join requests.
--    No identity parameters or fallbacks permitted.
-- ============================================================================
DROP FUNCTION IF EXISTS public.review_resident_join_request(uuid, boolean, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.review_resident_join_request(uuid, boolean, uuid, text);

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

    IF v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Admin is not assigned to an active building.';
    END IF;

    -- 2. Check building writability (subscription status)
    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    -- 3. Lock target resident record FOR UPDATE
    SELECT * INTO v_resident
    FROM public.users
    WHERE id = p_resident_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resident request not found.';
    END IF;

    -- 4. Verify resident belongs to the SAME building
    IF v_resident.building_id IS NULL OR v_resident.building_id <> v_admin.building_id THEN
        RAISE EXCEPTION 'Forbidden: Resident request belongs to a different building.';
    END IF;

    -- 5. Idempotency Check: must be 'pending'
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

    -- 6. Unit Override Handling: must be within the same building
    IF p_approve AND (p_override_apartment_id IS NOT NULL OR (p_override_apartment_number IS NOT NULL AND trim(p_override_apartment_number) <> '')) THEN
        SELECT * INTO v_target_apt
        FROM public.apartments
        WHERE building_id = v_admin.building_id
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
            IF p_override_apartment_id IS NOT NULL THEN
                RAISE EXCEPTION 'Specified override apartment does not exist in this building.';
            END IF;
            v_final_apt_number := trim(p_override_apartment_number);
        END IF;
    END IF;

    v_new_status := CASE WHEN p_approve THEN 'active'::public.account_status ELSE 'rejected'::public.account_status END;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 7. Update resident status and assigned unit
    UPDATE public.users
    SET status = v_new_status,
        apartment_id = v_final_apt_id,
        apartment_number = v_final_apt_number,
        floor_number = v_final_floor,
        updated_at = now()
    WHERE id = p_resident_user_id;

    -- 8. If approved and apartment unit is linked, bind resident to unit
    IF p_approve AND v_final_apt_id IS NOT NULL THEN
        UPDATE public.apartments
        SET resident_id = p_resident_user_id,
            occupant_name = COALESCE(occupant_name, v_resident.full_name),
            occupant_phone = COALESCE(occupant_phone, v_resident.phone),
            updated_at = now()
        WHERE id = v_final_apt_id;
    END IF;

    -- 9. Send notification to resident
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
        'resident_id', p_resident_user_id,
        'new_status', v_new_status,
        'apartment_id', v_final_apt_id,
        'apartment_number', v_final_apt_number
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_resident_join_request(uuid, boolean, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_resident_join_request(uuid, boolean, uuid, text) TO authenticated;

-- ============================================================================
-- 3. RPC: approve_resident_payment
--    Only active building admin of the payment's building can approve payments.
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_resident_payment(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_resident_payment(uuid);

CREATE OR REPLACE FUNCTION public.approve_resident_payment(
    p_payment_id UUID
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
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only active building admins can approve payments.';
    END IF;

    -- 2. Lock the target payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب السداد غير موجود.';
    END IF;

    -- 3. Verify payment belongs to admin's building
    IF v_payment.building_id <> v_admin.building_id THEN
        RAISE EXCEPTION 'Forbidden: Payment belongs to a different building.';
    END IF;

    -- 4. Check building writability
    IF NOT public.is_building_writable(v_payment.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    -- 5. Idempotency Check
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

    -- 6. Emergency claim validation if applicable
    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL THEN
        SELECT * INTO v_claim
        FROM public.emergency_claims
        WHERE id = v_payment.emergency_claim_id;

        IF NOT FOUND OR v_claim.building_id <> v_payment.building_id THEN
            RAISE EXCEPTION 'المطالبة الطارئة المرتبطة بهذا السداد لا تخص هذه العمارة.';
        END IF;

        IF v_claim.status <> 'active' THEN
            RAISE EXCEPTION 'المطالبة الطارئة المرتبطة لم تعد نشطة (حالتها: %).', v_claim.status;
        END IF;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 7. Mark payment as 'paid'
    UPDATE public.payments
    SET status = 'paid',
        reviewed_by = v_caller_id,
        reviewed_at = now()
    WHERE id = p_payment_id;

    -- 8. Increment building fund_balance
    UPDATE public.buildings
    SET fund_balance = fund_balance + v_payment.amount
    WHERE id = v_payment.building_id
    RETURNING fund_balance INTO v_new_balance;

    -- 9. Update emergency claim totals & shares if applicable
    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL THEN
        UPDATE public.emergency_claims
        SET collected_amount = collected_amount + v_payment.amount,
            contributors_count = COALESCE(contributors_count, 0) + 1,
            status = CASE
                WHEN (collected_amount + v_payment.amount) >= target_amount THEN 'completed'::public.claim_status
                ELSE status
            END
        WHERE id = v_payment.emergency_claim_id;

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

    -- 10. Notify resident
    INSERT INTO public.notifications (
        building_id,
        recipient_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    ) VALUES (
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

REVOKE EXECUTE ON FUNCTION public.approve_resident_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_resident_payment(uuid) TO authenticated;

-- ============================================================================
-- 4. RPC: reject_resident_payment
--    Only active building admin of the payment's building can reject payments.
-- ============================================================================
DROP FUNCTION IF EXISTS public.reject_resident_payment(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.reject_resident_payment(uuid, text);

CREATE OR REPLACE FUNCTION public.reject_resident_payment(
    p_payment_id UUID,
    p_rejection_reason TEXT DEFAULT 'بيانات الإيصال غير واضحة أو لم يصل التحويل'
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
    v_reason TEXT;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT id, role, status, building_id INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only active building admins can reject payments.';
    END IF;

    v_reason := trim(COALESCE(p_rejection_reason, ''));
    IF v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    -- 2. Lock the target payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طلب السداد غير موجود.';
    END IF;

    -- 3. Verify payment belongs to admin's building
    IF v_payment.building_id <> v_admin.building_id THEN
        RAISE EXCEPTION 'Forbidden: Payment belongs to a different building.';
    END IF;

    -- 4. Check building writability
    IF NOT public.is_building_writable(v_payment.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    -- 5. Idempotency Check
    IF v_payment.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'payment_id', p_payment_id,
            'status', 'rejected',
            'message', 'Already rejected'
        );
    END IF;

    IF v_payment.status <> 'pending' THEN
        RAISE EXCEPTION 'منع التكرار المزدوج: حالة الدفعة الحالية (%).', v_payment.status;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 6. Mark payment as 'rejected'
    UPDATE public.payments
    SET status = 'rejected',
        reviewed_by = v_caller_id,
        reviewed_at = now(),
        rejection_reason = v_reason
    WHERE id = p_payment_id;

    -- 7. Reset emergency claim share status to 'unpaid' if applicable
    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL AND v_payment.apartment_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'unpaid'
        WHERE claim_id = v_payment.emergency_claim_id
          AND apartment_id = v_payment.apartment_id;
    END IF;

    -- 8. Notify resident with clear reason
    INSERT INTO public.notifications (
        building_id,
        recipient_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    ) VALUES (
        v_payment.building_id,
        v_payment.resident_id,
        'resident',
        format('تعذر اعتماد إيصال السداد (شقة %s) ⚠️', COALESCE(v_payment.apartment_number, '-')),
        format('تم رفض طلب السداد بمبلغ %s ج.م. سبب الرفض: "%s". يرجى إعادة المحاولة أو مراجعة رئيس الاتحاد.',
            v_payment.amount, v_reason),
        'financial',
        jsonb_build_object(
            'apartment_number', v_payment.apartment_number,
            'amount', v_payment.amount,
            'payment_id', p_payment_id,
            'rejection_reason', v_reason,
            'category', v_payment.payment_category
        )
    );

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'status', 'rejected',
        'reviewed_by', v_caller_id,
        'rejection_reason', v_reason
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_resident_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_resident_payment(uuid, text) TO authenticated;

-- ============================================================================
-- 5. RPC: submit_resident_payment
--    Only active resident can submit payments.
--    Building, unit, and resident details are strictly retrieved from DB.
--    Regex validation on billing_month and storage bucket check on receipts.
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text, uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text);

CREATE OR REPLACE FUNCTION public.submit_resident_payment(
    p_amount NUMERIC(12, 2),
    p_payment_method public.payment_method_type,
    p_billing_month TEXT,
    p_cash_recipient public.cash_recipient_type DEFAULT NULL,
    p_receipt_image_url TEXT DEFAULT NULL,
    p_payment_category public.payment_category_type DEFAULT 'monthly_dues',
    p_emergency_claim_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
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
    v_claim RECORD;
    v_payment_id UUID;
    v_apt_id UUID;
    v_apt_number TEXT;
    v_res_name TEXT;
    v_month TEXT;
    v_receipt TEXT;
BEGIN
    -- 1. Identify caller strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    -- 2. Fetch resident profile from users table
    SELECT * INTO v_resident
    FROM public.users
    WHERE id = v_caller_id;

    IF v_resident.id IS NULL OR v_resident.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: User account is not active or does not exist.';
    END IF;

    IF v_resident.role <> 'resident' THEN
        RAISE EXCEPTION 'Forbidden: Only residents can submit payments via this function.';
    END IF;

    IF v_resident.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Resident is not associated with an active building.';
    END IF;

    -- 3. Check building writability
    IF NOT public.is_building_writable(v_resident.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_resident.building_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Building not found.';
    END IF;

    -- 4. Amount validation
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'يجب أن يكون مبلغ السداد أكبر من الصفر.';
    END IF;

    -- 5. Format & validate billing_month (YYYY-MM)
    v_month := trim(COALESCE(p_billing_month, ''));
    IF NOT (v_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') THEN
        RAISE EXCEPTION 'صيغة الشهر غير صالحة. يجب أن تكون بصيغة YYYY-MM (مثال: 2026-05).';
    END IF;

    -- 6. Resolve unit number and apartment_id from DB
    v_apt_id := v_resident.apartment_id;
    v_apt_number := v_resident.apartment_number;
    v_res_name := COALESCE(v_resident.full_name, 'الساكن / المالك');

    IF v_apt_id IS NULL AND v_apt_number IS NOT NULL THEN
        SELECT id INTO v_apt_id
        FROM public.apartments
        WHERE building_id = v_resident.building_id AND trim(apartment_number) = trim(v_apt_number)
        LIMIT 1;
    END IF;

    IF v_apt_id IS NULL AND v_apt_number IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Resident must be assigned to an apartment unit to submit payment.';
    END IF;

    -- 7. Validate emergency claim if category is emergency_claim
    IF p_payment_category = 'emergency_claim' THEN
        IF p_emergency_claim_id IS NULL THEN
            RAISE EXCEPTION 'معرف المطالبة الطارئة مطلوب لسداد بنود الطوارئ.';
        END IF;

        SELECT * INTO v_claim
        FROM public.emergency_claims
        WHERE id = p_emergency_claim_id;

        IF NOT FOUND OR v_claim.building_id <> v_resident.building_id THEN
            RAISE EXCEPTION 'المطالبة الطارئة غير موجودة أو لا تخص هذه العمارة.';
        END IF;

        IF v_claim.status <> 'active' THEN
            RAISE EXCEPTION 'المطالبة الطارئة لم تعد نشطة (حالتها: %).', v_claim.status;
        END IF;
    END IF;

    -- 8. Payment method rules & receipt image url path validation
    IF p_payment_method = 'electronic_transfer' THEN
        IF COALESCE((v_building.features_config->>'receipt_upload')::boolean, true) = false THEN
            RAISE EXCEPTION 'ميزة رفع إيصالات التحويل غير مفعلة في باقة العمارة الحالية.';
        END IF;

        v_receipt := trim(COALESCE(p_receipt_image_url, ''));
        IF v_receipt = '' THEN
            RAISE EXCEPTION 'يرجى إرفاق صورة إيصال التحويل الإلكتروني.';
        END IF;

        -- Path must reside within the building's designated bucket path
        IF NOT (
            v_receipt LIKE '%' || v_resident.building_id::text || '%'
            OR v_receipt LIKE 'payment-receipts/' || v_resident.building_id::text || '%'
        ) THEN
            RAISE EXCEPTION 'مسار إيصال السداد غير مصرح به أو لا يتبع هذه العمارة.';
        END IF;

        -- Prevent path traversal
        IF v_receipt LIKE '%..%' THEN
            RAISE EXCEPTION 'مسار الإيصال غير صالح.';
        END IF;
    ELSIF p_payment_method = 'cash' THEN
        IF p_cash_recipient IS NULL THEN
            RAISE EXCEPTION 'يرجى تحديد مستلم المبلغ النقدي (رئيس الاتحاد أو حارس العمارة).';
        END IF;
    END IF;

    -- 9. Prevent duplicate pending or paid payment
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id))
          AND building_id = v_resident.building_id
          AND payment_category = p_payment_category
          AND trim(billing_month) = v_month
          AND COALESCE(emergency_claim_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              COALESCE(p_emergency_claim_id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('pending', 'paid')
    ) THEN
        RAISE EXCEPTION 'تم سداد أو تقديم طلب سداد بالفعل لهذا الشهر/المطالبة. لا يمكن تكرار المعاملة.';
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 10. Insert payment record
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
        v_resident.building_id,
        v_apt_id,
        v_apt_number,
        v_caller_id,
        v_res_name,
        p_payment_category,
        p_emergency_claim_id,
        v_month,
        p_amount,
        p_payment_method,
        p_cash_recipient,
        v_receipt,
        p_reference_number,
        p_notes,
        'pending'
    )
    RETURNING id INTO v_payment_id;

    -- 11. Mark emergency claim share as pending
    IF p_payment_category = 'emergency_claim' AND p_emergency_claim_id IS NOT NULL AND v_apt_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'pending'
        WHERE claim_id = p_emergency_claim_id
          AND apartment_id = v_apt_id
          AND status = 'unpaid';
    END IF;

    -- 12. Notify building admin
    IF v_building.admin_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            building_id,
            recipient_id,
            recipient_role,
            title,
            body,
            category,
            metadata
        ) VALUES (
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

REVOKE EXECUTE ON FUNCTION public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text) TO authenticated;

-- ============================================================================
-- 6. RPC: create_emergency_claim
--    Only active building admin can create emergency claims.
--    Validates feature flags, positive amounts, and custom shares sum equality.
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_emergency_claim(text, text, text, numeric, public.claim_distribution_type, jsonb, date, numeric, boolean, uuid, uuid);
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
    p_occupied_only BOOLEAN DEFAULT FALSE
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
    v_share_apt_id UUID;
    v_share_amount NUMERIC(12, 2);
    v_custom_sum NUMERIC(12, 2) := 0.00;
    v_apt_record RECORD;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT * INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only active building admins can create emergency claims.';
    END IF;

    IF v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Admin is not assigned to an active building.';
    END IF;

    -- 2. Check building writability
    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_admin.building_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Building not found.';
    END IF;

    -- 3. Feature flag verification
    IF COALESCE((v_building.features_config->>'emergency_claims')::boolean, true) = false THEN
        RAISE EXCEPTION 'ميزة المطالبات الطارئة غير مفعلة في باقة العمارة الحالية.';
    END IF;

    -- 4. Target amount validation
    IF p_target_amount IS NULL OR p_target_amount <= 0 THEN
        RAISE EXCEPTION 'Target amount must be greater than zero.';
    END IF;

    -- 5. Equal distribution calculation
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

    -- 6. Custom distribution validation: positive shares & sum equal target_amount
    IF p_distribution_type = 'custom' THEN
        IF p_custom_shares IS NULL OR jsonb_array_length(p_custom_shares) = 0 THEN
            RAISE EXCEPTION 'Custom shares list is required when distribution type is custom.';
        END IF;

        FOR v_share_item IN SELECT * FROM jsonb_array_elements(p_custom_shares)
        LOOP
            v_share_apt_id := (v_share_item->>'apartment_id')::uuid;
            v_share_amount := COALESCE((v_share_item->>'amount')::numeric, (v_share_item->>'assigned_amount')::numeric, 0.00);

            IF v_share_apt_id IS NULL THEN
                RAISE EXCEPTION 'Apartment ID is required for each custom share.';
            END IF;

            IF v_share_amount <= 0 THEN
                RAISE EXCEPTION 'Custom share amount for apartment % must be greater than zero.', v_share_apt_id;
            END IF;

            SELECT * INTO v_apt_record
            FROM public.apartments
            WHERE id = v_share_apt_id AND building_id = v_building.id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Apartment % does not belong to building %.', v_share_apt_id, v_building.id;
            END IF;

            v_custom_sum := v_custom_sum + v_share_amount;
        END LOOP;

        IF ROUND(v_custom_sum, 2) <> ROUND(p_target_amount, 2) THEN
            RAISE EXCEPTION 'مجموع حصص الشقق المخصصة (% ج.م) يجب أن يساوي المبلغ المستهدف للمطالبة (% ج.م) تماماً.', v_custom_sum, p_target_amount;
        END IF;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 7. Insert emergency claim record
    INSERT INTO public.emergency_claims (
        building_id,
        created_by,
        title,
        description,
        category,
        target_amount,
        collected_amount,
        contributors_count,
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
        0,
        p_distribution_type,
        v_equal_share,
        p_due_date,
        'active'
    )
    RETURNING id INTO v_claim_id;

    -- 8. Distribute shares across units
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
    ELSIF p_distribution_type = 'custom' THEN
        FOR v_share_item IN SELECT * FROM jsonb_array_elements(p_custom_shares)
        LOOP
            v_share_apt_id := (v_share_item->>'apartment_id')::uuid;
            v_share_amount := COALESCE((v_share_item->>'amount')::numeric, (v_share_item->>'assigned_amount')::numeric, 0.00);

            SELECT resident_id INTO v_apt_record
            FROM public.apartments
            WHERE id = v_share_apt_id;

            INSERT INTO public.emergency_claim_shares (
                claim_id,
                building_id,
                apartment_id,
                resident_id,
                assigned_amount,
                paid_amount,
                status
            ) VALUES (
                v_claim_id,
                v_building.id,
                v_share_apt_id,
                v_apt_record.resident_id,
                v_share_amount,
                0.00,
                'unpaid'
            );
        END LOOP;
    END IF;

    -- 9. Notify residents
    INSERT INTO public.notifications (
        building_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    ) VALUES (
        v_building.id,
        'resident',
        'مطالبة صيانة طارئة جديدة 🚨',
        format('تم فتح مطالبة صيانة طارئة: "%s" بمبلغ إجمالي %s ج.م.', trim(p_title), p_target_amount),
        'financial',
        jsonb_build_object(
            'claim_id', v_claim_id,
            'target_amount', p_target_amount,
            'distribution_type', p_distribution_type
        )
    );

    RETURN jsonb_build_object(
        'claim_id', v_claim_id,
        'building_id', v_building.id,
        'target_amount', p_target_amount,
        'distribution_type', p_distribution_type,
        'default_share_amount', v_equal_share,
        'status', 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_emergency_claim(text, text, text, numeric, public.claim_distribution_type, jsonb, date, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_emergency_claim(text, text, text, numeric, public.claim_distribution_type, jsonb, date, numeric, boolean) TO authenticated;

-- ============================================================================
-- 7. RPC: create_building_poll
--    Only active building admin can create general assembly polls.
--    Enforces voting feature flag, building writability, and admin building match.
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_building_poll(uuid, text, text, text, numeric, numeric, numeric, integer, jsonb, text, boolean);

CREATE OR REPLACE FUNCTION public.create_building_poll(
    p_building_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'عام',
    p_estimated_cost NUMERIC(12, 2) DEFAULT 0.00,
    p_share_per_unit NUMERIC(12, 2) DEFAULT 0.00,
    p_quorum_percent NUMERIC(5, 2) DEFAULT 51.00,
    p_duration_days INTEGER DEFAULT 7,
    p_options JSONB DEFAULT NULL,
    p_document_url TEXT DEFAULT NULL,
    p_is_urgent BOOLEAN DEFAULT false
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
    v_poll_id UUID;
    v_session_code TEXT;
    v_options JSONB;
    v_target_bld_id UUID;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required (auth.uid() is null).';
    END IF;

    SELECT id, building_id, role, status INTO v_admin
    FROM public.users
    WHERE id = v_caller_id;

    IF v_admin.id IS NULL OR v_admin.role <> 'admin' OR v_admin.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: Only active building admins can create polls.';
    END IF;

    IF v_admin.building_id IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Admin is not assigned to an active building.';
    END IF;

    -- 2. Verify target building matches caller's building
    IF p_building_id IS NOT NULL AND p_building_id <> v_admin.building_id THEN
        RAISE EXCEPTION 'Forbidden: You cannot create polls for a different building.';
    END IF;

    v_target_bld_id := v_admin.building_id;

    -- 3. Check building writability
    IF NOT public.is_building_writable(v_target_bld_id) THEN
        RAISE EXCEPTION 'Forbidden: Building subscription has expired or is in read-only mode.';
    END IF;

    -- 4. Check voting feature flag
    SELECT * INTO v_building FROM public.buildings WHERE id = v_target_bld_id;
    IF COALESCE((v_building.features_config->>'voting')::boolean, true) = false THEN
        RAISE EXCEPTION 'ميزة التصويت وقرارات الجمعية العمومية غير مفعلة في باقة العمارة الحالية.';
    END IF;

    IF p_title IS NULL OR trim(p_title) = '' THEN
        RAISE EXCEPTION 'Poll title is required.';
    END IF;

    v_session_code := '#' || to_char(CURRENT_DATE, 'YY') || '-DEC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    IF p_options IS NULL OR jsonb_array_length(p_options) = 0 THEN
        v_options := '[{"id":"approve","title":"موافق على القرار"},{"id":"reject","title":"رافض أو متحفظ"},{"id":"abstain","title":"ممتنع عن التصويت"}]'::jsonb;
    ELSE
        v_options := p_options;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 5. Insert poll record
    INSERT INTO public.polls (
        building_id,
        created_by,
        session_code,
        title,
        description,
        category,
        estimated_cost,
        share_per_unit,
        quorum_percent,
        ends_at,
        options,
        document_url,
        is_urgent,
        status
    ) VALUES (
        v_target_bld_id,
        v_caller_id,
        v_session_code,
        trim(p_title),
        trim(p_description),
        COALESCE(p_category, 'عام'),
        COALESCE(p_estimated_cost, 0.00),
        COALESCE(p_share_per_unit, 0.00),
        COALESCE(p_quorum_percent, 51.00),
        now() + (COALESCE(p_duration_days, 7) || ' days')::interval,
        v_options,
        p_document_url,
        COALESCE(p_is_urgent, false),
        'active'
    )
    RETURNING id INTO v_poll_id;

    -- 6. Broadcast notification to residents
    INSERT INTO public.notifications (
        building_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    ) VALUES (
        v_target_bld_id,
        'resident',
        'تصويت وقرار جديد بانتظار مشاركتك 🗳️',
        'طرحت إدارة العمارة قراراً جديداً للتصويت: "' || trim(p_title) || '". صوتك يمثل شقتك ويوثق قانونياً.',
        'voting',
        jsonb_build_object('poll_id', v_poll_id, 'session_code', v_session_code)
    );

    RETURN jsonb_build_object(
        'success', true,
        'poll_id', v_poll_id,
        'session_code', v_session_code,
        'title', trim(p_title)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_building_poll(uuid, text, text, text, numeric, numeric, numeric, integer, jsonb, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_building_poll(uuid, text, text, text, numeric, numeric, numeric, integer, jsonb, text, boolean) TO authenticated;
