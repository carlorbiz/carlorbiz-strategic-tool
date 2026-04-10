export type UserRole = 'internal_admin' | 'client_admin' | 'external_stakeholder';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  organization?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthState {
  user: {
    id: string;
    email: string;
  } | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
