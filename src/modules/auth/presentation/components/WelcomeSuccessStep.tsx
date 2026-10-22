import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useBuildingCodeLookup } from '../../application/useBuildingCodeLookup';
import type { useResidentJoinForm } from '../../application/useResidentJoinForm';
import type { useSignupForm } from '../../application/useSignupForm';
import type { AuthScreenMode } from '../../domain/auth.types';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface WelcomeSuccessStepProps {
  onClose: (() => void) | undefined;
  setMode: React.Dispatch<React.SetStateAction<AuthScreenMode>>;
  signupForm: ReturnType<typeof useSignupForm>;
  joinForm: ReturnType<typeof useResidentJoinForm>;
  lookup: ReturnType<typeof useBuildingCodeLookup>;
}

export const WelcomeSuccessStep: React.FC<WelcomeSuccessStepProps> = ({
  onClose,
  setMode,
  signupForm,
  joinForm,
  lookup,
}) => {
  const { setAuthenticated, switchRole } = useAppStore();
  const { fullName } = signupForm;
  const { apartmentNumber, floorNumber, residentRoleType } = joinForm;
  const { matchedBuilding } = lookup;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Celebration Beacon */}
      <View style={styles.welcomeHero}>
        <View style={styles.celebrationPulseBox}>
          <View style={styles.radiantGlow} />
          <View style={styles.successIconCircle}>
            <MaterialIcons name="check-circle" size={42} color={COLORS.onSecondary} />
          </View>
        </View>

        <View style={styles.verifiedSuccessBadge}>
          <MaterialIcons name="verified" size={16} color={COLORS.secondary} />
          <Text style={styles.verifiedSuccessText}>اكتمل التفعيل بنجاح</Text>
        </View>

        <Text style={styles.welcomeTitle}>تم تفعيل حسابك بنجاح! 🎉</Text>
        <Text style={styles.welcomeSub}>
          أهلاً بك يا <Text style={styles.boldNavyText}>{fullName || 'م. أحمد مصطفى'}</Text> في عائلة مجتمع {matchedBuilding?.name || 'برج الأمل السكني'}
        </Text>
      </View>

      {/* Digital Membership Card */}
      <View style={styles.membershipCard}>
        <View style={styles.cardTopGradientLine} />

        <View style={styles.membershipCardHeader}>
          <View style={styles.membershipIconBox}>
            <MaterialIcons name="badge" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardMainTitle}>بطاقة عضوية الساكن الرقمية</Text>
            <Text style={styles.cardSubTitle}>اتحاد شاغلي العقار الرسمي</Text>
          </View>
          <View style={styles.registeredPill}>
            <View style={styles.greenDot} />
            <Text style={styles.registeredPillText}>موثق ومسجل</Text>
          </View>
        </View>

        {/* Property & Unit Info Box */}
        <View style={styles.unitDetailBanner}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="location-city" size={18} color={COLORS.secondary} />
              <Text style={styles.buildingBannerTitle}>{matchedBuilding?.name || 'برج الأمل السكني'}</Text>
            </View>
            <Text style={styles.buildingBannerCity}>{matchedBuilding?.city || 'المعادي الجديدة'}</Text>
          </View>

          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <View style={styles.apartmentBadge}>
              <MaterialIcons name="meeting-room" size={16} color={COLORS.primaryContainer} />
              <Text style={styles.apartmentBadgeText}>
                شقة {apartmentNumber || '302'} • {floorNumber || 'الدور الثالث'} (واجهة)
              </Text>
            </View>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{residentRoleType}</Text>
            </View>
          </View>
        </View>

        {/* Financials & Common Share Metadata */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.metadataCard}>
            <Text style={styles.metadataLabel}>الحصة الشائعة بالأرض</Text>
            <Text style={styles.metadataValueNavy}>6.25%</Text>
            <Text style={styles.metadataSub}>وفق عقد الملكية</Text>
          </View>

          <View style={styles.metadataCard}>
            <Text style={styles.metadataLabel}>الاشتراك الشهري</Text>
            <View style={styles.rowAlign}>
              <Text style={styles.metadataValueGreen}>
                {matchedBuilding?.default_monthly_dues || 400}
              </Text>
              <Text style={styles.currencySubText}>ج.م</Text>
            </View>
            <Text style={styles.metadataSub}>خدمات وصيانة دورية</Text>
          </View>
        </View>

        {/* QR & Security Bar */}
        <View style={styles.qrValidationBar}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="qr-code-2" size={26} color={COLORS.primary} />
            <View>
              <Text style={styles.qrCodeLabel}>رمز العضوية المشفر</Text>
              <Text style={styles.qrCodeVal}>BLD-{matchedBuilding?.building_code || 'EG'}-APT-{apartmentNumber || '302'}</Text>
            </View>
          </View>
          <MaterialIcons name="security" size={20} color={COLORS.statusPaid} />
        </View>
      </View>

      {/* Enter App Primary CTA */}
      <TouchableOpacity
        style={styles.primaryActionButton}
        activeOpacity={0.88}
        onPress={() => {
          switchRole('resident');
          setAuthenticated(true);
          onClose?.();
        }}
      >
        <Text style={styles.primaryActionText}>الدخول إلى واجهة الساكن الرئيسية</Text>
        <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
      </TouchableOpacity>

      {/* Go to Login Screen Option */}
      <TouchableOpacity
        style={[styles.outlineActionBtn, { marginTop: 12, justifyContent: 'center' }]}
        activeOpacity={0.88}
        onPress={() => setMode('login')}
      >
        <MaterialIcons name="login" size={18} color={COLORS.secondary} />
        <Text style={[styles.outlineActionText, { color: COLORS.secondary }]}>
          الذهاب لشاشة تسجيل الدخول اليومي (Login)
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
