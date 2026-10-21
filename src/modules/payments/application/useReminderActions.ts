import { useCallback } from 'react';
import { isSupabaseConfigured } from '@/shared/lib/supabase';
import { paymentsApi } from '../infrastructure/payments.api';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'apartments'
  | 'currentBuilding'
  | 'pushAndRecordNotification'
  | 'usersByRole'
>;

export function useReminderActions({
  apartments,
  currentBuilding,
  pushAndRecordNotification,
  usersByRole,
}: Deps) {
  // 7. Scenario 3: Bulk Reminder ("تذكير الكل") for all unpaid apartments in current month
  const sendBulkUnpaidReminder = useCallback(
    async (customMessage?: string) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (isSupabaseConfigured) {
        try {
          await paymentsApi.sendBulkUnpaidReminder(currentMonth, customMessage);
        } catch {
          // Fallback to local state dispatch
        }
      }

      const unpaidApts = apartments.filter(
        (apt) =>
          apt.building_id === currentBuilding.id &&
          apt.is_active &&
          apt.payment_status === 'unpaid'
      );

      const aptNumbers = unpaidApts.map((a) => a.apartment_number);
      const count = aptNumbers.length;

      if (count === 0) {
        return { remindedCount: 0, apartments: [] };
      }

      const monthName = new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());

      const title = `تذكير بسداد اشتراك الصيانة (${monthName}) 🔔`;

      // Dispatch targeted notification for each unpaid apartment
      for (const apt of unpaidApts) {
        await pushAndRecordNotification({
          recipientId: apt.resident_id || usersByRole.resident.id,
          recipientRole: 'resident',
          recipientPushToken: usersByRole.resident.push_token,
          buildingId: currentBuilding.id,
          title,
          body:
            customMessage?.trim() ||
            `مرحباً ساكن شقة (${apt.apartment_number})، نود تذكيركم بسداد اشتراك الصيانة لشهر ${monthName} بقيمة ${currentBuilding.default_monthly_dues} ج.م.`,
          category: 'financial',
          badgeLabel: `تذكير متأخرات (${apt.apartment_number})`,
          isUrgent: true,
          metadata: {
            apartment_number: apt.apartment_number,
            amount: currentBuilding.default_monthly_dues,
            billing_month: currentMonth,
            target_apartments: aptNumbers,
          },
        });
      }

      return {
        remindedCount: count,
        apartments: aptNumbers,
      };
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      currentBuilding.name,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  const sendIndividualUnpaidReminder = useCallback(
    async (apartmentNumber: string, customMessage?: string) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const targetApt = apartments.find(
        (a) =>
          a.building_id === currentBuilding.id &&
          String(a.apartment_number).trim() === String(apartmentNumber).trim()
      );

      const monthName = new Intl.DateTimeFormat('ar-EG', {
        month: 'long',
        year: 'numeric',
      }).format(new Date());

      const title = `تذكير بسداد اشتراك الصيانة (${monthName}) 🔔`;
      const body =
        customMessage?.trim() ||
        `مرحباً ساكن شقة (${apartmentNumber})، نود تذكيركم بلطف بسداد اشتراك الصيانة الشهري بقيمة ${currentBuilding.default_monthly_dues} ج.م لضمان انتظام خدمات ومرافق العمارة.`;

      await pushAndRecordNotification({
        recipientId: targetApt?.resident_id || usersByRole.resident.id,
        recipientRole: 'resident',
        recipientPushToken: usersByRole.resident.push_token,
        buildingId: currentBuilding.id,
        title,
        body,
        category: 'financial',
        badgeLabel: `تذكير متأخرات (شقة ${apartmentNumber})`,
        isUrgent: true,
        metadata: {
          apartment_number: apartmentNumber,
          amount: currentBuilding.default_monthly_dues,
          billing_month: currentMonth,
        },
      });
    },
    [
      apartments,
      currentBuilding.default_monthly_dues,
      currentBuilding.id,
      pushAndRecordNotification,
      usersByRole.resident.id,
      usersByRole.resident.push_token,
    ]
  );

  return { sendBulkUnpaidReminder, sendIndividualUnpaidReminder };
}
