import { COLORS } from '@/shared/theme/colors';
import { IssueSeverity } from '@/shared/types/database';

export const ISSUE_CATEGORIES = [
  { id: 'المصعد', name: 'المصعد', icon: 'elevator' },
  { id: 'مدخل العقار', name: 'مدخل العقار', icon: 'door-front' },
  { id: 'إنارة السلم', name: 'إنارة السلم', icon: 'lightbulb' },
  { id: 'طلمبة المياه', name: 'طلمبة المياه', icon: 'water' },
  { id: 'الجراج السفلي', name: 'الجراج السفلي', icon: 'garage' },
  { id: 'السطح والرووف', name: 'السطح والرووف', icon: 'roofing' },
  { id: 'تسريب مؤثر بالأسقف', name: 'تسريب بالأسقف', icon: 'water-damage' },
  { id: 'مواسير صواعد رئيسية', name: 'سباكة وصواعد', icon: 'plumbing' },
  { id: 'عام', name: 'عام وأخرى', icon: 'build' },
];

export const SEVERITY_LEVELS: {
  id: IssueSeverity;
  title: string;
  badge: string;
  desc: string;
  color: string;
  bg: string;
}[] = [
  {
    id: 'low',
    title: 'عادي / صيانة دورية مجدولة',
    badge: 'خلال 5 أيام',
    desc: 'عطل طفيف لا يعوق الاستخدام اليومي أو يسبب خطراً كالمصابيح أو المسامير.',
    color: COLORS.secondary,
    bg: '#ECFDF5',
  },
  {
    id: 'medium',
    title: 'متوسط / معالجة خلال 48 ساعة',
    badge: 'خلال 48 ساعة',
    desc: 'يسبب إزعاجاً للسكان أو يؤثر جزئياً على خدمة مشتركة دون تشكيل خطر مباشر.',
    color: COLORS.statusUpcoming,
    bg: '#FFFBEB',
  },
  {
    id: 'high',
    title: 'طارئ وحرج / عطل كامل للمرفق',
    badge: 'فوري ⚠️',
    desc: 'توقف كلي للمصعد، تسريب حاد لمياه الخزان، أو عطل كهربائي يهدد المبنى.',
    color: COLORS.statusUnpaid,
    bg: '#FEF2F2',
  },
];

export const TIME_WINDOWS = [
  { id: 'any', label: 'أي وقت (طارئ ومستعجل)' },
  { id: 'morning', label: 'الفترة الصباحية (09:00 ص - 01:00 م)' },
  { id: 'afternoon', label: 'فترة الظهيرة (02:00 م - 06:00 م)' },
  { id: 'evening', label: 'الفترة المسائية (06:00 م - 10:00 م)' },
];
