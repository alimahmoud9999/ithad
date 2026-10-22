import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import { styles } from '../NotificationCenterModal.styles';

export const PushTokenStatusCard: React.FC = () => {
  const { currentUser } = useAppStore();

  const [copiedToken, setCopiedToken] = useState(false);

  const handleCopyToken = async () => {
    const token = currentUser.push_token || '';
    if (!token) return;
    try {
      await Clipboard.setStringAsync(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <View style={styles.tokenCard}>
      <View style={styles.tokenHeaderRow}>
        <View style={styles.tokenStatusBadge}>
          <View style={styles.tokenActiveDot} />
          <Text style={styles.tokenStatusText}>
            محفوظ في جدول users.push_token
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCopyToken}
          style={styles.copyTokenBtn}
        >
          <MaterialIcons
            name={copiedToken ? 'check' : 'content-copy'}
            size={14}
            color={COLORS.secondary}
          />
          <Text style={styles.copyTokenText}>
            {copiedToken ? 'تم النسخ' : 'نسخ التوكن'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.tokenValueText} numberOfLines={1}>
        {currentUser.push_token || 'ExponentPushToken[initializing...]'}
      </Text>
    </View>
  );
};
