export type UserRole = 'admin' | 'resident' | 'super_admin';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export type SubscriptionPlanCode = 'free' | 'pro' | 'plus';

export type BuildingSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'read_only'
  | 'expired';

export type InvoiceStatus = 'pending' | 'approved' | 'rejected';

export interface FeaturesConfig {
  receipt_upload: boolean;
  emergency_claims: boolean;
  export_reports: boolean;
  voting: boolean;
  maintenance_tickets: boolean;
  documents_archive: boolean;
}

export interface SubscriptionPlan {
  code: SubscriptionPlanCode;
  name_ar: string;
  description_ar: string;
  default_monthly_price: number;
  max_apartments: number;
  default_features_config: FeaturesConfig;
  is_active: boolean;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  registration_number?: string;
  building_code: string;
  admin_id?: string | null;
  admin_name?: string;
  admin_phone?: string;
  fund_balance: number;
  default_monthly_dues: number;
  total_apartments: number;
  registered_apartments_count?: number;
  plan_code: SubscriptionPlanCode;
  subscription_status: BuildingSubscriptionStatus;
  trial_ends_at: string;
  subscription_ends_at: string;
  custom_monthly_price?: number | null;
  max_apartments_override?: number | null;
  features_config: FeaturesConfig;
  created_at: string;
}

export interface AppSubscriptionInvoice {
  id: string;
  building_id: string;
  building_name?: string;
  building_code?: string;
  submitted_by?: string | null;
  admin_name?: string;
  admin_phone?: string;
  plan_code: SubscriptionPlanCode;
  amount: number;
  duration_months: number;
  payment_method: string;
  receipt_image_url: string;
  reference_number?: string;
  status: InvoiceStatus;
  rejection_reason?: string | null;
  auto_expense_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  building_id?: string | null;
  building_name?: string;
  building_code?: string;
  full_name: string;
  phone: string;
  email?: string;
  role: UserRole;
  status: AccountStatus;
  apartment_number?: string | null;
  floor_number?: string | null;
  ownership_share_percent?: number;
  push_token?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  building_id: string;
  building_name?: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  expense_date: string;
  expense_month: string;
  invoice_image_url?: string;
  invoice_number?: string;
  voucher_number?: string;
  is_system_generated: boolean;
  created_at: string;
}
