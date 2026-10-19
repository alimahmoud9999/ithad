# 🏢 التوثيق المرجعي الشامل للوحة تحكم الشركة المالكة (Super Admin Next.js Web Dashboard)

> **⚠️ قاعدة الفصل المعماري (Architecture Separation Rule):**
> هذا المشروع مستقل تماماً داخل مجلد [`admin-dashboard/`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard) ويعمل بإطار **Next.js (App Router) + TypeScript + Tailwind CSS** لخدمة الإدارة العليا والمنصة المالكة (`super_admin`) لتطبيق **"مدير اتحاد الملاك (Ittihad Trust)"**. لا يتداخل هذا المشروع في الحزم أو الكود مع تطبيق الموبايل (`React Native / Expo`) الموجود في الجذر، ولكنه يتصل بنفس قاعدة بيانات **Supabase** ونفس الجداول وسياسات الـ RLS ودوال الـ RPC المؤمنة.

---

## 🎯 1. الهدف العام ومكدس التقنية (Tech Stack & Brand Identity)

* **إطار العمل:** Next.js 14 (App Router) مع TypeScript.
* **التصميم وواجهة المستخدم:** Tailwind CSS + مكونات واجهة احترافية متوافقة مع Shadcn UI + أيقونات `lucide-react`، مع دعم كامل للاتجاه من اليمين إلى اليسار (`dir="rtl" lang="ar"`).
* **الهوية اللونية الرسمية المعتمدة:**
  * **الكحلي الداكن الأساسي (`Primary Navy`):** `#1E293B`
  * **الأخضر الزمردي (`Emerald Success`):** `#10B981`
  * **البرتقالي التفاعلي (`Accent Orange`):** `#F97316`
  * **الأصفر التحذيري (`Amber Pending`):** `#F59E0B`
  * **الأحمر التنبيهي (`Danger Red`):** `#EF4444`
  * **خلفية الصفحات (`Background Slate`):** `#F8FAFC`
* **قاعدة البيانات والربط:** الاتصال المباشر بمشروع **Supabase** (`https://iyqgwswvaxwhzuywbmrn.supabase.co`) عبر `@supabase/supabase-js` في [supabase.ts](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/lib/supabase.ts).

---

## 🔐 2. الأمان وحماية الصلاحيات (Security & `super_admin` Auth Guard)

1. **حماية المسارات وفحص الصلاحية الصارم (`Role Guard`):**
   * يتم تسجيل الدخول عبر **Supabase Auth** (`signInWithPassword`) داخل [DashboardShell.tsx](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/components/layout/DashboardShell.tsx) و [DashboardContext.tsx](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/context/DashboardContext.tsx).
   * فور تسجيل الدخول، تتحقق الدالة [`verifySuperAdminRole`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/lib/supabase.ts#L36-L86) عبر الدالة المؤمنة `public.get_my_role()` وفحص جدول `public.users` بالاعتماد على `auth.uid()` من أن المستخدم يمتلك صلاحية:
     `role === 'super_admin'` حصرياً.
   * أي مستخدم آخر (`admin` أو `resident`) يحاول الدخول للداشبورد يتم منعه فوراً وتسجيل خروجه تلقائياً (`supabase.auth.signOut()`) مع إظهار رسالة الخطأ الصريحة:
     > **"غير مصرح لك بالدخول، هذه اللوحة مخصصة لإدارة المنصة فقط"**
2. **الاعتماد الكامل على دوال الـ RPC الآمنة (`Zero ID Spoofing`):**
   * لا يتم تمرير أي معرفات هوية للمدير من الواجهة، وتعتمد جميع عمليات التفعيل والتخصيص على دوال الـ RPC المحمية بـ `SECURITY DEFINER` و `auth.uid()` في قاعدة البيانات:
     * [`rpcSuperAdminConfigureBuilding`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/lib/supabase.ts#L93-L115) (`public.super_admin_configure_building`): لتخصيص باقة العمارة، حالتها، السعر الشهري الاستثنائي (`custom_monthly_price`)، الحد الأقصى المخصص للشقق (`max_apartments_override`)، ومفاتيح المميزات المستقلة (`features_config` JSONB).
     * [`rpcActivateBuildingSubscription`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/lib/supabase.ts#L125-L135) (`public.activate_building_subscription`): لاعتماد أو رفض فواتير تجديد اشتراك التطبيق (`app_subscription_invoices`) مع حماية `Idempotency`، وتمديد صلاحية العمارة، وإدراج مصروف تلقائي في ميزانية العمارة (`expenses`) بعنوان *"رسوم اشتراك تطبيق إدارة العقار"* وخصم قيمته من رصيد الخزينة (`fund_balance`) وإرفاق نفس صورة الإيصال ليظهر للسكان في لوحة الشفافية.

---

## 🖥️ 3. شرح صفحات ووحدات الداشبورد المنجزة (Dashboard Modules)

### أ. الصفحة الرئيسية: الإحصائيات العامة ([`src/app/page.tsx`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/app/page.tsx))
* **4 بطاقات إحصائية (KPI Cards):**
  1. **إجمالي العمارات المسجلة:** مع تفصيل فوري لعدد العمارات النشطة (`active`)، التجريبية (`trial`)، والمنتهية (`expired`).
  2. **إجمالي الشقق والسكان:** سعة الشقق المسجلة على المنصة وإجمالي حسابات السكان ورؤساء الاتحاد.
  3. **طلبات تفعيل الاشتراكات المعلقة (`Pending Invoices`):** بطاقة مميزة باللون الأصفر/البرتقالي (`#F59E0B` / `#F97316`) تعرض عدد ومجموع الفواتير التي تنتظر التفعيل.
  4. **إجمالي إيرادات المنصة:** إجمالي التحصيل الكلي وإيرادات الشهر الحالي من فواتير اشتراكات العمارات المعتمدة.
* **جدولان سريعان:** آخر 5 فواتير اشتراك مرفوعة للمراجعة، وآخر 5 عمارات مسجلة على المنصة.

### ب. إدارة العمارات والتخصيص المرن ([`src/app/buildings/page.tsx`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/app/buildings/page.tsx))
* جدول شامل لجميع العمارات مع **بحث فوري** (باسم العمارة، كود العمارة `building_code`، اسم أو هاتف رئيس الاتحاد) وفلترة حسب الحالة (`active`, `trial`, `expired`) أو نوع الباقة (`free`, `pro`, `plus`).
* **نافذة تفاصيل العمارة والتحكم المرن (`Building Control Modal`):**
  ترتبط مباشرة بدالة `super_admin_configure_building` وتتيح:
  1. تغيير الباقة (`free`, `pro`, `plus`) أو الحالة أو تمديد تاريخ انتهاء الاشتراك يدوياً.
  2. تخصيص السعر الشهري (`custom_monthly_price`) كعرض خاص للعمارة أو تركه فارغاً ليتبع السعر العام.
  3. تخصيص الحد الأقصى للشقق (`max_apartments_override`) لفتح عدد شقق إضافي استثنائياً.
  4. **مفاتيح المميزات المستقلة (`features_config` JSONB Switches):** 6 أزرار Toggle مستقلة لتفعيل/إيقاف كل ميزة على حدة للعمارة (رفع الإيصالات بالصور، المطالبات الطارئة، تصدير التقارير PDF/Excel، التصويت، تذاكر الصيانة، وأرشيف المستندات).

### ج. مركز مراجعة فواتير اشتراك التطبيق والتفعيل الذكي ([`src/app/invoices/page.tsx`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/app/invoices/page.tsx))
* استعراض جميع الفواتير المرفوعة من رؤساء الاتحاد في جدول `app_subscription_invoices`.
* **نافذة تكبير صورة إيصال التحويل (`High-Res Receipt Preview Modal`)** من سلة `subscription-receipts` مع تفاصيل المبلغ وعدد الأشهر المطلوبة.
* **زر "اعتماد وتفعيل الاشتراك" (`activate_building_subscription` RPC):**
  يقوم بضغطة زر واحدة بـ:
  1. تحويل حالة الفاتورة إلى `approved` (مع قفل حماية `Idempotency` لمنع النقر المزدوج).
  2. تحديث حالة العمارة إلى `active` وتمديد تاريخ انتهاء الاشتراك.
  3. إدراج مصروف تلقائي في ميزانية العمارة (`expenses`) بعنوان *"رسوم اشتراك تطبيق إدارة العقار"* وخصم قيمته من رصيد خزينة العمارة (`fund_balance`) وإرفاق نفس صورة الإيصال ليظهر للسكان في لوحة الشفافية.
* **زر "رفض الإيصال":** يفتح نافذة إدخال **سبب الرفض** ليظهر لرئيس الاتحاد في إشعارات التطبيق.

### د. إدارة قوالب الباقات العامة ([`src/app/plans/page.tsx`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/app/plans/page.tsx))
* شاشة للتحكم المباشر في جدول `subscription_plans` لتعديل الأسعار الشهرية الافتراضية، الحدود القصوى للشقق، والمميزات الافتراضية للباقات الثلاث (`free`, `pro`, `plus`).

### هـ. دليل المستخدمين ورؤساء الاتحاد ([`src/app/users/page.tsx`](file:///d:/WorkSpace/%D8%A7%D8%AA%D8%AD%D8%A7%D8%AF%20%D9%85%D9%84%D8%A7%D9%83/admin-dashboard/src/app/users/page.tsx))
* عرض قائمة المستخدمين ورؤساء الاتحاد مع بحث فوري بالاسم أو رقم الهاتف أو العمارة، وفلترة حسب الدور وحالة الحساب (`active`, `pending`, `suspended`, `rejected`) مع إمكانية تعديل حالة الحساب مباشرة.

---

## 🗂️ 4. هيكل مجلدات مشروع الداشبورد (`admin-dashboard/`)

```text
admin-dashboard/
├── DASHBOARD_DOCUMENTATION.md        # هذا الملف: التوثيق المستقل الشامل للوحة تحكم الويب
├── package.json                      # مكتبات الويب المستقلة (Next.js, React, Tailwind, Supabase, Lucide)
├── tsconfig.json                     # إعدادات TypeScript الخاصة بـ Next.js
├── tailwind.config.ts                # إعدادات الهوية اللونية (#1E293B, #10B981, #F97316, #F59E0B, #EF4444, #F8FAFC)
├── postcss.config.mjs                # إعدادات PostCSS
├── next.config.mjs                   # إعدادات Next.js والسماح بصور Supabase Storage
├── .env.local                        # متغيرات اتصال Supabase (NEXT_PUBLIC_SUPABASE_URL & KEY)
└── src/
    ├── types/
    │   └── database.ts               # تعريفات الجداول والـ JSONB والـ RPCs المطابقة لقاعدة البيانات
    ├── lib/
    │   └── supabase.ts               # عميل Supabase ودوال الـ RPC المؤمنة لـ super_admin
    ├── context/
    │   └── DashboardContext.tsx      # إدارة الحالة المركزية، حارس صلاحية super_admin، والربط اللحظي بـ Supabase
    ├── components/
    │   └── layout/
    │       └── DashboardShell.tsx    # التخطيط العام (Sidebar RTL + Header + شاشة تسجيل الدخول المحمية)
    └── app/
        ├── globals.css               # تنسيقات Tailwind والخط العربي (Cairo / Readex Pro) واتجاه RTL
        ├── layout.tsx                # الجذر العام للتطبيق (dir="rtl" lang="ar")
        ├── page.tsx                  # (أ) الصفحة الرئيسية: الإحصائيات العامة (Overview & KPIs)
        ├── buildings/
        │   └── page.tsx              # (ب) إدارة العمارات والتخصيص المرن (Buildings & Custom Overrides Drawer/Modal)
        ├── invoices/
        │   └── page.tsx              # (ج) مركز مراجعة فواتير اشتراك التطبيق والتفعيل الذكي (Subscription Invoices)
        ├── plans/
        │   └── page.tsx              # (د) إدارة قوالب الباقات العامة (Global Subscription Plans)
        └── users/
            └── page.tsx              # (هـ) دليل المستخدمين ورؤساء الاتحاد (Users Directory)
```

---

## 🚀 5. طريقة تشغيل لوحة تحكم الويب (`admin-dashboard`)

لتشغيل لوحة تحكم الويب بشكل مستقل تماماً عن تطبيق الموبايل:

```bash
cd admin-dashboard
npm install
npm run dev
```

ثم افتح المتصفح على الرابط:
**`http://localhost:3005`**

---

## 📊 6. سجل التقدم وحالة بناء الوحدات (Progress Log)

- [x] **الخطوة 1:** إنشاء مجلد `admin-dashboard/` وملف التوثيق المستقل `admin-dashboard/DASHBOARD_DOCUMENTATION.md`.
- [x] **الخطوة 2:** تهيئة ملفات مشروع Next.js (`package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local`).
- [x] **الخطوة 3:** إعداد اتصال Supabase (`src/lib/supabase.ts`) وحارس الصلاحيات الصارم (`role === 'super_admin'`) في `src/context/DashboardContext.tsx`.
- [x] **الخطوة 4:** بناء التخطيط العام (`Sidebar + Header RTL`) والصفحات الخمس بالكامل:
  - [x] أ. الصفحة الرئيسية: الإحصائيات العامة (`Overview & KPIs`)
  - [x] ب. إدارة العمارات والتخصيص المرن (`Buildings & Custom Overrides Management`)
  - [x] ج. مركز مراجعة فواتير اشتراك التطبيق والتفعيل الذكي (`Subscription Invoices & Auto-Expense`)
  - [x] د. إدارة قوالب الباقات العامة (`Global Subscription Plans`)
  - [x] هـ. دليل المستخدمين ورؤساء الاتحاد (`Users Directory`)
- [x] **الخطوة 5:** تثبيت الحزم وفحص `TypeScript` وتحديث التوثيق النهائي.
- [x] **الخطوة 6 (إصلاح وتفعيل التوجيهات والأزرار بالكامل):**
  - مطابقة أنواع البيانات المشتركة بين صفحات الداشبورد وقاعدة البيانات (`floor_number`, `claim.target_amount`, `obligation.status === 'unpaid'`).
  - فحص TypeScript شامل وتصفير كافة أخطاء التحقق (`tsc --noEmit` exited with 0).
  - التأكد من استجابة كافة المسارات الرئيسية (`/`, `/buildings`, `/invoices`, `/plans`, `/users`) بحالة `200 OK`.
- [x] **الخطوة 7 (المصادقة الفورية للإدارة العليا One-Click Super Admin):**
  - تفعيل الدخول المباشر بنقرة واحدة عبر زر `⚡ دخول مباشر وفوري كمدير عام (Super Admin)` بالبيانات المعتمدة `superadmin@ittihad.app` / `AdminPassword@2026`.
  - التحقق التلقائي في الخلفية على مستوى `DashboardContext` لمنع أي خروج مفاجئ للجلسة.
- [x] **الخطوة 8 (أدوات الحذف والتصفير السريع للمدير العام):**
  - تفعيل الربط مع دالة `reset_building_data` وتمرير مفتاح التجاوز `p_secret_key: 'ITTIHAD_DEV_RESET_2026'` لدعم تصفير السكان أو حذف العمارة بالكامل بنقرة واحدة لتسهيل وتيرة الاختبار والتطوير.
