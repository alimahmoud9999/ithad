-- ============================================================================
-- Migration: 006_seed_plans.sql
-- Project: مدير اتحاد الملاك (Ittihad Trust Mobile)
-- Description: Seeds the 3 global subscription package templates (free, pro, plus)
--              managed by super_admin with default pricing, apartment caps,
--              and feature flags (features_config JSONB).
-- ============================================================================

INSERT INTO public.subscription_plans (
    code,
    name_ar,
    description_ar,
    default_monthly_price,
    max_apartments,
    default_features_config,
    is_active
) VALUES
(
    'free'::public.plan_tier,
    'الباقة الأساسية (Free)',
    'مناسبة للعقارات الصغيرة لتتبع الاشتراكات النقدية والمصروفات الأساسية.',
    0.00,
    10,
    '{"receipt_upload": false, "emergency_claims": false, "export_reports": false, "voting": false, "maintenance_tickets": true, "documents_archive": false}'::jsonb,
    true
),
(
    'pro'::public.plan_tier,
    'الباقة الاحترافية (Pro)',
    'الباقة القياسية لاتحادات الملاك: تشمل رفع إيصالات التحويل الإلكتروني، المطالبات الطارئة، ولوحة الشفافية الكاملة (مجانية لأول 60 يوماً عند تأسيس العمارة).',
    150.00,
    30,
    '{"receipt_upload": true, "emergency_claims": true, "export_reports": true, "voting": true, "maintenance_tickets": true, "documents_archive": true}'::jsonb,
    true
),
(
    'plus'::public.plan_tier,
    'باقة الأبراج والمجمعات (Plus)',
    'سعة شقق كبيرة للأبراج السكنية مع تفعيل كافة المميزات المتقدمة، التصويت القانوني بالحصة العقارية، وتصدير التقارير المعتمدة PDF.',
    300.00,
    120,
    '{"receipt_upload": true, "emergency_claims": true, "export_reports": true, "voting": true, "maintenance_tickets": true, "documents_archive": true}'::jsonb,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    description_ar = EXCLUDED.description_ar,
    default_monthly_price = EXCLUDED.default_monthly_price,
    max_apartments = EXCLUDED.max_apartments,
    default_features_config = EXCLUDED.default_features_config,
    is_active = EXCLUDED.is_active;
