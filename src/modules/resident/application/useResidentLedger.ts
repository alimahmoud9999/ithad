import { useMemo } from 'react';
import { useAppStore } from '@/store/AppContext';

export function useResidentLedger() {
  const { currentUser, apartments, apartmentObligations, payments } = useAppStore();

  // Find current resident's apartment
  const myApartment = useMemo(() => {
    const myAptNum = currentUser.apartment_number;
    const myAptId = currentUser.apartment_id;
    return (
      apartments.find(
        (a) =>
          (myAptId && a.id === myAptId) ||
          (myAptNum && a.apartment_number && String(a.apartment_number).trim() === String(myAptNum).trim())
      ) || null
    );
  }, [apartments, currentUser.apartment_id, currentUser.apartment_number]);

  // Current resident's registered obligations
  const myObligations = useMemo(() => {
    const myAptNum = currentUser.apartment_number || myApartment?.apartment_number;
    const myAptId = currentUser.apartment_id || myApartment?.id;
    return apartmentObligations.filter((o) => {
      if (myAptId && o.apartment_id === myAptId) return true;
      if (myAptNum && o.apartment_number && String(o.apartment_number).trim() === String(myAptNum).trim()) return true;
      return false;
    });
  }, [apartmentObligations, currentUser.apartment_id, currentUser.apartment_number, myApartment]);

  const myUnpaidObligations = useMemo(() => {
    return myObligations.filter((o) => o.status === 'unpaid');
  }, [myObligations]);

  const myActiveObligations = useMemo(() => {
    return myObligations.filter((o) => o.status === 'unpaid' || o.status === 'pending');
  }, [myObligations]);

  const totalObligationsDebt = useMemo(() => {
    return myUnpaidObligations.reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [myUnpaidObligations]);

  const effectiveArrears = useMemo(() => {
    const aptArrears = myApartment?.arrears_amount || myApartment?.unpaid_amount || 0;
    if (aptArrears > 0 && totalObligationsDebt > 0) {
      return Math.min(aptArrears, totalObligationsDebt);
    }
    return Math.max(totalObligationsDebt, aptArrears);
  }, [totalObligationsDebt, myApartment]);

  // Pending payments for arrears or obligations
  const pendingArrearsPayments = useMemo(() => {
    const myAptNum = currentUser.apartment_number || myApartment?.apartment_number;
    const myAptId = currentUser.apartment_id || myApartment?.id;
    return payments.filter(
      (p) =>
        p.status === 'pending' &&
        ((myAptId && p.apartment_id === myAptId) ||
          (myAptNum && p.apartment_number && String(p.apartment_number).trim() === String(myAptNum).trim()) ||
          (currentUser.id && p.resident_id === currentUser.id)) &&
        (p.notes?.includes('مديونية') || p.notes?.includes('[سداد') || p.payment_category === 'monthly_dues')
    );
  }, [payments, currentUser.apartment_id, currentUser.apartment_number, currentUser.id, myApartment]);

  const totalPendingArrearsAmount = useMemo(() => {
    return pendingArrearsPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [pendingArrearsPayments]);

  const currentBillingMonth = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const currentMonthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'الشهر الحالي';
    }
  }, []);

  // Determine current resident's monthly payment status
  const currentMonthPayment = useMemo(() => {
    const myApt = currentUser.apartment_number || '302';
    return payments.find(
      (p) =>
        ((p.resident_id && currentUser.id && p.resident_id === currentUser.id) ||
          (p.resident_id && p.resident_id === 'usr-res-001') ||
          (Boolean(p.apartment_number) &&
            String(p.apartment_number).trim() === String(myApt).trim()) ||
          (Boolean(p.apartment_id) &&
            Boolean(currentUser.apartment_id) &&
            p.apartment_id === currentUser.apartment_id)) &&
        p.payment_category === 'monthly_dues' &&
        p.billing_month === currentBillingMonth
    );
  }, [
    payments,
    currentUser.id,
    currentUser.apartment_number,
    currentUser.apartment_id,
    currentBillingMonth,
  ]);

  const monthlyStatus = currentMonthPayment?.status || 'unpaid';

  // Resident history payments for Unit Ledger (Screen 10)
  const myUnitPayments = useMemo(() => {
    const myApt = currentUser.apartment_number || '302';
    return payments.filter(
      (p) =>
        (p.resident_id && currentUser.id && p.resident_id === currentUser.id) ||
        (Boolean(p.apartment_number) && String(p.apartment_number).trim() === String(myApt).trim())
    );
  }, [payments, currentUser]);

  return {
    myApartment,
    myObligations,
    myUnpaidObligations,
    myActiveObligations,
    totalObligationsDebt,
    effectiveArrears,
    pendingArrearsPayments,
    totalPendingArrearsAmount,
    currentBillingMonth,
    currentMonthLabel,
    currentMonthPayment,
    monthlyStatus,
    myUnitPayments,
  };
}
