-- ============================================================================
-- Migration: 001_enums_and_core_tables.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Creates extensions, custom ENUM types, and core structural tables:
--              subscription_plans, buildings, apartments, and users.
-- ============================================================================

-- Enable cryptographic functions for UUIDs and random code generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Custom ENUM Types
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'resident', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'plus');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.building_subscription_status AS ENUM ('trial', 'active', 'expired', 'read_only');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method_type AS ENUM ('electronic_transfer', 'cash');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.cash_recipient_type AS ENUM ('admin', 'guard');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending', 'paid', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_category_type AS ENUM ('monthly_dues', 'emergency_claim');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.claim_distribution_type AS ENUM ('equal', 'custom');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.claim_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.invoice_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.poll_status AS ENUM ('active', 'closed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Table: subscription_plans (قوالب الباقات العامة - تُدار بواسطة super_admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    code public.plan_tier PRIMARY KEY,
    name_ar TEXT NOT NULL,
    description_ar TEXT,
    default_monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (default_monthly_price >= 0),
    max_apartments INTEGER NOT NULL DEFAULT 20 CHECK (max_apartments > 0),
    default_features_config JSONB NOT NULL DEFAULT '{
        "receipt_upload": true,
        "emergency_claims": true,
        "export_reports": true,
        "voting": true,
        "maintenance_tickets": true,
        "documents_archive": true
    }'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_plans IS 'قوالب الباقات العامة (free, pro, plus) التي يديرها مالك التطبيق (super_admin)';

-- ============================================================================
-- 3. Table: buildings (العمارات والأبراج السكنية)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'القاهرة',
    registration_number TEXT, -- مثال: قيد اتحاد الشاغلين رقم 142 لسنة 2023
    building_code TEXT NOT NULL UNIQUE, -- كود المبنى الفريد لانضمام السكان
    admin_id UUID, -- يُربط بجدول users في ملف 003
    fund_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- رصيد الصندوق الحالي (الخزينة)
    default_monthly_dues NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (default_monthly_dues >= 0),
    total_apartments INTEGER NOT NULL DEFAULT 16 CHECK (total_apartments > 0),
    
    -- إعدادات الاشتراك والتسعير المرن ومفاتيح المميزات (Feature Flags & Custom Overrides)
    plan_code public.plan_tier NOT NULL DEFAULT 'pro' REFERENCES public.subscription_plans(code),
    subscription_status public.building_subscription_status NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
    subscription_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 days'),
    custom_monthly_price NUMERIC(12, 2) CHECK (custom_monthly_price IS NULL OR custom_monthly_price >= 0),
    max_apartments_override INTEGER CHECK (max_apartments_override IS NULL OR max_apartments_override > 0),
    features_config JSONB NOT NULL DEFAULT '{
        "receipt_upload": true,
        "emergency_claims": true,
        "export_reports": true,
        "voting": true,
        "maintenance_tickets": true,
        "documents_archive": true
    }'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.buildings IS 'بيانات العمارات السكنية، رصيد الخزينة، وإعدادات الباقة المخصصة ومفاتيح المميزات لكل عمارة';

-- ============================================================================
-- 4. Table: apartments (الوحدات السكنية داخل كل عمارة)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.apartments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    apartment_number TEXT NOT NULL,
    floor_number TEXT,
    wing_or_direction TEXT, -- مثال: واجهة / المدخل الرئيسي
    area_sqm NUMERIC(8, 2) CHECK (area_sqm IS NULL OR area_sqm > 0),
    ownership_share_percent NUMERIC(5, 2) NOT NULL DEFAULT 6.25 CHECK (ownership_share_percent >= 0 AND ownership_share_percent <= 100),
    monthly_dues_override NUMERIC(12, 2) CHECK (monthly_dues_override IS NULL OR monthly_dues_override >= 0),
    occupant_name TEXT, -- الاسم المبدئي المسجل مسبقاً بواسطة المدير قبل انضمام الساكن
    occupant_phone TEXT, -- رقم الهاتف المسجل مسبقاً للمطابقة التلقائية عند انضمام الساكن
    arrears_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- إجمالي المتأخرات/الالتزامات المسجلة على الشقة
    resident_id UUID, -- يُربط بجدول users في ملف 003
    invite_code TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_building_apartment_number UNIQUE (building_id, apartment_number)
);

COMMENT ON TABLE public.apartments IS 'الوحدات السكنية (الشقق) داخل كل عمارة مع الاسم/الهاتف المبدئي (occupant_name, occupant_phone) والمتأخرات المسجلة عليها';

-- ============================================================================
-- 5. Table: users (المستخدمون: admin, resident, super_admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role public.user_role NOT NULL DEFAULT 'resident',
    status public.account_status NOT NULL DEFAULT 'pending',
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
    apartment_number TEXT,
    floor_number TEXT,
    residency_type TEXT NOT NULL DEFAULT 'owner_resident', -- owner_resident, tenant, non_resident_owner
    ownership_share_percent NUMERIC(5, 2) DEFAULT 6.25,
    avatar_url TEXT,
    push_token TEXT,
    push_token_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'ملفات المستخدمين المرتبطة بـ Supabase Auth مع حماية صارمة لعمود الصلاحية (role) وحفظ الـ push_token للإشعارات الفورية';
