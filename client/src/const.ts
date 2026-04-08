export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Carlorbiz Strategic Planning Toolkit';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Edge function URLs
export const getEdgeFunctionUrl = (functionName: string) =>
  `${SUPABASE_URL}/functions/v1/${functionName}`;

// Priority labels (exact values)
export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

// SWOT categories
export const SWOT_CATEGORIES = ['strength', 'weakness', 'opportunity', 'threat'] as const;
export type SwotCategory = (typeof SWOT_CATEGORIES)[number];

// Facilitator name
export const FACILITATOR_NAME = 'Carla';
