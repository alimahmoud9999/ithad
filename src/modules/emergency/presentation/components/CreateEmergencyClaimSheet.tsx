import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BottomSheetModal } from '@/shared/ui/BottomSheetModal';
import { useAppStore } from '@/store/AppContext';
import { useAdminDashboardMetrics } from '../../../admin/application/useAdminDashboardMetrics';
import { styles } from '../emergency.styles';
import { EMERGENCY_CATEGORIES } from '../../domain/emergency.constants';
import type { ClaimDistChoice } from '../../domain/emergency.types';

interface CreateEmergencyClaimSheetProps {
  emergencyModalVisible: boolean;
  setEmergencyModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CreateEmergencyClaimSheet: React.FC<CreateEmergencyClaimSheetProps> = ({
  emergencyModalVisible,
  setEmergencyModalVisible,
}) => {
  const { createEmergencyClaim, currentBuilding } = useAppStore();
  const { occupiedApartments } = useAdminDashboardMetrics();

  // Create Emergency Claim Form (Matches _10/code.html)
  const [claimTitle, setClaimTitle] = useState('');
  const [claimCategory, setClaimCategory] = useState('مياه وسباكة');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDistribution, setClaimDistribution] =
    useState<ClaimDistChoice>('occupied_only');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const calculatedEqualShare = useMemo(() => {
    const amt = parseFloat(claimAmount) || 0;
    if (claimDistribution === 'occupied_only') {
      const count = Math.max(occupiedApartments.length, 1);
      return (amt / count).toFixed(2);
    }
    const units = Math.max(currentBuilding.total_apartments, 1);
    return (amt / units).toFixed(2);
  }, [
    claimAmount,
    claimDistribution,
    currentBuilding.total_apartments,
    occupiedApartments.length,
  ]);

  const handleCreateEmergencyClaim = async () => {
    const numeric = parseFloat(claimAmount);
    if (!claimTitle.trim() || !numeric || numeric <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المطالبة الطارئة والمبلغ الإجمالي.');
      return;
    }
    setClaimSubmitting(true);
    try {
      await createEmergencyClaim({
        title: claimTitle,
        description:
          claimNotes || 'مطالبة صيانة طارئة معتمدة من مجلس اتحاد الملاك',
        category: claimCategory,
        targetAmount: numeric,
        distributionType: claimDistribution === 'custom' ? 'custom' : 'equal',
        defaultShareAmount: parseFloat(calculatedEqualShare),
        distributionMode: claimDistribution,
      });
      setEmergencyModalVisible(false);
      Alert.alert(
        'تم إطلاق المطالبة الطارئة 🚨',
        'ظهرت المطالبة الآن مع شريط التقدم الحي لدى جميع سكان العمارة وتم إرسال إشعار فوري لجميع الملاك.'
      );
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر إنشاء المطالبة الطارئة');
    } finally {
      setClaimSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={emergencyModalVisible}
      title="صندوق صيانة طارئ واستثنائي"
      subtitle="تُنشأ لجمع مبالغ الصيانات الطارئة مع شريط تقدم حي وتوزيع بالتساوي أو مخصص"
      onClose={() => setEmergencyModalVisible(false)}
    >
      <View style={styles.modalForm}>
        <Text style={styles.fieldLabel}>تصنيف الصيانة الطارئة</Text>
        <View style={styles.chipsWrap}>
          {EMERGENCY_CATEGORIES.map((c) => {
            const active = claimCategory === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setClaimCategory(c.id)}
                style={[styles.catChip, active && styles.catChipActive]}
              >
                <MaterialIcons
                  name={c.icon}
                  size={15}
                  color={active ? COLORS.onPrimary : COLORS.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.catChipText,
                    active && styles.catChipTextActive,
                  ]}
                >
                  {c.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>عنوان البند الطارئ</Text>
          <TextInput
            style={styles.input}
            value={claimTitle}
            onChangeText={setClaimTitle}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>إجمالي المبلغ المطلوب (ج.م)</Text>
          <TextInput
            style={[styles.input, { textAlign: 'left', fontWeight: '700' }]}
            value={claimAmount}
            onChangeText={setClaimAmount}
            keyboardType="numeric"
          />
        </View>

        {/* Distribution Strategy (_10/code.html) */}
        <Text style={styles.fieldLabel}>طريقة توزيع التكلفة</Text>
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.distOptionCard,
              claimDistribution === 'occupied_only' &&
                styles.distOptionCardActive,
            ]}
            onPress={() => setClaimDistribution('occupied_only')}
          >
            <View style={styles.distOptionHeader}>
              <Text style={styles.distOptionTitle}>
                على الشقق المسكونة/المسجلة حالياً فقط ({occupiedApartments.length}{' '}
                شقة) ⭐
              </Text>
              <MaterialIcons
                name={
                  claimDistribution === 'occupied_only'
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={COLORS.primaryContainer}
              />
            </View>
            <Text style={styles.distOptionDesc}>
              تقسيم التكلفة على السكان المتواجدين فقط بالتساوي لحل مشكلة قلة
              السكان عند بداية إشغال البرج.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.distOptionCard,
              claimDistribution === 'equal' && styles.distOptionCardActive,
            ]}
            onPress={() => setClaimDistribution('equal')}
          >
            <View style={styles.distOptionHeader}>
              <Text style={styles.distOptionTitle}>
                بالتساوي على كامل شقق البرج ({currentBuilding.total_apartments}{' '}
                شقة)
              </Text>
              <MaterialIcons
                name={
                  claimDistribution === 'equal'
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={COLORS.primaryContainer}
              />
            </View>
            <Text style={styles.distOptionDesc}>
              يتحمل كل مالك حصة موحدة، وتسجل حصة الشقق الشاغرة كمتأخرات مستحقة
              على ملاكها.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.distOptionCard,
              claimDistribution === 'custom' && styles.distOptionCardActive,
            ]}
            onPress={() => setClaimDistribution('custom')}
          >
            <View style={styles.distOptionHeader}>
              <Text style={styles.distOptionTitle}>
                توزيع بمبالغ مخصصة / استثناء وحدات محددة
              </Text>
              <MaterialIcons
                name={
                  claimDistribution === 'custom'
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                }
                size={20}
                color={COLORS.primaryContainer}
              />
            </View>
            <Text style={styles.distOptionDesc}>
              مثل تخصيص أنصبة حسب المساحة أو استثناء الدور الأرضي من مصاريف
              المصعد.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Smart Calculation Hero Preview (_10/code.html lines 154-189) */}
        <View style={styles.smartCalcHero}>
          <View style={styles.smartCalcTop}>
            <Text style={styles.smartCalcTitle}>
              {claimDistribution === 'occupied_only'
                ? `المعاينة الذكية (الشقق المسكونة: ${occupiedApartments.length} شقة)`
                : `المعاينة الذكية (كامل البرج: ${currentBuilding.total_apartments} شقة)`}
            </Text>
            <Text style={styles.smartCalcFormula}>
              {claimAmount || 0} ÷{' '}
              {claimDistribution === 'occupied_only'
                ? Math.max(occupiedApartments.length, 1)
                : Math.max(currentBuilding.total_apartments, 1)}
            </Text>
          </View>
          <View style={styles.smartCalcValRow}>
            <Text style={styles.smartCalcAmount}>{calculatedEqualShare}</Text>
            <Text style={styles.smartCalcCurrency}>
              ج.م / لكل شقة{' '}
              {claimDistribution === 'occupied_only'
                ? '(مسكونة)'
                : '(في البرج)'}
            </Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ملاحظات الفني (اختياري)</Text>
          <TextInput
            style={styles.input}
            value={claimNotes}
            onChangeText={setClaimNotes}
            placeholder="تفاصيل العطل وأسباب الاستعجال..."
            placeholderTextColor={COLORS.outline}
          />
        </View>

        <TouchableOpacity
          style={styles.modalPrimaryBtn}
          onPress={handleCreateEmergencyClaim}
          disabled={claimSubmitting}
        >
          {claimSubmitting ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <>
              <MaterialIcons
                name="bolt"
                size={18}
                color={COLORS.onPrimary}
              />
              <Text style={styles.modalPrimaryBtnText}>
                إطلاق المطالبة الطارئة وإشعار السكان
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};
