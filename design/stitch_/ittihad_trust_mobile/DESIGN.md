---
name: Ittihad Trust Mobile
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45474c'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#201100'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c2300'
  on-tertiary-container: '#c88000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  status-unpaid: '#EF4444'
  status-pending: '#F97316'
  status-paid: '#10B981'
  status-upcoming: '#F59E0B'
  surface-canvas: '#F8FAFC'
  surface-card: '#FFFFFF'
  border-subtle: '#E2E8F0'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  numeric-hero:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-trust, functional, and modern administrative experience tailored for collective real estate governance and tenant coordination in Arabic-speaking environments (RTL first). The visual personality balances institutional credibility with effortless community accessibility.

The aesthetic fuses **Corporate Modern** with **Soft Neoclassical Mobile Precision**:
- High-clarity tabular and card-based data representations that instill confidence in financial dealings.
- Humanized, calm slate backgrounds preventing visual fatigue during dense balance and ledger audits.
- Purposeful semantic status color-coding that guides resident compliance without inducing undue alarm.
- Native Arabic typographical rhythm, engineered with generous vertical line-heights and open counter shapes to maximize legibility on dense mobile screens.

## Colors

The palette leverages authoritative slate blue as the anchor for governance and administrative identity, supported by universally understood semantic tints for communal financial operations.

- **Primary (`#1E293B`):** Deep Navy/Slate. Carries high authority, used for primary action triggers, global navigation bars, major account card backdrops, and top-tier typography.
- **Secondary (`#10B981`):** Emerald Green. Designated for solvency, completed payments, verified fund reconciliations, and positive balance indicators.
- **Tertiary (`#F59E0B`):** Warm Amber. Applied to imminent maintenance dates, notices, and scheduled actions needing resident attention.
- **Neutral (`#64748B`):** Balanced Slate. Drives structural boundaries, secondary labels, helper descriptions, and inactive states against the `#F8FAFC` base canvas.

### Semantic Status Tokens
- `status-unpaid` (`#EF4444`): Urgent arrears, delinquent payment statuses, and critical infrastructure alarms.
- `status-pending` (`#F97316`): Bank transfer slips pending manager audit and resident review requests.
- `status-paid` (`#10B981`): Settled dues, validated receipts, and satisfied maintenance goals.
- `status-upcoming` (`#F59E0B`): Approaching monthly dues and scheduled vendor visits.

## Typography

The typographic hierarchy prioritizes bi-directional clarity and tabular numeral alignment. In production implementations supporting standard Arabic locales, modern display typefaces such as Cairo or Tajawal map seamlessly to the structural weights specified here.

- **Numerals and Ledger Codes:** Fall back to tabular figures (`font-variant-numeric: tabular-nums`) via Inter to guarantee that currency values (e.g., EGP / ج.م), apartment codes, and dates align uniformly across transactional balance sheets.
- **RTL Fluidity:** Arabic display headers receive 1.4x to 1.5x proportional line heights to account for ascenders and descending diacritics without causing card collisions.

## Layout & Spacing

The layout is built mobile-first, centered on a 4-column compact fluid grid on mobile devices (width &lt; 600px), transitioning to an 8-column layout on tablets and handheld administrative surfaces.

- **Screen Margins:** Fixed `1rem` (16px) left and right padding maintains maximum screen real-estate for balance overview sheets.
- **Touch Bounds:** All interactive elements maintain a minimum vertical hit-target of 48px to accommodate quick thumb interactions.
- **RTL Inversion:** The 16px lateral layout margins dynamically map to `margin-inline-start` and `margin-inline-end`, ensuring icons, list chevrons, and status flags align automatically to RTL reading flow.

## Elevation & Depth

Visual hierarchy uses surface layering over high contrast, avoiding heavy dramatic drop shadows in favor of crisp administrative separation.

- **Level 0 (Canvas Base):** Flat `#F8FAFC`. Houses passive background information and structural groupings.
- **Level 1 (Operational Cards & Modules):** Pure `#FFFFFF` surface elevated by a subtle dual-layer shadow: `0px 1px 3px rgba(15, 23, 42, 0.05), 0px 1px 2px rgba(15, 23, 42, 0.03)` with a hairline boundary `1px solid #E2E8F0`.
- **Level 2 (Active/Floating Widgets):** Used for elevated bottom navigation bars, quick-action sheets, and sticky header summaries: `0px 4px 6px -1px rgba(15, 23, 42, 0.06), 0px 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals & Bottom Drawers):** Used for transaction confirmation dialogs and payment screenshot receipts: `0px 20px 25px -5px rgba(15, 23, 42, 0.1), 0px 8px 10px -6px rgba(15, 23, 42, 0.04)` over a 40% opacity slate scrim backdrop (`#0F172A66`).

## Shapes

The geometric identity relies on soft, welcoming contours that keep structural records approachable.

- **Containers & Master Cards:** Built with a primary radius of `1rem` (16px) to house distinct account blocks, expense items, and summary widgets.
- **Buttons & Interactive Inputs:** Built with `0.5rem` (8px) to provide defined, clickable tap zones.
- **Status Pills & Micro-badges:** Full pill radius (`9999px`) to emphasize non-interactive metadata tags against rectangular card geometry.

## Components

### Buttons
- **Primary Action (Call-to-Action):** High-contrast `#1E293B` background with white text, 48px height, 8px border radius, and centered flex layout. 
- **Secondary / Actionable Neutral:** `#F1F5F9` background with `#1E293B` label, no border, used for sub-actions like "إرسال تذكير" (Send Reminder).
- **Destructive Action:** Low-saturation light red surface (`#FEE2E2`) with `#EF4444` label.

### Status Badges & Chips
- Soft tint surfaces combined with saturated foreground text to ensure WCAG AA readability:
  - **Paid (مدفوع):** `#ECFDF5` background with `#047857` text.
  - **Pending (قيد المراجعة):** `#FFF7ED` background with `#C2410C` text.
  - **Unpaid / Overdue (متأخر):** `#FEF2F2` background with `#B91C1C` text.
  - **Notice (تنبيه):** `#FFFBEB` background with `#B45309` text.
- Badges feature an inline directional dot (6px circle) pinned to the right of the Arabic label.

### Form Inputs & Code Fields
- **Apartment / Code Inputs:** Pure white background, 48px height, 1px border using `#CBD5E1`.
- **Focus State:** Transitions border color to `#1E293B` with a 2px outer ambient ring in `#E2E8F0`.
- **RTL Labels:** Right-aligned floating labels with small, muted typography (`label-sm`).

### Cards & Financial Feed Modules
- **Hero Balance Card:** Deep Navy `#1E293B` linear gradient to `#0F172A`, white typography, housing the aggregate treasury sum with Inter numerals and Arabic sub-labels.
- **Expense / Resident List Item:** White card container with 16px radius, featuring apartment number in a soft neutral rounded square, resident name stacked above due date, and aligned currency on the left edge (in RTL).

### Mobile Bottom Sheets
- Fixed-height or wrap-content bottom-sheet container replacing full-screen modals for payment uploads (InstaPay / Cash confirmations), equipped with a centered top drag handle (36px width, 4px height, `#CBD5E1`).