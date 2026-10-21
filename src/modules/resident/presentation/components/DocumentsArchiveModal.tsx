import React, { useState } from 'react';
import { Modal, ScrollView, View, TouchableOpacity, Text, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { ActiveSubView } from '../../domain/resident.types';
import { styles } from '../ResidentHomeScreen.styles';

interface DocumentsArchiveModalProps {
  activeSubView: ActiveSubView;
  setActiveSubView: React.Dispatch<React.SetStateAction<ActiveSubView>>;
}

export const DocumentsArchiveModal: React.FC<DocumentsArchiveModalProps> = ({
  activeSubView,
  setActiveSubView,
}) => {
  const { currentBuilding } = useAppStore();

  // Docs Filter State (Screen 12: DOCS_BYLAWS - _14)
  const [docFilter, setDocFilter] = useState<'all' | 'bylaws' | 'contracts' | 'blueprints'>('all');

  return (
    <Modal
      visible={activeSubView === 'docs_bylaws'}
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
          <Text style={styles.barCenterTitle}>اللائحة والمستندات الرسمية</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Context Banner */}
        <View style={styles.docsHeroBanner}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="verified-user" size={18} color={COLORS.secondaryFixed} />
            <Text style={styles.docsHeroTag}>ملف موثّق ورسمي</Text>
          </View>
          <Text style={styles.docsHeroTitle}>{currentBuilding.name}</Text>
          <Text style={styles.docsHeroSub}>
            قيد اتحاد الشاغلين رقم ١٤٢ لسنة ٢٠٢٣ • حي النزهة ومصر الجديدة
          </Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.docsFilterRow}>
          {(['all', 'bylaws', 'contracts', 'blueprints'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.docFilterChip,
                docFilter === filter && styles.docFilterChipActive,
              ]}
              onPress={() => setDocFilter(filter)}
            >
              <Text
                style={[
                  styles.docFilterChipText,
                  docFilter === filter && styles.docFilterChipTextActive,
                ]}
              >
                {filter === 'all'
                  ? 'الكل'
                  : filter === 'bylaws'
                  ? 'اللائحة والقوانين'
                  : filter === 'contracts'
                  ? 'العقود والضمانات'
                  : 'المخططات الهندسية'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Document Card */}
        <View style={styles.formSectionCard}>
          <View style={styles.rowAlign}>
            <MaterialIcons name="push-pin" size={20} color={COLORS.primary} />
            <Text style={styles.sectionHeaderTitle}>المستندات الدستورية المثبتة</Text>
          </View>

          <View style={styles.bylawCard}>
            <View style={styles.rowBetween}>
              <View style={styles.bylawIconBox}>
                <MaterialIcons name="menu-book" size={26} color={COLORS.onPrimary} />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={styles.rowAlign}>
                  <View style={styles.pdfBadge}>
                    <Text style={styles.pdfBadgeText}>وثيقة رئيسية PDF</Text>
                  </View>
                  <Text style={styles.docFileSizeText}>2.4 MB</Text>
                </View>
                <Text style={styles.bylawDocTitle}>اللائحة الداخلية المعتمدة لاتحاد الملاك</Text>
                <Text style={styles.bylawDocSub}>معتمدة بقرار الجمعية العمومية ٢٠٢٣ • ١٨ صفحة مدققة</Text>
              </View>
            </View>

            <View style={styles.bylawProvisionsBox}>
              <View style={styles.rowAlign}>
                <MaterialIcons name="check-circle" size={15} color={COLORS.secondary} />
                <Text style={styles.provisionText}>مواعيد وساعات الهدوء وقواعد إشغال المصعد وتوزيع الصيانة</Text>
              </View>
              <View style={styles.rowAlign}>
                <MaterialIcons name="check-circle" size={15} color={COLORS.secondary} />
                <Text style={styles.provisionText}>تنظيم حقوق استغلال الرووف وحصص مواقف الجراج الخاصة</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.downloadDocBtn}
              onPress={() => Alert.alert('تحميل المستند', 'جاري تنزيل ملف اللائحة الداخلية بصيغة PDF...')}
            >
              <MaterialIcons name="download" size={18} color={COLORS.primary} />
              <Text style={styles.downloadDocBtnText}>تحميل وقراءة اللائحة كاملة (PDF)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
};
