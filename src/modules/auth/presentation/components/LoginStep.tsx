import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useLoginForm } from '../../application/useLoginForm';
import type { AuthScreenMode } from '../../domain/auth.types';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface LoginStepProps {
  onClose: (() => void) | undefined;
  setMode: React.Dispatch<React.SetStateAction<AuthScreenMode>>;
  selectedRoleTab: 'resident' | 'admin';
  setSelectedRoleTab: React.Dispatch<React.SetStateAction<'resident' | 'admin'>>;
  loginForm: ReturnType<typeof useLoginForm>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
}

export const LoginStep: React.FC<LoginStepProps> = ({
  onClose,
  setMode,
  selectedRoleTab,
  setSelectedRoleTab,
  loginForm,
  setSubmitting,
  submitting,
}) => {
  const { buildings, login } = useAppStore();
  const { loginIdentifier, loginPassword, rememberMe, setLoginIdentifier, setLoginPassword, setRememberMe, setShowPassword, showPassword } = loginForm;

  // Handle Login (Screen 1: AUTH_LOGIN)
  const handleLoginSubmit = async () => {
    const rawEmail = loginIdentifier.trim();
    const rawPassword = loginPassword.trim();
    if (!rawEmail || !rawPassword) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    if (rawPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }

    setSubmitting(true);
    try {
      await login(rawEmail, rawPassword);
      onClose?.();
    } catch (err: any) {
      Alert.alert('خطأ في تسجيل الدخول', err?.message || 'تعذر تسجيل الدخول.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Brand & Mascot Header Section (Shield & Glowing Ring) */}
      <View style={styles.loginHeaderBox}>
        <View style={styles.shieldCenterBox}>
          <View style={styles.shieldPulseGlow} />
          <View style={styles.shieldIconInner}>
            <MaterialIcons name="domain-add" size={32} color={COLORS.secondaryContainer} />
          </View>
          <View style={styles.shieldVerifiedBadge}>
            <MaterialIcons name="verified" size={14} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.loginBrandTitle}>مدير اتحاد الملاك</Text>
        <View style={styles.rowAlign}>
          <View style={styles.liveGreenDot} />
          <Text style={styles.loginBrandSub}>مرحباً بك مجدداً • حسابك وعمارتك بأمان</Text>
        </View>

        {/* Building Context Capsule */}
        <View style={styles.buildingContextCapsule}>
          <MaterialIcons name="apartment" size={16} color={COLORS.secondary} />
          <Text style={styles.buildingContextText}>
            {buildings[0]?.name || 'برج الأمل السكني'} • {buildings[0]?.address || 'التجمع الخامس'}
          </Text>
          <View style={styles.capsuleDivider} />
          <Text style={styles.capsuleGateTag}>بوابة رقم ١</Text>
        </View>
      </View>

      {/* Role Selector Switch (Segmented Control) */}
      <View style={styles.segmentedControlCard}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedRoleTab === 'resident' && styles.segmentBtnActive,
          ]}
          onPress={() => setSelectedRoleTab('resident')}
        >
          <MaterialIcons
            name="person"
            size={18}
            color={selectedRoleTab === 'resident' ? COLORS.secondary : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedRoleTab === 'resident' && styles.segmentBtnTextActive,
            ]}
          >
            ساكن / مالك وحدة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedRoleTab === 'admin' && styles.segmentBtnActive,
          ]}
          onPress={() => setSelectedRoleTab('admin')}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={18}
            color={selectedRoleTab === 'admin' ? COLORS.primaryContainer : COLORS.onSurfaceVariant}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedRoleTab === 'admin' && styles.segmentBtnTextActive,
            ]}
          >
            إدارة الاتحاد / المجلس
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Login Form Card Container */}
      <View style={styles.formSectionCard}>
        {/* Email Input */}
        <View style={styles.inputGroup}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="alternate-email" size={16} color={COLORS.secondary} />
              <Text style={styles.fieldLabel}>البريد الإلكتروني المعتمد *</Text>
            </View>
            <Text style={styles.quickHelperText}>حساب مسجل مسبقاً</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={loginIdentifier}
              onChangeText={setLoginIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="name@example.com"
              placeholderTextColor={COLORS.outline}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="lock" size={16} color={COLORS.secondary} />
              <Text style={styles.fieldLabel}>كلمة المرور المشفرة *</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'استعادة الدخول',
                  'يرجى التواصل مع رئيس اتحاد الملاك أو استخدام بريدك الإلكتروني المسجل لإعادة تعيين كلمة المرور.'
                )
              }
            >
              <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={loginPassword}
              onChangeText={setLoginPassword}
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

        {/* Remember Me Toggle */}
        <TouchableOpacity
          style={styles.rowAlign}
          activeOpacity={0.9}
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View
            style={[
              styles.checkboxSmall,
              rememberMe && styles.checkboxSmallActive,
            ]}
          >
            {rememberMe && (
              <MaterialIcons name="check" size={12} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.rememberMeText}>
            تذكر تسجيل دخولي على هذا الهاتف
          </Text>
        </TouchableOpacity>

        {/* Primary Login Button */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleLoginSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="login" size={20} color={COLORS.onPrimary} />
              <Text style={styles.primaryActionText}>
                {selectedRoleTab === 'resident'
                  ? 'تسجيل الدخول الآمن (ساكن)'
                  : 'تسجيل الدخول للوحة إدارة الاتحاد'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Resident Fast Join By Code Card (Exact match to design/_12) */}
      {selectedRoleTab === 'resident' && (
        <View style={styles.residentCodeJoinCard}>
          <View style={styles.residentCodeJoinInfo}>
            <View style={styles.residentCodeJoinIcon}>
              <MaterialIcons
                name="add-home-work"
                size={22}
                color={COLORS.secondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.residentCodeJoinTitle}>
                ساكن جديد في عمارة؟
              </Text>
              <Text style={styles.residentCodeJoinSub}>
                انضم بكود العقار أو كود الدعوة الخاص بجمعيتك
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.residentCodeJoinBtn}
            activeOpacity={0.88}
            onPress={() => setMode('resident_select')}
          >
            <Text style={styles.residentCodeJoinBtnText}>
              طلب انضمام بكود العقار 🔑
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Switch to Signup / Code Link */}
      <View style={styles.signupFooterBox}>
        <Text style={styles.signupFooterText}>
          {selectedRoleTab === 'resident'
            ? 'تريد الانضمام لعمارة جديدة كساكن؟'
            : 'ليس لديك حساب أو لم تنضم بعد؟'}
        </Text>
        <TouchableOpacity
          style={styles.signupFooterBtn}
          onPress={() => {
            if (selectedRoleTab === 'resident') {
              setMode('resident_select');
            } else {
              setMode('signup');
            }
          }}
        >
          <Text style={styles.signupFooterBtnText}>
            {selectedRoleTab === 'resident'
              ? 'انضمام ساكن جديد بكود المبنى 🏢'
              : 'إنشاء حساب جديد أو تأسيس عقار'}
          </Text>
          <MaterialIcons
            name="arrow-back"
            size={16}
            color={COLORS.secondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
