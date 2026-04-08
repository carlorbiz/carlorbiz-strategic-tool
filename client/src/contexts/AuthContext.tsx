import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@shared/types';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  signInWithEmail: async () => ({}),
  signInWithMagicLink: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) return data as UserProfile;

    // Auto-create profile for new users
    const newProfile: Partial<UserProfile> = {
      user_id: userId,
      email: email || '',
      role: 'external_stakeholder' as UserRole,
    };
    const { data: created } = await supabase
      .from('user_profiles')
      .insert(newProfile)
      .select()
      .single();
    return created as UserProfile | null;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      // Dev mode: auto-admin when Supabase not configured
      setUser({
        id: 'dev-admin',
        user_id: 'dev-admin',
        email: 'admin@dev.local',
        full_name: 'Dev Admin',
        role: 'internal_admin',
        created_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email);
        setUser(profile);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email);
        setUser(profile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signInWithMagicLink = async (email: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin = user?.role === 'internal_admin' || user?.role === 'client_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        signInWithEmail,
        signInWithMagicLink,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
