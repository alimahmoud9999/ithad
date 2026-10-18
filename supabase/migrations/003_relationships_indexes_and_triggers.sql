-- ============================================================================
-- Migration: 003_relationships_indexes_and_triggers.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Adds deferred foreign keys, performance indexes, security helper
--              functions relying on auth.uid(), and protective triggers
--              (Role Protection & Read-Only Subscription Enforcement).
-- ============================================================================

-- ============================================================================
-- 1. Deferred Cross-Table Foreign Key Constraints
-- ============================================================================

DO $$ BEGIN
    ALTER TABLE public.buildings
        ADD CONSTRAINT fk_buildings_admin_user
        FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.apartments
        ADD CONSTRAINT fk_apartments_resident_user
        FOREIGN KEY (resident_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Performance Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_buildings_building_code ON public.buildings(building_code);
CREATE INDEX IF NOT EXISTS idx_buildings_admin_id ON public.buildings(admin_id);
CREATE INDEX IF NOT EXISTS idx_buildings_subscription_status ON public.buildings(subscription_status);

CREATE INDEX IF NOT EXISTS idx_apartments_building_id ON public.apartments(building_id);
CREATE INDEX IF NOT EXISTS idx_apartments_resident_id ON public.apartments(resident_id);

CREATE INDEX IF NOT EXISTS idx_users_building_id ON public.users(building_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);

CREATE INDEX IF NOT EXISTS idx_payments_building_status ON public.payments(building_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_resident_id ON public.payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_payments_billing_month ON public.payments(building_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_emergency_claim_id ON public.payments(emergency_claim_id);

CREATE INDEX IF NOT EXISTS idx_emergency_claims_building_status ON public.emergency_claims(building_id, status);
CREATE INDEX IF NOT EXISTS idx_emergency_claim_shares_claim_id ON public.emergency_claim_shares(claim_id);
CREATE INDEX IF NOT EXISTS idx_emergency_claim_shares_resident_id ON public.emergency_claim_shares(resident_id);

CREATE INDEX IF NOT EXISTS idx_expenses_building_month ON public.expenses(building_id, expense_month);
CREATE INDEX IF NOT EXISTS idx_expenses_building_date ON public.expenses(building_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_app_sub_invoices_building_status ON public.app_subscription_invoices(building_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, is_read);

-- ============================================================================
-- 3. Security Helper Functions (Strictly using auth.uid())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_building_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT building_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS public.account_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT status FROM public.users WHERE id = auth.uid();
$$;

-- Checks whether a building's subscription or 60-day trial is currently active (Not Read-Only)
CREATE OR REPLACE FUNCTION public.is_building_writable(p_building_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_building RECORD;
BEGIN
    SELECT subscription_status, trial_ends_at, subscription_ends_at
    INTO v_building
    FROM public.buildings
    WHERE id = p_building_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_building.subscription_status IN ('expired', 'read_only') THEN
        RETURN false;
    END IF;

    IF v_building.subscription_status = 'trial' AND v_building.trial_ends_at < now() THEN
        RETURN false;
    END IF;

    IF v_building.subscription_status = 'active' AND v_building.subscription_ends_at < now() THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

-- ============================================================================
-- 4. Trigger: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'subscription_plans',
        'buildings',
        'apartments',
        'users',
        'emergency_claims',
        'emergency_claim_shares',
        'payments',
        'app_subscription_invoices',
        'expenses',
        'maintenance_tickets',
        'polls'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', t);
        EXECUTE format(
            'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
            t
        );
    END LOOP;
END $$;

-- ============================================================================
-- 5. Security Mandate #1 Trigger: Strict Role & Sensitive Column Protection
--    Prevents ANY user from modifying their own role to super_admin/admin or
--    tampering with status/building_id outside authorized RPC contexts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_user_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role public.user_role;
    v_caller_building UUID;
    v_bypass TEXT;
BEGIN
    -- Allow trusted internal SECURITY DEFINER RPC functions that explicitly set a local session flag
    v_bypass := current_setting('app.rpc_internal_bypass', true);
    IF v_bypass = 'true' THEN
        RETURN NEW;
    END IF;

    -- Allow service_role (migrations / backend admin) when auth.uid() is null
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role, building_id INTO v_caller_role, v_caller_building
    FROM public.users
    WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        -- On direct client INSERT, force role = 'resident' and status = 'pending'
        -- (Becoming 'admin' happens exclusively through the secure RPC create_building_for_admin)
        IF COALESCE(v_caller_role, 'resident'::public.user_role) <> 'super_admin' THEN
            IF NEW.role <> 'resident' THEN
                RAISE EXCEPTION 'Security Violation: Cannot self-assign privileged role (%).', NEW.role;
            END IF;
            NEW.status := 'pending';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Only super_admin can ever change a user's role directly
        IF NEW.role IS DISTINCT FROM OLD.role AND v_caller_role IS DISTINCT FROM 'super_admin' THEN
            RAISE EXCEPTION 'Security Violation: Modifying user role is strictly prohibited.';
        END IF;

        -- Prevent non-super_admin and non-building-admin from changing status or building_id
        IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
            IF NEW.building_id IS DISTINCT FROM OLD.building_id AND OLD.building_id IS NOT NULL THEN
                RAISE EXCEPTION 'Security Violation: Cannot change assigned building_id.';
            END IF;

            IF NEW.status IS DISTINCT FROM OLD.status THEN
                -- Only the active admin of the same building can change a resident's status
                IF NOT (v_caller_role = 'admin' AND v_caller_building = OLD.building_id AND OLD.role = 'resident') THEN
                    RAISE EXCEPTION 'Security Violation: Unauthorized attempt to change account status.';
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_sensitive_columns ON public.users;
CREATE TRIGGER trg_protect_user_sensitive_columns
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_sensitive_columns();

-- ============================================================================
-- 6. Trigger: Protect Building Financial & Subscription Fields from Direct Edit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_building_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role public.user_role;
    v_bypass TEXT;
BEGIN
    v_bypass := current_setting('app.rpc_internal_bypass', true);
    IF v_bypass = 'true' OR auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();

    -- Only internal RPCs can modify fund_balance
    IF NEW.fund_balance IS DISTINCT FROM OLD.fund_balance THEN
        RAISE EXCEPTION 'Security Violation: fund_balance can only be modified via verified financial RPC functions.';
    END IF;

    -- Only super_admin can modify subscription pricing, limits, dates, or feature flags
    IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
        IF NEW.plan_code IS DISTINCT FROM OLD.plan_code
           OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
           OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
           OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
           OR NEW.custom_monthly_price IS DISTINCT FROM OLD.custom_monthly_price
           OR NEW.max_apartments_override IS DISTINCT FROM OLD.max_apartments_override
           OR NEW.features_config IS DISTINCT FROM OLD.features_config
           OR NEW.building_code IS DISTINCT FROM OLD.building_code
        THEN
            RAISE EXCEPTION 'Security Violation: Subscription settings and feature flags are restricted to Super Admin.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_building_sensitive_columns ON public.buildings;
CREATE TRIGGER trg_protect_building_sensitive_columns
    BEFORE UPDATE ON public.buildings
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_building_sensitive_columns();
