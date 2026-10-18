-- ============================================================================
-- Migration: 004_rls_and_storage_policies.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Enables Row Level Security (RLS) across all tables and Storage
--              buckets, relying strictly on auth.uid() and role protection.
-- ============================================================================

-- ============================================================================
-- 1. Enable RLS on All Tables
-- ============================================================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_claim_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. RLS Policies: subscription_plans (قوالب الباقات العامة)
-- ============================================================================

DROP POLICY IF EXISTS "plans_select_authenticated" ON public.subscription_plans;
CREATE POLICY "plans_select_authenticated"
    ON public.subscription_plans
    FOR SELECT
    TO authenticated
    USING (is_active = true OR public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "plans_manage_super_admin" ON public.subscription_plans;
CREATE POLICY "plans_manage_super_admin"
    ON public.subscription_plans
    FOR ALL
    TO authenticated
    USING (public.get_my_role() = 'super_admin')
    WITH CHECK (public.get_my_role() = 'super_admin');

-- ============================================================================
-- 3. RLS Policies: users (حماية صارمة لعمود role وبيانات المستخدمين)
-- ============================================================================

-- قراءة بيانات المستخدمين (للسكان والمدير لمتابعة طلبات الانضمام والأعضاء)
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy"
    ON public.users
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- إنشاء المستخدم لحسابه الأولي فقط بصلاحية resident وحالة pending
DROP POLICY IF EXISTS "users_insert_self_only" ON public.users;
CREATE POLICY "users_insert_self_only"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        id = auth.uid()
        AND role = 'resident'
        AND status = 'pending'
    );

-- تحديث المستخدم لبياناته الأساسية فقط دون المساس بـ role (محمي أيضاً بـ Trigger)
DROP POLICY IF EXISTS "users_update_self_safe" ON public.users;
CREATE POLICY "users_update_self_safe"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = public.get_my_role()
    );

-- السماح لمدير العمارة بتحديث حالة السكان في عمارته، وللـ super_admin بإدارة الجميع
DROP POLICY IF EXISTS "users_update_admin_and_super_admin" ON public.users;
CREATE POLICY "users_update_admin_and_super_admin"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND building_id = public.get_my_building_id()
            AND role = 'resident'
        )
    )
    WITH CHECK (
        public.get_my_role() = 'super_admin'
        OR (
            public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND building_id = public.get_my_building_id()
            AND role = 'resident'
            AND public.is_building_writable(building_id)
        )
    );

-- ============================================================================
-- 4. RLS Policies: buildings (العمارات وإعدادات التسعير والمميزات)
-- ============================================================================

DROP POLICY IF EXISTS "buildings_select_policy" ON public.buildings;
CREATE POLICY "buildings_select_policy"
    ON public.buildings
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- تحديث بيانات العمارة العامة من قِبل المدير (إذا لم ينتهِ الاشتراك) أو كافة الحقول من قِبل super_admin
DROP POLICY IF EXISTS "buildings_update_policy" ON public.buildings;
CREATE POLICY "buildings_update_policy"
    ON public.buildings
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            admin_id = auth.uid()
            AND public.get_my_role() = 'admin'
            AND public.is_building_writable(id)
        )
    )
    WITH CHECK (
        public.get_my_role() = 'super_admin'
        OR (
            admin_id = auth.uid()
            AND public.get_my_role() = 'admin'
            AND public.is_building_writable(id)
        )
    );

-- ============================================================================
-- 5. RLS Policies: apartments (الوحدات السكنية)
-- ============================================================================

DROP POLICY IF EXISTS "apartments_select_policy" ON public.apartments;
CREATE POLICY "apartments_select_policy"
    ON public.apartments
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "apartments_manage_admin" ON public.apartments;
CREATE POLICY "apartments_manage_admin"
    ON public.apartments
    FOR ALL
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

-- ============================================================================
-- 6. RLS Policies: payments (مدفوعات الاشتراكات والمطالبات)
-- ============================================================================

-- يرى الساكن مدفوعاته ويرى مدير العمارة كافة مدفوعات عمارته
DROP POLICY IF EXISTS "payments_select_policy" ON public.payments;
CREATE POLICY "payments_select_policy"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR resident_id = auth.uid()
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
        )
    );

-- الساكن ينشئ طلب سداد بحالة pending حصرياً وباسمه عبر auth.uid()
DROP POLICY IF EXISTS "payments_insert_resident" ON public.payments;
CREATE POLICY "payments_insert_resident"
    ON public.payments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        resident_id = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_status() = 'active'
        AND status = 'pending'
        AND reviewed_by IS NULL
    );

-- ============================================================================
-- 7. RLS Policies: emergency_claims & emergency_claim_shares (المطالبات الطارئة)
-- ============================================================================

DROP POLICY IF EXISTS "emergency_claims_select" ON public.emergency_claims;
CREATE POLICY "emergency_claims_select"
    ON public.emergency_claims
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_status() = 'active'
        )
    );

DROP POLICY IF EXISTS "emergency_claims_manage_admin" ON public.emergency_claims;
CREATE POLICY "emergency_claims_manage_admin"
    ON public.emergency_claims
    FOR ALL
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
            AND created_by = auth.uid()
            AND public.get_my_role() = 'admin'
            AND public.get_my_status() = 'active'
            AND public.is_building_writable(building_id)
        )
    );

DROP POLICY IF EXISTS "emergency_claim_shares_select" ON public.emergency_claim_shares;
CREATE POLICY "emergency_claim_shares_select"
    ON public.emergency_claim_shares
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_status() = 'active'
        )
    );

-- ============================================================================
-- 8. RLS Policies: expenses (الشفافية والمصروفات - Read-Only للسكان)
-- ============================================================================

-- جميع سكان العمارة المفعلين ومديرها يقرؤون المصروفات وصور الفواتير بشفافية كاملة
DROP POLICY IF EXISTS "expenses_select_building_members" ON public.expenses;
CREATE POLICY "expenses_select_building_members"
    ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_status() = 'active'
        )
    );

-- الإضافة متاحة فقط لمدير العمارة عبر دالة RPC أو طالما الاشتراك ساري (غير Read-Only)
DROP POLICY IF EXISTS "expenses_insert_admin" ON public.expenses;
CREATE POLICY "expenses_insert_admin"
    ON public.expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_role() = 'admin'
        AND public.get_my_status() = 'active'
        AND public.is_building_writable(building_id)
    );

-- ============================================================================
-- 9. RLS Policies: app_subscription_invoices (فواتير اشتراك التطبيق)
-- ============================================================================

DROP POLICY IF EXISTS "app_sub_invoices_select" ON public.app_subscription_invoices;
CREATE POLICY "app_sub_invoices_select"
    ON public.app_subscription_invoices
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_role() = 'admin'
        )
    );

DROP POLICY IF EXISTS "app_sub_invoices_insert_admin" ON public.app_subscription_invoices;
CREATE POLICY "app_sub_invoices_insert_admin"
    ON public.app_subscription_invoices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        submitted_by = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_role() = 'admin'
        AND status = 'pending'
        AND activated_by IS NULL
    );

-- ============================================================================
-- 10. RLS Policies: Supporting Tables (Tickets, Polls, Documents, Notifications)
-- ============================================================================

DROP POLICY IF EXISTS "tickets_select_building" ON public.maintenance_tickets;
CREATE POLICY "tickets_select_building"
    ON public.maintenance_tickets
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (building_id = public.get_my_building_id() AND public.get_my_status() = 'active')
    );

DROP POLICY IF EXISTS "tickets_insert_member" ON public.maintenance_tickets;
CREATE POLICY "tickets_insert_member"
    ON public.maintenance_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reported_by = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_status() = 'active'
    );

DROP POLICY IF EXISTS "tickets_update_admin" ON public.maintenance_tickets;
CREATE POLICY "tickets_update_admin"
    ON public.maintenance_tickets
    FOR UPDATE
    TO authenticated
    USING (
        building_id = public.get_my_building_id()
        AND public.get_my_role() = 'admin'
        AND public.is_building_writable(building_id)
    );

DROP POLICY IF EXISTS "polls_select_building" ON public.polls;
CREATE POLICY "polls_select_building"
    ON public.polls
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (building_id = public.get_my_building_id() AND public.get_my_status() = 'active')
    );

DROP POLICY IF EXISTS "polls_manage_admin" ON public.polls;
CREATE POLICY "polls_manage_admin"
    ON public.polls
    FOR ALL
    TO authenticated
    USING (
        building_id = public.get_my_building_id()
        AND public.get_my_role() = 'admin'
        AND public.is_building_writable(building_id)
    )
    WITH CHECK (
        building_id = public.get_my_building_id()
        AND created_by = auth.uid()
        AND public.get_my_role() = 'admin'
        AND public.is_building_writable(building_id)
    );

DROP POLICY IF EXISTS "poll_votes_select_building" ON public.poll_votes;
CREATE POLICY "poll_votes_select_building"
    ON public.poll_votes
    FOR SELECT
    TO authenticated
    USING (
        building_id = public.get_my_building_id()
        AND public.get_my_status() = 'active'
    );

DROP POLICY IF EXISTS "poll_votes_insert_resident" ON public.poll_votes;
CREATE POLICY "poll_votes_insert_resident"
    ON public.poll_votes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        voter_id = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_status() = 'active'
    );

DROP POLICY IF EXISTS "documents_select_building" ON public.building_documents;
CREATE POLICY "documents_select_building"
    ON public.building_documents
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (building_id = public.get_my_building_id() AND public.get_my_status() = 'active')
    );

DROP POLICY IF EXISTS "documents_insert_admin" ON public.building_documents;
CREATE POLICY "documents_insert_admin"
    ON public.building_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND building_id = public.get_my_building_id()
        AND public.get_my_role() = 'admin'
        AND public.is_building_writable(building_id)
    );

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy"
    ON public.notifications
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
    ON public.notifications
    FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 10.5 RLS Policies: apartment_obligations (الالتزامات والمديونيات المسجلة على الشقة)
-- ============================================================================

ALTER TABLE public.apartment_obligations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apartment_obligations_select" ON public.apartment_obligations;
CREATE POLICY "apartment_obligations_select"
    ON public.apartment_obligations
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() = 'super_admin'
        OR (
            building_id = public.get_my_building_id()
            AND public.get_my_status() = 'active'
        )
    );

DROP POLICY IF EXISTS "apartment_obligations_manage_admin" ON public.apartment_obligations;
CREATE POLICY "apartment_obligations_manage_admin"
    ON public.apartment_obligations
    FOR ALL
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

-- ============================================================================
-- 11. Supabase Storage Buckets & Policies (صور الإيصالات والفواتير والوثائق)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('payment-receipts', 'payment-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('expense-invoices', 'expense-invoices', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('subscription-receipts', 'subscription-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('building-documents', 'building-documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage Select Policy: Authenticated users can view files belonging to their building folder
DROP POLICY IF EXISTS "storage_building_members_select" ON storage.objects;
CREATE POLICY "storage_building_members_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id IN ('payment-receipts', 'expense-invoices', 'subscription-receipts', 'building-documents')
        AND (
            public.get_my_role() = 'super_admin'
            OR (storage.foldername(name))[1] = public.get_my_building_id()::text
        )
    );

-- Storage Insert Policy: Residents upload payment receipts; Admins upload expense/subscription/building docs
DROP POLICY IF EXISTS "storage_authenticated_upload" ON storage.objects;
CREATE POLICY "storage_authenticated_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (storage.foldername(name))[1] = public.get_my_building_id()::text
        AND public.get_my_status() = 'active'
        AND (
            (bucket_id = 'payment-receipts')
            OR (
                bucket_id IN ('expense-invoices', 'subscription-receipts', 'building-documents')
                AND public.get_my_role() = 'admin'
            )
        )
    );

-- ============================================================================
-- 12. Enable Supabase Realtime Publication for Live Cross-Device Sync
-- ============================================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.apartments REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_claims REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
        public.notifications,
        public.users,
        public.payments,
        public.apartments,
        public.expenses,
        public.emergency_claims;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
    WHEN undefined_object THEN
        CREATE PUBLICATION supabase_realtime FOR TABLE 
            public.notifications,
            public.users,
            public.payments,
            public.apartments,
            public.expenses,
            public.emergency_claims;
END;
$$;
