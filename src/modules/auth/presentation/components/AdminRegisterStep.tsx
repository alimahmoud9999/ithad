import React from 'react';
import { ScrollView, View, TouchableOpacity, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useBuildingRegistrationForm } from '../../application/useBuildingRegistrationForm';
import type { useSignupForm } from '../../application/useSignupForm';
import type { AuthScreenMode } from '../../domain/auth.types';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface AdminRegisterStepProps {
  setMode: React.Dispatch<React.SetStateAction<AuthScreenMode>>;
  signupForm: ReturnType<typeof useSignupForm>;
  adminForm: ReturnType<typeof useBuildingRegistrationForm>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
  setCreatedBuildingCode: React.Dispatch<React.SetStateAction<string | null>>;
}

export const AdminRegisterStep: React.FC<AdminRegisterStepProps> = ({
  setMode,
  signupForm,
  adminForm,
  setSubmitting,
  submitting,
  setCreatedBuildingCode,
}) => {
  const { createBuildingForAdmin } = useAppStore();
  const { email, fullName, phone, setEmail, setFullName, setPhone, signupPassword } = signupForm;
  const { adminApartment, buildingAddress, buildingName, defaultMonthlyDues, legalDeclaration, projectedMonthlyTreasury, setAdminApartment, setBuildingAddress, setBuildingName, setDefaultMonthlyDues, setLegalDeclaration, setTotalApartments, setTreasuryAccount, totalApartments, treasuryAccount } = adminForm;

  // Handle Admin Register Submit (Screen 3: ADMIN_REGISTER)
  const handleAdminRegisterSubmit = async () => {
    if (!buildingName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم العقار أو البرج السكني.');
      return;
    }
    if (!legalDeclaration) {
      Alert.alert('تنبيه', 'يرجى الإقرار بصحة البيانات ومسؤولية إدارة العقار للمتابعة.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBuildingForAdmin({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: signupPassword,
        buildingName: buildingName.trim(),
        address: buildingAddress.trim() || 'التجمع الخامس - القاهرة',
        totalApartments: parseInt(totalApartments, 10) || 16,
        defaultMonthlyDues: parseFloat(defaultMonthlyDues) || 400,
        adminApartmentNumber: adminApartment.trim() || '12',
      });
      setCreatedBuildingCode(res.buildingCode);
      setMode('created_success');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'حدث خطأ أثناء تأسيس العقار.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Navigation Bar */}
      <View style={styles.topBackBar}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => setMode('signup')}
        >
          <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={styles.safePlatformPill}>
          <MaterialIcons name="verified-user" size={15} color={COLORS.secondary} />
          <Text style={styles.safePlatformText}>منصة آمنة وموثقة</Text>
        </View>
        <View style={styles.avatarMiniCircle}>
          <MaterialIcons name="person" size={18} color={COLORS.onPrimary} />
        </View>
      </View>

      {/* Screen Header */}
      <View style={styles.screenIntro}>
        <View style={styles.tagCapsule}>
          <MaterialIcons name="apartment" size={14} color={COLORS.secondary} />
          <Text style={styles.tagCapsuleText}>تسجيل مجلس الإدارة</Text>
        </View>
        <Text style={styles.screenHeading}>تسجيل رئيس / مدير اتحاد الملاك</Text>
        <Text style={styles.screenDesc}>
          سجّل بصفتك المفوّض أو رئيس مجلس الإدارة وأنشئ الحساب المالي المعتمد لعقارتك بكل شفافية وسلاسة.
        </Text>
      </View>

      {/* Active Admin Role Pill Badge */}
      <View style={styles.roleSummaryBanner}>
        <View style={styles.adminShieldBox}>
          <MaterialIcons name="admin-panel-settings" size={22} color={COLORS.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowAlign}>
            <Text style={styles.roleSummaryTitle}>مدير / رئيس مجلس الاتحاد</Text>
            <MaterialIcons name="verified" size={16} color={COLORS.statusPaid} />
          </View>
          <Text style={styles.roleSummarySub}>صلاحيات كاملة لإدارة الخزينة والتحصيل والتقارير</Text>
        </View>
        <View style={styles.certifiedTag}>
          <Text style={styles.certifiedTagText}>معتمد رسمياً</Text>
        </View>
      </View>

      {/* Step 1: Manager Profile Card */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.rowAlign}>
            <View style={styles.sectionIconBox}>
              <MaterialIcons name="badge" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>بيانات رئيس المجلس (المسؤول الأول)</Text>
          </View>
          <Text style={styles.stepCounterText}>خطوة ١ من ٢</Text>
        </View>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>الاسم الرباعي لرئيس الاتحاد / المشرف المفوّض *</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person-pin" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInputField}
              value={fullName}
              onChangeText={setFullName}
              placeholder="مثال: م. أحمد عبد العزيز شاهين"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>البريد الإلكتروني الرسمي لإدارة العقار والتقارير</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="mark-email-read" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="manager.bld84@ittihad-trust.org"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>رقم هاتف الطوارئ والتواصل مع السكان</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="phone-iphone" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>
      </View>

      {/* Step 2: Building & Fund Setup Card */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.rowAlign}>
            <View style={[styles.sectionIconBox, { backgroundColor: COLORS.secondaryContainer }]}>
              <MaterialIcons name="domain-add" size={18} color={COLORS.onSecondaryContainer} />
            </View>
            <Text style={styles.sectionTitle}>بيانات العقار والجمعية المشتركة</Text>
          </View>
          <Text style={styles.stepCounterText}>خطوة ٢ من ٢</Text>
        </View>

        {/* Building Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>اسم العقار / البرج السكني</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="home-work" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInputField}
              value={buildingName}
              onChangeText={setBuildingName}
              placeholder="مثال: برج الأمل السكني"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Building Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>المنطقة والحي والموقع الجغرافي</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="location-on" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInputField}
              value={buildingAddress}
              onChangeText={setBuildingAddress}
              placeholder="مثال: القاهرة الجديدة - التجمع الخامس - النرجس عمارات"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Units count & Monthly Dues Side-by-Side */}
        <View style={styles.twoColumnGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>عدد الشقق والوحدات</Text>
            <TextInput
              style={[styles.textInputField, styles.centerField]}
              value={totalApartments}
              onChangeText={setTotalApartments}
              keyboardType="numeric"
              placeholder="16"
              placeholderTextColor={COLORS.outline}
            />
            <Text style={styles.fieldSubLabel}>شقة / وحدة تجارية</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>الاشتراك الشهري / شقة</Text>
            <TextInput
              style={[styles.textInputField, styles.centerField, { color: COLORS.secondary, fontWeight: '700' }]}
              value={defaultMonthlyDues}
              onChangeText={setDefaultMonthlyDues}
              keyboardType="numeric"
              placeholder="400"
              placeholderTextColor={COLORS.outline}
            />
            <Text style={styles.fieldSubLabel}>خدمات وصيانة دورية</Text>
          </View>
        </View>

        {/* Projected Monthly Treasury Chip */}
        <View style={styles.treasuryProjectionChip}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.secondary} />
            <Text style={styles.projectionChipTitle}>الحصيلة الشهرية المتوقعة لخزينة العمارة:</Text>
          </View>
          <Text style={styles.projectionChipAmount}>{projectedMonthlyTreasury} ج.م</Text>
        </View>

        {/* Admin Apartment Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>رقم شقة رئيس الاتحاد</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="meeting-room" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={styles.textInputField}
              value={adminApartment}
              onChangeText={setAdminApartment}
              placeholder="مثال: 12"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Treasury InstaPay / Account (Optional) */}
        <View style={styles.inputGroup}>
          <View style={styles.rowBetween}>
            <Text style={styles.fieldLabel}>حساب الخزينة / محفظة إنستاباي</Text>
            <Text style={styles.optionalTagText}>اختياري الآن</Text>
          </View>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="credit-card" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={treasuryAccount}
              onChangeText={setTreasuryAccount}
              placeholder="elamal.tower@instapay"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>
      </View>

      {/* Legal Declaration */}
      <TouchableOpacity
        style={styles.legalBox}
        activeOpacity={0.9}
        onPress={() => setLegalDeclaration(!legalDeclaration)}
      >
        <View style={[styles.checkboxSquare, legalDeclaration && styles.checkboxActive]}>
          {legalDeclaration && <MaterialIcons name="check" size={16} color={COLORS.onPrimary} />}
        </View>
        <Text style={styles.legalText}>
          أقر بصفتي المفوّض أو رئيس اتحاد الشاغلين بصحة هذه البيانات ومسؤوليتي القانونية والإدارية عن حساب العقار المشترك.
        </Text>
      </TouchableOpacity>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.primaryActionButton}
        activeOpacity={0.88}
        onPress={handleAdminRegisterSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.onPrimary} />
        ) : (
          <>
            <Text style={styles.primaryActionText}>
              تأسيس اتحاد الملاك وبدء الفترة التجريبية (60 يوماً Pro)
            </Text>
            <MaterialIcons name="add-business" size={20} color={COLORS.onPrimary} />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};
