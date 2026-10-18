import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

interface BottomSheetModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Slide-up Bottom Sheet following DESIGN.md Level 3 specifications:
 * - Centered top drag handle (36px width, 4px height, #CBD5E1)
 * - 40% opacity slate scrim backdrop (#0F172A66)
 * - Respects top and bottom safe area insets on Android & iOS
 */
export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  title,
  subtitle,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom + 16, 28);
  const topSafeMargin = Math.max(insets.top + 16, 44);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: bottomSafePadding,
              marginTop: topSafeMargin,
            },
          ]}
        >
          {/* Drag Handle: 36px x 4px #CBD5E1 */}
          <View style={styles.handleWrapper}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="إغلاق"
            >
              <MaterialIcons
                name="close"
                size={20}
                color={COLORS.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.scrim,
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: COLORS.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 9999,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    marginBottom: 12,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingBottom: 16,
  },
});
