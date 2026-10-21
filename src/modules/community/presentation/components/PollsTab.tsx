import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '@/shared/theme/colors';
import { useAppStore } from '@/store/AppContext';
import type { CommunityTab } from '../../domain/community.types';
import { styles } from '../CommunityHubScreen.styles';

interface PollsTabProps {
  activeTab: CommunityTab;
  setIsAddPollModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PollsTab: React.FC<PollsTabProps> = ({
  activeTab,
  setIsAddPollModalOpen,
}) => {
  const { castPollVote, currentBuilding, currentRole, currentUser, polls } = useAppStore();

  // Polls State
  const [pollFilter, setPollFilter] = useState<'active' | 'closed'>('active');

  const [selectedPollChoices, setSelectedPollChoices] = useState<Record<string, string>>({});

  const [isCastingVote, setIsCastingVote] = useState<Record<string, boolean>>({});

  const [expandedTransparencyPollId, setExpandedTransparencyPollId] = useState<string | null>(null);

  // Filtered Polls
  const filteredPolls = useMemo(() => {
    return polls.filter((p) => {
      if (pollFilter === 'active') return p.status === 'active';
      return p.status !== 'active';
    });
  }, [polls, pollFilter]);

  // Overall Legal Quorum calculation
  const totalUnits = currentBuilding.total_apartments || 16;

  const activePoll = polls.find((p) => p.status === 'active');

  const quorumPercentage = activePoll
    ? Math.min(100, Math.round(((activePoll.votes_count || 0) / totalUnits) * 100))
    : 75;

  // Handler for Voting
  const handleVote = async (pollId: string) => {
    const choice = selectedPollChoices[pollId];
    if (!choice) {
      Alert.alert('تنبيه', 'يرجى تحديد خيارك أولاً لتأكيد التصويت.');
      return;
    }

    try {
      setIsCastingVote((prev) => ({ ...prev, [pollId]: true }));
      await castPollVote(pollId, choice);
      Alert.alert(
        'تم تسجيل صوتك بنجاح ✅',
        `تم توثيق تصويت شقة ${currentUser.apartment_number || '1'} في محضر جلسة الجمعية العمومية.`
      );
    } catch (err: any) {
      Alert.alert('تعذر تسجيل الصوت', err?.message || 'حدث خطأ أثناء التصويت.');
    } finally {
      setIsCastingVote((prev) => ({ ...prev, [pollId]: false }));
    }
  };

  return (
    activeTab === 'polls' && (
    <View style={styles.tabContent}>
      {/* Legal Quorum Hero Card (_14/code.html lines 11-50) */}
      <View style={styles.quorumCard}>
        <View style={styles.quorumHeaderRow}>
          <View style={styles.quorumBadge}>
            <View style={styles.quorumPulseDot} />
            <Text style={styles.quorumBadgeText}>جلسات الجمعية العمومية</Text>
          </View>
          <View style={styles.bldTag}>
            <Text style={styles.bldTagText}>{currentBuilding.name || 'العمارة'}</Text>
          </View>
        </View>

        <View style={styles.quorumMetricRow}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={styles.quorumPercentText}>{quorumPercentage}%</Text>
            <Text style={styles.quorumLabel}>النصاب القانوني التراكمي</Text>
          </View>
          <MaterialIcons name="gavel" size={28} color="#FFFFFF" style={{ opacity: 0.9 }} />
        </View>

        {/* Progress Track */}
        <View style={styles.quorumTrack}>
          <View
            style={[
              styles.quorumTrackFill,
              { width: `${Math.max(5, quorumPercentage)}%` },
            ]}
          />
        </View>

        <View style={styles.quorumFooterRow}>
          <View style={styles.quorumVerifiedStrip}>
            <MaterialIcons name="verified" size={15} color={COLORS.secondary} />
            <Text style={styles.quorumVerifiedText}>
              مشاركة موثقة بالوحدات • الحد الأدنى للإقرار: 51%
            </Text>
          </View>
        </View>
      </View>

      {/* Poll Sub-Tabs */}
      <View style={styles.pollSubTabs}>
        <TouchableOpacity
          style={[
            styles.pollSubTab,
            pollFilter === 'active' && styles.pollSubTabActive,
          ]}
          onPress={() => setPollFilter('active')}
        >
          <Text
            style={[
              styles.pollSubTabText,
              pollFilter === 'active' && styles.pollSubTabTextActive,
            ]}
          >
            تصويتات جارية 🟢
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pollSubTab,
            pollFilter === 'closed' && styles.pollSubTabActive,
          ]}
          onPress={() => setPollFilter('closed')}
        >
          <Text
            style={[
              styles.pollSubTabText,
              pollFilter === 'closed' && styles.pollSubTabTextActive,
            ]}
          >
            قرارات معتمدة وأرشيف 📜
          </Text>
        </TouchableOpacity>
      </View>

      {/* Admin Add Poll CTA */}
      {currentRole === 'admin' && (
        <TouchableOpacity
          style={styles.addPollBanner}
          onPress={() => setIsAddPollModalOpen(true)}
          activeOpacity={0.88}
        >
          <MaterialIcons name="how-to-vote" size={22} color="#FFFFFF" />
          <Text style={styles.addPollBannerText}>
            طرح قرار أو استطلاع جديد للجمعية العمومية 🗳️
          </Text>
        </TouchableOpacity>
      )}

      {/* Polls Feed */}
      {filteredPolls.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialIcons name="how-to-vote" size={44} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>لا توجد تصويتات جارية حالياً</Text>
          <Text style={styles.emptySub}>
            عندما يطرح رئيس الاتحاد قراراً مصيرياً للصيانة أو التطوير سيظهر هنا لجميع الوحدات.
          </Text>
        </View>
      ) : (
        filteredPolls.map((poll) => {
          const hasVoted = Boolean(poll.user_voted_choice);
          const selectedChoice =
            selectedPollChoices[poll.id] || poll.user_voted_choice || 'approve';

          return (
            <View key={poll.id} style={styles.pollCard}>
              {/* Header */}
              <View style={styles.pollHeader}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={styles.pollTagRow}>
                    <View
                      style={[
                        styles.voteStatusBadge,
                        hasVoted
                          ? styles.voteStatusBadgeDone
                          : styles.voteStatusBadgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteStatusBadgeText,
                          hasVoted && styles.voteStatusBadgeDoneText,
                        ]}
                      >
                        {hasVoted ? 'تم تسجيل صوتك ✅' : 'بانتظار تصويتك ⏳'}
                      </Text>
                    </View>
                    <Text style={styles.pollCategoryText}>{poll.category}</Text>
                  </View>
                  <Text style={styles.pollTitle}>{poll.title}</Text>
                </View>

                <View style={styles.pollTimerBox}>
                  <MaterialIcons
                    name="schedule"
                    size={18}
                    color={COLORS.statusUpcoming}
                  />
                  <Text style={styles.pollTimerText}>تصويت رسمي</Text>
                </View>
              </View>

              {/* Financial Specs Badge (_14/code.html lines 88-106) */}
              {(Boolean(poll.estimated_cost) || Boolean(poll.description)) && (
                <View style={styles.pollSpecsBox}>
                  {Boolean(poll.estimated_cost && poll.estimated_cost > 0) && (
                    <View style={styles.pollSpecsRow}>
                      <Text style={styles.pollSpecsLabel}>
                        التكلفة التقديرية الإجمالية
                      </Text>
                      <Text style={styles.pollSpecsValue}>
                        {(poll.estimated_cost ?? 0).toLocaleString()} ج.م
                      </Text>
                    </View>
                  )}
                  {Boolean(poll.share_per_unit && poll.share_per_unit > 0) && (
                    <View style={styles.pollSpecsRow}>
                      <Text style={styles.pollSpecsLabel}>حصة الشقة الواحدة</Text>
                      <Text style={styles.pollSpecsHighlight}>
                        {(poll.share_per_unit ?? 0).toLocaleString()} ج.م / شقة
                      </Text>
                    </View>
                  )}
                  {Boolean(poll.description) && (
                    <Text style={styles.pollDescText}>{poll.description}</Text>
                  )}
                </View>
              )}

              {/* Voting Options Group */}
              <View style={styles.optionsGroup}>
                {(poll.options || []).map((opt) => {
                  const isSelected = selectedChoice === opt.id;
                  const stat = poll.options_stats?.[opt.id] || {
                    count: 0,
                    percentage: 0,
                    apartments: [],
                  };

                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => {
                        if (!hasVoted) {
                          setSelectedPollChoices((prev) => ({
                            ...prev,
                            [poll.id]: opt.id,
                          }));
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.optionHeaderRow}>
                        <View style={styles.optionRadioGroup}>
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioCircleSelected,
                            ]}
                          >
                            {isSelected && <View style={styles.radioInnerDot} />}
                          </View>
                          <Text
                            style={[
                              styles.optionTitle,
                              isSelected && styles.optionTitleSelected,
                            ]}
                          >
                            {opt.title}
                          </Text>
                        </View>
                        <Text style={styles.optionStatText}>
                          {stat.percentage}% ({stat.count} وحدة)
                        </Text>
                      </View>

                      {/* Option Bar */}
                      <View style={styles.optionTrack}>
                        <View
                          style={[
                            styles.optionTrackFill,
                            {
                              width: `${Math.max(2, stat.percentage)}%`,
                              backgroundColor: isSelected
                                ? COLORS.secondary
                                : COLORS.onSurfaceVariant,
                            },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit Vote CTA or Voted Feedback */}
              {!hasVoted ? (
                <View style={styles.voteCtaContainer}>
                  <TouchableOpacity
                    style={styles.voteSubmitBtn}
                    onPress={() => handleVote(poll.id)}
                    disabled={isCastingVote[poll.id]}
                    activeOpacity={0.88}
                  >
                    {isCastingVote[poll.id] ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="how-to-vote" size={20} color="#FFFFFF" />
                        <Text style={styles.voteSubmitBtnText}>
                          تأكيد صوتي عن شقة {currentUser.apartment_number || '302'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <View style={styles.voteTrustNote}>
                    <MaterialIcons name="lock" size={13} color={COLORS.onSurfaceVariant} />
                    <Text style={styles.voteTrustNoteText}>
                      صوت موثق برقم الوحدة ويسجل فورياً بمحضر الجلسة
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.votedFeedbackBox}>
                  <View style={styles.votedFeedbackHeader}>
                    <MaterialIcons name="check-circle" size={16} color={COLORS.secondary} />
                    <Text style={styles.votedFeedbackText}>
                      تم تثبيت صوت شقتك: ({poll.options?.find((o) => o.id === poll.user_voted_choice)?.title || 'موافق'})
                    </Text>
                  </View>

                  {/* Transparency toggle */}
                  <TouchableOpacity
                    style={styles.transparencyToggleBtn}
                    onPress={() =>
                      setExpandedTransparencyPollId((prev) =>
                        prev === poll.id ? null : poll.id
                      )
                    }
                  >
                    <MaterialIcons name="visibility" size={16} color={COLORS.primary} />
                    <Text style={styles.transparencyToggleText}>
                      {expandedTransparencyPollId === poll.id
                        ? 'إخفاء كشف شفافية الوحدات'
                        : 'عرض كشف مصوتي الوحدات (شفافية كاملة)'}
                    </Text>
                  </TouchableOpacity>

                  {expandedTransparencyPollId === poll.id && (
                    <View style={styles.transparencyListContainer}>
                      <Text style={styles.transparencyListTitle}>
                        سجل تصويت شقق العقار:
                      </Text>
                      {(poll.options || []).map((o) => {
                        const apts = poll.options_stats?.[o.id]?.apartments || [];
                        return (
                          <View key={o.id} style={styles.transparencyRow}>
                            <Text style={styles.transparencyOptionLabel}>
                              • {o.title}:
                            </Text>
                            <Text style={styles.transparencyAptList}>
                              {apts.length > 0
                                ? apts.map((a) => `شقة ${a}`).join('، ')
                                : 'لا توجد شقق بعد'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
    )
  ) || null;
};
