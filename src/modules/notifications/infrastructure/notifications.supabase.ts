import { supabase, toResult } from '@/data/supabase/client';
import type { AppNotification } from '@/shared/types/database';
import type { NotificationsRepository } from '../domain/notifications.repository';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const supabaseNotificationsRepository: NotificationsRepository = {
  /**
   * Saves the current user's Expo Push Token in public.users via auth.uid()
   */
  async saveUserPushToken(pushToken: string) {
    return toResult(await supabase.rpc('save_user_push_token', {
      p_push_token: pushToken,
    }));
  },

  /**
   * Marks all unread notifications for the current user (auth.uid()) as read
   */
  async markAllNotificationsRead() {
    return toResult(await (supabase.rpc as any)('mark_all_notifications_read'));
  },

  async list() {
    return toResult<AppNotification[]>(await supabase.from('notifications').select('*').order('created_at', { ascending: false }));
  },

  async insert(row) {
    return toResult<null>(await supabase.from('notifications').insert(row));
  },
};
