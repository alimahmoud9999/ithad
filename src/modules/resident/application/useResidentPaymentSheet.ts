import React, { useState } from 'react';
import { Alert } from 'react-native';
import type { PaymentCategoryType, EmergencyClaim, ApartmentObligation, PaymentMethodType } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import type { ActiveSubView } from '../domain/resident.types';
import { useResidentLedger } from './useResidentLedger';

export function useResidentPaymentSheet({ setActiveSubView }: {
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
}) {
  const { currentBuilding } = useAppStore();
  const { monthlyStatus, currentMonthLabel, effectiveArrears } = useResidentLedger();

  // Payment State (Screens 8 & 9: PAYMENT_STATUS & PAY_UPLOAD_RECEIPT - _2)
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategoryType>('monthly_dues');
  const [selectedClaim, setSelectedClaim] = useState<EmergencyClaim | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<ApartmentObligation | null>(null);
  const [isArrearsPaymentMode, setIsArrearsPaymentMode] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>(
    String(currentBuilding.default_monthly_dues || 400)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('electronic_transfer');

  // Open Payment Sheet
  const openMonthlyPaymentSheet = () => {
    if (monthlyStatus === 'paid') {
      Alert.alert(
        'تم السداد مسبقاً ✅',
        `تم سداد اشتراك شهر (${currentMonthLabel}) بالكامل بالفعل ومعتمد في خزينة العمارة.`
      );
      return;
    }
    if (monthlyStatus === 'pending') {
      Alert.alert(
        'طلب قيد المراجعة ⏳',
        `لديك طلب سداد لاشتراك (${currentMonthLabel}) قيد مراجعة رئيس الاتحاد بالفعل.`
      );
      return;
    }
    setSelectedObligation(null);
    setIsArrearsPaymentMode(false);
    setPaymentCategory('monthly_dues');
    setSelectedClaim(null);
    setPaymentAmount(String(currentBuilding.default_monthly_dues || 400));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openObligationPaymentSheet = (obligation: ApartmentObligation) => {
    setSelectedObligation(obligation);
    setIsArrearsPaymentMode(true);
    setSelectedClaim(null);
    setPaymentCategory(obligation.category || 'monthly_dues');
    setPaymentAmount(String(obligation.amount));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openArrearsPaymentSheet = (amount?: number, isPartial?: boolean) => {
    const targetAmount = amount && amount > 0 ? amount : effectiveArrears;
    if (targetAmount <= 0) {
      Alert.alert('لا توجد مديونية', 'لا توجد أي مديونيات أو متأخرات مسجلة على شقتك حالياً.');
      return;
    }
    setSelectedObligation(null);
    setIsArrearsPaymentMode(true);
    setSelectedClaim(null);
    setPaymentCategory('monthly_dues');
    if (isPartial) {
      // Suggest reasonable partial amount (e.g. 1000 or half)
      const suggested = effectiveArrears > 1000 ? '1000' : String(effectiveArrears);
      setPaymentAmount(suggested);
    } else {
      setPaymentAmount(String(targetAmount));
    }
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  const openEmergencyContributionSheet = (claim: EmergencyClaim) => {
    setSelectedObligation(null);
    setIsArrearsPaymentMode(false);
    setPaymentCategory('emergency_claim');
    setSelectedClaim(claim);
    setPaymentAmount(String(claim.default_share_amount || 250));
    setPaymentMethod('electronic_transfer');
    setActiveSubView('payment_modal');
  };

  return {
    paymentCategory,
    setPaymentCategory,
    selectedClaim,
    setSelectedClaim,
    selectedObligation,
    setSelectedObligation,
    isArrearsPaymentMode,
    setIsArrearsPaymentMode,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    openMonthlyPaymentSheet,
    openObligationPaymentSheet,
    openArrearsPaymentSheet,
    openEmergencyContributionSheet,
  };
}
