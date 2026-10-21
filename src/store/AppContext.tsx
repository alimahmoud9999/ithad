import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import {
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
  PaymentStatusType,
  PlanTier,
  Poll,
  PollOption,
  PollVote,
  SubscriptionPlan,
  UserProfile,
  UserRole,
} from '@/shared/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authSignIn,
  authSignOut,
  authSignUp,
  ensureSupabaseSession,
  isSupabaseConfigured,
  secureRpc,
  supabase,
} from '@/shared/lib/supabase';
import {
  dispatchPushNotification,
  registerAndSavePushTokenAsync,
  subscribeToNativeNotifications,
} from '@/modules/notifications/infrastructure/notificationService';

export interface ReviewedResidentEntry {
  status: 'active' | 'rejected';
  phone?: string;
  apartmentNumber?: string;
  fullName?: string;
  buildingId?: string;
  reviewedAt: string;
}

// ============================================================================
// Initial Seed State Matching "برج الأمل السكني" from design/stitch_/
// ============================================================================

const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    code: 'free',
    name_ar: 'الباقة الأساسية (Free)',
    description_ar:
      'مناسبة للعقارات الصغيرة لتتبع الاشتراكات النقدية والمصروفات الأساسية.',
    default_monthly_price: 0,
    max_apartments: 10,
    default_features_config: {
      receipt_upload: false,
      emergency_claims: false,
      export_reports: false,
      voting: false,
      maintenance_tickets: true,
      documents_archive: false,
    },
    is_active: true,
  },
  {
    code: 'pro',
    name_ar: 'الباقة الاحترافية (Pro)',
    description_ar:
      'الباقة القياسية لاتحادات الملاك (مجانية لأول 60 يوماً عند تأسيس العمارة).',
    default_monthly_price: 150,
    max_apartments: 30,
    default_features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    is_active: true,
  },
  {
    code: 'plus',
    name_ar: 'باقة الأبراج والمجمعات (Plus)',
    description_ar:
      'سعة شقق كبيرة للأبراج السكنية مع تفعيل كافة المميزات المتقدمة.',
    default_monthly_price: 300,
    max_apartments: 120,
    default_features_config: {
      receipt_upload: true,
      emergency_claims: true,
      export_reports: true,
      voting: true,
      maintenance_tickets: true,
      documents_archive: true,
    },
    is_active: true,
  },
];

const DEFAULT_EMPTY_BUILDING: Building = {
  id: '',
  name: 'لم يتم تسجيل أو اختيار عقار بعد',
  address: '',
  city: '',
  registration_number: '',
  building_code: '',
  admin_id: '',
  fund_balance: 0,
  default_monthly_dues: 0,
  total_apartments: 0,
  plan_code: 'pro',
  subscription_status: 'trial',
  trial_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  subscription_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  custom_monthly_price: 0,
  max_apartments_override: null,
  features_config: {
    receipt_upload: true,
    emergency_claims: true,
    export_reports: true,
    voting: true,
    maintenance_tickets: true,
    documents_archive: true,
  },
  created_at: new Date().toISOString(),
};

const INITIAL_BUILDINGS: Building[] = [];

const INITIAL_USERS: Record<UserRole, UserProfile> = {
  admin: {
    id: 'usr-admin-001',
    full_name: 'رئيس الاتحاد',
    email: 'admin@ittihad.app',
    phone: '',
    role: 'admin',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: '',
    floor_number: '',
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  resident: {
    id: 'usr-res-001',
    full_name: 'الساكن / المالك',
    email: 'resident@ittihad.app',
    phone: '',
    role: 'resident',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: '302',
    floor_number: 'الدور الثالث',
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  super_admin: {
    id: 'usr-super-000',
    full_name: 'مالك التطبيق (Super)',
    email: 'owner@ittihadtrust.com',
    phone: '01000000001',
    role: 'super_admin',
    status: 'active',
    building_id: null,
    apartment_id: null,
    apartment_number: null,
    residency_type: 'owner_resident',
    ownership_share_percent: 0,
    push_token: '',
    push_token_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
};

const INITIAL_PENDING_RESIDENTS: UserProfile[] = [];

const INITIAL_APARTMENTS: Apartment[] = [];
const INITIAL_APARTMENT_OBLIGATIONS: ApartmentObligation[] = [];
const INITIAL_PAYMENTS: Payment[] = [];
const INITIAL_EMERGENCY_CLAIMS: EmergencyClaim[] = [];
const INITIAL_EXPENSES: Expense[] = [];
const INITIAL_SUBSCRIPTION_INVOICES: AppSubscriptionInvoice[] = [];
const INITIAL_NOTIFICATIONS: AppNotification[] = [];

const isUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

// ============================================================================
// Context Interface
// ============================================================================

interface AppContextType {
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [isAuthenticated, setAuthenticated] = useState<boolean>(false);
  const [usersByRole, setUsersByRole] =
    useState<Record<UserRole, UserProfile>>(INITIAL_USERS);

  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_PLANS);
  const [buildings, setBuildings] = useState<Building[]>(INITIAL_BUILDINGS);
  const [apartments, setApartments] = useState<Apartment[]>(INITIAL_APARTMENTS);
  const [apartmentObligations, setApartmentObligations] = useState<
    ApartmentObligation[]
  >(INITIAL_APARTMENT_OBLIGATIONS);
  const [pendingResidents, setPendingResidents] = useState<UserProfile[]>(
    INITIAL_PENDING_RESIDENTS
  );
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [emergencyClaims, setEmergencyClaims] = useState<EmergencyClaim[]>(
    INITIAL_EMERGENCY_CLAIMS
  );
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [subscriptionInvoices, setSubscriptionInvoices] = useState<
    AppSubscriptionInvoice[]
  >(INITIAL_SUBSCRIPTION_INVOICES);

  // Community Hub (Issues, Polls, Upvotes)
  const [buildingIssues, setBuildingIssues] = useState<BuildingIssue[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [issueUpvotes, setIssueUpvotes] = useState<IssueUpvote[]>([]);

  // Push Notifications & In-App Notification State
  const [expoPushToken, setExpoPushToken] = useState<string>(
    'ExponentPushToken[ittihad-admin-001]'
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(
    INITIAL_NOTIFICATIONS
  );
  const [activeBannerNotification, setActiveBannerNotification] =
    useState<AppNotification | null>(null);

  // In-flight lock dictionary to prevent double taps on the client in addition to DB FOR UPDATE locks
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {}
  );

  // Set/Map of reviewed residents to shield approved residents against 3-second polling overwrite
  const [reviewedResidentKeys, setReviewedResidentKeys] = useState<
    Record<string, ReviewedResidentEntry>
  >({});
  const reviewedResidentKeysRef = useRef<Record<string, ReviewedResidentEntry>>({});
  const localPendingResidentRef = useRef<UserProfile | null>(null);
  const lastApprovedResidentRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    reviewedResidentKeysRef.current = reviewedResidentKeys;
  }, [reviewedResidentKeys]);

  useEffect(() => {
    AsyncStorage.getItem('@ittihad_reviewed_residents')
      .then((val) => {
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object') {
              setReviewedResidentKeys(parsed);
              reviewedResidentKeysRef.current = parsed;
            }
          } catch {}
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@ittihad_local_pending_resident')
      .then((val) => {
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed && parsed.id) {
              localPendingResidentRef.current = parsed;
            }
          } catch {}
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@ittihad_approved_resident')
      .then((val) => {
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed && parsed.id) {
              lastApprovedResidentRef.current = parsed;
            }
          } catch {}
        }
      })
      .catch(() => {});

    // Step 1: Check existing Supabase session and bind role strictly from DB
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        const sessionUserId = data?.session?.user?.id;
        if (sessionUserId) {
          supabase
            .from('users')
            .select('*')
            .eq('id', sessionUserId)
            .maybeSingle()
            .then(({ data: dbUser }) => {
              if (dbUser) {
                setCurrentRole(dbUser.role);
                setUsersByRole((prev) => ({ ...prev, [dbUser.role]: dbUser }));
                setAuthenticated(true);
              }
            });
        }
      });
    }
  }, []);

  const currentUser = usersByRole[currentRole];

  // Load live data from Supabase tables
  const loadDataFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      // Ensure we are signed into the active building session so RLS never hides claims, expenses, payments, or users
      await ensureSupabaseSession();

      const [
        bRes,
        aRes,
        oRes,
        pRes,
        cRes,
        eRes,
        nRes,
        uRes,
        sRes,
        issuesRes,
        upvotesRes,
        pollsRes,
        votesRes,
      ] = await Promise.all([
        supabase
          .from('buildings')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('apartments')
          .select('*')
          .order('apartment_number', { ascending: true }),
        supabase
          .from('apartment_obligations')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('emergency_claims')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('users').select('*'),
        supabase.from('subscription_plans').select('*'),
        supabase
          .from('building_issues')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('issue_upvotes').select('*'),
        supabase
          .from('polls')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('poll_votes').select('*'),
      ]);

      const bList = (bRes.data as Building[]) || [];
      if (bList.length > 0) {
        setBuildings(bList);
      }

      const rawApts = (aRes.data as Apartment[]) || [];

      if (oRes.data) {
        const rawObligations = (oRes.data as any[]) || [];
        const enrichedObligations: ApartmentObligation[] = rawObligations.map((o) => {
          const parentApt = rawApts.find((a) => a.id === o.apartment_id);
          return {
            ...o,
            apartment_number: o.apartment_number || parentApt?.apartment_number || '',
          };
        });
        setApartmentObligations((prev) => {
          // Identify any obligations currently targeted by in-flight or pending payments
          const pendingTargetOblIds = new Set(
            payments
              .filter((p) => p.status === 'pending' && Boolean(p.notes))
              .map((p) => p.notes?.match(/#([a-zA-Z0-9_-]+)\]/)?.[1])
              .filter(Boolean)
          );

          const serverIds = new Set(enrichedObligations.map((o) => o.id));
          const localInFlight = prev.filter((o) => !serverIds.has(o.id));

          // Retain pending status if an obligation has a pending payment
          const normalizedServer = enrichedObligations.map((o) => {
            const localMatch = prev.find((lo) => lo.id === o.id);
            if ((pendingTargetOblIds.has(o.id) || localMatch?.status === 'pending') && o.status === 'unpaid') {
              return { ...o, status: 'pending' as const };
            }
            return o;
          });

          return [...localInFlight, ...normalizedServer];
        });
      }
      const uList = (uRes.data as UserProfile[]) || [];
      const primaryBuilding = bList[0];

      if (uList.length > 0 || localPendingResidentRef.current || lastApprovedResidentRef.current) {
        const reviewedMap = reviewedResidentKeysRef.current || {};

        // Filter server pending residents, excluding any that were already reviewed by the Admin
        const rawPending = uList.filter((u) => {
          if (u.status !== 'pending') return false;
          if (u.phone?.includes('archived') || u.apartment_number?.includes('archived')) return false;
          if (reviewedMap[u.id]) return false;
          if (u.phone && reviewedMap[u.phone.trim()]) return false;
          if (
            u.apartment_number &&
            (reviewedMap[`${u.building_id || ''}_${String(u.apartment_number).trim()}`] ||
              reviewedMap[String(u.apartment_number).trim()])
          ) {
            return false;
          }
          return true;
        });

        const combinedPending = localPendingResidentRef.current
          ? [localPendingResidentRef.current, ...rawPending]
          : rawPending;

        const seenPending = new Set<string>();
        const uniquePending = combinedPending.filter((u) => {
          if (reviewedMap[u.id]) return false;
          const key = `${(u.phone || '').trim()}_${(u.apartment_number || '').trim()}`;
          if (seenPending.has(key)) return false;
          seenPending.add(key);
          return true;
        });
        setPendingResidents(uniquePending);

        // Resolve Admin profile for the building even if role in DB was overwritten to 'resident'
        const rawAdminUser =
          uList.find((u) => u.role === 'admin' && u.status === 'active') ||
          (primaryBuilding?.admin_id
            ? uList.find((u) => u.id === primaryBuilding.admin_id)
            : undefined) ||
          uList.find((u) => u.status === 'active');

        const adminUser: UserProfile | undefined = rawAdminUser
          ? {
              ...rawAdminUser,
              role: 'admin',
              status: 'active',
              building_id: rawAdminUser.building_id || primaryBuilding?.id || null,
            }
          : undefined;

        if (adminUser) {
          setUsersByRole((prev) => ({ ...prev, admin: adminUser }));
        }

        // Check if the pending resident was approved on the server (e.g. from Web Admin or another client)
        if (localPendingResidentRef.current) {
          const pendingId = localPendingResidentRef.current.id;
          const pendingPhone = localPendingResidentRef.current.phone?.trim();
          const pendingApt = localPendingResidentRef.current.apartment_number
            ? String(localPendingResidentRef.current.apartment_number).trim()
            : null;

          const serverApprovedUser = uList.find(
            (u) =>
              u.status === 'active' &&
              ((pendingId && u.id === pendingId) ||
                (pendingPhone && u.phone && u.phone.trim() === pendingPhone) ||
                (pendingApt &&
                  u.apartment_number &&
                  String(u.apartment_number).trim() === pendingApt))
          );

          if (serverApprovedUser) {
            localPendingResidentRef.current = null;
            lastApprovedResidentRef.current = serverApprovedUser;
            AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});
            AsyncStorage.setItem(
              '@ittihad_approved_resident',
              JSON.stringify(serverApprovedUser)
            ).catch(() => {});
          }
        }

        // Also check if current Supabase Auth user is an active resident
        const { data: sessionData } = await supabase.auth.getSession();
        const activeAuthUid = sessionData?.session?.user?.id;
        if (activeAuthUid) {
          const myUserInDb = uList.find((u) => u.id === activeAuthUid);
          if (myUserInDb && myUserInDb.status === 'active') {
            localPendingResidentRef.current = null;
            lastApprovedResidentRef.current = myUserInDb;
            AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});
          }
        }

        // Resolve Resident profile:
        // 1. If there is an active local pending join request awaiting approval, keep resident in 'pending' state
        // 2. Otherwise if Admin already approved a resident, keep that approved resident in 'active' state
        // 3. Otherwise if there is an unreviewed server pending resident, show it so Admin can approve it
        // 4. Otherwise fall back to active resident in uList
        const targetResidentUser =
          localPendingResidentRef.current ||
          lastApprovedResidentRef.current ||
          (activeAuthUid ? uList.find((u) => u.id === activeAuthUid) : undefined) ||
          uniquePending[0] ||
          uList.find((u) => u.role === 'resident' && u.status === 'active') ||
          uList.find((u) => u.role === 'resident');

        if (targetResidentUser) {
          const aptOfResident = rawApts.find(
            (a) =>
              (targetResidentUser.apartment_id && a.id === targetResidentUser.apartment_id) ||
              (targetResidentUser.apartment_number &&
                String(a.apartment_number).trim() === String(targetResidentUser.apartment_number).trim()) ||
              (a.resident_id && a.resident_id === targetResidentUser.id)
          );
          const resolvedAptNum =
            targetResidentUser.apartment_number || aptOfResident?.apartment_number || '55';

          const isApprovedInMap =
            Boolean(lastApprovedResidentRef.current) ||
            Boolean(reviewedMap[targetResidentUser.id]?.status === 'active') ||
            Boolean(targetResidentUser.phone && reviewedMap[targetResidentUser.phone.trim()]?.status === 'active') ||
            Boolean(resolvedAptNum && reviewedMap[String(resolvedAptNum).trim()]?.status === 'active');

          const effectiveStatus = localPendingResidentRef.current
            ? 'pending'
            : isApprovedInMap
            ? 'active'
            : targetResidentUser.status;

          setUsersByRole((prev) => ({
            ...prev,
            admin: adminUser || prev.admin,
            resident: {
              ...prev.resident,
              ...targetResidentUser,
              role: 'resident',
              status: effectiveStatus,
              building_id:
                targetResidentUser.building_id ||
                primaryBuilding?.id ||
                prev.resident.building_id,
              apartment_number: resolvedAptNum,
              floor_number:
                targetResidentUser.floor_number ||
                aptOfResident?.floor_number ||
                prev.resident.floor_number ||
                'الدور الخامس',
            },
          }));
        }
      }

      const rawServerPayments = (pRes.data as Payment[]) || [];
      const serverPayments = rawServerPayments.map((p) => {
        const apt = rawApts.find(
          (a) =>
            (p.apartment_id && a.id === p.apartment_id) ||
            (p.apartment_number &&
              String(a.apartment_number).trim() ===
                String(p.apartment_number).trim())
        );
        const user = uList.find(
          (u) =>
            (p.resident_id && u.id === p.resident_id) ||
            (apt && (u.id === apt.resident_id || (u.apartment_id && u.apartment_id === apt.id)))
        );
        const effectiveAptNum =
          p.apartment_number || apt?.apartment_number || user?.apartment_number || '-';
        const effectiveResName =
          p.resident_name || user?.full_name || apt?.resident_name || apt?.occupant_name || 'الساكن / المالك';

        return {
          ...p,
          apartment_number: effectiveAptNum,
          resident_name: effectiveResName,
        };
      });

      if (serverPayments.length > 0) {
        setPayments((prev) => {
          const serverIds = new Set(serverPayments.map((p) => p.id));
          const localApprovedIds = new Set(
            prev.filter((p) => p.status === 'paid').map((p) => p.id)
          );

          const localInFlight = prev.filter((p) => {
            if (serverIds.has(p.id)) return false;
            if (!p.id.startsWith('pay-')) return false;

            // Discard local in-flight item ONLY if the server already contains an identical payment
            const isSettledOnServer = serverPayments.some((sp) => {
              if (sp.id === p.id) return true;
              const sameApt =
                (sp.apartment_number && p.apartment_number && String(sp.apartment_number).trim() === String(p.apartment_number).trim()) ||
                (sp.resident_id && p.resident_id && sp.resident_id === p.resident_id);
              if (!sameApt) return false;
              if (sp.payment_category !== p.payment_category) return false;
              if (p.payment_category === 'emergency_claim') {
                return sp.emergency_claim_id === p.emergency_claim_id;
              }
              // If paying a specific obligation, match ONLY if server payment references the exact same obligation
              if (p.notes?.includes('[سداد بند:')) {
                const pObl = p.notes.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
                return Boolean(pObl && sp.notes?.includes(pObl));
              }
              // If arrears payment, match only if server payment is also arrears with exact amount
              if (p.notes?.includes('مديونية')) {
                return Boolean(sp.notes?.includes('مديونية')) && sp.amount === p.amount;
              }
              // Regular monthly dues
              return (
                sp.billing_month === p.billing_month &&
                !sp.notes?.includes('[سداد بند:') &&
                !sp.notes?.includes('مديونية')
              );
            });

            return !isSettledOnServer;
          });

          // Prevent server payments from reverting locally approved payments back to pending
          const normalizedServerPayments = serverPayments.map((sp) => {
            if (localApprovedIds.has(sp.id) && sp.status === 'pending') {
              return { ...sp, status: 'paid' as const };
            }
            return sp;
          });

          return [...localInFlight, ...normalizedServerPayments];
        });
      }

      if (cRes.data) {
        setEmergencyClaims((prev) => {
          const serverClaims = (cRes.data as EmergencyClaim[]) || [];
          if (serverClaims.length === 0) {
            return prev;
          }
          const serverIds = new Set(serverClaims.map((c) => c.id));
          const localInFlight = prev.filter((c) => !serverIds.has(c.id));
          return [...localInFlight, ...serverClaims];
        });
      }

      if (eRes.data) {
        setExpenses(eRes.data as Expense[]);
      }

      if (nRes.data) {
        setNotifications((prev) => {
          const rawServerNotifs = (nRes.data as AppNotification[]) || [];
          if (rawServerNotifs.length === 0) return prev;
          const serverNotifs = rawServerNotifs.map((n) => {
            let role = n.recipient_role;
            if (!role) {
              if (n.recipient_id === usersByRole.admin.id) role = 'admin';
              else if (n.recipient_id === usersByRole.resident.id) role = 'resident';
              else if (n.category === 'join_request') role = 'admin';
              else role = 'resident';
            }
            return {
              ...n,
              recipient_role: role,
            };
          });
          const serverIds = new Set(serverNotifs.map((n) => n.id));
          const localInFlight = prev.filter(
            (n) => !serverIds.has(n.id) && n.id.startsWith('notif-')
          );
          return [...localInFlight, ...serverNotifs];
        });
      }

      // Merge and calculate apartment payment status atomically to prevent flickering
      if (rawApts.length > 0) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const allPayments = serverPayments.length > 0 ? serverPayments : payments;

        const allObligations = oRes.data ? (oRes.data as ApartmentObligation[]) : apartmentObligations;

        const merged = rawApts.map((apt) => {
          const matchedUser = uList.find(
            (u) =>
              (apt.resident_id && u.id === apt.resident_id) ||
              (u.building_id === apt.building_id &&
                String(u.apartment_number).trim() ===
                  String(apt.apartment_number).trim())
          );

          // Find monthly payment for current month
          const monthlyPayment = allPayments.find(
            (p) =>
              p.building_id === apt.building_id &&
              String(p.apartment_number).trim() ===
                String(apt.apartment_number).trim() &&
              p.payment_category === 'monthly_dues' &&
              p.billing_month === currentMonth
          );

          // Find unpaid obligations for this apartment
          const aptObls = allObligations.filter(
            (o) =>
              (o.apartment_id && o.apartment_id === apt.id) ||
              (o.apartment_number &&
                String(o.apartment_number).trim() === String(apt.apartment_number).trim())
          );
          const unpaidObls = aptObls.filter((o) => o.status === 'unpaid');
          const totalOblsDebt = unpaidObls.reduce(
            (sum, o) => sum + (Number(o.amount) || 0),
            0
          );
          const dbArrears = Number(apt.arrears_amount) || 0;
          const effectiveArrears = dbArrears > 0 && totalOblsDebt > 0
            ? Math.min(dbArrears, totalOblsDebt)
            : Math.max(dbArrears, totalOblsDebt);
          const hasUnpaidDebt = effectiveArrears > 0;

          const baseStatus: PaymentStatusType = monthlyPayment
            ? monthlyPayment.status
            : 'unpaid';

          const finalStatus: PaymentStatusType =
            baseStatus === 'pending'
              ? 'pending'
              : hasUnpaidDebt
              ? 'unpaid'
              : baseStatus;

          return {
            ...apt,
            resident_name: matchedUser?.full_name || apt.resident_name,
            resident_phone: matchedUser?.phone || apt.resident_phone,
            occupant_name: apt.occupant_name || matchedUser?.full_name,
            occupant_phone: apt.occupant_phone || matchedUser?.phone,
            arrears_amount: effectiveArrears,
            unpaid_amount: effectiveArrears + (finalStatus === 'paid' ? 0 : (currentBuilding?.default_monthly_dues || 400)),
            payment_status: finalStatus,
          };
        });

        setApartments((prev) => {
          const serverIds = new Set(merged.map((a) => a.id));
          const serverAptKeys = new Set(
            merged.map(
              (a) =>
                `${a.building_id || ''}_${String(a.apartment_number).trim()}`
            )
          );
          const localInFlight = prev.filter((a) => {
            if (serverIds.has(a.id)) return false;
            if (!a.id.startsWith('apt-')) return false;
            const aptKey = `${a.building_id || ''}_${String(
              a.apartment_number
            ).trim()}`;
            return !serverAptKeys.has(aptKey);
          });
          return [...localInFlight, ...merged];
        });
      }

      if (sRes.data && sRes.data.length > 0) {
        setPlans(sRes.data as SubscriptionPlan[]);
      }

      // Process Issues and Upvotes
      const rawUpvotes = (upvotesRes?.data as IssueUpvote[]) || [];
      setIssueUpvotes(rawUpvotes);

      const rawIssues = (issuesRes?.data as BuildingIssue[]) || [];
      const callerUser = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const callerAptNum = callerUser?.apartment_number;
      const callerAptId = callerUser?.apartment_id;
      const callerUserId = callerUser?.id;

      const processedIssues = rawIssues.map((issue) => {
        const hasUpvoted = rawUpvotes.some(
          (u) =>
            u.issue_id === issue.id &&
            ((callerAptId && u.apartment_id === callerAptId) ||
              (callerAptNum && u.apartment_number === callerAptNum) ||
              (callerUserId && u.user_id === callerUserId))
        );
        return {
          ...issue,
          has_upvoted: hasUpvoted,
        };
      });
      if (processedIssues.length > 0 || issuesRes?.data) {
        setBuildingIssues((prev) => {
          const serverIds = new Set(processedIssues.map((i) => i.id));
          const inFlight = prev.filter((i) => i.id.startsWith('issue-') && !serverIds.has(i.id));
          return [...inFlight, ...processedIssues];
        });
      }

      // Process Polls and Votes
      const rawVotes = (votesRes?.data as PollVote[]) || [];
      setPollVotes(rawVotes);

      const rawPolls = (pollsRes?.data as Poll[]) || [];
      const totalUnits = primaryBuilding?.total_apartments || rawApts.length || 16;

      const processedPolls = rawPolls.map((poll) => {
        const pollVotesList = rawVotes.filter((v) => v.poll_id === poll.id);
        const myVote = pollVotesList.find(
          (v) =>
            (callerAptId && v.apartment_id === callerAptId) ||
            (callerAptNum && v.apartment_number === callerAptNum) ||
            (callerUserId && v.voter_id === callerUserId)
        );

        const optionsStats: Record<string, { count: number; percentage: number; apartments: string[] }> = {};
        const opts = poll.options || [
          { id: 'approve', title: 'موافق على القرار' },
          { id: 'reject', title: 'رافض أو متحفظ' },
          { id: 'abstain', title: 'ممتنع عن التصويت' },
        ];

        opts.forEach((opt) => {
          const matchingVotes = pollVotesList.filter((v) => v.choice === opt.id);
          const apts = matchingVotes.map((v) => v.apartment_number).filter(Boolean);
          const pct = pollVotesList.length > 0
            ? Math.round((matchingVotes.length / pollVotesList.length) * 100)
            : 0;
          optionsStats[opt.id] = {
            count: matchingVotes.length,
            percentage: pct,
            apartments: apts,
          };
        });

        const participationPct = totalUnits > 0
          ? Math.round((pollVotesList.length / totalUnits) * 100)
          : 0;

        return {
          ...poll,
          options: opts,
          votes_count: pollVotesList.length,
          user_voted_choice: myVote ? myVote.choice : null,
          options_stats: optionsStats,
          total_voted_units: pollVotesList.length,
          total_building_units: totalUnits,
          participation_percent: participationPct,
        };
      });

      if (processedPolls.length > 0 || pollsRes?.data) {
        setPolls((prev) => {
          const serverIds = new Set(processedPolls.map((p) => p.id));
          const inFlight = prev.filter((p) => p.id.startsWith('poll-') && !serverIds.has(p.id));
          return [...inFlight, ...processedPolls];
        });
      }
    } catch (err) {
      console.warn('loadDataFromSupabase warning:', err);
    }
  }, [payments, currentRole, usersByRole]);

  // Sync with Supabase on mount and subscribe to Realtime public schema changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    loadDataFromSupabase();

    const channel = supabase
      .channel('app-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          loadDataFromSupabase();
          if (payload.eventType === 'INSERT' && payload.new) {
            const notif = payload.new as AppNotification;
            const notifTitle = notif.title || '';

            // 1. Explicit Admin-Only Notifications
            const isAdminNotif =
              notif.recipient_role === 'admin' ||
              notifTitle.includes('إيصال سداد جديد') ||
              notifTitle.includes('طلب انضمام ساكن جديد') ||
              (usersByRole.admin.id && notif.recipient_id === usersByRole.admin.id && notif.recipient_role !== 'resident');

            // 2. Explicit Resident-Only Notifications
            const isResidentNotif =
              notif.recipient_role === 'resident' ||
              notifTitle.includes('تم اعتماد سداد') ||
              notifTitle.includes('تعذر اعتماد') ||
              notifTitle.includes('تم قبول انضمامك') ||
              notifTitle.includes('تم تفعيل حسابك') ||
              notifTitle.includes('مديونية جديدة') ||
              notifTitle.includes('تذكير بسداد') ||
              notifTitle.includes('تم تسجيل سدادك النقدي') ||
              (usersByRole.resident.id && notif.recipient_id === usersByRole.resident.id && notif.recipient_role !== 'admin');

            if (currentRole === 'admin') {
              if (isAdminNotif && !isResidentNotif) {
                setActiveBannerNotification(notif);
              }
            } else if (currentRole === 'resident') {
              if (isResidentNotif && !isAdminNotif) {
                const targetApt = notif.metadata?.apartment_number;
                const myApt = currentUser.apartment_number || usersByRole.resident.apartment_number;
                const isForMyUnit =
                  !targetApt ||
                  !myApt ||
                  String(targetApt).trim() === String(myApt).trim();

                if (isForMyUnit) {
                  setActiveBannerNotification(notif);
                }
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          loadDataFromSupabase();
          if (payload.eventType === 'INSERT' && payload.new) {
            const newUser = payload.new as UserProfile;
            if (newUser.status === 'pending' && currentRole === 'admin') {
              setActiveBannerNotification({
                id: 'notif-join-' + Date.now(),
                building_id: newUser.building_id || '',
                recipient_id: usersByRole.admin.id,
                recipient_role: 'admin',
                title: `طلب انضمام ساكن جديد (شقة ${newUser.apartment_number}) 🔔`,
                body: `طلب الساكن (${newUser.full_name}) الانضمام لشقة رقم (${newUser.apartment_number}) وهو بانتظار موافقتك.`,
                category: 'join_request',
                badge_label: 'طلب انضمام معلق',
                is_urgent: true,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedUser = payload.new as UserProfile;
            if (updatedUser.status === 'active' && currentRole === 'resident') {
              localPendingResidentRef.current = null;
              lastApprovedResidentRef.current = updatedUser;
              AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});
              AsyncStorage.setItem(
                '@ittihad_approved_resident',
                JSON.stringify(updatedUser)
              ).catch(() => {});
              setUsersByRole((prev) => ({
                ...prev,
                resident: {
                  ...prev.resident,
                  ...updatedUser,
                  status: 'active',
                },
              }));
              setActiveBannerNotification({
                id: 'notif-approved-' + Date.now(),
                building_id: updatedUser.building_id || '',
                recipient_id: updatedUser.id,
                recipient_role: 'resident',
                title: 'تم اعتماد حسابك بنجاح 🎉',
                body: `مرحباً بك! وافق رئيس الاتحاد على انضمامك لشقة (${updatedUser.apartment_number}). يمكنك الآن استخدام التطبيق بالكامل.`,
                category: 'general',
                badge_label: 'حساب مفعل',
                is_urgent: false,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          loadDataFromSupabase();
          if (payload.eventType === 'INSERT' && payload.new) {
            const p = payload.new as any;
            if (p.status === 'pending' && currentRole === 'admin') {
              setActiveBannerNotification({
                id: 'notif-pay-' + Date.now(),
                building_id: p.building_id || '',
                recipient_id: usersByRole.admin.id,
                recipient_role: 'admin',
                title: `إيصال سداد جديد (شقة ${p.apartment_number}) 💳`,
                body: `قام ساكن شقة (${p.apartment_number}) برفع إيصال بقيمة ${p.amount} ج.م وهو بانتظار اعتمادك.`,
                category: 'financial',
                badge_label: 'سداد قيد المراجعة',
                is_urgent: false,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apartments' },
        () => {
          loadDataFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'apartment_obligations' },
        (payload) => {
          loadDataFromSupabase();
          if (payload.eventType === 'INSERT' && payload.new) {
            const newObl = payload.new as any;
            const myAptId = usersByRole.resident.apartment_id;
            const myAptNum = usersByRole.resident.apartment_number;
            const isForMyApt =
              (myAptId && newObl.apartment_id === myAptId) ||
              (myAptNum && newObl.apartment_number && String(newObl.apartment_number).trim() === String(myAptNum).trim()) ||
              (apartments.find((a) => a.id === newObl.apartment_id)?.apartment_number === myAptNum);

            if (currentRole === 'resident' && isForMyApt) {
              setActiveBannerNotification({
                id: 'notif-obl-' + Date.now(),
                building_id: newObl.building_id || '',
                recipient_id: usersByRole.resident.id,
                recipient_role: 'resident',
                title: `مديونية جديدة مسجلة على شقتك (${myAptNum || ''}) 📋`,
                body: `تم قيد مديونية جديدة: (${newObl.title}) بمبلغ ${Number(newObl.amount || 0).toLocaleString()} ج.م عن دورة ${newObl.billing_month || ''}.`,
                category: 'financial',
                badge_label: 'مديونية مستحقة',
                is_urgent: true,
                is_read: false,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'building_issues' },
        () => {
          loadDataFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issue_upvotes' },
        () => {
          loadDataFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          loadDataFromSupabase();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => {
          loadDataFromSupabase();
        }
      )
      .subscribe();

    // 3-second live auto-polling interval so new join requests and payments appear automatically without manual refresh
    const pollInterval = setInterval(() => {
      loadDataFromSupabase();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [loadDataFromSupabase, usersByRole.admin.id]);

  // Register Expo Push Token on app startup & whenever role changes, and store in users table
  useEffect(() => {
    let isMounted = true;

    registerAndSavePushTokenAsync(currentUser.id).then((token) => {
      if (!isMounted || !token) return;
      setExpoPushToken(token);
      setUsersByRole((prev) => ({
        ...prev,
        [currentRole]: {
          ...prev[currentRole],
          push_token: token,
          push_token_updated_at: new Date().toISOString(),
        },
      }));
    });

    const unsubscribeNative = subscribeToNativeNotifications({
      onReceived: ({ title, body, data }) => {
        if (!title && !body) return;
        const targetRecipientRole = data?.recipientRole as UserRole | undefined;
        const targetRecipientId = data?.recipientId as string | undefined;

        // If this notification was targeted at a specific recipient/role and it's not the active user, don't show local banner!
        if (targetRecipientId && targetRecipientId !== currentUser.id) {
          return;
        }
        if (targetRecipientRole && targetRecipientRole !== currentRole) {
          return;
        }

        const incoming: AppNotification = {
          id: 'push-' + Date.now(),
          building_id: (data?.buildingId as string) || currentUser.building_id || 'bld-amal-001',
          recipient_id: currentUser.id,
          recipient_role:
            targetRecipientRole || currentRole,
          title: title || 'إشعار جديد',
          body: body || '',
          category:
            (data?.category as AppNotification['category']) || 'general',
          badge_label: (data?.badgeLabel as string) || 'إشعار فوري',
          is_urgent: Boolean(data?.isUrgent),
          is_read: false,
          created_at: new Date().toISOString(),
        };
        setActiveBannerNotification(incoming);
      },
      onResponseRole: (targetRole) => {
        setCurrentRole(targetRole as UserRole);
      },
    });

    return () => {
      isMounted = false;
      unsubscribeNative();
    };
  }, [currentRole, currentUser.id, currentUser.building_id]);

  // Helper to append an in-app notification + show top banner + send Expo Push Notification
  const pushAndRecordNotification = useCallback(
    async (params: {
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
    }) => {
      const newNotif: AppNotification = {
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        building_id: params.buildingId ?? 'bld-amal-001',
        recipient_id: params.recipientId,
        recipient_role: params.recipientRole,
        title: params.title,
        body: params.body,
        category: params.category,
        badge_label: params.badgeLabel,
        is_urgent: Boolean(params.isUrgent),
        is_read: false,
        created_at: new Date().toISOString(),
        metadata: params.metadata,
      };

      setNotifications((prev) => [newNotif, ...prev]);

      if (isSupabaseConfigured) {
        supabase
          .from('notifications')
          .insert({
            building_id:
              params.buildingId ?? currentUser.building_id ?? 'bld-amal-001',
            recipient_id: params.recipientId || null,
            recipient_role: params.recipientRole,
            title: params.title,
            body: params.body,
            category: params.category,
            metadata: params.metadata || {},
          })
          .then(({ error }) => {
            if (error) {
              console.warn('Failed to persist notification to Supabase:', error.message);
            }
          });
      }

      // STRICT ROLE ISOLATION: A notification for Admin must NEVER show on a Resident screen, and vice-versa!
      let isCurrentUserRecipient = false;
      if (params.recipientRole === currentRole) {

        if (currentRole === 'admin') {
          // Admin sees notifications directed to admin
          isCurrentUserRecipient = true;
        } else if (currentRole === 'resident') {
          // Resident sees only if recipientId matches, or target apartment strictly matches their unit
          isCurrentUserRecipient =
            params.recipientId === currentUser.id ||
            (!params.recipientId &&
              Boolean(params.metadata?.apartment_number) &&
              Boolean(currentUser.apartment_number) &&
              String(params.metadata?.apartment_number).trim() ===
                String(currentUser.apartment_number).trim()) ||
            (!params.recipientId &&
              Array.isArray(params.metadata?.target_apartments) &&
              Boolean(currentUser.apartment_number) &&
              params.metadata.target_apartments
                .map((a: any) => String(a).trim())
                .includes(String(currentUser.apartment_number).trim()));
        }

        if (isCurrentUserRecipient) {
          setActiveBannerNotification(newNotif);
        }
      }

      await dispatchPushNotification({
        toTokens: params.recipientPushToken ? [params.recipientPushToken] : [],
        title: params.title,
        body: params.body,
        data: {
          notificationId: newNotif.id,
          recipientId: params.recipientId,
          recipientRole: params.recipientRole,
          targetRole: params.recipientRole,
          category: params.category,
          badgeLabel: params.badgeLabel,
          isUrgent: params.isUrgent,
          ...params.metadata,
        },
        triggerLocalBanner: isCurrentUserRecipient,
      });
    },
    [currentRole, currentUser.id, currentUser.apartment_number, currentUser.building_id]
  );

  const dismissBannerNotification = useCallback(() => {
    setActiveBannerNotification(null);
  }, []);

  const currentBuilding = useMemo(() => {
    return (
      buildings.find((b) => b.id === currentUser.building_id) ||
      buildings[0] ||
      DEFAULT_EMPTY_BUILDING
    );
  }, [buildings, currentUser.building_id]);

  const currentRoleNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (n.building_id && n.building_id !== currentBuilding.id) return false;

      if (currentRole === 'super_admin') {
        return n.recipient_role === 'super_admin';
      }

      if (currentRole === 'admin') {
        return (
          n.recipient_role === 'admin' || n.recipient_id === currentUser.id
        );
      }

      if (currentRole === 'resident') {
        const effectiveResidentApt = currentUser.apartment_number || '';

        // STRICT SECURITY: A notification intended for Admin must NEVER be visible in Resident's notifications list
        if (
          n.recipient_role === 'admin' ||
          n.title.includes('إيصال سداد جديد') ||
          n.title.includes('طلب انضمام ساكن جديد')
        ) {
          return false;
        }

        // Direct recipient by user ID
        if (n.recipient_id && n.recipient_id === currentUser.id) {
          return true;
        }

        // Targeted by apartment number
        if (
          n.metadata?.apartment_number &&
          String(n.metadata.apartment_number).trim() ===
            String(effectiveResidentApt).trim()
        ) {
          return true;
        }

        // Targeted via bulk reminder list
        if (
          Array.isArray(n.metadata?.target_apartments) &&
          n.metadata.target_apartments
            .map((a: any) => String(a).trim())
            .includes(String(effectiveResidentApt).trim())
        ) {
          return true;
        }

        // Role-level match for residents (general or maintenance alerts or announcements, excluding join requests)
        if (
          n.recipient_role === 'resident' &&
          n.category !== 'join_request'
        ) {
          return true;
        }

        return false;
      }

      return false;
    });
  }, [
    notifications,
    currentRole,
    currentUser.id,
    currentUser.apartment_number,
    currentBuilding.id,
  ]);

  const unreadNotificationsCount = useMemo(() => {
    return currentRoleNotifications.filter((n) => !n.is_read).length;
  }, [currentRoleNotifications]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        await secureRpc.markAllNotificationsRead();
      } catch {
        // Ignore if offline
      }
    }
    const visibleIds = new Set(currentRoleNotifications.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (visibleIds.has(n.id) ? { ...n, is_read: true } : n))
    );
  }, [currentRoleNotifications]);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, []);

  const isCurrentBuildingWritable = useMemo(() => {
    if (!currentBuilding.id) return true;
    if (
      currentBuilding.subscription_status === 'expired' ||
      currentBuilding.subscription_status === 'read_only'
    ) {
      return false;
    }
    const endDate =
      currentBuilding.subscription_status === 'trial'
        ? new Date(currentBuilding.trial_ends_at)
        : new Date(currentBuilding.subscription_ends_at);
    return endDate.getTime() >= Date.now();
  }, [currentBuilding]);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (typeof __DEV__ !== 'undefined' && !__DEV__) {
        console.warn('Switching roles is disabled in production. Role must be derived from database session.');
        return;
      }
      console.warn('[DEV ONLY] switchRole called in development mode. In production, role is derived exclusively from server authentication.');
      setCurrentRole(role);
      setNotifications((prev) => {
        const unreadForRole = prev.find((n) => {
          if (n.is_read) return false;
          if (role === 'resident') {
            const isTargetResident =
              n.recipient_role === 'resident' ||
              n.recipient_id === usersByRole.resident.id ||
              (Boolean(n.metadata?.apartment_number) &&
                Boolean(usersByRole.resident.apartment_number) &&
                String(n.metadata?.apartment_number).trim() ===
                  String(usersByRole.resident.apartment_number).trim());
            return isTargetResident && n.category !== 'join_request';
          }
          if (role === 'admin') {
            return (
              n.recipient_role === 'admin' ||
              n.recipient_id === usersByRole.admin.id ||
              n.category === 'join_request'
            );
          }
          return false;
        });
        if (unreadForRole) {
          setActiveBannerNotification(unreadForRole);
        } else {
          setActiveBannerNotification(null);
        }
        return prev;
      });
    },
    [usersByRole.admin.id, usersByRole.resident.apartment_number, usersByRole.resident.id]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        setAuthenticated(true);
        return;
      }
      const data = await authSignIn(email, password);
      const userId = data?.user?.id;
      if (!userId) {
        throw new Error('فشل تسجيل الدخول.');
      }

      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!dbUser) {
        throw new Error('حسابك غير مسجل في قاعدة البيانات، يرجى إتمام التسجيل أولاً.');
      }

      // Role strictly from DB!
      setCurrentRole(dbUser.role);
      setUsersByRole((prev) => ({ ...prev, [dbUser.role]: dbUser }));
      setAuthenticated(true);
      await loadDataFromSupabase();
    },
    [loadDataFromSupabase]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { fullName?: string; phone?: string; role?: 'admin' | 'resident' }
    ) => {
      if (!isSupabaseConfigured) {
        setAuthenticated(true);
        return;
      }
      await authSignUp(email, password, metadata);
    },
    []
  );

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await authSignOut();
    }
    setAuthenticated(false);
  }, []);

  // 1. Admin creates building (60-day Pro trial + unique building_code)
  const createBuildingForAdmin = useCallback(
    async (input: {
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
      buildingName: string;
      address: string;
      totalApartments: number;
      defaultMonthlyDues: number;
      adminApartmentNumber: string;
    }) => {
      let rpcBuildingCode: string | null = null;
      let rpcBuildingId: string | null = null;
      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSessionEmail = sessionData?.session?.user?.email?.trim().toLowerCase();
        const targetEmail = input.email?.trim().toLowerCase();

        // If target email is provided and differs from active session or if previous session is stale, sign out
        if (targetEmail && input.password) {
          if (currentSessionEmail && currentSessionEmail !== targetEmail) {
            await supabase.auth.signOut();
          }

          const hasSession = await ensureSupabaseSession();
          if (!hasSession) {
            try {
              await authSignUp(targetEmail, input.password, {
                fullName: input.fullName,
                phone: input.phone,
                role: 'admin',
              });
            } catch (signUpErr: any) {
              if (
                signUpErr?.message?.toLowerCase().includes('already registered') ||
                signUpErr?.message?.includes('مسجل بالفعل')
              ) {
                try {
                  await authSignIn(targetEmail, input.password);
                } catch {}
              } else {
                throw signUpErr;
              }
            }
          }
        }
        const { data, error } = await secureRpc.createBuildingForAdmin(input);
        if (error) {
          throw new Error(error.message);
        }
        if (data?.building_code) {
          rpcBuildingCode = String(data.building_code);
        }
        if (data?.building_id) {
          rpcBuildingId = String(data.building_id);
        }
      }

      const generatedCode =
        rpcBuildingCode ||
        'BLD-' + Math.floor(1000 + Math.random() * 9000).toString();
      const trialEnd = new Date(Date.now() + 60 * 86400000).toISOString();
      const newBuildingId = rpcBuildingId || 'bld-' + Date.now();

      const newBuilding: Building = {
        id: newBuildingId,
        name: input.buildingName.trim(),
        address: input.address.trim(),
        city: 'القاهرة',
        building_code: generatedCode,
        admin_id: usersByRole.admin.id,
        fund_balance: 0,
        default_monthly_dues: input.defaultMonthlyDues,
        total_apartments: input.totalApartments,
        plan_code: 'pro',
        subscription_status: 'trial',
        trial_ends_at: trialEnd,
        subscription_ends_at: trialEnd,
        custom_monthly_price: null,
        max_apartments_override: null,
        features_config: {
          receipt_upload: true,
          emergency_claims: true,
          export_reports: true,
          voting: true,
          maintenance_tickets: true,
          documents_archive: true,
        },
        created_at: new Date().toISOString(),
      };

      const adminApt: Apartment = {
        id: 'apt-' + Date.now(),
        building_id: newBuildingId,
        apartment_number: input.adminApartmentNumber.trim(),
        floor_number: 'الدور الأول',
        wing_or_direction: 'واجهة',
        area_sqm: 160,
        ownership_share_percent: Number(
          (100 / Math.max(input.totalApartments, 1)).toFixed(2)
        ),
        monthly_dues_override: null,
        resident_name: input.fullName.trim(),
        resident_phone: input.phone.trim(),
        occupant_name: input.fullName.trim(),
        occupant_phone: input.phone.trim(),
        resident_id: usersByRole.admin.id,
        invite_code: `${generatedCode}-${input.adminApartmentNumber.trim()}`,
        payment_status: 'unpaid',
        arrears_amount: 0,
        unpaid_amount: input.defaultMonthlyDues || 300,
        unpaid_months_count: 1,
        is_active: true,
      };

      // Completely clear any old building residue in local memory
      setBuildings([newBuilding]);
      setApartments([adminApt]);
      setApartmentObligations([]);
      setPayments([]);
      setExpenses([]);
      setEmergencyClaims([]);
      setPendingResidents([]);
      setBuildingIssues([]);
      setPolls([]);
      setPollVotes([]);
      setIssueUpvotes([]);

      // Clear local storage caches of old resident review state
      localPendingResidentRef.current = null;
      lastApprovedResidentRef.current = null;
      reviewedResidentKeysRef.current = {};
      setReviewedResidentKeys({});
      AsyncStorage.multiRemove([
        '@ittihad_reviewed_residents',
        '@ittihad_local_pending_resident',
        '@ittihad_approved_resident',
      ]).catch(() => {});

      setUsersByRole((prev) => ({
        ...prev,
        admin: {
          ...prev.admin,
          full_name: input.fullName,
          phone: input.phone,
          building_id: newBuildingId,
          apartment_number: input.adminApartmentNumber,
          status: 'active',
        },
      }));
      setCurrentRole('admin');
      setAuthenticated(true);
      loadDataFromSupabase();

      return { buildingCode: generatedCode };
    },
    [usersByRole.admin.id, loadDataFromSupabase]
  );

  // 2. Scenario 1A: Resident requests to join building ➔ Immediate Push Notification to Admin!
  const requestJoinBuilding = useCallback(
    async (input: {
      fullName: string;
      phone: string;
      email?: string;
      password?: string;
      buildingCode: string;
      apartmentNumber: string;
      floorNumber?: string;
    }) => {
      let cleanCode = input.buildingCode.trim().toUpperCase();
      let targetAptNumber = input.apartmentNumber.trim();
      const parts = cleanCode.split('-');
      if (parts.length >= 3 && parts[0] === 'BLD') {
        cleanCode = `${parts[0]}-${parts[1]}`;
        if (!targetAptNumber) {
          targetAptNumber = parts.slice(2).join('-');
        }
      }

      let rpcUserId: string | null = null;
      let rpcBuildingId: string | null = null;
      let rpcBuildingName: string | null = null;

      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSessionEmail = sessionData?.session?.user?.email?.trim().toLowerCase();
        const targetEmail = input.email?.trim().toLowerCase();

        // If target email is provided and differs from active session (e.g. admin logged in on this device), sign out previous user
        if (targetEmail && input.password) {
          if (currentSessionEmail && currentSessionEmail !== targetEmail) {
            await supabase.auth.signOut();
          }

          const hasSession = await ensureSupabaseSession();
          if (!hasSession) {
            try {
              await authSignUp(targetEmail, input.password, {
                fullName: input.fullName,
                phone: input.phone,
                role: 'resident',
              });
            } catch (signUpErr: any) {
              if (
                signUpErr?.message?.toLowerCase().includes('already registered') ||
                signUpErr?.message?.includes('مسجل بالفعل')
              ) {
                try {
                  await authSignIn(targetEmail, input.password);
                } catch {}
              } else {
                throw signUpErr;
              }
            }
          }
        }

        const { data: rpcJoinData, error } = await secureRpc.requestJoinBuilding({
          ...input,
          buildingCode: cleanCode,
          apartmentNumber: targetAptNumber,
        });

        if (error) {
          if (error.message.includes('User is already an active member of an existing building')) {
            throw new Error(
              'هذا الحساب مسجل بالفعل كعضو نشط في العمارة. إذا كنت تسجل ساكناً أو مالكاً جديداً، يرجى كتابة بريد إلكتروني وكلمة مرور جديدة خاصة بالساكن (أو تسجيل الخروج أولاً من حساب رئيس الاتحاد).'
            );
          }
          throw new Error(error.message);
        }

        rpcUserId = rpcJoinData?.user_id || null;
        rpcBuildingId = rpcJoinData?.building_id || null;
        rpcBuildingName = rpcJoinData?.building_name || null;
      }

      let targetBuilding = buildings.find(
        (b) =>
          b.building_code.trim().toUpperCase() === cleanCode ||
          (rpcBuildingId && b.id === rpcBuildingId)
      );

      // If not yet present in local memory, check Supabase directly or fallback
      if (!targetBuilding && isSupabaseConfigured) {
        try {
          const { data } = await supabase
            .from('buildings')
            .select('*')
            .or(`building_code.ilike.${cleanCode}${rpcBuildingId ? `,id.eq.${rpcBuildingId}` : ''}`)
            .maybeSingle();
          if (data) {
            targetBuilding = data as Building;
            setBuildings((prev) => [data as Building, ...prev]);
          } else if (rpcBuildingId) {
            const fallbackBld: Building = {
              id: rpcBuildingId,
              name: rpcBuildingName || 'عمارة سكنية',
              address: 'القاهرة',
              city: 'القاهرة',
              building_code: cleanCode,
              admin_id: '',
              fund_balance: 0,
              default_monthly_dues: 350,
              total_apartments: 16,
              plan_code: 'pro',
              subscription_status: 'trial',
              trial_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              subscription_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              custom_monthly_price: null,
              max_apartments_override: null,
              features_config: {
                receipt_upload: true,
                emergency_claims: true,
                export_reports: true,
                voting: true,
                maintenance_tickets: true,
                documents_archive: true,
              },
              created_at: new Date().toISOString(),
            };
            targetBuilding = fallbackBld;
            setBuildings((prev) => [fallbackBld, ...prev]);
          }
        } catch {}
      }

      if (!targetBuilding) {
        throw new Error(
          `كود المبنى (${input.buildingCode}) غير صحيح أو غير مسجل في قاعدة البيانات. يرجى الحصول على الكود الصحيح من رئيس الاتحاد.`
        );
      }

      const pendingUser: UserProfile = {
        id: rpcUserId || 'usr-res-' + Date.now(),
        full_name: input.fullName.trim(),
        email: input.email?.trim() || 'resident@ittihad.app',
        phone: input.phone.trim(),
        role: 'resident',
        status: 'pending',
        building_id: targetBuilding.id,
        apartment_id: 'apt-' + targetAptNumber,
        apartment_number: targetAptNumber,
        floor_number: input.floorNumber || 'الدور الأول',
        residency_type: 'owner_resident',
        ownership_share_percent: Number(
          (100 / Math.max(targetBuilding.total_apartments, 1)).toFixed(2)
        ),
        push_token: expoPushToken,
        push_token_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Clear previous review records for this applicant so the new join request is treated as pending
      const nextReviewed = { ...reviewedResidentKeysRef.current };
      delete nextReviewed[pendingUser.id];
      delete nextReviewed[input.phone.trim()];
      delete nextReviewed[`${targetBuilding.id}_${targetAptNumber}`];
      delete nextReviewed[targetAptNumber];
      reviewedResidentKeysRef.current = nextReviewed;
      setReviewedResidentKeys(nextReviewed);
      AsyncStorage.setItem('@ittihad_reviewed_residents', JSON.stringify(nextReviewed)).catch(() => {});

      localPendingResidentRef.current = pendingUser;
      lastApprovedResidentRef.current = null;
      AsyncStorage.setItem('@ittihad_local_pending_resident', JSON.stringify(pendingUser)).catch(() => {});
      AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});

      setPendingResidents((prev) => {
        const filtered = prev.filter(
          (p) =>
            p.id !== pendingUser.id &&
            (p.phone !== input.phone.trim() ||
              p.apartment_number !== targetAptNumber)
        );
        return [pendingUser, ...filtered];
      });
      setUsersByRole((prev) => ({
        ...prev,
        resident: pendingUser,
      }));
      setCurrentRole('resident');
      setAuthenticated(true);

      // Scenario 1A: Send immediate notification to Building Admin
      await pushAndRecordNotification({
        recipientId: usersByRole.admin.id,
        recipientRole: 'admin',
        recipientPushToken: usersByRole.admin.push_token,
        buildingId: targetBuilding.id,
        title: `طلب انضمام ساكن جديد (شقة ${input.apartmentNumber.trim()}) 🔔`,
        body: `قام الساكن (${input.fullName.trim()}) بطلب الانضمام لشقة رقم (${input.apartmentNumber.trim()}) في ${targetBuilding.name} وهو بانتظار موافقتك.`,
        category: 'join_request',
        badgeLabel: 'طلب انضمام معلق',
        isUrgent: true,
        metadata: {
          apartment_number: input.apartmentNumber.trim(),
          resident_id: pendingUser.id,
        },
      });
    },
    [buildings, currentBuilding, expoPushToken, pushAndRecordNotification, usersByRole.admin]
  );

  // 3. Scenario 2B & Mechanism 2: Admin approves or rejects pending resident join request (with optional apartment override in 1 step)
  const reviewResidentJoinRequest = useCallback(
    async (
      residentId: string,
      approve: boolean,
      overrideApartmentNumber?: string
    ) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      if (processingIds[residentId]) return;
      setProcessingIds((prev) => ({ ...prev, [residentId]: true }));

      try {
        const target =
          pendingResidents.find((r) => r.id === residentId) ||
          localPendingResidentRef.current ||
          pendingResidents[0];
        if (!target) {
          throw new Error('تمت معالجة طلب هذا الساكن مسبقاً.');
        }

        const finalAptNumber = (
          overrideApartmentNumber?.trim() ||
          target.apartment_number ||
          ''
        ).trim();

        const targetAptObj = apartments.find(
          (a) =>
            a.building_id === (target.building_id || currentBuilding.id) &&
            a.apartment_number === finalAptNumber
        );

        const newStatus = approve ? 'active' : 'rejected';

        // 1. Synchronously register in reviewedResidentKeysRef and save to AsyncStorage BEFORE async RPC calls
        const reviewRecord: ReviewedResidentEntry = {
          status: newStatus,
          phone: target.phone,
          apartmentNumber: finalAptNumber,
          fullName: target.full_name,
          buildingId: target.building_id || currentBuilding.id,
          reviewedAt: new Date().toISOString(),
        };

        const updatedReviewed: Record<string, ReviewedResidentEntry> = {
          ...reviewedResidentKeysRef.current,
          [residentId]: reviewRecord,
          [target.id]: reviewRecord,
          ...(target.phone ? { [target.phone.trim()]: reviewRecord } : {}),
          ...(target.apartment_number
            ? {
                [`${target.building_id || currentBuilding.id}_${String(target.apartment_number).trim()}`]:
                  reviewRecord,
                [String(target.apartment_number).trim()]: reviewRecord,
              }
            : {}),
          ...(finalAptNumber
            ? {
                [`${target.building_id || currentBuilding.id}_${finalAptNumber}`]:
                  reviewRecord,
                [finalAptNumber]: reviewRecord,
              }
            : {}),
        };
        reviewedResidentKeysRef.current = updatedReviewed;
        setReviewedResidentKeys(updatedReviewed);
        AsyncStorage.setItem(
          '@ittihad_reviewed_residents',
          JSON.stringify(updatedReviewed)
        ).catch(() => {});

        // Clear localPendingResidentRef and store lastApprovedResidentRef if approved
        localPendingResidentRef.current = null;
        AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});

        const updatedResidentProfile: UserProfile = {
          ...usersByRole.resident,
          ...target,
          id: residentId,
          role: 'resident',
          status: newStatus,
          full_name: target.full_name || usersByRole.resident.full_name,
          phone: target.phone || usersByRole.resident.phone,
          apartment_number:
            finalAptNumber || usersByRole.resident.apartment_number,
          apartment_id: targetAptObj?.id || usersByRole.resident.apartment_id,
          floor_number:
            targetAptObj?.floor_number ||
            target.floor_number ||
            usersByRole.resident.floor_number ||
            'الدور الخامس',
          building_id:
            target.building_id || usersByRole.resident.building_id || currentBuilding.id,
        };

        if (approve) {
          lastApprovedResidentRef.current = updatedResidentProfile;
          AsyncStorage.setItem(
            '@ittihad_approved_resident',
            JSON.stringify(updatedResidentProfile)
          ).catch(() => {});
        } else {
          lastApprovedResidentRef.current = null;
          AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});
        }

        // 2. Immediately remove from pendingResidents
        setPendingResidents((prev) =>
          prev.filter(
            (r) =>
              r.id !== residentId &&
              r.id !== target.id &&
              (target.phone ? r.phone?.trim() !== target.phone.trim() : true) &&
              (finalAptNumber
                ? String(r.apartment_number).trim() !== finalAptNumber
                : true)
          )
        );

        // 3. Immediately update usersByRole.resident
        setUsersByRole((prev) => ({
          ...prev,
          resident: updatedResidentProfile,
        }));

        if (isSupabaseConfigured) {
          try {
            await secureRpc.reviewResidentJoinRequest(
              residentId,
              approve,
              targetAptObj?.id ?? null,
              finalAptNumber || null
            );
          } catch (rpcErr) {
            console.warn('reviewResidentJoinRequest error:', rpcErr);
            throw rpcErr;
          }
        }

        if (approve && finalAptNumber) {
          setApartments((prev) => {
            const exists = prev.some(
              (a) =>
                a.building_id === target.building_id &&
                a.apartment_number === finalAptNumber
            );
            if (exists) {
              return prev.map((a) =>
                a.building_id === target.building_id &&
                a.apartment_number === finalAptNumber
                  ? {
                      ...a,
                      resident_id: target.id,
                      resident_name: target.full_name,
                      resident_phone: target.phone,
                      occupant_name: target.full_name || a.occupant_name,
                      occupant_phone: target.phone || a.occupant_phone,
                    }
                  : a
              );
            }
            return [
              ...prev,
              {
                id: 'apt-' + finalAptNumber,
                building_id: target.building_id || currentBuilding.id,
                apartment_number: finalAptNumber,
                floor_number: target.floor_number || 'الدور الرابع',
                wing_or_direction: 'واجهة',
                area_sqm: 160,
                ownership_share_percent: target.ownership_share_percent,
                occupant_name: target.full_name,
                occupant_phone: target.phone,
                arrears_amount: currentBuilding.default_monthly_dues,
                resident_id: target.id,
                resident_name: target.full_name,
                resident_phone: target.phone,
                payment_status: 'unpaid',
                unpaid_months_count: 1,
                unpaid_amount: currentBuilding.default_monthly_dues,
                is_active: true,
              },
            ];
          });
        }

        const wasReassigned =
          Boolean(overrideApartmentNumber) &&
          overrideApartmentNumber?.trim() !== target.apartment_number;

        // Scenario 2B: Notify Resident of Join Request Approval or Rejection
        await pushAndRecordNotification({
          recipientId: target.id,
          recipientRole: 'resident',
          recipientPushToken:
            target.push_token || usersByRole.resident.push_token,
          buildingId: target.building_id || currentBuilding.id,
          title: approve
            ? `تم قبول انضمامك وتفعيل حسابك بنجاح (شقة ${finalAptNumber}) 🎉`
            : `تعذر قبول طلب الانضمام لشقة ${target.apartment_number}`,
          body: approve
            ? wasReassigned
              ? `مرحباً ${target.full_name}، قام رئيس الاتحاد بتعديل رقم وحدتك إلى شقة (${finalAptNumber}) بدلاً من (${target.apartment_number}) واعتماد انضمامك رسمياً.`
              : `مرحباً ${target.full_name}، وافق رئيس اتحاد الملاك على انضمامك لشقة (${finalAptNumber}). يمكنك الآن الدخول لكافة شاشات التطبيق ومتابعة الخزينة.`
            : `نعتذر ${target.full_name}، لم تتم الموافقة على طلب انضمامك لشقة (${target.apartment_number}). يرجى مراجعة رئيس اتحاد الملاك.`,
          category: 'join_request',
          badgeLabel: approve ? 'حساب مفعل' : 'مرفوض',
          isUrgent: !approve,
          metadata: {
            apartment_number: finalAptNumber || undefined,
            resident_id: target.id,
          },
        });
      } finally {
        setProcessingIds((prev) => ({ ...prev, [residentId]: false }));
      }
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      isCurrentBuildingWritable,
      pendingResidents,
      processingIds,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // Mechanism 3: Transfer unpaid obligations (and optionally occupant_name/phone) between apartments in 1 click
  const transferApartmentObligations = useCallback(
    async (input: {
      sourceApartmentId: string;
      targetApartmentId: string;
      obligationIds?: string[];
      transferOccupantInfo?: boolean;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      if (input.sourceApartmentId === input.targetApartmentId) {
        throw new Error('لا يمكن نقل الالتزامات إلى نفس الشقة.');
      }

      const sourceApt = apartments.find(
        (a) => a.id === input.sourceApartmentId
      );
      const targetApt = apartments.find(
        (a) => a.id === input.targetApartmentId
      );

      if (!sourceApt || !targetApt) {
        throw new Error('إحدى الشقتين غير موجودة في سجلات المبنى.');
      }

      if (isSupabaseConfigured) {
        try {
          await secureRpc.transferApartmentObligations({
            sourceApartmentId: input.sourceApartmentId,
            targetApartmentId: input.targetApartmentId,
            obligationIds: input.obligationIds ?? null,
            transferOccupantInfo: input.transferOccupantInfo ?? false,
          });
        } catch {
          // Graceful fallback
        }
      }

      // Filter unpaid obligations on source apartment to move
      const candidateObligations = apartmentObligations.filter(
        (obl) =>
          obl.apartment_id === input.sourceApartmentId &&
          obl.status === 'unpaid' &&
          (!input.obligationIds ||
            input.obligationIds.length === 0 ||
            input.obligationIds.includes(obl.id))
      );

      if (candidateObligations.length === 0) {
        throw new Error(
          'لا توجد التزامات غير مسددة (unpaid) مطابقة لنقلها من هذه الشقة.'
        );
      }

      const movedIds = new Set(candidateObligations.map((o) => o.id));
      const transferredAmount = candidateObligations.reduce(
        (sum, o) => sum + o.amount,
        0
      );
      const nowIso = new Date().toISOString();

      const nextObligations = apartmentObligations.map((obl) =>
        movedIds.has(obl.id)
          ? {
              ...obl,
              apartment_id: targetApt.id,
              apartment_number: targetApt.apartment_number,
              transferred_from_apartment_id: sourceApt.id,
              transferred_from_apartment_number: sourceApt.apartment_number,
              transferred_at: nowIso,
            }
          : obl
      );

      setApartmentObligations(nextObligations);

      // Recalculate arrears & unpaid_months_count for both source and target apartments
      const sourceRemainingUnpaid = nextObligations.filter(
        (o) => o.apartment_id === sourceApt.id && o.status === 'unpaid'
      );
      const targetNextUnpaid = nextObligations.filter(
        (o) => o.apartment_id === targetApt.id && o.status === 'unpaid'
      );

      const sourceNextAmount = sourceRemainingUnpaid.reduce(
        (sum, o) => sum + o.amount,
        0
      );
      const targetNextAmount = targetNextUnpaid.reduce(
        (sum, o) => sum + o.amount,
        0
      );

      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === sourceApt.id) {
            return {
              ...apt,
              unpaid_amount: sourceNextAmount,
              arrears_amount: sourceNextAmount,
              unpaid_months_count: sourceRemainingUnpaid.length,
              payment_status:
                sourceNextAmount === 0 && apt.payment_status === 'unpaid'
                  ? 'paid'
                  : apt.payment_status,
              occupant_name: input.transferOccupantInfo
                ? null
                : apt.occupant_name,
              occupant_phone: input.transferOccupantInfo
                ? null
                : apt.occupant_phone,
              resident_name:
                input.transferOccupantInfo && !apt.resident_id
                  ? 'وحدة شاغرة (تم نقل البيانات)'
                  : apt.resident_name,
            };
          }
          if (apt.id === targetApt.id) {
            const transferredName =
              input.transferOccupantInfo && sourceApt.occupant_name
                ? sourceApt.occupant_name
                : apt.occupant_name;
            const transferredPhone =
              input.transferOccupantInfo && sourceApt.occupant_phone
                ? sourceApt.occupant_phone
                : apt.occupant_phone;

            return {
              ...apt,
              unpaid_amount: targetNextAmount,
              arrears_amount: targetNextAmount,
              unpaid_months_count: targetNextUnpaid.length,
              payment_status:
                targetNextAmount > 0 ? 'unpaid' : apt.payment_status,
              occupant_name: transferredName,
              occupant_phone: transferredPhone,
              resident_name:
                !apt.resident_id && transferredName
                  ? `${transferredName} (مسجل مبدئياً)`
                  : apt.resident_name,
              resident_phone:
                !apt.resident_id && transferredPhone
                  ? transferredPhone
                  : apt.resident_phone,
            };
          }
          return apt;
        })
      );

      return {
        transferredCount: candidateObligations.length,
        transferredAmount,
        sourceApartmentNumber: sourceApt.apartment_number,
        targetApartmentNumber: targetApt.apartment_number,
      };
    },
    [apartmentObligations, apartments, isCurrentBuildingWritable]
  );

  // Add a pre-registered obligation / arrears entry to a specific apartment
  // Add a pre-registered obligation / arrears entry to a specific apartment
  const addApartmentObligation = useCallback(
    async (input: {
      apartmentId: string;
      title: string;
      amount: number;
      billingMonth: string;
      category?: PaymentCategoryType;
      notes?: string;
      apartmentNumber?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      let targetApt = apartments.find(
        (a) =>
          a.id === input.apartmentId ||
          (input.apartmentNumber && a.apartment_number === input.apartmentNumber) ||
          a.apartment_number === input.apartmentId
      );

      if (!targetApt && isSupabaseConfigured && currentBuilding.id) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          let query = supabase.from('apartments').select('*').eq('building_id', currentBuilding.id);
          if (isValidUuid(input.apartmentId)) {
            query = query.eq('id', input.apartmentId);
          } else if (input.apartmentNumber) {
            query = query.eq('apartment_number', input.apartmentNumber.trim());
          } else if (!input.apartmentId.startsWith('apt-')) {
            query = query.eq('apartment_number', input.apartmentId.trim());
          }
          const { data: dbApts } = await query.order('created_at', { ascending: false }).limit(1);
          const dbApt = dbApts && dbApts.length > 0 ? dbApts[0] : null;
          if (dbApt) {
            targetApt = {
              id: dbApt.id,
              building_id: dbApt.building_id,
              apartment_number: dbApt.apartment_number,
              floor_number: dbApt.floor_number || 'الدور الأول',
              wing_or_direction: dbApt.wing_or_direction || 'واجهة',
              area_sqm: Number(dbApt.area_sqm) || 160,
              ownership_share_percent: Number(dbApt.ownership_share_percent) || 6.25,
              monthly_dues_override: dbApt.monthly_dues_override,
              occupant_name: dbApt.occupant_name,
              occupant_phone: dbApt.occupant_phone,
              resident_id: dbApt.resident_id,
              resident_name: dbApt.occupant_name,
              resident_phone: dbApt.occupant_phone,
              payment_status: 'unpaid',
              arrears_amount: Number(dbApt.arrears_amount) || 0,
              unpaid_amount: Number(dbApt.arrears_amount) || 0,
              unpaid_months_count: 1,
              invite_code: dbApt.invite_code,
              is_active: dbApt.is_active ?? true,
            };
          }
        } catch (e) {
          console.warn('Fallback lookup error in addApartmentObligation:', e);
        }
      }

      if (!targetApt) {
        throw new Error('الشقة المحددة غير موجودة.');
      }

      const newObligation: ApartmentObligation = {
        id: 'obl-' + Date.now(),
        building_id: currentBuilding.id || targetApt.building_id,
        apartment_id: targetApt.id,
        apartment_number: targetApt.apartment_number,
        title: input.title.trim(),
        category: input.category || 'monthly_dues',
        billing_month: input.billingMonth.trim(),
        amount: input.amount,
        status: 'unpaid',
        notes: input.notes?.trim() || null,
        created_at: new Date().toISOString(),
      };

      setApartmentObligations((prev) => [newObligation, ...prev]);
      setApartments((prev) =>
        prev.map((apt) =>
          apt.id === targetApt.id || apt.apartment_number === targetApt.apartment_number
            ? {
                ...apt,
                payment_status: 'unpaid',
                unpaid_months_count: (apt.unpaid_months_count || 0) + 1,
                unpaid_amount: (apt.unpaid_amount || 0) + input.amount,
                arrears_amount: (apt.arrears_amount || 0) + input.amount,
              }
            : apt
        )
      );

      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          let targetDbApartmentId = targetApt.id;
          if (!isValidUuid(targetDbApartmentId)) {
            const { data: foundApt } = await supabase
              .from('apartments')
              .select('id')
              .eq('building_id', currentBuilding.id)
              .eq('apartment_number', targetApt.apartment_number)
              .maybeSingle();
            if (foundApt?.id) {
              targetDbApartmentId = foundApt.id;
            }
          }

          if (isValidUuid(targetDbApartmentId)) {
            let insertRes = await supabase
              .from('apartment_obligations')
              .insert({
                building_id: currentBuilding.id || targetApt.building_id,
                apartment_id: targetDbApartmentId,
                title: input.title.trim(),
                category: input.category || 'monthly_dues',
                billing_month: input.billingMonth.trim(),
                amount: input.amount,
                status: 'unpaid',
                notes: input.notes?.trim() || null,
                created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
              })
              .select('id')
              .maybeSingle();

            // If 'other' was rejected by postgres because migration 016 was not run yet, retry with 'monthly_dues'
            if (insertRes.error && insertRes.error.message?.toLowerCase().includes('payment_category_type')) {
              insertRes = await supabase
                .from('apartment_obligations')
                .insert({
                  building_id: currentBuilding.id || targetApt.building_id,
                  apartment_id: targetDbApartmentId,
                  title: input.title.trim(),
                  category: 'monthly_dues',
                  billing_month: input.billingMonth.trim(),
                  amount: input.amount,
                  status: 'unpaid',
                  notes: input.notes?.trim() || null,
                  created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
                })
                .select('id')
                .maybeSingle();
            }

            if (insertRes.data?.id) {
              setApartmentObligations((prev) =>
                prev.map((o) => (o.id === newObligation.id ? { ...o, id: insertRes.data!.id } : o))
              );
            }

            await supabase
              .from('apartments')
              .update({
                payment_status: 'unpaid',
                arrears_amount: (targetApt.arrears_amount || 0) + input.amount,
              })
              .eq('id', targetDbApartmentId);

            // Send instant notification to the resident of this apartment
            try {
              const { data: resUsers } = await supabase
                .from('users')
                .select('id')
                .eq('building_id', currentBuilding.id || targetApt.building_id)
                .eq('apartment_number', targetApt.apartment_number)
                .limit(1);

              const targetResidentId = resUsers?.[0]?.id || targetApt.resident_id;

              await supabase.from('notifications').insert({
                building_id: currentBuilding.id || targetApt.building_id,
                recipient_id: targetResidentId && isValidUuid(targetResidentId) ? targetResidentId : null,
                recipient_role: 'resident',
                title: `مديونية جديدة مسجلة (شقة ${targetApt.apartment_number}) 📋`,
                body: `قام رئيس الاتحاد بتسجيل مديونية جديدة: (${input.title}) بمبلغ ${input.amount.toLocaleString()} ج.م عن شهر ${input.billingMonth}.`,
                category: 'financial',
                badge_label: 'مديونية مستحقة',
                is_urgent: true,
                metadata: {
                  apartment_number: targetApt.apartment_number,
                  apartment_id: targetDbApartmentId,
                  amount: input.amount,
                  title: input.title,
                  billing_month: input.billingMonth,
                },
              });
            } catch (notifErr) {
              console.warn('Failed to insert obligation notification:', notifErr);
            }

            await loadDataFromSupabase();
          }
        } catch (e) {
          console.warn('Supabase addApartmentObligation error:', e);
        }
      }
    },
    [apartments, currentBuilding.id, isCurrentBuildingWritable, usersByRole.admin.id]
  );

  // Settle or mark an apartment obligation as paid
  const settleApartmentObligation = useCallback(
    async (obligationId: string, notes?: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      if (targetObl.status === 'paid') return;

      const targetApt = apartments.find(
        (a) =>
          a.id === targetObl.apartment_id ||
          String(a.apartment_number).trim() === String(targetObl.apartment_number).trim()
      );

      setApartmentObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid', notes: notes || o.notes } : o))
      );

      if (targetApt) {
        const remainingUnpaidAmount = Math.max(
          0,
          (targetApt.arrears_amount || targetApt.unpaid_amount || 0) - targetObl.amount
        );
        const hasOtherUnpaid = apartmentObligations.some(
          (o) =>
            o.id !== obligationId &&
            (o.apartment_id === targetApt.id || o.apartment_number === targetApt.apartment_number) &&
            o.status === 'unpaid'
        );

        setApartments((prev) =>
          prev.map((a) =>
            a.id === targetApt.id || a.apartment_number === targetApt.apartment_number
              ? {
                  ...a,
                  arrears_amount: remainingUnpaidAmount,
                  unpaid_amount: remainingUnpaidAmount,
                  payment_status: hasOtherUnpaid ? 'unpaid' : a.payment_status === 'unpaid' ? 'paid' : a.payment_status,
                }
              : a
          )
        );
      }

      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            await supabase
              .from('apartment_obligations')
              .update({ status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', obligationId);
          }

          if (targetApt && isValidUuid(targetApt.id)) {
            const { data: unpaidSum } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetApt.id)
              .eq('status', 'unpaid');
            const totalRemaining = (unpaidSum || []).reduce((s, row) => s + (Number(row.amount) || 0), 0);
            await supabase
              .from('apartments')
              .update({ arrears_amount: totalRemaining })
              .eq('id', targetApt.id);
          }
        } catch (e) {
          console.warn('Supabase settleApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, apartments, isCurrentBuildingWritable]
  );

  // Delete an apartment obligation (from log or if added by mistake)
  const deleteApartmentObligation = useCallback(
    async (obligationId: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      // 1. Remove from local state
      setApartmentObligations((prev) => prev.filter((o) => o.id !== obligationId));

      // 2. Re-calculate apartment's debt and status in memory
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === targetObl.apartment_id || apt.apartment_number === targetObl.apartment_number) {
            const remainingObls = apartmentObligations.filter(
              (o) =>
                o.id !== obligationId &&
                ((o.apartment_id && o.apartment_id === apt.id) ||
                  (o.apartment_number && o.apartment_number === apt.apartment_number)) &&
                o.status === 'unpaid'
            );
            const newDebt = remainingObls.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
            return {
              ...apt,
              arrears_amount: newDebt,
              unpaid_amount:
                newDebt +
                (apt.payment_status === 'paid' && newDebt === 0
                  ? 0
                  : currentBuilding?.default_monthly_dues || 400),
              unpaid_months_count: remainingObls.filter((o) => o.category === 'monthly_dues').length,
              payment_status: newDebt > 0 ? 'unpaid' : apt.payment_status,
            };
          }
          return apt;
        })
      );

      // 3. Remove from Supabase
      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            await supabase.from('apartment_obligations').delete().eq('id', obligationId);
          }

          if (isValidUuid(targetObl.apartment_id)) {
            const { data: dbRemaining } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetObl.apartment_id)
              .eq('status', 'unpaid');
            const totalRemaining = (dbRemaining || []).reduce(
              (sum: number, r: any) => sum + (Number(r.amount) || 0),
              0
            );
            await supabase
              .from('apartments')
              .update({
                arrears_amount: totalRemaining,
              })
              .eq('id', targetObl.apartment_id);
          }

          await loadDataFromSupabase();
        } catch (e) {
          console.warn('Supabase deleteApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, currentBuilding?.default_monthly_dues, isCurrentBuildingWritable]
  );

  // Update an existing apartment obligation (amount, title, month, notes)
  const updateApartmentObligation = useCallback(
    async (
      obligationId: string,
      updates: {
        title?: string;
        amount?: number;
        billingMonth?: string;
        category?: PaymentCategoryType;
        notes?: string;
      }
    ) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const targetObl = apartmentObligations.find((o) => o.id === obligationId);
      if (!targetObl) {
        throw new Error('الالتزام أو المديونية غير موجودة.');
      }

      // 1. Update in local state
      const updatedObl: ApartmentObligation = {
        ...targetObl,
        title: updates.title !== undefined ? updates.title.trim() : targetObl.title,
        amount: updates.amount !== undefined ? updates.amount : targetObl.amount,
        billing_month:
          updates.billingMonth !== undefined ? updates.billingMonth.trim() : targetObl.billing_month,
        category: updates.category !== undefined ? updates.category : targetObl.category,
        notes: updates.notes !== undefined ? updates.notes.trim() : targetObl.notes,
      };

      setApartmentObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? updatedObl : o))
      );

      // 2. Re-calculate apartment's debt in memory
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id === targetObl.apartment_id || apt.apartment_number === targetObl.apartment_number) {
            const nextObls = apartmentObligations.map((o) => (o.id === obligationId ? updatedObl : o));
            const aptUnpaidObls = nextObls.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === apt.id) ||
                  (o.apartment_number && o.apartment_number === apt.apartment_number)) &&
                o.status === 'unpaid'
            );
            const newDebt = aptUnpaidObls.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
            return {
              ...apt,
              arrears_amount: newDebt,
              unpaid_amount:
                newDebt +
                (apt.payment_status === 'paid' && newDebt === 0
                  ? 0
                  : currentBuilding?.default_monthly_dues || 400),
              unpaid_months_count: aptUnpaidObls.filter((o) => o.category === 'monthly_dues').length,
            };
          }
          return apt;
        })
      );

      // 3. Update in Supabase
      if (isSupabaseConfigured) {
        try {
          const isValidUuid = (val: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isValidUuid(obligationId)) {
            const updatePayload: Record<string, any> = {};
            if (updates.title !== undefined) updatePayload.title = updates.title.trim();
            if (updates.amount !== undefined) updatePayload.amount = updates.amount;
            if (updates.billingMonth !== undefined) updatePayload.billing_month = updates.billingMonth.trim();
            if (updates.category !== undefined) updatePayload.category = updates.category;
            if (updates.notes !== undefined) updatePayload.notes = updates.notes.trim();

            if (Object.keys(updatePayload).length > 0) {
              const { error: upErr } = await supabase
                .from('apartment_obligations')
                .update(updatePayload)
                .eq('id', obligationId);

              if (upErr && upErr.message?.toLowerCase().includes('payment_category_type')) {
                updatePayload.category = 'monthly_dues';
                await supabase
                  .from('apartment_obligations')
                  .update(updatePayload)
                  .eq('id', obligationId);
              }
            }
          }

          if (isValidUuid(targetObl.apartment_id) && updates.amount !== undefined) {
            const { data: dbRemaining } = await supabase
              .from('apartment_obligations')
              .select('amount')
              .eq('apartment_id', targetObl.apartment_id)
              .eq('status', 'unpaid');
            const totalRemaining = (dbRemaining || []).reduce(
              (sum: number, r: any) => sum + (Number(r.amount) || 0),
              0
            );
            await supabase
              .from('apartments')
              .update({
                arrears_amount: totalRemaining,
              })
              .eq('id', targetObl.apartment_id);
          }

          await loadDataFromSupabase();
        } catch (e) {
          console.warn('Supabase updateApartmentObligation error:', e);
        }
      }
    },
    [apartmentObligations, currentBuilding?.default_monthly_dues, isCurrentBuildingWritable]
  );

  // 4. Scenario 1B: Resident submits payment (monthly dues, emergency claim, or arrears/obligation) ➔ Immediate Push Notification to Admin!
  const submitResidentPayment = useCallback(
    async (input: {
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
    }) => {
      if (
        input.paymentMethod === 'electronic_transfer' &&
        !currentBuilding.features_config.receipt_upload
      ) {
        throw new Error(
          'ميزة رفع إيصالات التحويل الإلكتروني غير مفعلة في باقة العمارة الحالية.'
        );
      }

      const resident = usersByRole.resident;
      const effectiveResidentApt = resident.apartment_number || currentUser.apartment_number || '-';
      const category = input.paymentCategory || 'monthly_dues';

      // 1. Normalize billing month (YYYY-MM)
      let normalizedMonth = (input.billingMonth || '').trim();
      if (/^(0[1-9]|1[0-2])-([0-9]{4})$/.test(normalizedMonth)) {
        const [mm, yyyy] = normalizedMonth.split('-');
        normalizedMonth = `${yyyy}-${mm}`;
      } else if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
        normalizedMonth = new Date().toISOString().slice(0, 7);
      }

      // 2. Pre-flight Idempotency & Duplicate Check
      const existingPayment = payments.find((p) => {
        if (p.building_id !== currentBuilding.id) return false;
        if (p.status !== 'pending' && p.status !== 'paid') return false;

        const isSameApartment =
          (p.apartment_number &&
            effectiveResidentApt &&
            String(p.apartment_number).trim() ===
              String(effectiveResidentApt).trim()) ||
          (p.apartment_id && p.apartment_id === resident.apartment_id) ||
          p.resident_id === resident.id;

        if (!isSameApartment) return false;

        if (input.obligationId) {
          // If paying a specific obligation, block only if this specific obligation is already pending or paid
          return p.notes
            ? p.notes.includes(input.obligationId) ||
                (Boolean(input.obligationTitle) && p.notes.includes(input.obligationTitle!))
            : false;
        } else if (input.isArrears) {
          // If paying arrears / partial, only block if there is a pending arrears payment with the exact same amount
          return (
            p.status === 'pending' &&
            Boolean(p.notes && p.notes.includes('مديونية')) &&
            p.amount === input.amount
          );
        } else if (category === 'emergency_claim') {
          return (
            p.payment_category === 'emergency_claim' &&
            Boolean(input.emergencyClaimId) &&
            p.emergency_claim_id === input.emergencyClaimId
          );
        } else {
          return (
            p.payment_category === 'monthly_dues' &&
            Boolean(normalizedMonth) &&
            p.billing_month === normalizedMonth &&
            (!p.notes || (!p.notes.includes('مديونية') && !p.notes.includes('[سداد بند:')))
          );
        }
      });

      if (existingPayment) {
        if (existingPayment.status === 'paid') {
          throw new Error(
            'تم سداد هذا الالتزام مسبقاً ومعتمد في سجلات الخزينة.'
          );
        } else {
          throw new Error(
            'لديك طلب سداد قيد المراجعة بالفعل لهذا البند/الشهر. يرجى انتظار اعتماد رئيس الاتحاد.'
          );
        }
      }

      // 3. Supabase RPC Submission with Fallback
      let serverPaymentId: string | null = null;
      if (isSupabaseConfigured) {
        try {
          const rpcRes = await secureRpc.submitResidentPayment({
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            billingMonth: normalizedMonth,
            cashRecipient: input.cashRecipient,
            receiptImageUrl: input.receiptImageUrl,
            paymentCategory: category === 'other' ? 'monthly_dues' : category,
            emergencyClaimId: input.emergencyClaimId,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
          });
          if (rpcRes?.data?.payment_id) {
            serverPaymentId = String(rpcRes.data.payment_id);
          }
        } catch (rpcErr: any) {
          console.warn('submitResidentPayment RPC error:', rpcErr);
          // If RPC rejected due to legacy month duplicate constraint (e.g. migration 017 not yet run),
          // fallback to direct insert so obligation payments proceed seamlessly
          if (
            (rpcErr?.message?.includes('لا يمكن تكرار المعاملة') || rpcErr?.message?.includes('duplicate')) &&
            input.obligationId
          ) {
            try {
              const { data: directPay, error: directErr } = await supabase
                .from('payments')
                .insert({
                  building_id: currentBuilding.id,
                  apartment_id: resident.apartment_id,
                  apartment_number: effectiveResidentApt,
                  resident_id: resident.id,
                  resident_name: resident.full_name || 'الساكن / المالك',
                  payment_category: category === 'other' ? 'monthly_dues' : category,
                  billing_month: normalizedMonth,
                  amount: input.amount,
                  payment_method: input.paymentMethod,
                  cash_recipient: input.cashRecipient || null,
                  receipt_image_url: input.receiptImageUrl || null,
                  reference_number: input.referenceNumber || '#IP-' + Math.floor(10000 + Math.random() * 90000),
                  notes: input.notes,
                  status: 'pending',
                })
                .select('id')
                .maybeSingle();

              if (directPay?.id) {
                serverPaymentId = directPay.id;
              } else if (directErr) {
                console.warn('Direct fallback insert payments error:', directErr);
              }
            } catch (fallbackErr) {
              console.warn('Fallback payments insert error:', fallbackErr);
            }
          } else {
            throw rpcErr;
          }
        }
      }

      const assignedPaymentId = serverPaymentId || ('pay-' + Date.now());
      const newPayment: Payment = {
        id: assignedPaymentId,
        building_id: currentBuilding.id,
        apartment_id: resident.apartment_id,
        apartment_number: effectiveResidentApt,
        resident_id: resident.id,
        resident_name: resident.full_name || 'الساكن / المالك',
        payment_category: category,
        emergency_claim_id: input.emergencyClaimId || null,
        billing_month: normalizedMonth,
        amount: input.amount,
        payment_method: input.paymentMethod,
        cash_recipient: input.cashRecipient || null,
        receipt_image_url: input.receiptImageUrl || null,
        reference_number:
          input.referenceNumber ||
          '#IP-' + Math.floor(10000 + Math.random() * 90000),
        notes:
          input.notes ||
          (input.paymentMethod === 'cash'
            ? `تسليم كاش لـ ${input.cashRecipient === 'admin' ? 'رئيس الاتحاد' : 'حارس العمارة'}`
            : 'تحويل إلكتروني / إنستاباي مرفق بالإيصال'),
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setPayments((prev) => [newPayment, ...prev]);

      // If paying a specific obligation, immediately mark it as 'pending' so it blurs and awaits admin review
      if (input.obligationId) {
        setApartmentObligations((prev) =>
          prev.map((o) =>
            o.id === input.obligationId ? { ...o, status: 'pending' as const } : o
          )
        );
        if (isSupabaseConfigured && isUuid(input.obligationId)) {
          supabase
            .from('apartment_obligations')
            .update({ status: 'pending' })
            .eq('id', input.obligationId)
            .then(() => {});
        }
      }

      // Update apartment status to pending review if regular monthly dues
      if (category === 'monthly_dues' && !input.isArrears && !input.obligationId) {
        setApartments((prev) =>
          prev.map((apt) =>
            apt.apartment_number === effectiveResidentApt
              ? { ...apt, payment_status: 'pending' }
              : apt
          )
        );
      }

      // Notification details
      let paymentTypeAr = '';
      if (input.obligationId) {
        paymentTypeAr = `سداد بند (${input.obligationTitle || 'التزام محدد'})`;
      } else if (input.isArrears) {
        paymentTypeAr = `سداد مديونية / متأخرات (${input.amount.toLocaleString()} ج.م)`;
      } else if (category === 'emergency_claim') {
        paymentTypeAr = 'مساهمة مطالبة صيانة طارئة';
      } else {
        paymentTypeAr = `اشتراك شهر (${normalizedMonth})`;
      }

      const methodAr =
        input.paymentMethod === 'electronic_transfer'
          ? 'تحويل إلكتروني مرفق بصورة الإيصال'
          : `سداد نقدي (كاش طرف ${input.cashRecipient === 'admin' ? 'رئيس الاتحاد' : 'حارس العمارة'})`;

      await pushAndRecordNotification({
        recipientId: usersByRole.admin.id,
        recipientRole: 'admin',
        recipientPushToken: usersByRole.admin.push_token,
        buildingId: currentBuilding.id,
        title: `إيصال سداد جديد — شقة ${effectiveResidentApt} 💳`,
        body: `قام (${resident.full_name || 'الساكن'}) برفع طلب ${paymentTypeAr} بقيمة ${input.amount.toLocaleString()} ج.م عبر (${methodAr}) بانتظار مراجعتك.`,
        category: 'financial',
        badgeLabel:
          category === 'emergency_claim'
            ? 'سداد طوارئ جديد'
            : input.isArrears || input.obligationId
            ? 'سداد مديونية'
            : 'إيصال للمراجعة',
        isUrgent: category === 'emergency_claim',
        metadata: {
          apartment_number: effectiveResidentApt,
          amount: input.amount,
          payment_id: newPayment.id,
          category,
          obligation_id: input.obligationId,
        },
      });
    },
    [
      currentUser.apartment_number,
      currentBuilding,
      payments,
      pushAndRecordNotification,
      usersByRole.admin,
      usersByRole.resident,
    ]
  );

  // 5. Scenario 2A (Approve): Admin approves resident payment ➔ Immediate Push Notification to Resident!
  const approveResidentPayment = useCallback(
    async (paymentId: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). لا يمكن اعتماد معاملات مالية قبل تجديد الاشتراك.'
        );
      }

      if (processingIds[paymentId]) {
        throw new Error('جاري معالجة هذا الطلب بالفعل...');
      }

      const targetPayment = payments.find((p) => p.id === paymentId);
      if (!targetPayment) {
        throw new Error('طلب السداد غير موجود.');
      }

      if (targetPayment.status !== 'pending') {
        throw new Error(
          `منع التكرار المزدوج (Idempotency): تمت معالجة هذا الطلب مسبقاً وحالته (${targetPayment.status}).`
        );
      }

      setProcessingIds((prev) => ({ ...prev, [paymentId]: true }));

      try {
        const isUuid = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        if (isSupabaseConfigured && isUuid(paymentId)) {
          try {
            await secureRpc.approveResidentPayment(paymentId);
          } catch (rpcErr: any) {
            console.warn('approveResidentPayment RPC warning:', rpcErr);
            // If the RPC threw because of column mismatch (e.g. payment_status on apartments), fallback to direct updates
            if (rpcErr?.message?.includes('payment_status') || rpcErr?.message?.includes('column')) {
              try {
                await supabase
                  .from('payments')
                  .update({
                    status: 'paid',
                    reviewed_by: usersByRole.admin.id,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq('id', paymentId);

                await supabase
                  .from('buildings')
                  .update({
                    fund_balance: currentBuilding.fund_balance + targetPayment.amount,
                  })
                  .eq('id', targetPayment.building_id);
              } catch (fallbackErr) {
                console.warn('Fallback direct approve error:', fallbackErr);
              }
            } else {
              throw rpcErr;
            }
          }
        }

        const effectiveAptNum =
          targetPayment.apartment_number ||
          apartments.find((a) => a.id === targetPayment.apartment_id)?.apartment_number ||
          '-';

        // 1. Update payment status to 'paid' and clean up matching in-flight duplicates
        setPayments((prev) =>
          prev.map((p) => {
            if (p.id === paymentId) {
              return {
                ...p,
                apartment_number: effectiveAptNum || p.apartment_number,
                status: 'paid',
                reviewed_by: usersByRole.admin.id,
                reviewed_at: new Date().toISOString(),
              };
            }
            const isSameApt =
              (p.apartment_number && effectiveAptNum && String(p.apartment_number).trim() === String(effectiveAptNum).trim()) ||
              (p.resident_id && targetPayment.resident_id && p.resident_id === targetPayment.resident_id);
            if (isSameApt && p.payment_category === targetPayment.payment_category) {
              if (
                targetPayment.payment_category === 'emergency_claim' &&
                p.emergency_claim_id === targetPayment.emergency_claim_id
              ) {
                return { ...p, status: 'paid' };
              }
              if (p.billing_month === targetPayment.billing_month && !p.notes?.includes('مديونية')) {
                return { ...p, status: 'paid' };
              }
            }
            return p;
          })
        );

        // 2. Increase building fund_balance atomically
        setBuildings((prev) =>
          prev.map((b) =>
            b.id === targetPayment.building_id
              ? { ...b, fund_balance: b.fund_balance + targetPayment.amount }
              : b
          )
        );

        // 3. Update apartment status or emergency claim progress bar
        if (
          targetPayment.payment_category === 'emergency_claim' &&
          targetPayment.emergency_claim_id
        ) {
          setEmergencyClaims((prev) =>
            prev.map((clm) => {
              if (clm.id !== targetPayment.emergency_claim_id) return clm;
              const nextCollected = clm.collected_amount + targetPayment.amount;
              return {
                ...clm,
                collected_amount: nextCollected,
                contributors_count: (clm.contributors_count || 0) + 1,
                status:
                  nextCollected >= clm.target_amount ? 'completed' : clm.status,
              };
            })
          );
        } else {
          // Check if this payment targets an obligation or arrears
          const notesStr = targetPayment.notes || '';
          const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
          const isArrears = notesStr.includes('مديونية') || Boolean(matchOblId);

          let updatedObligations = [...apartmentObligations];

          const aptTarget = apartments.find(
            (a) =>
              (a.apartment_number === effectiveAptNum || a.id === targetPayment.apartment_id) &&
              a.building_id === targetPayment.building_id
          );

          if (aptTarget) {
            // Find all unpaid or pending obligations for this apartment
            const aptUnpaidObls = updatedObligations.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === aptTarget.id) ||
                  (o.apartment_number &&
                    String(o.apartment_number).trim() === String(aptTarget.apartment_number).trim())) &&
                (o.status === 'unpaid' || o.status === 'pending')
            );

            let remainingPay = targetPayment.amount;
            const fullyPaidObligationIds: string[] = [];
            const partiallyUpdatedObligations: { id: string; newAmount: number; notes: string }[] = [];

            if (matchOblId) {
              // Option A: Specific obligation payment
              const matchedObl = aptUnpaidObls.find((o) => o.id === matchOblId);
              if (matchedObl) {
                if (remainingPay >= matchedObl.amount) {
                  fullyPaidObligationIds.push(matchedObl.id);
                  remainingPay -= matchedObl.amount;
                } else {
                  const newAmount = Math.max(0, matchedObl.amount - remainingPay);
                  const newNotes = (matchedObl.notes ? matchedObl.notes + ' • ' : '') + `[سداد جزئي: تم خصم ${remainingPay} ج.م - متبقي ${newAmount} ج.م]`;
                  partiallyUpdatedObligations.push({ id: matchedObl.id, newAmount, notes: newNotes });
                  remainingPay = 0;
                }
              }
            } else if (isArrears || targetPayment.payment_category === 'monthly_dues') {
              // Option B: General arrears or partial payment - settle FIFO on unpaid/pending obligations
              const eligibleObls = aptUnpaidObls.filter((o) => o.status === 'unpaid' || o.status === 'pending');
              for (const obl of eligibleObls) {
                if (remainingPay <= 0) break;
                if (remainingPay >= obl.amount) {
                  fullyPaidObligationIds.push(obl.id);
                  remainingPay -= obl.amount;
                } else {
                  const newAmount = Math.max(0, obl.amount - remainingPay);
                  const newNotes = (obl.notes ? obl.notes + ' • ' : '') + `[سداد جزئي: تم خصم ${remainingPay} ج.م - متبقي ${newAmount} ج.م]`;
                  partiallyUpdatedObligations.push({ id: obl.id, newAmount, notes: newNotes });
                  remainingPay = 0;
                  break;
                }
              }
            }

            if (fullyPaidObligationIds.length > 0 || partiallyUpdatedObligations.length > 0) {
              updatedObligations = updatedObligations.map((o) => {
                if (fullyPaidObligationIds.includes(o.id)) {
                  return { ...o, status: 'paid' as const };
                }
                const partial = partiallyUpdatedObligations.find((p) => p.id === o.id);
                if (partial) {
                  return { ...o, amount: partial.newAmount, notes: partial.notes, status: 'unpaid' as const };
                }
                return o;
              });
              setApartmentObligations(updatedObligations);

              // Update in Supabase
              if (isSupabaseConfigured) {
                for (const oblId of fullyPaidObligationIds) {
                  if (isUuid(oblId)) {
                    supabase
                      .from('apartment_obligations')
                      .update({ status: 'paid' })
                      .eq('id', oblId)
                      .then(() => {});
                  }
                }
                for (const partial of partiallyUpdatedObligations) {
                  if (isUuid(partial.id)) {
                    supabase
                      .from('apartment_obligations')
                      .update({ amount: partial.newAmount, notes: partial.notes, status: 'unpaid' })
                      .eq('id', partial.id)
                      .then(() => {});
                  }
                }
              }
            }

            // Recalculate remaining unpaid obligations and arrears
            const remainingAptUnpaid = updatedObligations.filter(
              (o) =>
                ((o.apartment_id && o.apartment_id === aptTarget.id) ||
                  (o.apartment_number &&
                    String(o.apartment_number).trim() === String(aptTarget.apartment_number).trim())) &&
                (o.status === 'unpaid' || o.status === 'pending')
            );

            const remainingOblsDebt = remainingAptUnpaid.reduce(
              (sum, o) => sum + (Number(o.amount) || 0),
              0
            );

            // Compute new arrears amount
            const oldArrears = Number(aptTarget.arrears_amount) || 0;
            const newArrears = Math.max(0, oldArrears - targetPayment.amount);
            const finalArrears = remainingAptUnpaid.length > 0 ? remainingOblsDebt : newArrears;
            const hasRemainingDebt = finalArrears > 0;
            const monthlyDueAmount = currentBuilding.default_monthly_dues || 400;
            const isMonthlyPaid = !isArrears && targetPayment.payment_category === 'monthly_dues' ? true : (aptTarget.payment_status === 'paid' && !hasRemainingDebt);
            const totalUnpaidWithMonthly = finalArrears + (isMonthlyPaid ? 0 : monthlyDueAmount);

            setApartments((prev) =>
              prev.map((apt) =>
                apt.id === aptTarget.id
                  ? {
                      ...apt,
                      arrears_amount: finalArrears,
                      unpaid_months_count: remainingAptUnpaid.filter((o) => o.category === 'monthly_dues').length,
                      unpaid_amount: totalUnpaidWithMonthly,
                      payment_status: hasRemainingDebt ? 'unpaid' : (isMonthlyPaid ? 'paid' : 'unpaid'),
                    }
                  : apt
              )
            );

            // Update apartment arrears in Supabase
            if (isSupabaseConfigured && isUuid(aptTarget.id)) {
              supabase
                .from('apartments')
                .update({ arrears_amount: finalArrears })
                .eq('id', aptTarget.id)
                .then(() => {});
            }
          } else {
            setApartments((prev) =>
              prev.map((apt) =>
                (apt.apartment_number === effectiveAptNum || apt.id === targetPayment.apartment_id) &&
                apt.building_id === targetPayment.building_id
                  ? {
                      ...apt,
                      payment_status: 'paid',
                      unpaid_months_count: 0,
                      unpaid_amount: 0,
                    }
                  : apt
              )
            );
          }
        }

        // Scenario 2A: Send immediate notification to Resident on approval
        const notesStr = targetPayment.notes || '';
        const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
        const matchOblTitle = notesStr.match(/\[سداد بند:\s*(.*?)\s*#/)?.[1];
        const isArrears = notesStr.includes('مديونية') || Boolean(matchOblId);

        const paymentDesc =
          targetPayment.payment_category === 'emergency_claim'
            ? 'مساهمة الصيانة الطارئة'
            : `اشتراك شهر (${targetPayment.billing_month})`;

        let notifTitle = `تم اعتماد سدادك بنجاح (شقة ${effectiveAptNum || 'المبنى'}) ✅`;
        let notifBody = `اعتمد رئيس الاتحاد دفعتك بقيمة ${targetPayment.amount.toLocaleString()} ج.م عن ${paymentDesc} وتمت إضافتها رسمياً لرصيد خزينة العمارة.`;

        if (matchOblId) {
          const oblTitle =
            matchOblTitle ||
            apartmentObligations.find((o) => o.id === matchOblId)?.title ||
            'البند المحدد';
          notifTitle = `تم اعتماد سداد البند (${oblTitle}) بنجاح ✅`;
          notifBody = `اعتمد رئيس الاتحاد سداد بند (${oblTitle}) بقيمة ${targetPayment.amount.toLocaleString()} ج.م وتمت تسويته وإلغاء مديونيته من شقتك.`;
        } else if (isArrears) {
          notifTitle = `تم اعتماد سداد المديونية بنجاح (شقة ${effectiveAptNum || 'المبنى'}) ✅`;
          notifBody = `اعتمد رئيس الاتحاد سداد مبلغ ${targetPayment.amount.toLocaleString()} ج.م من مديونية شقتك وتم تحديث سجل التزاماتك بنجاح.`;
        }

        await pushAndRecordNotification({
          recipientId: targetPayment.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: targetPayment.building_id,
          title: notifTitle,
          body: notifBody,
          category: 'financial',
          badgeLabel: 'اشتراك معتمد',
          isUrgent: false,
          metadata: {
            apartment_number: effectiveAptNum || undefined,
            amount: targetPayment.amount,
            payment_id: targetPayment.id,
            category: targetPayment.payment_category,
            obligation_id: matchOblId || undefined,
          },
        });

        // Trigger fresh sync from Supabase to keep state completely unified
        loadDataFromSupabase().catch(() => {});
      } finally {
        setProcessingIds((prev) => ({ ...prev, [paymentId]: false }));
      }
    },
    [
      apartmentObligations,
      apartments,
      isCurrentBuildingWritable,
      loadDataFromSupabase,
      payments,
      processingIds,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.push_token,
    ]
  );

  // 6. Scenario 2A (Reject): Admin rejects resident payment (with rejection reason!) ➔ Immediate Push Notification to Resident!
  const rejectResidentPayment = useCallback(
    async (paymentId: string, reason?: string) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }
      if (processingIds[paymentId]) return;

      const targetPayment = payments.find((p) => p.id === paymentId);
      if (!targetPayment || targetPayment.status !== 'pending') {
        throw new Error(
          'منع التكرار المزدوج: تمت معالجة طلب السداد هذا مسبقاً.'
        );
      }

      const finalReason =
        reason?.trim() || 'بيانات الإيصال غير واضحة أو لم يصل التحويل لحساب الاتحاد';

      setProcessingIds((prev) => ({ ...prev, [paymentId]: true }));
      try {
        const isValidUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            paymentId
          );

        if (isSupabaseConfigured && isValidUuid) {
          try {
            await secureRpc.rejectResidentPayment(paymentId, finalReason);
          } catch (rpcErr) {
            console.warn('rejectResidentPayment RPC warning:', rpcErr);
            throw rpcErr;
          }
        }

        const effectiveAptNum =
          targetPayment.apartment_number ||
          apartments.find((a) => a.id === targetPayment.apartment_id)?.apartment_number ||
          '-';

        const paymentDesc =
          targetPayment.payment_category === 'emergency_claim'
            ? 'مساهمة الصيانة الطارئة'
            : `اشتراك شهر (${targetPayment.billing_month || 'الاشتراك الشهري'})`;

        setPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  apartment_number: effectiveAptNum,
                  status: 'rejected',
                  reviewed_by: usersByRole.admin.id,
                  reviewed_at: new Date().toISOString(),
                  rejection_reason: finalReason,
                }
              : p
          )
        );

        setApartments((prev) =>
          prev.map((apt) =>
            (apt.apartment_number === effectiveAptNum || apt.id === targetPayment.apartment_id) &&
            apt.building_id === targetPayment.building_id
              ? { ...apt, payment_status: 'unpaid' }
              : apt
          )
        );

        // If this payment was for a specific obligation that was placed in 'pending', revert it to 'unpaid'
        const notesStr = targetPayment.notes || '';
        const matchOblId = notesStr.match(/#([a-zA-Z0-9_-]+)\]/)?.[1];
        const matchOblTitle = notesStr.match(/\[سداد بند:\s*(.*?)\s*#/)?.[1];

        if (matchOblId) {
          setApartmentObligations((prev) =>
            prev.map((o) => (o.id === matchOblId ? { ...o, status: 'unpaid' as const } : o))
          );
          if (isSupabaseConfigured && isUuid(matchOblId)) {
            supabase
              .from('apartment_obligations')
              .update({ status: 'unpaid' })
              .eq('id', matchOblId)
              .then(() => {});
          }
        }

        let rejectTitle = `تعذر اعتماد إيصال السداد (شقة ${effectiveAptNum}) ⚠️`;
        let rejectBody = `تم رفض طلب السداد بقيمة ${targetPayment.amount.toLocaleString()} ج.م عن ${paymentDesc}. سبب الرفض: "${finalReason}". يرجى إعادة المحاولة أو مراجعة رئيس الاتحاد.`;

        if (matchOblId) {
          const oblTitle =
            matchOblTitle ||
            apartmentObligations.find((o) => o.id === matchOblId)?.title ||
            'البند المحدد';
          rejectTitle = `تعذر اعتماد سداد بند (${oblTitle}) ⚠️`;
          rejectBody = `تم رفض طلب سداد بند (${oblTitle}) بقيمة ${targetPayment.amount.toLocaleString()} ج.م. سبب الرفض: "${finalReason}". تمت إعادة البند لمستحقات شقتك لتتمكن من إعادة سداده.`;
        }

        // Scenario 2A (Reject): Send immediate notification to Resident with rejection reason
        await pushAndRecordNotification({
          recipientId: targetPayment.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: targetPayment.building_id,
          title: rejectTitle,
          body: rejectBody,
          category: 'financial',
          badgeLabel: 'إيصال مرفوض',
          isUrgent: true,
          metadata: {
            apartment_number: effectiveAptNum,
            amount: targetPayment.amount,
            rejection_reason: finalReason,
            payment_id: targetPayment.id,
            category: targetPayment.payment_category,
            obligation_id: matchOblId || undefined,
          },
        });

        loadDataFromSupabase().catch(() => {});
      } finally {
        setProcessingIds((prev) => ({ ...prev, [paymentId]: false }));
      }
    },
    [
      apartmentObligations,
      apartments,
      isCurrentBuildingWritable,
      loadDataFromSupabase,
      payments,
      processingIds,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // 6B. Admin records direct cash payment for an apartment (emergency claim or monthly dues)
  const recordDirectCashPayment = useCallback(
    async (input: {
      apartmentId: string;
      apartmentNumber: string;
      residentId?: string | null;
      residentName?: string | null;
      amount: number;
      category: PaymentCategoryType;
      emergencyClaimId?: string | null;
      billingMonth: string;
      notes?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      const paymentId = 'pay-' + Date.now();
      const newPayment: Payment = {
        id: paymentId,
        building_id: currentBuilding.id,
        apartment_id: input.apartmentId,
        apartment_number: input.apartmentNumber,
        resident_id: input.residentId || null,
        resident_name: input.residentName || `شقة ${input.apartmentNumber}`,
        payment_category: input.category,
        emergency_claim_id: input.emergencyClaimId || null,
        billing_month: input.billingMonth,
        amount: input.amount,
        payment_method: 'cash',
        cash_recipient: 'admin',
        receipt_image_url: null,
        reference_number: '#CASH-' + Math.floor(10000 + Math.random() * 90000),
        notes: input.notes || 'سداد نقدي مباشر لرئيس الاتحاد',
        status: 'paid',
        reviewed_by: usersByRole.admin.id,
        reviewed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('payments').insert({
            building_id: currentBuilding.id,
            apartment_id: input.apartmentId,
            resident_id: input.residentId || null,
            payment_category: input.category,
            emergency_claim_id: input.emergencyClaimId || null,
            billing_month: input.billingMonth,
            amount: input.amount,
            payment_method: 'cash',
            cash_recipient: 'admin',
            notes: input.notes || 'سداد نقدي مباشر لرئيس الاتحاد',
            status: 'paid',
            reviewed_by: usersByRole.admin.id,
            reviewed_at: new Date().toISOString(),
          });
        } catch {
          // Graceful fallback
        }
      }

      setPayments((prev) => [newPayment, ...prev]);

      // Increase fund balance
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance + input.amount }
            : b
        )
      );

      // If emergency claim, update collected_amount and contributors_count
      if (input.category === 'emergency_claim' && input.emergencyClaimId) {
        setEmergencyClaims((prev) =>
          prev.map((clm) => {
            if (clm.id !== input.emergencyClaimId) return clm;
            const nextCollected = clm.collected_amount + input.amount;
            return {
              ...clm,
              collected_amount: nextCollected,
              contributors_count: (clm.contributors_count || 0) + 1,
              status:
                nextCollected >= clm.target_amount ? 'completed' : clm.status,
            };
          })
        );
      } else {
        setApartments((prev) =>
          prev.map((apt) =>
            apt.apartment_number === input.apartmentNumber &&
            apt.building_id === currentBuilding.id
              ? {
                  ...apt,
                  payment_status: 'paid',
                  unpaid_months_count: 0,
                  unpaid_amount: 0,
                }
              : apt
          )
        );
      }

      // If resident exists, send notification
      if (input.residentId) {
        await pushAndRecordNotification({
          recipientId: input.residentId,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: currentBuilding.id,
          title: `تم تسجيل سدادك النقدي بنجاح (شقة ${input.apartmentNumber}) 💵`,
          body: `سجّل رئيس الاتحاد استلام مبلغ ${input.amount.toLocaleString()} ج.م نقداً وأُضيفت لرصيد الخزينة.`,
          category: 'financial',
          badgeLabel: 'سداد نقدي',
          isUrgent: false,
          metadata: {
            apartment_number: input.apartmentNumber,
            amount: input.amount,
            payment_id: paymentId,
          },
        });
      }
    },
    [
      currentBuilding.id,
      isCurrentBuildingWritable,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.push_token,
    ]
  );

  // 7. Scenario 3: Bulk Reminder ("تذكير الكل") for all unpaid apartments in current month
  const sendBulkUnpaidReminder = useCallback(
    async (customMessage?: string) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (isSupabaseConfigured) {
        try {
          await secureRpc.sendBulkUnpaidReminder(currentMonth, customMessage);
        } catch {
          // Fallback to local state dispatch
        }
      }

      const unpaidApts = apartments.filter(
        (apt) =>
          apt.building_id === currentBuilding.id &&
          apt.is_active &&
          apt.payment_status === 'unpaid'
      );

      const aptNumbers = unpaidApts.map((a) => a.apartment_number);
      const count = aptNumbers.length;

      if (count === 0) {
        return { remindedCount: 0, apartments: [] };
      }

      const monthName = new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());

      const title = `تذكير بسداد اشتراك الصيانة (${monthName}) 🔔`;

      // Dispatch targeted notification for each unpaid apartment
      for (const apt of unpaidApts) {
        await pushAndRecordNotification({
          recipientId: apt.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: currentBuilding.id,
          title,
          body:
            customMessage?.trim() ||
            `مرحباً ساكن شقة (${apt.apartment_number})، نود تذكيركم بسداد اشتراك الصيانة لشهر ${monthName} بقيمة ${currentBuilding.default_monthly_dues} ج.م.`,
          category: 'financial',
          badgeLabel: `تذكير متأخرات (${apt.apartment_number})`,
          isUrgent: true,
          metadata: {
            apartment_number: apt.apartment_number,
            amount: currentBuilding.default_monthly_dues,
            billing_month: currentMonth,
            target_apartments: aptNumbers,
          },
        });
      }

      return {
        remindedCount: count,
        apartments: aptNumbers,
      };
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      currentBuilding.name,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  const sendIndividualUnpaidReminder = useCallback(
    async (apartmentNumber: string, customMessage?: string) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const targetApt = apartments.find(
        (a) =>
          a.building_id === currentBuilding.id &&
          String(a.apartment_number).trim() === String(apartmentNumber).trim()
      );

      const monthName = new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());

      const title = `تذكير بسداد اشتراك الصيانة (${monthName}) 🔔`;
      const body =
        customMessage?.trim() ||
        `مرحباً ساكن شقة (${apartmentNumber})، نود تذكيركم بلطف بسداد اشتراك الصيانة الشهري بقيمة ${currentBuilding.default_monthly_dues} ج.م لضمان انتظام خدمات ومرافق العمارة.`;

      await pushAndRecordNotification({
        recipientId: targetApt?.resident_id || usersByRole.resident.id,
        recipientRole: 'resident',
        recipientPushToken: usersByRole.resident.push_token,
        buildingId: currentBuilding.id,
        title,
        body,
        category: 'financial',
        badgeLabel: `تذكير متأخرات (شقة ${apartmentNumber})`,
        isUrgent: true,
        metadata: {
          apartment_number: apartmentNumber,
          amount: currentBuilding.default_monthly_dues,
          billing_month: currentMonth,
        },
      });
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // 8. Admin creates emergency claim
  const createEmergencyClaim = useCallback(
    async (input: {
      title: string;
      description: string;
      category: string;
      targetAmount: number;
      distributionType: ClaimDistributionType;
      dueDate?: string;
      defaultShareAmount?: number;
      distributionMode?: 'occupied_only' | 'all_units' | 'equal' | 'custom';
      customShares?: Array<{ apartment_id: string; amount: number }>;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }
      if (!currentBuilding.features_config.emergency_claims) {
        throw new Error(
          'ميزة المطالبات الطارئة غير مفعلة في باقة العمارة الحالية.'
        );
      }

      const occupiedApts = apartments.filter(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.is_active &&
          (Boolean(a.resident_id) ||
            (a.occupant_name &&
              a.occupant_name.trim() !== '' &&
              a.occupant_name !== 'وحدة شاغرة' &&
              a.occupant_name !== 'شاغرة'))
      );
      const isOccupiedOnly = input.distributionMode === 'occupied_only';
      const denominator = isOccupiedOnly
        ? Math.max(occupiedApts.length, 1)
        : Math.max(currentBuilding.total_apartments, 1);

      const shareAmount =
        input.defaultShareAmount ??
        Math.round((input.targetAmount / denominator) * 100) / 100;

      let serverClaimId: string | null = null;
      if (isSupabaseConfigured) {
        try {
          const rpcRes = await secureRpc.createEmergencyClaim({
            title: input.title,
            description: input.description,
            category: input.category,
            targetAmount: input.targetAmount,
            distributionType: input.distributionType,
            customShares: input.customShares,
            dueDate: input.dueDate,
            defaultShareAmount: shareAmount,
            occupiedOnly: isOccupiedOnly,
          });
          if (rpcRes?.data?.claim_id) {
            serverClaimId = String(rpcRes.data.claim_id);
          }
        } catch (rpcErr) {
          console.warn('createEmergencyClaim error:', rpcErr);
          throw rpcErr;
        }
      }

      const assignedClaimId = serverClaimId || ('clm-' + Date.now());
      const newClaim: EmergencyClaim = {
        id: assignedClaimId,
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        target_amount: input.targetAmount,
        collected_amount: 0,
        distribution_type: input.distributionType,
        default_share_amount: shareAmount,
        due_date: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'active',
        contributors_count: 0,
        created_at: new Date().toISOString(),
      };

      setEmergencyClaims((prev) => [newClaim, ...prev]);

      // Notify all residents of the new emergency claim
      await pushAndRecordNotification({
        recipientId: usersByRole.resident.id,
        recipientRole: 'resident',
        recipientPushToken: usersByRole.resident.push_token,
        buildingId: currentBuilding.id,
        title: `مطالبة صيانة طارئة جديدة: ${input.title.trim()} 🚨`,
        body: `تم إطلاق مطالبة طارئة بإجمالي ${input.targetAmount.toLocaleString()} ج.م (نصيب الوحدة: ${shareAmount.toLocaleString()} ج.م). يرجى المساهمة عبر التطبيق.`,
        category: 'maintenance',
        badgeLabel: 'طوارئ عاجلة',
        isUrgent: true,
        metadata: {
          amount: shareAmount,
        },
      });
    },
    [
      apartments,
      currentBuilding,
      isCurrentBuildingWritable,
      pushAndRecordNotification,
      usersByRole.admin.id,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  // 8B. Admin closes an emergency claim with a compressed official invoice
  const closeEmergencyClaimWithInvoice = useCallback(
    async (input: {
      claimId: string;
      invoiceImageUrl: string;
      actualAmount?: number;
      invoiceNumber?: string;
      notes?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). يرجى تجديد الاشتراك أولاً.'
        );
      }

      const targetClaim = emergencyClaims.find((c) => c.id === input.claimId);
      if (!targetClaim) {
        throw new Error('المطالبة الطارئة غير موجودة.');
      }

      const finalAmount =
        input.actualAmount && input.actualAmount > 0
          ? input.actualAmount
          : targetClaim.collected_amount || targetClaim.target_amount;

      if (isSupabaseConfigured) {
        try {
          await secureRpc.recordBuildingExpense({
            title: `إغلاق مطالبة طارئة: ${targetClaim.title}`,
            amount: finalAmount,
            category: targetClaim.category || 'صيانة ومصاعد',
            description:
              input.notes?.trim() ||
              `فاتورة إقفال المطالبة الاستثنائية (${targetClaim.title})`,
            invoiceImageUrl: input.invoiceImageUrl,
            invoiceNumber: input.invoiceNumber,
          });
        } catch {
          // Graceful fallback
        }
      }

      setEmergencyClaims((prev) =>
        prev.map((c) =>
          c.id === input.claimId ? { ...c, status: 'completed' } : c
        )
      );

      const closingExpense: Expense = {
        id: 'exp-clm-' + Date.now(),
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: `إغلاق مطالبة طارئة: ${targetClaim.title}`,
        description:
          input.notes?.trim() ||
          `فاتورة إقفال المطالبة الاستثنائية (${targetClaim.title})`,
        category: targetClaim.category || 'صيانة ومصاعد',
        amount: finalAmount,
        expense_date: new Date().toISOString().slice(0, 10),
        expense_month: new Date().toISOString().slice(0, 7),
        invoice_image_url: input.invoiceImageUrl,
        invoice_number:
          input.invoiceNumber?.trim() ||
          '#CLM-' + Math.floor(1000 + Math.random() * 9000),
        voucher_number: 'PC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
        is_system_generated: false,
        created_at: new Date().toISOString(),
      };

      setExpenses((prev) => [closingExpense, ...prev]);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance - finalAmount }
            : b
        )
      );
    },
    [
      currentBuilding.id,
      emergencyClaims,
      isCurrentBuildingWritable,
      usersByRole.admin.id,
    ]
  );

  // 9. Admin records building expense & deducts from fund_balance
  const recordBuildingExpense = useCallback(
    async (input: {
      title: string;
      amount: number;
      category: string;
      description?: string;
      invoiceImageUrl?: string;
      invoiceNumber?: string;
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error(
          'انتهى اشتراك العمارة (وضع القراءة فقط Read-Only). لا يمكن إضافة مصروفات جديدة قبل تجديد الاشتراك.'
        );
      }

      if (isSupabaseConfigured) {
        try {
          await secureRpc.recordBuildingExpense(input);
        } catch {
          // Graceful fallback
        }
      }

      const newExpense: Expense = {
        id: 'exp-' + Date.now(),
        building_id: currentBuilding.id,
        created_by: usersByRole.admin.id,
        title: input.title.trim(),
        description:
          input.description?.trim() || 'قيد مصروف معتمد من مجلس الاتحاد',
        category: input.category,
        amount: input.amount,
        expense_date: new Date().toISOString().slice(0, 10),
        expense_month: new Date().toISOString().slice(0, 7),
        invoice_image_url:
          input.invoiceImageUrl ||
          'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        invoice_number:
          input.invoiceNumber ||
          '#INV-' + Math.floor(1000 + Math.random() * 9000),
        voucher_number: 'PC-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
        is_system_generated: false,
        created_at: new Date().toISOString(),
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === currentBuilding.id
            ? { ...b, fund_balance: b.fund_balance - input.amount }
            : b
        )
      );
    },
    [currentBuilding.id, isCurrentBuildingWritable, usersByRole.admin.id]
  );

  // 10. Admin adds new apartment unit (with pre-registered occupant_name, occupant_phone & initial arrears)
  const addApartmentUnit = useCallback(
    async (input: {
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
    }) => {
      if (!isCurrentBuildingWritable) {
        throw new Error('انتهى اشتراك العمارة (وضع القراءة فقط Read-Only).');
      }

      // 1. Prevent duplicate apartment numbers in the same building
      const existingUnit = apartments.find(
        (a) =>
          a.building_id === currentBuilding.id &&
          a.apartment_number.trim() === input.apartmentNumber.trim()
      );
      if (existingUnit) {
        throw new Error(`شقة رقم (${input.apartmentNumber.trim()}) مسجلة بالفعل في هذا العقار.`);
      }

      const plan = plans.find((p) => p.code === currentBuilding.plan_code);
      const maxUnits =
        currentBuilding.max_apartments_override ??
        plan?.max_apartments ??
        30;

      const currentBuildingUnits = apartments.filter(
        (a) => a.building_id === currentBuilding.id && a.is_active
      );
      if (currentBuildingUnits.length >= maxUnits) {
        throw new Error(
          `تم الوصول للحد الأقصى للشقق المسموح به في باقة العمارة (${maxUnits} شقة).`
        );
      }

      const newUnitId = 'apt-' + Date.now();
      const initialArrears =
        input.arrearsAmount !== undefined && input.arrearsAmount >= 0
          ? input.arrearsAmount
          : currentBuilding.default_monthly_dues;
      const occupantNameTrimmed = input.residentName?.trim() || null;
      const occupantPhoneTrimmed = input.residentPhone?.trim() || null;

      const newUnit: Apartment = {
        id: newUnitId,
        building_id: currentBuilding.id,
        apartment_number: input.apartmentNumber.trim(),
        floor_number: input.floorNumber.trim(),
        wing_or_direction: input.wingOrDirection.trim() || 'واجهة',
        area_sqm: input.areaSqm || 150,
        ownership_share_percent: Number(
          (100 / Math.max(currentBuilding.total_apartments, 1)).toFixed(2)
        ),
        occupant_name: occupantNameTrimmed,
        occupant_phone: occupantPhoneTrimmed,
        arrears_amount: initialArrears,
        resident_id: null,
        resident_name: occupantNameTrimmed
          ? `${occupantNameTrimmed} (مسجل مبدئياً)`
          : 'وحدة شاغرة (بانتظار التسجيل)',
        resident_phone: occupantPhoneTrimmed || '',
        payment_status: initialArrears > 0 ? 'unpaid' : 'paid',
        unpaid_months_count: initialArrears > 0 ? 1 : 0,
        unpaid_amount: initialArrears,
        invite_code: `${currentBuilding.building_code}-${input.apartmentNumber.trim()}`,
        is_active: true,
      };

      setApartments((prev) => [newUnit, ...prev]);

      let createdDbId = newUnitId;
      const isValidUuid = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (isSupabaseConfigured && currentBuilding.id) {
        try {
          const { data: dbApt, error: insertErr } = await supabase
            .from('apartments')
            .insert({
              building_id: currentBuilding.id,
              apartment_number: input.apartmentNumber.trim(),
              floor_number: input.floorNumber.trim(),
              wing_or_direction: input.wingOrDirection.trim() || 'واجهة',
              area_sqm: input.areaSqm || 150,
              ownership_share_percent: newUnit.ownership_share_percent,
              occupant_name: occupantNameTrimmed,
              occupant_phone: occupantPhoneTrimmed,
              arrears_amount: initialArrears,
              invite_code: newUnit.invite_code,
              is_active: true,
            })
            .select()
            .maybeSingle();

          if (insertErr) {
            setApartments((prev) => prev.filter((a) => a.id !== newUnitId));
            throw new Error(insertErr.message || 'تعذر إضافة الشقة في قاعدة البيانات.');
          }

          if (dbApt?.id) {
            createdDbId = dbApt.id;
            setApartments((prev) =>
              prev.map((a) => (a.id === newUnitId ? { ...a, id: dbApt.id } : a))
            );
          }
        } catch (err: any) {
          setApartments((prev) => prev.filter((a) => a.id !== newUnitId));
          throw err;
        }
      }

      // Handle staged obligations atomically with the created apartment
      if (input.stagedObligations && input.stagedObligations.length > 0) {
        for (const obl of input.stagedObligations) {
          const billingMonth = `${obl.year}-${String(obl.month).padStart(2, '0')}`;
          const newObl: ApartmentObligation = {
            id: 'obl-' + Math.random().toString(36).substr(2, 9),
            building_id: currentBuilding.id,
            apartment_id: createdDbId,
            apartment_number: input.apartmentNumber.trim(),
            title: obl.title.trim(),
            category: obl.type === 'monthly_dues' ? 'monthly_dues' : 'other',
            billing_month: billingMonth,
            amount: obl.amount,
            status: 'unpaid',
            notes: obl.notes || `قيد مديونية مسجل عند تأسيس شقة (${input.apartmentNumber.trim()})`,
            created_at: new Date().toISOString(),
          };
          setApartmentObligations((prev) => [newObl, ...prev]);

          if (isSupabaseConfigured && currentBuilding.id && isValidUuid(createdDbId)) {
            try {
              const { data: dbObl } = await supabase.from('apartment_obligations').insert({
                building_id: currentBuilding.id,
                apartment_id: createdDbId,
                title: newObl.title,
                category: newObl.category,
                billing_month: newObl.billing_month,
                amount: newObl.amount,
                status: 'unpaid',
                notes: newObl.notes,
                created_by: usersByRole.admin.id && isValidUuid(usersByRole.admin.id) ? usersByRole.admin.id : null,
              }).select('id').maybeSingle();

              if (dbObl?.id) {
                setApartmentObligations((prev) =>
                  prev.map((o) => (o.id === newObl.id ? { ...o, id: dbObl.id } : o))
                );
              }
            } catch (e) {
              console.warn('Supabase insert staged obligation error:', e);
            }
          }
        }
      } else if (initialArrears > 0) {
        const initObligation: ApartmentObligation = {
          id: 'obl-' + Date.now(),
          building_id: currentBuilding.id,
          apartment_id: createdDbId,
          apartment_number: input.apartmentNumber.trim(),
          title: 'رصيد متأخرات / اشتراك مبدئي مسجل من الإدارة',
          category: 'monthly_dues',
          billing_month: new Date().toISOString().slice(0, 7),
          amount: initialArrears,
          status: 'unpaid',
          notes: occupantNameTrimmed
            ? `مسجل مبدئياً باسم: ${occupantNameTrimmed}`
            : 'قيد مبدئي عند تأسيس الوحدة',
          created_at: new Date().toISOString(),
        };
        setApartmentObligations((prev) => [initObligation, ...prev]);

        if (isSupabaseConfigured && currentBuilding.id) {
          try {
            await supabase.from('apartment_obligations').insert({
              building_id: currentBuilding.id,
              apartment_id: createdDbId,
              title: initObligation.title,
              category: 'monthly_dues',
              billing_month: initObligation.billing_month,
              amount: initialArrears,
              status: 'unpaid',
              notes: initObligation.notes,
            });
          } catch (e) {
            console.warn('Supabase add obligation error:', e);
          }
        }
      }

      return { id: createdDbId, apartmentNumber: input.apartmentNumber.trim() };
    },
    [apartments, currentBuilding, isCurrentBuildingWritable, plans]
  );

  const updateApartmentUnit = useCallback(
    async (
      apartmentId: string,
      updates: {
        apartmentNumber?: string;
        floorNumber?: string;
        wingOrDirection?: string;
        areaSqm?: number;
        residentName?: string;
        residentPhone?: string;
      }
    ) => {
      setApartments((prev) =>
        prev.map((apt) => {
          if (apt.id !== apartmentId && (updates.apartmentNumber && apt.apartment_number !== updates.apartmentNumber)) {
            return apt;
          }
          const occName =
            updates.residentName !== undefined
              ? updates.residentName.trim() || null
              : apt.occupant_name;
          const occPhone =
            updates.residentPhone !== undefined
              ? updates.residentPhone.trim() || null
              : apt.occupant_phone;
          const aptNum =
            updates.apartmentNumber !== undefined
              ? updates.apartmentNumber.trim()
              : apt.apartment_number;
          return {
            ...apt,
            apartment_number: aptNum,
            floor_number:
              updates.floorNumber !== undefined
                ? updates.floorNumber.trim()
                : apt.floor_number,
            wing_or_direction:
              updates.wingOrDirection !== undefined
                ? updates.wingOrDirection.trim()
                : apt.wing_or_direction,
            area_sqm:
              updates.areaSqm !== undefined ? updates.areaSqm : apt.area_sqm,
            occupant_name: occName,
            occupant_phone: occPhone,
            resident_name: occName
              ? `${occName} (مسجل مبدئياً)`
              : 'وحدة شاغرة (بانتظار التسجيل)',
            resident_phone: occPhone || '',
            invite_code: `${currentBuilding.building_code}-${aptNum}`,
          };
        })
      );

      if (isSupabaseConfigured) {
        try {
          const updatePayload: Record<string, any> = {};
          if (updates.apartmentNumber !== undefined) updatePayload.apartment_number = updates.apartmentNumber.trim();
          if (updates.floorNumber !== undefined) updatePayload.floor_number = updates.floorNumber.trim();
          if (updates.wingOrDirection !== undefined) updatePayload.wing_or_direction = updates.wingOrDirection.trim();
          if (updates.areaSqm !== undefined) updatePayload.area_sqm = updates.areaSqm;
          if (updates.residentName !== undefined) {
            updatePayload.occupant_name = updates.residentName.trim() || null;
          }
          if (updates.residentPhone !== undefined) {
            updatePayload.occupant_phone = updates.residentPhone.trim() || null;
          }

          if (Object.keys(updatePayload).length > 0) {
            await supabase
              .from('apartments')
              .update(updatePayload)
              .eq('id', apartmentId);
          }
        } catch (err) {
          console.warn('Supabase updateApartmentUnit error:', err);
        }
      }
    },
    [currentBuilding.building_code]
  );

  const deleteApartmentUnit = useCallback(async (apartmentId: string) => {
    setApartments((prev) => prev.filter((a) => a.id !== apartmentId));
    setApartmentObligations((prev) =>
      prev.filter((o) => o.apartment_id !== apartmentId)
    );

    if (isSupabaseConfigured) {
      try {
        await supabase.from('apartments').delete().eq('id', apartmentId);
      } catch (err) {
        console.warn('Supabase deleteApartmentUnit error:', err);
      }
    }
  }, []);

  // 11. Admin submits app subscription invoice
  const submitAppSubscriptionInvoice = useCallback(
    async (input: {
      planCode: PlanTier;
      durationMonths: number;
      receiptImageUrl: string;
      notes?: string;
    }) => {
      if (isSupabaseConfigured) {
        try {
          await secureRpc.submitAppSubscriptionInvoice(input);
        } catch {
          // Graceful fallback
        }
      }

      const plan = plans.find((p) => p.code === input.planCode);
      const monthlyPrice =
        currentBuilding.custom_monthly_price ??
        plan?.default_monthly_price ??
        150;
      const totalAmount = monthlyPrice * Math.max(input.durationMonths, 1);

      const newInvoice: AppSubscriptionInvoice = {
        id: 'sub-inv-' + Date.now(),
        building_id: currentBuilding.id,
        building_name: currentBuilding.name,
        building_code: currentBuilding.building_code,
        submitted_by: usersByRole.admin.id,
        admin_name: usersByRole.admin.full_name,
        plan_code: input.planCode,
        amount: totalAmount,
        duration_months: input.durationMonths,
        receipt_image_url: input.receiptImageUrl,
        notes: input.notes || 'إيصال تحويل قيمة اشتراك باقة العمارة',
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      setSubscriptionInvoices((prev) => [newInvoice, ...prev]);
    },
    [currentBuilding, plans, usersByRole.admin]
  );

  // 12. Super Admin activates building subscription
  const activateBuildingSubscription = useCallback(
    async (invoiceId: string) => {
      if (currentRole !== 'super_admin') {
        throw new Error(
          'Security Violation: تفعيل الاشتراكات متاح حصرياً لمالك التطبيق (super_admin).'
        );
      }

      if (processingIds[invoiceId]) {
        throw new Error('جاري تفعيل هذا الاشتراك بالفعل...');
      }

      const targetInvoice = subscriptionInvoices.find(
        (inv) => inv.id === invoiceId
      );
      if (!targetInvoice) {
        throw new Error('فاتورة الاشتراك غير موجودة.');
      }

      if (targetInvoice.status !== 'pending') {
        throw new Error(
          `منع التكرار المزدوج (Idempotency): تم تفعيل هذه الفاتورة مسبقاً (${targetInvoice.status}).`
        );
      }

      setProcessingIds((prev) => ({ ...prev, [invoiceId]: true }));

      try {
        if (isSupabaseConfigured) {
          try {
            await secureRpc.activateBuildingSubscription(invoiceId);
          } catch {
            // Graceful fallback
          }
        }

        // 1. Mark invoice as approved
        setSubscriptionInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  status: 'approved',
                  activated_by: usersByRole.super_admin.id,
                  activated_at: new Date().toISOString(),
                }
              : inv
          )
        );

        // 2. Extend building subscription AND deduct invoice amount from fund_balance
        const extendedDate = new Date(
          Date.now() + targetInvoice.duration_months * 30 * 86400000
        ).toISOString();

        setBuildings((prev) =>
          prev.map((b) =>
            b.id === targetInvoice.building_id
              ? {
                  ...b,
                  plan_code: targetInvoice.plan_code,
                  subscription_status: 'active',
                  subscription_ends_at: extendedDate,
                  fund_balance: b.fund_balance - targetInvoice.amount,
                }
              : b
          )
        );

        // 3. Automatically insert transparency expense: "رسوم اشتراك تطبيق إدارة العقار"
        const autoExpense: Expense = {
          id: 'exp-sub-' + Date.now(),
          building_id: targetInvoice.building_id,
          created_by: targetInvoice.submitted_by,
          title: 'رسوم اشتراك تطبيق إدارة العقار',
          description: `تفعيل باقة (${targetInvoice.plan_code.toUpperCase()}) لمدة (${targetInvoice.duration_months}) شهر - قيد آلي معتمد من إدارة المنصة`,
          category: 'اشتراكات وخدمات رقمية',
          amount: targetInvoice.amount,
          expense_date: new Date().toISOString().slice(0, 10),
          expense_month: new Date().toISOString().slice(0, 7),
          invoice_image_url: targetInvoice.receipt_image_url,
          invoice_number: 'SUB-' + targetInvoice.id.slice(-6).toUpperCase(),
          voucher_number: 'AUTO-SUB-' + Math.floor(100 + Math.random() * 900),
          is_system_generated: true,
          app_subscription_invoice_id: targetInvoice.id,
          created_at: new Date().toISOString(),
        };

        setExpenses((prev) => [autoExpense, ...prev]);

        // Notify Building Admin
        await pushAndRecordNotification({
          recipientId: targetInvoice.submitted_by,
          recipientRole: 'admin',
          recipientPushToken: usersByRole.admin.push_token,
          buildingId: targetInvoice.building_id,
          title: `تم تفعيل باقة (${targetInvoice.building_name}) بنجاح 🎉`,
          body: `تم تمديد اشتراك العمارة وإدراج مصروف "رسوم اشتراك تطبيق إدارة العقار" بقيمة ${targetInvoice.amount} ج.م تلقائياً في سجل الشفافية.`,
          category: 'financial',
          badgeLabel: 'تفعيل الباقة',
          isUrgent: false,
        });
      } finally {
        setProcessingIds((prev) => ({ ...prev, [invoiceId]: false }));
      }
    },
    [
      currentRole,
      processingIds,
      pushAndRecordNotification,
      subscriptionInvoices,
      usersByRole.admin.push_token,
      usersByRole.super_admin.id,
    ]
  );

  // 13. Super Admin configures per-building custom price, apartment limit & feature flags
  const superAdminConfigureBuilding = useCallback(
    async (input: {
      buildingId: string;
      planCode?: PlanTier;
      customMonthlyPrice?: number | null;
      maxApartmentsOverride?: number | null;
      featuresConfig?: Partial<FeaturesConfig>;
      subscriptionStatus?: BuildingSubscriptionStatus;
    }) => {
      if (currentRole !== 'super_admin') {
        throw new Error('Unauthorized: Super Admin role required.');
      }

      if (isSupabaseConfigured) {
        try {
          await secureRpc.superAdminConfigureBuilding(input);
        } catch {
          // Graceful fallback
        }
      }

      setBuildings((prev) =>
        prev.map((b) => {
          if (b.id !== input.buildingId) return b;
          return {
            ...b,
            plan_code: input.planCode ?? b.plan_code,
            custom_monthly_price:
              input.customMonthlyPrice !== undefined
                ? input.customMonthlyPrice
                : b.custom_monthly_price,
            max_apartments_override:
              input.maxApartmentsOverride !== undefined
                ? input.maxApartmentsOverride
                : b.max_apartments_override,
            features_config: input.featuresConfig
              ? { ...b.features_config, ...input.featuresConfig }
              : b.features_config,
            subscription_status:
              input.subscriptionStatus ?? b.subscription_status,
          };
        })
      );
    },
    [currentRole]
  );

  // 14. Super Admin updates global plan templates (free, pro, plus)
  const superAdminUpdatePlanTemplate = useCallback(
    (code: PlanTier, updates: Partial<SubscriptionPlan>) => {
      setPlans((prev) =>
        prev.map((plan) => (plan.code === code ? { ...plan, ...updates } : plan))
      );
    },
    []
  );

  // 15. Create Building Issue / Complaint (Resident or Admin)
  const createBuildingIssue = useCallback(
    async (input: {
      title: string;
      description?: string;
      category: string;
      severity?: IssueSeverity;
      imageUrl?: string | null;
      isPrivate?: boolean;
      preferredTime?: string;
      whatsappNotifications?: boolean;
    }) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const bId = currentBuilding.id || user.building_id;
      if (!bId) {
        throw new Error('لم يتم تحديد عقار أو عمارة سكنية بعد.');
      }

      const tempIssue: BuildingIssue = {
        id: 'issue-' + Date.now(),
        building_id: bId,
        created_by: user.id,
        apartment_id: user.apartment_id,
        apartment_number: user.apartment_number || '1',
        reporter_name: user.full_name || (currentRole === 'admin' ? 'رئيس الاتحاد' : 'الساكن'),
        title: input.title.trim(),
        description: input.description?.trim(),
        category: input.category || 'المصعد',
        severity: input.severity || 'medium',
        image_url: input.imageUrl || null,
        is_private: input.isPrivate || false,
        upvotes_count: 0,
        status: 'open',
        preferred_time: input.preferredTime || 'any',
        whatsapp_notifications: input.whatsappNotifications ?? true,
        has_upvoted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setBuildingIssues((prev) => [tempIssue, ...prev]);

      if (isSupabaseConfigured) {
        try {
          await ensureSupabaseSession();
          const rpcRes = await secureRpc.createBuildingIssue({
            buildingId: bId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            category: input.category || 'المصعد',
            severity: input.severity || 'medium',
            imageUrl: input.imageUrl || null,
            isPrivate: input.isPrivate || false,
            preferredTime: input.preferredTime || 'any',
            whatsappNotifications: input.whatsappNotifications ?? true,
          });

          if (!rpcRes.data && rpcRes.error) {
            await supabase.from('building_issues').insert({
              building_id: bId,
              created_by: user.id,
              apartment_id: user.apartment_id,
              apartment_number: user.apartment_number || '1',
              reporter_name: user.full_name || 'الساكن',
              title: input.title.trim(),
              description: input.description?.trim() || null,
              category: input.category || 'المصعد',
              severity: input.severity || 'medium',
              image_url: input.imageUrl || null,
              is_private: input.isPrivate || false,
              preferred_time: input.preferredTime || 'any',
              whatsapp_notifications: input.whatsappNotifications ?? true,
              status: 'open',
            });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('createBuildingIssue cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  // 16. Toggle Issue Upvote (صوت تأييد واحد لكل شقة)
  const toggleIssueUpvote = useCallback(
    async (issueId: string) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const aptNum = user.apartment_number || '1';
      const aptId = user.apartment_id || user.id;

      // Optimistic update
      setBuildingIssues((prev) =>
        prev.map((iss) => {
          if (iss.id !== issueId) return iss;
          const isNowUpvoted = !iss.has_upvoted;
          return {
            ...iss,
            has_upvoted: isNowUpvoted,
            upvotes_count: isNowUpvoted
              ? iss.upvotes_count + 1
              : Math.max(0, iss.upvotes_count - 1),
          };
        })
      );

      if (isSupabaseConfigured) {
        try {
          await ensureSupabaseSession();
          const rpcRes = await secureRpc.toggleIssueUpvote(issueId);

          if (!rpcRes.data && rpcRes.error) {
            const { data: existing } = await supabase
              .from('issue_upvotes')
              .select('id')
              .eq('issue_id', issueId)
              .or(`apartment_id.eq.${aptId},user_id.eq.${user.id}`)
              .maybeSingle();

            if (existing) {
              await supabase.from('issue_upvotes').delete().eq('id', existing.id);
            } else {
              await supabase.from('issue_upvotes').insert({
                issue_id: issueId,
                building_id: currentBuilding.id || user.building_id,
                apartment_id: aptId,
                apartment_number: aptNum,
                user_id: user.id,
              });
            }
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('toggleIssueUpvote cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  // 17. Update Issue Status (Admin only: open -> in_progress -> resolved)
  const updateIssueStatus = useCallback(
    async (issueId: string, status: IssueStatus) => {
      setBuildingIssues((prev) =>
        prev.map((iss) => {
          if (iss.id !== issueId) return iss;
          return {
            ...iss,
            status,
            resolved_at: status === 'resolved' ? new Date().toISOString() : null,
          };
        })
      );

      if (isSupabaseConfigured) {
        try {
          await ensureSupabaseSession();
          const rpcRes = await secureRpc.updateIssueStatus(issueId, status);

          if (!rpcRes.data && rpcRes.error) {
            await supabase
              .from('building_issues')
              .update({
                status,
                resolved_at: status === 'resolved' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', issueId);
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('updateIssueStatus cloud err:', e);
        }
      }
    },
    [loadDataFromSupabase]
  );

  // 18. Create Building Poll / Collective Decision (Admin only)
  const createBuildingPoll = useCallback(
    async (input: {
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
    }) => {
      const bId = currentBuilding.id || usersByRole.admin.building_id;
      if (!bId) throw new Error('لم يتم تحديد عقار أو عمارة سكنية بعد.');

      const opts: PollOption[] =
        input.options && input.options.length > 0
          ? input.options
          : [
              { id: 'approve', title: 'موافق على القرار المقترح' },
              { id: 'reject', title: 'رافض أو متحفظ على البند' },
              { id: 'abstain', title: 'ممتنع عن التصويت' },
            ];

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + (input.durationDays || 7));

      const tempPoll: Poll = {
        id: 'poll-' + Date.now(),
        building_id: bId,
        created_by: usersByRole.admin.id,
        session_code: '#24-DEC-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        title: input.title.trim(),
        description: input.description?.trim(),
        category: input.category || 'عام',
        estimated_cost: input.estimatedCost || 0,
        share_per_unit: input.sharePerUnit || 0,
        document_url: input.documentUrl,
        quorum_percent: input.quorumPercent || 51,
        voting_basis: 'ownership_share',
        ends_at: endsAt.toISOString(),
        status: 'active',
        options: opts,
        votes_count: 0,
        is_urgent: input.isUrgent || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setPolls((prev) => [tempPoll, ...prev]);

      if (isSupabaseConfigured) {
        try {
          await ensureSupabaseSession();
          const rpcRes = await secureRpc.createBuildingPoll({
            buildingId: bId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            category: input.category || 'عام',
            estimatedCost: input.estimatedCost || 0,
            sharePerUnit: input.sharePerUnit || 0,
            quorumPercent: input.quorumPercent || 51,
            durationDays: input.durationDays || 7,
            options: opts,
            documentUrl: input.documentUrl || null,
            isUrgent: input.isUrgent || false,
          });

          if (!rpcRes.data && rpcRes.error) {
            await supabase.from('polls').insert({
              building_id: bId,
              created_by: usersByRole.admin.id,
              session_code: tempPoll.session_code,
              title: input.title.trim(),
              description: input.description?.trim() || null,
              category: input.category || 'عام',
              estimated_cost: input.estimatedCost || 0,
              share_per_unit: input.sharePerUnit || 0,
              quorum_percent: input.quorumPercent || 51,
              ends_at: endsAt.toISOString(),
              options: opts,
              document_url: input.documentUrl || null,
              is_urgent: input.isUrgent || false,
              status: 'active',
            });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('createBuildingPoll cloud err:', e);
        }
      }
    },
    [currentBuilding.id, loadDataFromSupabase, usersByRole.admin]
  );

  // 19. Cast Poll Vote (1 vote per apartment unit)
  const castPollVote = useCallback(
    async (pollId: string, choice: string) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const aptNum = user.apartment_number || '1';
      const aptId = user.apartment_id || user.id;

      const newVote: PollVote = {
        id: 'vote-' + Date.now(),
        poll_id: pollId,
        building_id: currentBuilding.id || user.building_id || '',
        apartment_id: aptId,
        apartment_number: aptNum,
        voter_id: user.id,
        voter_name: user.full_name || 'الساكن',
        choice,
        weight_percent: 6.25,
        created_at: new Date().toISOString(),
      };

      setPollVotes((prev) => {
        const filtered = prev.filter(
          (v) =>
            !(
              v.poll_id === pollId &&
              (v.apartment_id === aptId || v.apartment_number === aptNum)
            )
        );
        return [newVote, ...filtered];
      });

      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== pollId) return p;
          const wasVoted = Boolean(p.user_voted_choice);
          return {
            ...p,
            user_voted_choice: choice,
            votes_count: wasVoted ? p.votes_count : (p.votes_count || 0) + 1,
          };
        })
      );

      if (isSupabaseConfigured) {
        try {
          await ensureSupabaseSession();
          const rpcRes = await secureRpc.castPollVote(pollId, choice);

          if (!rpcRes.data && rpcRes.error) {
            await supabase.from('poll_votes').upsert(
              {
                poll_id: pollId,
                building_id: currentBuilding.id || user.building_id,
                apartment_id: aptId,
                apartment_number: aptNum,
                voter_id: user.id,
                voter_name: user.full_name || 'الساكن',
                choice,
              },
              { onConflict: 'poll_id,apartment_id' }
            );
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('castPollVote cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  const resetBuildingData = useCallback(
    async (mode: 'residents_only' | 'full_delete') => {
      if (!currentBuilding?.id) {
        throw new Error('لا توجد عمارة محددة حالياً لتنفيذ العملية عليها');
      }
      const buildingId = currentBuilding.id;

      if (isSupabaseConfigured) {
        const { data, error } = await secureRpc.resetBuildingData(buildingId, mode);
        if (error) {
          throw new Error(error.message || 'فشلت عملية إعادة تهيئة البيانات');
        }
        if (data && typeof data === 'object' && (data as any).success === false) {
          throw new Error((data as any).error || 'فشلت عملية إعادة تهيئة البيانات');
        }
      }

      // Clear local storage pending caches
      await AsyncStorage.removeItem('@ittihad_local_pending_resident').catch(() => {});
      await AsyncStorage.removeItem('@ittihad_approved_resident').catch(() => {});
      await AsyncStorage.removeItem('@ittihad_reviewed_residents').catch(() => {});
      reviewedResidentKeysRef.current = {};
      localPendingResidentRef.current = null;
      lastApprovedResidentRef.current = null;

      if (mode === 'residents_only') {
        // Clear all resident and transaction state in memory
        setApartments([]);
        setApartmentObligations([]);
        setPayments([]);
        setExpenses([]);
        setEmergencyClaims([]);
        setPendingResidents([]);
        setBuildingIssues([]);
        setPolls([]);
        setPollVotes([]);
        setIssueUpvotes([]);
        setBuildings((prev) =>
          prev.map((b) => (b.id === buildingId ? { ...b, fund_balance: 0 } : b))
        );
        await loadDataFromSupabase();
      } else {
        // Full delete: cascade delete building, logout, reset to onboarding
        await logout();
        setBuildings((prev) => prev.filter((b) => b.id !== buildingId));
        setApartments([]);
        setApartmentObligations([]);
        setPayments([]);
        setExpenses([]);
        setEmergencyClaims([]);
        setPendingResidents([]);
        setBuildingIssues([]);
        setPolls([]);
        setPollVotes([]);
        setIssueUpvotes([]);
      }
    },
    [currentBuilding.id, loadDataFromSupabase, logout]
  );

  return (
    <AppContext.Provider
      value={{
        currentRole,
        currentUser,
        isAuthenticated,
        switchRole,
        setAuthenticated,
        login,
        signup,
        logout,
        plans,
        buildings,
        currentBuilding,
        apartments,
        apartmentObligations,
        pendingResidents,
        payments,
        emergencyClaims,
        expenses,
        subscriptionInvoices,
        expoPushToken,
        notifications,
        currentRoleNotifications,
        unreadNotificationsCount,
        activeBannerNotification,
        dismissBannerNotification,
        markAllNotificationsAsRead,
        markNotificationAsRead,
        sendBulkUnpaidReminder,
        sendIndividualUnpaidReminder,
        processingIds,
        isCurrentBuildingWritable,
        refreshData: loadDataFromSupabase,
        createBuildingForAdmin,
        requestJoinBuilding,
        reviewResidentJoinRequest,
        transferApartmentObligations,
        addApartmentObligation,
        settleApartmentObligation,
        deleteApartmentObligation,
        updateApartmentObligation,
        submitResidentPayment,
        approveResidentPayment,
        rejectResidentPayment,
        recordDirectCashPayment,
        createEmergencyClaim,
        closeEmergencyClaimWithInvoice,
        recordBuildingExpense,
        addApartmentUnit,
        updateApartmentUnit,
        deleteApartmentUnit,
        submitAppSubscriptionInvoice,
        activateBuildingSubscription,
        superAdminConfigureBuilding,
        superAdminUpdatePlanTemplate,
        buildingIssues,
        polls,
        pollVotes,
        issueUpvotes,
        createBuildingIssue,
        toggleIssueUpvote,
        updateIssueStatus,
        createBuildingPoll,
        castPollVote,
        resetBuildingData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return ctx;
};
