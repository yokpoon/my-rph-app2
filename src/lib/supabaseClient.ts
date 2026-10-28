import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://')
);

// Create Supabase client singleton
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as SupabaseClient);

/**
 * Trigger Google OAuth sign-in via Supabase
 */
export async function signInWithGoogleOAuth() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase URL atau Anon Key belum dikonfigurasi dalam persekitaran (Environment Variables).');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
      queryParams: {
        hd: 'moe-dl.edu.my', // Prioritize MOE DELIMa Google Workspace domain
        prompt: 'select_account',
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Perform sign out via Supabase
 */
export async function signOutFromSupabase() {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
  }
}
