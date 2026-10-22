import { supabase, toResult } from '@/data/supabase/client';
import type { Payment } from '@/shared/types/database';
import type { PaymentsRepository } from '../domain/payments.repository';
import type { CashRecipientType, PaymentCategoryType, PaymentMethodType } from '@/shared/types/database';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabasePaymentsRepository: PaymentsRepository = {
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
    return toResult(res);
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
    return toResult(res);
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
    return toResult(res);
  },

  /**
   * Bulk Reminder: Sends a notification to all unpaid apartments for the specified billing month
   * and returns their push tokens for immediate Expo Push delivery.
   */
  async sendBulkUnpaidReminder(billingMonth: string, customMessage?: string) {
    return toResult(await supabase.rpc('send_bulk_unpaid_reminder', {
      p_billing_month: billingMonth,
      p_custom_message: customMessage ?? null,
    }));
  },

  async list() {
    return toResult<Payment[]>(await supabase.from('payments').select('*').order('created_at', { ascending: false }));
  },

  async insert(row) {
    return toResult<null>(await supabase.from('payments').insert(row));
  },

  async insertReturningId(row) {
    return toResult<{ id: string }>(await supabase.from('payments').insert(row).select('id').maybeSingle());
  },

  async update(id, patch) {
    return toResult<null>(await supabase.from('payments').update(patch).eq('id', id));
  },
};
