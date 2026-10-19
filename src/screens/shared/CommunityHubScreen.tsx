import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  I18nManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAppStore } from '../../store/AppContext';
import { BottomSheetModal } from '../../components/ui/BottomSheetModal';
import { pickAndCompressUploadImage } from '../../utils/imageUpload';
import {
  BuildingIssue,
  IssueSeverity,
  IssueStatus,
  Poll,
  PollOption,
} from '../../types/database';

type CommunityTab = 'issues' | 'polls' | 'campaigns';
type IssueFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const ISSUE_CATEGORIES = [
  { id: 'المصعد', name: 'المصعد', icon: 'elevator' },
  { id: 'مدخل العقار', name: 'مدخل العقار', icon: 'door-front' },
  { id: 'إنارة السلم', name: 'إنارة السلم', icon: 'lightbulb' },
  { id: 'طلمبة المياه', name: 'طلمبة المياه', icon: 'water' },
  { id: 'الجراج السفلي', name: 'الجراج السفلي', icon: 'garage' },
  { id: 'السطح والرووف', name: 'السطح والرووف', icon: 'roofing' },
  { id: 'تسريب مؤثر بالأسقف', name: 'تسريب بالأسقف', icon: 'water-damage' },
  { id: 'مواسير صواعد رئيسية', name: 'سباكة وصواعد', icon: 'plumbing' },
  { id: 'عام', name: 'عام وأخرى', icon: 'build' },
];

const SEVERITY_LEVELS: {
  id: IssueSeverity;
  title: string;
  badge: string;
  desc: string;
  color: string;
  bg: string;
}[] = [
  {
    id: 'low',
    title: 'عادي / صيانة دورية مجدولة',
    badge: 'خلال 5 أيام',
    desc: 'عطل طفيف لا يعوق الاستخدام اليومي أو يسبب خطراً كالمصابيح أو المسامير.',
    color: COLORS.secondary,
    bg: '#ECFDF5',
  },
  {
    id: 'medium',
    title: 'متوسط / معالجة خلال 48 ساعة',
    badge: 'خلال 48 ساعة',
    desc: 'يسبب إزعاجاً للسكان أو يؤثر جزئياً على خدمة مشتركة دون تشكيل خطر مباشر.',
    color: COLORS.statusUpcoming,
    bg: '#FFFBEB',
  },
  {
    id: 'high',
    title: 'طارئ وحرج / عطل كامل للمرفق',
    badge: 'فوري ⚠️',
    desc: 'توقف كلي للمصعد، تسريب حاد لمياه الخزان، أو عطل كهربائي يهدد المبنى.',
    color: COLORS.statusUnpaid,
    bg: '#FEF2F2',
  },
];

const TIME_WINDOWS = [
  { id: 'any', label: 'أي وقت (طارئ ومستعجل)' },
  { id: 'morning', label: 'الفترة الصباحية (09:00 ص - 01:00 م)' },
  { id: 'afternoon', label: 'فترة الظهيرة (02:00 م - 06:00 م)' },
  { id: 'evening', label: 'الفترة المسائية (06:00 م - 10:00 م)' },
];

/**
 * Community Hub Screen ("مجتمع العمارة")
 * Strictly combines:
 * - design/stitch_/_14/code.html (التصويت وقرارات الجمعية العمومية)
 * - design/stitch_/_1/code.html (New Maintenance Ticket / تقديم بلاغ صيانة)
 * Features:
 * 1. Building Issues & Upvoting (صوت تأييد واحد لكل شقة) + Status progression (open, in_progress, resolved).
 * 2. Collective Polls & Decisions (صوت واحد لكل شقة) + Quorum progress & transparency.
 */
export const CommunityHubScreen: React.FC = () => {
  const {
    currentBuilding,
    currentRole,
    currentUser,
    buildingIssues,
    polls,
    emergencyClaims,
    payments,
    createBuildingIssue,
    toggleIssueUpvote,
    updateIssueStatus,
    createBuildingPoll,
    castPollVote,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<CommunityTab>('issues');

  // Issues Filter
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
  const [isAddIssueModalOpen, setIsAddIssueModalOpen] = useState(false);
  const [selectedIssueImage, setSelectedIssueImage] = useState<string | null>(null);
  const [selectedIssueDetails, setSelectedIssueDetails] = useState<BuildingIssue | null>(null);

  // New Issue Form State
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueCategory, setIssueCategory] = useState('المصعد');
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('medium');
  const [issueTimeWindow, setIssueTimeWindow] = useState('any');
  const [issueIsPrivate, setIssueIsPrivate] = useState(false);
  const [issueWhatsapp, setIssueWhatsapp] = useState(true);
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Polls State
  const [pollFilter, setPollFilter] = useState<'active' | 'closed'>('active');
  const [selectedPollChoices, setSelectedPollChoices] = useState<Record<string, string>>({});
  const [isCastingVote, setIsCastingVote] = useState<Record<string, boolean>>({});
  const [expandedTransparencyPollId, setExpandedTransparencyPollId] = useState<string | null>(null);
  const [isAddPollModalOpen, setIsAddPollModalOpen] = useState(false);

  // New Poll Form State (Admin)
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollDesc, setNewPollDesc] = useState('');
  const [newPollCategory, setNewPollCategory] = useState('أمني وعقاري');
  const [newPollEstimatedCost, setNewPollEstimatedCost] = useState('');
  const [newPollSharePerUnit, setNewPollSharePerUnit] = useState('');
  const [newPollDurationDays, setNewPollDurationDays] = useState('7');
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);

  // Filtered Issues
  const filteredIssues = useMemo(() => {
    return buildingIssues.filter((issue) => {
      if (issueFilter === 'all') return true;
      return issue.status === issueFilter;
    });
  }, [buildingIssues, issueFilter]);

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

  // Handlers for Issue Creation
  const handlePickIssueImage = async (useCamera = false) => {
    try {
      setIsUploadingImage(true);
      const res = await pickAndCompressUploadImage({
        bucket: 'issue-attachments',
        buildingId: currentBuilding.id || 'bld_general',
        source: useCamera ? 'camera' : 'library',
      });
      if (res?.publicUrl) {
        setIssueImageUrl(res.publicUrl);
      }
    } catch (err: any) {
      Alert.alert('تعذر اختيار الصورة', err?.message || 'حدث خطأ أثناء معالجة الصورة.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveIssue = async () => {
    if (!issueTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان مختصر للبلاغ أو العطل.');
      return;
    }

    try {
      setIsSubmittingIssue(true);
      await createBuildingIssue({
        title: issueTitle.trim(),
        description: issueDescription.trim() || undefined,
        category: issueCategory,
        severity: issueSeverity,
        imageUrl: issueImageUrl,
        isPrivate: issueIsPrivate,
        preferredTime: issueTimeWindow,
        whatsappNotifications: issueWhatsapp,
      });

      Alert.alert('تم إرسال البلاغ بنجاح 🎉', 'تم قيد البلاغ في سجل العمارة وإشعار الإدارة فورياً.');
      setIsAddIssueModalOpen(false);
      setIssueTitle('');
      setIssueDescription('');
      setIssueImageUrl(null);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إرسال البلاغ حالياً.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Handlers for Poll Creation (Admin)
  const handleSavePoll = async () => {
    if (!newPollTitle.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان القرار أو موضوع الاستطلاع.');
      return;
    }

    try {
      setIsSubmittingPoll(true);
      const cost = parseFloat(newPollEstimatedCost) || 0;
      const share = parseFloat(newPollSharePerUnit) || 0;
      const days = parseInt(newPollDurationDays, 10) || 7;

      await createBuildingPoll({
        title: newPollTitle.trim(),
        description: newPollDesc.trim() || undefined,
        category: newPollCategory,
        estimatedCost: cost,
        sharePerUnit: share,
        durationDays: days,
        quorumPercent: 51,
        options: [
          { id: 'approve', title: 'موافق على القرار والعرض المقترح' },
          { id: 'reject', title: 'معترض أو متحفظ على القرار' },
          { id: 'abstain', title: 'ممتنع عن التصويت' },
        ],
      });

      Alert.alert('تم طرح التصويت بنجاح 🗳️', 'تم بث التنبيه لجميع سكان العمارة للمشاركة بأصوات وحداتهم.');
      setIsAddPollModalOpen(false);
      setNewPollTitle('');
      setNewPollDesc('');
      setNewPollEstimatedCost('');
      setNewPollSharePerUnit('');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر طرح التصويت.');
    } finally {
      setIsSubmittingPoll(false);
    }
  };

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
    <View style={styles.container}>
      {/* 1. Header Segmented Tabs (_14/code.html lines 51-66) */}
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

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* TAB 1: BUILDING ISSUES & COMPLAINTS (_1/code.html)                        */}
        {/* ========================================================================= */}
        {activeTab === 'issues' && (
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
        )}

        {/* ========================================================================= */}
        {/* TAB 2: POLLS & DECISIONS (_14/code.html)                                  */}
        {/* ========================================================================= */}
        {activeTab === 'polls' && (
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
        )}

        {/* ========================================================================= */}
        {/* TAB 3: EMERGENCY CAMPAIGNS & REPAIR FUNDS (_27/code.html)                 */}
        {/* ========================================================================= */}
        {activeTab === 'campaigns' && (
          <View style={styles.tabContent}>
            {/* Hero Emergency Status Banner */}
            <View style={styles.emergencyHeroCard}>
              <View style={styles.emergencyHeroTop}>
                <View style={styles.emergencyIconBox}>
                  <MaterialIcons name="construction" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={styles.emergencyHeroChip}>
                    <View style={styles.pingDotRed} />
                    <Text style={styles.emergencyHeroChipText}>صناديق الصيانة الاستثنائية</Text>
                  </View>
                  <Text style={styles.emergencyHeroTitle}>مطالبات الطوارئ الجماعية</Text>
                  <Text style={styles.emergencyHeroSub}>
                    جمع التكاليف الطارئة غير المغطاة بالاشتراك الشهري بنظام الحصص العادلة
                  </Text>
                </View>
              </View>
            </View>

            {/* Emergency Claims Feed */}
            {emergencyClaims.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="verified-user" size={44} color={COLORS.secondary} />
                <Text style={styles.emptyTitle}>لا توجد مطالبات طوارئ نشطة حالياً</Text>
                <Text style={styles.emptySub}>
                  صندوق الطوارئ مستقر ولا توجد أعطال جسيمة تستدعي جمع مساهمات استثنائية.
                </Text>
              </View>
            ) : (
              emergencyClaims.map((claim) => {
                const approvedPayments = payments.filter(
                  (p) => p.emergency_claim_id === claim.id && p.status === 'paid'
                );
                const actualCollected = Math.max(
                  claim.collected_amount,
                  approvedPayments.reduce((acc, p) => acc + p.amount, 0)
                );
                const totalUnits = currentBuilding.total_apartments || 16;
                const pct = Math.min(
                  100,
                  Math.round((actualCollected / Math.max(claim.target_amount, 1)) * 100)
                );
                const isUserPaid = approvedPayments.some(
                  (p) =>
                    p.resident_id === currentUser.id ||
                    p.apartment_number === currentUser.apartment_number
                );
                const userShare =
                  claim.default_share_amount ||
                  Math.round(claim.target_amount / Math.max(totalUnits, 1));

                return (
                  <View key={claim.id} style={styles.claimCard}>
                    <View style={styles.claimHeaderRow}>
                      <View style={styles.claimCategoryBadge}>
                        <MaterialIcons name="handyman" size={14} color={COLORS.error} />
                        <Text style={styles.claimCategoryBadgeText}>{claim.category}</Text>
                      </View>
                      <View
                        style={[
                          styles.claimStatusPill,
                          isUserPaid ? styles.claimStatusPillPaid : styles.claimStatusPillPending,
                        ]}
                      >
                        <MaterialIcons
                          name={isUserPaid ? 'check-circle' : 'pending'}
                          size={13}
                          color={isUserPaid ? COLORS.statusPaid : COLORS.statusPending}
                        />
                        <Text
                          style={[
                            styles.claimStatusPillText,
                            isUserPaid
                              ? styles.claimStatusPillTextPaid
                              : styles.claimStatusPillTextPending,
                          ]}
                        >
                          {isUserPaid ? 'مسددة منكم ✓' : 'مستحقة للسداد'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.claimTitleText}>{claim.title}</Text>
                    {Boolean(claim.description) && (
                      <Text style={styles.claimDescText}>{claim.description}</Text>
                    )}

                    {/* Progress Gauge */}
                    <View style={styles.claimProgressContainer}>
                      <View style={styles.claimProgressLabels}>
                        <Text style={styles.claimProgressVal}>
                          {actualCollected.toLocaleString()} من{' '}
                          {claim.target_amount.toLocaleString()} ج.م
                        </Text>
                        <Text style={styles.claimProgressPct}>{pct}% مكتمل</Text>
                      </View>
                      <View style={styles.claimProgressBarTrack}>
                        <View style={[styles.claimProgressBarFill, { width: `${pct}%` }]} />
                      </View>
                    </View>

                    {/* Share per unit & action */}
                    <View style={styles.claimFooterRow}>
                      <View style={{ alignItems: 'flex-start' }}>
                        <Text style={styles.claimShareLabel}>حصة وحدتكم المقررة</Text>
                        <Text style={styles.claimShareValue}>{userShare.toLocaleString()} ج.م</Text>
                      </View>

                      {!isUserPaid && (
                        <View style={styles.claimActionBadge}>
                          <Text style={styles.claimActionBadgeText}>سداد عبر تطبيق الساكن 💳</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW ISSUE / TICKET (_1/code.html)                            */}
      {/* ========================================================================= */}
      <BottomSheetModal
        visible={isAddIssueModalOpen}
        onClose={() => setIsAddIssueModalOpen(false)}
        title="تقديم بلاغ عطل أو صيانة 🛠️"
      >
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {/* Reporter info pill */}
          <View style={styles.modalReporterPill}>
            <View style={styles.modalReporterApt}>
              <Text style={styles.modalReporterAptText}>
                {currentUser.apartment_number || '302'}
              </Text>
              <Text style={styles.modalReporterAptLabel}>شقة</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.modalReporterName}>
                {currentUser.full_name || 'الساكن المالك'}
              </Text>
              <Text style={styles.modalReporterSub}>
                {currentBuilding.name || 'العقار'}
              </Text>
            </View>
          </View>

          {/* Location Scope / Category Chips Grid */}
          <Text style={styles.fieldLabel}>نطاق ومكان العطل *</Text>
          <View style={styles.categoryChipsGrid}>
            {ISSUE_CATEGORIES.map((cat) => {
              const isSelected = issueCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    isSelected && styles.catChipSelected,
                  ]}
                  onPress={() => setIssueCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={20}
                    color={isSelected ? '#FFFFFF' : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      isSelected && styles.catChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Issue Title Input */}
          <Text style={styles.fieldLabel}>عنوان البلاغ المختصر *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="مثال: توقف مفاجئ في حركة المصعد بالدور الثاني"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={issueTitle}
            onChangeText={setIssueTitle}
            textAlign="right"
          />

          {/* Severity Radio Selection */}
          <Text style={styles.fieldLabel}>مستوى الأهمية وتأثير العطل</Text>
          <View style={styles.severityGroup}>
            {SEVERITY_LEVELS.map((sev) => {
              const isSelected = issueSeverity === sev.id;
              return (
                <TouchableOpacity
                  key={sev.id}
                  style={[
                    styles.sevCard,
                    isSelected && { borderColor: sev.color, backgroundColor: sev.bg },
                  ]}
                  onPress={() => setIssueSeverity(sev.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.sevCardHeader}>
                    <View style={[styles.sevBadge, { backgroundColor: sev.color }]}>
                      <Text style={styles.sevBadgeText}>{sev.badge}</Text>
                    </View>
                    <Text
                      style={[
                        styles.sevCardTitle,
                        isSelected && { color: sev.color },
                      ]}
                    >
                      {sev.title}
                    </Text>
                  </View>
                  <Text style={styles.sevCardDesc}>{sev.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Detailed Description */}
          <Text style={styles.fieldLabel}>تفاصيل العطل والملاحظات</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="وضح أي أصوات غير معتادة، أدوار العطل، أو ملاحظات هامة للفني..."
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={issueDescription}
            onChangeText={setIssueDescription}
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          {/* Photo Documentation (_1/code.html lines 186-236) */}
          <Text style={styles.fieldLabel}>توثيق العطل بالصور (اختياري)</Text>
          <View style={styles.photoActionsRow}>
            <TouchableOpacity
              style={styles.photoActionBtn}
              onPress={() => handlePickIssueImage(true)}
              disabled={isUploadingImage}
            >
              <MaterialIcons name="photo-camera" size={20} color={COLORS.secondary} />
              <Text style={styles.photoActionBtnText}>تصوير بالكاميرا</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoActionBtn}
              onPress={() => handlePickIssueImage(false)}
              disabled={isUploadingImage}
            >
              <MaterialIcons name="add-photo-alternate" size={20} color={COLORS.primary} />
              <Text style={styles.photoActionBtnText}>اختيار من المعرض</Text>
            </TouchableOpacity>
          </View>

          {isUploadingImage && (
            <View style={styles.uploadingBox}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.uploadingText}>جاري ضغط الصورة ومعالجتها (JPEG 60%)...</Text>
            </View>
          )}

          {Boolean(issueImageUrl) && (
            <View style={styles.imagePreviewBox}>
              <Image source={{ uri: issueImageUrl! }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setIssueImageUrl(null)}
              >
                <MaterialIcons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Preferred Time Window Chips */}
          <Text style={styles.fieldLabel}>الوقت المناسب للمعاينة الفنية</Text>
          <View style={styles.timeChipsGrid}>
            {TIME_WINDOWS.map((tw) => {
              const isSelected = issueTimeWindow === tw.id;
              return (
                <TouchableOpacity
                  key={tw.id}
                  style={[
                    styles.timeChip,
                    isSelected && styles.timeChipSelected,
                  ]}
                  onPress={() => setIssueTimeWindow(tw.id)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      isSelected && styles.timeChipTextSelected,
                    ]}
                  >
                    {tw.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Privacy Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.privacyOption,
                !issueIsPrivate && styles.privacyOptionActive,
              ]}
              onPress={() => setIssueIsPrivate(false)}
            >
              <Text
                style={[
                  styles.privacyOptionText,
                  !issueIsPrivate && styles.privacyOptionTextActive,
                ]}
              >
                🌐 عام (يراه السكان ويدعمونه 👍)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.privacyOption,
                issueIsPrivate && styles.privacyOptionActive,
              ]}
              onPress={() => setIssueIsPrivate(true)}
            >
              <Text
                style={[
                  styles.privacyOptionText,
                  issueIsPrivate && styles.privacyOptionTextActive,
                ]}
              >
                🔒 خاص (لرئيس الاتحاد فقط)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.modalSubmitBtn}
            onPress={handleSaveIssue}
            disabled={isSubmittingIssue}
            activeOpacity={0.88}
          >
            {isSubmittingIssue ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.modalSubmitBtnText}>
                  إرسال البلاغ لرئيس الاتحاد وفريق الصيانة
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ========================================================================= */}
      {/* MODAL 2: ADD NEW POLL (Admin only)                                        */}
      {/* ========================================================================= */}
      <BottomSheetModal
        visible={isAddPollModalOpen}
        onClose={() => setIsAddPollModalOpen(false)}
        title="طرح قرار أو تصويت جديد 🗳️"
      >
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>عنوان القرار أو موضوع الاستطلاع *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="مثال: تركيب منظومة كاميرات مراقبة حديثة للمداخل والمصعد"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={newPollTitle}
            onChangeText={setNewPollTitle}
            textAlign="right"
          />

          <Text style={styles.fieldLabel}>تصنيف القرار</Text>
          <TextInput
            style={styles.textInput}
            placeholder="مثال: قرار أمني وعقاري، ترشيد واستهلاك، تطوير الواجهة"
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={newPollCategory}
            onChangeText={setNewPollCategory}
            textAlign="right"
          />

          <View style={styles.twoInputsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>التكلفة التقديرية (ج.م)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="12,000"
                placeholderTextColor={COLORS.onSurfaceVariant}
                keyboardType="numeric"
                value={newPollEstimatedCost}
                onChangeText={setNewPollEstimatedCost}
                textAlign="right"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>حصة الشقة (ج.م)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="750"
                placeholderTextColor={COLORS.onSurfaceVariant}
                keyboardType="numeric"
                value={newPollSharePerUnit}
                onChangeText={setNewPollSharePerUnit}
                textAlign="right"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>مدة التصويت (بالأيام)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="7"
            placeholderTextColor={COLORS.onSurfaceVariant}
            keyboardType="numeric"
            value={newPollDurationDays}
            onChangeText={setNewPollDurationDays}
            textAlign="right"
          />

          <Text style={styles.fieldLabel}>التفاصيل والمواصفات المقترحة</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="توضيح تفاصيل العرض، الشركات المتقدمة، شروط الضمان ومدة التنفيذ..."
            placeholderTextColor={COLORS.onSurfaceVariant}
            value={newPollDesc}
            onChangeText={setNewPollDesc}
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          <TouchableOpacity
            style={styles.modalSubmitBtn}
            onPress={handleSavePoll}
            disabled={isSubmittingPoll}
            activeOpacity={0.88}
          >
            {isSubmittingPoll ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="how-to-vote" size={20} color="#FFFFFF" />
                <Text style={styles.modalSubmitBtnText}>
                  اعتماد وبث التصويت للجمعية العمومية
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheetModal>

      {/* ========================================================================= */}
      {/* MODAL 3: FULL SCREEN IMAGE PREVIEW                                        */}
      {/* ========================================================================= */}
      <Modal visible={Boolean(selectedIssueImage)} transparent animationType="fade">
        <View style={styles.imageModalBackdrop}>
          <TouchableOpacity
            style={styles.imageModalCloseBtn}
            onPress={() => setSelectedIssueImage(null)}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {Boolean(selectedIssueImage) && (
            <Image
              source={{ uri: selectedIssueImage! }}
              style={styles.fullModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: TICKET DETAILS & PROGRESSION TIMELINE (_19/code.html)            */}
      {/* ========================================================================= */}
      <BottomSheetModal
        visible={Boolean(selectedIssueDetails)}
        onClose={() => setSelectedIssueDetails(null)}
        title="متابعة صيانة وبلاغات العقار"
      >
        {selectedIssueDetails && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Header with status */}
            <View style={styles.ticketDetailHeader}>
              <View style={styles.ticketDetailIconBox}>
                <MaterialIcons name="build" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.ticketDetailTitle}>{selectedIssueDetails.title}</Text>
                <View style={styles.ticketDetailLocationRow}>
                  <MaterialIcons name="location-on" size={14} color={COLORS.onSurfaceVariant} />
                  <Text style={styles.ticketDetailLocationText}>
                    {selectedIssueDetails.category} • شقة {selectedIssueDetails.apartment_number || '302'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Reporter & Time meta */}
            <View style={styles.ticketMetaCard}>
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>الساكن المبلغ:</Text>
                <Text style={styles.ticketMetaVal}>
                  {selectedIssueDetails.reporter_name || 'الساكن المالك'}
                </Text>
              </View>
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>درجة الأهمية:</Text>
                <Text
                  style={[
                    styles.ticketMetaVal,
                    {
                      color:
                        selectedIssueDetails.severity === 'high'
                          ? COLORS.statusUnpaid
                          : selectedIssueDetails.severity === 'medium'
                          ? COLORS.statusUpcoming
                          : COLORS.secondary,
                    },
                  ]}
                >
                  {selectedIssueDetails.severity === 'high'
                    ? 'عاجل وحرج ⚠️'
                    : selectedIssueDetails.severity === 'medium'
                    ? 'متوسط'
                    : 'عادي'}
                </Text>
              </View>
            </View>

            {/* Progression Timeline (design/_19/code.html) */}
            <View style={styles.timelineSection}>
              <Text style={styles.timelineSectionTitle}>مسار مراحل تنفيذ البلاغ:</Text>

              {/* Step 1 */}
              <View style={styles.timelineStep}>
                <View style={[styles.timelineNode, styles.timelineNodeDone]}>
                  <MaterialIcons name="check" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>تم استلام البلاغ وقيده في سجل الصيانة</Text>
                  <Text style={styles.timelineStepSub}>إشعار فوري لمجلس إدارة الاتحاد</Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineNode,
                    selectedIssueDetails.status === 'in_progress' ||
                    selectedIssueDetails.status === 'resolved'
                      ? styles.timelineNodeDone
                      : styles.timelineNodePending,
                  ]}
                >
                  <MaterialIcons
                    name={
                      selectedIssueDetails.status === 'in_progress' ||
                      selectedIssueDetails.status === 'resolved'
                        ? 'check'
                        : 'schedule'
                    }
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>
                    جاري الفحص والمعاينة وتكليف الفني المختص
                  </Text>
                  <Text style={styles.timelineStepSub}>
                    {selectedIssueDetails.status === 'in_progress'
                      ? 'تم التواصل مع شركة الصيانة وتحديد موعد الزيارة'
                      : 'بانتظار تكليف الإدارة للفني'}
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.timelineStep}>
                <View
                  style={[
                    styles.timelineNode,
                    selectedIssueDetails.status === 'resolved'
                      ? styles.timelineNodeDone
                      : styles.timelineNodeUpcoming,
                  ]}
                >
                  <MaterialIcons
                    name={selectedIssueDetails.status === 'resolved' ? 'done-all' : 'task-alt'}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStepTitle}>اكتمال الإصلاح واعتماد الحل رسمياً</Text>
                  <Text style={styles.timelineStepSub}>
                    {selectedIssueDetails.status === 'resolved'
                      ? 'تم حل العطل واختبار كفاءة التشغيل بنجاح'
                      : 'يتم الإغلاق بعد الانتهاء والتحقق'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Attached Photo Preview */}
            {selectedIssueDetails.image_url && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.timelineSectionTitle}>صورة العطل المرفقة:</Text>
                <TouchableOpacity
                  onPress={() => setSelectedIssueImage(selectedIssueDetails.image_url!)}
                  style={styles.detailImageContainer}
                >
                  <Image
                    source={{ uri: selectedIssueDetails.image_url }}
                    style={styles.detailFullImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Admin Action Buttons */}
            {currentRole === 'admin' && (
              <View style={styles.modalAdminActionsRow}>
                {selectedIssueDetails.status !== 'in_progress' &&
                  selectedIssueDetails.status !== 'resolved' && (
                    <TouchableOpacity
                      style={[styles.modalActionBtn, { backgroundColor: COLORS.statusUpcoming }]}
                      onPress={async () => {
                        const id = selectedIssueDetails.id;
                        setSelectedIssueDetails(null);
                        await updateIssueStatus(id, 'in_progress');
                      }}
                    >
                      <Text style={styles.modalActionBtnText}>⏳ بدء التنفيذ والفحص</Text>
                    </TouchableOpacity>
                  )}

                {selectedIssueDetails.status !== 'resolved' && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: COLORS.secondary }]}
                    onPress={async () => {
                      const id = selectedIssueDetails.id;
                      setSelectedIssueDetails(null);
                      await updateIssueStatus(id, 'resolved');
                    }}
                  >
                    <Text style={styles.modalActionBtnText}>✅ اعتماد الحل وإغلاق البلاغ</Text>
                  </TouchableOpacity>
                )}

                {selectedIssueDetails.status === 'resolved' && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: COLORS.primary }]}
                    onPress={async () => {
                      const id = selectedIssueDetails.id;
                      setSelectedIssueDetails(null);
                      await updateIssueStatus(id, 'open');
                    }}
                  >
                    <Text style={styles.modalActionBtnText}>🔄 إعادة فتح البلاغ</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceCanvas,
  },
  tabsHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  tabsHeaderScroll: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  mainTab: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#F1F5F9',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainTabActive: {
    backgroundColor: '#091426',
    borderColor: '#091426',
  },
  mainTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mainTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContent: {
    gap: 14,
  },

  // Issues Hero (_1/code.html lines 11-32)
  issuesHero: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  liveTrackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 8,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },
  liveTrackText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  heroSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroStatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  heroCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter scroll
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Add issue trigger card
  addIssueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    gap: 12,
  },
  addIssueIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIssueTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addIssueSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'right',
  },

  // Issue card
  issueCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
  },
  issueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  unitChipNum: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  unitChipName: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  issueStatusBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusOpen: {
    backgroundColor: '#ECFDF5',
  },
  statusOpenText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  statusInProgress: {
    backgroundColor: '#FFF7ED',
  },
  statusInProgressText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '700',
  },
  statusResolved: {
    backgroundColor: '#F0FDF4',
  },
  statusResolvedText: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeText: {
    fontSize: 11,
  },
  issueBody: {
    gap: 6,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  urgentBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.statusUnpaid,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    lineHeight: 22,
  },
  issueDesc: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 20,
  },
  imageThumbnailContainer: {
    marginTop: 6,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 120,
    backgroundColor: COLORS.surfaceContainer,
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 20, 38, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  imageOverlayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  upvoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  upvoteBtnActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  upvoteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  upvoteBtnTextActive: {
    color: '#FFFFFF',
  },
  adminActionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  adminActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  adminActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  adminActionBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  adminActionBtnDoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  // =========================================================================
  // TAB 2: POLLS STYLING (_14/code.html)
  // =========================================================================
  quorumCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  quorumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quorumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  quorumPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },
  quorumBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bldTag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bldTagText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quorumMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quorumPercentText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quorumLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  quorumTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  quorumTrackFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  quorumFooterRow: {
    paddingTop: 6,
  },
  quorumVerifiedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quorumVerifiedText: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  pollSubTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  pollSubTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  pollSubTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pollSubTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  pollSubTabTextActive: {
    color: '#FFFFFF',
  },
  addPollBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
  },
  addPollBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pollCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  pollTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  voteStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voteStatusBadgePending: {
    backgroundColor: '#FFF7ED',
  },
  voteStatusBadgeDone: {
    backgroundColor: '#ECFDF5',
  },
  voteStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  voteStatusBadgeDoneText: {
    color: '#047857',
  },
  pollCategoryText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    lineHeight: 24,
  },
  pollTimerBox: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pollTimerText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  pollSpecsBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  pollSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pollSpecsLabel: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  pollSpecsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pollSpecsHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  pollDescText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 18,
    marginTop: 4,
  },
  optionsGroup: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  optionCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: COLORS.secondary,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRadioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.onSurfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: COLORS.secondary,
  },
  radioInnerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.secondary,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
  },
  optionTitleSelected: {
    color: COLORS.secondary,
    fontWeight: '700',
  },
  optionStatText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  },
  optionTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  optionTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  voteCtaContainer: {
    paddingTop: 6,
    gap: 6,
  },
  voteSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  voteSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voteTrustNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  voteTrustNoteText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  votedFeedbackBox: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  votedFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  votedFeedbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  transparencyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  transparencyToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  transparencyListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  transparencyListTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },
  transparencyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  transparencyOptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  transparencyAptList: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },

  // Empty State
  emptyCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal styling
  modalScroll: {
    maxHeight: 520,
  },
  modalReporterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 10,
    gap: 10,
    marginBottom: 12,
  },
  modalReporterApt: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalReporterAptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalReporterAptLabel: {
    fontSize: 9,
    color: '#E2E8F0',
  },
  modalReporterName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalReporterSub: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    marginTop: 10,
    marginBottom: 6,
  },
  categoryChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  catChipSelected: {
    backgroundColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  catChipTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  twoInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityGroup: {
    gap: 8,
  },
  sevCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  sevCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sevBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sevBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sevCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sevCardDesc: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
    lineHeight: 16,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  photoActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 6,
  },
  uploadingText: {
    fontSize: 11,
    color: COLORS.primary,
  },
  imagePreviewBox: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 120,
    backgroundColor: '#000',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChipsGrid: {
    gap: 6,
  },
  timeChip: {
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  timeChipSelected: {
    backgroundColor: COLORS.primary,
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  timeChipTextSelected: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  privacyOption: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  privacyOptionActive: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.primary,
  },
  privacyOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.onSurfaceVariant,
  },
  privacyOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginTop: 18,
    marginBottom: 20,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Full Screen Image Modal
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalCloseBtn: {
    position: 'absolute',
    top: 48,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fullModalImage: {
    width: '100%',
    height: '80%',
  },
  detailsTicketBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailsTicketBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Emergency Hero & Claims (design/_27)
  emergencyHeroCard: {
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  emergencyHeroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  emergencyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyHeroChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  pingDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.statusUnpaid,
  },
  emergencyHeroChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.errorContainer,
  },
  emergencyHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
    textAlign: 'right',
  },
  emergencyHeroSub: {
    fontSize: 11,
    color: COLORS.onPrimaryContainer,
    marginTop: 2,
    textAlign: 'right',
    lineHeight: 16,
  },
  claimCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    gap: 10,
  },
  claimHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  claimCategoryBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  claimCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.error,
  },
  claimStatusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  claimStatusPillPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  claimStatusPillPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  claimStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  claimStatusPillTextPaid: {
    color: COLORS.statusPaid,
  },
  claimStatusPillTextPending: {
    color: COLORS.statusUpcoming,
  },
  claimTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  claimDescText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    textAlign: 'right',
  },
  claimProgressContainer: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  claimProgressLabels: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimProgressVal: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  claimProgressPct: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  claimProgressBarTrack: {
    height: 7,
    borderRadius: 9999,
    backgroundColor: COLORS.surfaceContainer,
    overflow: 'hidden',
  },
  claimProgressBarFill: {
    height: '100%',
    borderRadius: 9999,
    backgroundColor: COLORS.secondary,
  },
  claimFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 8,
  },
  claimShareLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  claimShareValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  claimActionBadge: {
    backgroundColor: COLORS.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  claimActionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Ticket Detail Modal (_19)
  ticketDetailHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
  },
  ticketDetailIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  ticketDetailLocationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ticketDetailLocationText: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
  },
  ticketMetaCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  ticketMetaItem: {
    alignItems: 'center',
  },
  ticketMetaLabel: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
  },
  ticketMetaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    marginTop: 2,
  },
  timelineSection: {
    marginTop: 12,
    gap: 10,
  },
  timelineSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
    textAlign: 'right',
  },
  timelineStep: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineNodeDone: {
    backgroundColor: COLORS.secondary,
  },
  timelineNodePending: {
    backgroundColor: COLORS.statusUpcoming,
  },
  timelineNodeUpcoming: {
    backgroundColor: COLORS.outlineVariant,
  },
  timelineContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timelineStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  timelineStepSub: {
    fontSize: 10,
    color: COLORS.onSurfaceVariant,
    marginTop: 1,
  },
  detailImageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    height: 180,
    marginTop: 6,
  },
  detailFullImage: {
    width: '100%',
    height: '100%',
  },
  modalAdminActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 14,
    marginBottom: 20,
  },
  modalActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
