import { useState } from 'react';
import type { Apartment } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import type { StagedObligation } from '../domain/units.types';

export function useArrearsForm() {
  const { currentBuilding } = useAppStore();

  // Dedicated Add Arrears Modal State (MODAL 4)
  const [arrearsModalVisible, setArrearsModalVisible] = useState(false);
  const [arrearsTargetApt, setArrearsTargetApt] = useState<Apartment | null>(null);
  const [arrearsModalType, setArrearsModalType] = useState<'monthly_dues' | 'custom'>('monthly_dues');
  const [arrearsAmountInput, setArrearsAmountInput] = useState('');
  const [arrearsMonthNum, setArrearsMonthNum] = useState<number>(new Date().getMonth() + 1);
  const [arrearsCustomTitleInput, setArrearsCustomTitleInput] = useState('');
  const [arrearsNotesInput, setArrearsNotesInput] = useState('');
  const [modalStagedObligations, setModalStagedObligations] = useState<StagedObligation[]>([]);

  // Open Dedicated Arrears Modal
  const openArrearsModal = (apt: Apartment) => {
    setArrearsTargetApt(apt);
    setArrearsModalType('monthly_dues');
    setArrearsAmountInput(String(currentBuilding.default_monthly_dues || 400));
    setArrearsMonthNum(new Date().getMonth() + 1);
    setArrearsCustomTitleInput('');
    setArrearsNotesInput('');
    setModalStagedObligations([]);
    setArrearsModalVisible(true);
  };

  return {
    arrearsModalVisible,
    setArrearsModalVisible,
    arrearsTargetApt,
    setArrearsTargetApt,
    arrearsModalType,
    setArrearsModalType,
    arrearsAmountInput,
    setArrearsAmountInput,
    arrearsMonthNum,
    setArrearsMonthNum,
    arrearsCustomTitleInput,
    setArrearsCustomTitleInput,
    arrearsNotesInput,
    setArrearsNotesInput,
    modalStagedObligations,
    setModalStagedObligations,
    openArrearsModal,
  };
}
