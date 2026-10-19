import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { isSupabaseConfigured, secureRpc, supabase } from '../../lib/supabase';
import { copyToClipboard, sendWhatsAppInvite } from '../../utils/inviteHelper';
import { Apartment, Building } from '../../types/database';

export type AuthScreenMode =
  | 'login'
  | 'signup'
  | 'admin_register'
  | 'resident_select'
  | 'welcome_success'
  | 'created_success';

/**
 * Authentication & Onboarding Flow (Track 1)
 * Faithfully implementing all 6 screens from Developer Handover Specs v2.4:
 * - Screen 1: AUTH_LOGIN (design/_12)
 * - Screen 2: AUTH_SIGNUP (design/_26)
 * - Screen 3: ADMIN_REGISTER (design/_30)
 * - Screen 4: RESIDENT_SELECT (design/_6 & _15)
 * - Screen 5: INVITE_LANDING (design/302)
 * - Screen 6: WELCOME_SUCCESS (design/_25)
 *
 * All backend RPCs, Supabase lookup, data matching, and session management are 100% preserved.
 */
export const AuthAndOnboardingScreen: React.FC<{ onClose?: () => void }> = ({
  onClose,
}) => {
  const {
    currentUser,
    currentRole,
    buildings,
    apartments,
    createBuildingForAdmin,
    requestJoinBuilding,
    switchRole,
    setAuthenticated,
    login,
    signup,
  } = useAppStore();

  const [mode, setMode] = useState<AuthScreenMode>('login');
  const [selectedRoleTab, setSelectedRoleTab] = useState<'resident' | 'admin'>('resident');

  // Login Form State (Screen 1: AUTH_LOGIN - _12)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up Form State (Screen 2: AUTH_SIGNUP - _26)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Resident Join / Select State (Screen 4: RESIDENT_SELECT - _6 / _15)
  const [buildingCode, setBuildingCode] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [residentRoleType, setResidentRoleType] = useState<'مالك مقيم' | 'مستأجر'>('مالك مقيم');
  const [dismissedAptMatch, setDismissedAptMatch] = useState(false);
  const [isInviteCodeAutoMatched, setIsInviteCodeAutoMatched] = useState(false);
  const [matchedAptDetail, setMatchedAptDetail] = useState<{
    apartmentNumber: string;
    occupantName?: string | null;
    occupantPhone?: string | null;
    floorNumber?: string | null;
  } | null>(null);

  // Resident Account Credentials (Password x2) & Arrears Transfer
  const [residentPassword, setResidentPassword] = useState('');
  const [residentConfirmPassword, setResidentConfirmPassword] = useState('');
  const [showResidentPassword, setShowResidentPassword] = useState(false);
  const [acceptArrearsTransfer, setAcceptArrearsTransfer] = useState(true);
  const [showAllApartments, setShowAllApartments] = useState(false);

  // Admin Register & Building Setup (Screen 3: ADMIN_REGISTER - _30)
  const [buildingName, setBuildingName] = useState('برج الأمل السكني');
  const [buildingAddress, setBuildingAddress] = useState('التجمع الخامس - النرجس عمارات ٨٤');
  const [totalApartments, setTotalApartments] = useState('16');
  const [defaultMonthlyDues, setDefaultMonthlyDues] = useState('400');
  const [adminApartment, setAdminApartment] = useState('12');
  const [treasuryAccount, setTreasuryAccount] = useState('elamal.tower@instapay');
  const [legalDeclaration, setLegalDeclaration] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [createdBuildingCode, setCreatedBuildingCode] = useState<string | null>(null);
  const [justSubmittedJoin, setJustSubmittedJoin] = useState(false);

  // Remote building and apartment lookup from Supabase for live cross-device verification
  const [remoteBuilding, setRemoteBuilding] = useState<Building | null>(null);
  const [remoteApts, setRemoteApts] = useState<Apartment[]>([]);

  // Robust code parser for any building/apartment invite code
  // Handles: BLD-B627B5-12, BLD-B627B5-13, BLD-B627B5-14, BLD-B627B5, AMAL-302-JOIN
  const parsedCodeInfo = useMemo(() => {
    const raw = buildingCode.trim().toUpperCase();
    if (!raw) return { buildingPrefix: '', apartmentNum: '' };

    const parts = raw.split('-');
    let buildingPrefix = raw;
    let apartmentNum = '';

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        apartmentNum = lastPart;
        buildingPrefix = parts.slice(0, parts.length - 1).join('-');
      } else {
        const numIdx = parts.findIndex((p) => /^\d+$/.test(p));
        if (numIdx !== -1) {
          apartmentNum = parts[numIdx];
          buildingPrefix = parts.slice(0, numIdx).join('-');
        }
      }
    } else if (/^\d+$/.test(raw)) {
      apartmentNum = raw;
    }

    return { buildingPrefix, apartmentNum };
  }, [buildingCode]);

  // Reactively sync apartmentNumber whenever an explicit apartment code is typed
  useEffect(() => {
    if (parsedCodeInfo.apartmentNum) {
      const aptNum = parsedCodeInfo.apartmentNum;
      setApartmentNumber(aptNum);
      setIsInviteCodeAutoMatched(true);
      setShowAllApartments(false);

      // Reactively sync floor and occupant details if known from loaded apartments
      const aptList = remoteApts.length > 0 ? remoteApts : apartments;
      const matchedApt = aptList.find((a) => a.apartment_number === aptNum);
      if (matchedApt) {
        if (matchedApt.floor_number) setFloorNumber(matchedApt.floor_number);
        const occName =
          matchedApt.occupant_name ||
          (matchedApt.resident_name &&
          matchedApt.resident_name !== 'وحدة شاغرة' &&
          matchedApt.resident_name !== 'مشغول'
            ? matchedApt.resident_name
            : '');
        if (occName) setFullName(occName);
        if (matchedApt.resident_phone || matchedApt.occupant_phone) {
          setPhone(matchedApt.resident_phone || matchedApt.occupant_phone || '');
        }
      } else if (/^\d+$/.test(aptNum)) {
        setFloorNumber(
          aptNum.length >= 2 ? `الدور ${aptNum.slice(0, -1)}` : 'الدور الأول'
        );
      }
    }
  }, [parsedCodeInfo.apartmentNum, remoteApts, apartments]);

  // Calculate live projected monthly treasury collection (Screen 30)
  const projectedMonthlyTreasury = useMemo(() => {
    const count = parseInt(totalApartments, 10) || 0;
    const due = parseFloat(defaultMonthlyDues) || 0;
    return (count * due).toLocaleString('en-US');
  }, [totalApartments, defaultMonthlyDues]);

  // Lookup target building
  useEffect(() => {
    let isMounted = true;
    const fetchBuilding = async () => {
      const raw = buildingCode.trim().toUpperCase();
      const code = parsedCodeInfo.buildingPrefix || raw;
      const explicitAptNum = parsedCodeInfo.apartmentNum;

      if (code.length >= 4 && isSupabaseConfigured) {
        try {
          let { data: rpcData } = await supabase.rpc(
            'lookup_building_apartments_for_join',
            { p_building_code: code }
          );

          if (!rpcData?.building_id && raw !== code) {
            const fallbackRpc = await supabase.rpc(
              'lookup_building_apartments_for_join',
              { p_building_code: raw }
            );
            if (fallbackRpc.data?.building_id) {
              rpcData = fallbackRpc.data;
            }
          }

          if (!isMounted) return;

          if (rpcData && rpcData.building_id) {
            const mappedBuilding: Building = {
              id: rpcData.building_id,
              name: rpcData.building_name,
              address: rpcData.building_name,
              city: 'القاهرة',
              building_code: rpcData.building_code,
              admin_id: '',
              fund_balance: 0,
              default_monthly_dues: 350,
              total_apartments: rpcData.apartments?.length || 16,
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

            const { data: fullBld } = await supabase
              .from('buildings')
              .select('*')
              .ilike('building_code', code)
              .maybeSingle();

            if (isMounted) {
              setRemoteBuilding(fullBld ? (fullBld as Building) : mappedBuilding);

              if (rpcData.apartments && rpcData.apartments.length > 0) {
                const mappedApts: Apartment[] = rpcData.apartments.map((a: any) => ({
                  id: a.id,
                  building_id: rpcData.building_id,
                  apartment_number: a.apartment_number,
                  floor_number: a.floor_number || 'الدور الأول',
                  wing_or_direction: a.wing_or_direction || 'واجهة',
                  area_sqm: 150,
                  ownership_share_percent: 10,
                  monthly_dues_override: null,
                  resident_name: a.occupant_name || (a.is_occupied ? 'مشغول' : 'وحدة شاغرة'),
                  resident_phone: a.occupant_phone || '',
                  occupant_name: a.occupant_name,
                  occupant_phone: a.occupant_phone || null,
                  resident_id: a.is_occupied ? 'occupied' : null,
                  invite_code: `${rpcData.building_code}-${a.apartment_number}`,
                  payment_status: 'paid',
                  unpaid_months_count: 0,
                  unpaid_amount: a.arrears_amount || 0,
                  arrears_amount: a.arrears_amount || 0,
                  is_active: true,
                }));
                setRemoteApts(mappedApts);

                const targetAptNum = explicitAptNum || rpcData.suggested_apartment_number;
                if (targetAptNum) {
                  const matchedApt = mappedApts.find((a) => a.apartment_number === targetAptNum);
                  const resolvedName =
                    matchedApt?.occupant_name ||
                    rpcData.suggested_occupant_name ||
                    (matchedApt?.resident_name &&
                    matchedApt.resident_name !== 'وحدة شاغرة' &&
                    matchedApt.resident_name !== 'مشغول'
                      ? matchedApt.resident_name
                      : '');
                  const resolvedPhone =
                    matchedApt?.occupant_phone ||
                    rpcData.suggested_occupant_phone ||
                    matchedApt?.resident_phone ||
                    '';
                  const resolvedFloor =
                    matchedApt?.floor_number ||
                    rpcData.suggested_floor_number ||
                    (targetAptNum && /^\d+$/.test(targetAptNum)
                      ? targetAptNum.length >= 2
                        ? `الدور ${targetAptNum.slice(0, -1)}`
                        : 'الدور الأول'
                      : '');

                  setApartmentNumber(targetAptNum);
                  if (resolvedName) setFullName(resolvedName);
                  if (resolvedPhone) setPhone(resolvedPhone);
                  if (resolvedFloor) setFloorNumber(resolvedFloor);
                  setIsInviteCodeAutoMatched(true);
                  setMatchedAptDetail({
                    apartmentNumber: targetAptNum,
                    occupantName: resolvedName || null,
                    occupantPhone: resolvedPhone || null,
                    floorNumber: resolvedFloor || null,
                  });
                }
              }
            }
            return;
          }

          // Fallback direct table query
          const { data } = await supabase
            .from('buildings')
            .select('*')
            .ilike('building_code', code)
            .maybeSingle();

          if (isMounted && data) {
            setRemoteBuilding(data as Building);
            const { data: aptsData } = await supabase
              .from('apartments')
              .select('*')
              .eq('building_id', data.id);
            if (isMounted && aptsData) {
              setRemoteApts(aptsData as Apartment[]);
            }
          }
        } catch {
          // ignore lookup errors
        }
      }
    };

    fetchBuilding();
    return () => {
      isMounted = false;
    };
  }, [buildingCode]);

  // Combined matched building
  const matchedBuilding = useMemo(() => {
    const raw = buildingCode.trim().toUpperCase();
    if (!raw) return null;
    const prefix = parsedCodeInfo.buildingPrefix || raw;

    return (
      buildings.find(
        (b) =>
          b.building_code.toUpperCase() === prefix ||
          b.building_code.toUpperCase() === raw
      ) ||
      (remoteBuilding &&
      (remoteBuilding.building_code.toUpperCase() === prefix ||
        remoteBuilding.building_code.toUpperCase() === raw)
        ? remoteBuilding
        : null)
    );
  }, [buildingCode, parsedCodeInfo.buildingPrefix, buildings, remoteBuilding]);

  // Default units grid simulation if building is verified
  const displayedApartmentGrid = useMemo(() => {
    let allApts: any[] = [];
    if (remoteApts.length > 0) {
      allApts = remoteApts;
    } else if (matchedBuilding) {
      const bldApts = apartments.filter((a) => a.building_id === matchedBuilding.id);
      if (bldApts.length > 0) allApts = bldApts;
    }

    if (allApts.length === 0) {
      const count = matchedBuilding?.total_apartments || 16;
      allApts = Array.from({ length: count }, (_, i) => {
        const numStr = String(i + 1);
        return {
          id: 'apt-' + numStr,
          apartment_number: numStr,
          floor_number: `الدور ${Math.floor(i / 4) + 1}`,
          is_occupied: false,
          resident_name: '',
        };
      });
    }

    // If an apartment number is specified in the code AND user hasn't chosen to show all:
    // Only return that specific apartment! ("يجيبلي شقتي بس")
    if (parsedCodeInfo.apartmentNum && !showAllApartments) {
      const targetNum = parsedCodeInfo.apartmentNum;
      const filtered = allApts.filter((a) => a.apartment_number === targetNum);
      if (filtered.length > 0) {
        return filtered;
      }
      return [
        {
          id: 'apt-' + targetNum,
          apartment_number: targetNum,
          floor_number:
            targetNum.length >= 2
              ? `الدور ${targetNum.slice(0, -1)}`
              : 'الدور الأول',
          is_occupied: false,
          resident_name: '',
        },
      ];
    }

    return allApts;
  }, [
    remoteApts,
    apartments,
    matchedBuilding,
    parsedCodeInfo.apartmentNum,
    showAllApartments,
  ]);

  // Selected Apartment Live Details & Arrears calculation
  const selectedApartmentData = useMemo(() => {
    if (!apartmentNumber.trim()) return null;
    const target = apartmentNumber.trim();
    return (
      remoteApts.find((a) => a.apartment_number === target) ||
      apartments.find(
        (a) =>
          a.apartment_number === target &&
          (!matchedBuilding || a.building_id === matchedBuilding.id)
      ) ||
      null
    );
  }, [apartmentNumber, remoteApts, apartments, matchedBuilding]);

  const selectedAptArrears = useMemo(() => {
    if (!selectedApartmentData) return 0;
    return (
      selectedApartmentData.arrears_amount ||
      selectedApartmentData.unpaid_amount ||
      0
    );
  }, [selectedApartmentData]);

  // Handle Login (Screen 1: AUTH_LOGIN)
  const handleLoginSubmit = async () => {
    const rawEmail = loginIdentifier.trim();
    const rawPassword = loginPassword.trim();
    if (!rawEmail || !rawPassword) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (rawPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    setSubmitting(true);
    try {
      await login(rawEmail, rawPassword);
      onClose?.();
    } catch (err: any) {
      Alert.alert('خطأ في تسجيل الدخول', err?.message || 'تعذر تسجيل الدخول.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Signup Submit (Screen 2: AUTH_SIGNUP)
  const handleSignupNext = () => {
    if (!fullName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال الاسم بالكامل.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('تنبيه', 'يرجى إدخال بريد إلكتروني صالح.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الهاتف.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    if (selectedRoleTab === 'resident') {
      setMode('resident_select');
      return;
    }
    setMode('admin_register');
  };

  // Handle Admin Register Submit (Screen 3: ADMIN_REGISTER)
  const handleAdminRegisterSubmit = async () => {
    if (!buildingName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم العقار أو البرج السكني.');
      return;
    }
    if (!legalDeclaration) {
      Alert.alert('تنبيه', 'يرجى الإقرار بصحة البيانات ومسؤولية إدارة العقار للمتابعة.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBuildingForAdmin({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: signupPassword,
        buildingName: buildingName.trim(),
        address: buildingAddress.trim() || 'التجمع الخامس - القاهرة',
        totalApartments: parseInt(totalApartments, 10) || 16,
        defaultMonthlyDues: parseFloat(defaultMonthlyDues) || 400,
        adminApartmentNumber: adminApartment.trim() || '12',
      });
      setCreatedBuildingCode(res.buildingCode);
      setMode('created_success');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'حدث خطأ أثناء تأسيس العقار.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Resident Join Submit (Screen 4: RESIDENT_SELECT)
  const handleResidentJoinSubmit = async () => {
    if (!buildingCode.trim() || !apartmentNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال كود المبنى واختيار رقم الشقة.');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسمك بالكامل.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الهاتف (واتساب).');
      return;
    }
    const finalPassword = residentPassword || signupPassword;
    if (!finalPassword || finalPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }
    if (residentPassword && residentPassword !== residentConfirmPassword) {
      Alert.alert(
        'تنبيه',
        'كلمة المرور وتأكيد كلمة المرور غير متطابقين، يرجى كتابتها بنفس الطريقة مرتين للتأكيد.'
      );
      return;
    }
    if (selectedAptArrears > 0 && !acceptArrearsTransfer) {
      Alert.alert(
        'تنبيه ترحيل المديونية',
        'يوجد مديونية سابقة مسجلة على هذه الشقة. يرجى تأكيد الموافقة على ترحيل المديونية لمتابعة الانضمام.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await requestJoinBuilding({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: finalPassword,
        buildingCode: buildingCode.trim().toUpperCase(),
        apartmentNumber: apartmentNumber.trim(),
        floorNumber: floorNumber.trim() || 'الدور الأول',
      });
      setLoginIdentifier(email.trim());
      setJustSubmittedJoin(true);
      setMode('welcome_success');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'حدث خطأ أثناء إرسال طلب الانضمام.');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // SCREEN 6: WELCOME SUCCESS & DIGITAL MEMBERSHIP CARD (design/_25)
  // --------------------------------------------------------------------------
  if (mode === 'welcome_success') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Celebration Beacon */}
        <View style={styles.welcomeHero}>
          <View style={styles.celebrationPulseBox}>
            <View style={styles.radiantGlow} />
            <View style={styles.successIconCircle}>
              <MaterialIcons name="check-circle" size={42} color={COLORS.onSecondary} />
            </View>
          </View>

          <View style={styles.verifiedSuccessBadge}>
            <MaterialIcons name="verified" size={16} color={COLORS.secondary} />
            <Text style={styles.verifiedSuccessText}>اكتمل التفعيل بنجاح</Text>
          </View>

          <Text style={styles.welcomeTitle}>تم تفعيل حسابك بنجاح! 🎉</Text>
          <Text style={styles.welcomeSub}>
            أهلاً بك يا <Text style={styles.boldNavyText}>{fullName || 'م. أحمد مصطفى'}</Text> في عائلة مجتمع {matchedBuilding?.name || 'برج الأمل السكني'}
          </Text>
        </View>

        {/* Digital Membership Card */}
        <View style={styles.membershipCard}>
          <View style={styles.cardTopGradientLine} />

          <View style={styles.membershipCardHeader}>
            <View style={styles.membershipIconBox}>
              <MaterialIcons name="badge" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMainTitle}>بطاقة عضوية الساكن الرقمية</Text>
              <Text style={styles.cardSubTitle}>اتحاد شاغلي العقار الرسمي</Text>
            </View>
            <View style={styles.registeredPill}>
              <View style={styles.greenDot} />
              <Text style={styles.registeredPillText}>موثق ومسجل</Text>
            </View>
          </View>

          {/* Property & Unit Info Box */}
          <View style={styles.unitDetailBanner}>
            <View style={styles.rowBetween}>
              <View style={styles.rowAlign}>
                <MaterialIcons name="location-city" size={18} color={COLORS.secondary} />
                <Text style={styles.buildingBannerTitle}>{matchedBuilding?.name || 'برج الأمل السكني'}</Text>
              </View>
              <Text style={styles.buildingBannerCity}>{matchedBuilding?.city || 'المعادي الجديدة'}</Text>
            </View>

            <View style={[styles.rowBetween, { marginTop: 6 }]}>
              <View style={styles.apartmentBadge}>
                <MaterialIcons name="meeting-room" size={16} color={COLORS.primaryContainer} />
                <Text style={styles.apartmentBadgeText}>
                  شقة {apartmentNumber || '302'} • {floorNumber || 'الدور الثالث'} (واجهة)
                </Text>
              </View>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{residentRoleType}</Text>
              </View>
            </View>
          </View>

          {/* Financials & Common Share Metadata */}
          <View style={styles.twoColumnGrid}>
            <View style={styles.metadataCard}>
              <Text style={styles.metadataLabel}>الحصة الشائعة بالأرض</Text>
              <Text style={styles.metadataValueNavy}>6.25%</Text>
              <Text style={styles.metadataSub}>وفق عقد الملكية</Text>
            </View>

            <View style={styles.metadataCard}>
              <Text style={styles.metadataLabel}>الاشتراك الشهري</Text>
              <View style={styles.rowAlign}>
                <Text style={styles.metadataValueGreen}>
                  {matchedBuilding?.default_monthly_dues || 400}
                </Text>
                <Text style={styles.currencySubText}>ج.م</Text>
              </View>
              <Text style={styles.metadataSub}>خدمات وصيانة دورية</Text>
            </View>
          </View>

          {/* QR & Security Bar */}
          <View style={styles.qrValidationBar}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="qr-code-2" size={26} color={COLORS.primary} />
              <View>
                <Text style={styles.qrCodeLabel}>رمز العضوية المشفر</Text>
                <Text style={styles.qrCodeVal}>BLD-{matchedBuilding?.building_code || 'EG'}-APT-{apartmentNumber || '302'}</Text>
              </View>
            </View>
            <MaterialIcons name="security" size={20} color={COLORS.statusPaid} />
          </View>
        </View>

        {/* Enter App Primary CTA */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={() => {
            switchRole('resident');
            setAuthenticated(true);
            onClose?.();
          }}
        >
          <Text style={styles.primaryActionText}>الدخول إلى واجهة الساكن الرئيسية</Text>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>

        {/* Go to Login Screen Option */}
        <TouchableOpacity
          style={[styles.outlineActionBtn, { marginTop: 12, justifyContent: 'center' }]}
          activeOpacity={0.88}
          onPress={() => setMode('login')}
        >
          <MaterialIcons name="login" size={18} color={COLORS.secondary} />
          <Text style={[styles.outlineActionText, { color: COLORS.secondary }]}>
            الذهاب لشاشة تسجيل الدخول اليومي (Login)
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: CREATED BUILDING SUCCESS BANNER & WHATSAPP INVITE (design/302)
  // --------------------------------------------------------------------------
  if (mode === 'created_success' && createdBuildingCode) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inviteLandingCard}>
          <View style={styles.inviteIconHeader}>
            <MaterialIcons name="celebration" size={32} color={COLORS.onPrimary} />
          </View>

          <Text style={styles.inviteSuccessTitle}>تم تأسيس العمارة وتفعيل نظام الاتحاد بنجاح! 🏢</Text>
          <Text style={styles.inviteSuccessSub}>
            تم تفعيل فترة تجريبية مجانية 60 يوماً بكامل مزايا باقة Pro لرئيس الاتحاد وسكان {buildingName}
          </Text>

          <View style={styles.codeHighlightContainer}>
            <Text style={styles.codeHighlightHeader}>كود العمارة الموحد لانضمام السكان:</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeTextBig}>{createdBuildingCode}</Text>
            </View>
            <Text style={styles.codeHighlightHint}>شارك هذا الكود مع ملاك وسكان البرج لينضموا مباشرة</Text>
          </View>

          {/* Actions: Copy & WhatsApp */}
          <View style={styles.twoColumnGrid}>
            <TouchableOpacity
              style={styles.outlineActionBtn}
              onPress={() => copyToClipboard(createdBuildingCode, 'كود المبنى')}
            >
              <MaterialIcons name="content-copy" size={18} color={COLORS.primary} />
              <Text style={styles.outlineActionText}>نسخ الكود</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.whatsAppActionBtn}
              onPress={() =>
                sendWhatsAppInvite({
                  buildingName: buildingName || 'العمارة',
                  buildingCode: createdBuildingCode,
                })
              }
            >
              <MaterialIcons name="share" size={18} color="#FFFFFF" />
              <Text style={styles.whatsAppActionText}>مشاركة واتساب 📲</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryActionButton, { marginTop: 16 }]}
            onPress={() => {
              switchRole('admin');
              setAuthenticated(true);
              onClose?.();
            }}
          >
            <Text style={styles.primaryActionText}>الدخول للوحة تحكم رئيس الاتحاد</Text>
            <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 3: ADMIN REGISTER & BUILDING SETUP (design/_30)
  // --------------------------------------------------------------------------
  if (mode === 'admin_register') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Navigation Bar */}
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setMode('signup')}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <View style={styles.safePlatformPill}>
            <MaterialIcons name="verified-user" size={15} color={COLORS.secondary} />
            <Text style={styles.safePlatformText}>منصة آمنة وموثقة</Text>
          </View>
          <View style={styles.avatarMiniCircle}>
            <MaterialIcons name="person" size={18} color={COLORS.onPrimary} />
          </View>
        </View>

        {/* Screen Header */}
        <View style={styles.screenIntro}>
          <View style={styles.tagCapsule}>
            <MaterialIcons name="apartment" size={14} color={COLORS.secondary} />
            <Text style={styles.tagCapsuleText}>تسجيل مجلس الإدارة</Text>
          </View>
          <Text style={styles.screenHeading}>تسجيل رئيس / مدير اتحاد الملاك</Text>
          <Text style={styles.screenDesc}>
            سجّل بصفتك المفوّض أو رئيس مجلس الإدارة وأنشئ الحساب المالي المعتمد لعقارتك بكل شفافية وسلاسة.
          </Text>
        </View>

        {/* Active Admin Role Pill Badge */}
        <View style={styles.roleSummaryBanner}>
          <View style={styles.adminShieldBox}>
            <MaterialIcons name="admin-panel-settings" size={22} color={COLORS.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowAlign}>
              <Text style={styles.roleSummaryTitle}>مدير / رئيس مجلس الاتحاد</Text>
              <MaterialIcons name="verified" size={16} color={COLORS.statusPaid} />
            </View>
            <Text style={styles.roleSummarySub}>صلاحيات كاملة لإدارة الخزينة والتحصيل والتقارير</Text>
          </View>
          <View style={styles.certifiedTag}>
            <Text style={styles.certifiedTagText}>معتمد رسمياً</Text>
          </View>
        </View>

        {/* Step 1: Manager Profile Card */}
        <View style={styles.formSectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={styles.sectionIconBox}>
                <MaterialIcons name="badge" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>بيانات رئيس المجلس (المسؤول الأول)</Text>
            </View>
            <Text style={styles.stepCounterText}>خطوة ١ من ٢</Text>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>الاسم الرباعي لرئيس الاتحاد / المشرف المفوّض *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person-pin" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثال: م. أحمد عبد العزيز شاهين"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>البريد الإلكتروني الرسمي لإدارة العقار والتقارير</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="mark-email-read" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="manager.bld84@ittihad-trust.org"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم هاتف الطوارئ والتواصل مع السكان</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="phone-iphone" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="010XXXXXXXX"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>
        </View>

        {/* Step 2: Building & Fund Setup Card */}
        <View style={styles.formSectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={[styles.sectionIconBox, { backgroundColor: COLORS.secondaryContainer }]}>
                <MaterialIcons name="domain-add" size={18} color={COLORS.onSecondaryContainer} />
              </View>
              <Text style={styles.sectionTitle}>بيانات العقار والجمعية المشتركة</Text>
            </View>
            <Text style={styles.stepCounterText}>خطوة ٢ من ٢</Text>
          </View>

          {/* Building Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>اسم العقار / البرج السكني</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="home-work" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={buildingName}
                onChangeText={setBuildingName}
                placeholder="مثال: برج الأمل السكني"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Building Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>المنطقة والحي والموقع الجغرافي</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="location-on" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={buildingAddress}
                onChangeText={setBuildingAddress}
                placeholder="مثال: القاهرة الجديدة - التجمع الخامس - النرجس عمارات"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Units count & Monthly Dues Side-by-Side */}
          <View style={styles.twoColumnGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>عدد الشقق والوحدات</Text>
              <TextInput
                style={[styles.textInputField, styles.centerField]}
                value={totalApartments}
                onChangeText={setTotalApartments}
                keyboardType="numeric"
                placeholder="16"
                placeholderTextColor={COLORS.outline}
              />
              <Text style={styles.fieldSubLabel}>شقة / وحدة تجارية</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>الاشتراك الشهري / شقة</Text>
              <TextInput
                style={[styles.textInputField, styles.centerField, { color: COLORS.secondary, fontWeight: '700' }]}
                value={defaultMonthlyDues}
                onChangeText={setDefaultMonthlyDues}
                keyboardType="numeric"
                placeholder="400"
                placeholderTextColor={COLORS.outline}
              />
              <Text style={styles.fieldSubLabel}>خدمات وصيانة دورية</Text>
            </View>
          </View>

          {/* Projected Monthly Treasury Chip */}
          <View style={styles.treasuryProjectionChip}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.secondary} />
              <Text style={styles.projectionChipTitle}>الحصيلة الشهرية المتوقعة لخزينة العمارة:</Text>
            </View>
            <Text style={styles.projectionChipAmount}>{projectedMonthlyTreasury} ج.م</Text>
          </View>

          {/* Admin Apartment Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم شقة رئيس الاتحاد</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="meeting-room" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={adminApartment}
                onChangeText={setAdminApartment}
                placeholder="مثال: 12"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Treasury InstaPay / Account (Optional) */}
          <View style={styles.inputGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.fieldLabel}>حساب الخزينة / محفظة إنستاباي</Text>
              <Text style={styles.optionalTagText}>اختياري الآن</Text>
            </View>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="credit-card" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={treasuryAccount}
                onChangeText={setTreasuryAccount}
                placeholder="elamal.tower@instapay"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>
        </View>

        {/* Legal Declaration */}
        <TouchableOpacity
          style={styles.legalBox}
          activeOpacity={0.9}
          onPress={() => setLegalDeclaration(!legalDeclaration)}
        >
          <View style={[styles.checkboxSquare, legalDeclaration && styles.checkboxActive]}>
            {legalDeclaration && <MaterialIcons name="check" size={16} color={COLORS.onPrimary} />}
          </View>
          <Text style={styles.legalText}>
            أقر بصفتي المفوّض أو رئيس اتحاد الشاغلين بصحة هذه البيانات ومسؤوليتي القانونية والإدارية عن حساب العقار المشترك.
          </Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleAdminRegisterSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={styles.primaryActionText}>
                تأسيس اتحاد الملاك وبدء الفترة التجريبية (60 يوماً Pro)
              </Text>
              <MaterialIcons name="add-business" size={20} color={COLORS.onPrimary} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 4: RESIDENT SELECT APARTMENT & JOIN (design/_6 & _15)
  // --------------------------------------------------------------------------
  if (mode === 'resident_select') {
    const isBuildingCodeEntered = Boolean(
      buildingCode.trim().length >= 3 || matchedBuilding
    );

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Top Back Header */}
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setMode('login')}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>اختيار الشقة والانضمام</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Section */}
        <View style={styles.screenIntro}>
          <Text style={styles.screenHeading}>مرحباً بك في اتحاد الملاك</Text>
          <Text style={styles.screenDesc}>
            منصة إدارة العقارات، الصيانة الدورية، والتحصيل المالي السريع بكل شفافية وسهولة
          </Text>
        </View>

        {/* Step 1: Building Verification Card */}
        <View style={styles.formSectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={styles.sectionNumberCircle}>
                <Text style={styles.sectionNumberText}>١</Text>
              </View>
              <Text style={styles.sectionTitle}>بيانات المبنى أو البرج</Text>
            </View>
            <Text style={styles.stepCounterText}>خطوة ١ من ٢</Text>
          </View>

          {/* Building Code Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>كود المبنى / العمارة الموحد</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInputField, styles.codeFieldStyle]}
                value={buildingCode}
                onChangeText={(val) => setBuildingCode(val.toUpperCase())}
                autoCapitalize="characters"
                placeholder="مثال: BLD-2024-EG"
                placeholderTextColor={COLORS.outline}
              />
              {matchedBuilding && (
                <MaterialIcons name="check-circle" size={22} color={COLORS.statusPaid} style={styles.inputCheckIcon} />
              )}
            </View>
          </View>

          {/* Live Verified Building Banner */}
          {matchedBuilding ? (
            <View style={styles.verifiedBuildingCard}>
              <View style={styles.buildingIconSquare}>
                <MaterialIcons name="location-city" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowAlign}>
                  <View style={styles.liveGreenPulse} />
                  <Text style={styles.verifiedBldName}>{matchedBuilding.name}</Text>
                </View>
                <Text style={styles.verifiedBldAddress}>{matchedBuilding.address}</Text>
                <View style={[styles.rowAlign, { marginTop: 6, gap: 12 }]}>
                  <View style={styles.rowAlign}>
                    <MaterialIcons name="meeting-room" size={14} color={COLORS.onSurfaceVariant} />
                    <Text style={styles.verifiedBldMeta}>{matchedBuilding.total_apartments} شقة</Text>
                  </View>
                  <View style={styles.rowAlign}>
                    <MaterialIcons name="person" size={14} color={COLORS.onSurfaceVariant} />
                    <Text style={styles.verifiedBldMeta}>رئيس الاتحاد: م. أحمد</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.codeHintBox}>
              <MaterialIcons name="info" size={18} color={COLORS.secondary} />
              <Text style={styles.codeHintText}>
                احصل على كود المبنى من رئيس الاتحاد أو ملصق مدخل العقار لإظهار شقق العمارة.
              </Text>
            </View>
          )}
        </View>

        {!isBuildingCodeEntered ? (
          <View style={styles.waitingForCodeCard}>
            <View style={styles.waitingIconCircle}>
              <MaterialIcons name="apartment" size={30} color={COLORS.secondary} />
            </View>
            <Text style={styles.waitingForCodeTitle}>أدخل كود المبنى أولاً لإظهار الشقق</Text>
            <Text style={styles.waitingForCodeSub}>
              بمجرد كتابة كود العمارة أو كود دعوتك في الخانة أعلاه، سيتم تحميل شقق العمارة وإظهار نموذج اختيار وحدتك واستكمال التسجيل تلقائياً.
            </Text>
          </View>
        ) : (
          <>
            {/* Step 2: Apartment Selection Grid (Shown when Building is verified or entered) */}
            <View style={styles.formSectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.rowAlign}>
              <View style={styles.sectionNumberCircle}>
                <Text style={styles.sectionNumberText}>٢</Text>
              </View>
              <Text style={styles.sectionTitle}>
                {parsedCodeInfo.apartmentNum && !showAllApartments
                  ? `وحدتك السكنية المخصصة (شقة ${apartmentNumber || parsedCodeInfo.apartmentNum})`
                  : 'اختر شقتك أو وحدتك السكنية'}
              </Text>
            </View>
            {apartmentNumber ? (
              <View style={styles.selectedCountPill}>
                <Text style={styles.selectedCountText}>تم تحديد شقة {apartmentNumber}</Text>
              </View>
            ) : null}
          </View>

          {/* Single Apartment Direct Invite Code Banner */}
          {parsedCodeInfo.apartmentNum ? (
            <View style={styles.singleAptNoticeRow}>
              <View style={styles.rowAlign}>
                <MaterialIcons name="vpn-key" size={16} color={COLORS.secondary} />
                <Text style={styles.singleAptNoticeText}>
                  كود دعوة مخصص لشقة {parsedCodeInfo.apartmentNum}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.showAllAptsBtn}
                onPress={() => setShowAllApartments(!showAllApartments)}
              >
                <Text style={styles.showAllAptsBtnText}>
                  {showAllApartments ? 'التركيز على شقتي فقط' : 'عرض باقي شقق العمارة'}
                </Text>
                <MaterialIcons
                  name={showAllApartments ? 'expand-less' : 'expand-more'}
                  size={16}
                  color={COLORS.secondary}
                />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Apartments Grid */}
          <View style={styles.apartmentsGridContainer}>
            {displayedApartmentGrid.map((apt: any) => {
              const isSelected = apartmentNumber === apt.apartment_number;
              const isOccupied =
                ('is_occupied' in apt
                  ? apt.is_occupied
                  : Boolean(apt.resident_id || (apt.resident_name && apt.resident_name !== 'وحدة شاغرة'))) &&
                !isSelected;

              return (
                <TouchableOpacity
                  key={apt.id || apt.apartment_number}
                  style={[
                    styles.apartmentGridItem,
                    isSelected && styles.apartmentGridItemSelected,
                    isOccupied && styles.apartmentGridItemOccupied,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setApartmentNumber(apt.apartment_number);
                    if (apt.floor_number) setFloorNumber(apt.floor_number);
                    const occName = apt.occupant_name || apt.resident_name;
                    if (occName && occName !== 'وحدة شاغرة' && occName !== 'مشغول') {
                      setFullName(occName);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.aptGridNumText,
                      isSelected && styles.aptGridNumTextSelected,
                    ]}
                  >
                    {apt.apartment_number}
                  </Text>
                  <Text
                    style={[
                      styles.aptGridStatusText,
                      isSelected && styles.aptGridStatusTextSelected,
                    ]}
                  >
                    {isSelected ? 'شقتك المحددة' : isOccupied ? 'مشغولة' : 'متاحة'}
                  </Text>
                  {isSelected && (
                    <View style={styles.aptSelectedCheckPin}>
                      <MaterialIcons name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Resident Details Form */}
          <View style={{ marginTop: 16 }}>
            {/* Apartment & Floor - Freely editable in case admin made a mistake */}
            <View style={styles.twoColumnGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>رقم الشقة *</Text>
                <TextInput
                  style={[styles.textInputField, styles.centerField, { fontWeight: '700' }]}
                  value={apartmentNumber}
                  onChangeText={setApartmentNumber}
                  placeholder="12"
                  placeholderTextColor={COLORS.outline}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>الدور / الطابق</Text>
                <TextInput
                  style={styles.textInputField}
                  value={floorNumber}
                  onChangeText={setFloorNumber}
                  placeholder="مثال: الدور الثالث"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>

            {/* Full Name */}
            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Text style={styles.fieldLabel}>الاسم بالكامل (ثلاثي أو رباعي) *</Text>
              <View style={styles.inputWrapper}>
                <MaterialIcons name="person" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInputField}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="مثال: م. أحمد مصطفى"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>

            {/* Phone & Email */}
            <View style={[styles.twoColumnGrid, { marginTop: 10 }]}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>رقم الهاتف (واتساب) *</Text>
                <TextInput
                  style={[styles.textInputField, styles.ltrField]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="010XXXXXXXX"
                  placeholderTextColor={COLORS.outline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>البريد الإلكتروني (لتسجيل الدخول)</Text>
                <TextInput
                  style={[styles.textInputField, styles.ltrField]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="name@email.com"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>

            {/* Password & Confirm Password (مرتين للتأكيد) */}
            <View style={[styles.twoColumnGrid, { marginTop: 10 }]}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>كلمة المرور للحساب *</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.textInputField, styles.ltrField]}
                    value={residentPassword}
                    onChangeText={setResidentPassword}
                    secureTextEntry={!showResidentPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.outline}
                  />
                  <TouchableOpacity
                    onPress={() => setShowResidentPassword(!showResidentPassword)}
                    style={styles.passwordToggleBtn}
                  >
                    <MaterialIcons
                      name={showResidentPassword ? 'visibility-off' : 'visibility'}
                      size={18}
                      color={COLORS.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>تأكيد كلمة المرور *</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.textInputField, styles.ltrField]}
                    value={residentConfirmPassword}
                    onChangeText={setResidentConfirmPassword}
                    secureTextEntry={!showResidentPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>
              </View>
            </View>

            {/* Resident Role Selection */}
            <View style={[styles.twoColumnGrid, { marginTop: 12 }]}>
              <TouchableOpacity
                style={[
                  styles.roleSelectorPill,
                  residentRoleType === 'مالك مقيم' && styles.roleSelectorPillActive,
                ]}
                onPress={() => setResidentRoleType('مالك مقيم')}
              >
                <MaterialIcons
                  name="home"
                  size={18}
                  color={residentRoleType === 'مالك مقيم' ? COLORS.primary : COLORS.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.roleSelectorPillText,
                    residentRoleType === 'مالك مقيم' && styles.roleSelectorPillTextActive,
                  ]}
                >
                  مالك مقيم
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleSelectorPill,
                  residentRoleType === 'مستأجر' && styles.roleSelectorPillActive,
                ]}
                onPress={() => setResidentRoleType('مستأجر')}
              >
                <MaterialIcons
                  name="key"
                  size={18}
                  color={residentRoleType === 'مستأجر' ? COLORS.primary : COLORS.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.roleSelectorPillText,
                    residentRoleType === 'مستأجر' && styles.roleSelectorPillTextActive,
                  ]}
                >
                  مستأجر
                </Text>
              </TouchableOpacity>
            </View>

            {/* Arrears Obligation Notice & Transfer Checkbox */}
            {selectedAptArrears > 0 && (
              <View style={styles.arrearsNoticeBox}>
                <View style={styles.arrearsNoticeHeader}>
                  <MaterialIcons name="warning-amber" size={18} color="#B45309" />
                  <Text style={styles.arrearsNoticeTitle}>
                    تنبيه: مديونية سابقة مسجلة على الوحدة
                  </Text>
                </View>
                <Text style={styles.arrearsNoticeDesc}>
                  يوجد التزامات سابقة غير مسددة على شقة ({apartmentNumber}) بمبلغ{' '}
                  <Text style={styles.arrearsBoldAmount}>
                    {selectedAptArrears.toLocaleString('en-US')} ج.م
                  </Text>
                  . وفقاً للائحة اتحاد الشاغلين، يتم ترحيل هذه الالتزامات ومتابعة سدادها ضمن حساب الشقة.
                </Text>
                <TouchableOpacity
                  style={styles.arrearsCheckboxRow}
                  activeOpacity={0.9}
                  onPress={() => setAcceptArrearsTransfer(!acceptArrearsTransfer)}
                >
                  <View
                    style={[
                      styles.checkboxSmall,
                      acceptArrearsTransfer && styles.checkboxSmallActive,
                    ]}
                  >
                    {acceptArrearsTransfer && (
                      <MaterialIcons name="check" size={12} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.arrearsCheckboxText}>
                    أقر بترحيل المديونية السابقة والالتزام بتسويتها مع اتحاد الملاك
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleResidentJoinSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <Text style={styles.primaryActionText}>إرسال طلب الانضمام وتأكيد الحساب</Text>
              <MaterialIcons name="how-to-reg" size={20} color={COLORS.onPrimary} />
            </>
          )}
        </TouchableOpacity>
      </>
    )}

        {/* Back to Login Link */}
        <View style={[styles.signupFooterBox, { marginTop: 14 }]}>
          <Text style={styles.signupFooterText}>لديك حساب مسجل بالفعل؟</Text>
          <TouchableOpacity
            style={styles.signupFooterBtn}
            onPress={() => setMode('login')}
          >
            <Text style={styles.signupFooterBtnText}>تسجيل الدخول</Text>
            <MaterialIcons name="arrow-back" size={16} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 2: AUTH SIGNUP (design/_26)
  // --------------------------------------------------------------------------
  if (mode === 'signup') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Top App Branding & Trust Indicator */}
        <View style={styles.topBrandRow}>
          <View style={styles.brandGroup}>
            <View style={styles.logoIconBox}>
              <MaterialIcons name="apartment" size={22} color={COLORS.onPrimary} />
            </View>
            <View>
              <Text style={styles.brandTitle}>إتّحاد</Text>
              <Text style={styles.brandSub}>منصة إدارة اتحادات الملاك</Text>
            </View>
          </View>

          <View style={styles.verifiedPill}>
            <MaterialIcons name="verified-user" size={15} color={COLORS.secondary} />
            <Text style={styles.verifiedPillText}>نظام موثّق</Text>
          </View>
        </View>

        {/* Hero Header & Quick Sign-in Switch */}
        <View style={styles.heroRowBetween}>
          <View>
            <Text style={styles.screenHeading}>إنشاء حساب جديد</Text>
            <Text style={styles.screenDesc}>اختر صفتك وسجّل بياناتك لبدء إدارة وتنسيق العقار بكل شفافية</Text>
          </View>
          <TouchableOpacity
            style={styles.switchModeLink}
            onPress={() => setMode('login')}
          >
            <Text style={styles.switchModeLinkText}>تسجيل الدخول</Text>
            <MaterialIcons name="arrow-back" size={16} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>

        {/* Role Selector Cards */}
        <Text style={styles.sectionInstruction}>حدد صفتك في العقار:</Text>
        <View style={styles.twoColumnGrid}>
          {/* Card 1: Resident / Unit Owner */}
          <TouchableOpacity
            style={[
              styles.roleCardBig,
              selectedRoleTab === 'resident' && styles.roleCardBigSelected,
            ]}
            activeOpacity={0.88}
            onPress={() => setSelectedRoleTab('resident')}
          >
            <View style={styles.rowBetween}>
              <View style={[styles.roleIconBadge, selectedRoleTab === 'resident' && styles.roleIconBadgeActive]}>
                <MaterialIcons name="vpn-key" size={20} color={COLORS.primaryContainer} />
              </View>
              <View style={[styles.radioCheckCircle, selectedRoleTab === 'resident' && styles.radioCheckCircleActive]}>
                {selectedRoleTab === 'resident' && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
              </View>
            </View>
            <Text style={styles.roleCardBigTitle}>مالك / ساكن وحدة</Text>
            <Text style={styles.roleCardBigDesc}>
              متابعة المصروفات، سداد الصيانة، وسندات الدفع الفورية.
            </Text>
          </TouchableOpacity>

          {/* Card 2: Property Manager / President */}
          <TouchableOpacity
            style={[
              styles.roleCardBig,
              selectedRoleTab === 'admin' && styles.roleCardBigSelected,
            ]}
            activeOpacity={0.88}
            onPress={() => setSelectedRoleTab('admin')}
          >
            <View style={styles.rowBetween}>
              <View style={[styles.roleIconBadge, selectedRoleTab === 'admin' && styles.roleIconBadgeActive]}>
                <MaterialIcons name="admin-panel-settings" size={20} color={COLORS.primaryContainer} />
              </View>
              <View style={[styles.radioCheckCircle, selectedRoleTab === 'admin' && styles.radioCheckCircleActive]}>
                {selectedRoleTab === 'admin' && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
              </View>
            </View>
            <Text style={styles.roleCardBigTitle}>مدير / رئيس الاتحاد</Text>
            <Text style={styles.roleCardBigDesc}>
              إدارة الخزينة والعهدة، اعتماد التحصيلات، ودعوة الملاك.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Resident Direct Code Join Banner (Jump directly to code & unit entry) */}
        {selectedRoleTab === 'resident' && (
          <TouchableOpacity
            style={styles.residentDirectCodeBanner}
            activeOpacity={0.88}
            onPress={() => setMode('resident_select')}
          >
            <View style={styles.residentDirectCodeIcon}>
              <MaterialIcons name="vpn-key" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.residentDirectCodeTitle}>
                الانضمام السريع بكود الشقة أو كود الدعوة 🔑
              </Text>
              <Text style={styles.residentDirectCodeSub}>
                لديك كود دعوة من رئيس الاتحاد؟ اضغط هنا للانضمام المباشر وتخطي هذه الخطوة
              </Text>
            </View>
            <MaterialIcons name="arrow-back" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
        )}

        {/* Registration Form Card */}
        <View style={[styles.formSectionCard, { marginTop: 14 }]}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>الاسم بالكامل (ثلاثي أو رباعي) *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثال: م. أحمد عبد العزيز شاهين"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <View style={styles.rowBetween}>
              <Text style={styles.fieldLabel}>البريد الإلكتروني للعمل أو المراسلات *</Text>
              <Text style={styles.officialLoginPill}>وسيلة الدخول الرسمية</Text>
            </View>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="alternate-email" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="name@company.com"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم هاتف الواتساب للتنبيهات *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="phone-iphone" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="010XXXXXXXX"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>كلمة المرور المشفرة</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="lock" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={signupPassword}
                onChangeText={setSignupPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.outline}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggleBtn}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={COLORS.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Submit Step CTA */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleSignupNext}
        >
          <Text style={styles.primaryActionText}>
            {selectedRoleTab === 'resident' ? 'متابعة لاختيار الشقة وكود المبنى' : 'متابعة لتأسيس عقار ومجلس الإدارة'}
          </Text>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN 1: AUTH LOGIN (design/_12) - DEFAULT VIEW
  // --------------------------------------------------------------------------
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Brand & Mascot Header Section (Shield & Glowing Ring) */}
      <View style={styles.loginHeaderBox}>
        <View style={styles.shieldCenterBox}>
          <View style={styles.shieldPulseGlow} />
          <View style={styles.shieldIconInner}>
            <MaterialIcons name="domain-add" size={32} color={COLORS.secondaryContainer} />
          </View>
          <View style={styles.shieldVerifiedBadge}>
            <MaterialIcons name="verified" size={14} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.loginBrandTitle}>مدير اتحاد الملاك</Text>
        <View style={styles.rowAlign}>
          <View style={styles.liveGreenDot} />
          <Text style={styles.loginBrandSub}>مرحباً بك مجدداً • حسابك وعمارتك بأمان</Text>
        </View>

        {/* Building Context Capsule */}
        <View style={styles.buildingContextCapsule}>
          <MaterialIcons name="apartment" size={16} color={COLORS.secondary} />
          <Text style={styles.buildingContextText}>
            {buildings[0]?.name || 'برج الأمل السكني'} • {buildings[0]?.address || 'التجمع الخامس'}
          </Text>
          <View style={styles.capsuleDivider} />
          <Text style={styles.capsuleGateTag}>بوابة رقم ١</Text>
        </View>
      </View>

      {/* Role Selector Switch (Segmented Control) */}
      <View style={styles.segmentedControlCard}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedRoleTab === 'resident' && styles.segmentBtnActive,
          ]}
          onPress={() => setSelectedRoleTab('resident')}
        >
          <MaterialIcons
            name="person"
            size={18}
            color={selectedRoleTab === 'resident' ? COLORS.secondary : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedRoleTab === 'resident' && styles.segmentBtnTextActive,
            ]}
          >
            ساكن / مالك وحدة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedRoleTab === 'admin' && styles.segmentBtnActive,
          ]}
          onPress={() => setSelectedRoleTab('admin')}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={18}
            color={selectedRoleTab === 'admin' ? COLORS.primaryContainer : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedRoleTab === 'admin' && styles.segmentBtnTextActive,
            ]}
          >
            إدارة الاتحاد / المجلس
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Login Form Card Container */}
      <View style={styles.formSectionCard}>
        {/* Email Input */}
        <View style={styles.inputGroup}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="alternate-email" size={16} color={COLORS.secondary} />
              <Text style={styles.fieldLabel}>البريد الإلكتروني المعتمد *</Text>
            </View>
            <Text style={styles.quickHelperText}>حساب مسجل مسبقاً</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="name@example.com"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="lock" size={16} color={COLORS.secondary} />
              <Text style={styles.fieldLabel}>كلمة المرور المشفرة *</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'استعادة الدخول',
                  'يرجى التواصل مع رئيس اتحاد الملاك أو استخدام بريدك الإلكتروني المسجل لإعادة تعيين كلمة المرور.'
                )
              }
            >
              <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.outline}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggleBtn}
            >
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={COLORS.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Remember Me Toggle */}
        <TouchableOpacity
          style={styles.rowAlign}
          activeOpacity={0.9}
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View
            style={[
              styles.checkboxSmall,
              rememberMe && styles.checkboxSmallActive,
            ]}
          >
            {rememberMe && (
              <MaterialIcons name="check" size={12} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.rememberMeText}>
            تذكر تسجيل دخولي على هذا الهاتف
          </Text>
        </TouchableOpacity>

        {/* Primary Login Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleLoginSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="login" size={20} color={COLORS.onPrimary} />
              <Text style={styles.primaryActionText}>
                {selectedRoleTab === 'resident'
                  ? 'تسجيل الدخول الآمن (ساكن)'
                  : 'تسجيل الدخول للوحة إدارة الاتحاد'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Resident Fast Join By Code Card (Exact match to design/_12) */}
      {selectedRoleTab === 'resident' && (
        <View style={styles.residentCodeJoinCard}>
          <View style={styles.residentCodeJoinInfo}>
            <View style={styles.residentCodeJoinIcon}>
              <MaterialIcons
                name="add-home-work"
                size={22}
                color={COLORS.secondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.residentCodeJoinTitle}>
                ساكن جديد في عمارة؟
              </Text>
              <Text style={styles.residentCodeJoinSub}>
                انضم بكود العقار أو كود الدعوة الخاص بجمعيتك
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.residentCodeJoinBtn}
            activeOpacity={0.88}
            onPress={() => setMode('resident_select')}
          >
            <Text style={styles.residentCodeJoinBtnText}>
              طلب انضمام بكود العقار 🔑
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Switch to Signup / Code Link */}
      <View style={styles.signupFooterBox}>
        <Text style={styles.signupFooterText}>
          {selectedRoleTab === 'resident'
            ? 'تريد الانضمام لعمارة جديدة كساكن؟'
            : 'ليس لديك حساب أو لم تنضم بعد؟'}
        </Text>
        <TouchableOpacity
          style={styles.signupFooterBtn}
          onPress={() => {
            if (selectedRoleTab === 'resident') {
              setMode('resident_select');
            } else {
              setMode('signup');
            }
          }}
        >
          <Text style={styles.signupFooterBtnText}>
            {selectedRoleTab === 'resident'
              ? 'انضمام ساكن جديد بكود المبنى 🏢'
              : 'إنشاء حساب جديد أو تأسيس عقار'}
          </Text>
          <MaterialIcons
            name="arrow-back"
            size={16}
            color={COLORS.secondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// --------------------------------------------------------------------------
// DESIGN STYLESHEET (Tokens matched to developer_handover_specs v2.4)
// --------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Common Header & Branding
  topBrandRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandGroup: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  logoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  brandSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  verifiedPill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },

  // Login Screen Specifics (Screen 12)
  loginHeaderBox: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  shieldCenterBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  shieldPulseGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 108, 73, 0.15)',
  },
  shieldIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  shieldVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.statusPaid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  loginBrandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  loginBrandSub: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusPaid,
    marginRight: 6,
  },
  buildingContextCapsule: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginTop: 10,
  },
  buildingContextText: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  capsuleDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.outlineVariant,
  },
  capsuleGateTag: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '700',
  },

  // Segmented Control
  segmentedControlCard: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    backgroundColor: COLORS.surfaceContainer,
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.surfaceCard,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  segmentBtnTextActive: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },

  // Form Section Card
  formSectionCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 14,
    marginBottom: 16,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  fieldSubLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 2,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInputField: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceCanvas,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.onSurface,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  ltrField: {
    textAlign: 'left',
  },
  centerField: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  codeFieldStyle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.primary,
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 2,
  },
  inputCheckIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
  },
  passwordToggleBtn: {
    position: 'absolute',
    left: 12,
    padding: 4,
    zIndex: 2,
  },
  quickHelperText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  forgotPasswordText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  // Checkboxes
  checkboxSmall: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: COLORS.surfaceContainer,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxSmallActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  rememberMeText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },

  // Buttons
  primaryActionButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1E293B',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  biometricButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  biometricButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Footer Link Box
  signupFooterBox: {
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  signupFooterText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
  },
  signupFooterBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  signupFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // Back Bar & Common Elements
  topBackBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safePlatformPill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 108, 73, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  safePlatformText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  avatarMiniCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCenterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.onSurface,
  },

  // Screen Intro
  screenIntro: {
    marginBottom: 16,
    gap: 4,
  },
  tagCapsule: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  tagCapsuleText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  screenDesc: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Admin Banner
  roleSummaryBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  adminShieldBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  roleSummarySub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  certifiedTag: {
    backgroundColor: COLORS.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  certifiedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingBottom: 10,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  stepCounterText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  sectionNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.onPrimary,
  },

  // Two Column Grid
  twoColumnGrid: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },

  // Treasury Projection Chip (Screen 30)
  treasuryProjectionChip: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
  },
  projectionChipTitle: {
    fontSize: 12,
    color: COLORS.onSurface,
    fontWeight: '600',
  },
  projectionChipAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  optionalTagText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },

  // Legal Checkbox
  legalBox: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surfaceCard,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 16,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: COLORS.secondary,
  },
  legalText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    lineHeight: 18,
    textAlign: 'right',
  },

  // Signup Screen Specifics (Screen 26)
  heroRowBetween: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchModeLink: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  switchModeLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  sectionInstruction: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
    marginBottom: 8,
  },
  roleCardBig: {
    flex: 1,
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    gap: 6,
  },
  roleCardBigSelected: {
    borderColor: COLORS.primaryContainer,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1E293B',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  roleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBadgeActive: {
    backgroundColor: COLORS.surfaceContainer,
  },
  radioCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheckCircleActive: {
    backgroundColor: COLORS.primaryContainer,
  },
  roleCardBigTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  roleCardBigDesc: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 15,
  },
  officialLoginPill: {
    fontSize: 10,
    color: COLORS.secondary,
    fontWeight: '700',
    backgroundColor: 'rgba(0,108,73,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },

  // Resident Join Specifics (Screens 6 & 15)
  verifiedBuildingCard: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  buildingIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveGreenPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.statusPaid,
    marginRight: 6,
  },
  verifiedBldName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  verifiedBldAddress: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  verifiedBldMeta: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  codeHintBox: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  codeHintText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 17,
  },
  selectedCountPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  selectedCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPaidText,
  },
  apartmentsGridContainer: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  apartmentGridItem: {
    width: '31%',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  apartmentGridItemSelected: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
    shadowColor: '#1E293B',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  apartmentGridItemOccupied: {
    backgroundColor: COLORS.surfaceContainerLow,
    opacity: 0.65,
  },
  aptGridNumText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
  },
  aptGridNumTextSelected: {
    color: COLORS.onPrimary,
  },
  aptGridStatusText: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  aptGridStatusTextSelected: {
    color: COLORS.onPrimaryContainer,
  },
  aptSelectedCheckPin: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.statusPaid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectorPill: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  roleSelectorPillActive: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.primaryContainer,
  },
  roleSelectorPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  roleSelectorPillTextActive: {
    color: COLORS.onSurface,
    fontWeight: '700',
  },

  // Welcome Success Screen (Screen 25)
  welcomeHero: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  celebrationPulseBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  radiantGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 42,
    backgroundColor: 'rgba(0, 108, 73, 0.2)',
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.secondary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  verifiedSuccessBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    marginBottom: 6,
  },
  verifiedSuccessText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  boldNavyText: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Digital Membership Card
  membershipCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#091426',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 20,
    gap: 12,
  },
  cardTopGradientLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.secondary,
  },
  membershipCardHeader: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  membershipIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  cardSubTitle: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  registeredPill: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.secondaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },
  registeredPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSecondaryContainer,
  },
  unitDetailBanner: {
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  buildingBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  buildingBannerCity: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  apartmentBadge: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  apartmentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  roleTag: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  metadataCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 84,
  },
  metadataLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  metadataValueNavy: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  metadataValueGreen: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  currencySubText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
    marginLeft: 4,
  },
  metadataSub: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  qrValidationBar: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerHighest,
    padding: 10,
    borderRadius: 10,
  },
  qrCodeLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  qrCodeVal: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Invite / Created Success Card (design/302)
  inviteLandingCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  inviteIconHeader: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  inviteSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  inviteSuccessSub: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  codeHighlightContainer: {
    width: '100%',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  codeHighlightHeader: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  codeBox: {
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.statusPaid,
  },
  codeTextBig: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  codeHighlightHint: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  outlineActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.primaryContainer,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  whatsAppActionBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#25D366',
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#25D366',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  whatsAppActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Helper row styles
  rowAlign: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Resident Quick Actions & Code Join Card (design/_12)
  residentQuickActionsRow: {
    marginTop: 4,
    marginBottom: 6,
  },
  otpPillBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  otpPillBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  residentCodeJoinCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  residentCodeJoinInfo: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  residentCodeJoinIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  residentCodeJoinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  residentCodeJoinSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  residentCodeJoinBtn: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 10,
    height: 42,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  residentCodeJoinBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  residentDirectCodeBanner: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  residentDirectCodeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  residentDirectCodeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  residentDirectCodeSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },

  // Arrears Obligation Notice in Resident Select
  arrearsNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginTop: 12,
    gap: 6,
  },
  arrearsNoticeHeader: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  arrearsNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  arrearsNoticeDesc: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  arrearsBoldAmount: {
    fontWeight: '800',
    color: '#B91C1C',
  },
  arrearsCheckboxRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  arrearsCheckboxText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350F',
  },

  // Single Apartment Invite Code Notice
  singleAptNoticeRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  singleAptNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  showAllAptsBtn: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  showAllAptsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // Waiting for building code empty state
  waitingForCodeCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    borderStyle: 'dashed',
    marginTop: 12,
    gap: 8,
  },
  waitingIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  waitingForCodeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  waitingForCodeSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
});
