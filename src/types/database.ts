export type UserRole = 'admin' | 'resident' | 'super_admin';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export type PlanTier = 'free' | 'pro' | 'plus';

export type BuildingSubscriptionStatus = 'trial' | 'active' | 'expired' | 'read_only';

export type PaymentMethodType = 'electronic_transfer' | 'cash';

export type CashRecipientType = 'admin' | 'guard';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'rejected';
export type PaymentStatusType = PaymentStatus;

export type PaymentCategoryType = 'monthly_dues' | 'emergency_claim';

export type ClaimDistributionType = 'equal' | 'custom';

export type ClaimStatus = 'active' | 'completed' | 'cancelled';

export type InvoiceReviewStatus = 'pending' | 'approved' | 'rejected';

export interface FeaturesConfig {
  receipt_upload: boolean;
  emergency_claims: boolean;
  export_reports: boolean;
  voting: boolean;
  maintenance_tickets: boolean;
  documents_archive: boolean;
}

export interface SubscriptionPlan {
  code: PlanTier;
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
  city?: string;
  registration_number?: string;
  building_code: string;
  admin_id: string | null;
  fund_balance: number;
  default_monthly_dues: number;
  total_apartments: number;
  plan_code: PlanTier;
  subscription_status: BuildingSubscriptionStatus;
  trial_ends_at: string;
  subscription_ends_at: string;
  custom_monthly_price: number | null;
  max_apartments_override: number | null;
  features_config: FeaturesConfig;
  created_at: string;
}

export type StorageBucketName =
  | 'payment-receipts'
  | 'expense-invoices'
  | 'subscription-receipts'
  | 'issue-attachments';

export interface Apartment {
  id: string;
  building_id: string;
  apartment_number: string;
  floor_number: string;
  wing_or_direction?: string;
  area_sqm?: number;
  ownership_share_percent: number;
  monthly_dues_override?: number | null;
  occupant_name?: string | null;
  occupant_phone?: string | null;
  arrears_amount?: number;
  resident_id: string | null;
  resident_name?: string;
  resident_phone?: string;
  payment_status?: PaymentStatus;
  unpaid_months_count?: number;
  unpaid_amount?: number;
  invite_code?: string;
  is_active: boolean;
}

export interface ApartmentObligation {
  id: string;
  building_id: string;
  apartment_id: string;
  apartment_number: string;
  title: string;
  category: PaymentCategoryType;
  billing_month: string;
  amount: number;
  status: PaymentStatus;
  notes?: string | null;
  transferred_from_apartment_id?: string | null;
  transferred_from_apartment_number?: string | null;
  transferred_at?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  building_id: string | null;
  apartment_id: string | null;
  apartment_number: string | null;
  floor_number?: string | null;
  residency_type: 'owner_resident' | 'tenant' | 'non_resident_owner';
  ownership_share_percent: number;
  push_token?: string | null;
  push_token_updated_at?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  building_id: string;
  apartment_id: string | null;
  apartment_number: string;
  resident_id: string | null;
  resident_name: string;
  payment_category: PaymentCategoryType;
  emergency_claim_id?: string | null;
  billing_month: string;
  amount: number;
  payment_method: PaymentMethodType;
  cash_recipient?: CashRecipientType | null;
  receipt_image_url?: string | null;
  reference_number?: string | null;
  notes?: string | null;
  status: PaymentStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface EmergencyClaim {
  id: string;
  building_id: string;
  created_by: string;
  title: string;
  description: string;
  category: string;
  target_amount: number;
  collected_amount: number;
  distribution_type: ClaimDistributionType;
  default_share_amount: number | null;
  due_date: string | null;
  status: ClaimStatus;
  contributors_count?: number;
  created_at: string;
}

export interface EmergencyClaimShare {
  id: string;
  claim_id: string;
  building_id: string;
  apartment_id: string;
  apartment_number: string;
  resident_id: string | null;
  resident_name?: string;
  assigned_amount: number;
  paid_amount: number;
  status: PaymentStatus;
}

export interface Expense {
  id: string;
  building_id: string;
  created_by: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  expense_date: string;
  expense_month: string;
  invoice_image_url?: string | null;
  invoice_number?: string | null;
  voucher_number?: string | null;
  is_system_generated: boolean;
  app_subscription_invoice_id?: string | null;
  created_at: string;
}

export interface AppSubscriptionInvoice {
  id: string;
  building_id: string;
  building_name: string;
  building_code: string;
  submitted_by: string;
  admin_name: string;
  plan_code: PlanTier;
  amount: number;
  duration_months: number;
  receipt_image_url: string;
  notes?: string | null;
  status: InvoiceReviewStatus;
  activated_by?: string | null;
  activated_at?: string | null;
  created_at: string;
}

export type NotificationCategory =
  | 'financial'
  | 'join_request'
  | 'maintenance'
  | 'voting'
  | 'general';

export interface AppNotification {
  id: string;
  building_id: string | null;
  recipient_id: string;
  recipient_role: UserRole;
  title: string;
  body: string;
  category: NotificationCategory;
  badge_label?: string;
  is_urgent?: boolean;
  is_read: boolean;
  created_at: string;
  metadata?: {
    apartment_number?: string;
    amount?: number;
    rejection_reason?: string;
    payment_id?: string;
    resident_id?: string;
    billing_month?: string;
    target_apartments?: string[];
    [key: string]: any;
  };
}

export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type IssueSeverity = 'low' | 'medium' | 'high';

export interface BuildingIssue {
  id: string;
  building_id: string;
  created_by: string;
  apartment_id: string | null;
  apartment_number: string;
  reporter_name: string;
  title: string;
  description?: string;
  category: string;
  severity: IssueSeverity;
  image_url?: string | null;
  is_private: boolean;
  upvotes_count: number;
  status: IssueStatus;
  preferred_time?: string;
  whatsapp_notifications: boolean;
  resolved_at?: string | null;
  has_upvoted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface IssueUpvote {
  id: string;
  issue_id: string;
  building_id: string;
  apartment_id: string;
  apartment_number: string;
  user_id: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  title: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  building_id: string;
  apartment_id: string;
  apartment_number: string;
  voter_id: string;
  voter_name?: string;
  choice: string;
  weight_percent?: number;
  created_at: string;
}

export interface Poll {
  id: string;
  building_id: string;
  created_by: string;
  session_code?: string;
  title: string;
  description?: string;
  category?: string;
  estimated_cost?: number;
  share_per_unit?: number;
  document_url?: string;
  quorum_percent: number;
  voting_basis: string;
  ends_at: string;
  status: 'active' | 'closed' | 'cancelled';
  options: PollOption[];
  votes_count: number;
  is_urgent?: boolean;
  created_at: string;
  updated_at: string;
  user_voted_choice?: string | null;
  options_stats?: {
    [choiceId: string]: {
      count: number;
      percentage: number;
      apartments: string[];
    };
  };
  total_voted_units?: number;
  total_building_units?: number;
  participation_percent?: number;
}

