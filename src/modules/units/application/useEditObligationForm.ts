import { useState } from 'react';
import type { ApartmentObligation } from '@/shared/types/database';

export function useEditObligationForm() {
  // Edit Registered Obligation State (MODAL 6)
  const [editOblModalVisible, setEditOblModalVisible] = useState(false);
  const [editingObl, setEditingObl] = useState<ApartmentObligation | null>(null);
  const [editOblTitle, setEditOblTitle] = useState('');
  const [editOblAmount, setEditOblAmount] = useState('');
  const [editOblMonth, setEditOblMonth] = useState<number>(new Date().getMonth() + 1);
  const [editOblYear, setEditOblYear] = useState<number>(new Date().getFullYear());
  const [editOblNotes, setEditOblNotes] = useState('');

  // Open Edit Modal for a registered obligation (Modal 6)
  const openEditObligationModal = (obl: ApartmentObligation) => {
    setEditingObl(obl);
    setEditOblTitle(obl.title);
    setEditOblAmount(String(obl.amount));
    if (obl.billing_month && obl.billing_month.includes('-')) {
      const parts = obl.billing_month.split('-');
      setEditOblYear(parseInt(parts[0], 10) || new Date().getFullYear());
      setEditOblMonth(parseInt(parts[1], 10) || new Date().getMonth() + 1);
    } else {
      setEditOblYear(new Date().getFullYear());
      setEditOblMonth(new Date().getMonth() + 1);
    }
    setEditOblNotes(obl.notes || '');
    setEditOblModalVisible(true);
  };

  return {
    editOblModalVisible,
    setEditOblModalVisible,
    editingObl,
    setEditingObl,
    editOblTitle,
    setEditOblTitle,
    editOblAmount,
    setEditOblAmount,
    editOblMonth,
    setEditOblMonth,
    editOblYear,
    setEditOblYear,
    editOblNotes,
    setEditOblNotes,
    openEditObligationModal,
  };
}
