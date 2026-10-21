import { useCallback } from 'react';
import type { CashRecipientType, Payment, PaymentCategoryType, PaymentMethodType } from '@/shared/types/database';
import { isSupabaseConfigured, supabase } from '@/shared/lib/supabase';
import { paymentsApi } from '../infrastructure/payments.api';
import { isUuid } from '@/shared/utils/uuid';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'currentBuilding'
  | 'usersByRole'
  | 'currentUser'
  | 'payments'
  | 'setPayments'
  | 'setApartmentObligations'
  | 'setApartments'
  | 'pushAndRecordNotification'
  | 'isCurrentBuildingWritable'
  | 'processingIds'
  | 'setProcessingIds'
  | 'apartments'
  | 'setBuildings'
  | 'setEmergencyClaims'
  | 'apartmentObligations'
  | 'loadDataFromSupabase'
>;

export function usePaymentActions({
  currentBuilding,
  usersByRole,
  currentUser,
  payments,
  setPayments,
  setApartmentObligations,
  setApartments,
  pushAndRecordNotification,
  isCurrentBuildingWritable,
  processingIds,
  setProcessingIds,
  apartments,
  setBuildings,
  setEmergencyClaims,
  apartmentObligations,
  loadDataFromSupabase,
}: Deps) {
  // 4. Scenario 1B: Resident submits payment (monthly dues, emergency claim, or arrears/obligation) ➔ Immediate Push Notification to Admin!
  const submitResidentPayment = useCallback(
    async (input: {
      amount: number;
      paymentMethod: PaymentMethodType;
      billingMonth: string;
      cashRecipient?: CashRecipientType;
      receiptImageUrl?: string;
      paymentCategory?: PaymentCategoryType;
      emergencyClaimId?: string;
      referenceNumber?: string;
      notes?: string;
      obligationId?: string;
      obligationTitle?: string;
      isArrears?: boolean;
    }) => {
      if (
        input.paymentMethod === 'electronic_transfer' &&
        !currentBuilding.features_config.receipt_upload
      ) {
        throw new Error(
          'ميزة رفع إيصالات التحويل الإلكتروني غير مفعلة في باقة العمارة الحالية.'
        );
      }

      const resident = usersByRole.resident;
      const effectiveResidentApt = resident.apartment_number || currentUser.apartment_number || '-';
      const category = input.paymentCategory || 'monthly_dues';

      // 1. Normalize billing month (YYYY-MM)
      let normalizedMonth = (input.billingMonth || '').trim();
      if (/^(0[1-9]|1[0-2])-([0-9]{4})$/.test(normalizedMonth)) {
        const [mm, yyyy] = normalizedMonth.split('-');
        normalizedMonth = `${yyyy}-${mm}`;
      } else if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
        normalizedMonth = new Date().toISOString().slice(0, 7);
      }

      // 2. Pre-flight Idempotency & Duplicate Check
      const existingPayment = payments.find((p) => {
        if (p.building_id !== currentBuilding.id) return false;
        if (p.status !== 'pending' && p.status !== 'paid') return false;

        const isSameApartment =
          (p.apartment_number &&
            effectiveResidentApt &&
            String(p.apartment_number).trim() ===
              String(effectiveResidentApt).trim()) ||
          (p.apartment_id && p.apartment_id === resident.apartment_id) ||
          p.resident_id === resident.id;

        if (!isSameApartment) return false;

        if (input.obligationId) {
          // If paying a specific obligation, block only if this specific obligation is already pending or paid
          return p.notes
            ? p.notes.includes(input.obligationId) ||
                (Boolean(input.obligationTitle) && p.notes.includes(input.obligationTitle!))
            : false;
        } else if (input.isArrears) {
          // If paying arrears / partial, only block if there is a pending arrears payment with the exact same amount
          return (
            p.status === 'pending' &&
            Boolean(p.notes && p.notes.includes('مديونية')) &&
            p.amount === input.amount
          );
        } else if (category === 'emergency_claim') {
          return (
            p.payment_category === 'emergency_claim' &&
            Boolean(input.emergencyClaimId) &&
            p.emergency_claim_id === input.emergencyClaimId
          );
        } else {
          return (
            p.payment_category === 'monthly_dues' &&
            Boolean(normalizedMonth) &&
            p.billing_month === normalizedMonth &&
            (!p.notes || (!p.notes.includes('مديونية') && !p.notes.includes('[سداد بند:')))
          );
        }
      });

      if (existingPayment) {
        if (existingPayment.status === 'paid') {
          throw new Error(
            'تم سداد هذا الالتزام مسبقاً ومعتمد في سجلات الخزينة.'
          );
        } else {
          throw new Error(
            'لديك طلب سداد قيد المراجعة بالفعل لهذا البند/الشهر. يرجى انتظار اعتماد رئيس الاتحاد.'
          );
        }
      }

      // 3. Supabase RPC Submission with Fallback
      let serverPaymentId: string | null = null;
      if (isSupabaseConfigured) {
        try {
          const rpcRes = await paymentsApi.submitResidentPayment({
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            billingMonth: normalizedMonth,
            cashRecipient: input.cashRecipient,
            receiptImageUrl: input.receiptImageUrl,
            paymentCategory: category === 'other' ? 'monthly_dues' : category,
            emergencyClaimId: input.emergencyClaimId,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
          });
          if (rpcRes?.data?.payment_id) {
            serverPaymentId = String(rpcRes.data.payment_id);
          }
        } catch (rpcErr: any) {
          console.warn('submitResidentPayment RPC error:', rpcErr);
          // If RPC rejected due to legacy month duplicate constraint (e.g. migration 017 not yet run),
          // fallback to direct insert so obligation payments proceed seamlessly
          if (
            (rpcErr?.message?.includes('لا يمكن تكرار المعاملة') || rpcErr?.message?.includes('duplicate')) &&
            input.obligationId
          ) {
            try {
              const { data: directPay, error: directErr } = await supabase
                .from('payments')
                .insert({
                  building_id: currentBuilding.id,
                  apartment_id: resident.apartment_id,
                  apartment_number: effectiveResidentApt,
                  resident_id: resident.id,
                  resident_name: resident.full_name || 'الساكن / المالك',
                  payment_category: category === 'other' ? 'monthly_dues' : category,
                  billing_month: normalizedMonth,
                  amount: input.amount,
                  payment_method: input.paymentMethod,
                  cash_recipient: input.cashRecipient || null,
                  receipt_image_url: input.receiptImageUrl || null,
                  reference_number: input.referenceNumber || '#IP-' + Math.floor(10000 + Math.random() * 90000),
                  notes: input.notes,
                  status: 'pending',
                })
                .select('id')
                .maybeSingle();

              if (directPay?.id) {
                serverPaymentId = directPay.id;
              } else if (directErr) {
                console.warn('Direct fallback insert payments error:', directErr);
              }
            } catch (fallbackErr) {
              console.warn('Fallback payments insert error:', fallbackErr);
            }
          } else {
            throw rpcErr;
          }
        }
      }

      const assignedPaymentId = serverPaymentId || ('pay-' + Date.now());
      const newPayment: Payment = {
        id: assignedPaymentId,
        building_id: currentBuilding.id,
        apartment_id: resident.apartment_id,
        apartment_number: effectiveResidentApt,
        resident_id: resident.id,
        resident_name: resident.full_name || 'الساكن / المالك',
        payment_category: category,
        emergency_claim_id: input.emergencyClaimId || null,
        billing_month: normalizedMonth,
        amount: input.amount,
        payment_method: input.paymentMethod,
        cash_recipient: input.cashRecipient || null,
        receipt_image_url: input.receiptImageUrl || null,
        reference_number:
          input.referenceNumber ||
          '#IP-' + Math.floor(10000 + Math.random() * 90000),
        notes:
          input.notes ||
          (input.paymentMethod === 'cash'
            ? `تسليم كاش لـ ${input.cashRecipient === 'admin' ? 'رئيس الاتحاد' : 'حارس العمارة'}`
            : 'تحويل إلكتروني / إنستاباي مرفق بالإيصال'),
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setPayments((prev) => [newPayment, ...prev]);

      // If paying a specific obligation, immediately mark it as 'pending' so it blurs and awaits admin review
      if (input.obligationId) {
        setApartmentObligations((prev) =>
          prev.map((o) =>
            o.id === input.obligationId ? { ...o, status: 'pending' as const } : o
          )
        );
        if (isSupabaseConfigured && isUuid(input.obligationId)) {
          supabase
            .from('apartment_obligations')
            .update({ status: 'pending' })
            .eq('id', input.obligationId)
            .then(() => {});
        }
      }

      // Update apartment status to pending review if regular monthly dues
      if (category === 'monthly_dues' && !input.isArrears && !input.obligationId) {
        setApartments((prev) =>
          prev.map((apt) =>
            apt.apartment_number === effectiveResidentApt
              ? { ...apt, payment_status: 'pending' }
              : apt
          )
        );
      }

      // Notification details
      let paymentTypeAr = '';
      if (input.obligationId) {
        paymentTypeAr = `سداد بند (${input.obligationTitle || 'التزام محدد'})`;
      } else if (input.isArrears) {
        paymentTypeAr = `سداد مديونية / متأخرات (${input.amount.toLocaleString()} ج.م)`;
      } else if (category === 'emergency_claim') {
        paymentTypeAr = 'مساهمة مطالبة صيانة طارئة';
      } else {
        paymentTypeAr = `اشتراك شهر (${normalizedMonth})`;
      }

      const methodAr =
        input.paymentMethod === 'electronic_transfer'
          ? 'تحويل إلكتروني مرفق بصورة الإيصال'
          : `سداد نقدي (كاش طرف ${input.cashRecipient === 'admin' ? 'رئيس الاتحاد' : 'حارس العمارة'})`;

      await pushAndRecordNotification({
        recipientId: usersByRole.admin.id,
        recipientRole: 'admin',
        recipientPushToken: usersByRole.admin.push_token,
        buildingId: currentBuilding.id,
        title: `إيصال سداد جديد — شقة ${effectiveResidentApt} 💳`,
        body: `قام (${resident.full_name || 'الساكن'}) برفع طلب ${paymentTypeAr} بقيمة ${input.amount.toLocaleString()} ج.م عبر (${methodAr}) بانتظار مراجعتك.`,
        category: 'financial',
        badgeLabel:
          category === 'emergency_claim'
            ? 'سداد طوارئ جديد'
            : input.isArrears || input.obligationId
            ? 'سداد مديونية'
            : 'إيصال للمراجعة',
        isUrgent: category === 'emergency_claim',
        metadata: {
          apartment_number: effectiveResidentApt,
          amount: input.amount,
          payment_id: newPayment.id,
          category,
          obligation_id: input.obligationId,
        },
      });
    },
    [
      currentUser.apartment_number,
      currentBuilding,
      payments,
      pushAndRecordNotification,
      usersByRole.admin,
      usersByRole.resident,
    ]
  );

  // 5. Scenario 2A (Approve): Admin approves resident payment ➔ Immediate Push Notification to Resident!
  const approveResidentPayment = useCallback(
    async (paymentId: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). لا يمكن اعتماد معاملات مالية قبل تجديد الاشتراك.'
        );
      }

      if (processingIds[paymentId]) {
        throw new Error('جاري معالجة هذا الطلب بالفعل...');
      }

      const targetPayment = payments.find((p) => p.id === paymentId);
      if (!targetPayment) {
        throw new Error('طلب السداد غير موجود.');
      }

      if (targetPayment.status !== 'pending') {
        throw new Error(
          `منع التكرار المزدوج (Idempotency): تمت معالجة هذا الطلب مسبقاً وحالته (${targetPayment.status}).`
        );
      }

      setProcessingIds((prev) => ({ ...prev, [paymentId]: true }));

      try {
        const isUuid = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        if (isSupabaseConfigured && isUuid(paymentId)) {
          try {
            await paymentsApi.approveResidentPayment(paymentId);
          } catch (rpcErr: any) {
            console.warn('approveResidentPayment RPC warning:', rpcErr);
            // If the RPC threw because of column mismatch (e.g. payment_status on apartments), fallback to direct updates
            if (rpcErr?.message?.includes('payment_status') || rpcErr?.message?.includes('column')) {
              try {
                await supabase
                  .from('payments')
                  .update({
                    status: 'paid',
                    reviewed_by: usersByRole.admin.id,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq('id', paymentId);

                await supabase
                  .from('buildings')
                  .update({
                    fund_balance: currentBuilding.fund_balance + targetPayment.amount,
                  })
                  .eq('id', targetPayment.building_id);
              } catch (fallbackErr) {
                console.warn('Fallback direct approve error:', fallbackErr);
              }
            } else {
              throw rpcErr;
            }
          }
        }

        const effectiveAptNum =
          targetPayment.apartment_number ||
          apartments.find((a) => a.id === targetPayment.apartment_id)?.apartment_number ||
          '-';

        // 1. Update payment status to 'paid' and clean up matching in-flight duplicates
        setPayments((prev) =>
          prev.map((p) => {
            if (p.id === paymentId) {
              return {
                ...p,
                apartment_number: effectiveAptNum || p.apartment_number,
                status: 'paid',
                reviewed_by: usersByRole.admin.id,
                reviewed_at: new Date().toISOString(),
              };
            }
            const isSameApt =
              (p.apartment_number && effectiveAptNum && String(p.apartment_number).trim() === String(effectiveAptNum).trim()) ||
              (p.resident_id && targetPayment.resident_id && p.resident_id === targetPayment.resident_id);
            if (isSameApt && p.payment_category === targetPayment.payment_category) {
              if (
                targetPayment.payment_category === 'emergency_claim' &&
                p.emergency_claim_id === targetPayment.emergency_claim_id
              ) {
                return { ...p, status: 'paid' };
              }
              if (p.billing_month === targetPayment.billing_month && !p.notes?.includes('مديونية')) {
                return { ...p, status: 'paid' };
              }
            }
            return p;
          })
        );

        // 2. Increase building fund_balance atomically
        setBuildings((prev) =>
          prev.map((b) =>
            b.id === targetPayment.building_id
              ? { ...b, fund_balance: b.fund_balance + targetPayment.amount }
              : b
          )
        );

        // 3. Update apartment status or emergency claim progress bar
        if (
          targetPayment.payment_category === 'emergency_claim' &&
          targetPayment.emergency_claim_id
        ) {
          setEmergencyClaims((prev) =>
            prev.map((clm) => {
              if (clm.id !== targetPayment.emergency_claim_id) return clm;
              const nextCollected = clm.collected_amount + targetPayment.amount;
              return {
                ...clm,
                collected_amount: nextCollected,
                contributors_count: (clm.contributors_count || 0) + 1,
                status:
                  nextCollected >= clm.target_amount ? 'completed' : clm.status,
              };
            })
          );
        } else {
          // Check if this payment targets an obligation or arrears
          const notesStr = targetPayment.notes || '';
          const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
          const isArrears = notesStr.includes('مديونية') || Boolean(matchOblId);

          let updatedObligations = [...apartmentObligations];

          const aptTarget = apartments.find(
            (a) =>
              (a.apartment_number === effectiveAptNum || a.id === targetPayment.apartment_id) &&
              a.building_id === targetPayment.building_id
          );

          if (aptTarget) {
            // Find all unpaid or pending obligations for this apartment
            const aptUnpaidObls = updatedObligations.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === aptTarget.id) ||
                  (o.apartment_number &&
                    String(o.apartment_number).trim() === String(aptTarget.apartment_number).trim())) &&
                (o.status === 'unpaid' || o.status === 'pending')
            );

            let remainingPay = targetPayment.amount;
            const fullyPaidObligationIds: string[] = [];
            const partiallyUpdatedObligations: { id: string; newAmount: number; notes: string }[] = [];

            if (matchOblId) {
              // Option A: Specific obligation payment
              const matchedObl = aptUnpaidObls.find((o) => o.id === matchOblId);
              if (matchedObl) {
                if (remainingPay >= matchedObl.amount) {
                  fullyPaidObligationIds.push(matchedObl.id);
                  remainingPay -= matchedObl.amount;
                } else {
                  const newAmount = Math.max(0, matchedObl.amount - remainingPay);
                  const newNotes = (matchedObl.notes ? matchedObl.notes + ' • ' : '') + `[سداد جزئي: تم خصم ${remainingPay} ج.م - متبقي ${newAmount} ج.م]`;
                  partiallyUpdatedObligations.push({ id: matchedObl.id, newAmount, notes: newNotes });
                  remainingPay = 0;
                }
              }
            } else if (isArrears || targetPayment.payment_category === 'monthly_dues') {
              // Option B: General arrears or partial payment - settle FIFO on unpaid/pending obligations
              const eligibleObls = aptUnpaidObls.filter((o) => o.status === 'unpaid' || o.status === 'pending');
              for (const obl of eligibleObls) {
                if (remainingPay <= 0) break;
                if (remainingPay >= obl.amount) {
                  fullyPaidObligationIds.push(obl.id);
                  remainingPay -= obl.amount;
                } else {
                  const newAmount = Math.max(0, obl.amount - remainingPay);
                  const newNotes = (obl.notes ? obl.notes + ' • ' : '') + `[سداد جزئي: تم خصم ${remainingPay} ج.م - متبقي ${newAmount} ج.م]`;
                  partiallyUpdatedObligations.push({ id: obl.id, newAmount, notes: newNotes });
                  remainingPay = 0;
                  break;
                }
              }
            }

            if (fullyPaidObligationIds.length > 0 || partiallyUpdatedObligations.length > 0) {
              updatedObligations = updatedObligations.map((o) => {
                if (fullyPaidObligationIds.includes(o.id)) {
                  return { ...o, status: 'paid' as const };
                }
                const partial = partiallyUpdatedObligations.find((p) => p.id === o.id);
                if (partial) {
                  return { ...o, amount: partial.newAmount, notes: partial.notes, status: 'unpaid' as const };
                }
                return o;
              });
              setApartmentObligations(updatedObligations);

              // Update in Supabase
              if (isSupabaseConfigured) {
                for (const oblId of fullyPaidObligationIds) {
                  if (isUuid(oblId)) {
                    supabase
                      .from('apartment_obligations')
                      .update({ status: 'paid' })
                      .eq('id', oblId)
                      .then(() => {});
                  }
                }
                for (const partial of partiallyUpdatedObligations) {
                  if (isUuid(partial.id)) {
                    supabase
                      .from('apartment_obligations')
                      .update({ amount: partial.newAmount, notes: partial.notes, status: 'unpaid' })
                      .eq('id', partial.id)
                      .then(() => {});
                  }
                }
              }
            }

            // Recalculate remaining unpaid obligations and arrears
            const remainingAptUnpaid = updatedObligations.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === aptTarget.id) ||
                  (o.apartment_number &&
                    String(o.apartment_number).trim() === String(aptTarget.apartment_number).trim())) &&
                (o.status === 'unpaid' || o.status === 'pending')
            );

            const remainingOblsDebt = remainingAptUnpaid.reduce(
              (sum, o) => sum + (Number(o.amount) || 0),
              0
            );

            // Compute new arrears amount
            const oldArrears = Number(aptTarget.arrears_amount) || 0;
            const newArrears = Math.max(0, oldArrears - targetPayment.amount);
            const finalArrears = remainingAptUnpaid.length > 0 ? remainingOblsDebt : newArrears;
            const hasRemainingDebt = finalArrears > 0;
            const monthlyDueAmount = currentBuilding.default_monthly_dues || 400;
            const isMonthlyPaid = !isArrears && targetPayment.payment_category === 'monthly_dues' ? true : (aptTarget.payment_status === 'paid' && !hasRemainingDebt);
            const totalUnpaidWithMonthly = finalArrears + (isMonthlyPaid ? 0 : monthlyDueAmount);

            setApartments((prev) =>
              prev.map((apt) =>
                apt.id === aptTarget.id
                  ? {
                      ...apt,
                      arrears_amount: finalArrears,
                      unpaid_months_count: remainingAptUnpaid.filter((o) => o.category === 'monthly_dues').length,
                      unpaid_amount: totalUnpaidWithMonthly,
                      payment_status: hasRemainingDebt ? 'unpaid' : (isMonthlyPaid ? 'paid' : 'unpaid'),
                    }
                  : apt
              )
            );

            // Update apartment arrears in Supabase
            if (isSupabaseConfigured && isUuid(aptTarget.id)) {
              supabase
                .from('apartments')
                .update({ arrears_amount: finalArrears })
                .eq('id', aptTarget.id)
                .then(() => {});
            }
          } else {
            setApartments((prev) =>
              prev.map((apt) =>
                (apt.apartment_number === effectiveAptNum || apt.id === targetPayment.apartment_id) &&
                apt.building_id === targetPayment.building_id
                  ? {
                      ...apt,
                      payment_status: 'paid',
                      unpaid_months_count: 0,
                      unpaid_amount: 0,
                    }
                  : apt
              )
            );
          }
        }

        // Scenario 2A: Send immediate notification to Resident on approval
        const notesStr = targetPayment.notes || '';
        const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
        const matchOblTitle = notesStr.match(/\[سداد بند:\s*(.*?)\s*#/)?.[1];
        const isArrears = notesStr.includes('مديونية') || Boolean(matchOblId);

        const paymentDesc =
          targetPayment.payment_category === 'emergency_claim'
            ? 'مساهمة الصيانة الطارئة'
            : `اشتراك شهر (${targetPayment.billing_month})`;

        let notifTitle = `تم اعتماد سدادك بنجاح (شقة ${effectiveAptNum || 'المبنى'}) ✅`;
        let notifBody = `اعتمد رئيس الاتحاد دفعتك بقيمة ${targetPayment.amount.toLocaleString()} ج.م عن ${paymentDesc} وتمت إضافتها رسمياً لرصيد خزينة العمارة.`;

        if (matchOblId) {
          const oblTitle =
            matchOblTitle ||
            apartmentObligations.find((o) => o.id === matchOblId)?.title ||
            'البند المحدد';
          notifTitle = `تم اعتماد سداد البند (${oblTitle}) بنجاح ✅`;
          notifBody = `اعتمد رئيس الاتحاد سداد بند (${oblTitle}) بقيمة ${targetPayment.amount.toLocaleString()} ج.م وتمت تسويته وإلغاء مديونيته من شقتك.`;
        } else if (isArrears) {
          notifTitle = `تم اعتماد سداد المديونية بنجاح (شقة ${effectiveAptNum || 'المبنى'}) ✅`;
          notifBody = `اعتمد رئيس الاتحاد سداد مبلغ ${targetPayment.amount.toLocaleString()} ج.م من مديونية شقتك وتم تحديث سجل التزاماتك بنجاح.`;
        }

        await pushAndRecordNotification({
          recipientId: targetPayment.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: targetPayment.building_id,
          title: notifTitle,
          body: notifBody,
          category: 'financial',
          badgeLabel: 'اشتراك معتمد',
          isUrgent: false,
          metadata: {
            apartment_number: effectiveAptNum || undefined,
            amount: targetPayment.amount,
            payment_id: targetPayment.id,
            category: targetPayment.payment_category,
            obligation_id: matchOblId || undefined,
          },
        });

        // Trigger fresh sync from Supabase to keep state completely unified
        loadDataFromSupabase().catch(() => {});
      } finally {
        setProcessingIds((prev) => ({ ...prev, [paymentId]: false }));
      }
    },
    [
      apartmentObligations,
      apartments,
      isCurrentBuildingWritable,
      loadDataFromSupabase,
      payments,
      processingIds,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.push_token,
    ]
  );

  // 6. Scenario 2A (Reject): Admin rejects resident payment (with rejection reason!) ➔ Immediate Push Notification to Resident!
  const rejectResidentPayment = useCallback(
    async (paymentId: string, reason?: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }
      if (processingIds[paymentId]) return;

      const targetPayment = payments.find((p) => p.id === paymentId);
      if (!targetPayment || targetPayment.status !== 'pending') {
        throw new Error(
          'منع التكرار المزدوج: تمت معالجة طلب السداد هذا مسبقاً.'
        );
      }

      const finalReason =
        reason?.trim() || 'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد';

      setProcessingIds((prev) => ({ ...prev, [paymentId]: true }));
      try {
        const isValidUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            paymentId
          );

        if (isSupabaseConfigured && isValidUuid) {
          try {
            await paymentsApi.rejectResidentPayment(paymentId, finalReason);
          } catch (rpcErr) {
            console.warn('rejectResidentPayment RPC warning:', rpcErr);
            throw rpcErr;
          }
        }

        const effectiveAptNum =
          targetPayment.apartment_number ||
          apartments.find((a) => a.id === targetPayment.apartment_id)?.apartment_number ||
          '-';

        const paymentDesc =
          targetPayment.payment_category === 'emergency_claim'
            ? 'مساهمة الصيانة الطارئة'
            : `اشتراك شهر (${targetPayment.billing_month || 'الاشتراك الشهري'})`;

        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  apartment_number: effectiveAptNum,
                  status: 'rejected',
                  reviewed_by: usersByRole.admin.id,
                  reviewed_at: new Date().toISOString(),
                  rejection_reason: finalReason,
                }
              : p
          )
        );

        setApartments((prev) =>
          prev.map((apt) =>
            (apt.apartment_number === effectiveAptNum || apt.id === targetPayment.apartment_id) &&
            apt.building_id === targetPayment.building_id
              ? { ...apt, payment_status: 'unpaid' }
              : apt
          )
        );

        // If this payment was for a specific obligation that was placed in 'pending', revert it to 'unpaid'
        const notesStr = targetPayment.notes || '';
        const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
        const matchOblTitle = notesStr.match(/\[سداد بند:\s*(.*?)\s*#/)?.[1];

        if (matchOblId) {
          setApartmentObligations((prev) =>
            prev.map((o) => (o.id === matchOblId ? { ...o, status: 'unpaid' as const } : o))
          );
          if (isSupabaseConfigured && isUuid(matchOblId)) {
            supabase
              .from('apartment_obligations')
              .update({ status: 'unpaid' })
              .eq('id', matchOblId)
              .then(() => {});
          }
        }

        let rejectTitle = `تعذر اعتماد إيصال السداد (شقة ${effectiveAptNum}) ⚠️`;
        let rejectBody = `تم رفض طلب السداد بقيمة ${targetPayment.amount.toLocaleString()} ج.م عن ${paymentDesc}. سبب الرفض: "${finalReason}". يرجى إعادة المحاولة أو مراجعة رئيس الاتحاد.`;

        if (matchOblId) {
          const oblTitle =
            matchOblTitle ||
            apartmentObligations.find((o) => o.id === matchOblId)?.title ||
            'البند المحدد';
          rejectTitle = `تعذر اعتماد سداد بند (${oblTitle}) ⚠️`;
          rejectBody = `تم رفض طلب سداد بند (${oblTitle}) بقيمة ${targetPayment.amount.toLocaleString()} ج.م. سبب الرفض: "${finalReason}". تمت إعادة البند لمستحقات شقتك لتتمكن من إعادة سداده.`;
        }

        // Scenario 2A (Reject): Send immediate notification to Resident with rejection reason
        await pushAndRecordNotification({
          recipientId: targetPayment.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: targetPayment.building_id,
          title: rejectTitle,
          body: rejectBody,
          category: 'financial',
          badgeLabel: 'إيصال مرفوض',
          isUrgent: true,
          metadata: {
            apartment_number: effectiveAptNum,
            amount: targetPayment.amount,
            rejection_reason: finalReason,
            payment_id: targetPayment.id,
            category: targetPayment.payment_category,
            obligation_id: matchOblId || undefined,
          },
        });

        loadDataFromSupabase().catch(() => {});
      } finally {
        setProcessingIds((prev) => ({ ...prev, [paymentId]: false }));
      }
    },
    [
      apartmentObligations,
      apartments,
      isCurrentBuildingWritable,
      loadDataFromSupabase,
      payments,
      processingIds,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // 6B. Admin records direct cash payment for an apartment (emergency claim or monthly dues)
  const recordDirectCashPayment = useCallback(
    async (input: {
      apartmentId: string;
      apartmentNumber: string;
      residentId?: string | null;
      residentName?: string | null;
      amount: number;
      category: PaymentCategoryType;
      emergencyClaimId?: string | null;
      billingMonth: string;
      notes?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const paymentId = 'pay-' + Date.now();
      const newPayment: Payment = {
        id: paymentId,
        building_id: currentBuilding.id,
        apartment_id: input.apartmentId,
        apartment_number: input.apartmentNumber,
        resident_id: input.residentId || null,
        resident_name: input.residentName || `شقة ${input.apartmentNumber}`,
        payment_category: input.category,
        emergency_claim_id: input.emergencyClaimId || null,
        billing_month: input.billingMonth,
        amount: input.amount,
        payment_method: 'cash',
        cash_recipient: 'admin',
        receipt_image_url: null,
        reference_number: '#CASH-' + Math.floor(10000 + Math.random() * 90000),
        notes: input.notes || 'سداد نقدي مباشر لرئيس الاتحاد',
        status: 'paid',
        reviewed_by: usersByRole.admin.id,
        reviewed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('payments').insert({
            building_id: currentBuilding.id,
            apartment_id: input.apartmentId,
            resident_id: input.residentId || null,
            payment_category: input.category,
            emergency_claim_id: input.emergencyClaimId || null,
            billing_month: input.billingMonth,
            amount: input.amount,
            payment_method: 'cash',
            cash_recipient: 'admin',
            notes: input.notes || 'سداد نقدي مباشر لرئيس الاتحاد',
            status: 'paid',
            reviewed_by: usersByRole.admin.id,
            reviewed_at: new Date().toISOString(),
          });
        } catch {
          // Graceful fallback
        }
      }

      setPayments((prev) => [newPayment, ...prev]);

      // Increase fund balance
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance + input.amount }
            : b
        )
      );

      // If emergency claim, update collected_amount and contributors_count
      if (input.category === 'emergency_claim' && input.emergencyClaimId) {
        setEmergencyClaims((prev) =>
          prev.map((clm) => {
            if (clm.id !== input.emergencyClaimId) return clm;
            const nextCollected = clm.collected_amount + input.amount;
            return {
              ...clm,
              collected_amount: nextCollected,
              contributors_count: (clm.contributors_count || 0) + 1,
              status:
                nextCollected >= clm.target_amount ? 'completed' : clm.status,
            };
          })
        );
      } else {
        setApartments((prev) =>
          prev.map((apt) =>
            apt.apartment_number === input.apartmentNumber &&
            apt.building_id === currentBuilding.id
              ? {
                  ...apt,
                  payment_status: 'paid',
                  unpaid_months_count: 0,
                  unpaid_amount: 0,
                }
              : apt
          )
        );
      }

      // If resident exists, send notification
      if (input.residentId) {
        await pushAndRecordNotification({
          recipientId: input.residentId,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: currentBuilding.id,
          title: `تم تسجيل سدادك النقدي بنجاح (شقة ${input.apartmentNumber}) 💵`,
          body: `سجّل رئيس الاتحاد استلام مبلغ ${input.amount.toLocaleString()} ج.م نقداً وأُضيفت لرصيد الخزينة.`,
          category: 'financial',
          badgeLabel: 'سداد نقدي',
          isUrgent: false,
          metadata: {
            apartment_number: input.apartmentNumber,
            amount: input.amount,
            payment_id: paymentId,
          },
        });
      }
    },
    [
      currentBuilding.id,
      isCurrentBuildingWritable,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.push_token,
    ]
  );

  return {
    submitResidentPayment,
    approveResidentPayment,
    rejectResidentPayment,
    recordDirectCashPayment,
  };
}
