'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  ZoomIn,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { AppSubscriptionInvoice } from '@/types/database';

export default function SubscriptionInvoicesPage() {
  const {
    invoices,
    reviewSubscriptionInvoice,
    processingIds,
  } = useDashboard();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewInvoice, setPreviewInvoice] =
    useState<AppSubscriptionInvoice | null>(null);
  const [rejectingInvoice, setRejectingInvoice] =
    useState<AppSubscriptionInvoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(
    'صورة إيصال التحويل غير واضحة أو المبلغ المحول غير مطابق لقيمة الباقة'
  );

  const filteredInvoices = invoices.filter((inv) =>
    statusFilter === 'all' ? true : inv.status === statusFilter
  );

  const handleApproveAndActivate = async (inv: AppSubscriptionInvoice) => {
    await reviewSubscriptionInvoice({
      invoiceId: inv.id,
      approve: true,
    });
    if (previewInvoice?.id === inv.id) {
      setPreviewInvoice(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingInvoice) return;

    await reviewSubscriptionInvoice({
      invoiceId: rejectingInvoice.id,
      approve: false,
      rejectionReason: rejectionReason.trim(),
    });
    setRejectingInvoice(null);
    setPreviewInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B]">
            مركز مراجعة فواتير اشتراك التطبيق والتفعيل الذكي
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مراجعة إيصالات التحويل (`subscription-receipts`) وتفعيل اشتراك العمارة مع
            إدراج مصروف تلقائي في ميزانية العمارة (`activate_building_subscription` RPC)
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {st === 'all'
                ? 'كل الفواتير'
                : st === 'pending'
                ? 'بانتظار المراجعة (Pending)'
                : st === 'approved'
                ? 'معتمدة ومفعلة (Approved)'
                : 'مرفوضة (Rejected)'}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Expense Architecture Explanation Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">
              آلية التفعيل الذكي والمصروف التلقائي (`activate_building_subscription` RPC)
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              بضغطة زر واحدة على <strong>&quot;اعتماد وتفعيل الاشتراك&quot;</strong>: (1) تتحول الفاتورة إلى{' '}
              <code>approved</code> مع حماية Idempotency، (2) تتفعل العمارة إلى{' '}
              <code>active</code> ويتمدد تاريخ الانتهاء، (3) يُدرج تلقائياً مصروف في جدول{' '}
              <code>expenses</code> بعنوان <em>&quot;رسوم اشتراك تطبيق إدارة العقار&quot;</em> ويُخصم من رصيد خزينة العمارة مع إرفاق نفس صورة الإيصال ليظهر للسكان في شاشة الشفافية.
            </p>
          </div>
        </div>
      </div>

      {/* Invoices Cards / Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredInvoices.map((inv) => {
          const isProcessing = Boolean(processingIds[`inv_${inv.id}`]);

          return (
            <div
              key={inv.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col justify-between ${
                inv.status === 'pending'
                  ? 'border-2 border-[#F59E0B]'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Top Bar */}
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-[#1E293B]">
                        {inv.building_name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                        {inv.building_code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      رئيس الاتحاد: <strong>{inv.admin_name}</strong> ({inv.admin_phone})
                    </p>
                  </div>

                  {inv.status === 'pending' ? (
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-[#F59E0B] border border-amber-300 text-xs font-extrabold">
                      بانتظار المراجعة
                    </span>
                  ) : inv.status === 'approved' ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#10B981] border border-emerald-300 text-xs font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مفعل ومخصوم تلقائياً
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-red-50 text-[#EF4444] border border-red-300 text-xs font-extrabold">
                      مرفوض
                    </span>
                  )}
                </div>

                {/* Details & Receipt Preview Strip */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  {/* Receipt Thumbnail with Zoom */}
                  <div
                    onClick={() => setPreviewInvoice(inv)}
                    className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-100"
                  >
                    <img
                      src={inv.receipt_image_url}
                      alt="إيصال التحويل"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold flex items-center gap-1 shadow">
                        <ZoomIn className="w-4 h-4 text-[#F97316]" />
                        تكبير الإيصال
                      </span>
                    </div>
                  </div>

                  {/* Invoice Financial Details */}
                  <div className="sm:col-span-2 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">المبلغ المحول:</span>
                      <span className="text-lg font-extrabold text-[#1E293B]">
                        {inv.amount.toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">الباقة والمدة المطلوبة:</span>
                      <span className="font-extrabold text-[#10B981] uppercase">
                        باقة {inv.plan_code} • لمدة ({inv.duration_months}) شهر
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">وسيلة الدفع والمرجع:</span>
                      <span className="font-bold text-slate-800">
                        {inv.payment_method} ({inv.reference_number || 'بدون مرجع'})
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">تاريخ الرفع:</span>
                      <span className="text-slate-700 font-medium">
                        {inv.created_at.slice(0, 10)}
                      </span>
                    </div>

                    {inv.status === 'rejected' && inv.rejection_reason && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[#EF4444] font-bold">
                        سبب الرفض: {inv.rejection_reason}
                      </div>
                    )}

                    {inv.status === 'approved' && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#10B981] shrink-0" />
                        <span>
                          تم قيد المصروف التلقائي في خزينة العمارة برقم ({inv.auto_expense_id || 'SYS-AUTO'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(inv)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4 text-[#1E293B]" />
                  استعراض صورة الإيصال مكبرة
                </button>

                {inv.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectingInvoice(inv);
                        setRejectionReason(
                          'صورة إيصال التحويل غير واضحة أو المبلغ غير مطابق'
                        );
                      }}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#EF4444] border border-red-200 text-xs font-extrabold transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      رفض الإيصال
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApproveAndActivate(inv)}
                      className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isProcessing
                        ? 'جاري التفعيل...'
                        : 'اعتماد وتفعيل الاشتراك'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* High-Res Receipt Image Preview Modal */}
      {/* ==================================================================== */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#1E293B] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold">
                  معاينة إيصال اشتراك التطبيق • {previewInvoice.building_name}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  المبلغ: {previewInvoice.amount.toLocaleString()} ج.م • المدة:{' '}
                  {previewInvoice.duration_months} شهر • الباقة:{' '}
                  {previewInvoice.plan_code.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 max-h-[60vh] flex items-center justify-center">
                <img
                  src={previewInvoice.receipt_image_url}
                  alt="صورة إيصال الاشتراك"
                  className="max-h-[58vh] w-auto object-contain"
                />
              </div>

              {previewInvoice.status === 'pending' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingInvoice(previewInvoice);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#EF4444] border border-red-200 text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    رفض الإيصال مع ذكر السبب
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveAndActivate(previewInvoice)}
                    className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    اعتماد وتفعيل الاشتراك وإدراج المصروف التلقائي
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Reject Invoice Modal (with Rejection Reason for Building Admin) */}
      {/* ==================================================================== */}
      {rejectingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#EF4444] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-extrabold">
                  رفض إيصال اشتراك ({rejectingInvoice.building_name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingInvoice(null)}
                className="p-1 rounded-lg hover:bg-red-700 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  سبب الرفض (سيظهر لرئيس الاتحاد في إشعار التطبيق):
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#EF4444] hover:bg-red-700 text-white text-xs font-extrabold"
                >
                  تأكيد رفض الإيصال
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
