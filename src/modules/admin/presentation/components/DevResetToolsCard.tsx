import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../AdminDashboardScreen.styles';

export const DevResetToolsCard: React.FC = () => {
  const { currentBuilding, currentUser, resetBuildingData } = useAppStore();

  // Testing & Reset Tools state
  const [resettingMode, setResettingMode] = useState<
    'residents_only' | 'full_delete' | null
  >(null);

  const handleResetResidentsOnly = () => {
    Alert.alert(
      'تصفير العمارة ومسح بيانات السكان ⚠️',
      `هل أنت متأكد من مسح جميع الشقق، مديونيات السكان، طلبات الانضمام، المدفوعات، والمصروفات؟\n\nستصبح العمارة (${currentBuilding.name}) فارغة تماماً برصيد خزينة 0 ج.م مع الإبقاء على حساب رئيس الاتحاد (${currentUser.full_name}) لتتمكن من تجربة تسجيل الشقق والمديونيات من جديد فوراً.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، تصفير العمارة الآن',
          style: 'destructive',
          onPress: async () => {
            setResettingMode('residents_only');
            try {
              await resetBuildingData('residents_only');
              Alert.alert(
                'تم تصفير العمارة بنجاح ✅',
                'أصبحت العمارة الآن فارغة تماماً. يمكنك البدء فوراً في تجربة إضافة الشقق والمديونيات مجدداً.'
              );
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر تصفير بيانات العمارة');
            } finally {
              setResettingMode(null);
            }
          },
        },
      ]
    );
  };

  const handleFullDeleteBuilding = () => {
    Alert.alert(
      'حذف العمارة بالكامل وإعادة البدء 🛑',
      `تحذير نهائي: سيتم حذف عمارة (${currentBuilding.name}) بالكامل من قاعدة البيانات مع كافة سجلاتها وحساب رئيس الاتحاد (${currentUser.full_name}).\n\nسيتم تسجيل خروجك لتبدأ تجربة التطبيق كأنك تسجل عقاراً جديداً لأول مرة.\n\nهل ترغب في المتابعة؟`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'تأكيد الحذف الشامل والخروج',
          style: 'destructive',
          onPress: async () => {
            setResettingMode('full_delete');
            try {
              await resetBuildingData('full_delete');
              Alert.alert(
                'تم حذف العمارة بالكامل ✅',
                'تم حذف العقار وكافة السجلات وحساب المدير. يمكنك الآن البدء من جديد.'
              );
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف العمارة');
            } finally {
              setResettingMode(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.testingCard}>
      <View style={styles.testingHeaderRow}>
        <MaterialIcons name="science" size={24} color="#B45309" />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.testingTitle}>
            أدوات التجربة السريعة والتصفير 🧪
          </Text>
          <Text style={styles.testingSubtitle}>
            مخصصة لتسريع الاختبار وحذف وإعادة كتابة البيانات دون فتح قاعدة البيانات يدوياً
          </Text>
        </View>
      </View>

      {/* Action 1: Clear Residents and Operations */}
      <TouchableOpacity
        style={styles.testingActionBtnAmber}
        onPress={handleResetResidentsOnly}
        disabled={resettingMode !== null}
        activeOpacity={0.8}
      >
        <View style={styles.testingActionTop}>
          {resettingMode === 'residents_only' ? (
            <ActivityIndicator size="small" color="#B45309" />
          ) : (
            <MaterialIcons name="cleaning-services" size={20} color="#B45309" />
          )}
          <Text style={styles.testingActionTitleAmber}>
            مسح بيانات السكان والعمليات (تصفير العمارة)
          </Text>
        </View>
        <Text style={styles.testingActionDesc}>
          مسح كافة الشقق، المديونيات، طلبات الانضمام، المدفوعات، والمصروفات، مع تصفير رصيد الخزينة والإبقاء على حساب رئيس الاتحاد والعمارة لتجربة تسجيل الشقق والمديونيات من جديد فوراً.
        </Text>
      </TouchableOpacity>

      {/* Action 2: Cascade Delete Building & Admin */}
      <TouchableOpacity
        style={styles.testingActionBtnRed}
        onPress={handleFullDeleteBuilding}
        disabled={resettingMode !== null}
        activeOpacity={0.8}
      >
        <View style={styles.testingActionTop}>
          {resettingMode === 'full_delete' ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <MaterialIcons name="delete-forever" size={20} color="#DC2626" />
          )}
          <Text style={styles.testingActionTitleRed}>
            حذف العمارة بالكامل وإعادة البدء من الصفر
          </Text>
        </View>
        <Text style={styles.testingActionDesc}>
          حذف العقار بالكامل من قاعدة البيانات مع كافة سجلاته وحساب رئيس الاتحاد وتسجيل الخروج للبدء من صفحة التسجيل والتهيئة كأنك تستخدم التطبيق لأول مرة.
        </Text>
      </TouchableOpacity>
    </View>
  );
};
