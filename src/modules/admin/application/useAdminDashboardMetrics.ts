import { useMemo } from 'react';
import { useAppStore } from '@/store/AppContext';

export function useAdminDashboardMetrics() {
  const { apartments, currentBuilding, payments, pendingResidents, emergencyClaims, expenses, buildingIssues, polls } = useAppStore();

  const currentCycleLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'الدورة الحالية';
    }
  }, []);

  // Filtered Data for current building
  const buildingApartments = useMemo(
    () =>
      apartments.filter(
        (a) => a.building_id === currentBuilding.id && a.is_active
      ),
    [apartments, currentBuilding.id]
  );

  const buildingPayments = useMemo(
    () => payments.filter((p) => p.building_id === currentBuilding.id),
    [payments, currentBuilding.id]
  );

  const pendingPayments = useMemo(
    () => buildingPayments.filter((p) => p.status === 'pending'),
    [buildingPayments]
  );

  const unpaidApartments = useMemo(
    () =>
      apartments.filter(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.payment_status === 'unpaid'
      ),
    [apartments, currentBuilding.id]
  );

  const buildingPendingResidents = useMemo(
    () =>
      pendingResidents.filter(
        (r) => r.building_id === currentBuilding.id && r.status === 'pending'
      ),
    [pendingResidents, currentBuilding.id]
  );

  const activeEmergencyClaims = useMemo(
    () =>
      emergencyClaims.filter(
        (c) => c.building_id === currentBuilding.id && c.status === 'active'
      ),
    [emergencyClaims, currentBuilding.id]
  );

  const monthlyExpensesTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.building_id === currentBuilding.id)
        .reduce((acc, item) => acc + item.amount, 0),
    [expenses, currentBuilding.id]
  );

  const monthlyCollectedTotal = useMemo(
    () =>
      buildingPayments
        .filter((p) => p.status === 'paid')
        .reduce((acc, item) => acc + item.amount, 0),
    [buildingPayments]
  );

  const collectionPercentage = useMemo(() => {
    const expectedMonthly = Math.max(
      currentBuilding.total_apartments * currentBuilding.default_monthly_dues,
      1
    );
    if (monthlyCollectedTotal > 0) {
      return Math.min(
        100,
        Math.round((monthlyCollectedTotal / expectedMonthly) * 100)
      );
    }
    const paidUnitsCount = buildingApartments.filter(
      (a) => a.payment_status === 'paid'
    ).length;
    if (paidUnitsCount === 0) return 0;
    return Math.min(
      100,
      Math.round(
        (paidUnitsCount / Math.max(currentBuilding.total_apartments, 1)) * 100
      )
    );
  }, [
    buildingApartments,
    currentBuilding.default_monthly_dues,
    currentBuilding.total_apartments,
    monthlyCollectedTotal,
  ]);

  const occupiedApartments = useMemo(() => {
    return buildingApartments.filter(
      (a) =>
        Boolean(a.resident_id) ||
        (a.occupant_name &&
          a.occupant_name.trim() !== '' &&
          a.occupant_name !== 'وحدة شاغرة' &&
          a.occupant_name !== 'شاغرة')
    );
  }, [buildingApartments]);

  const totalArrearsAmount = useMemo(() => {
    return unpaidApartments.reduce(
      (sum, apt) =>
        sum + (apt.unpaid_amount || currentBuilding.default_monthly_dues),
      0
    );
  }, [unpaidApartments, currentBuilding.default_monthly_dues]);

  const activeIssuesCount = useMemo(() => {
    return buildingIssues.filter((i) => i.status !== 'resolved').length;
  }, [buildingIssues]);

  const activePollsCount = useMemo(() => {
    return polls.filter((p) => p.status === 'active').length;
  }, [polls]);

  return {
    currentCycleLabel,
    buildingApartments,
    buildingPayments,
    pendingPayments,
    unpaidApartments,
    buildingPendingResidents,
    activeEmergencyClaims,
    monthlyExpensesTotal,
    monthlyCollectedTotal,
    collectionPercentage,
    occupiedApartments,
    totalArrearsAmount,
    activeIssuesCount,
    activePollsCount,
  };
}
