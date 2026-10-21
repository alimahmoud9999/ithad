import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '@/store/AppContext';
import type { CommunityTab } from '../../domain/community.types';
import { styles } from '../CommunityHubScreen.styles';

interface CommunityTabsHeaderProps {
  activeTab: CommunityTab;
  setActiveTab: React.Dispatch<React.SetStateAction<CommunityTab>>;
}

export const CommunityTabsHeader: React.FC<CommunityTabsHeaderProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { buildingIssues, emergencyClaims, polls } = useAppStore();

  return (
    <View style={styles.tabsHeader}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsHeaderScroll}
      >
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'issues' && styles.mainTabActive]}
          onPress={() => setActiveTab('issues')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="build"
            size={16}
            color={activeTab === 'issues' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.mainTabText,
              activeTab === 'issues' && styles.mainTabTextActive,
            ]}
          >
            البلاغات والشكاوى
          </Text>
          <View
            style={[
              styles.tabBadge,
              activeTab === 'issues' && styles.tabBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                activeTab === 'issues' && styles.tabBadgeTextActive,
              ]}
            >
              {buildingIssues.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'polls' && styles.mainTabActive]}
          onPress={() => setActiveTab('polls')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="how-to-vote"
            size={16}
            color={activeTab === 'polls' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.mainTabText,
              activeTab === 'polls' && styles.mainTabTextActive,
            ]}
          >
            التصويت والقرارات
          </Text>
          <View
            style={[
              styles.tabBadge,
              activeTab === 'polls' && styles.tabBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                activeTab === 'polls' && styles.tabBadgeTextActive,
              ]}
            >
              {polls.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'campaigns' && styles.mainTabActive]}
          onPress={() => setActiveTab('campaigns')}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="construction"
            size={16}
            color={activeTab === 'campaigns' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.mainTabText,
              activeTab === 'campaigns' && styles.mainTabTextActive,
            ]}
          >
            صناديق الطوارئ
          </Text>
          <View
            style={[
              styles.tabBadge,
              activeTab === 'campaigns' && styles.tabBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.tabBadgeText,
                activeTab === 'campaigns' && styles.tabBadgeTextActive,
              ]}
            >
              {emergencyClaims.length}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
