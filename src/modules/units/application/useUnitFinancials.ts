import { useMemo, useCallback } from 'react';
import type { Apartment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';

export function useUnitFinancials() {
  const { currentBuilding, apartments, apartmentObligations, payments } = useAppStore();

  // Robust building apartments resolution:
  const buildingApartments = useMemo(() => {
    if (!currentBuilding || !currentBuilding.id) {
      return apartments;
    }
    const filtered = apartments.filter(
      (a) => !a.building_id || a.building_id === currentBuilding.id
    );
    return filtered.length > 0 ? filtered : apartments;
  }, [apartments, currentBuilding]);

  // Financial calculations helper for any apartment
  const getApartmentFinancials = useCallback(
    (apt: Apartment) => {
      const aptObls = apartmentObligations.filter(
        (o) =>
          (o.apartment_id && o.apartment_id === apt.id) ||
          (o.apartment_number &&
            String(o.apartment_number).trim() === String(apt.apartment_number).trim())
      );
      const unpaidObls = aptObls.filter((o) => o.status === 'unpaid');
      const paidObls = aptObls.filter((o) => o.status === 'paid');
      const totalOblsDebt = unpaidObls.reduce(
        (sum, o) => sum + (Number(o.amount) || 0),
        0
      );
      const dbArrears = Number(apt.arrears_amount) || 0;
      const effectiveArrears = dbArrears > 0 && totalOblsDebt > 0
        ? Math.min(dbArrears, totalOblsDebt)
        : Math.max(dbArrears, totalOblsDebt);
      const hasDebt = effectiveArrears > 0;
      const isPending =
        apt.payment_status === 'pending' ||
        (apt.payment_status as any) === 'pending_review';
      const isPaid = apt.payment_status === 'paid' && !hasDebt;
      const isOverdue =
        hasDebt ||
        apt.payment_status === 'unpaid' ||
        (apt.payment_status as any) === 'overdue';
      const monthlyDues = currentBuilding.default_monthly_dues || 400;
      const totalDueAmount = effectiveArrears + (isPaid ? 0 : monthlyDues);

      const unitPendingPayments = payments.filter(
        (p) =>
          p.status === 'pending' &&
          ((p.apartment_id && p.apartment_id === apt.id) ||
            (p.apartment_number &&
              String(p.apartment_number).trim() === String(apt.apartment_number).trim()))
      );
      const pendingAmount = unitPendingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      return {
        aptObls,
        unpaidObls,
        paidObls,
        totalOblsDebt,
        effectiveArrears,
        hasDebt,
        isPending,
        isPaid,
        isOverdue,
        monthlyDues,
        totalDueAmount,
        unitPendingPayments,
        pendingAmount,
      };
    },
    [apartmentObligations, currentBuilding.default_monthly_dues, payments]
  );

  // Statistics calculation for the collection hero card (design/_28)
  const stats = useMemo(() => {
    const total = buildingApartments.length;
    let paidCount = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    buildingApartments.forEach((apt) => {
      const f = getApartmentFinancials(apt);
      if (f.isPending) pendingCount++;
      else if (f.isOverdue) overdueCount++;
      else if (f.isPaid) paidCount++;
      else overdueCount++;
    });

    const percent = total > 0 ? Math.round((paidCount / total) * 100) : 0;
    const collected = paidCount * (currentBuilding.default_monthly_dues || 400);

    return { total, paidCount, overdueCount, pendingCount, percent, collected };
  }, [buildingApartments, currentBuilding, getApartmentFinancials]);

  return {
    buildingApartments,
    getApartmentFinancials,
    stats,
  };
}
