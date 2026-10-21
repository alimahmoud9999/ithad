import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { Apartment } from '@/shared/types/database';
import { copyToClipboard, sendWhatsAppInvite } from '@/shared/utils/inviteHelper';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../ApartmentsUnitsScreen.styles';

interface InviteShareModalProps {
  inviteModalApt: Apartment | null;
  setInviteModalApt: React.Dispatch<React.SetStateAction<Apartment | null>>;
}

export const InviteShareModal: React.FC<InviteShareModalProps> = ({
  inviteModalApt,
  setInviteModalApt,
}) => {
  const { currentBuilding } = useAppStore();

  return (
    inviteModalApt && (
    <Modal
      visible={Boolean(inviteModalApt)}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setInviteModalApt(null)}
    >
      <View style={styles.modalBackdropDark}>
        <View style={styles.bottomSheetPanel}>
          <View style={styles.sheetGrabBar} />

          <View style={styles.rowBetween}>
            <View style={styles.rowAlign}>
              <View style={styles.inviteIconCircle}>
                <MaterialIcons name="person-add" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.inviteModalTitle}>مشاركة رابط انضمام الساكن</Text>
                <Text style={styles.inviteModalSub}>
                  شقة {inviteModalApt.apartment_number} • {inviteModalApt.floor_number || 'الدور الأول'} ({inviteModalApt.resident_name || 'مالك جديد'})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setInviteModalApt(null)}>
              <MaterialIcons name="close" size={22} color={COLORS.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Code Box */}
          <View style={styles.codeBentoBox}>
            <Text style={styles.codeBentoLabel}>كود الانضمام المباشر للشقة:</Text>
            <Text style={styles.codeBentoText}>
              {currentBuilding.building_code}-{inviteModalApt.apartment_number}
            </Text>
          </View>

          {/* Share Actions */}
          <View style={styles.twoColumnGrid}>
            <TouchableOpacity
              style={styles.outlineActionBtn}
              onPress={() =>
                copyToClipboard(
                  `${currentBuilding.building_code}-${inviteModalApt.apartment_number}`,
                  'كود دعوة الشقة'
                )
              }
            >
              <MaterialIcons name="content-copy" size={18} color={COLORS.primary} />
              <Text style={styles.outlineActionBtnText}>نسخ الكود</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.whatsAppActionBtn}
              onPress={() =>
                sendWhatsAppInvite({
                  buildingName: currentBuilding.name,
                  buildingCode: `${currentBuilding.building_code}-${inviteModalApt.apartment_number}`,
                  apartmentNumber: inviteModalApt.apartment_number,
                  residentName: inviteModalApt.resident_name || undefined,
                  phone: inviteModalApt.resident_phone || undefined,
                })
              }
            >
              <MaterialIcons name="chat" size={18} color="#FFFFFF" />
              <Text style={styles.whatsAppActionBtnText}>مشاركة واتساب 📲</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    )
  ) || null;
};
