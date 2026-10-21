import { supabase } from '@/shared/lib/supabase';

/**
 * Sign in using user-selected email and password.
 */
export async function authSignIn(email: string, password: string) {
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
  return data;
}

/**
 * Sign up using user-selected email and password with minimum length enforcement.
 */
export async function authSignUp(
  email: string,
  password: string,
  metadata?: { fullName?: string; phone?: string; role?: string }
) {
  if (!email || !password) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }
  if (password.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
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
  return data;
}

/**
 * Sign out from Supabase Auth.
 */
export async function authSignOut() {
  return supabase.auth.signOut();
}
