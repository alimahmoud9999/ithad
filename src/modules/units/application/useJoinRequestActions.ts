import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/shared/types/database';
import { isSupabaseConfigured } from '@/shared/lib/supabase';
import { unitsApi } from '../infrastructure/units.api';
import type { StoreCore, ReviewedResidentEntry } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'isCurrentBuildingWritable'
  | 'processingIds'
  | 'setProcessingIds'
  | 'pendingResidents'
  | 'localPendingResidentRef'
  | 'apartments'
  | 'currentBuilding'
  | 'reviewedResidentKeysRef'
  | 'setReviewedResidentKeys'
  | 'usersByRole'
  | 'lastApprovedResidentRef'
  | 'setPendingResidents'
  | 'setUsersByRole'
  | 'setApartments'
  | 'pushAndRecordNotification'
>;

export function useJoinRequestActions({
  isCurrentBuildingWritable,
  processingIds,
  setProcessingIds,
  pendingResidents,
  localPendingResidentRef,
  apartments,
  currentBuilding,
  reviewedResidentKeysRef,
  setReviewedResidentKeys,
  usersByRole,
  lastApprovedResidentRef,
  setPendingResidents,
  setUsersByRole,
  setApartments,
  pushAndRecordNotification,
}: Deps) {
  // 3. Scenario 2B & Mechanism 2: Admin approves or rejects pending resident join request (with optional apartment override in 1 step)
  const reviewResidentJoinRequest = useCallback(
    async (
      residentId: string,
      approve: boolean,
      overrideApartmentNumber?: string
    ) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      if (processingIds[residentId]) return;
      setProcessingIds((prev) => ({ ...prev, [residentId]: true }));

      try {
        const target =
          pendingResidents.find((r) => r.id === residentId) ||
          localPendingResidentRef.current ||
          pendingResidents[0];
        if (!target) {
          throw new Error('تمت معالجة طلب هذا الساكن مسبقاً.');
        }

        const finalAptNumber = (
          overrideApartmentNumber?.trim() ||
          target.apartment_number ||
          ''
        ).trim();

        const targetAptObj = apartments.find(
          (a) =>
            a.building_id === (target.building_id || currentBuilding.id) &&
            a.apartment_number === finalAptNumber
        );

        const newStatus = approve ? 'active' : 'rejected';

        // 1. Synchronously register in reviewedResidentKeysRef and save to AsyncStorage BEFORE async RPC calls
        const reviewRecord: ReviewedResidentEntry = {
          status: newStatus,
          phone: target.phone,
          apartmentNumber: finalAptNumber,
          fullName: target.full_name,
          buildingId: target.building_id || currentBuilding.id,
          reviewedAt: new Date().toISOString(),
        };

        const updatedReviewed: Record<string, ReviewedResidentEntry> = {
          ...reviewedResidentKeysRef.current,
          [residentId]: reviewRecord,
          [target.id]: reviewRecord,
          ...(target.phone ? { [target.phone.trim()]: reviewRecord } : {}),
          ...(target.apartment_number
            ? {
                [`${target.building_id || currentBuilding.id}_${String(target.apartment_number).trim()}`]:
                  reviewRecord,
                [String(target.apartment_number).trim()]: reviewRecord,
              }
            : {}),
          ...(finalAptNumber
            ? {
                [`${target.building_id || currentBuilding.id}_${finalAptNumber}`]:
                  reviewRecord,
                [finalAptNumber]: reviewRecord,
              }
            : {}),
        };
        reviewedResidentKeysRef.current = updatedReviewed;
        setReviewedResidentKeys(updatedReviewed);
        AsyncStorage.setItem(
          '@ittihad_reviewed_residents',
          JSON.stringify(updatedReviewed)
        ).catch(() => {});

        // Clear localPendingResidentRef and store lastApprovedResidentRef if approved
        localPendingResidentRef.current = null;
        AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});

        const updatedResidentProfile: UserProfile = {
          ...usersByRole.resident,
          ...target,
          id: residentId,
          role: 'resident',
          status: newStatus,
          full_name: target.full_name || usersByRole.resident.full_name,
          phone: target.phone || usersByRole.resident.phone,
          apartment_number:
            finalAptNumber || usersByRole.resident.apartment_number,
          apartment_id: targetAptObj?.id || usersByRole.resident.apartment_id,
          floor_number:
            targetAptObj?.floor_number ||
            target.floor_number ||
            usersByRole.resident.floor_number ||
            'الدور الخامس',
          building_id:
            target.building_id || usersByRole.resident.building_id || currentBuilding.id,
        };

        if (approve) {
          lastApprovedResidentRef.current = updatedResidentProfile;
          AsyncStorage.setItem(
            '@ittihad_approved_resident',
            JSON.stringify(updatedResidentProfile)
          ).catch(() => {});
        } else {
          lastApprovedResidentRef.current = null;
          AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});
        }

        // 2. Immediately remove from pendingResidents
        setPendingResidents((prev) =>
          prev.filter(
            (r) =>
              r.id !== residentId &&
              r.id !== target.id &&
              (target.phone ? r.phone?.trim() !== target.phone.trim() : true) &&
              (finalAptNumber
                ? String(r.apartment_number).trim() !== finalAptNumber
                : true)
          )
        );

        // 3. Immediately update usersByRole.resident
        setUsersByRole((prev) => ({
          ...prev,
          resident: updatedResidentProfile,
        }));

        if (isSupabaseConfigured) {
          try {
            await unitsApi.reviewResidentJoinRequest(
              residentId,
              approve,
              targetAptObj?.id ?? null,
              finalAptNumber || null
            );
          } catch (rpcErr) {
            console.warn('reviewResidentJoinRequest error:', rpcErr);
            throw rpcErr;
          }
        }

        if (approve && finalAptNumber) {
          setApartments((prev) => {
            const exists = prev.some(
              (a) =>
                a.building_id === target.building_id &&
                a.apartment_number === finalAptNumber
            );
            if (exists) {
              return prev.map((a) =>
                a.building_id === target.building_id &&
                a.apartment_number === finalAptNumber
                  ? {
                      ...a,
                      resident_id: target.id,
                      resident_name: target.full_name,
                      resident_phone: target.phone,
                      occupant_name: target.full_name || a.occupant_name,
                      occupant_phone: target.phone || a.occupant_phone,
                    }
                  : a
              );
            }
            return [
              ...prev,
              {
                id: 'apt-' + finalAptNumber,
                building_id: target.building_id || currentBuilding.id,
                apartment_number: finalAptNumber,
                floor_number: target.floor_number || 'الدور الرابع',
                wing_or_direction: 'واجهة',
                area_sqm: 160,
                ownership_share_percent: target.ownership_share_percent,
                occupant_name: target.full_name,
                occupant_phone: target.phone,
                arrears_amount: currentBuilding.default_monthly_dues,
                resident_id: target.id,
                resident_name: target.full_name,
                resident_phone: target.phone,
                payment_status: 'unpaid',
                unpaid_months_count: 1,
                unpaid_amount: currentBuilding.default_monthly_dues,
                is_active: true,
              },
            ];
          });
        }

        const wasReassigned =
          Boolean(overrideApartmentNumber) &&
          overrideApartmentNumber?.trim() !== target.apartment_number;

        // Scenario 2B: Notify Resident of Join Request Approval or Rejection
        await pushAndRecordNotification({
          recipientId: target.id,
          recipientRole: 'resident',
          recipientPushToken:
            target.push_token || usersByRole.resident.push_token,
          buildingId: target.building_id || currentBuilding.id,
          title: approve
            ? `تم قبول انضمامك وتفعيل حسابك بنجاح (شقة ${finalAptNumber}) 🎉`
            : `تعذر قبول طلب الانضمام لشقة ${target.apartment_number}`,
          body: approve
            ? wasReassigned
              ? `مرحباً ${target.full_name}، قام رئيس الاتحاد بتعديل رقم وحدتك إلى شقة (${finalAptNumber}) بدلاً من (${target.apartment_number}) واعتماد انضمامك رسمياً.`
              : `مرحباً ${target.full_name}، وافق رئيس اتحاد الملاك على انضمامك لشقة (${finalAptNumber}). يمكنك الآن الدخول لكافة شاشات التطبيق ومتابعة الخزينة.`
            : `نعتذر ${target.full_name}، لم تتم الموافقة على طلب انضمامك لشقة (${target.apartment_number}). يرجى مراجعة رئيس اتحاد الملاك.`,
          category: 'join_request',
          badgeLabel: approve ? 'حساب مفعل' : 'مرفوض',
          isUrgent: !approve,
          metadata: {
            apartment_number: finalAptNumber || undefined,
            resident_id: target.id,
          },
        });
      } finally {
        setProcessingIds((prev) => ({ ...prev, [residentId]: false }));
      }
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      isCurrentBuildingWritable,
      pendingResidents,
      processingIds,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  return { reviewResidentJoinRequest };
}
