import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { styles } from '../ResidentHomeScreen.styles';

interface ActivePollCardProps {
  onNavigateCommunity: (() => void) | undefined;
}

export const ActivePollCard: React.FC<ActivePollCardProps> = ({
  onNavigateCommunity,
}) => {
  return (
    <View style={styles.pollCardContainer}>
      <View style={styles.rowBetween}>
        <View style={styles.pollCountdownBadge}>
          <MaterialIcons name="schedule" size={14} color={COLORS.statusUpcoming} />
          <Text style={styles.pollCountdownText}>ينتهي خلال 3 أيام</Text>
        </View>
        <Text style={styles.pollWeightText}>
          صوتك يمثل <Text style={{ fontWeight: '700', color: COLORS.onSurface }}>6.25%</Text>
        </Text>
      </View>

      <View style={[styles.rowAlign, { alignItems: 'flex-start', marginTop: 4 }]}>
        <View style={styles.pollIconBox}>
          <MaterialIcons name="how-to-vote" size={22} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pollHeading}>تصويت: التعاقد مع شركة حراسة وأمن جديدة</Text>
          <Text style={styles.pollDescription}>
            بناءً على طلب الجلسة الماضية، معروض عرضين لتأمين المداخل وتغطية كاميرات المراقبة على مدار الساعة.
          </Text>
        </View>
      </View>

      <View style={styles.pollParticipationBanner}>
        <View style={styles.rowAlign}>
          <MaterialIcons name="how-to-reg" size={16} color={COLORS.secondary} />
          <Text style={styles.pollParticipationText}>صوّت 12 من 16 شقة (75%)</Text>
        </View>
        <Text style={styles.notVotedTag}>لم تصوّت بعد</Text>
      </View>

      <TouchableOpacity
        style={styles.participatePollBtn}
        onPress={() => onNavigateCommunity?.()}
      >
        <Text style={styles.participatePollBtnText}>المشاركة في التصويت الآن 🗳️</Text>
        <MaterialIcons name="arrow-back" size={18} color={COLORS.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};
