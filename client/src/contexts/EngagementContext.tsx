import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchEngagement,
  fetchCommitments,
  fetchStages,
  fetchUserRoles,
  fetchAiConfig,
} from '@/lib/engagementApi';
import type {
  Engagement,
  EngagementStage,
  Commitment,
  UserEngagementRole,
  StAiConfig,
} from '@/types/engagement';

interface EngagementContextType {
  engagement: Engagement | null;
  stages: EngagementStage[];
  commitments: Commitment[];
  userRoles: UserEngagementRole[];
  aiConfig: StAiConfig | null;
  isLoading: boolean;
  error: string | null;
  /** The user's primary role_key in this engagement, or null if none */
  activeRoleKey: string | null;
  /** Whether the current user has admin-level permissions in this engagement */
  isEngagementAdmin: boolean;
  /** Re-fetch all engagement data */
  refresh: () => Promise<void>;
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined);

interface EngagementProviderProps {
  engagementId: string;
  children: React.ReactNode;
}

export function EngagementProvider({ engagementId, children }: EngagementProviderProps) {
  const { user, profile } = useAuth();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [stages, setStages] = useState<EngagementStage[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [userRoles, setUserRoles] = useState<UserEngagementRole[]>([]);
  const [aiConfig, setAiConfig] = useState<StAiConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!engagementId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch engagement first (supports both UUID and short_code)
      const eng = await fetchEngagement(engagementId);
      if (!eng) {
        setError('Engagement not found');
        setIsLoading(false);
        return;
      }

      setEngagement(eng);

      // Use the engagement's UUID for all subsequent queries
      const uuid = eng.id;
      const [stg, cmt, cfg] = await Promise.all([
        fetchStages(uuid),
        fetchCommitments(uuid),
        fetchAiConfig(uuid),
      ]);

      setStages(stg);
      setCommitments(cmt);
      setAiConfig(cfg);

      // Fetch user roles if authenticated
      if (user?.id) {
        const roles = await fetchUserRoles(user.id, uuid);
        setUserRoles(roles);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load engagement';
      setError(message);
      console.error('EngagementContext load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [engagementId, user?.id]);

  // Derive the user's active role key
  const activeRoleKey = userRoles.length > 0
    ? (userRoles[0].role?.role_key ?? null)
    : (profile?.role === 'internal_admin' ? 'internal_admin' : null);

  // Admin if internal_admin OR if any engagement role has admin: true
  const isEngagementAdmin =
    profile?.role === 'internal_admin' ||
    userRoles.some(r => r.role?.permissions?.admin === true);

  return (
    <EngagementContext.Provider
      value={{
        engagement,
        stages,
        commitments,
        userRoles,
        aiConfig,
        isLoading,
        error,
        activeRoleKey,
        isEngagementAdmin,
        refresh: loadData,
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}

export function useEngagement() {
  const context = useContext(EngagementContext);
  if (!context) {
    throw new Error('useEngagement must be used within an EngagementProvider');
  }
  return context;
}
