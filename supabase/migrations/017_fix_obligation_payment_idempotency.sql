-- ============================================================================
-- Migration 017: Fix Obligation Payment Idempotency & Lifecycle in RPCs
-- ============================================================================
-- 1. Updates submit_resident_payment to:
--    a. Normalize billing_month format (e.g. MM-YYYY -> YYYY-MM)
--    b. Fix idempotency/duplicate check: allows multiple distinct obligations in the same month
--    c. Atomically mark the specific obligation as 'pending' in public.apartment_obligations
--    d. Send descriptive notification to admin citing the exact obligation title
-- 2. Updates approve_resident_payment to:
--    a. Mark target obligation as 'paid' in public.apartment_obligations
--    b. Deduct from apartment arrears_amount
-- 3. Updates reject_resident_payment to:
--    a. Revert target obligation to 'unpaid' in public.apartment_obligations
-- ============================================================================

-- 0. Ensure payment_status column exists on apartments if needed
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS payment_status public.payment_status DEFAULT 'unpaid';

-- 1. Redefine submit_resident_payment
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
    v_obl_id_text TEXT;
    v_obl_id UUID;
    v_obl_title TEXT;
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

    -- 5. Format & normalize billing_month (YYYY-MM)
    v_month := trim(COALESCE(p_billing_month, ''));
    IF v_month ~ '^(0[1-9]|1[0-2])-([0-9]{4})$' THEN
        v_month := regexp_replace(v_month, '^(0[1-9]|1[0-2])-([0-9]{4})$', '\2-\1');
    END IF;

    IF NOT (v_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') THEN
        v_month := to_char(now(), 'YYYY-MM');
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

        IF NOT (
            v_receipt LIKE '%' || v_resident.building_id::text || '%'
            OR v_receipt LIKE 'payment-receipts/' || v_resident.building_id::text || '%'
        ) THEN
            RAISE EXCEPTION 'مسار إيصال السداد غير مصرح به أو لا يتبع هذه العمارة.';
        END IF;

        IF v_receipt LIKE '%..%' THEN
            RAISE EXCEPTION 'مسار الإيصال غير صالح.';
        END IF;
    ELSIF p_payment_method = 'cash' THEN
        IF p_cash_recipient IS NULL THEN
            RAISE EXCEPTION 'يرجى تحديد مستلم المبلغ النقدي (رئيس الاتحاد أو حارس العمارة).';
        END IF;
    END IF;

    -- 9. Obligation ID extraction from notes (e.g. [سداد بند: عنوان #uuid-or-id])
    v_obl_id_text := substring(p_notes from '#([0-9a-fA-F-]{36})\]');
    v_obl_title := substring(p_notes from '\[سداد بند:\s*(.*?)(?:\s*#|\s*\])');

    -- 10. Intelligent Duplicate / Idempotency Check
    IF p_notes IS NOT NULL AND p_notes LIKE '%[سداد بند:%' THEN
        -- Paying a specific obligation: block only if an identical pending/paid payment targeting this note/ID exists
        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id))
              AND building_id = v_resident.building_id
              AND notes = p_notes
              AND status IN ('pending', 'paid')
        ) THEN
            RAISE EXCEPTION 'تم تقديم طلب سداد لهذا البند المحدد بالفعل وهو قيد المراجعة أو الاعتماد.';
        END IF;
    ELSIF p_notes IS NOT NULL AND (p_notes LIKE '%[سداد كامل المديونية%' OR p_notes LIKE '%[سداد جزئي%') THEN
        -- Paying arrears: block only if identical pending arrears exists with same amount
        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id))
              AND building_id = v_resident.building_id
              AND amount = p_amount
              AND (notes LIKE '%[سداد كامل المديونية%' OR notes LIKE '%[سداد جزئي%')
              AND status = 'pending'
        ) THEN
            RAISE EXCEPTION 'لديك طلب سداد مديونية بنفس المبلغ قيد المراجعة بالفعل. يرجى انتظار اعتماد رئيس الاتحاد.';
        END IF;
    ELSIF p_payment_category = 'emergency_claim' THEN
        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id))
              AND building_id = v_resident.building_id
              AND payment_category = 'emergency_claim'
              AND emergency_claim_id = p_emergency_claim_id
              AND status IN ('pending', 'paid')
        ) THEN
            RAISE EXCEPTION 'تم سداد أو تقديم طلب سداد بالفعل لمطالبة الطوارئ هذه.';
        END IF;
    ELSE
        -- Standard monthly dues: block only if exact same monthly dues is pending or paid
        IF EXISTS (
            SELECT 1 FROM public.payments
            WHERE (resident_id = v_caller_id OR (v_apt_id IS NOT NULL AND apartment_id = v_apt_id))
              AND building_id = v_resident.building_id
              AND payment_category = 'monthly_dues'
              AND trim(billing_month) = v_month
              AND (notes IS NULL OR (notes NOT LIKE '%[سداد بند:%' AND notes NOT LIKE '%[سداد كامل المديونية%' AND notes NOT LIKE '%[سداد جزئي%'))
              AND status IN ('pending', 'paid')
        ) THEN
            RAISE EXCEPTION 'تم سداد أو تقديم طلب سداد بالفعل لاشتراك هذا الشهر (%s). لا يمكن تكرار المعاملة.', v_month;
        END IF;
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 11. Insert payment record
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

    -- 12. If paying an obligation, mark it 'pending' atomically in apartment_obligations
    IF v_obl_id_text IS NOT NULL THEN
        BEGIN
            v_obl_id := v_obl_id_text::uuid;
            UPDATE public.apartment_obligations
            SET status = 'pending'
            WHERE id = v_obl_id;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- 13. Mark emergency claim share as pending if applicable
    IF p_payment_category = 'emergency_claim' AND p_emergency_claim_id IS NOT NULL AND v_apt_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'pending'
        WHERE claim_id = p_emergency_claim_id
          AND apartment_id = v_apt_id
          AND status = 'unpaid';
    END IF;

    -- 14. Notify building admin with specific item details
    IF v_building.admin_id IS NOT NULL THEN
        DECLARE
            v_notif_body TEXT;
        BEGIN
            IF v_obl_title IS NOT NULL THEN
                v_notif_body := format('قام الساكن (%s - شقة %s) برفع طلب سداد بند (%s) بمبلغ %s ج.م بانتظار مراجعتك واعتمادك.',
                    v_res_name, COALESCE(v_apt_number, '-'), v_obl_title, p_amount);
            ELSIF p_notes LIKE '%[سداد%' THEN
                v_notif_body := format('قام الساكن (%s - شقة %s) برفع طلب سداد مديونية بمبلغ %s ج.م بانتظار مراجعتك واعتمادك.',
                    v_res_name, COALESCE(v_apt_number, '-'), p_amount);
            ELSE
                v_notif_body := format('قام الساكن (%s - شقة %s) برفع طلب سداد اشتراك شهر (%s) بمبلغ %s ج.م بانتظار المراجعة.',
                    v_res_name, COALESCE(v_apt_number, '-'), v_month, p_amount);
            END IF;

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
                format('إيصال سداد جديد — شقة %s 💳', COALESCE(v_apt_number, '-')),
                v_notif_body,
                'financial',
                jsonb_build_object(
                    'apartment_number', v_apt_number,
                    'amount', p_amount,
                    'payment_id', v_payment_id,
                    'category', p_payment_category
                )
            );
        END;
    END IF;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'status', 'pending',
        'message', 'تم إرسال طلب السداد بنجاح وهو قيد المراجعة والاعتماد'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_resident_payment(numeric, public.payment_method_type, text, public.cash_recipient_type, text, public.payment_category_type, uuid, text, text) TO authenticated;


-- 2. Redefine approve_resident_payment to settle obligations & update arrears
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
    v_obl_id_text TEXT;
    v_obl_id UUID;
    v_obl_title TEXT;
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

    -- 9. Settle obligation if this payment targets an obligation, or settle FIFO if general arrears
    v_obl_id_text := substring(v_payment.notes from '#([0-9a-fA-F-]{36})\]');
    v_obl_title := substring(v_payment.notes from '\[سداد بند:\s*(.*?)(?:\s*#|\s*\])');

    IF v_obl_id_text IS NOT NULL THEN
        BEGIN
            v_obl_id := v_obl_id_text::uuid;
            DECLARE
                v_target_obl RECORD;
            BEGIN
                SELECT * INTO v_target_obl FROM public.apartment_obligations WHERE id = v_obl_id;
                IF FOUND THEN
                    IF v_payment.amount >= v_target_obl.amount THEN
                        UPDATE public.apartment_obligations
                        SET status = 'paid'
                        WHERE id = v_obl_id;
                    ELSE
                        UPDATE public.apartment_obligations
                        SET amount = v_target_obl.amount - v_payment.amount,
                            notes = COALESCE(v_target_obl.notes || ' • ', '') || format('[سداد جزئي: تم خصم %s ج.م - متبقي %s ج.م]', v_payment.amount, v_target_obl.amount - v_payment.amount)
                        WHERE id = v_obl_id;
                    END IF;
                END IF;
            END;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    ELSIF v_payment.notes LIKE '%[سداد%' OR v_payment.payment_category = 'monthly_dues' THEN
        -- FIFO deduction across unpaid obligations for this apartment
        IF v_payment.apartment_id IS NOT NULL THEN
            DECLARE
                v_rem NUMERIC(12, 2) := v_payment.amount;
                v_row RECORD;
            BEGIN
                FOR v_row IN (
                    SELECT id, amount, notes
                    FROM public.apartment_obligations
                    WHERE apartment_id = v_payment.apartment_id
                      AND status IN ('unpaid', 'pending')
                    ORDER BY created_at ASC
                ) LOOP
                    IF v_rem <= 0 THEN
                        EXIT;
                    END IF;

                    IF v_rem >= v_row.amount THEN
                        UPDATE public.apartment_obligations
                        SET status = 'paid'
                        WHERE id = v_row.id;
                        v_rem := v_rem - v_row.amount;
                    ELSE
                        UPDATE public.apartment_obligations
                        SET amount = v_row.amount - v_rem,
                            notes = COALESCE(v_row.notes || ' • ', '') || format('[سداد جزئي: تم خصم %s ج.م - متبقي %s ج.م]', v_rem, v_row.amount - v_rem),
                            status = 'unpaid'
                        WHERE id = v_row.id;
                        v_rem := 0;
                        EXIT;
                    END IF;
                END LOOP;
            END;
        END IF;
    END IF;

    -- 10. Update apartment arrears_amount
    IF v_payment.apartment_id IS NOT NULL THEN
        UPDATE public.apartments
        SET arrears_amount = GREATEST(0, COALESCE(arrears_amount, 0) - v_payment.amount)
        WHERE id = v_payment.apartment_id;
    END IF;

    -- 11. Update emergency claim totals & shares if applicable
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

    -- 12. Notify resident
    DECLARE
        v_notif_title TEXT;
        v_notif_body TEXT;
    BEGIN
        IF v_obl_title IS NOT NULL THEN
            v_notif_title := 'تم اعتماد سداد البند بنجاح 🟢';
            v_notif_body := format('تم اعتماد سدادك لبند (%s) بمبلغ %s ج.م وخصمه من مديونية شقتك وإضافته لرصيد العمارة.',
                v_obl_title, v_payment.amount);
        ELSE
            v_notif_title := 'تم اعتماد سدادك بنجاح 🟢';
            v_notif_body := format('تم اعتماد سدادك بمبلغ %s ج.م عن (%s) وإضافته لخزينة العمارة.',
                v_payment.amount, COALESCE(v_payment.billing_month, 'مطالبة صيانة'));
        END IF;

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
            v_notif_title,
            v_notif_body,
            'financial',
            jsonb_build_object(
                'apartment_number', v_payment.apartment_number,
                'amount', v_payment.amount,
                'payment_id', p_payment_id,
                'category', v_payment.payment_category
            )
        );
    END;

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


-- 3. Redefine reject_resident_payment to revert obligations to 'unpaid'
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
    v_obl_id_text TEXT;
    v_obl_id UUID;
    v_obl_title TEXT;
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

    -- 7. Revert obligation from 'pending' to 'unpaid' if applicable
    v_obl_id_text := substring(v_payment.notes from '#([0-9a-fA-F-]{36})\]');
    v_obl_title := substring(v_payment.notes from '\[سداد بند:\s*(.*?)(?:\s*#|\s*\])');

    IF v_obl_id_text IS NOT NULL THEN
        BEGIN
            v_obl_id := v_obl_id_text::uuid;
            UPDATE public.apartment_obligations
            SET status = 'unpaid'
            WHERE id = v_obl_id;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- 8. Reset emergency claim share status to 'unpaid' if applicable
    IF v_payment.payment_category = 'emergency_claim' AND v_payment.emergency_claim_id IS NOT NULL AND v_payment.apartment_id IS NOT NULL THEN
        UPDATE public.emergency_claim_shares
        SET status = 'unpaid'
        WHERE claim_id = v_payment.emergency_claim_id
          AND apartment_id = v_payment.apartment_id;
    END IF;

    -- 9. Notify resident with clear reason
    DECLARE
        v_notif_title TEXT;
        v_notif_body TEXT;
    BEGIN
        IF v_obl_title IS NOT NULL THEN
            v_notif_title := format('تعذر اعتماد سداد بند (%s) ⚠️', v_obl_title);
            v_notif_body := format('تم رفض طلب سداد بند (%s) بمبلغ %s ج.م. سبب الرفض: "%s". تمت إعادة البند لمستحقات شقتك لتتمكن من إعادة سداده.',
                v_obl_title, v_payment.amount, v_reason);
        ELSE
            v_notif_title := format('تعذر اعتماد إيصال السداد (شقة %s) ⚠️', COALESCE(v_payment.apartment_number, '-'));
            v_notif_body := format('تم رفض طلب سداد بمبلغ %s ج.م عن (%s). سبب الرفض: "%s". يرجى مراجعة رئيس الاتحاد وإعادة الرفع.',
                v_payment.amount, COALESCE(v_payment.billing_month, 'مطالبة مالية'), v_reason);
        END IF;

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
            v_notif_title,
            v_notif_body,
            'financial',
            jsonb_build_object(
                'apartment_number', v_payment.apartment_number,
                'amount', v_payment.amount,
                'payment_id', p_payment_id,
                'reason', v_reason
            )
        );
    END;

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'status', 'rejected',
        'rejection_reason', v_reason
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_resident_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_resident_payment(uuid, text) TO authenticated;
