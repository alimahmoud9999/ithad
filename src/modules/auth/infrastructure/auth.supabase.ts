import { ensureSupabaseSession, supabase, toResult } from '@/data/supabase/client';
import type { UserProfile } from '@/shared/types/database';
import type { AuthRepository } from '../domain/auth.repository';

export const supabaseAuthRepository: AuthRepository = {
  async signIn(email, password) {
    if (!email || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول.');
      }
      throw new Error(error.message);
    }
    return { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null };
  },

  async signUp(email, password, metadata) {
    if (!email || !password) {
      throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    }
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          phone: metadata?.phone || '',
          role: metadata?.role || 'resident',
        },
      },
    });
    if (error) {
      if (error.message.includes('User already registered')) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل، يرجى تسجيل الدخول.');
      }
      throw new Error(error.message);
    }
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getSessionUser() {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    return user ? { id: user.id, email: user.email ?? null } : null;
  },

  ensureSession: ensureSupabaseSession,

  async getUserProfile(userId) {
    return toResult<UserProfile>(await supabase.from('users').select('*').eq('id', userId).maybeSingle());
  },

  async listUserProfiles(buildingId) {
    let query = supabase.from('users').select('*');
    if (buildingId) query = query.eq('building_id', buildingId);
    return toResult<UserProfile[]>(await query);
  },
};
