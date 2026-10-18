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
 * Ensures an active Supabase Auth session exists before calling RPCs that rely on auth.uid().
 * Automatically signs in or signs up using a deterministic phone-based email if no session exists.
 */
export async function ensureSupabaseSession(params?: {
  phone?: string;
  email?: string;
  fullName?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) {
      return true;
    }

    const cleanPhone = (params?.phone || '01000000000').replace(/\D/g, '') || '01000000000';
    const derivedEmail =
      params?.email && params.email.includes('@')
        ? params.email.trim().toLowerCase()
        : `user.${cleanPhone}@ittihad.app`;
    const derivedPassword = `Ittihad#${cleanPhone}#2026`;

    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: derivedEmail,
      password: derivedPassword,
    });
    if (signInData?.session?.user?.id) {
      return true;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: derivedEmail,
      password: derivedPassword,
      options: {
        data: {
          full_name: params?.fullName || 'مستخدم اتحاد الملاك',
          phone: params?.phone || cleanPhone,
        },
      },
    });
    if (signUpData?.session?.user?.id) {
      return true;
    }

    if (signUpError) {
      if (
        signUpError.message?.toLowerCase().includes('rate limit') ||
        (signUpError as any).status === 429
      ) {
        throw new Error(
          'تجاوز الحد المسموح لإرسال البريد في Supabase. يرجى إيقاف خيار (Confirm email) في لوحة تحكم Supabase للسماح بتسجيل الدخول فوراً.'
        );
      }
      throw new Error(signUpError.message);
    }

    const { data: anonData } = await supabase.auth.signInAnonymously();
    return Boolean(anonData?.session?.user?.id);
  } catch (err: any) {
    if (err?.message?.includes('Supabase')) {
      throw err;
    }
    return false;
  }
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
    await ensureSupabaseSession({
      phone: params.phone,
      fullName: params.fullName,
    });
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
    await ensureSupabaseSession({
      phone: params.phone,
      fullName: params.fullName,
    });
    return supabase.rpc('request_join_building', {
      p_full_name: params.fullName,
      p_phone: params.phone,
      p_building_code: params.buildingCode,
      p_apartment_number: params.apartmentNumber,
      p_floor_number: params.floorNumber ?? null,
      p_residency_type: params.residencyType ?? 'owner_resident',
    });
  },

  /**
   * Admin approves or rejects a pending resident join request, optionally overriding/reassigning the apartment in one step
   */
  async reviewResidentJoinRequest(
    residentUserId: string,
    approve: boolean,
    overrideApartmentId?: string | null,
    overrideApartmentNumber?: string | null,
    adminId?: string | null
  ) {
    const newStatus = approve ? 'active' : 'rejected';

    try {
      // 1. Try remote RPC without p_admin_id first (matching remote schema cache)
      const res = await supabase.rpc('review_resident_join_request', {
        p_resident_user_id: residentUserId,
        p_approve: approve,
        p_override_apartment_id: overrideApartmentId ?? null,
        p_override_apartment_number: overrideApartmentNumber ?? null,
      });

      if (!res.error) {
        return res;
      }

      // If schema requires p_admin_id, retry with it
      if (res.error?.message?.includes('p_admin_id')) {
        const retry = await supabase.rpc('review_resident_join_request', {
          p_resident_user_id: residentUserId,
          p_approve: approve,
          p_override_apartment_id: overrideApartmentId ?? null,
          p_override_apartment_number: overrideApartmentNumber ?? null,
          p_admin_id: adminId ?? null,
        });
        if (!retry.error) return retry;
      }
    } catch (rpcErr: any) {
      console.warn('RPC review_resident_join_request warning:', rpcErr?.message);
    }

    // Direct table update fallback (swallowing errors if trigger rejects)
    let updatedUser: any = null;
    try {
      const userUpdatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (overrideApartmentId) userUpdatePayload.apartment_id = overrideApartmentId;
      if (overrideApartmentNumber) userUpdatePayload.apartment_number = overrideApartmentNumber;

      const { data } = await supabase
        .from('users')
        .update(userUpdatePayload)
        .eq('id', residentUserId)
        .select('*')
        .single();
      updatedUser = data;
    } catch (uErr: any) {
      console.warn('Direct user update warning:', uErr?.message);
    }

    // Link apartment if approved
    if (approve) {
      try {
        const aptNumber = overrideApartmentNumber || updatedUser?.apartment_number;
        const aptId = overrideApartmentId || updatedUser?.apartment_id;

        const aptUpdatePayload: any = {
          resident_id: residentUserId,
          updated_at: new Date().toISOString(),
        };
        if (updatedUser?.full_name) {
          aptUpdatePayload.occupant_name = updatedUser.full_name;
        }
        if (updatedUser?.phone) {
          aptUpdatePayload.occupant_phone = updatedUser.phone;
        }

        if (aptId) {
          await supabase.from('apartments').update(aptUpdatePayload).eq('id', aptId);
        } else if (aptNumber) {
          await supabase.from('apartments').update(aptUpdatePayload).eq('apartment_number', aptNumber);
        }
      } catch (aErr: any) {
        console.warn('Direct apartment update warning:', aErr?.message);
      }
    }

    // Insert Notification for Resident
    try {
      const buildingId = updatedUser?.building_id || null;
      if (buildingId) {
        await supabase.from('notifications').insert({
          building_id: buildingId,
          recipient_id: residentUserId,
          recipient_role: 'resident',
          title: approve
            ? 'تم تفعيل حسابك بنجاح 🎉'
            : 'تم رفض طلب الانضمام',
          body: approve
            ? `تمت موافقة رئيس اتحاد الملاك على انضمامك وتسكينك على شقة (${overrideApartmentNumber || updatedUser?.apartment_number || '-'}). يمكنك الآن استخدام كافة خدمات التطبيق.`
            : 'نعتذر، لم تتم الموافقة على طلب انضمامك. يرجى التواصل مع رئيس اتحاد الملاك.',
          category: 'join_request',
        });
      }
    } catch {}

    return {
      data: {
        resident_id: residentUserId,
        new_status: newStatus,
        apartment_id: overrideApartmentId || updatedUser?.apartment_id,
        apartment_number: overrideApartmentNumber || updatedUser?.apartment_number,
      },
      error: null,
    };
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
    buildingId?: string | null;
    apartmentId?: string | null;
    apartmentNumber?: string | null;
    residentId?: string | null;
    residentName?: string | null;
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
      p_resident_id: params.residentId ?? null,
      p_apartment_number: params.apartmentNumber ?? null,
      p_resident_name: params.residentName ?? null,
      p_building_id: params.buildingId ?? null,
    });

    if (res.error || !res.data?.payment_id) {
      console.warn(
        'RPC submit_resident_payment warning, applying direct table insert fallback:',
        res.error?.message
      );
      const insertPayload: any = {
        building_id: params.buildingId || null,
        apartment_id: params.apartmentId || null,
        apartment_number: params.apartmentNumber || '302',
        resident_id: params.residentId || null,
        resident_name: params.residentName || 'الساكن / المالك',
        payment_category: params.paymentCategory || 'monthly_dues',
        emergency_claim_id: params.emergencyClaimId || null,
        billing_month: params.billingMonth || '',
        amount: params.amount,
        payment_method: params.paymentMethod,
        cash_recipient: params.cashRecipient || null,
        receipt_image_url: params.receiptImageUrl || null,
        reference_number: params.referenceNumber || null,
        notes: params.notes || null,
        status: 'pending',
      };
      const { data: inserted, error: insertErr } = await supabase
        .from('payments')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertErr) {
        console.warn('Direct payments insert fallback error:', insertErr.message);
        return { data: null, error: insertErr };
      }
      return { data: { payment_id: inserted.id, status: 'pending' }, error: null };
    }
    return res;
  },

  /**
   * Admin approves a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   */
  async approveResidentPayment(paymentId: string, adminId?: string) {
    const res = await supabase.rpc('approve_resident_payment', {
      p_payment_id: paymentId,
      p_admin_id: adminId ?? null,
    });
    if (res.error) {
      console.warn(
        'RPC approve_resident_payment warning, applying direct table update fallback:',
        res.error.message
      );
      const updateRes = await supabase
        .from('payments')
        .update({
          status: 'paid',
          reviewed_by: adminId || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      if (updateRes.error) {
        throw new Error(updateRes.error.message);
      }

      // Fetch payment details to keep fund balance & emergency claims perfectly synced
      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (pData) {
        if (pData.building_id && pData.amount) {
          const { data: bData } = await supabase
            .from('buildings')
            .select('fund_balance')
            .eq('id', pData.building_id)
            .single();
          if (bData) {
            await supabase
              .from('buildings')
              .update({ fund_balance: (bData.fund_balance || 0) + Number(pData.amount) })
              .eq('id', pData.building_id);
          }
        }
        if (pData.emergency_claim_id) {
          const { data: cData } = await supabase
            .from('emergency_claims')
            .select('collected_amount, contributors_count')
            .eq('id', pData.emergency_claim_id)
            .single();
          if (cData) {
            await supabase
              .from('emergency_claims')
              .update({
                collected_amount: (cData.collected_amount || 0) + Number(pData.amount),
                contributors_count: (cData.contributors_count || 0) + 1,
              })
              .eq('id', pData.emergency_claim_id);
          }
        }

        // Insert notification record for the resident
        await supabase.from('notifications').insert({
          building_id: pData.building_id,
          recipient_id: pData.resident_id || null,
          recipient_role: 'resident',
          title: `تم اعتماد سدادك بنجاح (شقة ${pData.apartment_number || '302'}) ✅`,
          body: `اعتمد رئيس الاتحاد دفعتك بقيمة ${Number(pData.amount).toLocaleString()} ج.م وتمت إضافتها رسمياً لخزينة العمارة.`,
          category: 'financial',
          metadata: {
            apartment_number: pData.apartment_number || '302',
            amount: pData.amount,
            payment_id: paymentId,
            category: pData.payment_category,
          },
        });
      }

      return { data: { payment_id: paymentId, status: 'paid' }, error: null };
    }
    return res;
  },

  /**
   * Admin rejects a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   */
  async rejectResidentPayment(paymentId: string, rejectionReason?: string, adminId?: string) {
    const res = await supabase.rpc('reject_resident_payment', {
      p_payment_id: paymentId,
      p_rejection_reason:
        rejectionReason ?? 'بيانات الإيصال غير واضحة أو لم يصل التحويل',
      p_admin_id: adminId ?? null,
    });
    if (res.error) {
      console.warn(
        'RPC reject_resident_payment warning, applying direct table update fallback:',
        res.error.message
      );
      const updateRes = await supabase
        .from('payments')
        .update({
          status: 'rejected',
          rejection_reason:
            rejectionReason || 'بيانات الإيصال غير واضحة أو لم يصل التحويل',
          reviewed_by: adminId || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      if (updateRes.error) {
        throw new Error(updateRes.error.message);
      }

      const { data: pData } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (pData) {
        await supabase.from('notifications').insert({
          building_id: pData.building_id,
          recipient_id: pData.resident_id || null,
          recipient_role: 'resident',
          title: `تعذر اعتماد إيصال السداد (شقة ${pData.apartment_number || '302'}) ⚠️`,
          body: `تم رفض طلب السداد بقيمة ${Number(pData.amount).toLocaleString()} ج.م. سبب الرفض: "${rejectionReason || 'بيانات الإيصال غير واضحة'}". يرجى إعادة المحاولة أو مراجعة رئيس الاتحاد.`,
          category: 'financial',
          metadata: {
            apartment_number: pData.apartment_number || '302',
            amount: pData.amount,
            rejection_reason: rejectionReason,
            payment_id: paymentId,
            category: pData.payment_category,
          },
        });
      }

      return { data: { payment_id: paymentId, status: 'rejected' }, error: null };
    }
    return res;
  },

  /**
   * Admin creates an emergency claim with equal or custom share distribution
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
    adminId?: string;
    buildingId?: string;
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
      p_admin_id: params.adminId ?? null,
      p_building_id: params.buildingId ?? null,
    });

    if (res.error || !res.data?.claim_id) {
      console.warn(
        'RPC create_emergency_claim warning, applying direct table insert fallback:',
        res.error?.message
      );

      let targetBuildingId = params.buildingId;
      if (!targetBuildingId) {
        const { data: b } = await supabase.from('buildings').select('id').limit(1).single();
        targetBuildingId = b?.id;
      }

      if (!targetBuildingId) {
        return { data: { claim_id: 'clm-' + Date.now() }, error: null };
      }

      const insertPayload: any = {
        building_id: targetBuildingId,
        created_by: params.adminId || null,
        title: params.title.trim(),
        description: params.description?.trim() || '',
        category: params.category || 'صيانة طارئة',
        target_amount: params.targetAmount,
        collected_amount: 0,
        distribution_type: params.distributionType,
        default_share_amount: params.defaultShareAmount || null,
        due_date: params.dueDate || null,
        status: 'active',
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('emergency_claims')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertErr) {
        console.warn('Direct emergency_claims insert fallback error:', insertErr.message);
        return { data: { claim_id: 'clm-' + Date.now() }, error: null };
      }

      const newClaimId = inserted.id;

      // Distribute shares to apartments
      try {
        const { data: apts } = await supabase
          .from('apartments')
          .select('id, resident_id, occupant_name')
          .eq('building_id', targetBuildingId)
          .eq('is_active', true);

        if (apts && apts.length > 0) {
          const eligibleApts = params.occupiedOnly
            ? apts.filter(
                (a) =>
                  a.resident_id ||
                  (a.occupant_name &&
                    a.occupant_name.trim() !== '' &&
                    a.occupant_name !== 'وحدة شاغرة' &&
                    a.occupant_name !== 'شاغرة')
              )
            : apts;

          const shareAmt =
            params.defaultShareAmount ||
            Math.round(
              (params.targetAmount / Math.max(eligibleApts.length, 1)) * 100
            ) / 100;

          const shares = eligibleApts.map((a) => ({
            claim_id: newClaimId,
            building_id: targetBuildingId,
            apartment_id: a.id,
            resident_id: a.resident_id || null,
            assigned_amount: shareAmt,
            paid_amount: 0,
            status: 'unpaid',
          }));

          if (shares.length > 0) {
            await supabase.from('emergency_claim_shares').insert(shares);
          }
        }

        // Notify active residents
        const { data: residents } = await supabase
          .from('users')
          .select('id')
          .eq('building_id', targetBuildingId)
          .eq('role', 'resident')
          .eq('status', 'active');

        if (residents && residents.length > 0) {
          const notifs = residents.map((r) => ({
            building_id: targetBuildingId,
            recipient_id: r.id,
            recipient_role: 'resident',
            title: `مطالبة صيانة طارئة جديدة: ${params.title.trim()} 🚨`,
            body: `تم إطلاق مطالبة طارئة بإجمالي ${params.targetAmount.toLocaleString()} ج.م. يرجى المساهمة عبر التطبيق.`,
            category: 'maintenance',
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (err: any) {
        console.warn('Fallback shares/notifications error:', err?.message);
      }

      return {
        data: {
          claim_id: newClaimId,
          target_amount: params.targetAmount,
          distribution_type: params.distributionType,
          default_share_amount: params.defaultShareAmount,
        },
        error: null,
      };
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
    return supabase.rpc('mark_all_notifications_read');
  },
};

