import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Apartment } from '@/shared/types/database';
import { styles } from './ApartmentsUnitsScreen.styles';
import { useEditUnitForm } from '../application/useEditUnitForm';
import { useArrearsForm } from '../application/useArrearsForm';
import { useEditObligationForm } from '../application/useEditObligationForm';
import { YearPickerModal } from './components/YearPickerModal';
import { EditObligationModal } from './components/EditObligationModal';
import { InviteShareModal } from './components/InviteShareModal';
import { ApartmentDetailsModal } from './components/ApartmentDetailsModal';
import { AddArrearsModal } from './components/AddArrearsModal';
import { EditUnitModal } from './components/EditUnitModal';
import { AddUnitModal } from './components/AddUnitModal';
import { UnitsList } from './components/UnitsList';
import { UnitFilterChips } from './components/UnitFilterChips';
import { UnitsSearchBar } from './components/UnitsSearchBar';
import { CollectionSummaryCard } from './components/CollectionSummaryCard';
import { NewUnitSuccessBanner } from './components/NewUnitSuccessBanner';

/**
 * Units Directory & Management (Screens 14 to 18)
 * Faithfully implementing screens from Developer Handover Specs v2.4:
 * - Screen 14: UNITS_DIRECTORY (design/_28 & _21)
 * - Screen 15: ADD_UNIT_FORM (design/_4 & _29)
 * - Screen 16: UNITS_AFTER_ADD (design/_21)
 * - Screen 17: SHARE_INVITE_MODAL (design/302)
 * - Screen 18: EDIT_UNIT_FORM & OBLIGATION TRANSFER (design/_18)
 *
 * Preserves 100% of the underlying state management, Supabase sync, and WhatsApp deep links.
 */
export const ApartmentsUnitsScreen: React.FC = () => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'paid' | 'pending'>('all');

  // Add Unit Modal State (Screen 15: _4)
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [obligationYear, setObligationYear] = useState<number>(new Date().getFullYear());

  // Year Picker State
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [yearPickerTarget, setYearPickerTarget] = useState<'add_unit' | 'arrears_modal' | 'edit_obl'>('add_unit');
  const [arrearsModalYear, setArrearsModalYear] = useState<number>(new Date().getFullYear());

  const editOblForm = useEditObligationForm();

  // Unit Details Modal State (MODAL 5: تفاصيل الشقة وسجل المديونيات)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailApt, setSelectedDetailApt] = useState<Apartment | null>(null);

  const editUnitForm = useEditUnitForm();

  const arrearsForm = useArrearsForm();

  // WhatsApp Invite Modal State (Screen 17: 302)
  const [inviteModalApt, setInviteModalApt] = useState<Apartment | null>(null);

  // Success Banner after adding unit
  const [lastAddedAptNumber, setLastAddedAptNumber] = useState<string | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Newly Added Unit Success Banner (Screen 16: _21) */}
      <NewUnitSuccessBanner
        lastAddedAptNumber={lastAddedAptNumber}
        setLastAddedAptNumber={setLastAddedAptNumber}
      />

      {/* Financial Summary Hero Card (design/_28) */}
      <CollectionSummaryCard />

      {/* Search Bar & Add Unit Action */}
      <UnitsSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setAddModalVisible={setAddModalVisible}
      />

      {/* Filter Chips */}
      <UnitFilterChips activeFilter={activeFilter} setActiveFilter={setActiveFilter} />

      {/* Units List Cards */}
      <UnitsList
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        setDetailModalVisible={setDetailModalVisible}
        setSelectedDetailApt={setSelectedDetailApt}
        editUnitForm={editUnitForm}
        arrearsForm={arrearsForm}
        setInviteModalApt={setInviteModalApt}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW UNIT FORM (Screen 15: _4)                             */}
      {/* ---------------------------------------------------------------------- */}
      <AddUnitModal
        setSearchQuery={setSearchQuery}
        setActiveFilter={setActiveFilter}
        addModalVisible={addModalVisible}
        setAddModalVisible={setAddModalVisible}
        obligationYear={obligationYear}
        setObligationYear={setObligationYear}
        setYearPickerVisible={setYearPickerVisible}
        setYearPickerTarget={setYearPickerTarget}
        setLastAddedAptNumber={setLastAddedAptNumber}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: EDIT UNIT DETAILS (Screen 18: _18)                           */}
      {/* ---------------------------------------------------------------------- */}
      <EditUnitModal editUnitForm={editUnitForm} />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: DEDICATED ADD ARREARS MODAL (إضافة مديونية على الشقة)         */}
      {/* ---------------------------------------------------------------------- */}
      <AddArrearsModal
        setYearPickerVisible={setYearPickerVisible}
        setYearPickerTarget={setYearPickerTarget}
        arrearsModalYear={arrearsModalYear}
        arrearsForm={arrearsForm}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 5: APARTMENT DETAILS & OBLIGATIONS BREAKDOWN (تفاصيل الشقة)       */}
      {/* ---------------------------------------------------------------------- */}
      <ApartmentDetailsModal
        editOblForm={editOblForm}
        detailModalVisible={detailModalVisible}
        setDetailModalVisible={setDetailModalVisible}
        selectedDetailApt={selectedDetailApt}
        editUnitForm={editUnitForm}
        arrearsForm={arrearsForm}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: SHARE WHATSAPP INVITE LINK (Screen 17: 302)                  */}
      {/* ---------------------------------------------------------------------- */}
      <InviteShareModal inviteModalApt={inviteModalApt} setInviteModalApt={setInviteModalApt} />

      {/* MODAL 6: EDIT REGISTERED OBLIGATION */}
      <EditObligationModal
        setYearPickerVisible={setYearPickerVisible}
        setYearPickerTarget={setYearPickerTarget}
        editOblForm={editOblForm}
      />

      {/* YEAR PICKER MODAL */}
      <YearPickerModal
        obligationYear={obligationYear}
        setObligationYear={setObligationYear}
        setYearPickerVisible={setYearPickerVisible}
        yearPickerVisible={yearPickerVisible}
        yearPickerTarget={yearPickerTarget}
        arrearsModalYear={arrearsModalYear}
        setArrearsModalYear={setArrearsModalYear}
        editOblForm={editOblForm}
      />
    </ScrollView>
  );
};

