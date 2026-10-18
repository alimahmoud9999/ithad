import type { Metadata } from 'next';
import './globals.css';
import { DashboardProvider } from '@/context/DashboardContext';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const metadata: Metadata = {
  title: 'لوحة تحكم الشركة المالكة (Super Admin) | مدير اتحاد الملاك',
  description:
    'لوحة تحكم الإدارة العليا لإدارة العمارات، تخصيص الباقات، واعتماد فواتير اشتراكات تطبيق مدير اتحاد الملاك.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased bg-[#F8FAFC] text-slate-900">
        <DashboardProvider>
          <DashboardShell>{children}</DashboardShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
