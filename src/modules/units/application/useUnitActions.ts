import { useCallback } from 'react';
import type { Apartment, ApartmentObligation } from '@/shared/types/database';
import { isSupabaseConfigured, supabase } from '@/shared/lib/supabase';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'isCurrentBuildingWritable'
  | 'apartments'
  | 'currentBuilding'
  | 'plans'
  | 'setApartments'
  | 'setApartmentObligations'
  | 'usersByRole'
>;

export function useUnitActions({
  isCurrentBuildingWritable,
  apartments,
  currentBuilding,
  plans,
  setApartments,
  setApartmentObligations,
  usersByRole,
}: Deps) {
  // 10. Admin adds new apartment unit (with pre-registered occupant_name, occupant_phone & initial arrears)
  const addApartmentUnit = useCallback(
    async (input: {
      apartmentNumber: string;
      floorNumber: string;
      wingOrDirection: string;
      areaSqm: number;
      residentName?: string;
      residentPhone?: string;
      arrearsAmount?: number;
      stagedObligations?: Array<{
        id?: string;
        type: 'monthly_dues' | 'other';
        title: string;
        amount: number;
        year: number;
        month: number;
        notes?: string;
      }>;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      // 1. Prevent duplicate apartment numbers in the same building
      const existingUnit = apartments.find(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.apartment_number.trim() === input.apartmentNumber.trim()
      );
      if (existingUnit) {
        throw new Error(`شقة رقم (${input.apartmentNumber.trim()}) مسجلة بالفعل في هذا العقار.`);
      }

      const plan = plans.find((p) => p.code === currentBuilding.plan_code);
      const maxUnits =
        currentBuilding.max_apartments_override ??
        plan?.max_apartments ??
        30;

      const currentBuildingUnits = apartments.filter(
        (a) => a.building_id === currentBuilding.id && a.is_active
      );
      if (currentBuildingUnits.length >= maxUnits) {
        throw new Error(
          `تم الوصول للحد الأقصى للشقق المسموح به في باقة العمارة (${maxUnits} شقة).`
        );
      }

      const newUnitId = 'apt-' + Date.now();
      const initialArrears =
        input.arrearsAmount !== undefined && input.arrearsAmount >= 0
          ? input.arrearsAmount
          : currentBuilding.default_monthly_dues;
      const occupantNameTrimmed = input.residentName?.trim() || null;
      const occupantPhoneTrimmed = input.residentPhone?.trim() || null;

      const newUnit: Apartment = {
        id: newUnitId,
        building_id: currentBuilding.id,
        apartment_number: input.apartmentNumber.trim(),
        floor_number: input.floorNumber.trim(),
        wing_or_direction: input.wingOrDirection.trim() || 'واجهة',
        area_sqm: input.areaSqm || 150,
        ownership_share_percent: Number(
          (100 / Math.max(currentBuilding.total_apartments, 1)).toFixed(2)
        ),
        occupant_name: occupantNameTrimmed,
        occupant_phone: occupantPhoneTrimmed,
        arrears_amount: initialArrears,
        resident_id: null,
        resident_name: occupantNameTrimmed
          ? `${occupantNameTrimmed} (مسجل مبدئياً)`
          : 'وحدة شاغرة (بانتظار التسجيل)',
        resident_phone: occupantPhoneTrimmed || '',
        payment_status: initialArrears > 0 ? 'unpaid' : 'paid',
        unpaid_months_count: initialArrears > 0 ? 1 : 0,
        unpaid_amount: initialArrears,
        invite_code: `${currentBuilding.building_code}-${input.apartmentNumber.trim()}`,
        is_active: true,
      };

      setApartments((prev) => [newUnit, ...prev]);

      let createdDbId = newUnitId;
      const isValidUuid = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (isSupabaseConfigured && currentBuilding.id) {
        try {
          const { data: dbApt, error: insertErr } = await supabase
            .from('apartments')
            .insert({
              building_id: currentBuilding.id,
              apartment_number: input.apartmentNumber.trim(),
              floor_number: input.floorNumber.trim(),
              wing_or_direction: input.wingOrDirection.trim() || 'واجهة',
              area_sqm: input.areaSqm || 150,
              ownership_share_percent: newUnit.ownership_share_percent,
              occupant_name: occupantNameTrimmed,
              occupant_phone: occupantPhoneTrimmed,
              arrears_amount: initialArrears,
              invite_code: newUnit.invite_code,
              is_active: true,
            })
            .select()
            .maybeSingle();

          if (insertErr) {
            setApartments((prev) => prev.filter((a) => a.id !== newUnitId));
            throw new Error(insertErr.message || 'تعذر إضافة الشقة في قاعدة البيانات.');
          }

          if (dbApt?.id) {
            createdDbId = dbApt.id;
            setApartments((prev) =>
              prev.map((a) => (a.id === newUnitId ? { ...a, id: dbApt.id } : a))
            );
          }
        } catch (err: any) {
          setApartments((prev) => prev.filter((a) => a.id !== newUnitId));
          throw err;
        }
      }

      // Handle staged obligations atomically with the created apartment
      if (input.stagedObligations && input.stagedObligations.length > 0) {
        for (const obl of input.stagedObligations) {
          const billingMonth = `${obl.year}-${String(obl.month).padStart(2, '0')}`;
          const newObl: ApartmentObligation = {
            id: 'obl-' + Math.random().toString(36).substr(2, 9),
            building_id: currentBuilding.id,
            apartment_id: createdDbId,
            apartment_number: input.apartmentNumber.trim(),
            title: obl.title.trim(),
            category: obl.type === 'monthly_dues' ? 'monthly_dues' : 'other',
            billing_month: billingMonth,
            amount: obl.amount,
            status: 'unpaid',
            notes: obl.notes || `قيد مديونية مسجل عند تأسيس شقة (${input.apartmentNumber.trim()})`,
            created_at: new Date().toISOString(),
          };
          setApartmentObligations((prev) => [newObl, ...prev]);

          if (isSupabaseConfigured && currentBuilding.id && isValidUuid(createdDbId)) {
            try {
              const { data: dbObl } = await supabase.from('apartment_obligations').insert({
                building_id: currentBuilding.id,
                apartment_id: createdDbId,
                title: newObl.title,
                category: newObl.category,
                billing_month: newObl.billing_month,
                amount: newObl.amount,
                status: 'unpaid',
                notes: newObl.notes,
                created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
              }).select('id').maybeSingle();

              if (dbObl?.id) {
                setApartmentObligations((prev) =>
                  prev.map((o) => (o.id === newObl.id ? { ...o, id: dbObl.id } : o))
                );
              }
            } catch (e) {
              console.warn('Supabase insert staged obligation error:', e);
            }
          }
        }
      } else if (initialArrears > 0) {
        const initObligation: ApartmentObligation = {
          id: 'obl-' + Date.now(),
          building_id: currentBuilding.id,
          apartment_id: createdDbId,
          apartment_number: input.apartmentNumber.trim(),
          title: 'رصيد متأخرات / اشتراك مبدئي مسجل من الإدارة',
          category: 'monthly_dues',
          billing_month: new Date().toISOString().slice(0, 7),
          amount: initialArrears,
          status: 'unpaid',
          notes: occupantNameTrimmed
            ? `مسجل مبدئياً باسم: ${occupantNameTrimmed}`
            : 'قيد مبدئي عند تأسيس الوحدة',
          created_at: new Date().toISOString(),
        };
        setApartmentObligations((prev) => [initObligation, ...prev]);

        if (isSupabaseConfigured && currentBuilding.id) {
          try {
            await supabase.from('apartment_obligations').insert({
              building_id: currentBuilding.id,
              apartment_id: createdDbId,
              title: initObligation.title,
              category: 'monthly_dues',
              billing_month: initObligation.billing_month,
              amount: initialArrears,
              status: 'unpaid',
              notes: initObligation.notes,
            });
          } catch (e) {
            console.warn('Supabase add obligation error:', e);
          }
        }
      }

      return { id: createdDbId, apartmentNumber: input.apartmentNumber.trim() };
    },
    [apartments, currentBuilding, isCurrentBuildingWritable, plans]
  );

  const updateApartmentUnit = useCallback(
    async (
      apartmentId: string,
      updates: {
        apartmentNumber?: string;
        floorNumber?: string;
        wingOrDirection?: string;
        areaSqm?: number;
        residentName?: string;
        residentPhone?: string;
      }
    ) => {
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id !== apartmentId && (updates.apartmentNumber && apt.apartment_number !== updates.apartmentNumber)) {
            return apt;
          }
          const occName =
            updates.residentName !== undefined
              ? updates.residentName.trim() || null
              : apt.occupant_name;
          const occPhone =
            updates.residentPhone !== undefined
              ? updates.residentPhone.trim() || null
              : apt.occupant_phone;
          const aptNum =
            updates.apartmentNumber !== undefined
              ? updates.apartmentNumber.trim()
              : apt.apartment_number;
          return {
            ...apt,
            apartment_number: aptNum,
            floor_number:
              updates.floorNumber !== undefined
                ? updates.floorNumber.trim()
                : apt.floor_number,
            wing_or_direction:
              updates.wingOrDirection !== undefined
                ? updates.wingOrDirection.trim()
                : apt.wing_or_direction,
            area_sqm:
              updates.areaSqm !== undefined ? updates.areaSqm : apt.area_sqm,
            occupant_name: occName,
            occupant_phone: occPhone,
            resident_name: occName
              ? `${occName} (مسجل مبدئياً)`
              : 'وحدة شاغرة (بانتظار التسجيل)',
            resident_phone: occPhone || '',
            invite_code: `${currentBuilding.building_code}-${aptNum}`,
          };
        })
      );

      if (isSupabaseConfigured) {
        try {
          const updatePayload: Record<string, any> = {};
          if (updates.apartmentNumber !== undefined) updatePayload.apartment_number = updates.apartmentNumber.trim();
          if (updates.floorNumber !== undefined) updatePayload.floor_number = updates.floorNumber.trim();
          if (updates.wingOrDirection !== undefined) updatePayload.wing_or_direction = updates.wingOrDirection.trim();
          if (updates.areaSqm !== undefined) updatePayload.area_sqm = updates.areaSqm;
          if (updates.residentName !== undefined) {
            updatePayload.occupant_name = updates.residentName.trim() || null;
          }
          if (updates.residentPhone !== undefined) {
            updatePayload.occupant_phone = updates.residentPhone.trim() || null;
          }

          if (Object.keys(updatePayload).length > 0) {
            await supabase
              .from('apartments')
              .update(updatePayload)
              .eq('id', apartmentId);
          }
        } catch (err) {
          console.warn('Supabase updateApartmentUnit error:', err);
        }
      }
    },
    [currentBuilding.building_code]
  );

  const deleteApartmentUnit = useCallback(async (apartmentId: string) => {
    setApartments((prev) => prev.filter((a) => a.id !== apartmentId));
    setApartmentObligations((prev) =>
      prev.filter((o) => o.apartment_id !== apartmentId)
    );

    if (isSupabaseConfigured) {
      try {
        await supabase.from('apartments').delete().eq('id', apartmentId);
      } catch (err) {
        console.warn('Supabase deleteApartmentUnit error:', err);
      }
    }
  }, []);

  return { addApartmentUnit, updateApartmentUnit, deleteApartmentUnit };
}
