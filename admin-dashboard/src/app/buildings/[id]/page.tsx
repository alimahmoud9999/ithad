'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ArrowRight,
  Phone,
  Mail,
  User,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  Copy,
  Check,
  Home,
  Calendar,
  Layers,
  MapPin,
  FileText,
  BadgeAlert,
  Sparkles,
  UserCheck,
  MessageSquare,
  AlertCircle,
  DollarSign,
  Vote,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { supabase } from '@/lib/supabase';
import {
  Building as BuildingType,
  UserProfile,
  Apartment,
  BuildingIssue,
  EmergencyClaim,
  Payment,
  SubscriptionPlanCode,
  BuildingSubscriptionStatus,
} from '@/types/database';

export default function BuildingDetailsPage() {
  const params = useParams();
  const buildingId = (params?.id as string) || '';

  const {
    buildings,
    users,
    apartments,
    buildingIssues,
    emergencyClaims,
    payments,
    configureBuildingOverrides,
    processingIds,
  } = useDashboard();

  // Local fallback state if loaded directly
  const [localBuilding, setLocalBuilding] = useState<BuildingType | null>(null);
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [localApartments, setLocalApartments] = useState<Apartment[]>([]);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);

  // Search & Filter state for the occupants roster
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'resident'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Technical Support section collapse
  const [supportTab, setSupportTab] = useState<'issues' | 'claims' | 'payments'>('issues');

  const handleCopy = (text: string, key: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const getWhatsAppLink = (phone?: string) => {
    if (!phone || phone === '-') return null;
    const cleanDigits = phone.replace(/\D/g, '');
    const intlPhone = cleanDigits.startsWith('0')
      ? `20${cleanDigits.slice(1)}`
      : cleanDigits.startsWith('20')
      ? cleanDigits
      : `20${cleanDigits}`;
    return `https://wa.me/${intlPhone}`;
  };

  // 1. Resolve current building
  const currentBuilding = useMemo(() => {
    const fromContext = buildings.find((b) => b.id === buildingId);
    if (fromContext) return fromContext;
    return localBuilding;
  }, [buildings, buildingId, localBuilding]);

  // Direct fetch fallback from Supabase if not in memory
  useEffect(() => {
    if (!buildingId) return;
    const existing = buildings.find((b) => b.id === buildingId);
    if (existing) return;

    let isMounted = true;
    async function fetchDirect() {
      setIsLoadingDirect(true);
      try {
        const [bldRes, usersRes, aptsRes] = await Promise.all([
          supabase.from('buildings').select('*').eq('id', buildingId).maybeSingle(),
          supabase.from('users').select('*').eq('building_id', buildingId).limit(5000),
          supabase.from('apartments').select('*').eq('building_id', buildingId).limit(5000),
        ]);

        if (isMounted) {
          if (bldRes.data) setLocalBuilding(bldRes.data as BuildingType);
          if (usersRes.data) setLocalUsers(usersRes.data as UserProfile[]);
          if (aptsRes.data) setLocalApartments(aptsRes.data as Apartment[]);
        }
      } catch (err) {
        console.error('Error fetching building details directly:', err);
      } finally {
        if (isMounted) setIsLoadingDirect(false);
      }
    }

    fetchDirect();

    return () => {
      isMounted = false;
    };
  }, [buildingId, buildings]);

  // 2. Resolve all users for this building
  const buildingUsers = useMemo(() => {
    const allKnownUsers = users.length > 0 ? users : localUsers;
    return allKnownUsers.filter(
      (u) => u.building_id === buildingId && u.role !== 'super_admin'
    );
  }, [users, localUsers, buildingId]);

  // 3. Resolve Union Head
  const unionHead = useMemo(() => {
    if (currentBuilding?.admin_id) {
      const match = buildingUsers.find((u) => u.id === currentBuilding.admin_id);
      if (match) return match;
    }
    const adminUser = buildingUsers.find((u) => u.role === 'admin');
    if (adminUser) return adminUser;

    if (currentBuilding?.admin_name) {
      return {
        id: currentBuilding.admin_id || 'admin_placeholder',
        full_name: currentBuilding.admin_name,
        phone: currentBuilding.admin_phone || '-',
        email: currentBuilding.admin_email || '-',
        role: 'admin' as const,
        status: 'active' as const,
        created_at: currentBuilding.created_at,
        building_id: currentBuilding.id,
      } as UserProfile;
    }

    return null;
  }, [currentBuilding, buildingUsers]);

  // 4. Resolve apartments list
  const buildingApartments = useMemo(() => {
    const allApts = apartments.length > 0 ? apartments : localApartments;
    return allApts.filter((a) => a.building_id === buildingId);
  }, [apartments, localApartments, buildingId]);

  // 5. Technical support records
  const currentIssues = useMemo(() => {
    return buildingIssues.filter((i) => i.building_id === buildingId);
  }, [buildingIssues, buildingId]);

  const currentClaims = useMemo(() => {
    return emergencyClaims.filter((c) => c.building_id === buildingId);
  }, [emergencyClaims, buildingId]);

  const currentPayments = useMemo(() => {
    return payments.filter((p) => p.building_id === buildingId);
  }, [payments, buildingId]);

  // 6. Filter occupants for the roster table
  const filteredOccupants = useMemo(() => {
    return buildingUsers.filter((usr) => {
      if (roleFilter !== 'all') {
        if (roleFilter === 'admin' && usr.role !== 'admin') return false;
        if (roleFilter === 'resident' && usr.role === 'admin') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (usr.full_name || '').toLowerCase().includes(q);
        const matchPhone = (usr.phone || '').toLowerCase().includes(q);
        const matchEmail = (usr.email || '').toLowerCase().includes(q);
        const matchApt = (usr.apartment_number || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchApt) return false;
      }

      return true;
    });
  }, [buildingUsers, roleFilter, searchQuery]);

  // Quick Action: Extend subscription by 30 days
  const handleExtendSubscription = async () => {
    if (!currentBuilding) return;
    const currentEnd = new Date(currentBuilding.subscription_ends_at || new Date());
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);

    await configureBuildingOverrides({
      buildingId: currentBuilding.id,
      planCode: currentBuilding.plan_code,
      subscriptionStatus: 'active',
      subscriptionEndsAt: newEnd.toISOString(),
      customMonthlyPrice: currentBuilding.custom_monthly_price ?? null,
      maxApartmentsOverride: currentBuilding.max_apartments_override ?? null,
      featuresConfig: currentBuilding.features_config,
    });
  };

  // Quick Action: Toggle building active/suspended
  const handleToggleBuildingStatus = async () => {
    if (!currentBuilding) return;
    const newStatus: BuildingSubscriptionStatus =
      currentBuilding.subscription_status === 'expired' ||
      currentBuilding.subscription_status === 'read_only'
        ? 'active'
        : 'expired';

    await configureBuildingOverrides({
      buildingId: currentBuilding.id,
      planCode: currentBuilding.plan_code,
      subscriptionStatus: newStatus,
      subscriptionEndsAt: currentBuilding.subscription_ends_at,
      customMonthlyPrice: currentBuilding.custom_monthly_price ?? null,
      maxApartmentsOverride: currentBuilding.max_apartments_override ?? null,
      featuresConfig: currentBuilding.features_config,
    });
  };

  // Export roster to CSV
  const handleExportRosterCSV = () => {
    if (filteredOccupants.length === 0) return;

    const headers = [
      'الاسم الكامل',
      'الصفة / الدور',
      'البريد الإلكتروني',
      'رقم الهاتف',
      'رقم الشقة',
      'الطابق',
      'حالة الحساب',
      'تاريخ الانضمام',
    ];

    const rows = filteredOccupants.map((u) => [
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      `"${u.role === 'admin' ? 'رئيس اتحاد ملاك' : 'مالك / ساكن'}"`,
      `"${(u.email || '-').replace(/"/g, '""')}"`,
      `"${(u.phone || '-').replace(/"/g, '""')}"`,
      `"${(u.apartment_number || '-').replace(/"/g, '""')}"`,
      `"${(u.floor_number || '-').replace(/"/g, '""')}"`,
      `"${u.status === 'active' ? 'مفعل' : 'معلق'}"`,
      `"${(u.created_at || '').slice(0, 10)}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `bld_${currentBuilding?.building_code}_roster_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentBuilding && isLoadingDirect) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-600">
          جاري تحميل بيانات وسجل العمارة من قاعدة البيانات...
        </p>
      </div>
    );
  }

  if (!currentBuilding && !isLoadingDirect) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <BadgeAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">
          لم يتم العثور على العمارة المطلوبة
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          قد تكون العمارة حُذفت أو أن المعرف غير صحيح. يمكنك الرجوع لقائمة العمارات.
        </p>
        <Link
          href="/buildings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E293B] text-white text-xs font-bold hover:bg-slate-800 transition"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لإدارة العمارات
        </Link>
      </div>
    );
  }

  const activeResidentsCount = buildingUsers.filter((u) => u.status === 'active').length;
  const pendingResidentsCount = buildingUsers.filter((u) => u.status === 'pending').length;
  const totalCapacity = currentBuilding?.max_apartments_override || currentBuilding?.total_apartments || 16;
  const capacityPercent = Math.min(
    100,
    Math.round((buildingApartments.length / (totalCapacity || 1)) * 100)
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Link
            href="/buildings"
            className="hover:text-[#10B981] transition flex items-center gap-1 text-slate-600"
          >
            <ArrowRight className="w-4 h-4" />
            <span>إدارة العمارات</span>
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-extrabold">
            تفاصيل وسجل: {currentBuilding?.name}
          </span>
        </div>

        <Link
          href="/buildings"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition w-fit"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع لقائمة العمارات
        </Link>
      </div>

      {/* Building Header Card with Quick Admin Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Building Name & Badges */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Building2 className="w-8 h-8 text-[#10B981]" />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {currentBuilding?.name}
                </h1>
                <span className="px-3 py-1 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-xs font-extrabold uppercase">
                  باقة {currentBuilding?.plan_code}
                </span>
                {currentBuilding?.subscription_status === 'active' ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                    نشطة (Active)
                  </span>
                ) : currentBuilding?.subscription_status === 'trial' ? (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
                    تجريبية (Trial)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 text-xs font-bold">
                    منتهية / موقفة (Expired)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {currentBuilding?.address || currentBuilding?.city || 'مصر'}
                </span>
                {currentBuilding?.registration_number && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    رقم القيد: {currentBuilding.registration_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  ينتهي الاشتراك: {(currentBuilding?.subscription_ends_at || '').slice(0, 10)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Join Code */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
            {/* Join Code Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-300 block font-bold">كود الانضمام:</span>
                <span className="text-lg font-mono font-black text-emerald-300 tracking-wider">
                  {currentBuilding?.building_code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(currentBuilding?.building_code || '', 'code')}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="نسخ كود الانضمام"
              >
                {copiedKey === 'code' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Action Buttons: Extend, Suspend */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExtendSubscription}
                disabled={Boolean(processingIds[`cfg_${currentBuilding?.id}`])}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                title="تمديد الاشتراك 30 يوم إضافية"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>تمديد 30 يوم</span>
              </button>

              <button
                type="button"
                onClick={handleToggleBuildingStatus}
                disabled={Boolean(processingIds[`cfg_${currentBuilding?.id}`])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                  currentBuilding?.subscription_status === 'active' ||
                  currentBuilding?.subscription_status === 'trial'
                    ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                }`}
                title="إيقاف العمارة مؤقتاً أو إعادة تفعيلها"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>
                  {currentBuilding?.subscription_status === 'active' ||
                  currentBuilding?.subscription_status === 'trial'
                    ? 'إيقاف مؤقت'
                    : 'تفعيل العمارة'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          {/* 1. Apartments Capacity */}
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>الشقق المسجلة</span>
              <span className="font-bold text-emerald-400">{capacityPercent}%</span>
            </div>
            <div className="text-xl font-extrabold text-white mt-1">
              {buildingApartments.length}{' '}
              <span className="text-xs font-normal text-slate-400">من {totalCapacity} شقة</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-[#10B981] h-1.5 rounded-full transition-all"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>

          {/* 2. Active vs Pending Residents */}
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
            <span className="text-xs text-slate-300 block">السكان والملاك</span>
            <div className="text-xl font-extrabold text-white mt-1">
              {buildingUsers.length}{' '}
              <span className="text-xs font-normal text-slate-400">عضو</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-1.5">
              <span className="text-emerald-400 font-bold">{activeResidentsCount} مفعل</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">{pendingResidentsCount} معلق</span>
            </div>
          </div>

          {/* 3. Fund Balance */}
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
            <span className="text-xs text-slate-300 block">رصيد الخزينة</span>
            <div className="text-xl font-black text-emerald-300 mt-1">
              {(currentBuilding?.fund_balance ?? 0).toLocaleString()} ج.م
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              اشتراك الشقة: {currentBuilding?.default_monthly_dues ?? 0} ج.م/شهر
            </div>
          </div>

          {/* 4. Plan & Features */}
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5">
            <span className="text-xs text-slate-300 block">الباقة والتسعير</span>
            <div className="text-xl font-black text-white mt-1 uppercase">
              {currentBuilding?.plan_code}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1.5 font-bold">
              {currentBuilding?.custom_monthly_price != null
                ? `سعر مخصص: ${currentBuilding.custom_monthly_price} ج.م`
                : 'السعر الافتراضي للباقة'}
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. UNION HEAD (رئيس اتحاد الملاك) WITH WHATSAPP & CALL BUTTONS       */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  بيانات رئيس اتحاد الملاك (Union Head)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  مدير العمارة
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                البيانات الرسمية ومعلومات الاتصال والدخول الخاصة بمدير ورئيس اتحاد الملاك
              </p>
            </div>
          </div>

          {/* Quick Contact Action Buttons */}
          {unionHead && unionHead.phone && unionHead.phone !== '-' && (
            <div className="flex items-center gap-2">
              {getWhatsAppLink(unionHead.phone) && (
                <a
                  href={getWhatsAppLink(unionHead.phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  title="مراسلة واتساب فورية"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>واتساب مباشر</span>
                </a>
              )}
              <a
                href={`tel:${unionHead.phone}`}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                title="اتصال هاتفي"
              >
                <Phone className="w-4 h-4 text-[#10B981]" />
                <span>اتصال هاتف</span>
              </a>
            </div>
          )}
        </div>

        {unionHead ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Name */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/40 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  اسم رئيس الاتحاد
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 font-extrabold text-[11px]">
                  رئيس اتحاد
                </span>
              </div>
              <div className="text-base font-black text-slate-900">
                {unionHead.full_name || 'غير محدد'}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {unionHead.apartment_number
                    ? `شقة ${unionHead.apartment_number}`
                    : 'مدير العقار'}
                  {unionHead.floor_number && ` • الطابق ${unionHead.floor_number}`}
                </span>
              </div>
            </div>

            {/* 2. Phone */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  رقم الهاتف
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(unionHead.phone || '', 'admin_ph')}
                  className="text-slate-400 hover:text-slate-700 transition"
                  title="نسخ رقم الهاتف"
                >
                  {copiedKey === 'admin_ph' ? (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> تم النسخ
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-base font-mono font-extrabold text-slate-900 dir-ltr text-right">
                {unionHead.phone && unionHead.phone !== '-' ? (
                  <a
                    href={`tel:${unionHead.phone}`}
                    className="hover:text-emerald-600 hover:underline transition"
                  >
                    {unionHead.phone}
                  </a>
                ) : (
                  <span className="text-slate-400">غير مسجل</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 pt-1">رقم التواصل المعتمد للاتحاد</div>
            </div>

            {/* 3. Login Email */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  البريد الإلكتروني (المسجل به)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(unionHead.email || '', 'admin_em')}
                  className="text-slate-400 hover:text-slate-700 transition"
                  title="نسخ الإيميل"
                >
                  {copiedKey === 'admin_em' ? (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Check className="w-3.5 h-3.5" /> تم النسخ
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="text-base font-mono font-bold text-slate-900 truncate">
                {unionHead.email && unionHead.email !== '-' ? (
                  <a
                    href={`mailto:${unionHead.email}`}
                    className="hover:text-blue-600 hover:underline transition"
                  >
                    {unionHead.email}
                  </a>
                ) : (
                  <span className="text-slate-400">غير مسجل</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 pt-1">الحساب المستخدم للدخول على التطبيق</div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-sm">
              <BadgeAlert className="w-4 h-4 text-amber-600" />
              لم يتم تعيين حساب رئيس اتحاد لهذه العمارة بعد
            </div>
            <p className="text-slate-600">
              يمكن لرئيس الاتحاد التسجيل عبر التطبيق وإدخال كود العمارة ({currentBuilding?.building_code}) ليرتبط بالعمارة كمدير تلقائياً.
            </p>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 2. OCCUPANTS & OWNERS ROSTER (سجل الملاك وشاغلي العمارة)              */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#10B981]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  سجل الملاك وشاغلي العمارة (Building Occupants & Owners Roster)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold font-mono">
                  {buildingUsers.length} مسجل
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                سجل بيانات جميع الملاك والسكان، أرقام تليفوناتهم، إيميلاتهم، والوحدات التابعة لهم مع تمييز رئيس الاتحاد والمالك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportRosterCSV}
            disabled={filteredOccupants.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition self-start sm:self-auto disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[#10B981]" />
            <span>تصدير السجل (CSV)</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم التليفون، الإيميل، أو رقم الشقة..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({buildingUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                roleFilter === 'admin'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              رئيس الاتحاد ({buildingUsers.filter((u) => u.role === 'admin').length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('resident')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                roleFilter === 'resident'
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الملاك والسكان ({buildingUsers.filter((u) => u.role !== 'admin').length})
            </button>
          </div>
        </div>

        {/* Occupants Table */}
        {filteredOccupants.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700">لا يوجد أعضاء مطابقين للبحث</div>
            <p className="text-xs text-slate-500">تأكد من كتابة الاسم أو رقم الهاتف بشكل صحيح أو أزل الفلتر</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1E293B] text-white font-bold">
                  <tr>
                    <th className="py-3.5 px-4">الاسم الكامل</th>
                    <th className="py-3.5 px-4">صفة العضوية (التاج)</th>
                    <th className="py-3.5 px-4">رقم التليفون والتواصل</th>
                    <th className="py-3.5 px-4">البريد الإلكتروني (المسجل به)</th>
                    <th className="py-3.5 px-4">الوحدة / الشقة</th>
                    <th className="py-3.5 px-4">حالة الحساب</th>
                    <th className="py-3.5 px-4">تاريخ الانضمام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredOccupants.map((usr) => {
                    const isHead = usr.role === 'admin';
                    const waLink = getWhatsAppLink(usr.phone);

                    return (
                      <tr
                        key={usr.id}
                        className={`transition hover:bg-slate-50/90 ${
                          isHead ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                            {isHead ? (
                              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span>{usr.full_name || 'بدون اسم'}</span>
                          </div>
                          {usr.residency_type && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {usr.residency_type === 'owner_resident'
                                ? 'مالك مقيم'
                                : usr.residency_type === 'non_resident_owner'
                                ? 'مالك غير مقيم'
                                : 'مستأجر'}
                            </div>
                          )}
                        </td>

                        {/* Tag */}
                        <td className="py-3.5 px-4">
                          {isHead ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-xs font-black shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              رئيس اتحاد
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold">
                              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                              مالك / ساكن
                            </span>
                          )}
                        </td>

                        {/* Phone & Contact Buttons */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 dir-ltr text-right">
                              {usr.phone ? (
                                <a
                                  href={`tel:${usr.phone}`}
                                  className="hover:text-emerald-600 hover:underline transition"
                                >
                                  {usr.phone}
                                </a>
                              ) : (
                                '-'
                              )}
                            </span>

                            {usr.phone && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(usr.phone || '', `ph_${usr.id}`)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                                  title="نسخ رقم التليفون"
                                >
                                  {copiedKey === `ph_${usr.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition"
                                    title="مراسلة عبر واتساب"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-800">
                              {usr.email ? (
                                <a
                                  href={`mailto:${usr.email}`}
                                  className="hover:text-blue-600 hover:underline transition"
                                >
                                  {usr.email}
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </span>
                            {usr.email && (
                              <button
                                type="button"
                                onClick={() => handleCopy(usr.email || '', `em_${usr.id}`)}
                                className="text-slate-400 hover:text-slate-700 transition"
                                title="نسخ الإيميل"
                              >
                                {copiedKey === `em_${usr.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Apartment & Floor */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {usr.apartment_number ? `شقة ${usr.apartment_number}` : 'غير محدد'}
                          </div>
                          {usr.floor_number && (
                            <div className="text-[11px] text-slate-500">الطابق {usr.floor_number}</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {usr.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              مفعل (Active)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              معلق ({usr.status})
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {(usr.created_at || '').slice(0, 10)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 3. TECHNICAL SUPPORT & DIAGNOSTICS (قراءة فقط للدعم الفني)          */}
      {/* ==================================================================== */}
      <div className="bg-slate-50 rounded-3xl p-6 sm:p-7 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              بيانات الدعم الفني والمتابعة (Technical Support & Diagnostics - Read Only)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              استعراض بلاغات الأعطال، المطالبات، والمدفوعات الخاصة بالعمارة لتقديم الدعم لرئيس الاتحاد
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSupportTab('issues')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                supportTab === 'issues'
                  ? 'bg-[#1E293B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              البلاغات ({currentIssues.length})
            </button>
            <button
              type="button"
              onClick={() => setSupportTab('claims')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                supportTab === 'claims'
                  ? 'bg-[#1E293B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              المطالبات ({currentClaims.length})
            </button>
            <button
              type="button"
              onClick={() => setSupportTab('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                supportTab === 'payments'
                  ? 'bg-[#1E293B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              المدفوعات ({currentPayments.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Issues */}
        {supportTab === 'issues' && (
          <div className="space-y-2 pt-2">
            {currentIssues.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                لا توجد بلاغات أعطال أو صيانة مسجلة لهذه العمارة.
              </div>
            ) : (
              currentIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900">{issue.title}</span>
                    <span className="text-slate-500 mr-2">{issue.description || 'بدون تفاصيل'}</span>
                    <span className="text-slate-400 mr-2 font-mono">
                      (مبلغ عنها: {(issue.created_at || '').slice(0, 10)})
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      issue.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {issue.status === 'resolved' ? 'تم الحل' : 'قيد المتابعة'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Claims */}
        {supportTab === 'claims' && (
          <div className="space-y-2 pt-2">
            {currentClaims.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                لا توجد مطالبات طارئة مسجلة لهذه العمارة.
              </div>
            ) : (
              currentClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900">{claim.title}</span>
                    <span className="text-slate-500 mr-2">{claim.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1E293B]">
                      {(claim.target_amount || 0).toLocaleString()} ج.م
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        claim.status === 'closed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {claim.status === 'closed' ? 'مغلقة' : 'نشطة'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Payments */}
        {supportTab === 'payments' && (
          <div className="space-y-2 pt-2">
            {currentPayments.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
                لا توجد مدفوعات مسجلة لهذه العمارة.
              </div>
            ) : (
              currentPayments.map((pmt) => (
                <div
                  key={pmt.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900">
                      {pmt.resident_name || 'ساكن'}
                    </span>
                    <span className="text-slate-500 mr-2 font-mono">
                      (شقة {pmt.apartment_number || '-'}) • شهر {pmt.billing_month}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600">
                      {(pmt.amount || 0).toLocaleString()} ج.م
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        pmt.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pmt.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pmt.status === 'paid' ? 'معتمد' : pmt.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
