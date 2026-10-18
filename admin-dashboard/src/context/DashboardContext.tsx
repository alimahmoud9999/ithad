'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  AppSubscriptionInvoice,
  Building,
  BuildingSubscriptionStatus,
  Expense,
  FeaturesConfig,
  SubscriptionPlan,
  SubscriptionPlanCode,
  UserProfile,
  AccountStatus,
} from '@/types/database';
import {
  isSupabaseConfigured,
  rpcActivateBuildingSubscription,
  rpcSuperAdminConfigureBuilding,
  supabase,
  UNAUTHORIZED_ROLE_MESSAGE,
  verifySuperAdminRole,
} from '@/lib/supabase';

// ============================================================================
// Initial Seed Data (Synced with Supabase & Interactive Demo Fallback)
// ============================================================================

const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    code: 'free',
    name_ar: 'الباقة الأساسية (Free)',
    description_ar: 'مناسبة للعقارات الصغيرة حتى 12 شقة مع إدارة التحصيل النقدي الأساسي.',
    default_monthly_price: 0,
    max_apartments: 12,
    default_features_config: {
      receipt_upload: false,
      emergency_claims: false,
      export_reports: false,
      voting: false,
      maintenance_tickets: false,
      documents_archive: false,
    },
    is_active: true,
  },
  {
    code: 'pro',
    name_ar: 'باقة العمارة الذكية (Pro)',
    description_ar:
      'الباقة الأكثر طلباً: رفع إيصالات إنستاباي، المطالبات الطارئة، وتصدير كشوف الحساب PDF.',
    default_monthly_price: 250,
    max_apartments: 36,
    default_features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    is_active: true,
  },
  {
    code: 'plus',
    name_ar: 'باقة الأبراج والمجمعات (Plus)',
    description_ar:
      'سعة شقق كبيرة للأبراج السكنية والمجمعات مع تفعيل كافة المميزات المتقدمة.',
    default_monthly_price: 450,
    max_apartments: 120,
    default_features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    is_active: true,
  },
];

const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    name: 'برج الأمل السكني',
    address: 'شارع النزهة - التجمع الخامس، القاهرة',
    city: 'القاهرة',
    registration_number: 'قيد اتحاد الشاغلين رقم 142 لسنة 2023',
    building_code: 'BLD-8422',
    admin_id: 'usr-admin-001',
    admin_name: 'أ. أحمد ممدوح',
    admin_phone: '01012345678',
    fund_balance: 24500,
    default_monthly_dues: 400,
    total_apartments: 16,
    registered_apartments_count: 14,
    plan_code: 'pro',
    subscription_status: 'trial',
    trial_ends_at: '2026-12-01T00:00:00Z',
    subscription_ends_at: '2026-12-01T00:00:00Z',
    custom_monthly_price: 200,
    max_apartments_override: 24,
    features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    name: 'عمارة النخيل الذهبية',
    address: 'شارع عباس العقاد - مدينة نصر، القاهرة',
    city: 'القاهرة',
    registration_number: 'قيد اتحاد الشاغلين رقم 310 لسنة 2022',
    building_code: 'BLD-5190',
    admin_id: 'usr-admin-002',
    admin_name: 'م. كريم عبد العزيز',
    admin_phone: '01144556677',
    fund_balance: 38900,
    default_monthly_dues: 500,
    total_apartments: 28,
    registered_apartments_count: 28,
    plan_code: 'pro',
    subscription_status: 'active',
    trial_ends_at: '2026-08-01T00:00:00Z',
    subscription_ends_at: '2027-02-15T00:00:00Z',
    custom_monthly_price: null,
    max_apartments_override: null,
    features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    created_at: '2026-07-15T09:30:00Z',
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    name: 'عمارة الأندلس (ب)',
    address: 'المعادي الجديدة - شارع النصر، القاهرة',
    city: 'القاهرة',
    registration_number: 'قيد اتحاد الشاغلين رقم 89 لسنة 2024',
    building_code: 'BLD-3091',
    admin_id: 'usr-admin-003',
    admin_name: 'د. هاني البحيري',
    admin_phone: '01288990011',
    fund_balance: 14200,
    default_monthly_dues: 350,
    total_apartments: 12,
    registered_apartments_count: 10,
    plan_code: 'free',
    subscription_status: 'expired',
    trial_ends_at: '2026-09-01T00:00:00Z',
    subscription_ends_at: '2026-09-01T00:00:00Z',
    custom_monthly_price: 150,
    max_apartments_override: 16,
    features_config: {
      receipt_upload: true,
      emergency_claims: false,
      export_reports: false,
      voting: false,
      maintenance_tickets: false,
      documents_archive: false,
    },
    created_at: '2026-06-20T14:00:00Z',
  },
  {
    id: 'b4444444-4444-4444-4444-444444444444',
    name: 'أبراج الصفوة ريزيدنس',
    address: 'الحي المتميز - الشيخ زايد، الجيزة',
    city: 'الجيزة',
    registration_number: 'قيد اتحاد الشاغلين رقم 504 لسنة 2024',
    building_code: 'BLD-9920',
    admin_id: 'usr-admin-004',
    admin_name: 'لواء/ طارق المنشاوي',
    admin_phone: '01099887766',
    fund_balance: 64200,
    default_monthly_dues: 600,
    total_apartments: 48,
    registered_apartments_count: 45,
    plan_code: 'plus',
    subscription_status: 'active',
    trial_ends_at: '2026-05-01T00:00:00Z',
    subscription_ends_at: '2027-05-01T00:00:00Z',
    custom_monthly_price: 400,
    max_apartments_override: 60,
    features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    created_at: '2026-05-01T11:00:00Z',
  },
];

const INITIAL_INVOICES: AppSubscriptionInvoice[] = [
  {
    id: 'inv-sub-001',
    building_id: 'b1111111-1111-1111-1111-111111111111',
    building_name: 'برج الأمل السكني',
    building_code: 'BLD-8422',
    submitted_by: 'usr-admin-001',
    admin_name: 'أ. أحمد ممدوح',
    admin_phone: '01012345678',
    plan_code: 'pro',
    amount: 200,
    duration_months: 1,
    payment_method: 'InstaPay (إنستاباي)',
    receipt_image_url:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80',
    reference_number: 'IPN-20261018-9942',
    status: 'pending',
    created_at: '2026-10-18T01:30:00Z',
  },
  {
    id: 'inv-sub-002',
    building_id: 'b3333333-3333-3333-3333-333333333333',
    building_name: 'عمارة الأندلس (ب)',
    building_code: 'BLD-3091',
    submitted_by: 'usr-admin-003',
    admin_name: 'د. هاني البحيري',
    admin_phone: '01288990011',
    plan_code: 'pro',
    amount: 450,
    duration_months: 3,
    payment_method: 'Vodafone Cash (فودافون كاش)',
    receipt_image_url:
      'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=900&q=80',
    reference_number: 'VF-88371209',
    status: 'pending',
    created_at: '2026-10-17T19:15:00Z',
  },
  {
    id: 'inv-sub-003',
    building_id: 'b2222222-2222-2222-2222-222222222222',
    building_name: 'عمارة النخيل الذهبية',
    building_code: 'BLD-5190',
    submitted_by: 'usr-admin-002',
    admin_name: 'م. كريم عبد العزيز',
    admin_phone: '01144556677',
    plan_code: 'pro',
    amount: 750,
    duration_months: 3,
    payment_method: 'InstaPay (إنستاباي)',
    receipt_image_url:
      'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=900&q=80',
    reference_number: 'IPN-20261005-4410',
    status: 'approved',
    auto_expense_id: 'exp-auto-001',
    reviewed_at: '2026-10-05T14:20:00Z',
    created_at: '2026-10-05T12:00:00Z',
  },
  {
    id: 'inv-sub-004',
    building_id: 'b4444444-4444-4444-4444-444444444444',
    building_name: 'أبراج الصفوة ريزيدنس',
    building_code: 'BLD-9920',
    submitted_by: 'usr-admin-004',
    admin_name: 'لواء/ طارق المنشاوي',
    admin_phone: '01099887766',
    plan_code: 'plus',
    amount: 2400,
    duration_months: 6,
    payment_method: 'تحويل بنكي (CIB)',
    receipt_image_url:
      'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&q=80',
    reference_number: 'CIB-20261001-7712',
    status: 'approved',
    auto_expense_id: 'exp-auto-002',
    reviewed_at: '2026-10-01T16:00:00Z',
    created_at: '2026-10-01T15:00:00Z',
  },
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-super-001',
    full_name: 'م. علي (المدير العام للمنصة)',
    phone: '01000000000',
    email: 'superadmin@ittihad.app',
    role: 'super_admin',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-admin-001',
    building_id: 'b1111111-1111-1111-1111-111111111111',
    building_name: 'برج الأمل السكني',
    building_code: 'BLD-8422',
    full_name: 'أ. أحمد ممدوح',
    phone: '01012345678',
    role: 'admin',
    status: 'active',
    apartment_number: '12',
    floor_number: 'الدور الرابع',
    ownership_share_percent: 12.5,
    created_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'usr-admin-002',
    building_id: 'b2222222-2222-2222-2222-222222222222',
    building_name: 'عمارة النخيل الذهبية',
    building_code: 'BLD-5190',
    full_name: 'م. كريم عبد العزيز',
    phone: '01144556677',
    role: 'admin',
    status: 'active',
    apartment_number: '01',
    floor_number: 'الدور الأول',
    ownership_share_percent: 5.0,
    created_at: '2026-07-15T09:30:00Z',
  },
  {
    id: 'usr-admin-003',
    building_id: 'b3333333-3333-3333-3333-333333333333',
    building_name: 'عمارة الأندلس (ب)',
    building_code: 'BLD-3091',
    full_name: 'د. هاني البحيري',
    phone: '01288990011',
    role: 'admin',
    status: 'active',
    apartment_number: '04',
    floor_number: 'الدور الثاني',
    ownership_share_percent: 8.33,
    created_at: '2026-06-20T14:00:00Z',
  },
  {
    id: 'usr-admin-004',
    building_id: 'b4444444-4444-4444-4444-444444444444',
    building_name: 'أبراج الصفوة ريزيدنس',
    building_code: 'BLD-9920',
    full_name: 'لواء/ طارق المنشاوي',
    phone: '01099887766',
    role: 'admin',
    status: 'active',
    apartment_number: '30',
    floor_number: 'الدور السابع',
    ownership_share_percent: 3.5,
    created_at: '2026-05-01T11:00:00Z',
  },
  {
    id: 'usr-res-001',
    building_id: 'b1111111-1111-1111-1111-111111111111',
    building_name: 'برج الأمل السكني',
    building_code: 'BLD-8422',
    full_name: 'د. مصطفى محمود',
    phone: '01123456789',
    role: 'resident',
    status: 'active',
    apartment_number: '05',
    floor_number: 'الدور الثاني',
    ownership_share_percent: 6.25,
    created_at: '2026-10-03T12:00:00Z',
  },
  {
    id: 'usr-res-002',
    building_id: 'b1111111-1111-1111-1111-111111111111',
    building_name: 'برج الأمل السكني',
    building_code: 'BLD-8422',
    full_name: 'م. سارة خليل',
    phone: '01234567890',
    role: 'resident',
    status: 'active',
    apartment_number: '08',
    floor_number: 'الدور الثالث',
    ownership_share_percent: 6.25,
    created_at: '2026-10-04T15:00:00Z',
  },
  {
    id: 'usr-res-003',
    building_id: 'b1111111-1111-1111-1111-111111111111',
    building_name: 'برج الأمل السكني',
    building_code: 'BLD-8422',
    full_name: 'أ. ياسر عبد الرحمن',
    phone: '01055443322',
    role: 'resident',
    status: 'pending',
    apartment_number: '03',
    floor_number: 'الدور الأول',
    ownership_share_percent: 6.25,
    created_at: '2026-10-17T20:00:00Z',
  },
];

// ============================================================================
// Context Type
// ============================================================================

interface DashboardContextType {
  // Auth & Role Guard
  currentAdmin: UserProfile | null;
  isAuthorizedSuperAdmin: boolean;
  authError: string | null;
  isLoadingAuth: boolean;
  isLiveSupabaseConnected: boolean;
  signInAsSuperAdmin: (email: string, password: string) => Promise<boolean>;
  simulateRoleAttempt: (role: 'super_admin' | 'admin' | 'resident') => void;
  signOut: () => Promise<void>;

  // Data Entities
  plans: SubscriptionPlan[];
  buildings: Building[];
  invoices: AppSubscriptionInvoice[];
  users: UserProfile[];
  autoGeneratedExpenses: Expense[];
  processingIds: Record<string, boolean>;
  toastMessage: { text: string; type: 'success' | 'error' | 'warning' } | null;
  clearToast: () => void;
  refreshFromSupabase: () => Promise<void>;

  // Actions
  configureBuildingOverrides: (input: {
    buildingId: string;
    planCode: SubscriptionPlanCode;
    subscriptionStatus: BuildingSubscriptionStatus;
    subscriptionEndsAt: string;
    customMonthlyPrice: number | null;
    maxApartmentsOverride: number | null;
    featuresConfig: FeaturesConfig;
  }) => Promise<void>;

  reviewSubscriptionInvoice: (input: {
    invoiceId: string;
    approve: boolean;
    rejectionReason?: string;
  }) => Promise<void>;

  updateSubscriptionPlanTemplate: (updatedPlan: SubscriptionPlan) => Promise<void>;

  updateUserStatus: (userId: string, newStatus: AccountStatus) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentAdmin, setCurrentAdmin] = useState<UserProfile | null>(
    INITIAL_USERS[0]
  );
  const [isAuthorizedSuperAdmin, setIsAuthorizedSuperAdmin] =
    useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);
  const [isLiveSupabaseConnected, setIsLiveSupabaseConnected] =
    useState<boolean>(isSupabaseConfigured);

  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_PLANS);
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [invoices, setInvoices] =
    useState<AppSubscriptionInvoice[]>(INITIAL_INVOICES);
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [autoGeneratedExpenses, setAutoGeneratedExpenses] = useState<Expense[]>(
    []
  );
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {}
  );
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.text === text ? null : prev));
      }, 5000);
    },
    []
  );

  const clearToast = () => setToastMessage(null);

  // Sync from live Supabase tables when available
  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      const [plansRes, buildingsRes, invoicesRes, usersRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('default_monthly_price'),
        supabase.from('buildings').select('*').order('created_at', { ascending: false }),
        supabase
          .from('app_subscription_invoices')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('users').select('*').order('created_at', { ascending: false }),
      ]);

      if (plansRes.data && plansRes.data.length > 0) {
        setPlans(plansRes.data as SubscriptionPlan[]);
      }

      if (buildingsRes.data && buildingsRes.data.length > 0) {
        setBuildings((prev) => {
          const liveIds = new Set(buildingsRes.data.map((b: any) => b.id));
          const merged = [
            ...(buildingsRes.data as Building[]),
            ...prev.filter((b) => !liveIds.has(b.id)),
          ];
          return merged;
        });
      }

      if (invoicesRes.data && invoicesRes.data.length > 0) {
        setInvoices((prev) => {
          const liveIds = new Set(invoicesRes.data.map((i: any) => i.id));
          return [
            ...(invoicesRes.data as AppSubscriptionInvoice[]),
            ...prev.filter((i) => !liveIds.has(i.id)),
          ];
        });
      }

      if (usersRes.data && usersRes.data.length > 0) {
        setUsers((prev) => {
          const liveIds = new Set(usersRes.data.map((u: any) => u.id));
          return [
            ...(usersRes.data as UserProfile[]),
            ...prev.filter((u) => !liveIds.has(u.id)),
          ];
        });
      }

      setIsLiveSupabaseConnected(true);
    } catch {
      // Keep interactive state if RLS blocks anon reads before super_admin login
    }
  }, []);

  useEffect(() => {
    refreshFromSupabase();
  }, [refreshFromSupabase]);

  // Sign in via Supabase Auth + Strict Super Admin Role Check
  const signInAsSuperAdmin = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setIsLoadingAuth(false);
        return false;
      }

      const check = await verifySuperAdminRole();
      if (!check.authorized) {
        setIsAuthorizedSuperAdmin(false);
        setCurrentAdmin(null);
        setAuthError(check.errorMessage || UNAUTHORIZED_ROLE_MESSAGE);
        setIsLoadingAuth(false);
        return false;
      }

      setCurrentAdmin(check.profile || INITIAL_USERS[0]);
      setIsAuthorizedSuperAdmin(true);
      await refreshFromSupabase();
      showToast('تم التحقق من صلاحية الإدارة العليا (super_admin) بنجاح', 'success');
      setIsLoadingAuth(false);
      return true;
    } catch (err: any) {
      setAuthError(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
      setIsLoadingAuth(false);
      return false;
    }
  };

  // Interactive test for the strict Role Guard (Admin / Resident blocked immediately)
  const simulateRoleAttempt = (role: 'super_admin' | 'admin' | 'resident') => {
    if (role !== 'super_admin') {
      setIsAuthorizedSuperAdmin(false);
      setCurrentAdmin(null);
      setAuthError(UNAUTHORIZED_ROLE_MESSAGE);
      showToast(UNAUTHORIZED_ROLE_MESSAGE, 'error');
      return;
    }
    setAuthError(null);
    setIsAuthorizedSuperAdmin(true);
    setCurrentAdmin(INITIAL_USERS[0]);
    showToast('تم الدخول بصلاحية مالك المنصة (super_admin)', 'success');
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsAuthorizedSuperAdmin(false);
    setCurrentAdmin(null);
  };

  // 1. Configure Building Overrides (`super_admin_configure_building` RPC)
  const configureBuildingOverrides = async (input: {
    buildingId: string;
    planCode: SubscriptionPlanCode;
    subscriptionStatus: BuildingSubscriptionStatus;
    subscriptionEndsAt: string;
    customMonthlyPrice: number | null;
    maxApartmentsOverride: number | null;
    featuresConfig: FeaturesConfig;
  }) => {
    const lockKey = `cfg_${input.buildingId}`;
    if (processingIds[lockKey]) return;

    setProcessingIds((prev) => ({ ...prev, [lockKey]: true }));
    try {
      if (isSupabaseConfigured) {
        await rpcSuperAdminConfigureBuilding({
          buildingId: input.buildingId,
          planCode: input.planCode,
          subscriptionStatus: input.subscriptionStatus,
          subscriptionEndsAt: input.subscriptionEndsAt,
          customMonthlyPrice: input.customMonthlyPrice,
          clearCustomPrice: input.customMonthlyPrice === null,
          maxApartmentsOverride: input.maxApartmentsOverride,
          clearMaxApartmentsOverride: input.maxApartmentsOverride === null,
          featuresConfig: input.featuresConfig,
        });
      }

      setBuildings((prev) =>
        prev.map((b) =>
          b.id === input.buildingId
            ? {
                ...b,
                plan_code: input.planCode,
                subscription_status: input.subscriptionStatus,
                subscription_ends_at: input.subscriptionEndsAt,
                custom_monthly_price: input.customMonthlyPrice,
                max_apartments_override: input.maxApartmentsOverride,
                features_config: { ...input.featuresConfig },
              }
            : b
        )
      );

      showToast(
        'تم حفظ تخصيص العمارة وتحديث الباقة ومفاتيح المميزات عبر دالة super_admin_configure_building بنجاح',
        'success'
      );
    } finally {
      setProcessingIds((prev) => ({ ...prev, [lockKey]: false }));
    }
  };

  // 2. Review Subscription Invoice (`activate_building_subscription` RPC + Auto-Expense)
  const reviewSubscriptionInvoice = async (input: {
    invoiceId: string;
    approve: boolean;
    rejectionReason?: string;
  }) => {
    const lockKey = `inv_${input.invoiceId}`;
    if (processingIds[lockKey]) return;

    const targetInvoice = invoices.find((i) => i.id === input.invoiceId);
    if (!targetInvoice || targetInvoice.status !== 'pending') {
      showToast('تمت مراجعة هذه الفاتورة مسبقاً (حماية Idempotency)', 'warning');
      return;
    }

    setProcessingIds((prev) => ({ ...prev, [lockKey]: true }));
    try {
      if (isSupabaseConfigured) {
        await rpcActivateBuildingSubscription({
          invoiceId: input.invoiceId,
          approve: input.approve,
          rejectionReason: input.rejectionReason,
        });
      }

      const nowIso = new Date().toISOString();

      if (input.approve) {
        const autoExpenseId = `exp-auto-${Date.now()}`;

        // 1. Update invoice status to approved
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === input.invoiceId
              ? {
                  ...inv,
                  status: 'approved',
                  auto_expense_id: autoExpenseId,
                  reviewed_at: nowIso,
                }
              : inv
          )
        );

        // 2. Extend building subscription & deduct invoice amount from building fund_balance
        setBuildings((prev) =>
          prev.map((b) => {
            if (b.id !== targetInvoice.building_id) return b;
            const baseDate =
              new Date(b.subscription_ends_at) > new Date()
                ? new Date(b.subscription_ends_at)
                : new Date();
            baseDate.setMonth(baseDate.getMonth() + targetInvoice.duration_months);

            return {
              ...b,
              plan_code: targetInvoice.plan_code,
              subscription_status: 'active',
              subscription_ends_at: baseDate.toISOString(),
              fund_balance: Math.max(0, b.fund_balance - targetInvoice.amount),
            };
          })
        );

        // 3. Insert Auto-Expense into building's expenses feed
        const newAutoExpense: Expense = {
          id: autoExpenseId,
          building_id: targetInvoice.building_id,
          building_name: targetInvoice.building_name,
          title: 'رسوم اشتراك تطبيق إدارة العقار',
          description: `قيد تلقائي عند اعتماد فاتورة اشتراك التطبيق لمدة (${targetInvoice.duration_months}) شهر - باقة (${targetInvoice.plan_code.toUpperCase()})`,
          category: 'اشتراكات وخدمات رقمية',
          amount: targetInvoice.amount,
          expense_date: nowIso.slice(0, 10),
          expense_month: nowIso.slice(0, 7),
          invoice_image_url: targetInvoice.receipt_image_url,
          invoice_number: targetInvoice.reference_number || `#SUB-${targetInvoice.id}`,
          voucher_number: `SYS-${Date.now().toString().slice(-5)}`,
          is_system_generated: true,
          created_at: nowIso,
        };

        setAutoGeneratedExpenses((prev) => [newAutoExpense, ...prev]);

        showToast(
          `تم تفعيل اشتراك (${targetInvoice.building_name}) وإدراج مصروف تلقائي بقيمة ${targetInvoice.amount} ج.م في سجل شفافية العمارة!`,
          'success'
        );
      } else {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === input.invoiceId
              ? {
                  ...inv,
                  status: 'rejected',
                  rejection_reason:
                    input.rejectionReason || 'صورة الإيصال غير واضحة أو المبلغ غير مطابق',
                  reviewed_at: nowIso,
                }
              : inv
          )
        );

        showToast(
          `تم رفض إيصال (${targetInvoice.building_name}) وإرسال سبب الرفض لرئيس الاتحاد.`,
          'warning'
        );
      }
    } finally {
      setProcessingIds((prev) => ({ ...prev, [lockKey]: false }));
    }
  };

  // 3. Update Global Subscription Plan Template (`subscription_plans`)
  const updateSubscriptionPlanTemplate = async (updatedPlan: SubscriptionPlan) => {
    const lockKey = `plan_${updatedPlan.code}`;
    if (processingIds[lockKey]) return;

    setProcessingIds((prev) => ({ ...prev, [lockKey]: true }));
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from('subscription_plans')
          .update({
            name_ar: updatedPlan.name_ar,
            description_ar: updatedPlan.description_ar,
            default_monthly_price: updatedPlan.default_monthly_price,
            max_apartments: updatedPlan.max_apartments,
            default_features_config: updatedPlan.default_features_config,
            is_active: updatedPlan.is_active,
          })
          .eq('code', updatedPlan.code);
      }

      setPlans((prev) =>
        prev.map((p) => (p.code === updatedPlan.code ? updatedPlan : p))
      );

      showToast(
        `تم تحديث قالب (${updatedPlan.name_ar}) في جدول subscription_plans بنجاح`,
        'success'
      );
    } finally {
      setProcessingIds((prev) => ({ ...prev, [lockKey]: false }));
    }
  };

  // 4. Update User Account Status (`users`)
  const updateUserStatus = async (userId: string, newStatus: AccountStatus) => {
    const lockKey = `usr_${userId}`;
    if (processingIds[lockKey]) return;

    setProcessingIds((prev) => ({ ...prev, [lockKey]: true }));
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from('users')
          .update({ status: newStatus })
          .eq('id', userId);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );

      showToast('تم تحديث حالة حساب المستخدم بنجاح', 'success');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [lockKey]: false }));
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        currentAdmin,
        isAuthorizedSuperAdmin,
        authError,
        isLoadingAuth,
        isLiveSupabaseConnected,
        signInAsSuperAdmin,
        simulateRoleAttempt,
        signOut,
        plans,
        buildings,
        invoices,
        users,
        autoGeneratedExpenses,
        processingIds,
        toastMessage,
        clearToast,
        refreshFromSupabase,
        configureBuildingOverrides,
        reviewSubscriptionInvoice,
        updateSubscriptionPlanTemplate,
        updateUserStatus,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
};
