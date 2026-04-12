import { useEngagement } from '@/contexts/EngagementContext';
import { DEFAULT_VOCABULARY, type VocabularyMap } from '@/types/engagement';

/**
 * Returns the active vocabulary map for the current engagement.
 * Falls back to DEFAULT_VOCABULARY if no engagement or config is loaded.
 *
 * Usage:
 *   const v = useVocabulary();
 *   <h2>{v.commitment_top_plural}</h2>  // renders "Priorities" (or whatever the admin configured)
 */
export function useVocabulary(): VocabularyMap {
  const { aiConfig } = useEngagement();
  return aiConfig?.vocabulary_map ?? DEFAULT_VOCABULARY;
}
