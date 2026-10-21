import { supabase } from '@/shared/lib/supabase';

// Server identity always comes from auth.uid(); never pass user ids as params.
export const notificationsApi = {
  /**
   * Saves the current user's Expo Push Token in public.users via auth.uid()
   */
  async saveUserPushToken(pushToken: string) {
    return supabase.rpc('save_user_push_token', {
      p_push_token: pushToken,
    });
  },

  /**
   * Marks all unread notifications for the current user (auth.uid()) as read
   */
  async markAllNotificationsRead() {
    return (supabase.rpc as any)('mark_all_notifications_read');
  },
};
