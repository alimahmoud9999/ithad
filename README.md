# 🏢 تطبيق مدير اتحاد الملاك — Ittihad Trust Mobile
### النظام السحابي المتكامل الذكي لإدارة العمارات السكنية واتحادات الملاك والشاغلين (SaaS)

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-NativeWind-38B2AC?logo=tailwind-css&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Status-Production_Ready-success" alt="Status" />
  <img src="https://img.shields.io/badge/Language-العربية_%7C_Arabic-blue" alt="Language" />
</p>

---

## 📖 نظرة عامة (Overview)

**تطبيق مدير اتحاد الملاك (Ittihad Trust Mobile)** هو نظام سحابي متكامل مصمم خصيصاً للبيئة العربية لحل كافة التعقيدات المالية والإدارية التي تواجه اتحادات الملاك والشاغلين، العمارات السكنية، والمجمعات السكنية (الكمبوندات). 

يقضي التطبيق نهائياً على النزاعات التقليدية وفقدان الفواتير الورقية أو عشوائية جروبات الواتساب، من خلال توفير **خزينة رقمية شفافة بنسبة 100%**، توثيق دقيق لكل مليم يدخل أو يخرج من الصندوق بصور الفواتير وإيصالات التحويل، وإدارة ذكية للمتأخرات والمديونيات والمطالبات الطارئة.

---

## ✨ المميزات الرئيسية (Core Features)

### 1. 👥 تجربة مخصصة حسب الدور (Role-Based Access)
يحتوي التطبيق على **3 لوحات تحكم متكاملة** تتغير الواجهة والأذونات ديناميكياً بناءً عليها:

#### 👑 رئيس الاتحاد / مدير العمارة (`admin`):
- **إدارة الوحدات والسكان:** إضافة وتعديل الشقق، قبول طلبات انضمام السكان، ومتابعة سجل الملاك والمستأجرين.
- **اعتماد ومراجعة المدفوعات:** إشعارات فورية بالتحويلات البنكية وإيصالات (InstaPay / فودافون كاش / نقداً)، مع خيار الاعتماد الفوري أو الرفض المسبب.
- **قيد المديونيات والالتزامات السابقة:** تسجيل مديونيات قديمة على أي وحدة، وترحيل المديونيات عند انتقال الملكية.
- **مطالبات الصيانة الطارئة:** إنشاء حملات صيانة طارئة (مصعد، موتور مياه، تسريب) وتوزيع التكلفة بالتساوي أو بنسب مخصصة مع شريط تقدم مباشر (`Progress Bar`).
- **سجل المصروفات الموثق:** إضافة بنود الصرف مع رفع الفواتير الضريبية وتحديث رصيد الصندوق تلقائياً.
- **تذكير المتأخرين:** إرسال رسائل تذكير تلقائية عبر الواتساب للمتأخرين بنقرة واحدة.

#### 🏡 المالك / الساكن (`resident`):
- **سداد الاشتراكات الشهرية:** سداد اشتراك العمارة بسهولة برفع إشعار التحويل الإلكتروني أو اختيار السداد النقدي.
- **سداد المديونيات المرن (جزئي أو كامل):** إمكانية سداد المديونيات السابقة بالكامل أو على دفعات جزئية مريحة مع خصم فوري وموثق بنظام (FIFO).
- **متابعة مباشرة للدفعات المعلقة:** شارات توضح المبالغ قيد المراجعة والمتبقي المتوقع بعد الاعتماد.
- **الشفافية الكاملة (خزينة مفتوحة):** الاطلاع اللحظي على رصيد العمارة وسجل المصروفات وصور الفواتير لتعزيز الثقة.
- **بلاغات الصيانة (Tickets):** فتح تذاكر أعطال ومتابعة جدول زيارات الفنيين ومواعيد الإصلاح.

#### 🌐 مالك المنصة (`super_admin`):
- **إدارة نموذج الاشتراكات (SaaS Subscriptions):** متابعة باقات العمارات، منح فترات تجريبية مجانية (60 يوماً)، وتفعيل الاشتراكات الشهرية/السنوية.
- **الخصم المحاسبي الآلي:** عند تفعيل اشتراك عمارة، يقوم النظام تلقائياً بتوليد مصروف رسمي في حسابات العمارة وخصمه من الخزينة تلقائياً.

---

### 2. 💰 الدورة المحاسبية الذكية
- **الخصم بنظام الأولوية (FIFO):** عند قيام الساكن بسداد جزئي لأي مديونية، يتم الخصم تلقائياً من أقدم التزام مالي مسجل وتحديث متبقي البند ورصيد الشقة بدقة متناهية.
- **منع الازدواج المالي (Idempotency Control):** خوارزميات أمان تمنع تكرار تسجيل الدفع لنفس الشهر أو نفس البند مرتين بالخطأ.
- **ضغط الصور التلقائي:** تقليل حجم إيصالات السداد والفواتير بنسبة تصل إلى 80% قبل رفعها لتسريع التحميل وتوفير مساحات التخزين السحابي.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

| المجال | التقنية | الوصف |
| :--- | :--- | :--- |
| **Mobile Framework** | [React Native 0.86](https://reactnative.dev/) / [Expo SDK 57](https://expo.dev/) | تطبيق أندرويد و iOS بأداء أصيل (Native Performance) ودعم كامل للويب. |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | بنية كود متينة وخالية من الأخطاء النوعية (Strict Type Checking). |
| **Backend & Database** | [Supabase](https://supabase.com/) | قاعدة بيانات PostgreSQL علائقية، نظام مصادقة، وسياسات أمان (RLS). |
| **Styling** | [TailwindCSS](https://tailwindcss.com/) / NativeWind | واجهات عصرية متناسقة مستوحاة من أحدث مبادئ التصميم العالمية. |
| **State Management** | React Context + Async Storage | تزامن لحظي بين الذاكرة المحلية والمزامنة مع السحابة بدون انقطاع. |
| **Image Processing** | Expo Image Manipulator & Picker | التقاط، اقتصاص، وضغط الإيصالات قبل الرفع السحابي. |
| **Admin Web Portal** | Next.js 15 + Tailwind CSS | لوحة تحكم إدارية مرافقة على الويب في مسار `admin-dashboard/`. |

---

## 📂 هيكل المشروع (Project Structure)

```text
ittihad-trust-mobile/
├── src/
│   ├── app/                  # غلاف التطبيق: RootNavigator و TopHeader وشريط تبديل الأدوار
│   ├── store/                # AppContext: الحالة العامة فقط (تحميل البيانات، realtime، القيم المشتقة)
│   ├── shared/               # كود مشترك بلا منطق أعمال: عميل Supabase، الألوان، الأنواع، مكونات UI، أدوات
│   └── modules/              # وحدة لكل مجال عمل، وكل وحدة مقسمة لنفس الطبقات:
│       ├── auth/             #   تسجيل الدخول، إنشاء العمارة، انضمام الساكن
│       ├── units/            #   الشقق، المديونيات، مراجعة طلبات الانضمام
│       ├── payments/         #   السداد، الاعتماد/الرفض، التذكير، الشقق المتأخرة
│       ├── emergency/        #   مطالبات الطوارئ وإغلاقها بفاتورة
│       ├── expenses/         #   المصروفات والشفافية وحركة الخزينة
│       ├── community/        #   البلاغات والتصويت
│       ├── notifications/    #   الإشعارات الفورية ومركز التنبيهات
│       ├── platform/         #   مالك المنصة: الباقات، تخصيص العمارات، فواتير الاشتراك
│       ├── settings/         #   شاشة الإعدادات
│       ├── admin/            #   لوحة رئيس الاتحاد (تجمع مكونات الوحدات الأخرى)
│       └── resident/         #   الصفحة الرئيسية للساكن (تجمع مكونات الوحدات الأخرى)
├── admin-dashboard/          # لوحة التحكم المستقلة على الويب (Next.js)
├── supabase/
│   └── migrations/           # جميع ملفات الـ SQL Migrations ودوال الـ PostgreSQL
├── App.tsx                   # نقطة الانطلاق الرئيسية للتطبيق
└── package.json              # الاعتماديات وحزم المشروع
```

طبقات كل وحدة (نفس نمط مشروع learning-platform)، ويُنشأ المجلد فقط عند الحاجة:

| الطبقة | المحتوى | مثال |
| :--- | :--- | :--- |
| `domain/` | أنواع وثوابت وقواعد نقية بلا React ولا Supabase | `auth/domain/inviteCode.ts` + `inviteCode.check.ts` |
| `infrastructure/` | استدعاءات Supabase (RPC والجداول) | `payments/infrastructure/payments.api.ts` |
| `application/` | hooks: أفعال الوحدة (`use*Actions`) وحالة النماذج والقيم المشتقة | `resident/application/useResidentLedger.ts` |
| `presentation/` | الشاشة + `components/` صغيرة + `*.styles.ts` | `units/presentation/components/AddUnitModal.tsx` |

الاستيراد: داخل الوحدة بمسارات نسبية، وبين الوحدات أو من `shared` عبر الاختصار `@/` (مثل `@/shared/lib/supabase`).

---

## 🚀 التثبيت والتشغيل المحلي (Getting Started)

### المتطلبات المسبقة:
- تثبيت [Node.js](https://nodejs.org/) (إصدار 18 أو أحدث).
- تطبيق [Expo Go](https://expo.dev/go) على هاتفك أو محاكي Android Studio / Xcode.

### 1. استنساخ المشروع (Clone Repository):
```bash
git clone https://github.com/your-username/ittihad-trust-mobile.git
cd ittihad-trust-mobile
```

### 2. تثبيت الحزم (Install Dependencies):
```bash
npm install
```

### 3. إعداد متغيرات البيئة (Environment Variables):
قم بإنشاء ملف `.env` في المجلد الرئيسي وضع به بيانات مشروعك في Supabase:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. تشغيل قاعدة البيانات (Database Migrations):
قم بتشغيل ملفات الميجريشن الموجودة في مجلد `supabase/migrations/` بالترتيب داخل **SQL Editor** في Supabase Dashboard، لإنشاء الجداول والدوال الأمنية (RLS).

### 5. تشغيل التطبيق (Start Metro Bundler):
```bash
npx expo start -c
```
- امسح رمز الـ **QR Code** الظاهر على الشاشة عبر تطبيق **Expo Go** لتشغيل التطبيق فوراً على هاتفك.
- أو اضغط `a` لفتحه على محاكي الأندرويد، أو `w` لتشغيله في المتصفح.

---

## 🔒 الأمان وحماية البيانات (Security & Permissions)

- **Row Level Security (RLS):** كافة الجداول محمية بسياسات وصول صارمة في PostgreSQL؛ لا يمكن لأي ساكن رؤية بيانات أو مستحقات عمارة أخرى.
- **التشفير والتحقق الصارم:** تُنفذ العمليات المالية الحساسة (مثل اعتماد السداد، توزيع المديونيات) عبر دوال مخزنة مؤمنة (`SECURITY DEFINER RPCs`) مع التحقق التلقائي من `auth.uid()`.
- **صلاحيات الدفع والتعديل:** وضع القراءة فقط (`Read-Only Mode`) يُفعل آلياً في حال انتهاء اشتراك العمارة للحفاظ على نزاهة السجلات المالية.

---

## 🤝 المساهمة والتطوير (Contributing)

المساهمات مرحب بها دائماً! لتطوير التطبيق:
1. قم بعمل **Fork** للمشروع.
2. أنشئ فرعاً لميزتك (`git checkout -b feature/AmazingFeature`).
3. احفظ التعديلات (`git commit -m 'Add some AmazingFeature'`).
4. ادفع الفرع إلى جيت هب (`git push origin feature/AmazingFeature`).
5. افتح **Pull Request**.

---

## 📄 الترخيص (License)

هذا المشروع مطوّر ومحفوظ الحقوق © 2026. للاستخدام التجاري أو التراخيص المخصصة، يُرجى التواصل مع فريق العمل.
