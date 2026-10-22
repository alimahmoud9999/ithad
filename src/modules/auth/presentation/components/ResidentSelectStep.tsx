import React from 'react';
import { ScrollView, View, TouchableOpacity, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { useBuildingCodeLookup } from '../../application/useBuildingCodeLookup';
import type { useLoginForm } from '../../application/useLoginForm';
import type { useResidentJoinForm } from '../../application/useResidentJoinForm';
import type { useSignupForm } from '../../application/useSignupForm';
import type { AuthScreenMode } from '../../domain/auth.types';
import { styles } from '../AuthAndOnboardingScreen.styles';

interface ResidentSelectStepProps {
  setMode: React.Dispatch<React.SetStateAction<AuthScreenMode>>;
  loginForm: ReturnType<typeof useLoginForm>;
  signupForm: ReturnType<typeof useSignupForm>;
  joinForm: ReturnType<typeof useResidentJoinForm>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
  setJustSubmittedJoin: React.Dispatch<React.SetStateAction<boolean>>;
  lookup: ReturnType<typeof useBuildingCodeLookup>;
}

export const ResidentSelectStep: React.FC<ResidentSelectStepProps> = ({
  setMode,
  loginForm,
  signupForm,
  joinForm,
  setSubmitting,
  submitting,
  setJustSubmittedJoin,
  lookup,
}) => {
  const { requestJoinBuilding } = useAppStore();
  const { setLoginIdentifier } = loginForm;
  const { email, fullName, phone, setEmail, setFullName, setPhone, signupPassword } = signupForm;
  const { acceptArrearsTransfer, apartmentNumber, buildingCode, floorNumber, residentConfirmPassword, residentPassword, residentRoleType, setAcceptArrearsTransfer, setApartmentNumber, setBuildingCode, setFloorNumber, setResidentConfirmPassword, setResidentPassword, setResidentRoleType, setShowAllApartments, setShowResidentPassword, showAllApartments, showResidentPassword } = joinForm;
  const { displayedApartmentGrid, matchedBuilding, parsedCodeInfo, selectedAptArrears, setSuggestedMaskedName, suggestedMaskedName } = lookup;

  // Handle Resident Join Submit (Screen 4: RESIDENT_SELECT)
  const handleResidentJoinSubmit = async () => {
    if (!buildingCode.trim() || !apartmentNumber.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال كود المبنى واختيار رقم الشقة.');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسمك بالكامل.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال رقم الهاتف (واتساب).');
      return;
    }
    const finalPassword = residentPassword || signupPassword;
    if (!finalPassword || finalPassword.length < 6) {
      Alert.alert('تنبيه', 'كلمة المرور يجب ألا تقل عن 6 أحرف.');
      return;
    }
    if (residentPassword && residentPassword !== residentConfirmPassword) {
      Alert.alert(
        'تنبيه',
        'كلمة المرور وتأكيد كلمة المرور غير متطابقين، يرجى كتابتها بنفس الطريقة مرتين للتأكيد.'
      );
      return;
    }
    if (selectedAptArrears > 0 && !acceptArrearsTransfer) {
      Alert.alert(
        'تنبيه ترحيل المديونية',
        'يوجد مديونية سابقة مسجلة على هذه الشقة. يرجى تأكيد الموافقة على ترحيل المديونية لمتابعة الانضمام.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await requestJoinBuilding({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password: finalPassword,
        buildingCode: buildingCode.trim().toUpperCase(),
        apartmentNumber: apartmentNumber.trim(),
        floorNumber: /^\d+$/.test(floorNumber.trim())
          ? `الدور ${floorNumber.trim()}`
          : floorNumber.trim() || 'الدور الأول',
      });
      setLoginIdentifier(email.trim());
      setJustSubmittedJoin(true);
      setMode('welcome_success');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'حدث خطأ أثناء إرسال طلب الانضمام.');
    } finally {
      setSubmitting(false);
    }
  };

  const isBuildingCodeEntered = Boolean(
    buildingCode.trim().length >= 3 || matchedBuilding
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Back Header */}
      <View style={styles.topBackBar}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => setMode('login')}
        >
          <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.barCenterTitle}>اختيار الشقة والانضمام</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Section */}
      <View style={styles.screenIntro}>
        <Text style={styles.screenHeading}>مرحباً بك في اتحاد الملاك</Text>
        <Text style={styles.screenDesc}>
          منصة إدارة العقارات، الصيانة الدورية، والتحصيل المالي السريع بكل شفافية وسهولة
        </Text>
      </View>

      {/* Step 1: Building Verification Card */}
      <View style={styles.formSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.rowAlign}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>١</Text>
            </View>
            <Text style={styles.sectionTitle}>بيانات المبنى أو البرج</Text>
          </View>
          <Text style={styles.stepCounterText}>خطوة ١ من ٢</Text>
        </View>

        {/* Building Code Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>كود المبنى / العمارة الموحد</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInputField, styles.codeFieldStyle]}
              value={buildingCode}
              onChangeText={(val) => setBuildingCode(val.toUpperCase())}
              autoCapitalize="characters"
              placeholder="مثال: BLD-2024-EG"
              placeholderTextColor={COLORS.outline}
            />
            {matchedBuilding && (
              <MaterialIcons name="check-circle" size={22} color={COLORS.statusPaid} style={styles.inputCheckIcon} />
            )}
          </View>
        </View>

        {/* Live Verified Building Banner */}
        {matchedBuilding ? (
          <View style={styles.verifiedBuildingCard}>
            <View style={styles.buildingIconSquare}>
              <MaterialIcons name="location-city" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowAlign}>
                <View style={styles.liveGreenPulse} />
                <Text style={styles.verifiedBldName}>{matchedBuilding.name}</Text>
              </View>
              <Text style={styles.verifiedBldAddress}>{matchedBuilding.address}</Text>
              <View style={[styles.rowAlign, { marginTop: 6, gap: 12 }]}>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="meeting-room" size={14} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.verifiedBldMeta}>{matchedBuilding.total_apartments} شقة</Text>
                </View>
                <View style={styles.rowAlign}>
                  <MaterialIcons name="person" size={14} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.verifiedBldMeta}>رئيس الاتحاد: م. أحمد</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.codeHintBox}>
            <MaterialIcons name="info" size={18} color={COLORS.secondary} />
            <Text style={styles.codeHintText}>
              احصل على كود المبنى من رئيس الاتحاد أو ملصق مدخل العقار لإظهار شقق العمارة.
            </Text>
          </View>
        )}
      </View>

      {!isBuildingCodeEntered ? (
        <View style={styles.waitingForCodeCard}>
          <View style={styles.waitingIconCircle}>
            <MaterialIcons name="apartment" size={30} color={COLORS.secondary} />
          </View>
          <Text style={styles.waitingForCodeTitle}>أدخل كود المبنى أولاً لإظهار الشقق</Text>
          <Text style={styles.waitingForCodeSub}>
            بمجرد كتابة كود العمارة أو كود دعوتك في الخانة أعلاه، سيتم تحميل شقق العمارة وإظهار نموذج اختيار وحدتك واستكمال التسجيل تلقائياً.
          </Text>
        </View>
      ) : (
        <>
          {/* Step 2: Apartment Selection Grid (Shown when Building is verified or entered) */}
          <View style={styles.formSectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.rowAlign}>
            <View style={styles.sectionNumberCircle}>
              <Text style={styles.sectionNumberText}>٢</Text>
            </View>
            <Text style={styles.sectionTitle}>
              {parsedCodeInfo.apartmentNum && !showAllApartments
                ? `وحدتك السكنية المخصصة (شقة ${apartmentNumber || parsedCodeInfo.apartmentNum})`
                : 'اختر شقتك أو وحدتك السكنية'}
            </Text>
          </View>
          {apartmentNumber ? (
            <View style={styles.selectedCountPill}>
              <Text style={styles.selectedCountText}>تم تحديد شقة {apartmentNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* Single Apartment Direct Invite Code Banner */}
        {parsedCodeInfo.apartmentNum ? (
          <View style={styles.singleAptNoticeRow}>
            <View style={styles.rowAlign}>
              <MaterialIcons name="vpn-key" size={16} color={COLORS.secondary} />
              <Text style={styles.singleAptNoticeText}>
                كود دعوة مخصص لشقة {parsedCodeInfo.apartmentNum}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.showAllAptsBtn}
              onPress={() => setShowAllApartments(!showAllApartments)}
            >
              <Text style={styles.showAllAptsBtnText}>
                {showAllApartments ? 'التركيز على شقتي فقط' : 'عرض باقي شقق العمارة'}
              </Text>
              <MaterialIcons
                name={showAllApartments ? 'expand-less' : 'expand-more'}
                size={16}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Apartments Grid */}
        <View style={styles.apartmentsGridContainer}>
          {displayedApartmentGrid.map((apt: any) => {
            const isSelected = apartmentNumber === apt.apartment_number;
            const isOccupied =
              ('is_occupied' in apt
                ? apt.is_occupied
                : Boolean(apt.resident_id || (apt.resident_name && apt.resident_name !== 'وحدة شاغرة'))) &&
              !isSelected;

            return (
              <TouchableOpacity
                key={apt.id || apt.apartment_number}
                style={[
                  styles.apartmentGridItem,
                  isSelected && styles.apartmentGridItemSelected,
                  isOccupied && styles.apartmentGridItemOccupied,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setApartmentNumber(apt.apartment_number);
                  if (apt.floor_number) setFloorNumber(apt.floor_number);
                  const occName = apt.occupant_name || apt.resident_name;
                  if (occName && occName !== 'وحدة شاغرة' && occName !== 'مشغول') {
                    if (!occName.includes('*')) {
                      setFullName(occName);
                    } else {
                      setSuggestedMaskedName(occName);
                    }
                  }
                }}
              >
                <Text
                  style={[
                    styles.aptGridNumText,
                    isSelected && styles.aptGridNumTextSelected,
                  ]}
                >
                  {apt.apartment_number}
                </Text>
                <Text
                  style={[
                    styles.aptGridStatusText,
                    isSelected && styles.aptGridStatusTextSelected,
                  ]}
                >
                  {isSelected ? 'شقتك المحددة' : isOccupied ? 'مشغولة' : 'متاحة'}
                </Text>
                {isSelected && (
                  <View style={styles.aptSelectedCheckPin}>
                    <MaterialIcons name="check" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Resident Details Form - All inputs stacked vertically with numeric keyboards */}
        <View style={{ marginTop: 16 }}>
          {/* 1. Apartment Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>رقم الشقة *</Text>
            <TextInput
              style={[styles.textInputField, { fontWeight: '700' }]}
              value={apartmentNumber}
              onChangeText={setApartmentNumber}
              placeholder="مثال: 3"
              placeholderTextColor={COLORS.outline}
              keyboardType="number-pad"
            />
          </View>

          {/* 2. Floor Number */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>رقم الدور / الطابق</Text>
            <TextInput
              style={styles.textInputField}
              value={floorNumber}
              onChangeText={setFloorNumber}
              placeholder="مثال: 1 أو 2 أو 3"
              placeholderTextColor={COLORS.outline}
              keyboardType="number-pad"
            />
          </View>

          {/* 3. Full Name */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>الاسم بالكامل (ثلاثي أو رباعي) *</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="person" size={20} color={COLORS.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.textInputField}
                value={fullName}
                onChangeText={(val) => {
                  setFullName(val);
                  if (suggestedMaskedName) setSuggestedMaskedName(null);
                }}
                placeholder="مثال: م. أحمد مصطفى أو زينهم"
                placeholderTextColor={COLORS.outline}
              />
            </View>
            {suggestedMaskedName ? (
              <Text style={{ fontSize: 11, color: COLORS.secondary, textAlign: 'right', marginTop: 4 }}>
                ℹ️ مسجل مبدئياً لدى الإدارة بحرفين ({suggestedMaskedName}) - يرجى كتابة اسمك الكامل الحقيقي.
              </Text>
            ) : null}
          </View>

          {/* 4. Phone Number */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>رقم الهاتف (واتساب) *</Text>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="010XXXXXXXX"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          {/* 5. Email */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>البريد الإلكتروني (لتسجيل الدخول) *</Text>
            <TextInput
              style={[styles.textInputField, styles.ltrField]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              placeholder="name@email.com"
              placeholderTextColor={COLORS.outline}
              autoCapitalize="none"
            />
          </View>

          {/* 6. Password */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>كلمة المرور للحساب *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={residentPassword}
                onChangeText={setResidentPassword}
                secureTextEntry={!showResidentPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.outline}
              />
              <TouchableOpacity
                onPress={() => setShowResidentPassword(!showResidentPassword)}
                style={styles.passwordToggleBtn}
              >
                <MaterialIcons
                  name={showResidentPassword ? 'visibility-off' : 'visibility'}
                  size={18}
                  color={COLORS.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 7. Confirm Password */}
          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.fieldLabel}>تأكيد كلمة المرور *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInputField, styles.ltrField]}
                value={residentConfirmPassword}
                onChangeText={setResidentConfirmPassword}
                secureTextEntry={!showResidentPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.outline}
              />
            </View>
          </View>

          {/* Resident Role Selection */}
          <View style={[styles.twoColumnGrid, { marginTop: 12 }]}>
            <TouchableOpacity
              style={[
                styles.roleSelectorPill,
                residentRoleType === 'مالك مقيم' && styles.roleSelectorPillActive,
              ]}
              onPress={() => setResidentRoleType('مالك مقيم')}
            >
              <MaterialIcons
                name="home"
                size={18}
                color={residentRoleType === 'مالك مقيم' ? COLORS.primary : COLORS.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.roleSelectorPillText,
                  residentRoleType === 'مالك مقيم' && styles.roleSelectorPillTextActive,
                ]}
              >
                مالك مقيم
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleSelectorPill,
                residentRoleType === 'مستأجر' && styles.roleSelectorPillActive,
              ]}
              onPress={() => setResidentRoleType('مستأجر')}
            >
              <MaterialIcons
                name="key"
                size={18}
                color={residentRoleType === 'مستأجر' ? COLORS.primary : COLORS.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.roleSelectorPillText,
                  residentRoleType === 'مستأجر' && styles.roleSelectorPillTextActive,
                ]}
              >
                مستأجر
              </Text>
            </TouchableOpacity>
          </View>

          {/* Arrears Obligation Notice & Transfer Checkbox */}
          {selectedAptArrears > 0 && (
            <View style={styles.arrearsNoticeBox}>
              <View style={styles.arrearsNoticeHeader}>
                <MaterialIcons name="warning-amber" size={18} color="#B45309" />
                <Text style={styles.arrearsNoticeTitle}>
                  تنبيه: مديونية سابقة مسجلة على الوحدة
                </Text>
              </View>
              <Text style={styles.arrearsNoticeDesc}>
                يوجد التزامات سابقة غير مسددة على شقة ({apartmentNumber}) بمبلغ{' '}
                <Text style={styles.arrearsBoldAmount}>
                  {selectedAptArrears.toLocaleString('en-US')} ج.م
                </Text>
                . وفقاً للائحة اتحاد الشاغلين، يتم ترحيل هذه الالتزامات ومتابعة سدادها ضمن حساب الشقة.
              </Text>
              <TouchableOpacity
                style={styles.arrearsCheckboxRow}
                activeOpacity={0.9}
                onPress={() => setAcceptArrearsTransfer(!acceptArrearsTransfer)}
              >
                <View
                  style={[
                    styles.checkboxSmall,
                    acceptArrearsTransfer && styles.checkboxSmallActive,
                  ]}
                >
                  {acceptArrearsTransfer && (
                    <MaterialIcons name="check" size={12} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.arrearsCheckboxText}>
                  أقر بترحيل المديونية السابقة والالتزام بتسويتها مع اتحاد الملاك
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.primaryActionButton}
        activeOpacity={0.88}
        onPress={handleResidentJoinSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.onPrimary} />
        ) : (
          <>
            <Text style={styles.primaryActionText}>إرسال طلب الانضمام وتأكيد الحساب</Text>
            <MaterialIcons name="how-to-reg" size={20} color={COLORS.onPrimary} />
          </>
        )}
      </TouchableOpacity>
    </>
    )}

      {/* Back to Login Link */}
      <View style={[styles.signupFooterBox, { marginTop: 14 }]}>
        <Text style={styles.signupFooterText}>لديك حساب مسجل بالفعل؟</Text>
        <TouchableOpacity
          style={styles.signupFooterBtn}
          onPress={() => setMode('login')}
        >
          <Text style={styles.signupFooterBtnText}>تسجيل الدخول</Text>
          <MaterialIcons name="arrow-back" size={16} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
