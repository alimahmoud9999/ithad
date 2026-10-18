'use client';

import React, { useState } from 'react';
import { Layers, Check, Sparkles } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { FeaturesConfig, SubscriptionPlan } from '@/types/database';

const FEATURE_KEYS: { key: keyof FeaturesConfig; label: string }[] = [
  { key: 'receipt_upload', label: 'رفع إيصالات التحويل بالصور (إنستاباي)' },
  { key: 'emergency_claims', label: 'صناديق المطالبات الطارئة' },
  { key: 'export_reports', label: 'تصدير التقارير المعتمدة PDF / Excel' },
  { key: 'voting', label: 'التصويت الرقمي واستطلاعات الملاك' },
  { key: 'maintenance_tickets', label: 'تذاكر الأعطال والصيانة' },
  { key: 'documents_archive', label: 'أرشيف العقود والمستندات' },
];

export default function GlobalPlansPage() {
  const { plans, updateSubscriptionPlanTemplate, processingIds } =
    useDashboard();

  const [editablePlans, setEditablePlans] =
    useState<SubscriptionPlan[]>(plans);

  const handleFieldChange = (
    code: SubscriptionPlan['code'],
    field: 'default_monthly_price' | 'max_apartments' | 'name_ar' | 'description_ar',
    value: string | number
  ) => {
    setEditablePlans((prev) =>
      prev.map((p) => (p.code === code ? { ...p, [field]: value } : p))
    );
  };

  const handleToggleDefaultFeature = (
    code: SubscriptionPlan['code'],
    featKey: keyof FeaturesConfig
  ) => {
    setEditablePlans((prev) =>
      prev.map((p) =>
        p.code === code
          ? {
              ...p,
              default_features_config: {
                ...p.default_features_config,
                [featKey]: !p.default_features_config[featKey],
              },
            }
          : p
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B]">
          إدارة قوالب الباقات العامة (Global Subscription Plans)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          التحكم في جدول <code>subscription_plans</code> لتعديل الأسعار الافتراضية،
          الحدود القصوى للشقق، والمميزات الافتراضية للباقات الثلاث (
          <code>free</code>, <code>pro</code>, <code>plus</code>)
        </p>
      </div>

      {/* 3 Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {editablePlans.map((plan) => {
          const isSaving = Boolean(processingIds[`plan_${plan.code}`]);

          return (
            <div
              key={plan.code}
              className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden ${
                plan.code === 'pro'
                  ? 'border-2 border-[#10B981]'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Card Header */}
                <div
                  className={`p-6 ${
                    plan.code === 'pro'
                      ? 'bg-[#1E293B] text-white'
                      : 'bg-slate-50 border-b border-slate-200 text-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-lg bg-[#10B981] text-white text-xs font-extrabold uppercase">
                      {plan.code}
                    </span>
                    {plan.code === 'pro' && (
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        الباقة القياسية الأكثر استخداماً
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={plan.name_ar}
                    onChange={(e) =>
                      handleFieldChange(plan.code, 'name_ar', e.target.value)
                    }
                    className={`mt-3 w-full text-lg font-extrabold rounded-lg px-2.5 py-1 border ${
                      plan.code === 'pro'
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-200 text-[#1E293B]'
                    }`}
                  />
                  <textarea
                    rows={2}
                    value={plan.description_ar}
                    onChange={(e) =>
                      handleFieldChange(
                        plan.code,
                        'description_ar',
                        e.target.value
                      )
                    }
                    className={`mt-2 w-full text-xs rounded-lg px-2.5 py-1.5 border ${
                      plan.code === 'pro'
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  />
                </div>

                {/* Numeric Controls */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        السعر الشهري الافتراضي (ج.م)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={plan.default_monthly_price}
                        onChange={(e) =>
                          handleFieldChange(
                            plan.code,
                            'default_monthly_price',
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-extrabold text-[#1E293B]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        الحد الأقصى للشقق
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={plan.max_apartments}
                        onChange={(e) =>
                          handleFieldChange(
                            plan.code,
                            'max_apartments',
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-extrabold text-[#1E293B]"
                      />
                    </div>
                  </div>

                  {/* Default Features Config Switches */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-extrabold text-slate-700">
                      المميزات الافتراضية للباقة (`default_features_config`):
                    </p>
                    {FEATURE_KEYS.map((feat) => {
                      const active = Boolean(
                        plan.default_features_config[feat.key]
                      );
                      return (
                        <div
                          key={feat.key}
                          onClick={() =>
                            handleToggleDefaultFeature(plan.code, feat.key)
                          }
                          className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold transition ${
                            active
                              ? 'bg-emerald-50/70 border-[#10B981] text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          <span>{feat.label}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              active
                                ? 'bg-[#10B981] text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {active ? 'مفعل' : 'مغلق'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Save Plan Button */}
              <div className="p-5 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => updateSubscriptionPlanTemplate(plan)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Check className="w-4 h-4 text-[#10B981]" />
                  {isSaving
                    ? 'جاري الحفظ في subscription_plans...'
                    : `حفظ تعديلات قالب (${plan.code.toUpperCase()})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
