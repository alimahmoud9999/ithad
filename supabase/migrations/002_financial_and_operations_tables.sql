-- ============================================================================
-- Migration: 002_financial_and_operations_tables.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Creates financial and operational tables:
--              emergency_claims, emergency_claim_shares, payments, expenses,
--              app_subscription_invoices, maintenance_tickets, polls, poll_votes,
--              building_documents, and notifications.
-- ============================================================================

-- ============================================================================
-- 1. Table: emergency_claims (نظام المطالبات الطارئة وشريط التقدم الحي)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emergency_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL, -- مثال: تغيير طلمبة المياه
    description TEXT,
    category TEXT NOT NULL DEFAULT 'مياه وسباكة', -- مياه وسباكة، مصاعد كهربائية، أمن وحراسة، إلخ
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    collected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (collected_amount >= 0),
    distribution_type public.claim_distribution_type NOT NULL DEFAULT 'equal', -- equal أو custom
    default_share_amount NUMERIC(12, 2) CHECK (default_share_amount IS NULL OR default_share_amount >= 0),
    due_date DATE,
    status public.claim_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.emergency_claims IS 'المطالبات المالية الطارئة مع تتبع المبلغ المحصل وشريط التقدم وطريقة التوزيع (بالتساوي أو مخصص)';

-- ============================================================================
-- 2. Table: emergency_claim_shares (توزيع أنصبة المطالبة الطارئة على الشقق)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emergency_claim_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.emergency_claims(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_amount NUMERIC(12, 2) NOT NULL CHECK (assigned_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    status public.payment_status NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_claim_apartment_share UNIQUE (claim_id, apartment_id)
);

COMMENT ON TABLE public.emergency_claim_shares IS 'أنصبة الوحدات السكنية من كل مطالبة طارئة سواء بالتساوي أو بمبالغ مخصصة';

-- ============================================================================
-- 3. Table: payments (مدفوعات السكان: اشتراكات شهرية ومطالبات طارئة)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    resident_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    payment_category public.payment_category_type NOT NULL DEFAULT 'monthly_dues',
    emergency_claim_id UUID REFERENCES public.emergency_claims(id) ON DELETE SET NULL,
    billing_month TEXT NOT NULL, -- بصيغة YYYY-MM مثل '2024-11'
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method public.payment_method_type NOT NULL, -- electronic_transfer أو cash
    cash_recipient public.cash_recipient_type, -- admin (رئيس الاتحاد) أو guard (حارس العمارة) عند الدفع كاش
    receipt_image_url TEXT, -- رابط صورة إيصال التحويل الإلكتروني (InstaPay / تحويل بنكي)
    reference_number TEXT,
    notes TEXT,
    status public.payment_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- يُسجل حصرياً عبر auth.uid()
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payment_method_details CHECK (
        (payment_method = 'cash' AND cash_recipient IS NOT NULL)
        OR
        (payment_method = 'electronic_transfer')
    )
);

COMMENT ON TABLE public.payments IS 'سجل مدفوعات السكان (تحويل إلكتروني مع إيصال أو كاش للمدير/الحارس) وحالات اعتمادها';

-- ============================================================================
-- 4. Table: app_subscription_invoices (فواتير اشتراك العمارة في التطبيق)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    plan_code public.plan_tier NOT NULL REFERENCES public.subscription_plans(code),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    duration_months INTEGER NOT NULL DEFAULT 1 CHECK (duration_months > 0 AND duration_months <= 36),
    receipt_image_url TEXT NOT NULL,
    notes TEXT,
    status public.invoice_review_status NOT NULL DEFAULT 'pending',
    activated_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- يُسجل حصرياً عبر auth.uid() للـ super_admin
    activated_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_subscription_invoices IS 'طلبات تفعيل وتجديد اشتراك العمارة المرفوعة من رئيس الاتحاد ليعتمدها الـ super_admin';

-- ============================================================================
-- 5. Table: expenses (لوحة المصروفات والشفافية وسندات الصرف)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL, -- مثال: راتب الحارس، صيانة المصعد الدوري، رسوم اشتراك تطبيق إدارة العقار
    description TEXT,
    category TEXT NOT NULL DEFAULT 'صيانة ومرافق',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expense_month TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    invoice_image_url TEXT, -- صورة الفاتورة / الإيصال الورقي للشفافية أمام السكان
    invoice_number TEXT, -- مثال: #INV-4921
    voucher_number TEXT, -- مثال: PC-2024-884
    is_system_generated BOOLEAN NOT NULL DEFAULT false, -- true عند الإدراج التلقائي لرسوم اشتراك التطبيق
    app_subscription_invoice_id UUID UNIQUE REFERENCES public.app_subscription_invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expenses IS 'سجل مصروفات العمارة وصور الفواتير المتاح للعرض بشفافية كاملة أمام جميع سكان العمارة';

-- ============================================================================
-- 6. Supporting Tables (البلاغات، التصويت، الوثائق، والتنبيهات من شاشات التصميم)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'عام',
    priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
    image_url TEXT,
    status public.ticket_status NOT NULL DEFAULT 'open',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    session_code TEXT, -- مثال: #24-ORD-08
    title TEXT NOT NULL,
    description TEXT,
    quorum_percent NUMERIC(5, 2) NOT NULL DEFAULT 51.00,
    voting_basis TEXT NOT NULL DEFAULT 'ownership_share', -- ownership_share أو one_vote_per_unit
    ends_at TIMESTAMPTZ NOT NULL,
    status public.poll_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    choice TEXT NOT NULL CHECK (choice IN ('approve', 'reject', 'abstain')),
    weight_percent NUMERIC(5, 2) NOT NULL DEFAULT 6.25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_poll_apartment_vote UNIQUE (poll_id, apartment_id)
);

CREATE TABLE IF NOT EXISTS public.building_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'اللائحة والعقود',
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    is_official BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general', -- financial, voting, maintenance, general
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. Table: apartment_obligations (الالتزامات والمديونيات المسجلة على الشقة)
--    يدعم تسجيل المتأخرات قبل انضمام الساكن، ونقلها بين الشقق عبر
--    دالة transfer_apartment_obligations دون الحاجة لحذفها وإعادة كتابتها.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.apartment_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_id UUID NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category public.payment_category_type NOT NULL DEFAULT 'monthly_dues',
    billing_month TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status public.payment_status NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    transferred_from_apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    transferred_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apartment_obligations IS 'سجل الالتزامات والمتأخرات المقيدة على كل شقة مع دعم النقل الآمن بين الشقق (transfer_apartment_obligations)';

