export type UserRole =
  | 'internal_admin'
  | 'client_admin'
  | 'facilitator'
  | 'board_member'
  | 'external_stakeholder';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  organisation: string | null;
  created_at: string;
  updated_at: string;
}

export const ADMIN_ROLES: UserRole[] = ['internal_admin', 'client_admin'];
export const FACILITATOR_ROLES: UserRole[] = ['internal_admin', 'client_admin', 'facilitator'];
