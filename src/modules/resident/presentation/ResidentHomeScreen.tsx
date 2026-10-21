import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useAppStore } from '@/store/AppContext';
import { styles } from './ResidentHomeScreen.styles';
import type { ActiveSubView } from '../domain/resident.types';
import { useResidentPaymentSheet } from '../application/useResidentPaymentSheet';
import { DocumentsArchiveModal } from './components/DocumentsArchiveModal';
import { AddTicketModal } from './components/AddTicketModal';
import { UnitLedgerModal } from './components/UnitLedgerModal';
import { PaymentSheetModal } from './components/PaymentSheetModal';
import { RecentExpensesSection } from './components/RecentExpensesSection';
import { ActivePollCard } from './components/ActivePollCard';
import { EmergencyContributionCard } from './components/EmergencyContributionCard';
import { QuickServicesGrid } from './components/QuickServicesGrid';
import { ArrearsCard } from './components/ArrearsCard';
import { MonthlyDueCard } from './components/MonthlyDueCard';
import { ResidentHeader } from './components/ResidentHeader';
import { PendingApprovalView } from './components/PendingApprovalView';

interface ResidentHomeScreenProps {
  onNavigateExpenses: () => void;
  onNavigateCommunity?: () => void;
}

/**
 * Resident Experience (Track 2)
 * Faithfully implementing Screens 7 through 12 from Developer Handover Specs v2.4:
 * - Screen 7: RESIDENT_HOME (design/._302)
 * - Screen 8: PAYMENT_STATUS (design/_2)
 * - Screen 9: PAY_UPLOAD_RECEIPT (design/_2)
 * - Screen 10: UNIT_LEDGER (design/_22)
 * - Screen 11: ADD_TICKET_FORM (design/_1)
 * - Screen 12: DOCS_BYLAWS (design/_14)
 *
 * All live Supabase sync, image auto-compression, receipt handling, and calculations are strictly preserved.
 */
export const ResidentHomeScreen: React.FC<ResidentHomeScreenProps> = ({
  onNavigateExpenses,
  onNavigateCommunity,
}) => {
  const { currentUser } = useAppStore();

  const [activeSubView, setActiveSubView] = useState<ActiveSubView>('none');

  const {
    paymentCategory,
    selectedClaim,
    selectedObligation,
    isArrearsPaymentMode,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    openMonthlyPaymentSheet,
    openObligationPaymentSheet,
    openArrearsPaymentSheet,
    openEmergencyContributionSheet,
  } = useResidentPaymentSheet({ setActiveSubView });

  // If resident account is still pending admin approval
  if (currentUser.status === 'pending') {
    return <PendingApprovalView />;
  }

  // --------------------------------------------------------------------------
  // SCREEN 7: RESIDENT HOME SCREEN (design/._302)
  // --------------------------------------------------------------------------
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 1. Resident Welcome & Verification Banner */}
      <ResidentHeader />

      {/* 2. Monthly Due / Subscription Status Card (Hero Banner) */}
      <MonthlyDueCard openMonthlyPaymentSheet={openMonthlyPaymentSheet} />

      {/* 2.1 Resident Arrears & Obligations Detailed Card */}
      <ArrearsCard
        openArrearsPaymentSheet={openArrearsPaymentSheet}
        openObligationPaymentSheet={openObligationPaymentSheet}
      />

      {/* Quick Action Navigation Strip (Unit Ledger, Add Ticket, Bylaws) */}
      <QuickServicesGrid setActiveSubView={setActiveSubView} />

      {/* 3. Emergency Repair / Special Fund Contribution Widget */}
      <EmergencyContributionCard
        openEmergencyContributionSheet={openEmergencyContributionSheet}
      />

      {/* 4. Active General Assembly Poll / Decision Widget */}
      <ActivePollCard onNavigateCommunity={onNavigateCommunity} />

      {/* 5. Transparency & Recent Building Expenses Snapshot */}
      <RecentExpensesSection onNavigateExpenses={onNavigateExpenses} />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: PAYMENT & RECEIPT UPLOAD (Screens 8 & 9 - _2)                 */}
      {/* ---------------------------------------------------------------------- */}
      <PaymentSheetModal
        activeSubView={activeSubView}
        setActiveSubView={setActiveSubView}
        isArrearsPaymentMode={isArrearsPaymentMode}
        paymentAmount={paymentAmount}
        paymentCategory={paymentCategory}
        paymentMethod={paymentMethod}
        selectedClaim={selectedClaim}
        selectedObligation={selectedObligation}
        setPaymentAmount={setPaymentAmount}
        setPaymentMethod={setPaymentMethod}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: UNIT ACCOUNT STATEMENT & LEDGER (Screen 10 - _22)            */}
      {/* ---------------------------------------------------------------------- */}
      <UnitLedgerModal activeSubView={activeSubView} setActiveSubView={setActiveSubView} />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: ADD MAINTENANCE TICKET (Screen 11 - _1)                      */}
      {/* ---------------------------------------------------------------------- */}
      <AddTicketModal activeSubView={activeSubView} setActiveSubView={setActiveSubView} />

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: OFFICIAL DOCUMENTS & BYLAWS ARCHIVE (Screen 12 - _14)         */}
      {/* ---------------------------------------------------------------------- */}
      <DocumentsArchiveModal activeSubView={activeSubView} setActiveSubView={setActiveSubView} />
    </ScrollView>
  );
};

