-- ============================================================================
-- Migration: 007_community_hub_issues_and_polls.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Creates building_issues and issue_upvotes tables, updates polls
--              and poll_votes, creates storage bucket for issue attachments,
--              enables RLS policies, realtime publication, and secure RPCs:
--              1. create_building_issue
--              2. toggle_issue_upvote (1 upvote per apartment unit)
--              3. update_issue_status (admin only)
--              4. create_building_poll (admin only)
--              5. cast_poll_vote (1 vote per apartment unit)
-- ============================================================================

-- ============================================================================
-- 1. Table: building_issues (البلاغات والشكاوى العامة والخاصة ومتابعة الصيانة)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.building_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    apartment_number TEXT,
    reporter_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'المصعد',
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    image_url TEXT,
    is_private BOOLEAN NOT NULL DEFAULT false,
    upvotes_count INTEGER NOT NULL DEFAULT 0 CHECK (upvotes_count >= 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    preferred_time TEXT DEFAULT 'any',
    whatsapp_notifications BOOLEAN NOT NULL DEFAULT true,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.building_issues IS 'سجل بلاغات وشكاوى السكان (عامة وخاصة) مع توثيق الصور ونظام الدعم والتأييد وتحديث الحالة';

-- ============================================================================
-- 2. Table: issue_upvotes (تأييد ودعم البلاغات العامة - صوت واحد لكل شقة)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.issue_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.building_issues(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE,
    apartment_number TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_issue_apartment_upvote UNIQUE (issue_id, apartment_id)
);

COMMENT ON TABLE public.issue_upvotes IS 'سجل تأييد السكان للبلاغات العامة - مقيد بصوت تأييد واحد فقط لكل وحدة سكنية لمنع التكرار';

-- ============================================================================
-- 3. Enhance Tables: polls & poll_votes (التصويت وقرارات الجمعية العمومية)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    session_code TEXT,
    title TEXT NOT NULL,
    description TEXT,
    quorum_percent NUMERIC(5, 2) NOT NULL DEFAULT 51.00,
    voting_basis TEXT NOT NULL DEFAULT 'ownership_share',
    ends_at TIMESTAMPTZ NOT NULL,
    status public.poll_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'عام';
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS share_per_unit NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[{"id":"approve","title":"موافق على القرار"},{"id":"reject","title":"رافض أو متحفظ"},{"id":"abstain","title":"ممتنع عن التصويت"}]'::jsonb;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS votes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    choice TEXT NOT NULL,
    weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 6.25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_poll_apartment_vote UNIQUE (poll_id, apartment_id)
);

ALTER TABLE public.poll_votes ADD COLUMN IF NOT EXISTS apartment_number TEXT;
ALTER TABLE public.poll_votes ADD COLUMN IF NOT EXISTS voter_name TEXT;

-- Drop strict choice check if existed previously so custom option IDs (a, b, c, approve, reject...) work cleanly
DO $$
BEGIN
    ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_choice_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Storage Bucket: issue-attachments (صور وفيديوهات توثيق البلاغات)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'issue-attachments',
    'issue-attachments',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for issue-attachments
DROP POLICY IF EXISTS "storage_issue_attachments_select" ON storage.objects;
CREATE POLICY "storage_issue_attachments_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'issue-attachments'
        AND (
            public.get_my_role() = 'super_admin'
            OR (storage.foldername(name))[1] = public.get_my_building_id()::text
        )
    );

DROP POLICY IF EXISTS "storage_issue_attachments_insert" ON storage.objects;
CREATE POLICY "storage_issue_attachments_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'issue-attachments'
        AND (storage.foldername(name))[1] = public.get_my_building_id()::text
        AND public.get_my_status() = 'active'
    );

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.building_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- building_issues Policies
DROP POLICY IF EXISTS "issues_select_policy" ON public.building_issues;
CREATE POLICY "issues_select_policy"
    ON public.building_issues
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND (
                -- Admin sees everything
                public.get_my_role() = 'admin'
                -- Residents see public issues or their own private issues
                OR is_private = false
                OR created_by = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "issues_insert_policy" ON public.building_issues;
CREATE POLICY "issues_insert_policy"
    ON public.building_issues
    FOR INSERT
    TO authenticated
    WITH CHECK (
        building_id = public.get_my_building_id()
        AND created_by = auth.uid()
        AND public.get_my_status() = 'active'
        AND public.is_building_writable(building_id)
    );

DROP POLICY IF EXISTS "issues_update_policy" ON public.building_issues;
CREATE POLICY "issues_update_policy"
    ON public.building_issues
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND (
                public.get_my_role() = 'admin'
                OR (created_by = auth.uid() AND status = 'open')
            )
        )
    );

-- issue_upvotes Policies
DROP POLICY IF EXISTS "upvotes_select_policy" ON public.issue_upvotes;
CREATE POLICY "upvotes_select_policy"
    ON public.issue_upvotes
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR building_id = public.get_my_building_id()
    );

DROP POLICY IF EXISTS "upvotes_manage_policy" ON public.issue_upvotes;
CREATE POLICY "upvotes_manage_policy"
    ON public.issue_upvotes
    FOR ALL
    TO authenticated
    USING (
        building_id = public.get_my_building_id()
        AND user_id = auth.uid()
        AND public.get_my_status() = 'active'
    )
    WITH CHECK (
        building_id = public.get_my_building_id()
        AND user_id = auth.uid()
        AND public.get_my_status() = 'active'
    );

-- polls Policies
DROP POLICY IF EXISTS "polls_select_policy" ON public.polls;
CREATE POLICY "polls_select_policy"
    ON public.polls
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR building_id = public.get_my_building_id()
    );

DROP POLICY IF EXISTS "polls_manage_admin" ON public.polls;
CREATE POLICY "polls_manage_admin"
    ON public.polls
    FOR ALL
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
        )
    )
    WITH CHECK (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
        )
    );

-- poll_votes Policies
DROP POLICY IF EXISTS "votes_select_policy" ON public.poll_votes;
CREATE POLICY "votes_select_policy"
    ON public.poll_votes
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR building_id = public.get_my_building_id()
    );

DROP POLICY IF EXISTS "votes_insert_manage_policy" ON public.poll_votes;
CREATE POLICY "votes_insert_manage_policy"
    ON public.poll_votes
    FOR ALL
    TO authenticated
    USING (
        building_id = public.get_my_building_id()
        AND voter_id = auth.uid()
        AND public.get_my_status() = 'active'
    )
    WITH CHECK (
        building_id = public.get_my_building_id()
        AND voter_id = auth.uid()
        AND public.get_my_status() = 'active'
    );

-- ============================================================================
-- 6. Realtime Publication
-- ============================================================================

ALTER TABLE public.building_issues REPLICA IDENTITY FULL;
ALTER TABLE public.issue_upvotes REPLICA IDENTITY FULL;
ALTER TABLE public.polls REPLICA IDENTITY FULL;
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
        public.building_issues,
        public.issue_upvotes,
        public.polls,
        public.poll_votes;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END;
$$;

-- ============================================================================
-- 7. Secure RPC Functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: create_building_issue
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_building_issue(
    p_building_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'المصعد',
    p_severity TEXT DEFAULT 'medium',
    p_image_url TEXT DEFAULT NULL,
    p_is_private BOOLEAN DEFAULT false,
    p_preferred_time TEXT DEFAULT 'any',
    p_whatsapp_notifications BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user RECORD;
    v_issue_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, apartment_id, apartment_number, full_name, role, status
    INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.status <> 'active' THEN
        RAISE EXCEPTION 'User profile is not active.';
    END IF;

    IF v_user.building_id <> p_building_id THEN
        RAISE EXCEPTION 'User does not belong to this building.';
    END IF;

    INSERT INTO public.building_issues (
        building_id,
        created_by,
        apartment_id,
        apartment_number,
        reporter_name,
        title,
        description,
        category,
        severity,
        image_url,
        is_private,
        preferred_time,
        whatsapp_notifications,
        status
    ) VALUES (
        p_building_id,
        v_caller_id,
        v_user.apartment_id,
        COALESCE(v_user.apartment_number, '1'),
        COALESCE(v_user.full_name, 'ساكن'),
        trim(p_title),
        trim(p_description),
        COALESCE(p_category, 'المصعد'),
        COALESCE(p_severity, 'medium'),
        p_image_url,
        COALESCE(p_is_private, false),
        COALESCE(p_preferred_time, 'any'),
        COALESCE(p_whatsapp_notifications, true),
        'open'
    )
    RETURNING id INTO v_issue_id;

    -- Send notification to building admin
    INSERT INTO public.notifications (
        building_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    )
    SELECT
        p_building_id,
        'admin',
        'بلاغ صيانة جديد (شقة ' || COALESCE(v_user.apartment_number, '-') || ') 🛠️',
        'تم تقديم بلاغ جديد بعنوان: "' || trim(p_title) || '" في قسم (' || COALESCE(p_category, 'عام') || ').',
        'maintenance',
        jsonb_build_object(
            'issue_id', v_issue_id,
            'apartment_number', v_user.apartment_number,
            'severity', p_severity
        );

    RETURN jsonb_build_object(
        'success', true,
        'issue_id', v_issue_id,
        'title', trim(p_title)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 2: toggle_issue_upvote (صوت تأييد واحد لكل شقة سكنية)
-- ----------------------------------------------------------------------------
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
    v_apt_id UUID;
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

    -- Fallback apartment_id if null
    v_apt_id := COALESCE(v_user.apartment_id, v_caller_id);

    -- Check if this apartment already upvoted
    SELECT id INTO v_existing_id
    FROM public.issue_upvotes
    WHERE issue_id = p_issue_id
      AND (apartment_id = v_user.apartment_id OR (v_user.apartment_id IS NULL AND user_id = v_caller_id));

    IF v_existing_id IS NOT NULL THEN
        -- Remove upvote
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
        -- Add upvote
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

-- ----------------------------------------------------------------------------
-- RPC 3: update_issue_status (المدير يغير الحالة: open, in_progress, resolved)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_issue_status(
    p_issue_id UUID,
    p_status TEXT
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
    v_status_ar TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, role, status INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.role <> 'admin' THEN
        RAISE EXCEPTION 'Only building admin can update issue status.';
    END IF;

    IF p_status NOT IN ('open', 'in_progress', 'resolved') THEN
        RAISE EXCEPTION 'Invalid status. Must be open, in_progress, or resolved.';
    END IF;

    UPDATE public.building_issues
    SET status = p_status,
        resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_issue_id AND building_id = v_user.building_id
    RETURNING * INTO v_issue;

    IF v_issue IS NULL THEN
        RAISE EXCEPTION 'Issue not found in your building.';
    END IF;

    v_status_ar := CASE p_status
        WHEN 'in_progress' THEN 'جاري التنفيذ والمتابعة ⏳'
        WHEN 'resolved' THEN 'تم الإصلاح والحل بنجاح ✅'
        ELSE 'مفتوح للمتابعة 🟢'
    END;

    -- Send notification to the reporter resident
    IF v_issue.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (
            building_id,
            recipient_id,
            title,
            body,
            category,
            metadata
        ) VALUES (
            v_issue.building_id,
            v_issue.created_by,
            'تحديث بخصوص بلاغك 🛠️',
            'تم تحديث حالة بلاغك ("' || v_issue.title || '") إلى: ' || v_status_ar,
            'maintenance',
            jsonb_build_object('issue_id', v_issue.id, 'status', p_status)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'issue_id', v_issue.id,
        'status', p_status,
        'status_ar', v_status_ar
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 4: create_building_poll (المدير يطرح قراراً وتصويتاً للجمعية العمومية)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_building_poll(
    p_building_id UUID,
    p_title TEXT,
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
    v_user RECORD;
    v_poll_id UUID;
    v_session_code TEXT;
    v_options JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, role, status INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.role <> 'admin' THEN
        RAISE EXCEPTION 'Only building admin can create polls.';
    END IF;

    v_session_code := '#' || to_char(CURRENT_DATE, 'YY') || '-DEC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    IF p_options IS NULL OR jsonb_array_length(p_options) = 0 THEN
        v_options := '[{"id":"approve","title":"موافق على القرار"},{"id":"reject","title":"رافض أو متحفظ"},{"id":"abstain","title":"ممتنع عن التصويت"}]'::jsonb;
    ELSE
        v_options := p_options;
    END IF;

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
        p_building_id,
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

    -- Broadcast notification to all active residents in building
    INSERT INTO public.notifications (
        building_id,
        recipient_role,
        title,
        body,
        category,
        metadata
    )
    VALUES (
        p_building_id,
        'resident',
        'تصويت وقرار جديد بانتظار مشاركتك 🗳️',
        'طرحت إدارة العمارة قراراً جديداً للتصويت: "' || trim(p_title) || '". صوتك يمثل شقتك ويوثق قانونياً.',
        'voting',
        jsonb_build_object('poll_id', v_poll_id, 'session_code', v_session_code)
    );

    RETURN jsonb_build_object(
        'success', true,
        'poll_id', v_poll_id,
        'session_code', v_session_code
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 5: cast_poll_vote (تسجيل صوت موثق بصوت واحد لكل شقة)
-- ----------------------------------------------------------------------------
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
    v_total_apts INTEGER;
    v_weight NUMERIC(5, 2);
    v_votes_count INTEGER;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    SELECT id, building_id, apartment_id, apartment_number, full_name, role, status
    INTO v_user
    FROM public.users
    WHERE id = v_caller_id;

    IF v_user IS NULL OR v_user.status <> 'active' THEN
        RAISE EXCEPTION 'User profile is not active.';
    END IF;

    SELECT * INTO v_poll
    FROM public.polls
    WHERE id = p_poll_id;

    IF v_poll IS NULL THEN
        RAISE EXCEPTION 'Poll not found.';
    END IF;

    IF v_poll.status <> 'active' THEN
        RAISE EXCEPTION 'This poll is no longer active.';
    END IF;

    IF v_poll.ends_at < now() THEN
        RAISE EXCEPTION 'Voting deadline has ended.';
    END IF;

    IF v_poll.building_id <> v_user.building_id THEN
        RAISE EXCEPTION 'Poll belongs to a different building.';
    END IF;

    -- Calculate unit weight based on total building apartments
    SELECT total_apartments INTO v_total_apts
    FROM public.buildings
    WHERE id = v_user.building_id;

    v_weight := ROUND(100.0 / GREATEST(COALESCE(v_total_apts, 16), 1), 2);

    -- Upsert vote strictly 1 vote per apartment
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
        created_at = now();

    -- Update total votes count on poll
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
        'votes_count', v_votes_count
    );
END;
$$;
