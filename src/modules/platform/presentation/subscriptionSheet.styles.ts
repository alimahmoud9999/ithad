import { StyleSheet, I18nManager } from 'react-native';
import { COLORS } from '@/shared/theme/colors';

export const styles = StyleSheet.create({
  modalForm: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  input: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  twoCol: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    gap: 10,
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  catChipTextActive: {
    color: COLORS.onPrimary,
  },
  invoiceAttachCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  invoiceAttachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  invoiceAttachSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  subInfoBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
  },
  subInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  subInfoDesc: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  calculatedPriceBox: {
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculatedPriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.secondaryFixed,
  },
  uploadButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  uploadPickerBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceCanvas,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadPickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
});
