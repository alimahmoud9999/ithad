import React, { useState } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import type { ActiveSubView } from '../../domain/resident.types';
import { styles } from '../ResidentHomeScreen.styles';

interface AddTicketModalProps {
  activeSubView: ActiveSubView;
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
}

export const AddTicketModal: React.FC<AddTicketModalProps> = ({
  activeSubView,
  setActiveSubView,
}) => {
  // Maintenance Ticket State (Screen 11: ADD_TICKET_FORM - _1)
  const [ticketScope, setTicketScope] = useState<string>('المصعد');
  const [ticketSeverity, setTicketSeverity] = useState<'عادي' | 'متوسط (48 ساعة)' | 'طارئ وحرج'>('متوسط (48 ساعة)');
  const [ticketTitle, setTicketTitle] = useState<string>('');
  const [ticketDescription, setTicketDescription] = useState<string>('');
  const [ticketPreferredTime, setTicketPreferredTime] = useState<'أي وقت' | 'صباحية' | 'مسائية'>('أي وقت');
  const [submittingTicket, setSubmittingTicket] = useState<boolean>(false);

  // Submit maintenance ticket
  const handleSubmitTicket = () => {
    if (!ticketTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المشكلة أو العطل.');
      return;
    }
    setSubmittingTicket(true);
    setTimeout(() => {
      setSubmittingTicket(false);
      setActiveSubView('none');
      setTicketTitle('');
      setTicketDescription('');
      Alert.alert(
        'تم إرسال البلاغ بنجاح 🛠️',
        `تم تسجيل البلاغ الخاص بـ (${ticketScope}) وإشعار رئيس الاتحاد وفني الصيانة للمتابعة فوراً.`
      );
    }, 600);
  };

  return (
    <Modal
      visible={activeSubView === 'add_ticket'}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setActiveSubView('none')}
    >
      <ScrollView style={styles.modalFullContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBackBar}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => setActiveSubView('none')}
          >
            <MaterialIcons name="arrow-forward" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.barCenterTitle}>تقديم بلاغ عطل وصيانة</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Header Banner */}
        <View style={styles.ticketHeroCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <View style={styles.ticketUrgentTag}>
                <View style={styles.liveGreenDot} />
                <Text style={styles.ticketUrgentTagText}>مسار المتابعة الفورية مُفعّل</Text>
              </View>
              <Text style={styles.ticketHeroTitle}>تقديم بلاغ عطل أو صيانة</Text>
              <Text style={styles.ticketHeroSub}>
                يتم إشعار إدارة اتحاد الملاك وفني الصيانة المختص فور الإرسال لسرعة الاستجابة.
              </Text>
            </View>
            <View style={styles.ticketHeroIconCircle}>
              <MaterialIcons name="handyman" size={26} color={COLORS.secondaryFixed} />
            </View>
          </View>
          <View style={styles.ticketResponseBar}>
            <MaterialIcons name="bolt" size={16} color={COLORS.secondaryFixed} />
            <Text style={styles.ticketResponseText}>متوسط زمن الاستجابة للبلاغات: 45 دقيقة</Text>
          </View>
        </View>

        {/* Location Scope Chips */}
        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>نطاق ومكان العطل</Text>
          <View style={styles.scopeGridContainer}>
            {['المصعد', 'مدخل العقار', 'إنارة السلم', 'طلمبة المياه', 'الجراج السفلي', 'السطح والرووف'].map((scope) => (
              <TouchableOpacity
                key={scope}
                style={[
                  styles.scopeChipItem,
                  ticketScope === scope && styles.scopeChipItemActive,
                ]}
                onPress={() => setTicketScope(scope)}
              >
                <MaterialIcons
                  name={
                    scope === 'المصعد'
                      ? 'elevator'
                      : scope === 'مدخل العقار'
                      ? 'door-front'
                      : scope === 'إنارة السلم'
                      ? 'light'
                      : scope === 'طلمبة المياه'
                      ? 'water-damage'
                      : scope === 'الجراج السفلي'
                      ? 'garage'
                      : 'roofing'
                  }
                  size={22}
                  color={ticketScope === scope ? COLORS.onPrimary : COLORS.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.scopeChipText,
                    ticketScope === scope && styles.scopeChipTextActive,
                  ]}
                >
                  {scope}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity & Details */}
        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>درجة الخطورة والاستعجال</Text>
          <View style={styles.threeColumnGrid}>
            {(['عادي', 'متوسط (48 ساعة)', 'طارئ وحرج'] as const).map((sev) => (
              <TouchableOpacity
                key={sev}
                style={[
                  styles.severityBtn,
                  ticketSeverity === sev && styles.severityBtnActive,
                  ticketSeverity === sev && sev === 'طارئ وحرج' && { backgroundColor: COLORS.statusUnpaid },
                ]}
                onPress={() => setTicketSeverity(sev)}
              >
                <Text
                  style={[
                    styles.severityBtnText,
                    ticketSeverity === sev && styles.severityBtnTextActive,
                  ]}
                >
                  {sev}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>عنوان العطل باختصار *</Text>
            <TextInput
              style={styles.textInputField}
              value={ticketTitle}
              onChangeText={setTicketTitle}
              placeholder="مثال: توقف كابينة المصعد بين الدورين الثاني والثالث"
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>وصف تفصيلي للمشكلة</Text>
            <TextInput
              style={[styles.textInputField, { height: 76, textAlignVertical: 'top', paddingTop: 8 }]}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              multiline
              placeholder="صف تفاصيل العطل وأي أصوات أو مؤشرات غير معتادة..."
              placeholderTextColor={COLORS.outline}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>الوقت المفضل للمعاينة الفنية</Text>
            <View style={styles.threeColumnGrid}>
              {(['أي وقت', 'صباحية', 'مسائية'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.timeChip,
                    ticketPreferredTime === t && styles.timeChipActive,
                  ]}
                  onPress={() => setTicketPreferredTime(t)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      ticketPreferredTime === t && styles.timeChipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Submit Ticket */}
        <TouchableOpacity
          style={styles.primaryActionButton}
          activeOpacity={0.88}
          onPress={handleSubmitTicket}
          disabled={submittingTicket}
        >
          {submittingTicket ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color={COLORS.onPrimary} />
              <Text style={styles.primaryActionText}>إرسال البلاغ لرئيس الاتحاد وفريق الصيانة</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
};
