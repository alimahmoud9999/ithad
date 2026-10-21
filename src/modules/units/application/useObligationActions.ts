import { useCallback } from 'react';
import type { ApartmentObligation, PaymentCategoryType } from '@/shared/types/database';
import { isSupabaseConfigured, supabase } from '@/shared/lib/supabase';
import { unitsApi } from '../infrastructure/units.api';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'isCurrentBuildingWritable'
  | 'apartments'
  | 'apartmentObligations'
  | 'setApartmentObligations'
  | 'setApartments'
  | 'currentBuilding'
  | 'usersByRole'
  | 'loadDataFromSupabase'
>;

export function useObligationActions({
  isCurrentBuildingWritable,
  apartments,
  apartmentObligations,
  setApartmentObligations,
  setApartments,
  currentBuilding,
  usersByRole,
  loadDataFromSupabase,
}: Deps) {
  // Mechanism 3: Transfer unpaid obligations (and optionally occupant_name/phone) between apartments in 1 click
  const transferApartmentObligations = useCallback(
    async (input: {
      sourceApartmentId: string;
      targetApartmentId: string;
      obligationIds?: string[];
      transferOccupantInfo?: boolean;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      if (input.sourceApartmentId === input.targetApartmentId) {
        throw new Error('لا يمكن نقل الالتزامات إلى نفس الشقة.');
      }

      const sourceApt = apartments.find(
        (a) => a.id === input.sourceApartmentId
      );
      const targetApt = apartments.find(
        (a) => a.id === input.targetApartmentId
      );

      if (!sourceApt || !targetApt) {
        throw new Error('إحدى الشقتين غير موجودة في سجلات المبنى.');
      }

      if (isSupabaseConfigured) {
        try {
          await unitsApi.transferApartmentObligations({
            sourceApartmentId: input.sourceApartmentId,
            targetApartmentId: input.targetApartmentId,
            obligationIds: input.obligationIds ?? null,
            transferOccupantInfo: input.transferOccupantInfo ?? false,
          });
        } catch {
          // Graceful fallback
        }
      }

      // Filter unpaid obligations on source apartment to move
      const candidateObligations = apartmentObligations.filter(
        (obl) =>
          obl.apartment_id === input.sourceApartmentId &&
          obl.status === 'unpaid' &&
          (!input.obligationIds ||
            input.obligationIds.length === 0 ||
            input.obligationIds.includes(obl.id))
      );

      if (candidateObligations.length === 0) {
        throw new Error(
          'لا توجد التزامات غير مسددة (unpaid) مطابقة لنقلها من هذه الشقة.'
        );
      }

      const movedIds = new Set(candidateObligations.map((o) => o.id));
      const transferredAmount = candidateObligations.reduce(
        (sum, o) => sum + o.amount,
        0
      );
      const nowIso = new Date().toISOString();

      const nextObligations = apartmentObligations.map((obl) =>
        movedIds.has(obl.id)
          ? {
              ...obl,
              apartment_id: targetApt.id,
              apartment_number: targetApt.apartment_number,
              transferred_from_apartment_id: sourceApt.id,
              transferred_from_apartment_number: sourceApt.apartment_number,
              transferred_at: nowIso,
            }
          : obl
      );

      setApartmentObligations(nextObligations);

      // Recalculate arrears & unpaid_months_count for both source and target apartments
      const sourceRemainingUnpaid = nextObligations.filter(
        (o) => o.apartment_id === sourceApt.id && o.status === 'unpaid'
      );
      const targetNextUnpaid = nextObligations.filter(
        (o) => o.apartment_id === targetApt.id && o.status === 'unpaid'
      );

      const sourceNextAmount = sourceRemainingUnpaid.reduce(
        (sum, o) => sum + o.amount,
        0
      );
      const targetNextAmount = targetNextUnpaid.reduce(
        (sum, o) => sum + o.amount,
        0
      );

      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === sourceApt.id) {
            return {
              ...apt,
              unpaid_amount: sourceNextAmount,
              arrears_amount: sourceNextAmount,
              unpaid_months_count: sourceRemainingUnpaid.length,
              payment_status:
                sourceNextAmount === 0 && apt.payment_status === 'unpaid'
                  ? 'paid'
                  : apt.payment_status,
              occupant_name: input.transferOccupantInfo
                ? null
                : apt.occupant_name,
              occupant_phone: input.transferOccupantInfo
                ? null
                : apt.occupant_phone,
              resident_name:
                input.transferOccupantInfo && !apt.resident_id
                  ? 'وحدة شاغرة (تم نقل البيانات)'
                  : apt.resident_name,
            };
          }
          if (apt.id === targetApt.id) {
            const transferredName =
              input.transferOccupantInfo && sourceApt.occupant_name
                ? sourceApt.occupant_name
                : apt.occupant_name;
            const transferredPhone =
              input.transferOccupantInfo && sourceApt.occupant_phone
                ? sourceApt.occupant_phone
                : apt.occupant_phone;

            return {
              ...apt,
              unpaid_amount: targetNextAmount,
              arrears_amount: targetNextAmount,
              unpaid_months_count: targetNextUnpaid.length,
              payment_status:
                targetNextAmount > 0 ? 'unpaid' : apt.payment_status,
              occupant_name: transferredName,
              occupant_phone: transferredPhone,
              resident_name:
                !apt.resident_id && transferredName
                  ? `${transferredName} (مسجل مبدئياً)`
                  : apt.resident_name,
              resident_phone:
                !apt.resident_id && transferredPhone
                  ? transferredPhone
                  : apt.resident_phone,
            };
          }
          return apt;
        })
      );

      return {
        transferredCount: candidateObligations.length,
        transferredAmount,
        sourceApartmentNumber: sourceApt.apartment_number,
        targetApartmentNumber: targetApt.apartment_number,
      };
    },
    [apartmentObligations, apartments, isCurrentBuildingWritable]
  );

  // Add a pre-registered obligation / arrears entry to a specific apartment
  // Add a pre-registered obligation / arrears entry to a specific apartment
  const addApartmentObligation = useCallback(
    async (input: {
      apartmentId: string;
      title: string;
      amount: number;
      billingMonth: string;
      category?: PaymentCategoryType;
      notes?: string;
      apartmentNumber?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      let targetApt = apartments.find(
        (a) =>
          a.id === input.apartmentId ||
          (input.apartmentNumber && a.apartment_number === input.apartmentNumber) ||
          a.apartment_number === input.apartmentId
      );

      if (!targetApt && isSupabaseConfigured && currentBuilding.id) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          let query = supabase.from('apartments').select('*').eq('building_id', currentBuilding.id);
          if (isValidUuid(input.apartmentId)) {
            query = query.eq('id', input.apartmentId);
          } else if (input.apartmentNumber) {
            query = query.eq('apartment_number', input.apartmentNumber.trim());
          } else if (!input.apartmentId.startsWith('apt-')) {
            query = query.eq('apartment_number', input.apartmentId.trim());
          }
          const { data: dbApts } = await query.order('created_at', { ascending: false }).limit(1);
          const dbApt = dbApts && dbApts.length > 0 ? dbApts[0] : null;
          if (dbApt) {
            targetApt = {
              id: dbApt.id,
              building_id: dbApt.building_id,
              apartment_number: dbApt.apartment_number,
              floor_number: dbApt.floor_number || 'الدور الأول',
              wing_or_direction: dbApt.wing_or_direction || 'واجهة',
              area_sqm: Number(dbApt.area_sqm) || 160,
              ownership_share_percent: Number(dbApt.ownership_share_percent) || 6.25,
              monthly_dues_override: dbApt.monthly_dues_override,
              occupant_name: dbApt.occupant_name,
              occupant_phone: dbApt.occupant_phone,
              resident_id: dbApt.resident_id,
              resident_name: dbApt.occupant_name,
              resident_phone: dbApt.occupant_phone,
              payment_status: 'unpaid',
              arrears_amount: Number(dbApt.arrears_amount) || 0,
              unpaid_amount: Number(dbApt.arrears_amount) || 0,
              unpaid_months_count: 1,
              invite_code: dbApt.invite_code,
              is_active: dbApt.is_active ?? true,
            };
          }
        } catch (e) {
          console.warn('Fallback lookup error in addApartmentObligation:', e);
        }
      }

      if (!targetApt) {
        throw new Error('الشقة المحددة غير موجودة.');
      }

      const newObligation: ApartmentObligation = {
        id: 'obl-' + Date.now(),
        building_id: currentBuilding.id || targetApt.building_id,
        apartment_id: targetApt.id,
        apartment_number: targetApt.apartment_number,
        title: input.title.trim(),
        category: input.category || 'monthly_dues',
        billing_month: input.billingMonth.trim(),
        amount: input.amount,
        status: 'unpaid',
        notes: input.notes?.trim() || null,
        created_at: new Date().toISOString(),
      };

      setApartmentObligations((prev) => [newObligation, ...prev]);
      setApartments((prev) =>
        prev.map((apt) =>
          apt.id === targetApt.id || apt.apartment_number === targetApt.apartment_number
            ? {
                ...apt,
                payment_status: 'unpaid',
                unpaid_months_count: (apt.unpaid_months_count || 0) + 1,
                unpaid_amount: (apt.unpaid_amount || 0) + input.amount,
                arrears_amount: (apt.arrears_amount || 0) + input.amount,
              }
            : apt
        )
      );

      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          let targetDbApartmentId = targetApt.id;
          if (!isValidUuid(targetDbApartmentId)) {
            const { data: foundApt } = await supabase
              .from('apartments')
              .select('id')
              .eq('building_id', currentBuilding.id)
              .eq('apartment_number', targetApt.apartment_number)
              .maybeSingle();
            if (foundApt?.id) {
              targetDbApartmentId = foundApt.id;
            }
          }

          if (isValidUuid(targetDbApartmentId)) {
            let insertRes = await supabase
              .from('apartment_obligations')
              .insert({
                building_id: currentBuilding.id || targetApt.building_id,
                apartment_id: targetDbApartmentId,
                title: input.title.trim(),
                category: input.category || 'monthly_dues',
                billing_month: input.billingMonth.trim(),
                amount: input.amount,
                status: 'unpaid',
                notes: input.notes?.trim() || null,
                created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
              })
              .select('id')
              .maybeSingle();

            // If 'other' was rejected by postgres because migration 016 was not run yet, retry with 'monthly_dues'
            if (insertRes.error && insertRes.error.message?.toLowerCase().includes('payment_category_type')) {
              insertRes = await supabase
                .from('apartment_obligations')
                .insert({
                  building_id: currentBuilding.id || targetApt.building_id,
                  apartment_id: targetDbApartmentId,
                  title: input.title.trim(),
                  category: 'monthly_dues',
                  billing_month: input.billingMonth.trim(),
                  amount: input.amount,
                  status: 'unpaid',
                  notes: input.notes?.trim() || null,
                  created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
                })
                .select('id')
                .maybeSingle();
            }

            if (insertRes.data?.id) {
              setApartmentObligations((prev) =>
                prev.map((o) => (o.id === newObligation.id ? { ...o, id: insertRes.data!.id } : o))
              );
            }

            await supabase
              .from('apartments')
              .update({
                payment_status: 'unpaid',
                arrears_amount: (targetApt.arrears_amount || 0) + input.amount,
              })
              .eq('id', targetDbApartmentId);

            // Send instant notification to the resident of this apartment
            try {
              const { data: resUsers } = await supabase
                .from('users')
                .select('id')
                .eq('building_id', currentBuilding.id || targetApt.building_id)
                .eq('apartment_number', targetApt.apartment_number)
                .limit(1);

              const targetResidentId = resUsers?.[0]?.id || targetApt.resident_id;

              await supabase.from('notifications').insert({
                building_id: currentBuilding.id || targetApt.building_id,
                recipient_id: targetResidentId && isValidUuid(targetResidentId) ? targetResidentId : null,
                recipient_role: 'resident',
                title: `مديونية جديدة مسجلة (شقة ${targetApt.apartment_number}) 📋`,
                body: `قام رئيس الاتحاد بتسجيل مديونية جديدة: (${input.title}) بمبلغ ${input.amount.toLocaleString()} ج.م عن شهر ${input.billingMonth}.`,
                category: 'financial',
                badge_label: 'مديونية مستحقة',
                is_urgent: true,
                metadata: {
                  apartment_number: targetApt.apartment_number,
                  apartment_id: targetDbApartmentId,
                  amount: input.amount,
                  title: input.title,
                  billing_month: input.billingMonth,
                },
              });
            } catch (notifErr) {
              console.warn('Failed to insert obligation notification:', notifErr);
            }

            await loadDataFromSupabase();
          }
        } catch (e) {
          console.warn('Supabase addApartmentObligation error:', e);
        }
      }
    },
    [apartments, currentBuilding.id, isCurrentBuildingWritable, usersByRole.admin.id]
  );

  // Settle or mark an apartment obligation as paid
  const settleApartmentObligation = useCallback(
    async (obligationId: string, notes?: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      if (targetObl.status === 'paid') return;

      const targetApt = apartments.find(
        (a) =>
          a.id === targetObl.apartment_id ||
          String(a.apartment_number).trim() === String(targetObl.apartment_number).trim()
      );

      setApartmentObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid', notes: notes || o.notes } : o))
      );

      if (targetApt) {
        const remainingUnpaidAmount = Math.max(
          0,
          (targetApt.arrears_amount || targetApt.unpaid_amount || 0) - targetObl.amount
        );
        const hasOtherUnpaid = apartmentObligations.some(
          (o) =>
            o.id !== obligationId &&
            (o.apartment_id === targetApt.id || o.apartment_number === targetApt.apartment_number) &&
            o.status === 'unpaid'
        );

        setApartments((prev) =>
          prev.map((a) =>
            a.id === targetApt.id || a.apartment_number === targetApt.apartment_number
              ? {
                  ...a,
                  arrears_amount: remainingUnpaidAmount,
                  unpaid_amount: remainingUnpaidAmount,
                  payment_status: hasOtherUnpaid ? 'unpaid' : a.payment_status === 'unpaid' ? 'paid' : a.payment_status,
                }
              : a
          )
        );
      }

      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            await supabase
              .from('apartment_obligations')
              .update({ status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', obligationId);
          }

          if (targetApt && isValidUuid(targetApt.id)) {
            const { data: unpaidSum } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetApt.id)
              .eq('status', 'unpaid');
            const totalRemaining = (unpaidSum || []).reduce((s, row) => s + (Number(row.amount) || 0), 0);
            await supabase
              .from('apartments')
              .update({ arrears_amount: totalRemaining })
              .eq('id', targetApt.id);
          }
        } catch (e) {
          console.warn('Supabase settleApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, apartments, isCurrentBuildingWritable]
  );

  // Delete an apartment obligation (from log or if added by mistake)
  const deleteApartmentObligation = useCallback(
    async (obligationId: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      // 1. Remove from local state
      setApartmentObligations((prev) => prev.filter((o) => o.id !== obligationId));

      // 2. Re-calculate apartment's debt and status in memory
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === targetObl.apartment_id || apt.apartment_number === targetObl.apartment_number) {
            const remainingObls = apartmentObligations.filter(
              (o) =>
                o.id !== obligationId &&
                ((o.apartment_id && o.apartment_id === apt.id) ||
                  (o.apartment_number && o.apartment_number === apt.apartment_number)) &&
                o.status === 'unpaid'
            );
            const newDebt = remainingObls.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
            return {
              ...apt,
              arrears_amount: newDebt,
              unpaid_amount:
                newDebt +
                (apt.payment_status === 'paid' && newDebt === 0
                  ? 0
                  : currentBuilding?.default_monthly_dues || 400),
              unpaid_months_count: remainingObls.filter((o) => o.category === 'monthly_dues').length,
              payment_status: newDebt > 0 ? 'unpaid' : apt.payment_status,
            };
          }
          return apt;
        })
      );

      // 3. Remove from Supabase
      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            await supabase.from('apartment_obligations').delete().eq('id', obligationId);
          }

          if (isValidUuid(targetObl.apartment_id)) {
            const { data: dbRemaining } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetObl.apartment_id)
              .eq('status', 'unpaid');
            const totalRemaining = (dbRemaining || []).reduce(
              (sum: number, r: any) => sum + (Number(r.amount) || 0),
              0
            );
            await supabase
              .from('apartments')
              .update({
                arrears_amount: totalRemaining,
              })
              .eq('id', targetObl.apartment_id);
          }

          await loadDataFromSupabase();
        } catch (e) {
          console.warn('Supabase deleteApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, currentBuilding?.default_monthly_dues, isCurrentBuildingWritable]
  );

  // Update an existing apartment obligation (amount, title, month, notes)
  const updateApartmentObligation = useCallback(
    async (
      obligationId: string,
      updates: {
        title?: string;
        amount?: number;
        billingMonth?: string;
        category?: PaymentCategoryType;
        notes?: string;
      }
    ) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      // 1. Update in local state
      const updatedObl: ApartmentObligation = {
        ...targetObl,
        title: updates.title !== undefined ? updates.title.trim() : targetObl.title,
        amount: updates.amount !== undefined ? updates.amount : targetObl.amount,
        billing_month:
          updates.billingMonth !== undefined ? updates.billingMonth.trim() : targetObl.billing_month,
        category: updates.category !== undefined ? updates.category : targetObl.category,
        notes: updates.notes !== undefined ? updates.notes.trim() : targetObl.notes,
      };

      setApartmentObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? updatedObl : o))
      );

      // 2. Re-calculate apartment's debt in memory
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === targetObl.apartment_id || apt.apartment_number === targetObl.apartment_number) {
            const nextObls = apartmentObligations.map((o) => (o.id === obligationId ? updatedObl : o));
            const aptUnpaidObls = nextObls.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === apt.id) ||
                  (o.apartment_number && o.apartment_number === apt.apartment_number)) &&
                o.status === 'unpaid'
            );
            const newDebt = aptUnpaidObls.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
            return {
              ...apt,
              arrears_amount: newDebt,
              unpaid_amount:
                newDebt +
                (apt.payment_status === 'paid' && newDebt === 0
                  ? 0
                  : currentBuilding?.default_monthly_dues || 400),
              unpaid_months_count: aptUnpaidObls.filter((o) => o.category === 'monthly_dues').length,
            };
          }
          return apt;
        })
      );

      // 3. Update in Supabase
      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            const updatePayload: Record<string, any> = {};
            if (updates.title !== undefined) updatePayload.title = updates.title.trim();
            if (updates.amount !== undefined) updatePayload.amount = updates.amount;
            if (updates.billingMonth !== undefined) updatePayload.billing_month = updates.billingMonth.trim();
            if (updates.category !== undefined) updatePayload.category = updates.category;
            if (updates.notes !== undefined) updatePayload.notes = updates.notes.trim();

            if (Object.keys(updatePayload).length > 0) {
              const { error: upErr } = await supabase
                .from('apartment_obligations')
                .update(updatePayload)
                .eq('id', obligationId);

              if (upErr && upErr.message?.toLowerCase().includes('payment_category_type')) {
                updatePayload.category = 'monthly_dues';
                await supabase
                  .from('apartment_obligations')
                  .update(updatePayload)
                  .eq('id', obligationId);
              }
            }
          }

          if (isValidUuid(targetObl.apartment_id) && updates.amount !== undefined) {
            const { data: dbRemaining } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetObl.apartment_id)
              .eq('status', 'unpaid');
            const totalRemaining = (dbRemaining || []).reduce(
              (sum: number, r: any) => sum + (Number(r.amount) || 0),
              0
            );
            await supabase
              .from('apartments')
              .update({
                arrears_amount: totalRemaining,
              })
              .eq('id', targetObl.apartment_id);
          }

          await loadDataFromSupabase();
        } catch (e) {
          console.warn('Supabase updateApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, currentBuilding?.default_monthly_dues, isCurrentBuildingWritable]
  );

  return {
    transferApartmentObligations,
    addApartmentObligation,
    settleApartmentObligation,
    deleteApartmentObligation,
    updateApartmentObligation,
  };
}
