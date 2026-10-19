'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  SlidersHorizontal,
  X,
  Check,
  Sparkles,
  Calendar,
  Wallet,
  Home,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Users,
  AlertCircle,
  Vote,
  FileText,
  DollarSign,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import {
  Building,
  BuildingSubscriptionStatus,
  FeaturesConfig,
  SubscriptionPlanCode,
} from '@/types/database';

const FEATURE_LABELS: {
  key: keyof FeaturesConfig;
  title: string;
  desc: string;
}[] = [
  {
    key: 'receipt_upload',
    title: 'رفع إيصالات التحويل بالصور (إنستاباي / فودافون كاش)',
    desc: 'السماح للسكان بإرفاق لقطات شاشة التحويل الإلكتروني مضغوطة في سلة payment-receipts',
  },
  {
    key: 'emergency_claims',
    title: 'إطلاق صناديق المطالبات الطارئة (Emergency Claims)',
    desc: 'إنشاء مطالبات صيانة طارئة وإغلاقها بفاتورة رسمية تلقائياً',
  },
  {
    key: 'export_reports',
    title: 'تصدير التقارير وكشوف الحساب المعتمدة (PDF / Excel)',
    desc: 'استخراج تقارير الشفافية المالية الشهرية للملاك ومجلس الاتحاد',
  },
  {
    key: 'voting',
    title: 'نظام التصويت واستطلاعات الرأي الرقمية',
    desc: 'تصويت الملاك على قرارات الصيانة الكبرى حسب حصة الملكية',
  },
  {
    key: 'maintenance_tickets',
    title: 'تذاكر الأعطال وطلبات الصيانة',
    desc: 'إبلاغ السكان عن أعطال المصعد أو السباكة ومتابعة حالتها',
  },
  {
    key: 'documents_archive',
    title: 'أرشيف عقود الصيانة ومحاضر الجمعية العمومية',
    desc: 'حفظ مستندات العمارة الرسمية وعقود شركات المصاعد والأمن',
  },
];

export default function BuildingsManagementPage() {
  const {
    buildings,
    plans,
    apartments,
    apartmentObligations,
    emergencyClaims,
    buildingIssues,
    polls,
    configureBuildingOverrides,
    resetBuildingData,
    processingIds,
  } = useDashboard();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Building Control Drawer / Modal State
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    'config' | 'apartments' | 'community' | 'reset'
  >('config');

  const [editPlanCode, setEditPlanCode] = useState<SubscriptionPlanCode>('pro');
  const [editStatus, setEditStatus] =
    useState<BuildingSubscriptionStatus>('active');
  const [editEndsAt, setEditEndsAt] = useState<string>('');
  const [editCustomPrice, setEditCustomPrice] = useState<string>('');
  const [editMaxApartments, setEditMaxApartments] = useState<string>('');
  const [editFeatures, setEditFeatures] = useState<FeaturesConfig>({
    receipt_upload: true,
    emergency_claims: true,
    export_reports: true,
    voting: true,
    maintenance_tickets: true,
    documents_archive: true,
  });

  // Reset Confirmation Modal State
  const [resetModalBuilding, setResetModalBuilding] = useState<Building | null>(
    null
  );
  const [resetMode, setResetMode] = useState<'residents_only' | 'full_delete'>(
    'residents_only'
  );
  const [isResetting, setIsResetting] = useState(false);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = (b.name || '').toLowerCase().includes(q);
        const matchCode = (b.building_code || '').toLowerCase().includes(q);
        const matchAdmin = (b.admin_name || '').toLowerCase().includes(q);
        const matchPhone = (b.admin_phone || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchAdmin && !matchPhone) {
          return false;
        }
      }

      if (statusFilter !== 'all' && b.subscription_status !== statusFilter) {
        return false;
      }

      if (planFilter !== 'all' && b.plan_code !== planFilter) {
        return false;
      }

      return true;
    });
  }, [buildings, searchQuery, statusFilter, planFilter]);

  const openBuildingControlModal = (
    bld: Building,
    tab: 'config' | 'apartments' | 'community' | 'reset' = 'config'
  ) => {
    setSelectedBuilding(bld);
    setActiveDrawerTab(tab);
    setEditPlanCode(bld.plan_code);
    setEditStatus(bld.subscription_status);
    setEditEndsAt((bld.subscription_ends_at || '2026-12-31').slice(0, 10));
    setEditCustomPrice(
      bld.custom_monthly_price != null ? String(bld.custom_monthly_price) : ''
    );
    setEditMaxApartments(
      bld.max_apartments_override != null
        ? String(bld.max_apartments_override)
        : ''
    );
    setEditFeatures({ ...bld.features_config });
  };

  const handleToggleFeature = (key: keyof FeaturesConfig) => {
    setEditFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApplyPlanDefaultFeatures = (planCode: SubscriptionPlanCode) => {
    setEditPlanCode(planCode);
    const tpl = plans.find((p) => p.code === planCode);
    if (tpl) {
      setEditFeatures({ ...tpl.default_features_config });
    }
  };

  const handleSaveBuildingConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) return;

    const parsedCustomPrice =
      editCustomPrice.trim() !== '' ? Number(editCustomPrice) : null;
    const parsedMaxApts =
      editMaxApartments.trim() !== '' ? Number(editMaxApartments) : null;

    await configureBuildingOverrides({
      buildingId: selectedBuilding.id,
      planCode: editPlanCode,
      subscriptionStatus: editStatus,
      subscriptionEndsAt: new Date(editEndsAt || '2026-12-31').toISOString(),
      customMonthlyPrice: parsedCustomPrice,
      maxApartmentsOverride: parsedMaxApts,
      featuresConfig: editFeatures,
    });

    setSelectedBuilding(null);
  };

  // Trigger Reset Modal
  const openResetModal = (
    bld: Building,
    mode: 'residents_only' | 'full_delete'
  ) => {
    setResetModalBuilding(bld);
    setResetMode(mode);
  };

  const handleConfirmReset = async () => {
    if (!resetModalBuilding) return;
    setIsResetting(true);
    try {
      const ok = await resetBuildingData(resetModalBuilding.id, resetMode);
      if (ok) {
        if (selectedBuilding?.id === resetModalBuilding.id) {
          if (resetMode === 'full_delete') {
            setSelectedBuilding(null);
          } else {
            setSelectedBuilding((prev) =>
              prev
                ? { ...prev, fund_balance: 0, registered_apartments_count: 0 }
                : null
            );
          }
        }
        setResetModalBuilding(null);
      }
    } finally {
      setIsResetting(false);
    }
  };

  // Building-specific data when drawer is open
  const buildingApartments = useMemo(() => {
    if (!selectedBuilding) return [];
    return apartments.filter((a) => a.building_id === selectedBuilding.id);
  }, [apartments, selectedBuilding]);

  const buildingObligations = useMemo(() => {
    if (!selectedBuilding) return [];
    return apartmentObligations.filter(
      (o) => o.building_id === selectedBuilding.id
    );
  }, [apartmentObligations, selectedBuilding]);

  const buildingClaims = useMemo(() => {
    if (!selectedBuilding) return [];
    return emergencyClaims.filter((c) => c.building_id === selectedBuilding.id);
  }, [emergencyClaims, selectedBuilding]);

  const buildingIssuesList = useMemo(() => {
    if (!selectedBuilding) return [];
    return buildingIssues.filter((i) => i.building_id === selectedBuilding.id);
  }, [buildingIssues, selectedBuilding]);

  const buildingPollsList = useMemo(() => {
    if (!selectedBuilding) return [];
    return polls.filter((p) => p.building_id === selectedBuilding.id);
  }, [polls, selectedBuilding]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B]">
            إدارة العمارات وتصفير البيانات السريع (Buildings & Testing Tools)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            التحكم في الباقات والأسعار المخصصة، استعراض الشقق والمديونيات، وتصفير
            السكان أو حذف العمارة بالكامل للاختبار والتجربة السريعة
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم العمارة، كود العمارة (BLD-8422)، اسم أو هاتف رئيس الاتحاد..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">حالة الاشتراك:</span>
          {(['all', 'active', 'trial', 'expired'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st === 'all'
                ? 'الكل'
                : st === 'active'
                ? 'نشطة (Active)'
                : st === 'trial'
                ? 'تجريبية (Trial)'
                : 'منتهية (Expired)'}
            </button>
          ))}
        </div>

        {/* Plan Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">الباقة:</span>
          {(['all', 'free', 'pro', 'plus'] as const).map((pl) => (
            <button
              key={pl}
              type="button"
              onClick={() => setPlanFilter(pl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                planFilter === pl
                  ? 'bg-[#10B981] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {pl === 'all' ? 'كل الباقات' : pl}
            </button>
          ))}
        </div>
      </div>

      {/* Buildings Comprehensive Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#1E293B] text-white text-xs font-bold">
              <tr>
                <th className="py-4 px-4">العمارة والكود</th>
                <th className="py-4 px-4">رئيس الاتحاد</th>
                <th className="py-4 px-4">الشقق المسجلة والسعة</th>
                <th className="py-4 px-4">رصيد الخزينة</th>
                <th className="py-4 px-4">الباقة والتسعير</th>
                <th className="py-4 px-4">حالة الاشتراك والانتهاء</th>
                <th className="py-4 px-4">إجراءات التحكم والتصفير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBuildings.map((bld) => {
                const tplPlan = plans.find((p) => p.code === bld.plan_code);
                const bldAptsCount =
                  bld.registered_apartments_count ??
                  apartments.filter((a) => a.building_id === bld.id).length;

                return (
                  <tr key={bld.id} className="hover:bg-slate-50/90 transition">
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-slate-900">
                        {bld.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        كود:{' '}
                        <span className="font-mono font-bold text-[#1E293B] bg-slate-100 px-1.5 py-0.5 rounded">
                          {bld.building_code}
                        </span>{' '}
                        • {bld.address || bld.city}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">
                        {bld.admin_name || 'رئيس الاتحاد'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {bld.admin_phone || '-'}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{bldAptsCount} مسجلة</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">
                          {bld.total_apartments} سعة
                        </span>
                      </div>
                      {bld.max_apartments_override != null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-[#F97316] border border-orange-200 text-[11px] font-bold mt-1">
                          حد مخصص: {bld.max_apartments_override} شقة
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          حد الباقة: {tplPlan?.max_apartments || 36}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-extrabold text-[#10B981]">
                      {(bld.fund_balance ?? 0).toLocaleString()} ج.م
                      <div className="text-[11px] text-slate-500 font-normal">
                        اشتراك الشقة: {bld.default_monthly_dues ?? 0} ج.م
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-[#1E293B] font-extrabold text-xs uppercase">
                        {bld.plan_code}
                      </span>
                      {bld.custom_monthly_price != null ? (
                        <div className="text-xs font-extrabold text-[#10B981] mt-1">
                          سعر مخصص: {bld.custom_monthly_price} ج.م/شهر
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-1">
                          السعر العام: {tplPlan?.default_monthly_price || 0} ج.م/شهر
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div>
                        {bld.subscription_status === 'active' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#10B981] border border-emerald-300 text-xs font-bold">
                            نشطة (Active)
                          </span>
                        ) : bld.subscription_status === 'trial' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-[#F59E0B] border border-amber-300 text-xs font-bold">
                            فترة تجريبية (Trial)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-red-50 text-[#EF4444] border border-red-300 text-xs font-bold">
                            منتهية (Expired)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        ينتهي في:{' '}
                        {(bld.subscription_ends_at || '').slice(0, 10)}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {/* 1. Control Drawer */}
                        <button
                          type="button"
                          onClick={() => openBuildingControlModal(bld, 'config')}
                          className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="تخصيص الباقة والمميزات واستعراض التفاصيل"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#10B981]" />
                          تخصيص
                        </button>

                        {/* 2. Reset Residents Only */}
                        <button
                          type="button"
                          onClick={() => openResetModal(bld, 'residents_only')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition flex items-center gap-1"
                          title="مسح الداتا بالسكان وإعادة ضبط الشقق والعمليات لتجربة جديدة"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#F59E0B]" />
                          تصفير السكان
                        </button>

                        {/* 3. Full Cascade Delete */}
                        <button
                          type="button"
                          onClick={() => openResetModal(bld, 'full_delete')}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition flex items-center gap-1"
                          title="حذف العمارة بالكامل وحساب رئيس الاتحاد نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Reset Confirmation Modal                                             */}
      {/* ==================================================================== */}
      {resetModalBuilding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div
              className={`p-6 text-white flex items-center justify-between ${
                resetMode === 'full_delete'
                  ? 'bg-gradient-to-r from-red-600 to-rose-700'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                  {resetMode === 'full_delete' ? (
                    <Trash2 className="w-6 h-6 text-white" />
                  ) : (
                    <RotateCcw className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold">
                    {resetMode === 'full_delete'
                      ? 'تأكيد حذف العمارة بالكامل'
                      : 'تأكيد تصفير بيانات السكان والعمليات'}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    عمارة: {resetModalBuilding.name} ({resetModalBuilding.building_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalBuilding(null)}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Mode Selector within modal */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setResetMode('residents_only')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    resetMode === 'residents_only'
                      ? 'bg-white text-amber-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مسح الداتا بالسكان فقط
                </button>
                <button
                  type="button"
                  onClick={() => setResetMode('full_delete')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    resetMode === 'full_delete'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  حذف العمارة بالكامل برئيس الاتحاد
                </button>
              </div>

              {/* Warning Text */}
              {resetMode === 'residents_only' ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 text-xs">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-900 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ماذا سيحدث عند الضغط على تصفير السكان؟
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
                    <li>
                      سيتم <strong>حذف جميع الشقق</strong> المسجلة في العمارة.
                    </li>
                    <li>
                      سيتم <strong>حذف حسابات جميع السكان</strong> والملاك التابعين
                      لهذه العمارة من قاعدة البيانات ومن نظام الدخول.
                    </li>
                    <li>
                      سيتم مسح سجلات المديونيات، التحصيلات، المطالبات الطارئة،
                      البلاغات، والتصويتات.
                    </li>
                    <li>
                      سيتم <strong>تصفير رصيد الخزينة إلى 0 ج.م</strong>.
                    </li>
                    <li className="text-emerald-700 font-bold">
                      سيبقى حساب رئيس الاتحاد ({resetModalBuilding.admin_name || 'المدير'})
                      وكود العمارة ({resetModalBuilding.building_code}) سارياً
                      لتجربة جديدة ونظيفة فوراً!
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-950 space-y-2 text-xs">
                  <div className="font-extrabold flex items-center gap-1.5 text-red-900 text-sm">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    تحذير شديد: حذف جذري ونهائي!
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
                    <li>
                      سيتم <strong>حذف العمارة بالكامل</strong> من جدول <code>buildings</code>.
                    </li>
                    <li>
                      سيتم <strong>حذف حساب رئيس الاتحاد</strong> ({resetModalBuilding.admin_name || 'المدير'})
                      نهائياً من جدول <code>users</code> ومن جدول <code>auth.users</code>.
                    </li>
                    <li>
                      سيتم مسح جميع الشقق والسكان والفواتير والمصروفات التلقائية
                      التابعة لها نهائياً.
                    </li>
                    <li className="text-red-700 font-bold">
                      لن يمكنك التراجع عن هذه العملية إطلاقاً.
                    </li>
                  </ul>
                </div>
              )}

              {/* Building Info preview */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500">العمارة المستهدفة: </span>
                  <span className="font-extrabold text-slate-800">
                    {resetModalBuilding.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">كود الانضمام: </span>
                  <span className="font-mono font-bold text-slate-900">
                    {resetModalBuilding.building_code}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetModalBuilding(null)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className={`px-5 py-2 rounded-xl text-white text-xs font-extrabold transition flex items-center gap-2 shadow-sm ${
                  resetMode === 'full_delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isResetting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    جاري التنفيذ عبر Supabase RPC...
                  </>
                ) : resetMode === 'full_delete' ? (
                  <>
                    <Trash2 className="w-4 h-4" />
                    نعم، احذف العمارة برئيس الاتحاد
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    نعم، صفّر بيانات السكان والعمليات
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Building Control Drawer / Modal                                      */}
      {/* ==================================================================== */}
      {selectedBuilding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="bg-[#1E293B] text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    لوحة التحكم وتفاصيل العمارة:{' '}
                    <span className="text-[#10B981]">
                      {selectedBuilding.name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    كود الانضمام:{' '}
                    <span className="font-mono text-emerald-400 font-bold">
                      {selectedBuilding.building_code}
                    </span>{' '}
                    • رئيس الاتحاد: {selectedBuilding.admin_name || 'المدير'} (
                    {selectedBuilding.admin_phone || '-'})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBuilding(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Building Snapshot Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-[#1E293B]" />
                <div>
                  <div className="text-[11px] text-slate-500">الشقق المسجلة</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {buildingApartments.length} من {selectedBuilding.total_apartments}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-[#10B981]" />
                <div>
                  <div className="text-[11px] text-slate-500">رصيد الخزينة</div>
                  <div className="text-sm font-extrabold text-[#10B981]">
                    {(selectedBuilding.fund_balance ?? 0).toLocaleString()} ج.م
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#F97316]" />
                <div>
                  <div className="text-[11px] text-slate-500">انتهاء الاشتراك</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {(selectedBuilding.subscription_ends_at || '').slice(0, 10)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-[11px] text-slate-500">بلاغات ومطالبات</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {buildingIssuesList.length + buildingClaims.length} طلب
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6 gap-2">
              <button
                type="button"
                onClick={() => setActiveDrawerTab('config')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeDrawerTab === 'config'
                    ? 'border-[#10B981] text-[#10B981]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                تخصيص الباقة والمميزات
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawerTab('apartments')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeDrawerTab === 'apartments'
                    ? 'border-[#10B981] text-[#10B981]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                الشقق والمديونيات ({buildingApartments.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawerTab('community')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeDrawerTab === 'community'
                    ? 'border-[#10B981] text-[#10B981]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Vote className="w-4 h-4" />
                البلاغات والمطالبات والتصويتات
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawerTab('reset')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeDrawerTab === 'reset'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-600 hover:text-red-600'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                أدوات التجربة السريعة والتصفير
              </button>
            </div>

            {/* TAB 1: Configuration Form */}
            {activeDrawerTab === 'config' && (
              <form
                onSubmit={handleSaveBuildingConfiguration}
                className="p-6 space-y-6 max-h-[65vh] overflow-y-auto"
              >
                {/* 1. Plan & Subscription Status & Expiry Date */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      1. تغيير الباقة (Plan)
                    </label>
                    <select
                      value={editPlanCode}
                      onChange={(e) =>
                        handleApplyPlanDefaultFeatures(
                          e.target.value as SubscriptionPlanCode
                        )
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                    >
                      <option value="free">الباقة الأساسية (FREE)</option>
                      <option value="pro">باقة العمارة الذكية (PRO)</option>
                      <option value="plus">باقة الأبراج والمجمعات (PLUS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      حالة الاشتراك (Status)
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(
                          e.target.value as BuildingSubscriptionStatus
                        )
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                    >
                      <option value="active">نشطة ومفعلة (Active)</option>
                      <option value="trial">فترة تجريبية (Trial)</option>
                      <option value="expired">
                        منتهية / للقراءة فقط (Expired)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                      تمديد تاريخ انتهاء الاشتراك يدوياً
                    </label>
                    <input
                      type="date"
                      value={editEndsAt}
                      onChange={(e) => setEditEndsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                    />
                  </div>
                </div>

                {/* 2 & 3. Custom Monthly Price & Max Apartments Override */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-extrabold text-[#1E293B] mb-1">
                      2. تخصيص السعر الشهري (`custom_monthly_price`) ج.م
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      حدد سعر اشتراك خاص لهذه العمارة أو اتركه فارغاً ليتبع السعر
                      العام للباقة.
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={editCustomPrice}
                      onChange={(e) => setEditCustomPrice(e.target.value)}
                      placeholder="فارغ = السعر الافتراضي للباقة"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-[#1E293B] mb-1">
                      3. تخصيص الحد الأقصى للشقق (`max_apartments_override`)
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      فتح عدد شقق مخصص لهذه العمارة استثنائياً فوق سعة الباقة
                      الافتراضية.
                    </p>
                    <input
                      type="number"
                      min="1"
                      value={editMaxApartments}
                      onChange={(e) => setEditMaxApartments(e.target.value)}
                      placeholder="فارغ = سعة الباقة الافتراضية"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                    />
                  </div>
                </div>

                {/* 4. Independent Feature Switches (`features_config` JSONB) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#1E293B] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#F97316]" />
                        4. مفاتيح المميزات المستقلة (`features_config` JSONB
                        Switches)
                      </h3>
                      <p className="text-xs text-slate-500">
                        تفعيل أو إيقاف كل ميزة على حدة لهذه العمارة
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FEATURE_LABELS.map((feat) => {
                      const isEnabled = Boolean(editFeatures[feat.key]);
                      return (
                        <div
                          key={feat.key}
                          onClick={() => handleToggleFeature(feat.key)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                            isEnabled
                              ? 'bg-emerald-50/70 border-[#10B981]'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-extrabold text-slate-900">
                              {feat.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {feat.desc}
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`w-11 h-6 rounded-full transition relative shrink-0 mt-0.5 ${
                              isEnabled ? 'bg-[#10B981]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                                isEnabled ? 'left-1' : 'right-1'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedBuilding(null)}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(processingIds[`cfg_${selectedBuilding.id}`])}
                    className="px-6 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    {processingIds[`cfg_${selectedBuilding.id}`]
                      ? 'جاري التنفيذ عبر RPC...'
                      : 'حفظ التخصيص وتحديث العمارة فوراً'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Apartments & Obligations List */}
            {activeDrawerTab === 'apartments' && (
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      قائمة شقق العمارة المسجلة وحسابات المديونيات
                    </h3>
                    <p className="text-xs text-slate-500">
                      إجمالي {buildingApartments.length} شقة مسجلة •{' '}
                      {buildingObligations.length} بند مديونية
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openResetModal(selectedBuilding, 'residents_only')}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    تصفير شقق وسكان هذه العمارة
                  </button>
                </div>

                {buildingApartments.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-slate-500 text-sm">
                    لا توجد شقق مسجلة في هذه العمارة حالياً (جاهزة لإضافة السكان).
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold">
                        <tr>
                          <th className="py-3 px-3">رقم الشقة</th>
                          <th className="py-3 px-3">الطابق</th>
                          <th className="py-3 px-3">الساكن / المالك</th>
                          <th className="py-3 px-3">رقم الهاتف</th>
                          <th className="py-3 px-3">الرصيد / المديونية</th>
                          <th className="py-3 px-3">حصة الملكية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {buildingApartments.map((apt) => {
                          const aptObs = buildingObligations.filter(
                            (o) => o.apartment_id === apt.id && o.status === 'unpaid'
                          );
                          const totalUnpaid = aptObs.reduce(
                            (sum, o) => sum + (o.amount || 0),
                            0
                          );

                          return (
                            <tr key={apt.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                شقة {apt.apartment_number}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {apt.floor_number || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {apt.resident_name || 'شاغر'}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {apt.resident_phone || '-'}
                              </td>
                              <td className="py-2.5 px-3 font-bold">
                                {totalUnpaid > 0 ? (
                                  <span className="text-red-600">
                                    مديونية: {totalUnpaid.toLocaleString()} ج.م
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">خالص</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono">
                                {(apt as any).ownership_share_percent
                                  ? `${(apt as any).ownership_share_percent}%`
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Community & Issues & Claims */}
            {activeDrawerTab === 'community' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                {/* Emergency Claims */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    المطالبات الطارئة (Emergency Claims) ({buildingClaims.length})
                  </h3>
                  {buildingClaims.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      لا توجد مطالبات طارئة مسجلة لهذه العمارة.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildingClaims.map((claim) => (
                        <div
                          key={claim.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900">
                              {claim.title}
                            </span>
                            <span className="text-slate-500 mr-2">
                              {claim.description}
                            </span>
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
                              {claim.status === 'closed' ? 'مكتملة ومغلقة' : 'نشطة وجارية'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Building Issues / Maintenance Tickets */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    بلاغات الأعطال والصيانة (Issues) ({buildingIssuesList.length})
                  </h3>
                  {buildingIssuesList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      لا توجد بلاغات أعطال مسجلة لهذه العمارة.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildingIssuesList.map((iss) => (
                        <div
                          key={iss.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900">
                              {iss.title}
                            </span>
                            <span className="text-slate-500 mr-2">
                              {iss.description}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              iss.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {iss.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Polls */}
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Vote className="w-4 h-4 text-indigo-600" />
                    استطلاعات الرأي والتصويت الرقمي ({buildingPollsList.length})
                  </h3>
                  {buildingPollsList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      لا توجد استطلاعات رأي مسجلة لهذه العمارة.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildingPollsList.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                        >
                          <span className="font-extrabold text-slate-900">
                            {p.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              p.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Testing & Reset Tools */}
            {activeDrawerTab === 'reset' && (
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    أدوات التجربة السريعة وإعادة الضبط (Testing & Rapid Prototyping)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    بدلاً من الدخول لقاعدة البيانات ومسح الجداول يدوياً، تم توفير
                    هذه الأدوات السريعة لتنفيذ إجراءات إعادة الضبط بضغطة زر واحدة
                    باستخدام دالة <code>reset_building_data</code> الموثوقة.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Option 1: Residents Only */}
                  <div className="p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-300 space-y-3">
                    <div className="flex items-center gap-2.5 text-amber-900 font-extrabold text-sm">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <span>1. مسح الداتا بالسكان (إعادة ضبط الشقق والعمليات)</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      يمسح جميع الشقق المسجلة، والسكان، وكشوف المديونيات
                      والتحصيلات والمطالبات، ويصفر رصيد الخزينة، مع{' '}
                      <strong>
                        الإبقاء على العمارة وكودها وحساب رئيس الاتحاد
                      </strong>
                      .
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          openResetModal(selectedBuilding, 'residents_only')
                        }
                        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        تصفير السكان والشقق الآن
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Full Delete */}
                  <div className="p-5 rounded-2xl bg-red-50/70 border-2 border-red-300 space-y-3">
                    <div className="flex items-center gap-2.5 text-red-900 font-extrabold text-sm">
                      <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <span>2. حذف العمارة بالكامل برئيس الاتحاد</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      يمسح العمارة جذرياً من المنصة، ويحذف حساب رئيس الاتحاد
                      وجميع الشقق والسكان من قاعدة البيانات ومن نظام الدخول
                      (Auth).
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          openResetModal(selectedBuilding, 'full_delete')
                        }
                        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف العمارة بالكامل نهائياً
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
