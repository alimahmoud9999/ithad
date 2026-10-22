import type { RepoResult, RowPatch } from '@/data/result';
import type { AppNotification } from '@/shared/types/database';

// Server identity always comes from the session; never pass user ids as params.
export interface NotificationsRepository {
  /**
   * Saves the current user's Expo Push Token in public.users via auth.uid()
   */
  saveUserPushToken(pushToken: string): Promise<RepoResult<any>>;
  /**
   * Marks all unread notifications for the current user (auth.uid()) as read
   */
  markAllNotificationsRead(): Promise<RepoResult<any>>;

  /** Scoped to one building when `buildingId` is given; everything visible otherwise. */
  list(buildingId?: string): Promise<RepoResult<AppNotification[]>>;
  insert(row: RowPatch): Promise<RepoResult<null>>;
}
