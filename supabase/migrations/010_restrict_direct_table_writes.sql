-- ============================================================================
-- Migration: 010_restrict_direct_table_writes.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Step 4 Security Overhaul:
--              1. poll_votes: Remove FOR ALL / direct insert policies. Writing via cast_poll_vote ONLY.
--                 Update cast_poll_vote: validates option choices, applies voting_basis weight,
--                 documents decision that votes are editable only before deadline (ends_at).
--              2. users: Prevent direct updates to apartment_id, status, role, building_id.
--                 Residents restricted to full_name and push_token only via trigger.
--              3. issue_upvotes: Remove FOR ALL policy. Writing via toggle_issue_upvote ONLY.
--              4. building_issues: Restrict direct INSERT to valid unit owner/open status;
--                 direct UPDATE prohibited (state updates strictly via update_issue_status RPC).
--              5. payments: Remove direct client INSERT/UPDATE. All mutations via submit/approve/reject RPCs.
--                 Add partial unique indexes to prevent concurrent duplicate pending requests.
--              6. expenses: Remove direct client INSERT. All mutations via record_building_expense / create_expense
--                 with FOR UPDATE building fund lock, positive amount, and negative balance protection.
--              7. apartments: Remove open FOR ALL policy. Add unique index on (building_id, apartment_number).
--                 Split into disciplined INSERT, UPDATE, DELETE policies.
-- ============================================================================

-- ============================================================================
-- 1. Restrict poll_votes & Harden cast_poll_vote RPC
-- ============================================================================
DROP POLICY IF EXISTS "poll_votes_insert_resident" ON public.poll_votes;
DROP POLICY IF EXISTS "votes_insert_manage_policy" ON public.poll_votes;

-- Revoke direct write permissions from public/clients
REVOKE INSERT, UPDATE, DELETE ON public.poll_votes FROM PUBLIC, anon;

-- Re-author cast_poll_vote RPC
DROP FUNCTION IF EXISTS public.cast_poll_vote(uuid, text);

CREATE OR REPLACE FUNCTION public.cast_poll_vote(
    p_poll_id UUID,
    p_choice TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user RECORD;
    v_poll RECORD;
    v_apt RECORD;
    v_total_apts INTEGER;
    v_weight NUMERIC(5, 2);
    v_votes_count INTEGER;
    v_choice_valid BOOLEAN := false;
BEGIN
    -- 1. Identify voter strictly via auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, apartment_id, apartment_number, full_name, role, status
    INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.status <> 'active' THEN
        RAISE EXCEPTION 'Forbidden: User profile is not active.';
    END IF;

    -- 2. Lock poll row FOR UPDATE and verify active status and deadline
    SELECT * INTO v_poll
    FROM public.polls
    WHERE id = p_poll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Poll not found.';
    END IF;

    IF v_poll.status <> 'active' THEN
        RAISE EXCEPTION 'This poll is no longer active.';
    END IF;

    -- DECISION ON VOTE EDITABILITY:
    -- A resident's vote is mutable (can be changed) strictly until the poll deadline (ends_at) passes.
    -- Once ends_at has passed or status is closed, votes are permanently locked and cannot be changed.
    IF v_poll.ends_at < now() THEN
        RAISE EXCEPTION 'انتهى الموعد النهائي المحدد للتصويت. تم قفل الأصوات نهائياً.';
    END IF;

    IF v_poll.building_id <> v_user.building_id THEN
        RAISE EXCEPTION 'Forbidden: Poll belongs to a different building.';
    END IF;

    -- 3. Validate that p_choice exists in poll.options
    IF v_poll.options IS NOT NULL AND jsonb_array_length(v_poll.options) > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_poll.options) opt
            WHERE opt->>'id' = trim(p_choice)
               OR opt #>> '{}' = trim(p_choice)
        ) INTO v_choice_valid;

        IF NOT v_choice_valid THEN
            RAISE EXCEPTION 'الخيار المحدد غير متاح ضمن خيارات هذا التصويت.';
        END IF;
    END IF;

    -- 4. Calculate unit weight according to voting_basis
    SELECT total_apartments INTO v_total_apts
    FROM public.buildings
    WHERE id = v_user.building_id;

    IF v_user.apartment_id IS NOT NULL THEN
        SELECT * INTO v_apt FROM public.apartments WHERE id = v_user.apartment_id;
    END IF;

    IF COALESCE(v_poll.voting_basis, 'ownership_share') = 'ownership_share' THEN
        -- Weight based on registered ownership share percentage
        v_weight := COALESCE(v_apt.ownership_share_percent, ROUND(100.0 / GREATEST(COALESCE(v_total_apts, 16), 1), 2));
    ELSE
        -- Equal vote per unit
        v_weight := ROUND(100.0 / GREATEST(COALESCE(v_total_apts, 16), 1), 2);
    END IF;

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 5. Upsert vote: strictly 1 vote per apartment unit
    INSERT INTO public.poll_votes (
        poll_id,
        building_id,
        apartment_id,
        apartment_number,
        voter_id,
        voter_name,
        choice,
        weight_percent
    ) VALUES (
        p_poll_id,
        v_user.building_id,
        COALESCE(v_user.apartment_id, v_caller_id),
        COALESCE(v_user.apartment_number, '1'),
        v_caller_id,
        COALESCE(v_user.full_name, 'ساكن'),
        trim(p_choice),
        v_weight
    )
    ON CONFLICT (poll_id, apartment_id)
    DO UPDATE SET
        choice = EXCLUDED.choice,
        voter_id = EXCLUDED.voter_id,
        voter_name = EXCLUDED.voter_name,
        weight_percent = EXCLUDED.weight_percent,
        created_at = now();

    -- 6. Recalculate and update votes_count
    SELECT count(*) INTO v_votes_count
    FROM public.poll_votes
    WHERE poll_id = p_poll_id;

    UPDATE public.polls
    SET votes_count = v_votes_count,
        updated_at = now()
    WHERE id = p_poll_id;

    RETURN jsonb_build_object(
        'success', true,
        'poll_id', p_poll_id,
        'choice', trim(p_choice),
        'apartment_number', v_user.apartment_number,
        'votes_count', v_votes_count,
        'weight_percent', v_weight
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cast_poll_vote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_poll_vote(uuid, text) TO authenticated;

-- ============================================================================
-- 2. Restrict Direct Column Modifications on public.users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_user_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role public.user_role;
    v_bypass TEXT;
BEGIN
    -- Check if operation is running within a trusted SECURITY DEFINER RPC
    v_bypass := current_setting('app.rpc_internal_bypass', true);
    IF v_bypass = 'true' THEN
        RETURN NEW;
    END IF;

    -- Super Admin has full maintenance privileges
    v_caller_role := public.get_my_role();
    IF v_caller_role = 'super_admin' THEN
        RETURN NEW;
    END IF;

    -- When a user updates their own profile directly
    IF auth.uid() = OLD.id THEN
        -- Prohibit tampering with security-critical columns
        IF (OLD.role IS DISTINCT FROM NEW.role OR
            OLD.status IS DISTINCT FROM NEW.status OR
            OLD.building_id IS DISTINCT FROM NEW.building_id OR
            OLD.apartment_id IS DISTINCT FROM NEW.apartment_id OR
            OLD.apartment_number IS DISTINCT FROM NEW.apartment_number OR
            OLD.ownership_share_percent IS DISTINCT FROM NEW.ownership_share_percent) THEN
            RAISE EXCEPTION 'Forbidden: You cannot modify role, status, building_id, or apartment assignments directly.';
        END IF;

        -- Regular resident can ONLY modify full_name, push_token, and push_token_updated_at directly
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

    -- Admin updating member of their building directly
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

DROP TRIGGER IF EXISTS trg_check_user_update_permissions ON public.users;
CREATE TRIGGER trg_check_user_update_permissions
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_user_update_permissions();

-- ============================================================================
-- 3. Restrict issue_upvotes Direct Writes
-- ============================================================================
DROP POLICY IF EXISTS "upvotes_manage_policy" ON public.issue_upvotes;
REVOKE INSERT, UPDATE, DELETE ON public.issue_upvotes FROM PUBLIC, anon;

-- Ensure toggle_issue_upvote has internal bypass configured
CREATE OR REPLACE FUNCTION public.toggle_issue_upvote(
    p_issue_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user RECORD;
    v_issue RECORD;
    v_existing_id UUID;
    v_new_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, apartment_id, apartment_number, role, status
    INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.status <> 'active' THEN
        RAISE EXCEPTION 'User profile is not active.';
    END IF;

    SELECT * INTO v_issue
    FROM public.building_issues
    WHERE id = p_issue_id;

    IF v_issue IS NULL THEN
        RAISE EXCEPTION 'Issue not found.';
    END IF;

    IF v_issue.building_id <> v_user.building_id THEN
        RAISE EXCEPTION 'Issue belongs to a different building.';
    END IF;

    SELECT id INTO v_existing_id
    FROM public.issue_upvotes
    WHERE issue_id = p_issue_id
      AND (apartment_id = v_user.apartment_id OR (v_user.apartment_id IS NULL AND user_id = v_caller_id));

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    IF v_existing_id IS NOT NULL THEN
        DELETE FROM public.issue_upvotes WHERE id = v_existing_id;
        UPDATE public.building_issues
        SET upvotes_count = GREATEST(0, upvotes_count - 1),
            updated_at = now()
        WHERE id = p_issue_id
        RETURNING upvotes_count INTO v_new_count;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'removed',
            'upvoted', false,
            'upvotes_count', v_new_count
        );
    ELSE
        INSERT INTO public.issue_upvotes (
            issue_id,
            building_id,
            apartment_id,
            apartment_number,
            user_id
        ) VALUES (
            p_issue_id,
            v_user.building_id,
            v_user.apartment_id,
            COALESCE(v_user.apartment_number, '1'),
            v_caller_id
        );

        UPDATE public.building_issues
        SET upvotes_count = upvotes_count + 1,
            updated_at = now()
        WHERE id = p_issue_id
        RETURNING upvotes_count INTO v_new_count;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'added',
            'upvoted', true,
            'upvotes_count', v_new_count
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_issue_upvote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_issue_upvote(uuid) TO authenticated;

-- ============================================================================
-- 4. Restrict building_issues Direct Writes
-- ============================================================================
-- Direct UPDATE prohibited; status updates strictly managed via update_issue_status RPC
DROP POLICY IF EXISTS "issues_update_policy" ON public.building_issues;
REVOKE UPDATE ON public.building_issues FROM PUBLIC, anon;

-- Tighten direct INSERT to match user's verified unit and active state
DROP POLICY IF EXISTS "issues_insert_policy" ON public.building_issues;
CREATE POLICY "issues_insert_policy"
    ON public.building_issues
    FOR INSERT
    TO authenticated
    WITH CHECK (
        building_id = public.get_my_building_id()
        AND created_by = auth.uid()
        AND public.get_my_status() = 'active'
        AND status = 'open'
        AND upvotes_count = 0
        AND public.is_building_writable(building_id)
    );

-- ============================================================================
-- 5. Restrict payments Direct Writes & Enforce Partial Unique Indexes
-- ============================================================================
DROP POLICY IF EXISTS "payments_insert_resident" ON public.payments;
DROP POLICY IF EXISTS "payments_update_policy" ON public.payments;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM PUBLIC, anon;

-- Partial unique indexes preventing concurrent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_pending_monthly_dues
ON public.payments (building_id, apartment_id, billing_month)
WHERE status = 'pending' AND payment_category = 'monthly_dues';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_pending_emergency_claim
ON public.payments (building_id, apartment_id, emergency_claim_id)
WHERE status = 'pending' AND payment_category = 'emergency_claim';

-- ============================================================================
-- 6. Restrict expenses Direct Writes & Create/Enforce Atomic RPC
-- ============================================================================
DROP POLICY IF EXISTS "expenses_insert_admin" ON public.expenses;
REVOKE INSERT, UPDATE, DELETE ON public.expenses FROM PUBLIC, anon;

-- Strengthen record_building_expense with FOR UPDATE lock & negative balance prevention
CREATE OR REPLACE FUNCTION public.record_building_expense(
    p_title TEXT,
    p_amount NUMERIC(12, 2),
    p_category TEXT DEFAULT 'صيانة ومرافق',
    p_description TEXT DEFAULT NULL,
    p_expense_date DATE DEFAULT CURRENT_DATE,
    p_invoice_image_url TEXT DEFAULT NULL,
    p_invoice_number TEXT DEFAULT NULL,
    p_voucher_number TEXT DEFAULT NULL,
    p_allow_deficit BOOLEAN DEFAULT false
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
    v_expense_id UUID;
    v_new_balance NUMERIC(12, 2);
    v_date DATE;
BEGIN
    -- 1. Identify admin strictly via auth.uid()
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

    -- 2. Check building subscription writability
    IF NOT public.is_building_writable(v_admin.building_id) THEN
        RAISE EXCEPTION 'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك لإضافة مصروفات جديدة.';
    END IF;

    -- 3. Validate positive amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero.';
    END IF;

    IF p_title IS NULL OR trim(p_title) = '' THEN
        RAISE EXCEPTION 'Expense title is required.';
    END IF;

    -- 4. Lock building row FOR UPDATE to protect fund_balance atomicity
    SELECT * INTO v_building
    FROM public.buildings
    WHERE id = v_admin.building_id
    FOR UPDATE;

    -- Prevent negative fund_balance unless explicitly approved
    IF (v_building.fund_balance - p_amount) < 0 AND NOT COALESCE(p_allow_deficit, false) THEN
        RAISE EXCEPTION 'رصيد خزينة العمارة الحالي (% ج.م) لا يكفي لتغطية هذا المصروف (% ج.م).', v_building.fund_balance, p_amount;
    END IF;

    v_date := COALESCE(p_expense_date, CURRENT_DATE);

    PERFORM set_config('app.rpc_internal_bypass', 'true', true);

    -- 5. Insert expense record
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
        trim(p_description),
        COALESCE(p_category, 'صيانة ومرافق'),
        p_amount,
        v_date,
        to_char(v_date, 'YYYY-MM'),
        p_invoice_image_url,
        p_invoice_number,
        p_voucher_number,
        false
    )
    RETURNING id INTO v_expense_id;

    -- 6. Atomically deduct fund_balance
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

REVOKE EXECUTE ON FUNCTION public.record_building_expense(text, numeric, text, text, date, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_building_expense(text, numeric, text, text, date, text, text, text, boolean) TO authenticated;

-- Alias function create_expense matching common conventions
CREATE OR REPLACE FUNCTION public.create_expense(
    p_title TEXT,
    p_amount NUMERIC(12, 2),
    p_category TEXT DEFAULT 'صيانة ومرافق',
    p_description TEXT DEFAULT NULL,
    p_expense_date DATE DEFAULT CURRENT_DATE,
    p_invoice_image_url TEXT DEFAULT NULL,
    p_invoice_number TEXT DEFAULT NULL,
    p_voucher_number TEXT DEFAULT NULL,
    p_allow_deficit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.record_building_expense(
        p_title,
        p_amount,
        p_category,
        p_description,
        p_expense_date,
        p_invoice_image_url,
        p_invoice_number,
        p_voucher_number,
        p_allow_deficit
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_expense(text, numeric, text, text, date, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_expense(text, numeric, text, text, date, text, text, text, boolean) TO authenticated;

-- ============================================================================
-- 7. Restrict apartments Direct Writes & Prevent Duplicate Numbers
-- ============================================================================
DROP POLICY IF EXISTS "apartments_manage_admin" ON public.apartments;

-- Prevent duplicate apartment unit numbers within the same building
CREATE UNIQUE INDEX IF NOT EXISTS uq_apartments_building_unit 
ON public.apartments (building_id, trim(apartment_number));

-- Disciplined INSERT: Only active building admin within building limits
CREATE POLICY "apartments_insert_admin"
    ON public.apartments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND public.is_building_writable(building_id)
            AND trim(apartment_number) <> ''
        )
    );

-- Disciplined UPDATE: Only active building admin; cannot mutate building_id
CREATE POLICY "apartments_update_admin"
    ON public.apartments
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND public.is_building_writable(building_id)
        )
    )
    WITH CHECK (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND public.is_building_writable(building_id)
        )
    );

-- Disciplined DELETE: Only unassigned apartments with no active residents
CREATE POLICY "apartments_delete_admin"
    ON public.apartments
    FOR DELETE
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND public.is_building_writable(building_id)
            AND resident_id IS NULL
        )
    );
