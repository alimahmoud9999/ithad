import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  BuildingSubscriptionStatus,
  CashRecipientType,
  ClaimDistributionType,
  FeaturesConfig,
  PaymentCategoryType,
  PaymentMethodType,
  PlanTier,
} from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id')
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Validates that an authenticated Supabase Auth session exists and the user actually exists in auth.users.
 * Clears stale or deleted sessions automatically.
 */
export async function ensureSupabaseSession(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData?.user?.id) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign in using user-selected email and password.
 */
export async function authSignIn(email: string, password: string) {
  if (!email || !password) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }
  if (password.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول.');
    }
    throw new Error(error.message);
  }
  return data;
}

/**
 * Sign up using user-selected email and password with minimum length enforcement.
 */
export async function authSignUp(
  email: string,
  password: string,
  metadata?: { fullName?: string; phone?: string; role?: string }
) {
  if (!email || !password) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }
  if (password.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: metadata?.fullName || '',
        phone: metadata?.phone || '',
        role: metadata?.role || 'resident',
      },
    },
  });
  if (error) {
    if (error.message.includes('User already registered')) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول.');
    }
    throw new Error(error.message);
  }
  return data;
}

/**
 * Sign out from Supabase Auth.
 */
export async function authSignOut() {
  return supabase.auth.signOut();
}

/**
 * Secure RPC wrappers that NEVER pass admin_id or super_admin_id as exposed parameters.
 * All caller identity checks rely strictly on Supabase's built-in auth.uid() on the server.
 */
export const secureRpc = {
  /**
   * Admin creates a new building and receives a 60-day Pro trial + unique building_code
   */
  async createBuildingForAdmin(params: {
    fullName: string;
    phone: string;
    buildingName: string;
    address: string;
    totalApartments: number;
    defaultMonthlyDues: number;
    adminApartmentNumber: string;
    registrationNumber?: string;
  }) {
    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
      throw new Error('يجب تسجيل الدخول أولاً بحساب معتمد لإنشاء العقار.');
    }
    return supabase.rpc('create_building_for_admin', {
      p_full_name: params.fullName,
      p_phone: params.phone,
      p_building_name: params.buildingName,
      p_address: params.address,
      p_total_apartments: params.totalApartments,
      p_default_monthly_dues: params.defaultMonthlyDues,
      p_admin_apartment_number: params.adminApartmentNumber,
      p_registration_number: params.registrationNumber ?? null,
    });
  },

  /**
   * Resident requests to join a building using building_code and apartment_number (status = 'pending')
   */
  async requestJoinBuilding(params: {
    fullName: string;
    phone: string;
    buildingCode: string;
    apartmentNumber: string;
    floorNumber?: string;
    residencyType?: 'owner_resident' | 'tenant' | 'non_resident_owner';
  }) {
    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
      throw new Error('يجب تسجيل الدخول أولاً بحساب معتمد لتقديم طلب الانضمام.');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const rpcRes = await supabase.rpc('request_join_building', {
      p_full_name: params.fullName,
      p_phone: params.phone,
      p_building_code: params.buildingCode,
      p_apartment_number: params.apartmentNumber,
      p_floor_number: params.floorNumber ?? null,
      p_residency_type: params.residencyType ?? 'owner_resident',
    });
    return {
      data: {
        ...(typeof rpcRes.data === 'object' && rpcRes.data ? rpcRes.data : {}),
        user_id: sessionData?.session?.user?.id ?? null,
      },
      error: rpcRes.error,
    };
  },

  /**
   * Admin approves or rejects a pending resident join request, optionally overriding/reassigning the apartment in one step
   */
  async reviewResidentJoinRequest(
    residentUserId: string,
    approve: boolean,
    overrideApartmentId?: string | null,
    overrideApartmentNumber?: string | null
  ) {
    const res = await supabase.rpc('review_resident_join_request', {
      p_resident_user_id: residentUserId,
      p_approve: approve,
      p_override_apartment_id: overrideApartmentId ?? null,
      p_override_apartment_number: overrideApartmentNumber ?? null,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Looks up building apartments by building_code and auto-matches phone against pre-registered occupant_phone
   */
  async lookupBuildingApartmentsForJoin(buildingCode: string, phone?: string) {
    return supabase.rpc('lookup_building_apartments_for_join', {
      p_building_code: buildingCode,
      p_phone: phone ?? null,
    });
  },

  /**
   * Transfers unpaid obligations (and optionally pre-registered occupant_name/occupant_phone) from source apartment to target apartment
   */
  async transferApartmentObligations(params: {
    sourceApartmentId: string;
    targetApartmentId: string;
    obligationIds?: string[] | null;
    transferOccupantInfo?: boolean;
  }) {
    return supabase.rpc('transfer_apartment_obligations', {
      p_source_apartment_id: params.sourceApartmentId,
      p_target_apartment_id: params.targetApartmentId,
      p_obligation_ids: params.obligationIds ?? null,
      p_transfer_occupant_info: params.transferOccupantInfo ?? false,
    });
  },

  /**
   * Resident submits a monthly dues or emergency claim payment (electronic_transfer or cash)
   * The caller is identified strictly via auth.uid() on the server.
   */
  async submitResidentPayment(params: {
    amount: number;
    paymentMethod: PaymentMethodType;
    billingMonth: string;
    cashRecipient?: CashRecipientType | null;
    receiptImageUrl?: string | null;
    paymentCategory?: PaymentCategoryType;
    emergencyClaimId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }) {
    const res = await supabase.rpc('submit_resident_payment', {
      p_amount: params.amount,
      p_payment_method: params.paymentMethod,
      p_billing_month: params.billingMonth,
      p_cash_recipient: params.cashRecipient ?? null,
      p_receipt_image_url: params.receiptImageUrl ?? null,
      p_payment_category: params.paymentCategory ?? 'monthly_dues',
      p_emergency_claim_id: params.emergencyClaimId ?? null,
      p_reference_number: params.referenceNumber ?? null,
      p_notes: params.notes ?? null,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Admin approves a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   * The admin is verified strictly via auth.uid() on the server.
   */
  async approveResidentPayment(paymentId: string) {
    const res = await supabase.rpc('approve_resident_payment', {
      p_payment_id: paymentId,
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Admin rejects a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   * The admin is verified strictly via auth.uid() on the server.
   */
  async rejectResidentPayment(paymentId: string, rejectionReason?: string) {
    const res = await supabase.rpc('reject_resident_payment', {
      p_payment_id: paymentId,
      p_rejection_reason:
        rejectionReason ?? 'بيانات الإيصال غير واضحة أو لم يصل التحويل',
    });
    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Admin creates an emergency claim with equal or custom share distribution
   * The admin is verified strictly via auth.uid() and building association is resolved from DB.
   */
  async createEmergencyClaim(params: {
    title: string;
    description: string;
    category: string;
    targetAmount: number;
    distributionType: ClaimDistributionType;
    customShares?: Array<{ apartment_id: string; amount: number }> | null;
    dueDate?: string | null;
    defaultShareAmount?: number | null;
    occupiedOnly?: boolean;
  }) {
    const res = await supabase.rpc('create_emergency_claim', {
      p_title: params.title,
      p_description: params.description,
      p_category: params.category,
      p_target_amount: params.targetAmount,
      p_distribution_type: params.distributionType,
      p_custom_shares: params.customShares ?? null,
      p_due_date: params.dueDate ?? null,
      p_default_share_amount: params.defaultShareAmount ?? null,
      p_occupied_only: params.occupiedOnly ?? false,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return res;
  },

  /**
   * Admin records a building expense and deducts from fund_balance
   */
  async recordBuildingExpense(params: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    expenseDate?: string;
    invoiceImageUrl?: string | null;
    invoiceNumber?: string | null;
    voucherNumber?: string | null;
  }) {
    return supabase.rpc('record_building_expense', {
      p_title: params.title,
      p_amount: params.amount,
      p_category: params.category,
      p_description: params.description ?? null,
      p_expense_date: params.expenseDate ?? new Date().toISOString().slice(0, 10),
      p_invoice_image_url: params.invoiceImageUrl ?? null,
      p_invoice_number: params.invoiceNumber ?? null,
      p_voucher_number: params.voucherNumber ?? null,
    });
  },

  /**
   * Alias for recordBuildingExpense to maintain backward compatibility
   */
  async createExpense(params: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    expenseDate?: string;
    invoiceImageUrl?: string | null;
    invoiceNumber?: string | null;
    voucherNumber?: string | null;
  }) {
    return this.recordBuildingExpense(params);
  },

  /**
   * Admin uploads receipt to renew/activate the building's app subscription
   */
  async submitAppSubscriptionInvoice(params: {
    planCode: PlanTier;
    durationMonths: number;
    receiptImageUrl: string;
    notes?: string;
  }) {
    return supabase.rpc('submit_app_subscription_invoice', {
      p_plan_code: params.planCode,
      p_duration_months: params.durationMonths,
      p_receipt_image_url: params.receiptImageUrl,
      p_notes: params.notes ?? null,
    });
  },

  /**
   * Super Admin activates a building's subscription (via auth.uid()):
   * - Extends subscription_ends_at
   * - Automatically inserts an expense titled "رسوم اشتراك تطبيق إدارة العقار"
   *   and deducts it from the building's fund_balance.
   */
  async activateBuildingSubscription(invoiceId: string) {
    return supabase.rpc('activate_building_subscription', {
      p_invoice_id: invoiceId,
    });
  },

  /**
   * Super Admin rejects a building's app subscription invoice (via auth.uid()):
   * - Sets invoice status to 'rejected'
   * - Records rejection reason and notifies the building admin
   */
  async rejectAppSubscriptionInvoice(invoiceId: string, rejectionReason?: string) {
    return (supabase.rpc as any)('reject_app_subscription_invoice', {
      p_invoice_id: invoiceId,
      p_rejection_reason: rejectionReason ?? 'إيصال غير صالح أو لم يصل التحويل',
    });
  },

  /**
   * Super Admin customizes a building's monthly price, max apartments, and feature flags
   */
  async superAdminConfigureBuilding(params: {
    buildingId: string;
    planCode?: PlanTier;
    customMonthlyPrice?: number | null;
    clearCustomPrice?: boolean;
    maxApartmentsOverride?: number | null;
    featuresConfig?: Partial<FeaturesConfig>;
    subscriptionStatus?: BuildingSubscriptionStatus;
    extendDays?: number;
  }) {
    return supabase.rpc('super_admin_configure_building', {
      p_building_id: params.buildingId,
      p_plan_code: params.planCode ?? null,
      p_custom_monthly_price: params.customMonthlyPrice ?? null,
      p_clear_custom_price: params.clearCustomPrice ?? false,
      p_max_apartments_override: params.maxApartmentsOverride ?? null,
      p_features_config: params.featuresConfig ?? null,
      p_subscription_status: params.subscriptionStatus ?? null,
      p_extend_days: params.extendDays ?? 0,
    });
  },

  /**
   * Saves the current user's Expo Push Token in public.users via auth.uid()
   */
  async saveUserPushToken(pushToken: string) {
    return supabase.rpc('save_user_push_token', {
      p_push_token: pushToken,
    });
  },

  /**
   * Bulk Reminder: Sends a notification to all unpaid apartments for the specified billing month
   * and returns their push tokens for immediate Expo Push delivery.
   */
  async sendBulkUnpaidReminder(billingMonth: string, customMessage?: string) {
    return supabase.rpc('send_bulk_unpaid_reminder', {
      p_billing_month: billingMonth,
      p_custom_message: customMessage ?? null,
    });
  },

  /**
   * Marks all unread notifications for the current user (auth.uid()) as read
   */
  async markAllNotificationsRead() {
    return (supabase.rpc as any)('mark_all_notifications_read');
  },

  /**
   * Community Hub: Create building issue / complaint
   */
  async createBuildingIssue(params: {
    buildingId: string;
    title: string;
    description?: string | null;
    category?: string;
    severity?: string;
    imageUrl?: string | null;
    isPrivate?: boolean;
    preferredTime?: string;
    whatsappNotifications?: boolean;
  }) {
    return (supabase.rpc as any)('create_building_issue', {
      p_building_id: params.buildingId,
      p_title: params.title,
      p_description: params.description ?? null,
      p_category: params.category ?? 'المصعد',
      p_severity: params.severity ?? 'medium',
      p_image_url: params.imageUrl ?? null,
      p_is_private: params.isPrivate ?? false,
      p_preferred_time: params.preferredTime ?? 'any',
      p_whatsapp_notifications: params.whatsappNotifications ?? true,
    });
  },

  /**
   * Community Hub: Toggle issue upvote (1 vote per apartment unit)
   */
  async toggleIssueUpvote(issueId: string) {
    return (supabase.rpc as any)('toggle_issue_upvote', {
      p_issue_id: issueId,
    });
  },

  /**
   * Community Hub: Update issue status (open, in_progress, resolved)
   */
  async updateIssueStatus(issueId: string, status: string) {
    return (supabase.rpc as any)('update_issue_status', {
      p_issue_id: issueId,
      p_status: status,
    });
  },

  /**
   * Community Hub: Create building poll / collective decision
   */
  async createBuildingPoll(params: {
    buildingId: string;
    title: string;
    description?: string | null;
    category?: string;
    estimatedCost?: number;
    sharePerUnit?: number;
    quorumPercent?: number;
    durationDays?: number;
    options?: any[];
    documentUrl?: string | null;
    isUrgent?: boolean;
  }) {
    return (supabase.rpc as any)('create_building_poll', {
      p_building_id: params.buildingId,
      p_title: params.title,
      p_description: params.description ?? null,
      p_category: params.category ?? 'عام',
      p_estimated_cost: params.estimatedCost ?? 0,
      p_share_per_unit: params.sharePerUnit ?? 0,
      p_quorum_percent: params.quorumPercent ?? 51,
      p_duration_days: params.durationDays ?? 7,
      p_options: params.options ?? null,
      p_document_url: params.documentUrl ?? null,
      p_is_urgent: params.isUrgent ?? false,
    });
  },

  /**
   * Community Hub: Cast poll vote (1 vote per apartment unit)
   */
  async castPollVote(pollId: string, choice: string) {
    return (supabase.rpc as any)('cast_poll_vote', {
      p_poll_id: pollId,
      p_choice: choice,
    });
  },

  /**
   * Testing & Dev Tool: Reset building data (residents_only) or delete building completely (full_delete)
   */
  async resetBuildingData(buildingId: string, mode: 'residents_only' | 'full_delete') {
    return (supabase.rpc as any)('reset_building_data', {
      p_building_id: buildingId,
      p_mode: mode,
    });
  },
};


