import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useAppStore } from '@/store/AppContext';
import { EmergencyClaim, Payment } from '@/shared/types/database';
import { styles } from './AdminDashboardScreen.styles';
import { QuickActionsSheet } from './components/QuickActionsSheet';
import { ClaimContributorsSheet } from '../../emergency/presentation/components/ClaimContributorsSheet';
import { RejectPaymentSheet } from '../../payments/presentation/components/RejectPaymentSheet';
import { ReceiptInspectionSheet } from '../../payments/presentation/components/ReceiptInspectionSheet';
import { CloseClaimSheet } from '../../emergency/presentation/components/CloseClaimSheet';
import { AdminSubscriptionRenewalSheet } from '../../platform/presentation/components/AdminSubscriptionRenewalSheet';
import { CreateEmergencyClaimSheet } from '../../emergency/presentation/components/CreateEmergencyClaimSheet';
import { AddExpenseSheet } from '../../expenses/presentation/components/AddExpenseSheet';
import { QuickActionFab } from './components/QuickActionFab';
import { DevResetToolsCard } from './components/DevResetToolsCard';
import { BuildingPulseSection } from './components/BuildingPulseSection';
import { ActiveEmergencyClaimsSection } from '../../emergency/presentation/components/ActiveEmergencyClaimsSection';
import { JoinRequestsSection } from '../../units/presentation/components/JoinRequestsSection';
import { UnpaidApartmentsSection } from '../../payments/presentation/components/UnpaidApartmentsSection';
import { PendingPaymentsSection } from '../../payments/presentation/components/PendingPaymentsSection';
import { QuickNavHub } from './components/QuickNavHub';
import { CompactAddBar } from './components/CompactAddBar';
import { FinancialSummaryCard } from './components/FinancialSummaryCard';
import { WelcomeHeader } from './components/WelcomeHeader';
import { ReadOnlyBanner } from './components/ReadOnlyBanner';

interface AdminDashboardScreenProps {
  onNavigateExpenses: () => void;
  onNavigateSettings?: () => void;
  onNavigateUnits?: () => void;
  onNavigateCommunity?: () => void;
}

/**
 * Strictly follows:
 * - design/stitch_/admin_dashboard/code.html (Admin Dashboard layout, Hero card, Quick actions, Pending reviews, Unpaid units, Building pulse)
 * - design/stitch_/_10/code.html (Emergency Claim creation modal with equal/custom distribution & smart share preview)
 * - design/stitch_/_3/code.html (Add new expense modal)
 * Includes Mechanism 2 (Smart Comparison Card + Change Apartment Before Approval)
 * and Central Storage Optimization (`compressAndUploadImage` / `pickAndCompressUploadImage`).
 */
export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  onNavigateExpenses,
  onNavigateSettings,
  onNavigateUnits,
  onNavigateCommunity,
}) => {
  const {
    approveResidentPayment,
    sendBulkUnpaidReminder,
  } = useAppStore();

  // Modals State
  const [quickActionsModalVisible, setQuickActionsModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);
  const [rejectModalPaymentId, setRejectModalPaymentId] = useState<string | null>(null);

  // Emergency Claim Details Modal (من دفع ومن لم يدفع)
  const [selectedClaimForDetails, setSelectedClaimForDetails] =
    useState<EmergencyClaim | null>(null);

  // Close Emergency Claim with Compressed Invoice Modal
  const [closingClaimId, setClosingClaimId] = useState<string | null>(null);
  const [closeClaimActualAmount, setCloseClaimActualAmount] = useState('');

  // Handlers
  const handleApprovePayment = async (paymentId: string) => {
    try {
      await approveResidentPayment(paymentId);
      Alert.alert(
        'تم الاعتماد بنجاح 🟢',
        'تم اعتماد السداد وإضافة المبلغ تلقائياً إلى رصيد الصندوق الحالي.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'حدث خطأ أثناء الاعتماد');
    }
  };

  const handleRejectPayment = (paymentId: string) => {
    setRejectModalPaymentId(paymentId);
  };

  const handleBulkReminder = async () => {
    try {
      const result = await sendBulkUnpaidReminder();
      if (result.remindedCount === 0) {
        Alert.alert(
          'جميع الشقق مسددة ✅',
          'لا توجد أي شقق متأخرة عن سداد اشتراك الشهر الحالي.'
        );
        return;
      }
      Alert.alert(
        'تم إرسال تذكير جماعي فوري 🔔',
        `تم إرسال إشعار Push فوري إلى (${result.remindedCount}) شقق لم تسدد اشتراك الشهر الحالي (شقق رقم: ${result.apartments.join('، ')}).`
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إرسال التذكير الجماعي');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Read-Only Subscription Warning Banner (if expired) */}
      <ReadOnlyBanner
        onNavigateSettings={onNavigateSettings}
        setSubscriptionModalVisible={setSubscriptionModalVisible}
      />

      {/* 1. Header Welcome & Active Cycle (admin_dashboard/code.html lines 11-24) */}
      <WelcomeHeader
        onNavigateSettings={onNavigateSettings}
        setSubscriptionModalVisible={setSubscriptionModalVisible}
      />

      {/* 2. Financial Summary Hero Card (admin_dashboard/code.html lines 26-77) */}
      <FinancialSummaryCard />

      {/* 3. Compact Add Action Bar (Replaces bulky 4-button grid to save space) */}
      <CompactAddBar setQuickActionsModalVisible={setQuickActionsModalVisible} />

      {/* Quick Navigation Hub (أقسام الإدارة والخدمات السريعة) */}
      <QuickNavHub
        onNavigateCommunity={onNavigateCommunity}
        onNavigateExpenses={onNavigateExpenses}
        onNavigateUnits={onNavigateUnits}
      />

      {/* 4. Pending Resident Join Requests + Mechanism 2: Smart Comparison Card & Change Apartment Before Approval */}
      <JoinRequestsSection />

      {/* 4B. Active Emergency Claims & Close with Compressed Invoice */}
      <ActiveEmergencyClaimsSection
        setSelectedClaimForDetails={setSelectedClaimForDetails}
        setClosingClaimId={setClosingClaimId}
        setCloseClaimActualAmount={setCloseClaimActualAmount}
      />

      {/* 5. Pending Reviews Widget (طلبات السداد المعلقة - admin_dashboard/code.html lines 116-199) */}
      <PendingPaymentsSection
        onNavigateExpenses={onNavigateExpenses}
        setPreviewReceiptUrl={setPreviewReceiptUrl}
        setPreviewPayment={setPreviewPayment}
        handleApprovePayment={handleApprovePayment}
        handleRejectPayment={handleRejectPayment}
      />

      {/* 6. Unpaid Apartments Section (الشقق المتأخرة - admin_dashboard/code.html lines 201-294) */}
      <UnpaidApartmentsSection
        handleApprovePayment={handleApprovePayment}
        handleBulkReminder={handleBulkReminder}
      />

      {/* 7. Building Pulse & Community Overview (نبض العمارة والنشاط العام) */}
      <BuildingPulseSection onNavigateCommunity={onNavigateCommunity} />

      {/* 8. Developer & Testing Reset Tools Card (أدوات التجربة السريعة والتصفير) */}
      <DevResetToolsCard />

      {/* ==================================================================== */}
      {/* Modal 1: Add New Expense (Matches design/stitch_/_3/code.html)       */}
      {/* Uses compressAndUploadImage (Max 1080px, 0.6 JPEG, 80-150 KB)        */}
      {/* ==================================================================== */}
      <AddExpenseSheet
        expenseModalVisible={expenseModalVisible}
        setExpenseModalVisible={setExpenseModalVisible}
      />

      {/* ==================================================================== */}
      {/* Modal 2: Create Emergency Claim (Matches design/stitch_/_10/code.html) */}
      {/* ==================================================================== */}
      <CreateEmergencyClaimSheet
        emergencyModalVisible={emergencyModalVisible}
        setEmergencyModalVisible={setEmergencyModalVisible}
      />

      {/* ==================================================================== */}
      {/* Modal 3: App Subscription Renewal (رفع إيصال اشتراك التطبيق للـ Super Admin) */}
      {/* Uses compressAndUploadImage -> subscription-receipts                 */}
      {/* ==================================================================== */}
      <AdminSubscriptionRenewalSheet
        setSubscriptionModalVisible={setSubscriptionModalVisible}
        subscriptionModalVisible={subscriptionModalVisible}
      />

      {/* ==================================================================== */}
      {/* Modal 6: Close Emergency Claim with Compressed Official Invoice      */}
      {/* ==================================================================== */}
      <CloseClaimSheet
        closingClaimId={closingClaimId}
        setClosingClaimId={setClosingClaimId}
        closeClaimActualAmount={closeClaimActualAmount}
        setCloseClaimActualAmount={setCloseClaimActualAmount}
      />

      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* Modal 4: Full Receipt Inspection & Approval (Matches design/_7/code.html) */}
      {/* ==================================================================== */}
      <ReceiptInspectionSheet
        previewReceiptUrl={previewReceiptUrl}
        setPreviewReceiptUrl={setPreviewReceiptUrl}
        previewPayment={previewPayment}
        setPreviewPayment={setPreviewPayment}
        handleApprovePayment={handleApprovePayment}
        handleRejectPayment={handleRejectPayment}
      />

      {/* ==================================================================== */}
      {/* Modal 5: Reject Payment with Reason (Sends Push Notification)        */}
      {/* ==================================================================== */}
      <RejectPaymentSheet
        rejectModalPaymentId={rejectModalPaymentId}
        setRejectModalPaymentId={setRejectModalPaymentId}
      />

      {/* ==================================================================== */}
      {/* Modal 7: Emergency Claim Contributors & Unpaid Units Details          */}
      {/* ==================================================================== */}
      <ClaimContributorsSheet
        selectedClaimForDetails={selectedClaimForDetails}
        setSelectedClaimForDetails={setSelectedClaimForDetails}
      />
      </ScrollView>

      {/* Floating Action Button (FAB) for Instant Quick Action */}
      <QuickActionFab setQuickActionsModalVisible={setQuickActionsModalVisible} />

      {/* ==================================================================== */}
      {/* Modal 0: Quick Actions Sheet (إضافة مصروف • طوارئ جديدة • تذكير الكل) */}
      {/* ==================================================================== */}
      <QuickActionsSheet
        quickActionsModalVisible={quickActionsModalVisible}
        setQuickActionsModalVisible={setQuickActionsModalVisible}
        setExpenseModalVisible={setExpenseModalVisible}
        setEmergencyModalVisible={setEmergencyModalVisible}
        handleBulkReminder={handleBulkReminder}
      />
    </View>
  );
};

