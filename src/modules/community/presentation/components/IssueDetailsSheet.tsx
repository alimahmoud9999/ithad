import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BuildingIssue } from '@/shared/types/database';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../CommunityHubScreen.styles';

interface IssueDetailsSheetProps {
  setSelectedIssueImage: React.Dispatch<React.SetStateAction<string | null>>;
  selectedIssueDetails: BuildingIssue | null;
  setSelectedIssueDetails: React.Dispatch<React.SetStateAction<BuildingIssue | null>>;
}

export const IssueDetailsSheet: React.FC<IssueDetailsSheetProps> = ({
  setSelectedIssueImage,
  selectedIssueDetails,
  setSelectedIssueDetails,
}) => {
  const { currentRole, updateIssueStatus } = useAppStore();

  return (
    <BottomSheetModal
      visible={Boolean(selectedIssueDetails)}
      onClose={() => setSelectedIssueDetails(null)}
      title="متابعة صيانة وبلاغات العقار"
    >
      {selectedIssueDetails && (
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {/* Header with status */}
          <View style={styles.ticketDetailHeader}>
            <View style={styles.ticketDetailIconBox}>
              <MaterialIcons name="build" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.ticketDetailTitle}>{selectedIssueDetails.title}</Text>
              <View style={styles.ticketDetailLocationRow}>
                <MaterialIcons name="location-on" size={14} color={COLORS.onSurfaceVariant} />
                <Text style={styles.ticketDetailLocationText}>
                  {selectedIssueDetails.category} • شقة {selectedIssueDetails.apartment_number || '302'}
                </Text>
              </View>
            </View>
          </View>

          {/* Reporter & Time meta */}
          <View style={styles.ticketMetaCard}>
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>الساكن المبلغ:</Text>
              <Text style={styles.ticketMetaVal}>
                {selectedIssueDetails.reporter_name || 'الساكن المالك'}
              </Text>
            </View>
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>درجة الأهمية:</Text>
              <Text
                style={[
                  styles.ticketMetaVal,
                  {
                    color:
                      selectedIssueDetails.severity === 'high'
                        ? COLORS.statusUnpaid
                        : selectedIssueDetails.severity === 'medium'
                        ? COLORS.statusUpcoming
                        : COLORS.secondary,
                  },
                ]}
              >
                {selectedIssueDetails.severity === 'high'
                  ? 'عاجل وحرج ⚠️'
                  : selectedIssueDetails.severity === 'medium'
                  ? 'متوسط'
                  : 'عادي'}
              </Text>
            </View>
          </View>

          {/* Progression Timeline (design/_19/code.html) */}
          <View style={styles.timelineSection}>
            <Text style={styles.timelineSectionTitle}>مسار مراحل تنفيذ البلاغ:</Text>

            {/* Step 1 */}
            <View style={styles.timelineStep}>
              <View style={[styles.timelineNode, styles.timelineNodeDone]}>
                <MaterialIcons name="check" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStepTitle}>تم استلام البلاغ وقيده في سجل الصيانة</Text>
                <Text style={styles.timelineStepSub}>إشعار فوري لمجلس إدارة الاتحاد</Text>
              </View>
            </View>

            {/* Step 2 */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineNode,
                  selectedIssueDetails.status === 'in_progress' ||
                  selectedIssueDetails.status === 'resolved'
                    ? styles.timelineNodeDone
                    : styles.timelineNodePending,
                ]}
              >
                <MaterialIcons
                  name={
                    selectedIssueDetails.status === 'in_progress' ||
                    selectedIssueDetails.status === 'resolved'
                      ? 'check'
                      : 'schedule'
                  }
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStepTitle}>
                  جاري الفحص والمعاينة وتكليف الفني المختص
                </Text>
                <Text style={styles.timelineStepSub}>
                  {selectedIssueDetails.status === 'in_progress'
                    ? 'تم التواصل مع شركة الصيانة وتحديد موعد الزيارة'
                    : 'بانتظار تكليف الإدارة للفني'}
                </Text>
              </View>
            </View>

            {/* Step 3 */}
            <View style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineNode,
                  selectedIssueDetails.status === 'resolved'
                    ? styles.timelineNodeDone
                    : styles.timelineNodeUpcoming,
                ]}
              >
                <MaterialIcons
                  name={selectedIssueDetails.status === 'resolved' ? 'done-all' : 'task-alt'}
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStepTitle}>اكتمال الإصلاح واعتماد الحل رسمياً</Text>
                <Text style={styles.timelineStepSub}>
                  {selectedIssueDetails.status === 'resolved'
                    ? 'تم حل العطل واختبار كفاءة التشغيل بنجاح'
                    : 'يتم الإغلاق بعد الانتهاء والتحقق'}
                </Text>
              </View>
            </View>
          </View>

          {/* Attached Photo Preview */}
          {selectedIssueDetails.image_url && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.timelineSectionTitle}>صورة العطل المرفقة:</Text>
              <TouchableOpacity
                onPress={() => setSelectedIssueImage(selectedIssueDetails.image_url!)}
                style={styles.detailImageContainer}
              >
                <Image
                  source={{ uri: selectedIssueDetails.image_url }}
                  style={styles.detailFullImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Admin Action Buttons */}
          {currentRole === 'admin' && (
            <View style={styles.modalAdminActionsRow}>
              {selectedIssueDetails.status !== 'in_progress' &&
                selectedIssueDetails.status !== 'resolved' && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: COLORS.statusUpcoming }]}
                    onPress={async () => {
                      const id = selectedIssueDetails.id;
                      setSelectedIssueDetails(null);
                      await updateIssueStatus(id, 'in_progress');
                    }}
                  >
                    <Text style={styles.modalActionBtnText}>⏳ بدء التنفيذ والفحص</Text>
                  </TouchableOpacity>
                )}

              {selectedIssueDetails.status !== 'resolved' && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: COLORS.secondary }]}
                  onPress={async () => {
                    const id = selectedIssueDetails.id;
                    setSelectedIssueDetails(null);
                    await updateIssueStatus(id, 'resolved');
                  }}
                >
                  <Text style={styles.modalActionBtnText}>✅ اعتماد الحل وإغلاق البلاغ</Text>
                </TouchableOpacity>
              )}

              {selectedIssueDetails.status === 'resolved' && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: COLORS.primary }]}
                  onPress={async () => {
                    const id = selectedIssueDetails.id;
                    setSelectedIssueDetails(null);
                    await updateIssueStatus(id, 'open');
                  }}
                >
                  <Text style={styles.modalActionBtnText}>🔄 إعادة فتح البلاغ</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
};
