import { supabase, toResult } from '@/data/supabase/client';
import type { BuildingIssue, IssueUpvote, Poll, PollVote } from '@/shared/types/database';
import type { CommunityRepository } from '../domain/community.repository';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseCommunityRepository: CommunityRepository = {
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
    return toResult(await (supabase.rpc as any)('create_building_issue', {
      p_building_id: params.buildingId,
      p_title: params.title,
      p_description: params.description ?? null,
      p_category: params.category ?? 'المصعد',
      p_severity: params.severity ?? 'medium',
      p_image_url: params.imageUrl ?? null,
      p_is_private: params.isPrivate ?? false,
      p_preferred_time: params.preferredTime ?? 'any',
      p_whatsapp_notifications: params.whatsappNotifications ?? true,
    }));
  },

  /**
   * Community Hub: Toggle issue upvote (1 vote per apartment unit)
   */
  async toggleIssueUpvote(issueId: string) {
    return toResult(await (supabase.rpc as any)('toggle_issue_upvote', {
      p_issue_id: issueId,
    }));
  },

  /**
   * Community Hub: Update issue status (open, in_progress, resolved)
   */
  async updateIssueStatus(issueId: string, status: string) {
    return toResult(await (supabase.rpc as any)('update_issue_status', {
      p_issue_id: issueId,
      p_status: status,
    }));
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
    return toResult(await (supabase.rpc as any)('create_building_poll', {
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
    }));
  },

  /**
   * Community Hub: Cast poll vote (1 vote per apartment unit)
   */
  async castPollVote(pollId: string, choice: string) {
    return toResult(await (supabase.rpc as any)('cast_poll_vote', {
      p_poll_id: pollId,
      p_choice: choice,
    }));
  },

  async listIssues(buildingId) {
    let query = supabase.from('building_issues').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<BuildingIssue[]>(await query.order('created_at', { ascending: false }));
  },

  async listUpvotes(buildingId) {
    let query = supabase.from('issue_upvotes').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<IssueUpvote[]>(await query);
  },

  async listPolls(buildingId) {
    let query = supabase.from('polls').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<Poll[]>(await query.order('created_at', { ascending: false }));
  },

  async listVotes(buildingId) {
    let query = supabase.from('poll_votes').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<PollVote[]>(await query);
  },

  async insertIssue(row) {
    return toResult<null>(await supabase.from('building_issues').insert(row));
  },

  async updateIssue(id, patch) {
    return toResult<null>(await supabase.from('building_issues').update(patch).eq('id', id));
  },

  async findUpvote(issueId, apartmentId, userId) {
    return toResult<{ id: string }>(
      await supabase
        .from('issue_upvotes')
        .select('id')
        .eq('issue_id', issueId)
        .or(`apartment_id.eq.${apartmentId},user_id.eq.${userId}`)
        .maybeSingle()
    );
  },

  async insertUpvote(row) {
    return toResult<null>(await supabase.from('issue_upvotes').insert(row));
  },

  async deleteUpvote(id) {
    return toResult<null>(await supabase.from('issue_upvotes').delete().eq('id', id));
  },

  async insertPoll(row) {
    return toResult<null>(await supabase.from('polls').insert(row));
  },

  async upsertVote(row) {
    return toResult<null>(await supabase.from('poll_votes').upsert(row, { onConflict: 'poll_id,apartment_id' }));
  },
};
