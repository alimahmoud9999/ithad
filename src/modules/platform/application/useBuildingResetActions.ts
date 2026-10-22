import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'currentBuilding'
  | 'reviewedResidentKeysRef'
  | 'localPendingResidentRef'
  | 'lastApprovedResidentRef'
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
  | 'setBuildings'
  | 'loadDataFromSupabase'
  | 'logout'
>;

export function useBuildingResetActions({
  currentBuilding,
  reviewedResidentKeysRef,
  localPendingResidentRef,
  lastApprovedResidentRef,
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
  setBuildings,
  loadDataFromSupabase,
  logout,
}: Deps) {
  const resetBuildingData = useCallback(
    async (mode: 'residents_only' | 'full_delete') => {
      if (!currentBuilding?.id) {
        throw new Error('لا توجد عمارة محددة حالياً لتنفيذ العملية عليها');
      }
      const buildingId = currentBuilding.id;

      if (isRemoteBackendEnabled) {
        const { data, error } = await repositories.platform.resetBuildingData(buildingId, mode);
        if (error) {
          throw new Error(error.message || 'فشلت عملية إعادة تهيئة البيانات');
        }
        if (data && typeof data === 'object' && (data as any).success === false) {
          throw new Error((data as any).error || 'فشلت عملية إعادة تهيئة البيانات');
        }
      }

      // Clear local storage pending caches
      await AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});
      await AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});
      await AsyncStorage.removeItem('@ittihad_reviewed_residents').catch(() => {});
      reviewedResidentKeysRef.current = {};
      localPendingResidentRef.current = null;
      lastApprovedResidentRef.current = null;

      if (mode === 'residents_only') {
        // Clear all resident and transaction state in memory
        setApartments([]);
        setApartmentObligations([]);
        setPayments([]);
        setExpenses([]);
        setEmergencyClaims([]);
        setPendingResidents([]);
        setBuildingIssues([]);
        setPolls([]);
        setPollVotes([]);
        setIssueUpvotes([]);
        setBuildings((prev) =>
          prev.map((b) => (b.id === buildingId ? { ...b, fund_balance: 0 } : b))
        );
        await loadDataFromSupabase();
      } else {
        // Full delete: cascade delete building, logout, reset to onboarding
        await logout();
        setBuildings((prev) => prev.filter((b) => b.id !== buildingId));
        setApartments([]);
        setApartmentObligations([]);
        setPayments([]);
        setExpenses([]);
        setEmergencyClaims([]);
        setPendingResidents([]);
        setBuildingIssues([]);
        setPolls([]);
        setPollVotes([]);
        setIssueUpvotes([]);
      }
    },
    [currentBuilding.id, loadDataFromSupabase, logout]
  );

  return { resetBuildingData };
}
