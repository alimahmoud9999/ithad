'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Ban,
  Download,
  Copy,
  Check,
  MessageSquare,
  Calendar,
  ExternalLink,
  UserCheck,
  UserX,
  Filter,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { AccountStatus, UserRole } from '@/types/database';

export default function UsersDirectoryPage() {
  const { users, buildings, updateUserStatus, processingIds } = useDashboard();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Helper for WhatsApp link
  const getWhatsAppLink = (phone: string) => {
    if (!phone) return null;
    const cleanDigits = phone.replace(/\D/g, '');
    const intlPhone = cleanDigits.startsWith('0')
      ? `20${cleanDigits.slice(1)}`
      : cleanDigits.startsWith('20')
      ? cleanDigits
      : `20${cleanDigits}`;
    return `https://wa.me/${intlPhone}`;
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = (u.full_name || '').toLowerCase().includes(q);
        const matchPhone = (u.phone || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchBuilding = (u.building_name || '').toLowerCase().includes(q);
        const matchCode = (u.building_code || '').toLowerCase().includes(q);
        const matchApt = (u.apartment_number || '').toLowerCase().includes(q);
        if (
          !matchName &&
          !matchPhone &&
          !matchEmail &&
          !matchBuilding &&
          !matchCode &&
          !matchApt
        ) {
          return false;
        }
      }

      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Export filtered users to CSV with Arabic support (UTF-8 BOM)
  const handleExportCSV = () => {
    if (filteredUsers.length === 0) return;

    const headers = [
      'الاسم الكامل',
      'البريد الإلكتروني',
      'رقم الهاتف',
      'الدور والصلاحية',
      'حالة الحساب',
      'العمارة',
      'كود العمارة',
      'رقم الشقة',
      'تاريخ التسجيل',
      'آخر نشاط / تحديث',
    ];

    const rows = filteredUsers.map((u) => [
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '-').replace(/"/g, '""')}"`,
      `"${(u.phone || '-').replace(/"/g, '""')}"`,
      `"${u.role === 'admin' ? 'رئيس اتحاد ملاك' : u.role === 'super_admin' ? 'مدير المنصة' : 'ساكن / مالك'}"`,
      `"${u.status === 'active' ? 'مفعل' : u.status === 'pending' ? 'معلق' : u.status === 'suspended' ? 'موقوف' : 'مرفوض'}"`,
      `"${(u.building_name || '-').replace(/"/g, '""')}"`,
      `"${(u.building_code || '-').replace(/"/g, '""')}"`,
      `"${(u.apartment_number || '-').replace(/"/g, '""')}"`,
      `"${(u.created_at || '').slice(0, 10)}"`,
      `"${(u.updated_at || u.created_at || '').slice(0, 10)}"`,
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
      `ittihad_users_directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const residentCount = users.filter((u) => u.role === 'resident').length;
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1E293B]">
            دليل المستخدمين ورؤساء الاتحاد (Users Directory)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            استعراض شامل لحسابات رؤساء الاتحاد والملاك، أرقام هواتفهم، إيميلاتهم،
            آخر نشاط، والتحكم في تفعيل أو إيقاف الحسابات
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={filteredUsers.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-[#10B981]" />
          <span>تصدير كشف المستخدمين (CSV)</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#1E293B] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">إجمالي المستخدمين</div>
            <div className="text-lg font-black text-slate-900">{totalUsers}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">رؤساء الاتحاد</div>
            <div className="text-lg font-black text-amber-900">{adminCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">الملاك والسكان</div>
            <div className="text-lg font-black text-slate-900">{residentCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">بانتظار التفعيل</div>
            <div className="text-lg font-black text-orange-600">{pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم، الإيميل، رقم التليفون (010...)، أو اسم العمارة..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500">الدور:</span>
          {(['all', 'admin', 'resident', 'super_admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === r
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r === 'all'
                ? 'الكل'
                : r === 'admin'
                ? 'رئيس اتحاد'
                : r === 'resident'
                ? 'ساكن / مالك'
                : 'Super Admin'}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500">الحالة:</span>
          {(['all', 'active', 'pending', 'suspended', 'rejected'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st === 'all'
                  ? 'الكل'
                  : st === 'active'
                  ? 'مفعل'
                  : st === 'pending'
                  ? 'معلق'
                  : st === 'suspended'
                  ? 'موقوف'
                  : 'مرفوض'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Users Comprehensive Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-base font-bold text-slate-800">
              لا يوجد مستخدمون مطابقون لمعايير البحث
            </div>
            <p className="text-xs text-slate-500">
              جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر بالأعلى
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#1E293B] text-white font-bold">
                <tr>
                  <th className="py-4 px-4">الاسم الكامل</th>
                  <th className="py-4 px-4">البريد الإلكتروني (المسجل به)</th>
                  <th className="py-4 px-4">رقم الهاتف والتواصل</th>
                  <th className="py-4 px-4">الدور والصلاحية</th>
                  <th className="py-4 px-4">العمارة والوحدة</th>
                  <th className="py-4 px-4">التسجيل وآخر نشاط</th>
                  <th className="py-4 px-4">حالة الحساب</th>
                  <th className="py-4 px-4">تغيير الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((usr) => {
                  const isUpdating = Boolean(processingIds[`usr_${usr.id}`]);
                  const waLink = getWhatsAppLink(usr.phone);
                  const isHead = usr.role === 'admin';

                  return (
                    <tr
                      key={usr.id}
                      className={`hover:bg-slate-50/90 transition ${
                        isHead ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {usr.full_name || 'مستخدم بدون اسم'}
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

                      {/* Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-800">
                            {usr.email ? (
                              <a
                                href={`mailto:${usr.email}`}
                                className="hover:text-blue-600 hover:underline transition"
                                title="إرسال بريد إلكتروني"
                              >
                                {usr.email}
                              </a>
                            ) : (
                              <span className="text-slate-400">غير مسجل</span>
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
                              {/* Copy */}
                              <button
                                type="button"
                                onClick={() => handleCopy(usr.phone || '', `ph_${usr.id}`)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                                title="نسخ رقم الهاتف"
                              >
                                {copiedKey === `ph_${usr.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* WhatsApp Direct */}
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

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {usr.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                            مالك المنصة
                          </span>
                        ) : usr.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-extrabold shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            رئيس اتحاد ملاك
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                            ساكن / مالك
                          </span>
                        )}
                      </td>

                      {/* Building & Apartment */}
                      <td className="py-3.5 px-4">
                        {usr.building_id ? (
                          <div>
                            <Link
                              href={`/buildings/${usr.building_id}`}
                              className="font-bold text-slate-900 hover:text-[#10B981] transition flex items-center gap-1 group"
                              title="عرض تفاصيل العمارة وسجل الملاك"
                            >
                              <Building2 className="w-3.5 h-3.5 text-[#1E293B] group-hover:text-[#10B981]" />
                              <span className="group-hover:underline">
                                {usr.building_name || 'عمارة مسجلة'}
                              </span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#10B981]" />
                            </Link>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {usr.apartment_number
                                ? `شقة ${usr.apartment_number}`
                                : 'بدون شقة'}
                              {usr.floor_number && ` • طابق ${usr.floor_number}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">إدارة عامة للمنصة</span>
                        )}
                      </td>

                      {/* Registration & Last Activity */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-mono text-[11px]">
                          تسجيل: {(usr.created_at || '').slice(0, 10)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          تحديث: {(usr.updated_at || usr.created_at || '').slice(0, 10)}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {usr.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                            مفعل (Active)
                          </span>
                        ) : usr.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            بانتظار التفعيل
                          </span>
                        ) : usr.status === 'suspended' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-300 text-[11px] font-bold">
                            <Ban className="w-3.5 h-3.5 text-red-600" />
                            موقوف (Suspended)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-[11px] font-bold">
                            مرفوض
                          </span>
                        )}
                      </td>

                      {/* Change Status */}
                      <td className="py-3.5 px-4">
                        {usr.role !== 'super_admin' && (
                          <select
                            disabled={isUpdating}
                            value={usr.status}
                            onChange={(e) =>
                              updateUserStatus(
                                usr.id,
                                e.target.value as AccountStatus
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                          >
                            <option value="active">مفعل (Active)</option>
                            <option value="pending">معلق (Pending)</option>
                            <option value="suspended">موقوف (Suspended)</option>
                            <option value="rejected">مرفوض (Rejected)</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
