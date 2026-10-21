import React from 'react';
import { View, Text, TouchableOpacity, Share, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../SettingsScreen.styles';

interface ProfileCardProps {
  handleCopy: (text: string, label: string) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  handleCopy,
}) => {
  const { currentBuilding, currentRole, currentUser } = useAppStore();

  // Share building code via WhatsApp
  const handleShareBuildingCode = async () => {
    try {
      const shareMessage = `أهلاً بكم يا جيران! 🏢\nيسرنا دعوتكم للانضمام إلى تطبيق إدارة عقارنا (${currentBuilding.name}).\n\nكود المبنى الخاص بنا: ${currentBuilding.building_code}\n\nيرجى تحميل التطبيق وإدخال الكود للوصول إلى الخزينة وسداد الاشتراكات والتصويت على قرارات العمارة.`;
      await Share.share({
        message: shareMessage,
      });
    } catch (err: any) {
      Alert.alert('تنبيه', err?.message || 'تعذر مشاركة الكود');
    }
  };

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileTopRow}>
        <View style={styles.avatarCircle}>
          <MaterialIcons
            name={currentRole === 'admin' ? 'admin-panel-settings' : 'person'}
            size={36}
            color={COLORS.primary}
          />
        </View>
        <View style={styles.profileInfoCol}>
          <View style={styles.nameAndBadgeRow}>
            <Text style={styles.userNameText}>{currentUser.full_name}</Text>
            <StatusBadge
              status={currentRole === 'admin' ? 'paid' : 'pending'}
              customLabel={
                currentRole === 'admin'
                  ? 'رئيس الاتحاد'
                  : currentRole === 'super_admin'
                  ? 'مدير المنصة'
                  : 'ساكن / مالك'
              }
            />
          </View>
          <Text style={styles.userPhoneText}>
            {currentUser.phone || 'رقم الهاتف غير مسجل'}
          </Text>
          <Text style={styles.buildingSubText}>
            عقار: {currentBuilding.name} ({currentBuilding.address})
          </Text>
        </View>
      </View>

      {/* Building Code Share Banner */}
      <View style={styles.buildingCodeBox}>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={styles.buildingCodeLabel}>كود دعوة العقار للسكان:</Text>
          <Text style={styles.buildingCodeValue}>
            {currentBuilding.building_code}
          </Text>
        </View>
        <View style={styles.codeActionsRow}>
          <TouchableOpacity
            style={styles.codeActionBtn}
            onPress={() =>
              handleCopy(currentBuilding.building_code, 'كود المبنى')
            }
          >
            <MaterialIcons
              name="content-copy"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.codeActionBtnText}>نسخ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.codeActionBtn, styles.shareBtn]}
            onPress={handleShareBuildingCode}
          >
            <MaterialIcons name="share" size={18} color="#047857" />
            <Text style={[styles.codeActionBtnText, { color: '#047857' }]}>
              مشاركة
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
