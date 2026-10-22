import { useCallback } from 'react';
import type { BuildingIssue, IssueSeverity, IssueStatus, Poll, PollOption, PollVote } from '@/shared/types/database';
import { isRemoteBackendEnabled } from '@/data/backend';
import type { StoreCore } from '@/store/AppContext.types';
import { repositories } from '@/data/repositories';

type Deps = Pick<
  StoreCore,
  | 'currentRole'
  | 'usersByRole'
  | 'currentBuilding'
  | 'setBuildingIssues'
  | 'loadDataFromSupabase'
  | 'setPolls'
  | 'setPollVotes'
>;

export function useCommunityActions({
  currentRole,
  usersByRole,
  currentBuilding,
  setBuildingIssues,
  loadDataFromSupabase,
  setPolls,
  setPollVotes,
}: Deps) {
  // 15. Create Building Issue / Complaint (Resident or Admin)
  const createBuildingIssue = useCallback(
    async (input: {
      title: string;
      description?: string;
      category: string;
      severity?: IssueSeverity;
      imageUrl?: string | null;
      isPrivate?: boolean;
      preferredTime?: string;
      whatsappNotifications?: boolean;
    }) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const bId = currentBuilding.id || user.building_id;
      if (!bId) {
        throw new Error('لم يتم تحديد عقار أو عمارة سكنية بعد.');
      }

      const tempIssue: BuildingIssue = {
        id: 'issue-' + Date.now(),
        building_id: bId,
        created_by: user.id,
        apartment_id: user.apartment_id,
        apartment_number: user.apartment_number || '1',
        reporter_name: user.full_name || (currentRole === 'admin' ? 'رئيس الاتحاد' : 'الساكن'),
        title: input.title.trim(),
        description: input.description?.trim(),
        category: input.category || 'المصعد',
        severity: input.severity || 'medium',
        image_url: input.imageUrl || null,
        is_private: input.isPrivate || false,
        upvotes_count: 0,
        status: 'open',
        preferred_time: input.preferredTime || 'any',
        whatsapp_notifications: input.whatsappNotifications ?? true,
        has_upvoted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setBuildingIssues((prev) => [tempIssue, ...prev]);

      if (isRemoteBackendEnabled) {
        try {
          await repositories.auth.ensureSession();
          const rpcRes = await repositories.community.createBuildingIssue({
            buildingId: bId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            category: input.category || 'المصعد',
            severity: input.severity || 'medium',
            imageUrl: input.imageUrl || null,
            isPrivate: input.isPrivate || false,
            preferredTime: input.preferredTime || 'any',
            whatsappNotifications: input.whatsappNotifications ?? true,
          });

          if (!rpcRes.data && rpcRes.error) {
            await repositories.community.insertIssue({
              building_id: bId,
              created_by: user.id,
              apartment_id: user.apartment_id,
              apartment_number: user.apartment_number || '1',
              reporter_name: user.full_name || 'الساكن',
              title: input.title.trim(),
              description: input.description?.trim() || null,
              category: input.category || 'المصعد',
              severity: input.severity || 'medium',
              image_url: input.imageUrl || null,
              is_private: input.isPrivate || false,
              preferred_time: input.preferredTime || 'any',
              whatsapp_notifications: input.whatsappNotifications ?? true,
              status: 'open',
            });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('createBuildingIssue cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  // 16. Toggle Issue Upvote (صوت تأييد واحد لكل شقة)
  const toggleIssueUpvote = useCallback(
    async (issueId: string) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const aptNum = user.apartment_number || '1';
      const aptId = user.apartment_id || user.id;

      // Optimistic update
      setBuildingIssues((prev) =>
        prev.map((iss) => {
          if (iss.id !== issueId) return iss;
          const isNowUpvoted = !iss.has_upvoted;
          return {
            ...iss,
            has_upvoted: isNowUpvoted,
            upvotes_count: isNowUpvoted
              ? iss.upvotes_count + 1
              : Math.max(0, iss.upvotes_count - 1),
          };
        })
      );

      if (isRemoteBackendEnabled) {
        try {
          await repositories.auth.ensureSession();
          const rpcRes = await repositories.community.toggleIssueUpvote(issueId);

          if (!rpcRes.data && rpcRes.error) {
            const { data: existing } = await repositories.community.findUpvote(issueId, aptId, user.id);

            if (existing) {
              await repositories.community.deleteUpvote(existing.id);
            } else {
              await repositories.community.insertUpvote({
                issue_id: issueId,
                building_id: currentBuilding.id || user.building_id,
                apartment_id: aptId,
                apartment_number: aptNum,
                user_id: user.id,
              });
            }
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('toggleIssueUpvote cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  // 17. Update Issue Status (Admin only: open -> in_progress -> resolved)
  const updateIssueStatus = useCallback(
    async (issueId: string, status: IssueStatus) => {
      setBuildingIssues((prev) =>
        prev.map((iss) => {
          if (iss.id !== issueId) return iss;
          return {
            ...iss,
            status,
            resolved_at: status === 'resolved' ? new Date().toISOString() : null,
          };
        })
      );

      if (isRemoteBackendEnabled) {
        try {
          await repositories.auth.ensureSession();
          const rpcRes = await repositories.community.updateIssueStatus(issueId, status);

          if (!rpcRes.data && rpcRes.error) {
            await repositories.community.updateIssue(issueId, {
                status,
                resolved_at: status === 'resolved' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('updateIssueStatus cloud err:', e);
        }
      }
    },
    [loadDataFromSupabase]
  );

  // 18. Create Building Poll / Collective Decision (Admin only)
  const createBuildingPoll = useCallback(
    async (input: {
      title: string;
      description?: string;
      category?: string;
      estimatedCost?: number;
      sharePerUnit?: number;
      quorumPercent?: number;
      durationDays?: number;
      options?: PollOption[];
      documentUrl?: string;
      isUrgent?: boolean;
    }) => {
      const bId = currentBuilding.id || usersByRole.admin.building_id;
      if (!bId) throw new Error('لم يتم تحديد عقار أو عمارة سكنية بعد.');

      const opts: PollOption[] =
        input.options && input.options.length > 0
          ? input.options
          : [
              { id: 'approve', title: 'موافق على القرار المقترح' },
              { id: 'reject', title: 'رافض أو متحفظ على البند' },
              { id: 'abstain', title: 'ممتنع عن التصويت' },
            ];

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + (input.durationDays || 7));

      const tempPoll: Poll = {
        id: 'poll-' + Date.now(),
        building_id: bId,
        created_by: usersByRole.admin.id,
        session_code: '#24-DEC-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        title: input.title.trim(),
        description: input.description?.trim(),
        category: input.category || 'عام',
        estimated_cost: input.estimatedCost || 0,
        share_per_unit: input.sharePerUnit || 0,
        document_url: input.documentUrl,
        quorum_percent: input.quorumPercent || 51,
        voting_basis: 'ownership_share',
        ends_at: endsAt.toISOString(),
        status: 'active',
        options: opts,
        votes_count: 0,
        is_urgent: input.isUrgent || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setPolls((prev) => [tempPoll, ...prev]);

      if (isRemoteBackendEnabled) {
        try {
          await repositories.auth.ensureSession();
          const rpcRes = await repositories.community.createBuildingPoll({
            buildingId: bId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            category: input.category || 'عام',
            estimatedCost: input.estimatedCost || 0,
            sharePerUnit: input.sharePerUnit || 0,
            quorumPercent: input.quorumPercent || 51,
            durationDays: input.durationDays || 7,
            options: opts,
            documentUrl: input.documentUrl || null,
            isUrgent: input.isUrgent || false,
          });

          if (!rpcRes.data && rpcRes.error) {
            await repositories.community.insertPoll({
              building_id: bId,
              created_by: usersByRole.admin.id,
              session_code: tempPoll.session_code,
              title: input.title.trim(),
              description: input.description?.trim() || null,
              category: input.category || 'عام',
              estimated_cost: input.estimatedCost || 0,
              share_per_unit: input.sharePerUnit || 0,
              quorum_percent: input.quorumPercent || 51,
              ends_at: endsAt.toISOString(),
              options: opts,
              document_url: input.documentUrl || null,
              is_urgent: input.isUrgent || false,
              status: 'active',
            });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('createBuildingPoll cloud err:', e);
        }
      }
    },
    [currentBuilding.id, loadDataFromSupabase, usersByRole.admin]
  );

  // 19. Cast Poll Vote (1 vote per apartment unit)
  const castPollVote = useCallback(
    async (pollId: string, choice: string) => {
      const user = currentRole === 'admin' ? usersByRole.admin : usersByRole.resident;
      const aptNum = user.apartment_number || '1';
      const aptId = user.apartment_id || user.id;

      const newVote: PollVote = {
        id: 'vote-' + Date.now(),
        poll_id: pollId,
        building_id: currentBuilding.id || user.building_id || '',
        apartment_id: aptId,
        apartment_number: aptNum,
        voter_id: user.id,
        voter_name: user.full_name || 'الساكن',
        choice,
        weight_percent: 6.25,
        created_at: new Date().toISOString(),
      };

      setPollVotes((prev) => {
        const filtered = prev.filter(
          (v) =>
            !(
              v.poll_id === pollId &&
              (v.apartment_id === aptId || v.apartment_number === aptNum)
            )
        );
        return [newVote, ...filtered];
      });

      setPolls((prev) =>
        prev.map((p) => {
          if (p.id !== pollId) return p;
          const wasVoted = Boolean(p.user_voted_choice);
          return {
            ...p,
            user_voted_choice: choice,
            votes_count: wasVoted ? p.votes_count : (p.votes_count || 0) + 1,
          };
        })
      );

      if (isRemoteBackendEnabled) {
        try {
          await repositories.auth.ensureSession();
          const rpcRes = await repositories.community.castPollVote(pollId, choice);

          if (!rpcRes.data && rpcRes.error) {
            await repositories.community.upsertVote({
                poll_id: pollId,
                building_id: currentBuilding.id || user.building_id,
                apartment_id: aptId,
                apartment_number: aptNum,
                voter_id: user.id,
                voter_name: user.full_name || 'الساكن',
                choice,
              });
          }
          await loadDataFromSupabase();
        } catch (e) {
          console.warn('castPollVote cloud err:', e);
        }
      }
    },
    [currentBuilding.id, currentRole, loadDataFromSupabase, usersByRole]
  );

  return {
    createBuildingIssue,
    toggleIssueUpvote,
    updateIssueStatus,
    createBuildingPoll,
    castPollVote,
  };
}
