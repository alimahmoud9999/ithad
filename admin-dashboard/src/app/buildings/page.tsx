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
    configureBuildingOverrides,
    processingIds,
  } = useDashboard();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Building Control Drawer / Modal State
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null
  );
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

  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = b.name.toLowerCase().includes(q);
        const matchCode = b.building_code.toLowerCase().includes(q);
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

  const openBuildingControlModal = (bld: Building) => {
    setSelectedBuilding(bld);
    setEditPlanCode(bld.plan_code);
    setEditStatus(bld.subscription_status);
    setEditEndsAt(
      (bld.subscription_ends_at || '2026-12-31').slice(0, 10)
    );
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B]">
            إدارة العمارات والتخصيص المرن (Buildings & Custom Overrides)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            التحكم المباشر في باقة كل عمارة، السعر الاستثنائي (`custom_monthly_price`)، سعة الشقق، ومفاتيح المميزات المستقلة (`features_config` JSONB)
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
                <th className="py-4 px-4">عدد الشقق والحد الأقصى</th>
                <th className="py-4 px-4">رصيد الخزينة</th>
                <th className="py-4 px-4">الباقة والتسعير</th>
                <th className="py-4 px-4">حالة الاشتراك والانتهاء</th>
                <th className="py-4 px-4">مفاتيح المميزات المفعلة</th>
                <th className="py-4 px-4">التحكم المرن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBuildings.map((bld) => {
                const tplPlan = plans.find((p) => p.code === bld.plan_code);
                const enabledFeaturesCount = Object.values(
                  bld.features_config || {}
                ).filter(Boolean).length;

                return (
                  <tr key={bld.id} className="hover:bg-slate-50/90 transition">
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-slate-900">
                        {bld.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        كود:{' '}
                        <span className="font-mono font-bold text-[#1E293B]">
                          {bld.building_code}
                        </span>{' '}
                        • {bld.address}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">
                        {bld.admin_name || 'رئيس الاتحاد'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {bld.admin_phone || '01012345678'}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">
                        {bld.total_apartments} شقة مسجلة
                      </div>
                      {bld.max_apartments_override != null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-[#F97316] border border-orange-200 text-[11px] font-bold mt-1">
                          حد مخصص: {bld.max_apartments_override} شقة
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          الحد الافتراضي: {tplPlan?.max_apartments || 36} شقة
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-extrabold text-[#10B981]">
                      {bld.fund_balance.toLocaleString()} ج.م
                      <div className="text-[11px] text-slate-500 font-normal">
                        اشتراك الشقة: {bld.default_monthly_dues} ج.م
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
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold">
                        {enabledFeaturesCount} / 6 مميزات مفعلة
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => openBuildingControlModal(bld)}
                        className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#10B981]" />
                        تخصيص العمارة
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Building Control Drawer / Modal (`super_admin_configure_building` RPC) */}
      {/* ==================================================================== */}
      {selectedBuilding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-[#1E293B] text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    نافذة التحكم المرن وتخصيص العمارة:{' '}
                    <span className="text-[#10B981]">
                      {selectedBuilding.name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    كود الانضمام: {selectedBuilding.building_code} • تنفيذ آمن عبر
                    دالة <code>super_admin_configure_building</code>
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

            {/* Quick Building Snapshot */}
            <div className="grid grid-cols-3 gap-4 p-5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-[#1E293B]" />
                <div>
                  <div className="text-[11px] text-slate-500">الشقق الحالية</div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {selectedBuilding.total_apartments} شقة
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-[#10B981]" />
                <div>
                  <div className="text-[11px] text-slate-500">رصيد الصندوق</div>
                  <div className="text-sm font-extrabold text-[#10B981]">
                    {selectedBuilding.fund_balance.toLocaleString()} ج.م
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#F97316]" />
                <div>
                  <div className="text-[11px] text-slate-500">
                    انتهاء التجربة / الاشتراك
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {(selectedBuilding.subscription_ends_at || '').slice(0, 10)}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Body */}
            <form
              onSubmit={handleSaveBuildingConfiguration}
              className="p-6 space-y-6 max-h-[75vh] overflow-y-auto"
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
                    <option value="expired">منتهية / للقراءة فقط (Expired)</option>
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
                    حدد سعر اشتراك خاص لهذه العمارة (مثلاً 200 ج.م كعرض خاص) أو اتركه
                    فارغاً ليتبع السعر العام للباقة.
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
                    فتح عدد شقق مخصص لهذه العمارة استثنائياً فوق سعة الباقة الافتراضية.
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
                      4. مفاتيح المميزات المستقلة (`features_config` JSONB Switches)
                    </h3>
                    <p className="text-xs text-slate-500">
                      تفعيل أو إيقاف كل ميزة على حدة لهذه العمارة بالذات بغض النظر عن
                      باقتها
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
          </div>
        </div>
      )}
    </div>
  );
}
