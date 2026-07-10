// The three seeded, read-only demo engagements. This mirrors the server-side
// single source of truth, the `st_is_demo_engagement()` SQL function (migration
// 0012_demo_public_access.sql). A prospect enters via /demo with an anonymous
// Supabase session and NO engagement role — RLS lets them READ these three (and
// only these), so the app must treat them as viewable without a role.
//
// If the demos are ever re-seeded under new UUIDs, update BOTH this list and the
// `st_is_demo_engagement()` function.
export const DEMO_ENGAGEMENT_IDS = [
  'a1b2c3d4-0001-4000-8000-000000000001', // Acme Catering Group
  'a1b2c3d4-0002-4000-8000-000000000001', // National Allied Health Peak Council
  'a1b2c3d4-0003-4000-8000-000000000001', // Rural Futures Australia
] as const;

/** True if the engagement is one of the public, read-only demos. */
export function isDemoEngagement(id: string | null | undefined): boolean {
  return !!id && (DEMO_ENGAGEMENT_IDS as readonly string[]).includes(id);
}
