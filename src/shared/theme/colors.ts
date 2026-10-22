/**
 * Exact Color Palette from design/stitch_/design.md and
 * design/stitch_/ittihad_trust_mobile/DESIGN.md
 * Strictly enforced across all screens and UI components.
 */
export const COLORS = {
  // Primary / Authority Deep Navy
  primary: '#091426',
  onPrimary: '#FFFFFF',
  primaryContainer: '#1E293B',
  onPrimaryContainer: '#8590A6',
  primaryFixed: '#D8E3FB',
  primaryFixedDim: '#BCC7DE',
  onPrimaryFixed: '#111C2D',
  inverseSurface: '#213145',
  inverseOnSurface: '#EAF1FF',

  // Secondary / Emerald Green
  secondary: '#006C49',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#6CF8BB',
  onSecondaryContainer: '#00714D',
  secondaryFixed: '#6FFBBE',
  secondaryFixedDim: '#4EDEA3',

  // Tertiary / Amber
  tertiary: '#201100',
  tertiaryContainer: '#3C2300',
  onTertiaryContainer: '#C88000',
  tertiaryFixed: '#FFDDB8',
  tertiaryFixedDim: '#FFB95F',

  // Semantic Status Tokens (Strictly from DESIGN.md)
  statusPaid: '#10B981',
  statusPaidBg: '#ECFDF5',
  statusPaidText: '#047857',
  badgePaidBg: '#ECFDF5',
  badgePaidText: '#047857',

  statusPending: '#F97316',
  statusPendingBg: '#FFF7ED',
  statusPendingText: '#C2410C',
  badgePendingBg: '#FFF7ED',
  badgePendingText: '#C2410C',

  statusUpcoming: '#F59E0B',
  statusUpcomingBg: '#FFFBEB',
  statusUpcomingText: '#B45309',

  statusUnpaid: '#EF4444',
  statusUnpaidBg: '#FEF2F2',
  statusUnpaidText: '#B91C1C',
  badgeUnpaidBg: '#FEF2F2',
  badgeUnpaidText: '#B91C1C',

  // Error Tokens
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',

  // Surfaces & Neutrals
  surfaceCanvas: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  surface: '#F8F9FF',
  surfaceContainerLow: '#EFF4FF',
  surfaceContainer: '#E5EEFF',
  surfaceContainerHigh: '#DCE9FF',
  surfaceContainerHighest: '#D3E4FE',
  onSurface: '#0B1C30',
  onSurfaceVariant: '#45474C',
  neutralSlate: '#64748B',
  outline: '#75777D',
  outlineVariant: '#C5C6CD',
  borderSubtle: '#E2E8F0',
  scrim: 'rgba(15, 23, 42, 0.4)',
} as const;
