import { useCallback } from 'react';
import type { Apartment, Building, UserProfile } from '@/shared/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authSignIn, authSignUp } from '../infrastructure/auth.api';
import { ensureSupabaseSession, isSupabaseConfigured, supabase } from '@/shared/lib/supabase';
import { onboardingApi } from '../infrastructure/onboarding.api';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'usersByRole'
  | 'setBuildings'
  | 'setApartments'
  | 'setApartmentObligations'
  | 'setPayments'
  | 'setExpenses'
  | 'setEmergencyClaims'
  | 'setPendingResidents'
  | 'setBuildingIssues'
  | 'setPolls'
  | 'setPollVotes'
  | 'setIssueUpvotes'
  | 'localPendingResidentRef'
  | 'lastApprovedResidentRef'
  | 'reviewedResidentKeysRef'
  | 'setReviewedResidentKeys'
  | 'setUsersByRole'
  | 'setCurrentRole'
  | 'setAuthenticated'
  | 'loadDataFromSupabase'
  | 'buildings'
  | 'expoPushToken'
  | 'pushAndRecordNotification'
  | 'currentBuilding'
>;

export function useOnboardingActions({
  usersByRole,
  setBuildings,
  setApartments,
  setApartmentObligations,
  setPayments,
  setExpenses,
  setEmergencyClaims,
  setPendingResidents,
  setBuildingIssues,
  setPolls,
  setPollVotes,
  setIssueUpvotes,
  localPendingResidentRef,
  lastApprovedResidentRef,
  reviewedResidentKeysRef,
  setReviewedResidentKeys,
  setUsersByRole,
  setCurrentRole,
  setAuthenticated,
  loadDataFromSupabase,
  buildings,
  expoPushToken,
  pushAndRecordNotification,
  currentBuilding,
}: Deps) {
  // 1. Admin creates building (60-day Pro trial + unique building_code)
  const createBuildingForAdmin = useCallback(
    async (input: {
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
      buildingName: string;
      address: string;
      totalApartments: number;
      defaultMonthlyDues: number;
      adminApartmentNumber: string;
    }) => {
      let rpcBuildingCode: string | null = null;
      let rpcBuildingId: string | null = null;
      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSessionEmail = sessionData?.session?.user?.email?.trim().toLowerCase();
        const targetEmail = input.email?.trim().toLowerCase();

        // If target email is provided and differs from active session or if previous session is stale, sign out
        if (targetEmail && input.password) {
          if (currentSessionEmail && currentSessionEmail !== targetEmail) {
            await supabase.auth.signOut();
          }

          const hasSession = await ensureSupabaseSession();
          if (!hasSession) {
            try {
              await authSignUp(targetEmail, input.password, {
                fullName: input.fullName,
                phone: input.phone,
                role: 'admin',
              });
            } catch (signUpErr: any) {
              if (
                signUpErr?.message?.toLowerCase().includes('already registered') ||
                signUpErr?.message?.includes('مسجل بالفعل')
              ) {
                try {
                  await authSignIn(targetEmail, input.password);
                } catch {}
              } else {
                throw signUpErr;
              }
            }
          }
        }
        const { data, error } = await onboardingApi.createBuildingForAdmin(input);
        if (error) {
          throw new Error(error.message);
        }
        if (data?.building_code) {
          rpcBuildingCode = String(data.building_code);
        }
        if (data?.building_id) {
          rpcBuildingId = String(data.building_id);
        }
      }

      const generatedCode =
        rpcBuildingCode ||
        'BLD-' + Math.floor(1000 + Math.random() * 9000).toString();
      const trialEnd = new Date(Date.now() + 60 * 86400000).toISOString();
      const newBuildingId = rpcBuildingId || 'bld-' + Date.now();

      const newBuilding: Building = {
        id: newBuildingId,
        name: input.buildingName.trim(),
        address: input.address.trim(),
        city: 'القاهرة',
        building_code: generatedCode,
        admin_id: usersByRole.admin.id,
        fund_balance: 0,
        default_monthly_dues: input.defaultMonthlyDues,
        total_apartments: input.totalApartments,
        plan_code: 'pro',
        subscription_status: 'trial',
        trial_ends_at: trialEnd,
        subscription_ends_at: trialEnd,
        custom_monthly_price: null,
        max_apartments_override: null,
        features_config: {
          receipt_upload: true,
          emergency_claims: true,
          export_reports: true,
          voting: true,
          maintenance_tickets: true,
          documents_archive: true,
        },
        created_at: new Date().toISOString(),
      };

      const adminApt: Apartment = {
        id: 'apt-' + Date.now(),
        building_id: newBuildingId,
        apartment_number: input.adminApartmentNumber.trim(),
        floor_number: 'الدور الأول',
        wing_or_direction: 'واجهة',
        area_sqm: 160,
        ownership_share_percent: Number(
          (100 / Math.max(input.totalApartments, 1)).toFixed(2)
        ),
        monthly_dues_override: null,
        resident_name: input.fullName.trim(),
        resident_phone: input.phone.trim(),
        occupant_name: input.fullName.trim(),
        occupant_phone: input.phone.trim(),
        resident_id: usersByRole.admin.id,
        invite_code: `${generatedCode}-${input.adminApartmentNumber.trim()}`,
        payment_status: 'unpaid',
        arrears_amount: 0,
        unpaid_amount: input.defaultMonthlyDues || 300,
        unpaid_months_count: 1,
        is_active: true,
      };

      // Completely clear any old building residue in local memory
      setBuildings([newBuilding]);
      setApartments([adminApt]);
      setApartmentObligations([]);
      setPayments([]);
      setExpenses([]);
      setEmergencyClaims([]);
      setPendingResidents([]);
      setBuildingIssues([]);
      setPolls([]);
      setPollVotes([]);
      setIssueUpvotes([]);

      // Clear local storage caches of old resident review state
      localPendingResidentRef.current = null;
      lastApprovedResidentRef.current = null;
      reviewedResidentKeysRef.current = {};
      setReviewedResidentKeys({});
      AsyncStorage.multiRemove([
        '@ittihad_reviewed_residents',
        '@ittihad_local_pending_resident',
        '@ittihad_approved_resident',
      ]).catch(() => {});

      setUsersByRole((prev) => ({
        ...prev,
        admin: {
          ...prev.admin,
          full_name: input.fullName,
          phone: input.phone,
          building_id: newBuildingId,
          apartment_number: input.adminApartmentNumber,
          status: 'active',
        },
      }));
      setCurrentRole('admin');
      setAuthenticated(true);
      loadDataFromSupabase();

      return { buildingCode: generatedCode };
    },
    [usersByRole.admin.id, loadDataFromSupabase]
  );

  // 2. Scenario 1A: Resident requests to join building ➔ Immediate Push Notification to Admin!
  const requestJoinBuilding = useCallback(
    async (input: {
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
      buildingCode: string;
      apartmentNumber: string;
      floorNumber?: string;
    }) => {
      let cleanCode = input.buildingCode.trim().toUpperCase();
      let targetAptNumber = input.apartmentNumber.trim();
      const parts = cleanCode.split('-');
      if (parts.length >= 3 && parts[0] === 'BLD') {
        cleanCode = `${parts[0]}-${parts[1]}`;
        if (!targetAptNumber) {
          targetAptNumber = parts.slice(2).join('-');
        }
      }

      let rpcUserId: string | null = null;
      let rpcBuildingId: string | null = null;
      let rpcBuildingName: string | null = null;

      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSessionEmail = sessionData?.session?.user?.email?.trim().toLowerCase();
        const targetEmail = input.email?.trim().toLowerCase();

        // If target email is provided and differs from active session (e.g. admin logged in on this device), sign out previous user
        if (targetEmail && input.password) {
          if (currentSessionEmail && currentSessionEmail !== targetEmail) {
            await supabase.auth.signOut();
          }

          const hasSession = await ensureSupabaseSession();
          if (!hasSession) {
            try {
              await authSignUp(targetEmail, input.password, {
                fullName: input.fullName,
                phone: input.phone,
                role: 'resident',
              });
            } catch (signUpErr: any) {
              if (
                signUpErr?.message?.toLowerCase().includes('already registered') ||
                signUpErr?.message?.includes('مسجل بالفعل')
              ) {
                try {
                  await authSignIn(targetEmail, input.password);
                } catch {}
              } else {
                throw signUpErr;
              }
            }
          }
        }

        const { data: rpcJoinData, error } = await onboardingApi.requestJoinBuilding({
          ...input,
          buildingCode: cleanCode,
          apartmentNumber: targetAptNumber,
        });

        if (error) {
          if (error.message.includes('User is already an active member of an existing building')) {
            throw new Error(
              'هذا الحساب مسجل بالفعل كعضو نشط في العمارة. إذا كنت تسجل ساكناً أو مالكاً جديداً، يرجى كتابة بريد إلكتروني وكلمة مرور جديدة خاصة بالساكن (أو تسجيل الخروج أولاً من حساب رئيس الاتحاد).'
            );
          }
          throw new Error(error.message);
        }

        rpcUserId = rpcJoinData?.user_id || null;
        rpcBuildingId = rpcJoinData?.building_id || null;
        rpcBuildingName = rpcJoinData?.building_name || null;
      }

      let targetBuilding = buildings.find(
        (b) =>
          b.building_code.trim().toUpperCase() === cleanCode ||
          (rpcBuildingId && b.id === rpcBuildingId)
      );

      // If not yet present in local memory, check Supabase directly or fallback
      if (!targetBuilding && isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('buildings')
            .select('*')
            .or(`building_code.ilike.${cleanCode}${rpcBuildingId ? `,id.eq.${rpcBuildingId}` : ''}`)
            .maybeSingle();
          if (data) {
            targetBuilding = data as Building;
            setBuildings((prev) => [data as Building, ...prev]);
          } else if (rpcBuildingId) {
            const fallbackBld: Building = {
              id: rpcBuildingId,
              name: rpcBuildingName || 'عمارة سكنية',
              address: 'القاهرة',
              city: 'القاهرة',
              building_code: cleanCode,
              admin_id: '',
              fund_balance: 0,
              default_monthly_dues: 350,
              total_apartments: 16,
              plan_code: 'pro',
              subscription_status: 'trial',
              trial_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              subscription_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              custom_monthly_price: null,
              max_apartments_override: null,
              features_config: {
                receipt_upload: true,
                emergency_claims: true,
                export_reports: true,
                voting: true,
                maintenance_tickets: true,
                documents_archive: true,
              },
              created_at: new Date().toISOString(),
            };
            targetBuilding = fallbackBld;
            setBuildings((prev) => [fallbackBld, ...prev]);
          }
        } catch {}
      }

      if (!targetBuilding) {
        throw new Error(
          `كود المبنى (${input.buildingCode}) غير صحيح أو غير مسجل في قاعدة البيانات. يرجى الحصول على الكود الصحيح من رئيس الاتحاد.`
        );
      }

      const pendingUser: UserProfile = {
        id: rpcUserId || 'usr-res-' + Date.now(),
        full_name: input.fullName.trim(),
        email: input.email?.trim() || 'resident@ittihad.app',
        phone: input.phone.trim(),
        role: 'resident',
        status: 'pending',
        building_id: targetBuilding.id,
        apartment_id: 'apt-' + targetAptNumber,
        apartment_number: targetAptNumber,
        floor_number: input.floorNumber || 'الدور الأول',
        residency_type: 'owner_resident',
        ownership_share_percent: Number(
          (100 / Math.max(targetBuilding.total_apartments, 1)).toFixed(2)
        ),
        push_token: expoPushToken,
        push_token_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Clear previous review records for this applicant so the new join request is treated as pending
      const nextReviewed = { ...reviewedResidentKeysRef.current };
      delete nextReviewed[pendingUser.id];
      delete nextReviewed[input.phone.trim()];
      delete nextReviewed[`${targetBuilding.id}_${targetAptNumber}`];
      delete nextReviewed[targetAptNumber];
      reviewedResidentKeysRef.current = nextReviewed;
      setReviewedResidentKeys(nextReviewed);
      AsyncStorage.setItem('@ittihad_reviewed_residents', JSON.stringify(nextReviewed)).catch(() => {});

      localPendingResidentRef.current = pendingUser;
      lastApprovedResidentRef.current = null;
      AsyncStorage.setItem('@ittihad_local_pending_resident', JSON.stringify(pendingUser)).catch(() => {});
      AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});

      setPendingResidents((prev) => {
        const filtered = prev.filter(
          (p) =>
            p.id !== pendingUser.id &&
            (p.phone !== input.phone.trim() ||
              p.apartment_number !== targetAptNumber)
        );
        return [pendingUser, ...filtered];
      });
      setUsersByRole((prev) => ({
        ...prev,
        resident: pendingUser,
      }));
      setCurrentRole('resident');
      setAuthenticated(true);

      // Scenario 1A: Send immediate notification to Building Admin
      await pushAndRecordNotification({
        recipientId: usersByRole.admin.id,
        recipientRole: 'admin',
        recipientPushToken: usersByRole.admin.push_token,
        buildingId: targetBuilding.id,
        title: `طلب انضمام ساكن جديد (شقة ${input.apartmentNumber.trim()}) 🔔`,
        body: `قام الساكن (${input.fullName.trim()}) بطلب الانضمام لشقة رقم (${input.apartmentNumber.trim()}) في ${targetBuilding.name} وهو بانتظار موافقتك.`,
        category: 'join_request',
        badgeLabel: 'طلب انضمام معلق',
        isUrgent: true,
        metadata: {
          apartment_number: input.apartmentNumber.trim(),
          resident_id: pendingUser.id,
        },
      });
    },
    [buildings, currentBuilding, expoPushToken, pushAndRecordNotification, usersByRole.admin]
  );

  return { createBuildingForAdmin, requestJoinBuilding };
}
