import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { IssueSeverity } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { pickAndCompressUploadImage } from '@/shared/utils/imageUpload';
import { useAppStore } from '@/store/AppContext';
import { ISSUE_CATEGORIES, SEVERITY_LEVELS, TIME_WINDOWS } from '../../domain/community.constants';
import { styles } from '../CommunityHubScreen.styles';

interface AddIssueSheetProps {
  isAddIssueModalOpen: boolean;
  setIsAddIssueModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AddIssueSheet: React.FC<AddIssueSheetProps> = ({
  isAddIssueModalOpen,
  setIsAddIssueModalOpen,
}) => {
  const { createBuildingIssue, currentBuilding, currentUser } = useAppStore();

  // New Issue Form State
  const [issueTitle, setIssueTitle] = useState('');

  const [issueDescription, setIssueDescription] = useState('');

  const [issueCategory, setIssueCategory] = useState('المصعد');

  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('medium');

  const [issueTimeWindow, setIssueTimeWindow] = useState('any');

  const [issueIsPrivate, setIssueIsPrivate] = useState(false);

  const [issueWhatsapp, setIssueWhatsapp] = useState(true);

  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Handlers for Issue Creation
  const handlePickIssueImage = async (useCamera = false) => {
    try {
      setIsUploadingImage(true);
      const res = await pickAndCompressUploadImage({
        bucket: 'issue-attachments',
        buildingId: currentBuilding.id || 'bld_general',
        source: useCamera ? 'camera' : 'library',
      });
      if (res?.publicUrl) {
        setIssueImageUrl(res.publicUrl);
      }
    } catch (err: any) {
      Alert.alert('تعذر اختيار الصورة', err?.message || 'حدث خطأ أثناء معالجة الصورة.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveIssue = async () => {
    if (!issueTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان مختصر للبلاغ أو العطل.');
      return;
    }

    try {
      setIsSubmittingIssue(true);
      await createBuildingIssue({
        title: issueTitle.trim(),
        description: issueDescription.trim() || undefined,
        category: issueCategory,
        severity: issueSeverity,
        imageUrl: issueImageUrl,
        isPrivate: issueIsPrivate,
        preferredTime: issueTimeWindow,
        whatsappNotifications: issueWhatsapp,
      });

      Alert.alert('تم إرسال البلاغ بنجاح 🎉', 'تم قيد البلاغ في سجل العمارة وإشعار الإدارة فورياً.');
      setIsAddIssueModalOpen(false);
      setIssueTitle('');
      setIssueDescription('');
      setIssueImageUrl(null);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إرسال البلاغ حالياً.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  return (
    <BottomSheetModal
      visible={isAddIssueModalOpen}
      onClose={() => setIsAddIssueModalOpen(false)}
      title="تقديم بلاغ عطل أو صيانة 🛠️"
    >
      <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
        {/* Reporter info pill */}
        <View style={styles.modalReporterPill}>
          <View style={styles.modalReporterApt}>
            <Text style={styles.modalReporterAptText}>
              {currentUser.apartment_number || '302'}
            </Text>
            <Text style={styles.modalReporterAptLabel}>شقة</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.modalReporterName}>
              {currentUser.full_name || 'الساكن المالك'}
            </Text>
            <Text style={styles.modalReporterSub}>
              {currentBuilding.name || 'العقار'}
            </Text>
          </View>
        </View>

        {/* Location Scope / Category Chips Grid */}
        <Text style={styles.fieldLabel}>نطاق ومكان العطل *</Text>
        <View style={styles.categoryChipsGrid}>
          {ISSUE_CATEGORIES.map((cat) => {
            const isSelected = issueCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  isSelected && styles.catChipSelected,
                ]}
                onPress={() => setIssueCategory(cat.id)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={cat.icon as any}
                  size={20}
                  color={isSelected ? '#FFFFFF' : COLORS.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.catChipText,
                    isSelected && styles.catChipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Issue Title Input */}
        <Text style={styles.fieldLabel}>عنوان البلاغ المختصر *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="مثال: توقف مفاجئ في حركة المصعد بالدور الثاني"
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={issueTitle}
          onChangeText={setIssueTitle}
          textAlign="right"
        />

        {/* Severity Radio Selection */}
        <Text style={styles.fieldLabel}>مستوى الأهمية وتأثير العطل</Text>
        <View style={styles.severityGroup}>
          {SEVERITY_LEVELS.map((sev) => {
            const isSelected = issueSeverity === sev.id;
            return (
              <TouchableOpacity
                key={sev.id}
                style={[
                  styles.sevCard,
                  isSelected && { borderColor: sev.color, backgroundColor: sev.bg },
                ]}
                onPress={() => setIssueSeverity(sev.id)}
                activeOpacity={0.85}
              >
                <View style={styles.sevCardHeader}>
                  <View style={[styles.sevBadge, { backgroundColor: sev.color }]}>
                    <Text style={styles.sevBadgeText}>{sev.badge}</Text>
                  </View>
                  <Text
                    style={[
                      styles.sevCardTitle,
                      isSelected && { color: sev.color },
                    ]}
                  >
                    {sev.title}
                  </Text>
                </View>
                <Text style={styles.sevCardDesc}>{sev.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Detailed Description */}
        <Text style={styles.fieldLabel}>تفاصيل العطل والملاحظات</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="وضح أي أصوات غير معتادة، أدوار العطل، أو ملاحظات هامة للفني..."
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={issueDescription}
          onChangeText={setIssueDescription}
          multiline
          numberOfLines={4}
          textAlign="right"
        />

        {/* Photo Documentation (_1/code.html lines 186-236) */}
        <Text style={styles.fieldLabel}>توثيق العطل بالصور (اختياري)</Text>
        <View style={styles.photoActionsRow}>
          <TouchableOpacity
            style={styles.photoActionBtn}
            onPress={() => handlePickIssueImage(true)}
            disabled={isUploadingImage}
          >
            <MaterialIcons name="photo-camera" size={20} color={COLORS.secondary} />
            <Text style={styles.photoActionBtnText}>تصوير بالكاميرا</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoActionBtn}
            onPress={() => handlePickIssueImage(false)}
            disabled={isUploadingImage}
          >
            <MaterialIcons name="add-photo-alternate" size={20} color={COLORS.primary} />
            <Text style={styles.photoActionBtnText}>اختيار من المعرض</Text>
          </TouchableOpacity>
        </View>

        {isUploadingImage && (
          <View style={styles.uploadingBox}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.uploadingText}>جاري ضغط الصورة ومعالجتها (JPEG 60%)...</Text>
          </View>
        )}

        {Boolean(issueImageUrl) && (
          <View style={styles.imagePreviewBox}>
            <Image source={{ uri: issueImageUrl! }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setIssueImageUrl(null)}
            >
              <MaterialIcons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Preferred Time Window Chips */}
        <Text style={styles.fieldLabel}>الوقت المناسب للمعاينة الفنية</Text>
        <View style={styles.timeChipsGrid}>
          {TIME_WINDOWS.map((tw) => {
            const isSelected = issueTimeWindow === tw.id;
            return (
              <TouchableOpacity
                key={tw.id}
                style={[
                  styles.timeChip,
                  isSelected && styles.timeChipSelected,
                ]}
                onPress={() => setIssueTimeWindow(tw.id)}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    isSelected && styles.timeChipTextSelected,
                  ]}
                >
                  {tw.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Privacy Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.privacyOption,
              !issueIsPrivate && styles.privacyOptionActive,
            ]}
            onPress={() => setIssueIsPrivate(false)}
          >
            <Text
              style={[
                styles.privacyOptionText,
                !issueIsPrivate && styles.privacyOptionTextActive,
              ]}
            >
              🌐 عام (يراه السكان ويدعمونه 👍)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.privacyOption,
              issueIsPrivate && styles.privacyOptionActive,
            ]}
            onPress={() => setIssueIsPrivate(true)}
          >
            <Text
              style={[
                styles.privacyOptionText,
                issueIsPrivate && styles.privacyOptionTextActive,
              ]}
            >
              🔒 خاص (لرئيس الاتحاد فقط)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.modalSubmitBtn}
          onPress={handleSaveIssue}
          disabled={isSubmittingIssue}
          activeOpacity={0.88}
        >
          {isSubmittingIssue ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.modalSubmitBtnText}>
                إرسال البلاغ لرئيس الاتحاد وفريق الصيانة
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};
