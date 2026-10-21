import { useState } from 'react';
import type { Apartment } from '@/shared/types/database';

export function useEditUnitForm() {
  // Edit Unit Modal State (Screen 18: _18)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingApt, setEditingApt] = useState<Apartment | null>(null);
  const [editAptNumber, setEditAptNumber] = useState('');
  const [editFloorNumber, setEditFloorNumber] = useState('');
  const [editResidentName, setEditResidentName] = useState('');
  const [editResidentPhone, setEditResidentPhone] = useState('');
  const [editAreaSqm, setEditAreaSqm] = useState('165');
  const [editOrientation, setEditOrientation] = useState<'بحري' | 'قبلي' | 'شرقي' | 'واجهة'>('واجهة');
  const [editAddArrears, setEditAddArrears] = useState('');
  const [editArrearsTitle, setEditArrearsTitle] = useState('اشتراك شهري متأخر');

  // Open Edit Modal (Screen 18: _18)
  const openEditModal = (apt: Apartment) => {
    setEditingApt(apt);
    setEditAptNumber(apt.apartment_number);
    setEditFloorNumber(apt.floor_number || '');
    setEditResidentName(apt.occupant_name || apt.resident_name || '');
    setEditResidentPhone(apt.occupant_phone || apt.resident_phone || '');
    setEditAreaSqm(String(apt.area_sqm || 165));
    setEditOrientation((apt.wing_or_direction as any) || 'واجهة');
    setEditAddArrears('');
    setEditArrearsTitle('اشتراك شهري متأخر');
    setEditModalVisible(true);
  };

  return {
    editModalVisible,
    setEditModalVisible,
    editingApt,
    setEditingApt,
    editAptNumber,
    setEditAptNumber,
    editFloorNumber,
    setEditFloorNumber,
    editResidentName,
    setEditResidentName,
    editResidentPhone,
    setEditResidentPhone,
    editAreaSqm,
    setEditAreaSqm,
    editOrientation,
    setEditOrientation,
    editAddArrears,
    setEditAddArrears,
    editArrearsTitle,
    setEditArrearsTitle,
    openEditModal,
  };
}
