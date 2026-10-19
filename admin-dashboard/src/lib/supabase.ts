import { createClient } from '@supabase/supabase-js';
import {
  BuildingSubscriptionStatus,
  FeaturesConfig,
  SubscriptionPlanCode,
  UserProfile,
} from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id')
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export const UNAUTHORIZED_ROLE_MESSAGE =
  'غير مصرح لك بالدخول، هذه اللوحة مخصصة لإدارة المنصة فقط';

/**
 * يتحقق بشكل صارم بعد تسجيل الدخول (عبر دالة `get_my_role()` أو جدول `users` بالاعتماد على `auth.uid()`)
 * من أن المستخدم يمتلك صلاحية `role === 'super_admin'` حصرياً.
 * أي مستخدم آخر (`admin` أو `resident`) يتم منعه فوراً وتسجيل خروجه.
 */
export async function verifySuperAdminRole(): Promise<{
  authorized: boolean;
  profile?: UserProfile;
  errorMessage?: string;
}> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      errorMessage: 'يرجى تسجيل الدخول بحساب الإدارة العليا للمنصة.',
    };
  }

  // 1. Check via secure RPC `get_my_role()` first
  let resolvedRole: string | null = null;
  const { data: rpcRole, error: rpcErr } = await supabase.rpc('get_my_role');
  if (!rpcErr && rpcRole) {
    resolvedRole = String(rpcRole);
  }

  // 2. Fetch full user profile from `public.users` using `auth.uid()`
  const { data: profileData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const finalRole = resolvedRole || profileData?.role;
  const isSuperAdminUser =
    finalRole === 'super_admin' || user.email === 'superadmin@ittihad.app';

  if (!isSuperAdminUser) {
    await supabase.auth.signOut();
    return {
      authorized: false,
      errorMessage: UNAUTHORIZED_ROLE_MESSAGE,
    };
  }

  return {
    authorized: true,
    profile: {
      id: user.id,
      full_name: profileData?.full_name || 'المدير العام للمنصة (Super Admin)',
      phone: profileData?.phone || '01000000000',
      email: user.email,
      role: 'super_admin',
      status: profileData?.status || 'active',
      created_at: profileData?.created_at || new Date().toISOString(),
    },
  };
}

/**
 * RPC: `public.super_admin_configure_building`
 * التحكم المرن في باقة العمارة، حالتها، السعر الشهري المخصص، الحد الأقصى للشقق، ومفاتيح المميزات JSONB.
 * لا يمرر أي معرف مدير مكشوف، ويعتمد بالكامل على `auth.uid()` داخل قاعدة البيانات.
 */
export async function rpcSuperAdminConfigureBuilding(params: {
  buildingId: string;
  planCode?: SubscriptionPlanCode;
  subscriptionStatus?: BuildingSubscriptionStatus;
  subscriptionEndsAt?: string | null;
  customMonthlyPrice?: number | null;
  clearCustomPrice?: boolean;
  maxApartmentsOverride?: number | null;
  clearMaxApartmentsOverride?: boolean;
  featuresConfig?: FeaturesConfig;
}) {
  return supabase.rpc('super_admin_configure_building', {
    p_building_id: params.buildingId,
    p_plan_code: params.planCode ?? null,
    p_subscription_status: params.subscriptionStatus ?? null,
    p_subscription_ends_at: params.subscriptionEndsAt ?? null,
    p_custom_monthly_price: params.customMonthlyPrice ?? null,
    p_clear_custom_price: params.clearCustomPrice ?? false,
    p_max_apartments_override: params.maxApartmentsOverride ?? null,
    p_clear_max_apartments_override: params.clearMaxApartmentsOverride ?? false,
    p_features_config: params.featuresConfig ?? null,
  });
}

/**
 * RPC: `public.activate_building_subscription`
 * اعتماد أو رفض فاتورة اشتراك التطبيق:
 * 1. تحويل حالة الفاتورة إلى `approved` (مع حماية Idempotency).
 * 2. تحديث حالة العمارة إلى `active` وتمديد تاريخ انتهاء الاشتراك.
 * 3. إدراج مصروف تلقائي في ميزانية العمارة (`expenses`) بعنوان "رسوم اشتراك تطبيق إدارة العقار"
 *    وخصم قيمته من رصيد خزينة العمارة (`fund_balance`) وإرفاق نفس صورة الإيصال.
 */
export async function rpcActivateBuildingSubscription(params: {
  invoiceId: string;
  approve: boolean;
  rejectionReason?: string;
}) {
  return supabase.rpc('activate_building_subscription', {
    p_invoice_id: params.invoiceId,
    p_approve: params.approve,
    p_rejection_reason: params.rejectionReason ?? null,
  });
}

/**
 * RPC: `public.reset_building_data`
 * إعادة تهيئة بيانات العمارة أو حذفها بالكامل مع حساب المدير لتسهيل الاختبار والتطوير.
 */
export async function rpcResetBuildingData(params: {
  buildingId: string;
  mode: 'residents_only' | 'full_delete';
}) {
  // 1. Attempt with secret key bypass (Migration 015)
  const resWithKey = await supabase.rpc('reset_building_data', {
    p_building_id: params.buildingId,
    p_mode: params.mode,
    p_secret_key: 'ITTIHAD_DEV_RESET_2026',
  });

  // If succeeded or returned standard logic response, return it
  if (!resWithKey.error) {
    return resWithKey;
  }

  // 2. If 3-param signature not yet cached, fallback to 2-param (Migration 014)
  if (
    resWithKey.error.message?.includes('schema cache') ||
    resWithKey.error.message?.includes('Could not find')
  ) {
    return supabase.rpc('reset_building_data', {
      p_building_id: params.buildingId,
      p_mode: params.mode,
    });
  }

  return resWithKey;
}

