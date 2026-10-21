import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { copyToClipboard, sendWhatsAppInvite } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import type { useBuildingRegistrationForm } from '../../application/useBuildingRegistrationForm';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface CreatedSuccessStepProps {
  onClose: (() => void) | undefined;
  adminForm: ReturnType<typeof useBuildingRegistrationForm>;
  createdBuildingCode: string;
}

export const CreatedSuccessStep: React.FC<CreatedSuccessStepProps> = ({
  onClose,
  adminForm,
  createdBuildingCode,
}) => {
  const { setAuthenticated, switchRole } = useAppStore();
  const { buildingName } = adminForm;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.inviteLandingCard}>
        <View style={styles.inviteIconHeader}>
          <MaterialIcons name="celebration" size={32} color={COLORS.onPrimary} />
        </View>

        <Text style={styles.inviteSuccessTitle}>تم تأسيس العمارة وتفعيل نظام الاتحاد بنجاح! 🏢</Text>
        <Text style={styles.inviteSuccessSub}>
          تم تفعيل فترة تجريبية مجانية 60 يوماً بكامل مزايا باقة Pro لرئيس الاتحاد وسكان {buildingName}
        </Text>

        <View style={styles.codeHighlightContainer}>
          <Text style={styles.codeHighlightHeader}>كود العمارة الموحد لانضمام السكان:</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeTextBig}>{createdBuildingCode}</Text>
          </View>
          <Text style={styles.codeHighlightHint}>شارك هذا الكود مع ملاك وسكان البرج لينضموا مباشرة</Text>
        </View>

        {/* Actions: Copy & WhatsApp */}
        <View style={styles.twoColumnGrid}>
          <TouchableOpacity
            style={styles.outlineActionBtn}
            onPress={() => copyToClipboard(createdBuildingCode, 'كود المبنى')}
          >
            <MaterialIcons name="content-copy" size={18} color={COLORS.primary} />
            <Text style={styles.outlineActionText}>نسخ الكود</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.whatsAppActionBtn}
            onPress={() =>
              sendWhatsAppInvite({
                buildingName: buildingName || 'العمارة',
                buildingCode: createdBuildingCode,
              })
            }
          >
            <MaterialIcons name="share" size={18} color="#FFFFFF" />
            <Text style={styles.whatsAppActionText}>مشاركة واتساب 📲</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionButton, { marginTop: 16 }]}
          onPress={() => {
            switchRole('admin');
            setAuthenticated(true);
            onClose?.();
          }}
        >
          <Text style={styles.primaryActionText}>الدخول للوحة تحكم رئيس الاتحاد</Text>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
