'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  Building2,
  Phone,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { AccountStatus } from '@/types/database';

export default function UsersDirectoryPage() {
  const { users, updateUserStatus, processingIds } = useDashboard();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchName = u.full_name.toLowerCase().includes(q);
        const matchPhone = (u.phone || '').toLowerCase().includes(q);
        const matchBuilding = (u.building_name || '')
          .toLowerCase()
          .includes(q);
        if (!matchName && !matchPhone && !matchBuilding) return false;
      }

      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1E293B]">
          دليل المستخدمين ورؤساء الاتحاد (Users Directory)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          استعراض شامل لحسابات رؤساء الاتحاد والسكان على المنصة، البحث بالاسم أو رقم
          الهاتف، والتحكم في حالة الحساب (`pending`, `active`, `rejected`, `suspended`)
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المستخدم، رقم الهاتف (010...)، أو اسم العمارة..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">الدور:</span>
          {(['all', 'admin', 'resident', 'super_admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === r
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r === 'all'
                ? 'الكل'
                : r === 'admin'
                ? 'رئيس اتحاد (Admin)'
                : r === 'resident'
                ? 'ساكن (Resident)'
                : 'Super Admin'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">الحالة:</span>
          {(['all', 'active', 'pending', 'suspended', 'rejected'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-[#10B981] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st === 'all'
                  ? 'كل الحالات'
                  : st === 'active'
                  ? 'مفعل (Approved/Active)'
                  : st === 'pending'
                  ? 'معلق (Pending)'
                  : st === 'suspended'
                  ? 'موقوف (Suspended)'
                  : 'مرفوض (Rejected)'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#1E293B] text-white text-xs font-bold">
              <tr>
                <th className="py-4 px-4">الاسم الكامل</th>
                <th className="py-4 px-4">رقم الهاتف</th>
                <th className="py-4 px-4">الدور والصلاحية</th>
                <th className="py-4 px-4">العمارة والشقة</th>
                <th className="py-4 px-4">حالة الحساب</th>
                <th className="py-4 px-4">تغيير الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((usr) => {
                const isUpdating = Boolean(processingIds[`usr_${usr.id}`]);

                return (
                  <tr key={usr.id} className="hover:bg-slate-50/90 transition">
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-slate-900">
                        {usr.full_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        تاريخ التسجيل: {(usr.created_at || '').slice(0, 10)}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-slate-800">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#10B981]" />
                        {usr.phone}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      {usr.role === 'super_admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                          مالك المنصة (Super Admin)
                        </span>
                      ) : usr.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-[#F97316] border border-orange-200 text-xs font-bold">
                          رئيس اتحاد ملاك (Admin)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                          ساكن / مالك وحدة (Resident)
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {usr.building_name ? (
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-[#1E293B]" />
                            {usr.building_name} ({usr.building_code})
                          </div>
                          <div className="text-xs text-slate-500">
                            شقة {usr.apartment_number || '-'} •{' '}
                            {usr.floor_number || ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          إدارة عامة للمنصة
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {usr.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-[#10B981] border border-emerald-300 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          مفعل (Approved)
                        </span>
                      ) : usr.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-[#F59E0B] border border-amber-300 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          بانتظار التفعيل (Pending)
                        </span>
                      ) : usr.status === 'suspended' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-[#EF4444] border border-red-300 text-xs font-bold">
                          <Ban className="w-3.5 h-3.5" />
                          موقوف (Suspended)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-[#EF4444] border border-red-300 text-xs font-bold">
                          مرفوض (Rejected)
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4">
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
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                        >
                          <option value="active">مفعل (Approved)</option>
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
      </div>
    </div>
  );
}
