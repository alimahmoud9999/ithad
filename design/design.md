# UI/UX Prompt Guide - تطبيق "مدير اتحاد الملاك"
## 1. Context & Design Persona
* **Role:** Senior Mobile UI/UX Designer.
* **Product:** Building Management App ("مدير اتحاد الملاك") targeting building managers and residents.
* **Tone & Style:** Professional, clean, modern, trustworthy, and minimal.
* **Layout:** Mobile-First, RTL (Right-to-Left / Arabic Language Support).
* **Design System & Aesthetics:**
  * **Colors:** Deep Navy Blue `#1E293B` (Primary/Trust), Forest Green `#10B981` (Paid/Success), Amber Yellow `#F59E0B` (Warning/Upcoming), Crimson Red `#EF4444` (Unpaid/Alert), Orange `#F97316` (Pending Review).
  * **Backgrounds:** Soft Off-White `#F8FAFC` for high contrast and readability.
  * **Typography:** Modern Arabic Font (Tajawal / Cairo / Inter for numbers).
  * **Cards:** Soft shadows (`box-shadow`), rounded corners (`16px/rounded-2xl`).
---
## 2. Master Prompt for AI UI Generators (Figma AI / v0 / Galileo / Claude)
> "Design a clean, modern, RTL (Arabic UI) mobile app interface for a Building Management Application ('مدير اتحاد الملاك'). The UI should feel lightweight, secure, and clear. Focus on high typography hierarchy, intuitive status colors, and simple card-based layouts."
---
## 3. Detailed Screen Prompt Descriptions
### Screen 1: Onboarding & Apartment Selection (شاشة التسجيل واختيار الشقة)
* **Goal:** Quick entry using a Building Code.
* **Components:**
  * Clean hero illustration/icon representing a modern building.
  * Input field for `کود المبنى` (Building Code) with validation state.
  * Dropdown/Grid selection for `رقم الشقة` (Apartment Number).
  * CTA Button: "طلب الانضمام" (Request to Join).
  * State view: "طلبك قيد الموافقة" (Pending Approval banner with animated spinner).
---
### Screen 2: Admin Dashboard - Building Manager (لوحة تحكم رئيس الاتحاد)
* **Goal:** High-level oversight of finances and quick management actions.
* **Top Bar:** Building name ("برج الأمل - شقة 12") + Notification Bell icon.
* **Financial Summary Card (Gradient Navy Background):**
  * Total Fund Balance (`رصيد الصندوق الحالي`): e.g., "EGP 24,500".
  * Sub-stats row: Monthly Income vs Expenses.
* **Quick Action Buttons (Horizontal Row):**
  * "إضافة مصروف" (Add Expense) + "طوارئ جديدة" (New Emergency Fund) + "تذكير الكل" (Remind All).
* **Unpaid Apartments Section (`الشقق المتأخرة`):**
  * Card list showing apartment number, resident name, and unpaid amount.
  * One-tap action: "إرسال تذكير" (Send Reminder) or "تأكيد يدوي" (Manual Confirm).
* **Pending Reviews Widget (`طلبات السداد المعلقة`):**
  * Orange badge showing items waiting for admin approval (Cash/Transfer receipts).
---
### Screen 3: Resident Home & Payment Status (واجهة الساكن الرئيسية)
* **Goal:** Clear visual feedback on current payment status.
* **Status Card (Hero Banner):**
  * Dynamic color banner based on state (Green for Paid, Red for Unpaid, Orange for Pending Review).
  * Text: "اشتراك شهر أكتوبر: تم الدفع 🟢" or "اشتراك شهر أكتوبر: متأخر 🔴".
* **Payment CTA Area:**
  * Prominent button: "سداد الاشتراك الأن" (Pay Subscription Now).
* **Payment Modal/Bottom Sheet (Upon clicking Pay):**
  * Option 1: "تحويل إلكتروني / إنستاباي" -> Triggers image upload for screenshot.
  * Option 2: "دفع نقدي / كاش" -> Dropdown to select recipient ("رئيس الاتحاد" or "حارس العمارة").
* **Emergency Fund Widget (`مطالبة طارئة نشطة`):**
  * Card title: "تغيير طلمبة المياه".
  * Resident share: "المطلوب: 250 ج.م".
  * Progress Bar: "تم جمع 3,500 من 5,000 ج.م (70%)".
---
### Screen 4: Transparency & Expenses Feed (لوحة المصروفات والشفافية)
* **Goal:** Show residents exactly where the building fund is spent.
* **Monthly Selector:** Tab bar for months (أكتوبر، سبتمبر، أغسطس).
* **Expense Feed (List of Cards):**
  * Item Title (e.g., "راتب الحارس", "صيانة المصعد الدوري").
  * Amount in Red/Subtle Grey (`- 1,200 ج.م`).
  * Date + Attachment Badge ("عرض الفاتورة / الصورة").
  * Modal Preview: Tapping an item opens a full-screen image modal of the uploaded paper receipt/invoice.
---
## 4. UI Component Library Specifications (For Frontend Dev)
* **Status Badges:** Rounded pills with soft bg and strong text color (e.g., `bg-emerald-100 text-emerald-700`).
* **Input Fields:** Floating label inputs with clean focus borders (`border-slate-300` -> `border-indigo-600`).
* **Modals:** Slide-up Bottom Sheets for mobile ergonomics.