import type { RepoResult, RowPatch } from '@/data/result';
import type { Payment } from '@/shared/types/database';
import type { CashRecipientType, PaymentCategoryType, PaymentMethodType } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface PaymentsRepository {
  /**
   * Resident submits a monthly dues or emergency claim payment (electronic_transfer or cash)
   * The caller is identified strictly via auth.uid() on the server.
   */
  submitResidentPayment(params: {
    amount: number;
    paymentMethod: PaymentMethodType;
    billingMonth: string;
    cashRecipient?: CashRecipientType | null;
    receiptImageUrl?: string | null;
    paymentCategory?: PaymentCategoryType;
    emergencyClaimId?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  }): Promise<RepoResult<any>>;
  /**
   * Admin approves a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   * The admin is verified strictly via auth.uid() on the server.
   */
  approveResidentPayment(paymentId: string): Promise<RepoResult<any>>;
  /**
   * Admin rejects a pending resident payment (Idempotent: checks status = 'pending' with FOR UPDATE)
   * The admin is verified strictly via auth.uid() on the server.
   */
  rejectResidentPayment(paymentId: string, rejectionReason?: string): Promise<RepoResult<any>>;
  /**
   * Bulk Reminder: Sends a notification to all unpaid apartments for the specified billing month
   * and returns their push tokens for immediate Expo Push delivery.
   */
  sendBulkUnpaidReminder(billingMonth: string, customMessage?: string): Promise<RepoResult<any>>;

  list(): Promise<RepoResult<Payment[]>>;
  insert(row: RowPatch): Promise<RepoResult<null>>;
  /** Inserts and returns only the new id. */
  insertReturningId(row: RowPatch): Promise<RepoResult<{ id: string }>>;
  update(id: string, patch: RowPatch): Promise<RepoResult<null>>;
}
