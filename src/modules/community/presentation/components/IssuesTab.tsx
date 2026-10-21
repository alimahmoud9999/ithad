import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { BuildingIssue } from '@/shared/types/database';
import { useAppStore } from '@/store/AppContext';
import type { IssueFilter, CommunityTab } from '../../domain/community.types';
import { styles } from '../CommunityHubScreen.styles';

interface IssuesTabProps {
  activeTab: CommunityTab;
  setIsAddIssueModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIssueImage: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedIssueDetails: React.Dispatch<React.SetStateAction<BuildingIssue | null>>;
}

export const IssuesTab: React.FC<IssuesTabProps> = ({
  activeTab,
  setIsAddIssueModalOpen,
  setSelectedIssueImage,
  setSelectedIssueDetails,
}) => {
  const { buildingIssues, currentBuilding, currentRole, toggleIssueUpvote, updateIssueStatus } = useAppStore();

  // Issues Filter
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');

  // Filtered Issues
  const filteredIssues = useMemo(() => {
    return buildingIssues.filter((issue) => {
      if (issueFilter === 'all') return true;
      return issue.status === issueFilter;
    });
  }, [buildingIssues, issueFilter]);

  return (
    activeTab === 'issues' && (
    <View style={styles.tabContent}>
      {/* Quick Hero Banner (_1/code.html lines 11-32) */}
      <View style={styles.issuesHero}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.liveTrackChip}>
              <View style={styles.pingDot} />
              <Text style={styles.liveTrackText}>سجل الصيانة والمقترحات الموحد</Text>
            </View>
            <Text style={styles.heroTitle}>مجتمع العمارة والصيانة</Text>
            <Text style={styles.heroSub}>
              تقديم ومتابعة بلاغات الأعطال والمقترحات بشفافية مع نظام التأييد
            </Text>
          </View>
          <View style={styles.heroIconBox}>
            <MaterialIcons name="handyman" size={26} color={COLORS.secondary} />
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View style={styles.heroStatItem}>
            <MaterialIcons name="bolt" size={15} color={COLORS.secondary} />
            <Text style={styles.heroStatText}>متوسط الاستجابة: 45 دقيقة</Text>
          </View>
          <Text style={styles.heroCodeText}>
            {currentBuilding.name || 'برج الأمل'}
          </Text>
        </View>
      </View>

      {/* Filter Chips Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.filterPill,
            issueFilter === 'all' && styles.filterPillActive,
          ]}
          onPress={() => setIssueFilter('all')}
        >
          <Text
            style={[
              styles.filterPillText,
              issueFilter === 'all' && styles.filterPillTextActive,
            ]}
          >
            الكل ({buildingIssues.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            issueFilter === 'open' && styles.filterPillActive,
          ]}
          onPress={() => setIssueFilter('open')}
        >
          <View style={[styles.dot, { backgroundColor: COLORS.statusPaid }]} />
          <Text
            style={[
              styles.filterPillText,
              issueFilter === 'open' && styles.filterPillTextActive,
            ]}
          >
            مفتوح ({buildingIssues.filter((i) => i.status === 'open').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            issueFilter === 'in_progress' && styles.filterPillActive,
          ]}
          onPress={() => setIssueFilter('in_progress')}
        >
          <View style={[styles.dot, { backgroundColor: COLORS.statusPending }]} />
          <Text
            style={[
              styles.filterPillText,
              issueFilter === 'in_progress' && styles.filterPillTextActive,
            ]}
          >
            جاري التنفيذ (
            {buildingIssues.filter((i) => i.status === 'in_progress').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            issueFilter === 'resolved' && styles.filterPillActive,
          ]}
          onPress={() => setIssueFilter('resolved')}
        >
          <View style={[styles.dot, { backgroundColor: COLORS.secondary }]} />
          <Text
            style={[
              styles.filterPillText,
              issueFilter === 'resolved' && styles.filterPillTextActive,
            ]}
          >
            تم الحل ({buildingIssues.filter((i) => i.status === 'resolved').length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Issue Creation Trigger Card */}
      <TouchableOpacity
        style={styles.addIssueCard}
        onPress={() => setIsAddIssueModalOpen(true)}
        activeOpacity={0.88}
      >
        <View style={styles.addIssueIconCircle}>
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.addIssueTitle}>تقديم بلاغ عطل أو مقترح جديد</Text>
          <Text style={styles.addIssueSub}>
            إشعار فوري لرئيس الاتحاد وتوثيق بالصور مع دعم تأييد الجيران
          </Text>
        </View>
      </TouchableOpacity>

      {/* Issues Feed List */}
      {filteredIssues.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="task-alt" size={44} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>لا توجد بلاغات مسجلة حالياً</Text>
          <Text style={styles.emptySub}>
            جميع مرافق العمارة تعمل بكفاءة، أو يمكنك الضغط على الزر أعلاه لإضافة بلاغ عطل.
          </Text>
        </View>
      ) : (
        filteredIssues.map((issue) => {
          const isResolved = issue.status === 'resolved';
          const isInProgress = issue.status === 'in_progress';

          return (
            <View key={issue.id} style={styles.issueCard}>
              {/* Header Row: Unit + Category + Status */}
              <View style={styles.issueHeaderRow}>
                <View style={styles.unitChip}>
                  <Text style={styles.unitChipNum}>
                    شقة {issue.apartment_number || '302'}
                  </Text>
                  <Text style={styles.unitChipName}>
                    • {issue.reporter_name || 'الساكن'}
                  </Text>
                </View>

                <View style={styles.issueStatusBadges}>
                  {issue.is_private && (
                    <View style={styles.privateBadge}>
                      <MaterialIcons name="lock" size={12} color="#6B7280" />
                      <Text style={styles.privateBadgeText}>خاص بالمدير</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.statusBadge,
                      isResolved
                        ? styles.statusResolved
                        : isInProgress
                        ? styles.statusInProgress
                        : styles.statusOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isResolved
                          ? styles.statusResolvedText
                          : isInProgress
                          ? styles.statusInProgressText
                          : styles.statusOpenText,
                      ]}
                    >
                      {isResolved
                        ? 'تم الحل ✅'
                        : isInProgress
                        ? 'جاري التنفيذ ⏳'
                        : 'مفتوح 🟢'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Category & Title */}
              <View style={styles.issueBody}>
                <View style={styles.categoryTag}>
                  <MaterialIcons
                    name="category"
                    size={13}
                    color={COLORS.primary}
                  />
                  <Text style={styles.categoryTagText}>{issue.category}</Text>
                  {issue.severity === 'high' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentBadgeText}>عاجل جداً ⚠️</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.issueTitle}>{issue.title}</Text>
                {Boolean(issue.description) && (
                  <Text style={styles.issueDesc}>{issue.description}</Text>
                )}

                {/* Photo Thumbnail if uploaded */}
                {Boolean(issue.image_url) && (
                  <TouchableOpacity
                    style={styles.imageThumbnailContainer}
                    onPress={() => setSelectedIssueImage(issue.image_url!)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: issue.image_url! }}
                      style={styles.imageThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.imageOverlayBadge}>
                      <MaterialIcons
                        name="zoom-in"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={styles.imageOverlayText}>
                        معاينة الصورة المرفقة
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Footer: Upvote Button + Admin Controls */}
              <View style={styles.issueFooter}>
                {/* Upvote Button (صوت تأييد واحد لكل شقة) */}
                {!issue.is_private && (
                  <TouchableOpacity
                    style={[
                      styles.upvoteBtn,
                      issue.has_upvoted && styles.upvoteBtnActive,
                    ]}
                    onPress={() => toggleIssueUpvote(issue.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={issue.has_upvoted ? 'thumb-up' : 'thumb-up-off-alt'}
                      size={16}
                      color={issue.has_upvoted ? '#FFFFFF' : COLORS.secondary}
                    />
                    <Text
                      style={[
                        styles.upvoteBtnText,
                        issue.has_upvoted && styles.upvoteBtnTextActive,
                      ]}
                    >
                      تأييد ({issue.upvotes_count || 0})
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Ticket Details & Timeline Trigger */}
                <TouchableOpacity
                  style={styles.detailsTicketBtn}
                  onPress={() => setSelectedIssueDetails(issue)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="info-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.detailsTicketBtnText}>المسار والتفاصيل</Text>
                </TouchableOpacity>

                {/* Admin Status Management Buttons */}
                {currentRole === 'admin' && (
                  <View style={styles.adminActionGroup}>
                    {!isInProgress && !isResolved && (
                      <TouchableOpacity
                        style={styles.adminActionBtn}
                        onPress={() => updateIssueStatus(issue.id, 'in_progress')}
                      >
                        <Text style={styles.adminActionBtnText}>
                          ⏳ جاري التنفيذ
                        </Text>
                      </TouchableOpacity>
                    )}

                    {!isResolved && (
                      <TouchableOpacity
                        style={[styles.adminActionBtn, styles.adminActionBtnDone]}
                        onPress={() => updateIssueStatus(issue.id, 'resolved')}
                      >
                        <Text style={styles.adminActionBtnDoneText}>
                          ✅ اعتماد الحل
                        </Text>
                      </TouchableOpacity>
                    )}

                    {isResolved && (
                      <TouchableOpacity
                        style={styles.adminActionBtn}
                        onPress={() => updateIssueStatus(issue.id, 'open')}
                      >
                        <Text style={styles.adminActionBtnText}>
                          🔄 فتح مجدداً
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
    )
  ) || null;
};
