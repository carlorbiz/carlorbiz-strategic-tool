import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserProfile, UserRole, AuthState } from '@/types/auth';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default dev profile for when Supabase isn't configured
const DEV_PROFILE: UserProfile = {
  id: 'dev-profile',
  user_id: 'dev-user',
  email: 'dev@example.com',
  full_name: 'Dev User',
  role: 'internal_admin',
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no profile exists (PGRST116 = no rows), create one
      if (error.code === 'PGRST116') {
        console.log('No profile found, creating one...');
        const newProfile: Omit<UserProfile, 'id'> = {
          user_id: userId,
          email: email,
          role: 'external_stakeholder', // Default to stakeholder; admins must be set explicitly in DB
          created_at: new Date().toISOString(),
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          // Return a fallback profile so the app still works
          return { ...newProfile, id: userId } as UserProfile;
        }
        return createdProfile as UserProfile;
      }

      console.error('Error fetching profile:', error);
      return null;
    }
    return data as UserProfile;
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Dev mode: auto-login with admin access
      setUser({ id: 'dev-user', email: 'dev@example.com' });
      setProfile(DEV_PROFILE);
      setIsLoading(false);
      return;
    }

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Check current session. Auto-refresh is disabled (lock bypass causes
    // concurrent refresh races), so manually refresh if close to expiry.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Refresh if token expires in < 5 minutes
        if (session.expires_at) {
          const expiresInSec = session.expires_at - Math.floor(Date.now() / 1000);
          if (expiresInSec < 300) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed.session) {
              session = refreshed.session;
            }
          }
        }
        const email = session.user.email || '';
        setUser({ id: session.user.id, email });
        const userProfile = await fetchProfile(session.user.id, email);
        setProfile(userProfile);
      }
      setIsLoading(false);
    }).catch((err) => {
      console.warn('Auth session check failed:', err?.message);
      setIsLoading(false);
    });

    // Listen for auth state changes. With the lock bypass, token refreshes can
    // produce transient null sessions — only react to explicit sign-in/sign-out
    // to prevent incorrectly clearing a valid login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const email = session.user.email || '';
          setUser({ id: session.user.id, email });
          const userProfile = await fetchProfile(session.user.id, email);
          setProfile(userProfile);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          sessionStorage.removeItem('nera_session_id');
        }
        // TOKEN_REFRESHED, INITIAL_SESSION, etc. — intentionally ignored.
        // The lock bypass means these events can fire with null sessions
        // during refresh races. The initial getSession() above handles
        // session restore; sign-in handles new logins.
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Supabase not configured' };
    }

    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Login timed out - please check your connection and try again')), 30000)
        ),
      ]);

      if (result.error) {
        return { error: result.error.message };
      }

      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  };

  const signOut = async () => {
    // Clear all auth state immediately — no server call.
    // supabase.auth.signOut() can hang if the token is expired or the
    // auth server is slow. The server session expires on its own (1 hour).
    // Clearing localStorage is sufficient to prevent re-use.
    sessionStorage.removeItem('nera_session_id');
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
    setUser(null);
    setProfile(null);
  };

  const hasRole = (role: UserRole): boolean => {
    if (!profile) return false;
    return profile.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
