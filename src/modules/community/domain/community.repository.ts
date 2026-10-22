import type { RepoResult, RowPatch } from '@/data/result';
import type { BuildingIssue, IssueUpvote, Poll, PollVote } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface CommunityRepository {
  /**
   * Community Hub: Create building issue / complaint
   */
  createBuildingIssue(params: {
    buildingId: string;
    title: string;
    description?: string | null;
    category?: string;
    severity?: string;
    imageUrl?: string | null;
    isPrivate?: boolean;
    preferredTime?: string;
    whatsappNotifications?: boolean;
  }): Promise<RepoResult<any>>;
  /**
   * Community Hub: Toggle issue upvote (1 vote per apartment unit)
   */
  toggleIssueUpvote(issueId: string): Promise<RepoResult<any>>;
  /**
   * Community Hub: Update issue status (open, in_progress, resolved)
   */
  updateIssueStatus(issueId: string, status: string): Promise<RepoResult<any>>;
  /**
   * Community Hub: Create building poll / collective decision
   */
  createBuildingPoll(params: {
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
  }): Promise<RepoResult<any>>;
  /**
   * Community Hub: Cast poll vote (1 vote per apartment unit)
   */
  castPollVote(pollId: string, choice: string): Promise<RepoResult<any>>;

  listIssues(): Promise<RepoResult<BuildingIssue[]>>;
  listUpvotes(): Promise<RepoResult<IssueUpvote[]>>;
  listPolls(): Promise<RepoResult<Poll[]>>;
  listVotes(): Promise<RepoResult<PollVote[]>>;
  insertIssue(row: RowPatch): Promise<RepoResult<null>>;
  updateIssue(id: string, patch: RowPatch): Promise<RepoResult<null>>;
  /** The upvote on an issue by this apartment or this user, if any. */
  findUpvote(issueId: string, apartmentId: string | null, userId: string): Promise<RepoResult<{ id: string }>>;
  insertUpvote(row: RowPatch): Promise<RepoResult<null>>;
  deleteUpvote(id: string): Promise<RepoResult<null>>;
  insertPoll(row: RowPatch): Promise<RepoResult<null>>;
  /** One vote per apartment per poll: re-voting replaces the choice. */
  upsertVote(row: RowPatch): Promise<RepoResult<null>>;
}
