import * as Clipboard from 'expo-clipboard';
import { Linking, Alert } from 'react-native';

export interface InviteOptions {
  buildingName: string;
  buildingCode: string;
  apartmentNumber?: string;
  residentName?: string;
  phone?: string;
}

/**
 * Formats a phone number for WhatsApp URL (wa.me)
 * Handles Egyptian mobile numbers (01xxxxxxxxx -> 201xxxxxxxxx)
 * and strips non-digits.
 */
export function formatPhoneForWhatsApp(rawPhone?: string): string {
  if (!rawPhone) return '';
  // Remove non-digit characters except leading +
  let cleaned = rawPhone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Handle Egyptian local numbers starting with 01
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = '2' + cleaned;
  } else if (cleaned.startsWith('1') && cleaned.length === 10) {
    cleaned = '20' + cleaned;
  }

  return cleaned;
}

/**
 * Copies any text to clipboard with instant user feedback
 */
export async function copyToClipboard(
  text: string,
  label: string = 'الكود'
): Promise<boolean> {
  try {
    if (!text) return false;
    await Clipboard.setStringAsync(text);
    Alert.alert('تم النسخ بنجاح 📋', `تم نسخ ${label} إلى الحافظة:\n${text}`);
    return true;
  } catch (err: any) {
    Alert.alert('تنبيه', 'تعذر النسخ إلى الحافظة');
    return false;
  }
}

/**
 * Generates the friendly invitation message for residents
 */
export function generateInviteMessage(options: InviteOptions): string {
  const { buildingName, buildingCode, apartmentNumber, residentName } = options;

  let msg = `مرحباً بك في ${buildingName || 'العمارة'}! 👋\n`;
  if (residentName) {
    msg = `مرحباً أستاذ/ة ${residentName} في ${buildingName || 'العمارة'}! 👋\n`;
  }
  msg += `يسعدنا انضمامك لتطبيق إدارة اتحاد الملاك لمتابعة الاشتراكات الشهرية، مصروفات الصيانة، وخزينة العقار بشفافية تامة.\n\n`;
  msg += `🏢 كود الانضمام للعمارة:\n${buildingCode}\n`;

  if (apartmentNumber) {
    msg += `🚪 رقم الشقة: ${apartmentNumber}\n`;
  }

  msg += `\n(يمكنك نسخ كود العمارة ولصقه مباشرة في التطبيق عند إنشاء حسابك للوصول لبيانات شقتك)\n`;
  return msg;
}

/**
 * Opens WhatsApp directly with prefilled invitation message
 * If phone is provided, targets that user directly.
 * Otherwise, opens WhatsApp contact picker.
 */
export async function sendWhatsAppInvite(options: InviteOptions): Promise<void> {
  try {
    const message = generateInviteMessage(options);
    const encodedMsg = encodeURIComponent(message);
    const cleanedPhone = formatPhoneForWhatsApp(options.phone);

    let url = '';
    if (cleanedPhone) {
      url = `https://wa.me/${cleanedPhone}?text=${encodedMsg}`;
    } else {
      url = `https://wa.me/?text=${encodedMsg}`;
    }

    const canOpen = await Linking.canOpenURL(url).catch(() => true);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback
      await Linking.openURL(`https://api.whatsapp.com/send?text=${encodedMsg}`);
    }
  } catch (err: any) {
    Alert.alert('تعذر فتح واتساب', 'يرجى التأكد من تثبيت تطبيق واتساب على هاتفك أو نسخ الكود يدوياً.');
  }
}
