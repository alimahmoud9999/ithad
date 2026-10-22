'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Layers,
  Users,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Database,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'الإحصائيات العامة (Overview)',
    icon: LayoutDashboard,
  },
  {
    href: '/buildings',
    label: 'إدارة العمارات والتخصيص المرن',
    icon: Building2,
  },
  {
    href: '/invoices',
    label: 'فواتير الاشتراكات والتفعيل الذكي',
    icon: CreditCard,
    badgeKey: 'pendingInvoices',
  },
  {
    href: '/plans',
    label: 'قوالب الباقات العامة (Plans)',
    icon: Layers,
  },
  {
    href: '/users',
    label: 'دليل المستخدمين ورؤساء الاتحاد',
    icon: Users,
  },
];

export const DashboardShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const {
    currentAdmin,
    isAuthorizedSuperAdmin,
    authError,
    isLoadingAuth,
    isLiveSupabaseConnected,
    signInAsSuperAdmin,
    simulateRoleAttempt,
    signOut,
    invoices,
    toastMessage,
    clearToast,
    refreshFromSupabase,
  } = useDashboard();

  const [email, setEmail] = useState('superadmin@ittihad.app');
  const [password, setPassword] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const pendingInvoicesCount = invoices.filter(
    (inv) => inv.status === 'pending'
  ).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFromSupabase();
    setTimeout(() => setRefreshing(false), 500);
  };

  // ==========================================================================
  // Security & Auth Guard Screen (Blocks non-super_admin roles immediately)
  // ==========================================================================
  if (!isAuthorizedSuperAdmin) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-[#1E293B] p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <h1 className="text-lg font-bold">
                  بوابة الإدارة العليا • مدير اتحاد الملاك
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  لوحة تحكم الشركة المالكة (Super Admin Portal)
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {authError && (
              <div className="p-4 rounded-xl bg-red-50 border border-[#EF4444] flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-[#EF4444] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-900">{authError}</p>
                  <p className="text-xs text-red-700 mt-1">
                    تم التحقق عبر الدالة المؤمنة <code>get_my_role()</code> وفحص جدول{' '}
                    <code>users</code> بالاعتماد على <code>auth.uid()</code>.
                  </p>
                </div>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await signInAsSuperAdmin(email, password);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  البريد الإلكتروني لحساب Super Admin
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1E293B] hover:bg-slate-800 text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-[#10B981]" />
                {isLoadingAuth
                  ? 'جاري التحقق من صلاحية super_admin...'
                  : 'تسجيل الدخول عبر Supabase Auth'}
              </button>
            </form>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] flex text-slate-900">
      {/* Right Sidebar (RTL) */}
      <aside className="w-72 bg-[#1E293B] text-white flex flex-col shrink-0 shadow-xl sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#10B981] flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white">
                مدير اتحاد الملاك
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                لوحة الشركة المالكة (Super Admin)
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            وحدات إدارة المنصة
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : Boolean(pathname && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition ${
                  isActive
                    ? 'bg-[#10B981] text-white shadow-md shadow-emerald-950/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </div>

                {item.badgeKey === 'pendingInvoices' &&
                  pendingInvoicesCount > 0 && (
                    <span
                      className={`px-2 py-0.5 text-xs font-extrabold rounded-full ${
                        isActive
                          ? 'bg-white text-emerald-900'
                          : 'bg-[#F97316] text-white'
                      }`}
                    >
                      {pendingInvoicesCount}
                    </span>
                  )}
              </Link>
            );
          })}
        </nav>

        {/* Security & Role Guard Status Footer */}
        <div className="p-4 border-t border-slate-700/80 bg-slate-900/50 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#10B981]" />
              قاعدة بيانات Supabase:
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
              {isLiveSupabaseConnected ? 'متصل (Live)' : 'وضع المحاكاة'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700">
            <p className="text-xs font-bold text-white truncate">
              {currentAdmin?.full_name}
            </p>
            <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
              الصلاحية المحققة: role === &apos;super_admin&apos;
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => simulateRoleAttempt('resident')}
              title="اختبار منع الدخول لغير super_admin"
              className="flex-1 py-2 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold transition text-center"
            >
              اختبار حارس الصلاحية
            </button>
            <button
              type="button"
              onClick={signOut}
              className="py-2 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold transition flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              خروج
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[#1E293B] text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              حماية RPC نشطة (auth.uid() = super_admin)
            </span>

            {pendingInvoicesCount > 0 && (
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-[#F59E0B] text-amber-900 text-xs font-bold hover:bg-amber-100 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#F97316]" />
                يوجد ({pendingInvoicesCount}) إيصال اشتراك بانتظار المراجعة والتفعيل
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#10B981]' : ''}`}
              />
              مزامنة مع Supabase
            </button>
          </div>
        </header>

        {/* Global Toast Alert */}
        {toastMessage && (
          <div className="px-8 pt-4">
            <div
              className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-[#10B981] text-emerald-950'
                  : toastMessage.type === 'warning'
                  ? 'bg-amber-50 border-[#F59E0B] text-amber-950'
                  : 'bg-red-50 border-[#EF4444] text-red-950'
              }`}
            >
              <div className="flex items-center gap-2.5 text-sm font-bold">
                {toastMessage.type === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
                )}
                {toastMessage.type === 'warning' && (
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />
                )}
                {toastMessage.type === 'error' && (
                  <XCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
                )}
                <span>{toastMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={clearToast}
                className="text-xs font-bold underline opacity-75 hover:opacity-100"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};
