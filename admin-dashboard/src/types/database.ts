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
  admin_email?: string;
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
  residency_type?: string | null;
  ownership_share_percent?: number;
  push_token?: string | null;
  created_at: string;
  updated_at?: string;
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

export interface Apartment {
  id: string;
  building_id: string;
  apartment_number: string;
  floor_number?: string | null;
  wing_or_direction?: string | null;
  area_sqm?: number | null;
  occupant_name?: string | null;
  occupant_phone?: string | null;
  arrears_amount: number;
  unpaid_months_count?: number;
  payment_status: 'paid' | 'unpaid' | 'pending';
  resident_id?: string | null;
  resident_name?: string | null;
  resident_phone?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApartmentObligation {
  id: string;
  building_id: string;
  apartment_id: string;
  apartment_number?: string;
  title: string;
  category: 'monthly_dues' | 'emergency_claim';
  billing_month: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'pending';
  notes?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  building_id: string;
  apartment_id?: string | null;
  apartment_number?: string;
  resident_id: string;
  resident_name?: string;
  payment_category: 'monthly_dues' | 'emergency_claim';
  emergency_claim_id?: string | null;
  billing_month: string;
  amount: number;
  payment_method: 'electronic_transfer' | 'cash';
  cash_recipient?: 'admin' | 'guard' | null;
  receipt_image_url?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  status: 'pending' | 'paid' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
}

export interface EmergencyClaim {
  id: string;
  building_id: string;
  title: string;
  description?: string | null;
  category: string;
  target_amount: number;
  collected_amount: number;
  default_share_amount?: number | null;
  status: 'active' | 'closed';
  created_at: string;
}

export interface BuildingIssue {
  id: string;
  building_id: string;
  apartment_number?: string | null;
  reporter_name?: string | null;
  title: string;
  description?: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  image_url?: string | null;
  is_private: boolean;
  upvotes_count: number;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface Poll {
  id: string;
  building_id: string;
  title: string;
  description?: string | null;
  category: string;
  estimated_cost?: number;
  share_per_unit?: number;
  status: 'active' | 'closed' | 'cancelled';
  votes_count: number;
  quorum_percent: number;
  options: any[];
  ends_at: string;
  created_at: string;
}

