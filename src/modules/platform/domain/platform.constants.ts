import { FeaturesConfig } from '@/shared/types/database';

export const FEATURE_FLAG_LABELS: Array<{
  key: keyof FeaturesConfig;
  label: string;
  desc: string;
}> = [
  {
    key: 'receipt_upload',
    label: 'رفع إيصالات التحويل الإلكتروني',
    desc: 'السماح للسكان برفع لقطات شاشة إنستاباي والتحويلات البنكية',
  },
  {
    key: 'emergency_claims',
    label: 'نظام المطالبات والصيانات الطارئة',
    desc: 'إنشاء صناديق الطوارئ بشريط التقدم الحي وتوزيع الأنصبة',
  },
  {
    key: 'export_reports',
    label: 'تصدير التقارير وكشوف الحساب (PDF)',
    desc: 'توليد تقارير الشفافية المالية الرسمية المعتمدة',
  },
  {
    key: 'voting',
    label: 'التصويت وقرارات الجمعية العمومية',
    desc: 'احتساب الأصوات القانوني وفق الحصة العقارية بالأرض',
  },
  {
    key: 'maintenance_tickets',
    label: 'بلاغات الأعطال والصيانة الفورية',
    desc: 'استقبال وتكليف الفنيين بمتابعة أعطال المرافق المشتركة',
  },
  {
    key: 'documents_archive',
    label: 'أرشيف اللائحة والعقود الرسمية',
    desc: 'حفظ ومشاركة لائحة اتحاد الشاغلين وعقود الصيانة',
  },
];
