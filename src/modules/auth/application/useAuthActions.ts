import { useCallback } from 'react';
import type { UserRole } from '@/shared/types/database';
import { authSignIn, authSignOut, authSignUp } from '../infrastructure/auth.api';
import { isSupabaseConfigured, supabase } from '@/shared/lib/supabase';
import type { StoreCore } from '@/store/AppContext.types';

type Deps = Pick<
  StoreCore,
  | 'setCurrentRole'
  | 'setNotifications'
  | 'usersByRole'
  | 'setActiveBannerNotification'
  | 'setAuthenticated'
  | 'setUsersByRole'
  | 'loadDataFromSupabase'
>;

export function useAuthActions({
  setCurrentRole,
  setNotifications,
  usersByRole,
  setActiveBannerNotification,
  setAuthenticated,
  setUsersByRole,
  loadDataFromSupabase,
}: Deps) {
  const switchRole = useCallback(
    (role: UserRole) => {
      if (typeof __DEV__ !== 'undefined' && !__DEV__) {
        console.warn('Switching roles is disabled in production. Role must be derived from database session.');
        return;
      }
      console.warn('[DEV ONLY] switchRole called in development mode. In production, role is derived exclusively from server authentication.');
      setCurrentRole(role);
      setNotifications((prev) => {
        const unreadForRole = prev.find((n) => {
          if (n.is_read) return false;
          if (role === 'resident') {
            const isTargetResident =
              n.recipient_role === 'resident' ||
              n.recipient_id === usersByRole.resident.id ||
              (Boolean(n.metadata?.apartment_number) &&
                Boolean(usersByRole.resident.apartment_number) &&
                String(n.metadata?.apartment_number).trim() ===
                  String(usersByRole.resident.apartment_number).trim());
            return isTargetResident && n.category !== 'join_request';
          }
          if (role === 'admin') {
            return (
              n.recipient_role === 'admin' ||
              n.recipient_id === usersByRole.admin.id ||
              n.category === 'join_request'
            );
          }
          return false;
        });
        if (unreadForRole) {
          setActiveBannerNotification(unreadForRole);
        } else {
          setActiveBannerNotification(null);
        }
        return prev;
      });
    },
    [usersByRole.admin.id, usersByRole.resident.apartment_number, usersByRole.resident.id]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        setAuthenticated(true);
        return;
      }
      const data = await authSignIn(email, password);
      const userId = data?.user?.id;
      if (!userId) {
        throw new Error('فشل تسجيل الدخول.');
      }

      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!dbUser) {
        throw new Error('حسابك غير مسجل في قاعدة البيانات، يرجى إتمام التسجيل أولاً.');
      }

      // Role strictly from DB!
      setCurrentRole(dbUser.role);
      setUsersByRole((prev) => ({ ...prev, [dbUser.role]: dbUser }));
      setAuthenticated(true);
      await loadDataFromSupabase();
    },
    [loadDataFromSupabase]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { fullName?: string; phone?: string; role?: 'admin' | 'resident' }
    ) => {
      if (!isSupabaseConfigured) {
        setAuthenticated(true);
        return;
      }
      await authSignUp(email, password, metadata);
    },
    []
  );

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await authSignOut();
    }
    setAuthenticated(false);
  }, []);

  return { switchRole, login, signup, logout };
}
