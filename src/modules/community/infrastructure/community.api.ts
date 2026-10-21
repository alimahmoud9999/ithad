import { supabase } from '@/shared/lib/supabase';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const communityApi = {
  /**
   * Community Hub: Create building issue / complaint
   */
  async createBuildingIssue(params: {
    buildingId: string;
    title: string;
    description?: string | null;
    category?: string;
    severity?: string;
    imageUrl?: string | null;
    isPrivate?: boolean;
    preferredTime?: string;
    whatsappNotifications?: boolean;
  }) {
    return (supabase.rpc as any)('create_building_issue', {
      p_building_id: params.buildingId,
      p_title: params.title,
      p_description: params.description ?? null,
      p_category: params.category ?? 'المصعد',
      p_severity: params.severity ?? 'medium',
      p_image_url: params.imageUrl ?? null,
      p_is_private: params.isPrivate ?? false,
      p_preferred_time: params.preferredTime ?? 'any',
      p_whatsapp_notifications: params.whatsappNotifications ?? true,
    });
  },

  /**
   * Community Hub: Toggle issue upvote (1 vote per apartment unit)
   */
  async toggleIssueUpvote(issueId: string) {
    return (supabase.rpc as any)('toggle_issue_upvote', {
      p_issue_id: issueId,
    });
  },

  /**
   * Community Hub: Update issue status (open, in_progress, resolved)
   */
  async updateIssueStatus(issueId: string, status: string) {
    return (supabase.rpc as any)('update_issue_status', {
      p_issue_id: issueId,
      p_status: status,
    });
  },

  /**
   * Community Hub: Create building poll / collective decision
   */
  async createBuildingPoll(params: {
    buildingId: string;
    title: string;
    description?: string | null;
    category?: string;
    estimatedCost?: number;
    sharePerUnit?: number;
    quorumPercent?: number;
    durationDays?: number;
    options?: any[];
    documentUrl?: string | null;
    isUrgent?: boolean;
  }) {
    return (supabase.rpc as any)('create_building_poll', {
      p_building_id: params.buildingId,
      p_title: params.title,
      p_description: params.description ?? null,
      p_category: params.category ?? 'عام',
      p_estimated_cost: params.estimatedCost ?? 0,
      p_share_per_unit: params.sharePerUnit ?? 0,
      p_quorum_percent: params.quorumPercent ?? 51,
      p_duration_days: params.durationDays ?? 7,
      p_options: params.options ?? null,
      p_document_url: params.documentUrl ?? null,
      p_is_urgent: params.isUrgent ?? false,
    });
  },

  /**
   * Community Hub: Cast poll vote (1 vote per apartment unit)
   */
  async castPollVote(pollId: string, choice: string) {
    return (supabase.rpc as any)('cast_poll_vote', {
      p_poll_id: pollId,
      p_choice: choice,
    });
  },
};
