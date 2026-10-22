import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import type {
  Apartment,
  ApartmentObligation,
  AppNotification,
  AppSubscriptionInvoice,
  Building,
  BuildingIssue,
  EmergencyClaim,
  Expense,
  IssueUpvote,
  Payment,
  PaymentStatusType,
  Poll,
  PollVote,
  SubscriptionPlan,
  UserProfile,
  UserRole,
} from '@/shared/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRemoteBackendEnabled } from '@/data/backend';
import {
  dispatchPushNotification,
  registerAndSavePushTokenAsync,
  subscribeToNativeNotifications,
} from '@/modules/notifications/infrastructure/notificationService';
import type { AppContextType, ReviewedResidentEntry } from './AppContext.types';
import {
  INITIAL_PLANS,
  DEFAULT_EMPTY_BUILDING,
  INITIAL_BUILDINGS,
  INITIAL_USERS,
  INITIAL_PENDING_RESIDENTS,
  INITIAL_APARTMENTS,
  INITIAL_APARTMENT_OBLIGATIONS,
  INITIAL_PAYMENTS,
  INITIAL_EMERGENCY_CLAIMS,
  INITIAL_EXPENSES,
  INITIAL_SUBSCRIPTION_INVOICES,
  INITIAL_NOTIFICATIONS,
} from './initialState';
import { useNotificationActions } from '@/modules/notifications/application/useNotificationActions';
import { useAuthActions } from '@/modules/auth/application/useAuthActions';
import { useOnboardingActions } from '@/modules/auth/application/useOnboardingActions';
import { useJoinRequestActions } from '@/modules/units/application/useJoinRequestActions';
import { useObligationActions } from '@/modules/units/application/useObligationActions';
import { useUnitActions } from '@/modules/units/application/useUnitActions';
import { usePaymentActions } from '@/modules/payments/application/usePaymentActions';
import { useReminderActions } from '@/modules/payments/application/useReminderActions';
import { useEmergencyActions } from '@/modules/emergency/application/useEmergencyActions';
import { useExpenseActions } from '@/modules/expenses/application/useExpenseActions';
import { useSubscriptionActions } from '@/modules/platform/application/useSubscriptionActions';
import { useBuildingResetActions } from '@/modules/platform/application/useBuildingResetActions';
import { useCommunityActions } from '@/modules/community/application/useCommunityActions';
import { repositories } from '@/data/repositories';
import type { RepoResult } from '@/data/result';

// One list call per table in the live snapshot, keyed by the table name realtime reports.
const snapshotFetchers = {
  buildings: () => repositories.platform.listBuildings(),
  apartments: (buildingId?: string) => repositories.units.listApartments(buildingId),
  apartment_obligations: (buildingId?: string) => repositories.units.listObligations(buildingId),
  payments: (buildingId?: string) => repositories.payments.list(buildingId),
  emergency_claims: (buildingId?: string) => repositories.emergency.listClaims(buildingId),
  expenses: (buildingId?: string) => repositories.expenses.list(buildingId),
  notifications: (buildingId?: string) => repositories.notifications.list(buildingId),
  users: (buildingId?: string) => repositories.auth.listUserProfiles(buildingId),
  subscription_plans: () => repositories.platform.listPlans(),
  building_issues: (buildingId?: string) => repositories.community.listIssues(buildingId),
  issue_upvotes: (buildingId?: string) => repositories.community.listUpvotes(buildingId),
  polls: (buildingId?: string) => repositories.community.listPolls(buildingId),
  poll_votes: (buildingId?: string) => repositories.community.listVotes(buildingId),
};
type SnapshotTable = keyof typeof snapshotFetchers;
const SNAPSHOT_TABLES = Object.keys(snapshotFetchers) as SnapshotTable[];



// ============================================================================
// Context Interface
// ============================================================================


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

  // Set/Map of reviewed residents to shield approved residents against being overwritten by server reloads
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
    if (isRemoteBackendEnabled) {
      repositories.auth.getSessionUser().then((sessionUser) => {
        const sessionUserId = sessionUser?.id;
        if (sessionUserId) {
          repositories.auth
            .getUserProfile(sessionUserId)
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

  // Last fetched result per table, so a realtime change refetches only its own table
  const snapshotRef = useRef<{
    buildingId?: string;
    results: Partial<Record<SnapshotTable, RepoResult<any>>>;
  }>({ results: {} });

  // Load live data from the backend. Stable on purpose: it reads current state through latestRef,
  // because listing state as deps recreated it on every load and re-ran the effects that call it.
  // `tables` refetches just those tables; without it (or on a building switch) everything is refetched.
  const loadDataFromSupabase = useCallback(async (tables?: SnapshotTable[]) => {
    if (!isRemoteBackendEnabled) return;

    try {
      // Ensure we are signed into the active building session so RLS never hides claims, expenses, payments, or users
      await repositories.auth.ensureSession();

      const { payments, apartmentObligations, currentRole, usersByRole, currentBuilding } = latestRef.current;
      const buildingId =
        (currentRole !== 'super_admin' && usersByRole[currentRole].building_id) || undefined;

      const snapshot = snapshotRef.current;
      const toFetch =
        Array.isArray(tables) && snapshot.buildingId === buildingId && snapshot.results.buildings
          ? tables
          : SNAPSHOT_TABLES;
      const fetched = await Promise.all(toFetch.map((t) => snapshotFetchers[t](buildingId)));
      toFetch.forEach((t, i) => {
        snapshot.results[t] = fetched[i];
      });
      snapshot.buildingId = buildingId;

      const {
        buildings: bRes,
        apartments: aRes,
        apartment_obligations: oRes,
        payments: pRes,
        emergency_claims: cRes,
        expenses: eRes,
        notifications: nRes,
        users: uRes,
        subscription_plans: sRes,
        building_issues: issuesRes,
        issue_upvotes: upvotesRes,
        polls: pollsRes,
        poll_votes: votesRes,
      } = snapshot.results as Record<SnapshotTable, RepoResult<any>>;

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
      const primaryBuilding = bList.find((b) => b.id === buildingId) || bList[0];

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
        const sessionUser = await repositories.auth.getSessionUser();
        const activeAuthUid = sessionUser?.id;
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
  }, []);

  // Full snapshot on mount and whenever the signed-in identity or its building changes
  const scopeBuildingId = currentRole === 'super_admin' ? '' : currentUser.building_id || '';
  useEffect(() => {
    loadDataFromSupabase();
  }, [loadDataFromSupabase, currentRole, currentUser.id, scopeBuildingId]);

  // Subscribe once to realtime changes; each change refetches only its own table
  useEffect(() => {
    if (!isRemoteBackendEnabled) return;

    const unsubscribeRealtime = repositories.realtime.subscribe([
      {
        table: 'notifications',
        onChange: (payload) => {
          loadDataFromSupabase(['notifications']);
          const { currentRole, usersByRole } = latestRef.current;
          if (payload.type === 'INSERT' && payload.record) {
            const notif = payload.record as AppNotification;
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
                const myApt = usersByRole[currentRole].apartment_number || usersByRole.resident.apartment_number;
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
        },
      },
      {
        table: 'users',
        onChange: (payload) => {
          loadDataFromSupabase(['users']);
          const { currentRole, usersByRole } = latestRef.current;
          if (payload.type === 'INSERT' && payload.record) {
            const newUser = payload.record as UserProfile;
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
          } else if (payload.type === 'UPDATE' && payload.record) {
            const updatedUser = payload.record as UserProfile;
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
        },
      },
      {
        table: 'payments',
        onChange: (payload) => {
          loadDataFromSupabase(['payments']);
          const { currentRole, usersByRole } = latestRef.current;
          if (payload.type === 'INSERT' && payload.record) {
            const p = payload.record as any;
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
        },
      },
      {
        table: 'apartments',
        onChange: () => {
          loadDataFromSupabase(['apartments']);
        },
      },
      {
        table: 'apartment_obligations',
        onChange: (payload) => {
          loadDataFromSupabase(['apartment_obligations']);
          const { currentRole, usersByRole } = latestRef.current;
          if (payload.type === 'INSERT' && payload.record) {
            const newObl = payload.record as any;
            const myAptId = usersByRole.resident.apartment_id;
            const myAptNum = usersByRole.resident.apartment_number;
            const isForMyApt =
              (myAptId && newObl.apartment_id === myAptId) ||
              (myAptNum && newObl.apartment_number && String(newObl.apartment_number).trim() === String(myAptNum).trim()) ||
              (latestRef.current.apartments.find((a) => a.id === newObl.apartment_id)?.apartment_number === myAptNum);

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
        },
      },
      {
        table: 'building_issues',
        onChange: () => {
          loadDataFromSupabase(['building_issues']);
        },
      },
      {
        table: 'issue_upvotes',
        onChange: () => {
          loadDataFromSupabase(['issue_upvotes']);
        },
      },
      {
        table: 'polls',
        onChange: () => {
          loadDataFromSupabase(['polls']);
        },
      },
      {
        table: 'poll_votes',
        onChange: () => {
          loadDataFromSupabase(['poll_votes']);
        },
      },
    ]);

    return unsubscribeRealtime;
  }, [loadDataFromSupabase]);

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

      if (isRemoteBackendEnabled) {
        repositories.notifications.insert({
            building_id:
              params.buildingId ?? currentUser.building_id ?? 'bld-amal-001',
            recipient_id: params.recipientId || null,
            recipient_role: params.recipientRole,
            title: params.title,
            body: params.body,
            category: params.category,
            metadata: params.metadata || {},
          }).then(({ error }) => {
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

  const currentBuilding = useMemo(() => {
    return (
      buildings.find((b) => b.id === currentUser.building_id) ||
      buildings[0] ||
      DEFAULT_EMPTY_BUILDING
    );
  }, [buildings, currentUser.building_id]);

  // Latest render values for the stable loader and the realtime handlers
  const latestRef = useRef({ payments, apartmentObligations, apartments, usersByRole, currentRole, currentBuilding });
  latestRef.current = { payments, apartmentObligations, apartments, usersByRole, currentRole, currentBuilding };

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

  // Domain actions live in their modules; the provider only owns state.
  const {
    dismissBannerNotification,
    markAllNotificationsAsRead,
    markNotificationAsRead,
  } = useNotificationActions({
    setActiveBannerNotification,
    currentRoleNotifications,
    setNotifications,
  });
  const {
    switchRole,
    login,
    signup,
    logout,
  } = useAuthActions({
    setCurrentRole,
    setNotifications,
    usersByRole,
    setActiveBannerNotification,
    setAuthenticated,
    setUsersByRole,
    loadDataFromSupabase,
  });
  const {
    createBuildingForAdmin,
    requestJoinBuilding,
  } = useOnboardingActions({
    usersByRole,
    setBuildings,
    setApartments,
    setApartmentObligations,
    setPayments,
    setExpenses,
    setEmergencyClaims,
    setPendingResidents,
    setBuildingIssues,
    setPolls,
    setPollVotes,
    setIssueUpvotes,
    localPendingResidentRef,
    lastApprovedResidentRef,
    reviewedResidentKeysRef,
    setReviewedResidentKeys,
    setUsersByRole,
    setCurrentRole,
    setAuthenticated,
    loadDataFromSupabase,
    buildings,
    expoPushToken,
    pushAndRecordNotification,
    currentBuilding,
  });
  const {
    reviewResidentJoinRequest,
  } = useJoinRequestActions({
    isCurrentBuildingWritable,
    processingIds,
    setProcessingIds,
    pendingResidents,
    localPendingResidentRef,
    apartments,
    currentBuilding,
    reviewedResidentKeysRef,
    setReviewedResidentKeys,
    usersByRole,
    lastApprovedResidentRef,
    setPendingResidents,
    setUsersByRole,
    setApartments,
    pushAndRecordNotification,
  });
  const {
    transferApartmentObligations,
    addApartmentObligation,
    settleApartmentObligation,
    deleteApartmentObligation,
    updateApartmentObligation,
  } = useObligationActions({
    isCurrentBuildingWritable,
    apartments,
    apartmentObligations,
    setApartmentObligations,
    setApartments,
    currentBuilding,
    usersByRole,
    loadDataFromSupabase,
  });
  const {
    addApartmentUnit,
    updateApartmentUnit,
    deleteApartmentUnit,
  } = useUnitActions({
    isCurrentBuildingWritable,
    apartments,
    currentBuilding,
    plans,
    setApartments,
    setApartmentObligations,
    usersByRole,
  });
  const {
    submitResidentPayment,
    approveResidentPayment,
    rejectResidentPayment,
    recordDirectCashPayment,
  } = usePaymentActions({
    currentBuilding,
    usersByRole,
    currentUser,
    payments,
    setPayments,
    setApartmentObligations,
    setApartments,
    pushAndRecordNotification,
    isCurrentBuildingWritable,
    processingIds,
    setProcessingIds,
    apartments,
    setBuildings,
    setEmergencyClaims,
    apartmentObligations,
    loadDataFromSupabase,
  });
  const {
    sendBulkUnpaidReminder,
    sendIndividualUnpaidReminder,
  } = useReminderActions({
    apartments,
    currentBuilding,
    pushAndRecordNotification,
    usersByRole,
  });
  const {
    createEmergencyClaim,
    closeEmergencyClaimWithInvoice,
  } = useEmergencyActions({
    isCurrentBuildingWritable,
    currentBuilding,
    apartments,
    usersByRole,
    setEmergencyClaims,
    pushAndRecordNotification,
    emergencyClaims,
    setExpenses,
    setBuildings,
  });
  const {
    recordBuildingExpense,
  } = useExpenseActions({
    isCurrentBuildingWritable,
    currentBuilding,
    usersByRole,
    setExpenses,
    setBuildings,
  });
  const {
    submitAppSubscriptionInvoice,
    activateBuildingSubscription,
    superAdminConfigureBuilding,
    superAdminUpdatePlanTemplate,
  } = useSubscriptionActions({
    plans,
    currentBuilding,
    usersByRole,
    setSubscriptionInvoices,
    currentRole,
    processingIds,
    subscriptionInvoices,
    setProcessingIds,
    setBuildings,
    setExpenses,
    pushAndRecordNotification,
    setPlans,
  });
  const {
    resetBuildingData,
  } = useBuildingResetActions({
    currentBuilding,
    reviewedResidentKeysRef,
    localPendingResidentRef,
    lastApprovedResidentRef,
    setApartments,
    setApartmentObligations,
    setPayments,
    setExpenses,
    setEmergencyClaims,
    setPendingResidents,
    setBuildingIssues,
    setPolls,
    setPollVotes,
    setIssueUpvotes,
    setBuildings,
    loadDataFromSupabase,
    logout,
  });
  const {
    createBuildingIssue,
    toggleIssueUpvote,
    updateIssueStatus,
    createBuildingPoll,
    castPollVote,
  } = useCommunityActions({
    currentRole,
    usersByRole,
    currentBuilding,
    setBuildingIssues,
    loadDataFromSupabase,
    setPolls,
    setPollVotes,
  });

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
