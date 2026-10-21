import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  Apartment,
  ApartmentObligation,
  AppNotification,
  AppSubscriptionInvoice,
  Building,
  BuildingIssue,
  BuildingSubscriptionStatus,
  CashRecipientType,
  ClaimDistributionType,
  EmergencyClaim,
  Expense,
  FeaturesConfig,
  IssueSeverity,
  IssueStatus,
  IssueUpvote,
  Payment,
  PaymentCategoryType,
  PaymentMethodType,
  PlanTier,
  Poll,
  PollOption,
  PollVote,
  SubscriptionPlan,
  UserProfile,
  UserRole,
} from '@/shared/types/database';

export interface ReviewedResidentEntry {
  status: 'active' | 'rejected';
  phone?: string;
  apartmentNumber?: string;
  fullName?: string;
  buildingId?: string;
  reviewedAt: string;
}

export interface PushNotificationParams {
  recipientId: string;
  recipientRole: UserRole;
  recipientPushToken?: string | null;
  buildingId?: string | null;
  title: string;
  body: string;
  category: AppNotification['category'];
  badgeLabel: string;
  isUrgent?: boolean;
  metadata?: AppNotification['metadata'];
}

/** Values owned by AppProvider that module action hooks receive (see Pick<StoreCore, ...>). */
export interface StoreCore {
  currentRole: UserRole;
  setCurrentRole: Dispatch<SetStateAction<UserRole>>;
  isAuthenticated: boolean;
  setAuthenticated: Dispatch<SetStateAction<boolean>>;
  usersByRole: Record<UserRole, UserProfile>;
  setUsersByRole: Dispatch<SetStateAction<Record<UserRole, UserProfile>>>;
  plans: SubscriptionPlan[];
  setPlans: Dispatch<SetStateAction<SubscriptionPlan[]>>;
  buildings: Building[];
  setBuildings: Dispatch<SetStateAction<Building[]>>;
  apartments: Apartment[];
  setApartments: Dispatch<SetStateAction<Apartment[]>>;
  apartmentObligations: ApartmentObligation[];
  setApartmentObligations: Dispatch<SetStateAction<ApartmentObligation[]>>;
  pendingResidents: UserProfile[];
  setPendingResidents: Dispatch<SetStateAction<UserProfile[]>>;
  payments: Payment[];
  setPayments: Dispatch<SetStateAction<Payment[]>>;
  emergencyClaims: EmergencyClaim[];
  setEmergencyClaims: Dispatch<SetStateAction<EmergencyClaim[]>>;
  expenses: Expense[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  subscriptionInvoices: AppSubscriptionInvoice[];
  setSubscriptionInvoices: Dispatch<SetStateAction<AppSubscriptionInvoice[]>>;
  buildingIssues: BuildingIssue[];
  setBuildingIssues: Dispatch<SetStateAction<BuildingIssue[]>>;
  polls: Poll[];
  setPolls: Dispatch<SetStateAction<Poll[]>>;
  pollVotes: PollVote[];
  setPollVotes: Dispatch<SetStateAction<PollVote[]>>;
  issueUpvotes: IssueUpvote[];
  setIssueUpvotes: Dispatch<SetStateAction<IssueUpvote[]>>;
  expoPushToken: string;
  setExpoPushToken: Dispatch<SetStateAction<string>>;
  notifications: AppNotification[];
  setNotifications: Dispatch<SetStateAction<AppNotification[]>>;
  activeBannerNotification: AppNotification | null;
  setActiveBannerNotification: Dispatch<SetStateAction<AppNotification | null>>;
  processingIds: Record<string, boolean>;
  setProcessingIds: Dispatch<SetStateAction<Record<string, boolean>>>;
  reviewedResidentKeys: Record<string, ReviewedResidentEntry>;
  setReviewedResidentKeys: Dispatch<SetStateAction<Record<string, ReviewedResidentEntry>>>;
  reviewedResidentKeysRef: RefObject<Record<string, ReviewedResidentEntry>>;
  localPendingResidentRef: RefObject<UserProfile | null>;
  lastApprovedResidentRef: RefObject<UserProfile | null>;
  currentUser: UserProfile;
  loadDataFromSupabase: () => Promise<void>;
  pushAndRecordNotification: (params: PushNotificationParams) => Promise<void>;
  currentBuilding: Building;
  currentRoleNotifications: AppNotification[];
  unreadNotificationsCount: number;
  isCurrentBuildingWritable: boolean;
  logout: () => Promise<void>;
}

export interface AppContextType {
  currentRole: UserRole;
  currentUser: UserProfile;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => void;
  setAuthenticated: (auth: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    metadata?: { fullName?: string; phone?: string; role?: 'admin' | 'resident' }
  ) => Promise<void>;
  logout: () => Promise<void>;

  // Data Entities
  plans: SubscriptionPlan[];
  buildings: Building[];
  currentBuilding: Building;
  apartments: Apartment[];
  apartmentObligations: ApartmentObligation[];
  pendingResidents: UserProfile[];
  payments: Payment[];
  emergencyClaims: EmergencyClaim[];
  expenses: Expense[];
  subscriptionInvoices: AppSubscriptionInvoice[];

  // Push Notifications & In-App Notification Center State
  expoPushToken: string;
  notifications: AppNotification[];
  currentRoleNotifications: AppNotification[];
  unreadNotificationsCount: number;
  activeBannerNotification: AppNotification | null;
  dismissBannerNotification: () => void;
  markAllNotificationsAsRead: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => void;
  sendBulkUnpaidReminder: (customMessage?: string) => Promise<{
    remindedCount: number;
    apartments: string[];
  }>;
  sendIndividualUnpaidReminder: (
    apartmentNumber: string,
    customMessage?: string
  ) => Promise<void>;

  // Security & Idempotency Locks
  processingIds: Record<string, boolean>;
  isCurrentBuildingWritable: boolean;
  refreshData: () => Promise<void>;

  // Actions (Backed by secureRpc when Supabase is configured)
  createBuildingForAdmin: (input: {
    fullName: string;
    phone: string;
    email?: string;
    password?: string;
    buildingName: string;
    address: string;
    totalApartments: number;
    defaultMonthlyDues: number;
    adminApartmentNumber: string;
  }) => Promise<{ buildingCode: string }>;

  requestJoinBuilding: (input: {
    fullName: string;
    phone: string;
    email?: string;
    password?: string;
    buildingCode: string;
    apartmentNumber: string;
    floorNumber?: string;
  }) => Promise<void>;

  reviewResidentJoinRequest: (
    residentId: string,
    approve: boolean,
    overrideApartmentNumber?: string
  ) => Promise<void>;

  transferApartmentObligations: (input: {
    sourceApartmentId: string;
    targetApartmentId: string;
    obligationIds?: string[];
    transferOccupantInfo?: boolean;
  }) => Promise<{
    transferredCount: number;
    transferredAmount: number;
    sourceApartmentNumber: string;
    targetApartmentNumber: string;
  }>;

  addApartmentObligation: (input: {
    apartmentId: string;
    apartmentNumber?: string;
    title: string;
    amount: number;
    billingMonth: string;
    category?: PaymentCategoryType;
    notes?: string;
  }) => Promise<void>;

  settleApartmentObligation: (
    obligationId: string,
    notes?: string
  ) => Promise<void>;

  deleteApartmentObligation: (obligationId: string) => Promise<void>;
  updateApartmentObligation: (
    obligationId: string,
    updates: {
      title?: string;
      amount?: number;
      billingMonth?: string;
      category?: PaymentCategoryType;
      notes?: string;
    }
  ) => Promise<void>;

  submitResidentPayment: (input: {
    amount: number;
    paymentMethod: PaymentMethodType;
    billingMonth: string;
    cashRecipient?: CashRecipientType;
    receiptImageUrl?: string;
    paymentCategory?: PaymentCategoryType;
    emergencyClaimId?: string;
    referenceNumber?: string;
    notes?: string;
    obligationId?: string;
    obligationTitle?: string;
    isArrears?: boolean;
  }) => Promise<void>;

  approveResidentPayment: (paymentId: string) => Promise<void>;
  rejectResidentPayment: (paymentId: string, reason?: string) => Promise<void>;
  recordDirectCashPayment: (input: {
    apartmentId: string;
    apartmentNumber: string;
    residentId?: string | null;
    residentName?: string | null;
    amount: number;
    category: PaymentCategoryType;
    emergencyClaimId?: string | null;
    billingMonth: string;
    notes?: string;
  }) => Promise<void>;

  createEmergencyClaim: (input: {
    title: string;
    description: string;
    category: string;
    targetAmount: number;
    distributionType: ClaimDistributionType;
    dueDate?: string;
    defaultShareAmount?: number;
    distributionMode?: 'occupied_only' | 'all_units' | 'equal' | 'custom';
    customShares?: Array<{ apartment_id: string; amount: number }>;
  }) => Promise<void>;

  closeEmergencyClaimWithInvoice: (input: {
    claimId: string;
    invoiceImageUrl: string;
    actualAmount?: number;
    invoiceNumber?: string;
    notes?: string;
  }) => Promise<void>;

  recordBuildingExpense: (input: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    invoiceImageUrl?: string;
    invoiceNumber?: string;
  }) => Promise<void>;

  addApartmentUnit: (input: {
    apartmentNumber: string;
    floorNumber: string;
    wingOrDirection: string;
    areaSqm: number;
    residentName?: string;
    residentPhone?: string;
    arrearsAmount?: number;
    stagedObligations?: Array<{
      id?: string;
      type: 'monthly_dues' | 'other';
      title: string;
      amount: number;
      year: number;
      month: number;
      notes?: string;
    }>;
  }) => Promise<{ id: string; apartmentNumber: string }>;

  updateApartmentUnit: (
    apartmentId: string,
    updates: {
      apartmentNumber?: string;
      floorNumber?: string;
      wingOrDirection?: string;
      areaSqm?: number;
      residentName?: string;
      residentPhone?: string;
    }
  ) => Promise<void>;

  deleteApartmentUnit: (apartmentId: string) => Promise<void>;

  submitAppSubscriptionInvoice: (input: {
    planCode: PlanTier;
    durationMonths: number;
    receiptImageUrl: string;
    notes?: string;
  }) => Promise<void>;

  activateBuildingSubscription: (invoiceId: string) => Promise<void>;

  superAdminConfigureBuilding: (input: {
    buildingId: string;
    planCode?: PlanTier;
    customMonthlyPrice?: number | null;
    maxApartmentsOverride?: number | null;
    featuresConfig?: Partial<FeaturesConfig>;
    subscriptionStatus?: BuildingSubscriptionStatus;
  }) => Promise<void>;

  superAdminUpdatePlanTemplate: (
    code: PlanTier,
    updates: Partial<SubscriptionPlan>
  ) => void;

  // Community Hub (Issues, Complaints, Polls & Voting)
  buildingIssues: BuildingIssue[];
  polls: Poll[];
  pollVotes: PollVote[];
  issueUpvotes: IssueUpvote[];
  createBuildingIssue: (input: {
    title: string;
    description?: string;
    category: string;
    severity?: IssueSeverity;
    imageUrl?: string | null;
    isPrivate?: boolean;
    preferredTime?: string;
    whatsappNotifications?: boolean;
  }) => Promise<void>;
  toggleIssueUpvote: (issueId: string) => Promise<void>;
  updateIssueStatus: (issueId: string, status: IssueStatus) => Promise<void>;
  createBuildingPoll: (input: {
    title: string;
    description?: string;
    category?: string;
    estimatedCost?: number;
    sharePerUnit?: number;
    quorumPercent?: number;
    durationDays?: number;
    options?: PollOption[];
    documentUrl?: string;
    isUrgent?: boolean;
  }) => Promise<void>;
  castPollVote: (pollId: string, choice: string) => Promise<void>;
  resetBuildingData: (mode: 'residents_only' | 'full_delete') => Promise<void>;
}
