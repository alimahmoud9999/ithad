import type {
  Apartment,
  ApartmentObligation,
  AppNotification,
  AppSubscriptionInvoice,
  Building,
  EmergencyClaim,
  Expense,
  Payment,
  SubscriptionPlan,
  UserProfile,
  UserRole,
} from '@/shared/types/database';

// ============================================================================
// Initial Seed State Matching "برج الأمل السكني" from design/stitch_/
// ============================================================================

export const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    code: 'free',
    name_ar: 'الباقة الأساسية (Free)',
    description_ar:
      'مناسبة للعقارات الصغيرة لتتبع الاشتراكات النقدية والمصروفات الأساسية.',
    default_monthly_price: 0,
    max_apartments: 10,
    default_features_config: {
      receipt_upload: false,
      emergency_claims: false,
      export_reports: false,
      voting: false,
      maintenance_tickets: true,
      documents_archive: false,
    },
    is_active: true,
  },
  {
    code: 'pro',
    name_ar: 'الباقة الاحترافية (Pro)',
    description_ar:
      'الباقة القياسية لاتحادات الملاك (مجانية لأول 60 يوماً عند تأسيس العمارة).',
    default_monthly_price: 150,
    max_apartments: 30,
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
      'سعة شقق كبيرة للأبراج السكنية مع تفعيل كافة المميزات المتقدمة.',
    default_monthly_price: 300,
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

export const DEFAULT_EMPTY_BUILDING: Building = {
  id: '',
  name: 'لم يتم تسجيل أو اختيار عقار بعد',
  address: '',
  city: '',
  registration_number: '',
  building_code: '',
  admin_id: '',
  fund_balance: 0,
  default_monthly_dues: 0,
  total_apartments: 0,
  plan_code: 'pro',
  subscription_status: 'trial',
  trial_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  subscription_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  custom_monthly_price: 0,
  max_apartments_override: null,
  features_config: {
    receipt_upload: true,
    emergency_claims: true,
    export_reports: true,
    voting: true,
    maintenance_tickets: true,
    documents_archive: true,
  },
  created_at: new Date().toISOString(),
};

export const INITIAL_BUILDINGS: Building[] = [];

export const INITIAL_USERS: Record<UserRole, UserProfile> = {
  admin: {
    id: 'usr-admin-001',
    full_name: 'رئيس الاتحاد',
    email: 'admin@ittihad.app',
    phone: '',
    role: 'admin',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: '',
    floor_number: '',
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  resident: {
    id: 'usr-res-001',
    full_name: 'الساكن / المالك',
    email: 'resident@ittihad.app',
    phone: '',
    role: 'resident',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: '302',
    floor_number: 'الدور الثالث',
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  super_admin: {
    id: 'usr-super-000',
    full_name: 'مالك التطبيق (Super)',
    email: 'owner@ittihadtrust.com',
    phone: '01000000001',
    role: 'super_admin',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: null,
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
};

export const INITIAL_PENDING_RESIDENTS: UserProfile[] = [];

export const INITIAL_APARTMENTS: Apartment[] = [];
export const INITIAL_APARTMENT_OBLIGATIONS: ApartmentObligation[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_EMERGENCY_CLAIMS: EmergencyClaim[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_SUBSCRIPTION_INVOICES: AppSubscriptionInvoice[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
