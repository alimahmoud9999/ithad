import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import type { useLoginForm } from '../../application/useLoginForm';
import type { useSignupForm } from '../../application/useSignupForm';
import type { AuthScreenMode } from '../../domain/auth.types';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface SignupStepProps {
  setMode: React.Dispatch<React.SetStateAction<AuthScreenMode>>;
  selectedRoleTab: 'resident' | 'admin';
  setSelectedRoleTab: React.Dispatch<React.SetStateAction<'resident' | 'admin'>>;
  loginForm: ReturnType<typeof useLoginForm>;
  signupForm: ReturnType<typeof useSignupForm>;
}

export const SignupStep: React.FC<SignupStepProps> = ({
  setMode,
  selectedRoleTab,
  setSelectedRoleTab,
  loginForm,
  signupForm,
}) => {
  const { setShowPassword, showPassword } = loginForm;
  const { email, fullName, phone, setEmail, setFullName, setPhone, setSignupPassword, signupPassword } = signupForm;

  // Handle Signup Submit (Screen 2: AUTH_SIGNUP)
  const handleSignupNext = () => {
    if (!fullName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال الاسم بالكامل.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('تنبيه', 'يرجى إدخال بريد إلكتروني صالح.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الهاتف.');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    if (selectedRoleTab === 'resident') {
      setMode('resident_select');
      return;
    }
    setMode('admin_register');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top App Branding & Trust Indicator */}
      <View style={styles.topBrandRow}>
        <View style={styles.brandGroup}>
          <View style={styles.logoIconBox}>
            <MaterialIcons name="apartment" size={22} color={COLORS.onPrimary} />
          </View>
          <View>
            <Text style={styles.brandTitle}>إتّحاد</Text>
            <Text style={styles.brandSub}>منصة إدارة اتحادات الملاك</Text>
          </View>
        </View>

        <View style={styles.verifiedPill}>
          <MaterialIcons name="verified-user" size={15} color={COLORS.secondary} />
          <Text style={styles.verifiedPillText}>نظام موثّق</Text>
        </View>
      </View>

      {/* Hero Header & Quick Sign-in Switch */}
      <View style={styles.heroRowBetween}>
        <View>
          <Text style={styles.screenHeading}>إنشاء حساب جديد</Text>
          <Text style={styles.screenDesc}>اختر صفتك وسجّل بياناتك لبدء إدارة وتنسيق العقار بكل شفافية</Text>
        </View>
        <TouchableOpacity
          style={styles.switchModeLink}
          onPress={() => setMode('login')}
        >
          <Text style={styles.switchModeLinkText}>تسجيل الدخول</Text>
          <MaterialIcons name="arrow-back" size={16} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>

      {/* Role Selector Cards */}
      <Text style={styles.sectionInstruction}>حدد صفتك في العقار:</Text>
      <View style={styles.twoColumnGrid}>
        {/* Card 1: Resident / Unit Owner */}
        <TouchableOpacity
          style={[
            styles.roleCardBig,
            selectedRoleTab === 'resident' && styles.roleCardBigSelected,
          ]}
          activeOpacity={0.88}
          onPress={() => setSelectedRoleTab('resident')}
        >
          <View style={styles.rowBetween}>
            <View style={[styles.roleIconBadge, selectedRoleTab === 'resident' && styles.roleIconBadgeActive]}>
              <MaterialIcons name="vpn-key" size={20} color={COLORS.primaryContainer} />
            </View>
            <View style={[styles.radioCheckCircle, selectedRoleTab === 'resident' && styles.radioCheckCircleActive]}>
              {selectedRoleTab === 'resident' && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
            </View>
          </View>
          <Text style={styles.roleCardBigTitle}>مالك / ساكن وحدة</Text>
          <Text style={styles.roleCardBigDesc}>
            متابعة المصروفات، سداد الصيانة، وسندات الدفع الفورية.
          </Text>
        </TouchableOpacity>

        {/* Card 2: Property Manager / President */}
        <TouchableOpacity
          style={[
            styles.roleCardBig,
            selectedRoleTab === 'admin' && styles.roleCardBigSelected,
          ]}
          activeOpacity={0.88}
          onPress={() => setSelectedRoleTab('admin')}
        >
          <View style={styles.rowBetween}>
            <View style={[styles.roleIconBadge, selectedRoleTab === 'admin' && styles.roleIconBadgeActive]}>
              <MaterialIcons name="admin-panel-settings" size={20} color={COLORS.primaryContainer} />
            </View>
            <View style={[styles.radioCheckCircle, selectedRoleTab === 'admin' && styles.radioCheckCircleActive]}>
              {selectedRoleTab === 'admin' && <MaterialIcons name="check" size={12} color="#FFFFFF" />}
            </View>
          </View>
          <Text style={styles.roleCardBigTitle}>مدير / رئيس الاتحاد</Text>
          <Text style={styles.roleCardBigDesc}>
            إدارة الخزينة والعهدة، اعتماد التحصيلات، ودعوة الملاك.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Resident Direct Code Join Banner (Jump directly to code & unit entry) */}
      {selectedRoleTab === 'resident' && (
        <TouchableOpacity
          style={styles.residentDirectCodeBanner}
          activeOpacity={0.88}
          onPress={() => setMode('resident_select')}
        >
          <View style={styles.residentDirectCodeIcon}>
            <MaterialIcons name="vpn-key" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.residentDirectCodeTitle}>
              الانضمام السريع بكود الشقة أو كود الدعوة 🔑
            </Text>
            <Text style={styles.residentDirectCodeSub}>
              لديك كود دعوة من رئيس الاتحاد؟ اضغط هنا للانضمام المباشر وتخطي هذه الخطوة
            </Text>
          </View>
          <MaterialIcons name="arrow-back" size={18} color={COLORS.secondary} />
        </TouchableOpacity>
      )}

      {/* Registration Form Card */}
      <View style={[styles.formSectionCard, { marginTop: 14 }]}>
        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>الاسم بالكامل (ثلاثي أو رباعي) *</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="person" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
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
          <View style={styles.rowBetween}>
            <Text style={styles.fieldLabel}>البريد الإلكتروني للعمل أو المراسلات *</Text>
            <Text style={styles.officialLoginPill}>وسيلة الدخول الرسمية</Text>
          </View>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="alternate-email" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="name@company.com"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Phone */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>رقم هاتف الواتساب للتنبيهات *</Text>
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

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>كلمة المرور المشفرة</Text>
          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={signupPassword}
              onChangeText={setSignupPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.outline}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggleBtn}
            >
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={20}
                color={COLORS.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Submit Step CTA */}
      <TouchableOpacity
        style={styles.primaryActionButton}
        activeOpacity={0.88}
        onPress={handleSignupNext}
      >
        <Text style={styles.primaryActionText}>
          {selectedRoleTab === 'resident' ? 'متابعة لاختيار الشقة وكود المبنى' : 'متابعة لتأسيس عقار ومجلس الإدارة'}
        </Text>
        <MaterialIcons name="arrow-back" size={20} color={COLORS.onPrimary} />
      </TouchableOpacity>
    </ScrollView>
  );
};
