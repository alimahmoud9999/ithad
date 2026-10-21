import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { BuildingIssue } from '@/shared/types/database';
import { styles } from './CommunityHubScreen.styles';
import type { CommunityTab } from '../domain/community.types';
import { IssueDetailsSheet } from './components/IssueDetailsSheet';
import { IssueImagePreview } from './components/IssueImagePreview';
import { AddPollSheet } from './components/AddPollSheet';
import { AddIssueSheet } from './components/AddIssueSheet';
import { CampaignsTab } from './components/CampaignsTab';
import { PollsTab } from './components/PollsTab';
import { IssuesTab } from './components/IssuesTab';
import { CommunityTabsHeader } from './components/CommunityTabsHeader';

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
  const [activeTab, setActiveTab] = useState<CommunityTab>('issues');

  const [isAddIssueModalOpen, setIsAddIssueModalOpen] = useState(false);
  const [selectedIssueImage, setSelectedIssueImage] = useState<string | null>(null);
  const [selectedIssueDetails, setSelectedIssueDetails] = useState<BuildingIssue | null>(null);

  const [isAddPollModalOpen, setIsAddPollModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      {/* 1. Header Segmented Tabs (_14/code.html lines 51-66) */}
      <CommunityTabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* TAB 1: BUILDING ISSUES & COMPLAINTS (_1/code.html)                        */}
        {/* ========================================================================= */}
        <IssuesTab
          activeTab={activeTab}
          setIsAddIssueModalOpen={setIsAddIssueModalOpen}
          setSelectedIssueImage={setSelectedIssueImage}
          setSelectedIssueDetails={setSelectedIssueDetails}
        />

        {/* ========================================================================= */}
        {/* TAB 2: POLLS & DECISIONS (_14/code.html)                                  */}
        {/* ========================================================================= */}
        <PollsTab activeTab={activeTab} setIsAddPollModalOpen={setIsAddPollModalOpen} />

        {/* ========================================================================= */}
        {/* TAB 3: EMERGENCY CAMPAIGNS & REPAIR FUNDS (_27/code.html)                 */}
        {/* ========================================================================= */}
        <CampaignsTab activeTab={activeTab} />
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW ISSUE / TICKET (_1/code.html)                            */}
      {/* ========================================================================= */}
      <AddIssueSheet
        isAddIssueModalOpen={isAddIssueModalOpen}
        setIsAddIssueModalOpen={setIsAddIssueModalOpen}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: ADD NEW POLL (Admin only)                                        */}
      {/* ========================================================================= */}
      <AddPollSheet
        isAddPollModalOpen={isAddPollModalOpen}
        setIsAddPollModalOpen={setIsAddPollModalOpen}
      />

      {/* ========================================================================= */}
      {/* MODAL 3: FULL SCREEN IMAGE PREVIEW                                        */}
      {/* ========================================================================= */}
      <IssueImagePreview
        selectedIssueImage={selectedIssueImage}
        setSelectedIssueImage={setSelectedIssueImage}
      />

      {/* ========================================================================= */}
      {/* MODAL 4: TICKET DETAILS & PROGRESSION TIMELINE (_19/code.html)            */}
      {/* ========================================================================= */}
      <IssueDetailsSheet
        setSelectedIssueImage={setSelectedIssueImage}
        selectedIssueDetails={selectedIssueDetails}
        setSelectedIssueDetails={setSelectedIssueDetails}
      />
    </View>
  );
};

