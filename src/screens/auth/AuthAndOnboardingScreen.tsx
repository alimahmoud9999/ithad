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

/**
 * Matches Screen 1 in design/stitch_/design.md ("Onboarding & Apartment Selection")
 * and design/stitch_/_23/code.html ("إنشاء حساب جديد / اختيار الصفة") + _27/code.html.
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
  } = useAppStore();

  const [selectedRoleTab, setSelectedRoleTab] = useState<'resident' | 'admin'>(
    'resident'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Resident Join Fields (empty by default, using placeholders as examples)
  const [buildingCode, setBuildingCode] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');

  // Admin Create Building Fields (empty by default, using placeholders as examples)
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [totalApartments, setTotalApartments] = useState('');
  const [defaultMonthlyDues, setDefaultMonthlyDues] = useState('');
  const [adminApartment, setAdminApartment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [createdBuildingCode, setCreatedBuildingCode] = useState<string | null>(
    null
  );
  const [justSubmittedJoin, setJustSubmittedJoin] = useState(false);
  const [dismissedAptMatch, setDismissedAptMatch] = useState(false);
  const [isInviteCodeAutoMatched, setIsInviteCodeAutoMatched] = useState(false);
  const [matchedAptDetail, setMatchedAptDetail] = useState<{
    apartmentNumber: string;
    occupantName?: string | null;
    occupantPhone?: string | null;
    floorNumber?: string | null;
  } | null>(null);

  // Clear any Fast-Refresh preserved values so all inputs start 100% empty with placeholders only
  useEffect(() => {
    setFullName('');
    setEmail('');
    setPhone('');
    setBuildingCode('');
    setApartmentNumber('');
    setFloorNumber('');
    setBuildingName('');
    setBuildingAddress('');
    setTotalApartments('');
    setDefaultMonthlyDues('');
    setAdminApartment('');
  }, []);

  const isResidentPending =
    justSubmittedJoin &&
    currentRole === 'resident' &&
    currentUser.status === 'pending';

  const hasEnteredBuildingCode = buildingCode.trim().length >= 4;

  // Remote building and apartment lookup from Supabase for cross-device live verification
  const [remoteBuilding, setRemoteBuilding] = useState<Building | null>(null);
  const [remoteApts, setRemoteApts] = useState<Apartment[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchBuilding = async () => {
      const raw = buildingCode.trim().toUpperCase();
      let code = raw;
      let explicitAptNum = '';
      const parts = raw.split('-');
      if (parts.length >= 3 && parts[0] === 'BLD' && parts[2].trim().length > 0) {
        code = `${parts[0]}-${parts[1]}`;
        explicitAptNum = parts.slice(2).join('-');
        if (explicitAptNum && !apartmentNumber) {
          setApartmentNumber(explicitAptNum);
        }
      }

      if (code.length >= 4 && isSupabaseConfigured) {
        try {
          // 1. Try SECURITY DEFINER RPC lookup first (bypasses RLS)
          let { data: rpcData, error: rpcError } = await supabase.rpc(
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
              subscription_ends_at: new Date(
                Date.now() + 60 * 86400000
              ).toISOString(),
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

            // Also try fetching full record from buildings table if permitted
            const { data: fullBld } = await supabase
              .from('buildings')
              .select('*')
              .ilike('building_code', code)
              .maybeSingle();

            if (isMounted) {
              setRemoteBuilding(
                fullBld ? (fullBld as Building) : mappedBuilding
              );

              if (rpcData.apartments && rpcData.apartments.length > 0) {
                const mappedApts: Apartment[] = rpcData.apartments.map(
                  (a: any) => ({
                    id: a.id,
                    building_id: rpcData.building_id,
                    apartment_number: a.apartment_number,
                    floor_number: a.floor_number || 'الدور الأول',
                    wing_or_direction: a.wing_or_direction || 'واجهة',
                    area_sqm: 150,
                    ownership_share_percent: 10,
                    monthly_dues_override: null,
                    resident_name:
                      a.occupant_name ||
                      (a.is_occupied ? 'مشغول' : 'وحدة شاغرة'),
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
                  })
                );
                setRemoteApts(mappedApts);

                const targetAptNum = explicitAptNum || rpcData.suggested_apartment_number;
                if (targetAptNum) {
                  const matchedApt = mappedApts.find(
                    (a) => a.apartment_number === targetAptNum
                  );
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
                  if (resolvedName) {
                    setFullName(resolvedName);
                  }
                  if (resolvedPhone) {
                    setPhone(resolvedPhone);
                  }
                  if (resolvedFloor) {
                    setFloorNumber(resolvedFloor);
                  }
                  setIsInviteCodeAutoMatched(true);
                  setMatchedAptDetail({
                    apartmentNumber: targetAptNum,
                    occupantName: resolvedName || null,
                    occupantPhone: resolvedPhone || null,
                    floorNumber: resolvedFloor || null,
                  });
                } else {
                  setIsInviteCodeAutoMatched(false);
                  setMatchedAptDetail(null);
                }
              }
            }
            return;
          }

          // 2. Direct table fallback if RPC wasn't executed
          const { data, error } = await supabase
            .from('buildings')
            .select('*')
            .ilike('building_code', code)
            .maybeSingle();

          if (!isMounted) return;

          if (data && !error) {
            setRemoteBuilding(data as Building);
            const { data: aptsData } = await supabase
              .from('apartments')
              .select('*')
              .eq('building_id', data.id);
            if (isMounted && aptsData) {
              const mappedApts = aptsData as Apartment[];
              setRemoteApts(mappedApts);

              if (explicitAptNum) {
                const matchedApt = mappedApts.find(
                  (a) => a.apartment_number === explicitAptNum
                );
                const resolvedName =
                  matchedApt?.occupant_name ||
                  (matchedApt?.resident_name &&
                  matchedApt.resident_name !== 'وحدة شاغرة' &&
                  matchedApt.resident_name !== 'مشغول'
                    ? matchedApt.resident_name
                    : '');
                const resolvedPhone =
                  matchedApt?.occupant_phone ||
                  matchedApt?.resident_phone ||
                  '';
                const resolvedFloor =
                  matchedApt?.floor_number ||
                  (explicitAptNum && /^\d+$/.test(explicitAptNum)
                    ? explicitAptNum.length >= 2
                      ? `الدور ${explicitAptNum.slice(0, -1)}`
                      : 'الدور الأول'
                    : '');

                setApartmentNumber(explicitAptNum);
                if (resolvedName) {
                  setFullName(resolvedName);
                }
                if (resolvedPhone) {
                  setPhone(resolvedPhone);
                }
                if (resolvedFloor) {
                  setFloorNumber(resolvedFloor);
                }
                setIsInviteCodeAutoMatched(true);
                setMatchedAptDetail({
                  apartmentNumber: explicitAptNum,
                  occupantName: resolvedName || null,
                  occupantPhone: resolvedPhone || null,
                  floorNumber: resolvedFloor || null,
                });
              }
            }
          } else {
            setRemoteBuilding(null);
            setRemoteApts([]);
            setIsInviteCodeAutoMatched(false);
            setMatchedAptDetail(null);
          }
        } catch {
          if (isMounted) {
            setRemoteBuilding(null);
            setRemoteApts([]);
            setIsInviteCodeAutoMatched(false);
            setMatchedAptDetail(null);
          }
        }
      } else {
        setRemoteBuilding(null);
        setRemoteApts([]);
        setIsInviteCodeAutoMatched(false);
        setMatchedAptDetail(null);
      }
    };

    fetchBuilding();

    return () => {
      isMounted = false;
    };
  }, [buildingCode]);

  // Lookup target building if code matches an existing building
  const matchedBuilding = useMemo(() => {
    const raw = buildingCode.trim().toUpperCase();
    if (!raw) return null;
    const parts = raw.split('-');
    const code =
      parts.length >= 3 && parts[0] === 'BLD' && parts[2].trim().length > 0
        ? `${parts[0]}-${parts[1]}`
        : raw;

    return (
      buildings.find(
        (b) =>
          b.building_code.toUpperCase() === code ||
          b.building_code.toUpperCase() === raw
      ) ||
      (remoteBuilding &&
      (remoteBuilding.building_code.toUpperCase() === code ||
        remoteBuilding.building_code.toUpperCase() === raw)
        ? remoteBuilding
        : null)
    );
  }, [buildingCode, buildings, remoteBuilding]);

  // Combined apartments list
  const allAvailableApts = useMemo(() => {
    const map = new Map<string, Apartment>();
    apartments.forEach((a) => map.set(a.id, a));
    remoteApts.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [apartments, remoteApts]);

  // Lookup if the entered apartment has pre-registered occupant data in this building
  const selectedAptPreData = useMemo(() => {
    if (!matchedBuilding || !apartmentNumber.trim()) return null;
    const cleanNum = apartmentNumber.trim();
    return (
      allAvailableApts.find(
        (a) =>
          a.building_id === matchedBuilding.id &&
          a.apartment_number === cleanNum &&
          a.is_active &&
          (Boolean(a.occupant_name) || Boolean(a.occupant_phone))
      ) || null
    );
  }, [allAvailableApts, matchedBuilding, apartmentNumber]);

  const normalizedInputPhone = useMemo(
    () => phone.replace(/\D/g, ''),
    [phone]
  );

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال الاسم بالكامل ورقم الهاتف.');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedRoleTab === 'resident') {
        if (!buildingCode.trim() || !apartmentNumber.trim()) {
          Alert.alert('تنبيه', 'يرجى إدخال كود المبنى ورقم الشقة.');
          return;
        }

        let currentMatched = matchedBuilding;
        if (!currentMatched && isSupabaseConfigured) {
          const { data: rpcData } = await supabase.rpc(
            'lookup_building_apartments_for_join',
            { p_building_code: buildingCode.trim().toUpperCase() }
          );
          if (rpcData && rpcData.building_id) {
            currentMatched = {
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
          }
        }

        if (!currentMatched) {
          Alert.alert(
            'كود المبنى غير مسجل',
            `كود المبنى (${buildingCode.trim().toUpperCase()}) غير موجود بالنظام. يرجى التأكد من كود العمارة الصحيح من رئيس الاتحاد.`
          );
          return;
        }

        await requestJoinBuilding({
          fullName: fullName.trim(),
          phone: phone.trim(),
          buildingCode: buildingCode.trim().toUpperCase(),
          apartmentNumber: apartmentNumber.trim(),
          floorNumber: floorNumber.trim() || 'الدور الأول',
        });
        setJustSubmittedJoin(true);
      } else {
        if (!buildingName.trim()) {
          Alert.alert('تنبيه', 'يرجى إدخال اسم العمارة أو البرج.');
          return;
        }
        const res = await createBuildingForAdmin({
          fullName: fullName.trim(),
          phone: phone.trim(),
          buildingName: buildingName.trim(),
          address: buildingAddress.trim() || 'القاهرة',
          totalApartments: parseInt(totalApartments, 10) || 16,
          defaultMonthlyDues: parseFloat(defaultMonthlyDues) || 400,
          adminApartmentNumber: adminApartment.trim() || '1',
        });
        setCreatedBuildingCode(res.buildingCode);
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'حدث خطأ أثناء التسجيل');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top App Branding & Trust Indicator (from _23/code.html) */}
      <View style={styles.topBrandRow}>
        <View style={styles.brandGroup}>
          <View style={styles.logoIconBox}>
            <MaterialIcons name="apartment" size={22} color={COLORS.onPrimary} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.brandTitle}>إتّحاد</Text>
            <Text style={styles.brandSub}>منصة إدارة اتحادات الملاك</Text>
          </View>
        </View>

        <View style={styles.verifiedPill}>
          <MaterialIcons name="verified-user" size={15} color={COLORS.secondary} />
          <Text style={styles.verifiedPillText}>نظام موثّق</Text>
        </View>
      </View>

      {/* Pending Approval State View (Screen 1 in design/stitch_/design.md) */}
      {isResidentPending && (
        <View style={styles.pendingBannerCard}>
          <View style={styles.pendingHeaderRow}>
            <ActivityIndicator size="small" color={COLORS.statusPending} />
            <Text style={styles.pendingTitle}>طلبك قيد الموافقة ⏳</Text>
          </View>
          <Text style={styles.pendingBody}>
            تم إرسال طلب انضمامك لشقة رقم ({currentUser.apartment_number}) بكود
            المبنى ({buildingCode}) بنجاح. سيقوم رئيس اتحاد الملاك بمراجعة الطلب
            وتفعيل حسابك فوراً.
          </Text>
          <View style={styles.pendingActionsRow}>
            <TouchableOpacity
              style={styles.switchAdminPreviewBtn}
              onPress={() => {
                switchRole('admin');
                setAuthenticated(true);
                onClose?.();
              }}
            >
              <MaterialIcons
                name="admin-panel-settings"
                size={16}
                color={COLORS.onPrimary}
              />
              <Text style={styles.switchAdminPreviewText}>
                انتقل لواجهة المدير لاعتماد الطلب الآن
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Newly Created Building Code Banner */}
      {createdBuildingCode && (
        <View style={styles.createdCodeBanner}>
          <View style={styles.createdCodeTop}>
            <MaterialIcons name="celebration" size={20} color={COLORS.secondary} />
            <Text style={styles.createdCodeTitle}>
              تم تأسيس العمارة وتفعيل الفترة التجريبية (60 يوماً Pro)!
            </Text>
          </View>
          <Text style={styles.createdCodeSub}>
            شارك كود المبنى الفريد التالي مع السكان للانضمام:
          </Text>
          <View style={styles.codeHighlightBox}>
            <Text style={styles.codeHighlightText}>{createdBuildingCode}</Text>
          </View>

          {/* Copy & WhatsApp Share Buttons */}
          <View style={styles.bannerActionsRow}>
            <TouchableOpacity
              style={styles.copyCodeBtn}
              activeOpacity={0.8}
              onPress={() => copyToClipboard(createdBuildingCode, 'كود المبنى')}
            >
              <MaterialIcons
                name="content-copy"
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.copyCodeBtnText}>نسخ الكود</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.whatsAppShareBtn}
              activeOpacity={0.8}
              onPress={() =>
                sendWhatsAppInvite({
                  buildingName: buildingName || 'العمارة',
                  buildingCode: createdBuildingCode,
                })
              }
            >
              <MaterialIcons name="share" size={16} color="#FFFFFF" />
              <Text style={styles.whatsAppShareBtnText}>إرسال عبر واتساب 📲</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.goDashboardBtn}
            onPress={() => {
              setAuthenticated(true);
              onClose?.();
            }}
          >
            <Text style={styles.goDashboardText}>الدخول للوحة تحكم رئيس الاتحاد</Text>
            <MaterialIcons name="arrow-back" size={18} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Hero Header */}
      <View style={styles.heroSection}>
        <View style={styles.heroTitleRow}>
          <Text style={styles.heroTitle}>إنشاء حساب / الانضمام للعقار</Text>
          {onClose && (
            <TouchableOpacity
              style={styles.quickBackBtn}
              onPress={() => {
                setAuthenticated(true);
                onClose();
              }}
            >
              <Text style={styles.quickBackText}>العودة للتطبيق</Text>
              <MaterialIcons
                name="arrow-back"
                size={15}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.heroSubtitle}>
          اختر صفتك في العقار للانضمام بكود المبنى أو تأسيس اتحاد ملاك جديد بفترة
          تجريبية 60 يوماً مجاناً
        </Text>
      </View>

      {/* Role Selector Cards (from _23/code.html) */}
      <Text style={styles.sectionLabel}>حدد صفتك في العقار:</Text>
      <View style={styles.roleCardsRow}>
        {/* Resident Option */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setSelectedRoleTab('resident')}
          style={[
            styles.roleCard,
            selectedRoleTab === 'resident'
              ? styles.roleCardSelected
              : styles.roleCardUnselected,
          ]}
        >
          <View style={styles.roleCardTopRow}>
            <View
              style={[
                styles.roleIconBox,
                selectedRoleTab === 'resident' && styles.roleIconBoxActive,
              ]}
            >
              <MaterialIcons
                name="vpn-key"
                size={20}
                color={
                  selectedRoleTab === 'resident'
                    ? COLORS.primaryContainer
                    : COLORS.onSurfaceVariant
                }
              />
            </View>
            <View
              style={[
                styles.radioCircle,
                selectedRoleTab === 'resident' && styles.radioCircleActive,
              ]}
            >
              {selectedRoleTab === 'resident' && (
                <MaterialIcons name="check" size={13} color={COLORS.onPrimary} />
              )}
            </View>
          </View>
          <Text style={styles.roleCardTitle}>مالك / ساكن وحدة</Text>
          <Text style={styles.roleCardDesc}>
            الانضمام بكود المبنى، سداد الاشتراكات، ومتابعة لوحة الشفافية.
          </Text>
        </TouchableOpacity>

        {/* Admin Option */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setSelectedRoleTab('admin')}
          style={[
            styles.roleCard,
            selectedRoleTab === 'admin'
              ? styles.roleCardSelected
              : styles.roleCardUnselected,
          ]}
        >
          <View style={styles.roleCardTopRow}>
            <View
              style={[
                styles.roleIconBox,
                selectedRoleTab === 'admin' && styles.roleIconBoxActive,
              ]}
            >
              <MaterialIcons
                name="security"
                size={20}
                color={
                  selectedRoleTab === 'admin'
                    ? COLORS.primaryContainer
                    : COLORS.onSurfaceVariant
                }
              />
            </View>
            <View
              style={[
                styles.radioCircle,
                selectedRoleTab === 'admin' && styles.radioCircleActive,
              ]}
            >
              {selectedRoleTab === 'admin' && (
                <MaterialIcons name="check" size={13} color={COLORS.onPrimary} />
              )}
            </View>
          </View>
          <Text style={styles.roleCardTitle}>مدير / رئيس الاتحاد</Text>
          <Text style={styles.roleCardDesc}>
            إنشاء العمارة (60 يوم تجربة Pro)، إدارة الخزينة، واعتماد التحصيلات.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Form Card */}
      <View style={styles.formCard}>
        {/* Role-Specific Section */}
        {selectedRoleTab === 'resident' ? (
          <View style={styles.roleSubBox}>
            <View style={styles.roleSubHeader}>
              <MaterialIcons name="vpn-key" size={20} color={COLORS.secondary} />
              <Text style={styles.roleSubTitle}>
                الانضمام إلى العقار
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, marginBottom: 14, lineHeight: 20 }}>
              أدخل كود المبنى أو كود دعوتك الخاص بالشقة لعرض نموذج التسجيل وتأكيد بياناتك.
            </Text>

            {/* Step 1: Code Input (Always Visible) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>
                كود المبنى أو كود دعوتك الخاص
              </Text>
              <TextInput
                style={[styles.codeInput]}
                value={buildingCode}
                onChangeText={(val) => setBuildingCode(val.toUpperCase())}
                autoCapitalize="characters"
                placeholder="مثال: BLD-371CF0 أو BLD-371CF0-40"
                placeholderTextColor={COLORS.outline}
              />
              {hasEnteredBuildingCode && (
                matchedBuilding ? (
                  <View style={styles.matchedBuildingPill}>
                    <MaterialIcons
                      name="verified"
                      size={16}
                      color={COLORS.secondary}
                    />
                    <Text style={styles.matchedBuildingText}>
                      تم التحقق من العقار: {matchedBuilding.name} ({matchedBuilding.address})
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.matchedBuildingPill,
                      {
                        backgroundColor: '#FEE2E2',
                        borderColor: '#EF4444',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="error-outline"
                      size={16}
                      color="#DC2626"
                    />
                    <Text
                      style={[
                        styles.matchedBuildingText,
                        { color: '#DC2626', fontWeight: '700' },
                      ]}
                    >
                      كود المبنى غير مسجل، يرجى كتابة كود عمارة حقيقي من رئيس الاتحاد.
                    </Text>
                  </View>
                )
              )}
            </View>

            {/* Step 2: Unlocks ONLY when Building is Verified */}
            {matchedBuilding ? (
              <View style={{ marginTop: 8 }}>
                {/* Visual Banner when an Apartment Invite Code was Entered */}
                {isInviteCodeAutoMatched && (
                  <View
                    style={{
                      backgroundColor: '#EFF6FF',
                      borderWidth: 1,
                      borderColor: '#93C5FD',
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 16,
                      flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <MaterialIcons name="auto-awesome" size={22} color="#2563EB" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF', textAlign: 'right' }}>
                        تم التعرف على شقتك رقم ({apartmentNumber}) تلقائياً! 🎯
                      </Text>
                      <Text style={{ fontSize: 11, color: '#3B82F6', textAlign: 'right', marginTop: 2 }}>
                        {matchedAptDetail?.occupantName
                          ? 'قمنا بتعبئة بياناتك المسجلة مسبقاً لدى إدارة العقار، يمكنك مراجعتها والتعديل عليها بحرية.'
                          : 'تم تحديد رقم شقتك بنجاح، يرجى استكمال بيانات اسمك وهاتفك للتأكيد.'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Personal Information Inputs */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.inputLabel}>الاسم بالكامل (ثلاثي أو رباعي)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="مثال: م. أحمد عبد العزيز شاهين"
                    placeholderTextColor={COLORS.outline}
                  />
                </View>

                <View style={styles.twoColRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>رقم الهاتف (واتساب)</Text>
                    <TextInput
                      style={[styles.textInput, styles.ltrInput]}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="010XXXXXXXX"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>البريد الإلكتروني (اختياري)</Text>
                    <TextInput
                      style={[styles.textInput, styles.ltrInput]}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      placeholder="name@mail.com"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                </View>

                {/* Apartment Number & Floor Inputs */}
                <View style={styles.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>رقم الشقة</Text>
                    <TextInput
                      style={styles.textInput}
                      value={apartmentNumber}
                      onChangeText={(val) => {
                        setApartmentNumber(val);
                        setDismissedAptMatch(false);
                        const clean = val.trim();
                        if (clean && matchedBuilding) {
                          const found = allAvailableApts.find(
                            (a) =>
                              a.building_id === matchedBuilding.id &&
                              a.apartment_number === clean &&
                              a.is_active
                          );
                          if (found) {
                            const name =
                              found.occupant_name ||
                              (found.resident_name &&
                              found.resident_name !== 'وحدة شاغرة' &&
                              found.resident_name !== 'مشغول'
                                ? found.resident_name
                                : '');
                            const phoneVal =
                              found.occupant_phone || found.resident_phone || '';
                            const floorVal =
                              found.floor_number ||
                              (clean && /^\d+$/.test(clean)
                                ? clean.length >= 2
                                  ? `الدور ${clean.slice(0, -1)}`
                                  : 'الدور الأول'
                                : '');
                            if (name) setFullName(name);
                            if (phoneVal) setPhone(phoneVal);
                            if (floorVal) setFloorNumber(floorVal);
                            setIsInviteCodeAutoMatched(true);
                            setMatchedAptDetail({
                              apartmentNumber: clean,
                              occupantName: name || null,
                              occupantPhone: phoneVal || null,
                              floorNumber: floorVal || null,
                            });
                          }
                        }
                      }}
                      placeholder="مثال: 12"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>الطابق / الدور</Text>
                    <TextInput
                      style={styles.textInput}
                      value={floorNumber}
                      onChangeText={setFloorNumber}
                      placeholder="مثال: الدور الثالث"
                      placeholderTextColor={COLORS.outline}
                    />
                  </View>
                </View>

            {/* Prompt resident to verify pre-registered data if this apartment was pre-registered by Admin */}
            {selectedAptPreData && !dismissedAptMatch && (
              <View style={styles.autoMatchCard}>
                <View style={styles.autoMatchHeader}>
                  <MaterialIcons
                    name="assignment-ind"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.autoMatchTitle,
                      { color: COLORS.onSurface, flex: 1 },
                    ]}
                  >
                    بيانات الوحدة المسجلة مسبقاً لدى إدارة العقار:
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDismissedAptMatch(true)}
                    style={{ padding: 4 }}
                  >
                    <MaterialIcons
                      name="close"
                      size={18}
                      color={COLORS.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[
                    styles.autoMatchBody,
                    { color: COLORS.onSurfaceVariant },
                  ]}
                >
                  • الاسم المسجل: {selectedAptPreData.occupant_name || 'غير محدد'}
                  {'\n'}• الهاتف المسجل: {selectedAptPreData.occupant_phone || 'غير محدد'}
                  {'\n'}• الطابق: {selectedAptPreData.floor_number || 'غير محدد'}
                </Text>

                {/* Show mismatch alert if resident entered a name different from occupant_name */}
                {Boolean(fullName.trim()) &&
                  Boolean(selectedAptPreData.occupant_name) &&
                  fullName.trim() !== selectedAptPreData.occupant_name && (
                    <View
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        padding: 8,
                        borderRadius: 8,
                        marginTop: 4,
                        borderWidth: 1,
                        borderColor: '#F59E0B',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#B45309',
                          textAlign: 'right',
                          lineHeight: 16,
                        }}
                      >
                        💡 ملاحظة: الاسم الذي كتبته ({fullName.trim()}) يختلف عن الاسم المسجل لدى الإدارة ({selectedAptPreData.occupant_name}). يمكنك اختيار الاستمرار ببياناتك أو تعبئة المسجل.
                      </Text>
                    </View>
                  )}

                <View
                  style={{
                    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <TouchableOpacity
                    style={[styles.switchAdminPreviewBtn, { flex: 1.1 }]}
                    onPress={() => {
                      if (selectedAptPreData.occupant_name) {
                        setFullName(selectedAptPreData.occupant_name);
                      }
                      if (selectedAptPreData.occupant_phone) {
                        setPhone(selectedAptPreData.occupant_phone);
                      }
                      if (selectedAptPreData.floor_number) {
                        setFloorNumber(selectedAptPreData.floor_number);
                      }
                      setDismissedAptMatch(true);
                    }}
                  >
                    <MaterialIcons
                      name="check"
                      size={15}
                      color={COLORS.onPrimary}
                    />
                    <Text style={styles.switchAdminPreviewText}>
                      نعم، استخدام بيانات العقار
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: COLORS.surfaceContainer,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: COLORS.borderSubtle,
                    }}
                    onPress={() => setDismissedAptMatch(true)}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: COLORS.onSurface,
                      }}
                    >
                      الاحتفاظ بما كتبته
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
              </View>
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 24,
                  paddingHorizontal: 16,
                  backgroundColor: COLORS.surfaceContainer,
                  borderRadius: 12,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: COLORS.borderSubtle,
                  borderStyle: 'dashed',
                }}
              >
                <MaterialIcons name="lock-outline" size={28} color={COLORS.onSurfaceVariant} />
                <Text style={{ fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  أدخل كود العمارة أو كود دعوتك في الخانة أعلاه لعرض نموذج البيانات وتأكيد طلبك.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.roleSubBox}>
            <View style={styles.roleSubHeader}>
              <MaterialIcons
                name="domain-add"
                size={20}
                color={COLORS.secondary}
              />
              <Text style={styles.roleSubTitle}>
                بيانات تأسيس العمارة (فترة تجريبية 60 يوماً Pro)
              </Text>
            </View>

            {/* Admin Personal Info */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>الاسم بالكامل (رئيس الاتحاد)</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثال: م. أحمد عبد العزيز شاهين"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.twoColRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>رقم الهاتف (واتساب)</Text>
                <TextInput
                  style={[styles.textInput, styles.ltrInput]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="010XXXXXXXX"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>البريد الإلكتروني</Text>
                <TextInput
                  style={[styles.textInput, styles.ltrInput]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="name@mail.com"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>اسم المبنى أو البرج السكني</Text>
              <TextInput
                style={styles.textInput}
                value={buildingName}
                onChangeText={setBuildingName}
                placeholder="مثال: برج الأمل السكني"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>العنوان التفصيلي</Text>
              <TextInput
                style={styles.textInput}
                value={buildingAddress}
                onChangeText={setBuildingAddress}
                placeholder="مثال: شارع النزهة - التجمع الخامس، القاهرة"
                placeholderTextColor={COLORS.outline}
              />
            </View>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>إجمالي عدد الشقق</Text>
                <TextInput
                  style={[styles.textInput, styles.ltrInput]}
                  value={totalApartments}
                  onChangeText={setTotalApartments}
                  keyboardType="numeric"
                  placeholder="مثال: 16"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>الاشتراك الشهري (ج.م)</Text>
                <TextInput
                  style={[styles.textInput, styles.ltrInput]}
                  value={defaultMonthlyDues}
                  onChangeText={setDefaultMonthlyDues}
                  keyboardType="numeric"
                  placeholder="مثال: 400"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>شقة المدير</Text>
                <TextInput
                  style={[styles.textInput, styles.ltrInput]}
                  value={adminApartment}
                  onChangeText={setAdminApartment}
                  placeholder="مثال: 12"
                  placeholderTextColor={COLORS.outline}
                />
              </View>
            </View>
          </View>
        )}

        {/* Primary CTA Button (Shown for Admin OR when Resident verified building) */}
        {(selectedRoleTab === 'admin' || matchedBuilding) && (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <MaterialIcons
                  name={
                    selectedRoleTab === 'resident'
                      ? 'how-to-reg'
                      : 'add-business'
                  }
                  size={20}
                  color={COLORS.onPrimary}
                />
                <Text style={styles.submitBtnText}>
                  {selectedRoleTab === 'resident'
                    ? 'طلب الانضمام للعمارة'
                    : 'تأسيس العمارة وتوليد كود المبنى'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  topBrandRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandGroup: {
    flexDirection: 'row-reverse',
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
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  brandSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  verifiedPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  pendingBannerCard: {
    backgroundColor: COLORS.statusPendingBg,
    borderWidth: 1,
    borderColor: COLORS.statusPending,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pendingHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.statusPendingText,
  },
  pendingBody: {
    fontSize: 13,
    color: COLORS.statusPendingText,
    textAlign: 'right',
    lineHeight: 20,
  },
  pendingActionsRow: {
    marginTop: 12,
    flexDirection: 'row-reverse',
  },
  switchAdminPreviewBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  switchAdminPreviewText: {
    color: COLORS.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  createdCodeBanner: {
    backgroundColor: COLORS.statusPaidBg,
    borderWidth: 1,
    borderColor: COLORS.statusPaid,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  createdCodeTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  createdCodeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.statusPaidText,
    textAlign: 'center',
  },
  createdCodeSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  codeHighlightBox: {
    backgroundColor: COLORS.surfaceCard,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.statusPaid,
    marginVertical: 10,
  },
  codeHighlightText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  bannerActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  copyCodeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.primaryContainer,
    borderRadius: 8,
    paddingVertical: 10,
  },
  copyCodeBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  whatsAppShareBtn: {
    flex: 1.2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366', // WhatsApp Brand Green
    borderRadius: 8,
    paddingVertical: 10,
    shadowColor: '#25D366',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  whatsAppShareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  goDashboardBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
  },
  goDashboardText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  heroSection: {
    marginBottom: 16,
  },
  heroTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  quickBackBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  quickBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
    marginBottom: 10,
  },
  roleCardsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  roleCardSelected: {
    backgroundColor: COLORS.surfaceCard,
    borderColor: COLORS.primaryContainer,
  },
  roleCardUnselected: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderColor: 'transparent',
  },
  roleCardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBoxActive: {
    backgroundColor: COLORS.surfaceContainerLow,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: COLORS.primaryContainer,
  },
  roleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  roleCardDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  textInput: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  ltrInput: {
    textAlign: 'left',
  },
  twoColRow: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },
  roleSubBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  roleSubHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  roleSubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  codeInput: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.primaryContainer,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  aptGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  matchedBuildingPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.statusPaidBg,
    borderWidth: 1,
    borderColor: COLORS.statusPaid,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  matchedBuildingText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.statusPaidText,
    flex: 1,
    textAlign: 'right',
  },
  autoMatchCard: {
    backgroundColor: COLORS.statusPaidBg,
    borderWidth: 1.5,
    borderColor: COLORS.statusPaid,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  autoMatchHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  autoMatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.statusPaidText,
  },
  autoMatchBody: {
    fontSize: 12,
    color: COLORS.onSurface,
    textAlign: 'right',
    lineHeight: 19,
  },
  aptListContainer: {
    gap: 8,
  },
  aptDetailedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  aptDetailedRowActive: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  aptDetailedRowMatched: {
    borderColor: COLORS.statusPaid,
    borderWidth: 1.5,
    backgroundColor: COLORS.statusPaidBg,
  },
  aptRowRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aptNumberBadge: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  aptNumberBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  aptNumberBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  aptNumberBadgeTextActive: {
    color: COLORS.onPrimary,
  },
  aptOccupantNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  aptFloorSubText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  aptRowLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  phoneMatchBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.statusPaid,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  phoneMatchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.statusPaidText,
  },
  submitBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
