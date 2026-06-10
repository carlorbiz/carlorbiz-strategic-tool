import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEngagement } from '@/lib/engagementApi';
import type { Engagement } from '@/types/engagement';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequestAccessDialog } from '@/components/demo/RequestAccessDialog';

// The three seeded, read-only demo engagements (well-known UUIDs from
// supabase/seed/demo/*.sql). Write access to these is blocked at the database
// layer by migration 0012 — a prospect can browse and run the wizard but
// cannot insert, edit, or delete anything.
const DEMO_ENGAGEMENT_IDS = [
  'a1b2c3d4-0001-4000-8000-000000000001', // Acme Catering Group
  'a1b2c3d4-0002-4000-8000-000000000001', // National Allied Health Peak Council
  'a1b2c3d4-0003-4000-8000-000000000001', // Rural Futures Australia
];

/**
 * Public demo entry. A prospect opens this with no account; we mint an
 * anonymous Supabase session (role 'authenticated', is_anonymous=true, no
 * engagement role) so RLS lets them READ the three demos — and only read.
 * Requires "Anonymous sign-ins" enabled in Supabase Auth settings.
 */
export default function DemoEntry() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [demos, setDemos] = useState<Engagement[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mint an anonymous session once auth has settled and we're not signed in.
  useEffect(() => {
    if (authLoading || isAuthenticated || signingIn) return;
    if (!isSupabaseConfigured() || !supabase) {
      setError('This demo is not available right now.');
      setLoadingDemos(false);
      return;
    }
    setSigningIn(true);
    supabase.auth
      .signInAnonymously()
      .then(({ error }) => {
        if (error) {
          // Most common cause: anonymous sign-ins not enabled in Supabase.
          setError(
            'Could not start the demo session. Please try again shortly, or contact Carla.',
          );
          setLoadingDemos(false);
        }
        // On success, AuthContext picks up SIGNED_IN and isAuthenticated flips.
      })
      .catch(() => {
        setError('Could not start the demo session. Please try again shortly.');
        setLoadingDemos(false);
      })
      .finally(() => setSigningIn(false));
  }, [authLoading, isAuthenticated, signingIn]);

  // Once authenticated (anon session live), load the three demos.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    Promise.all(DEMO_ENGAGEMENT_IDS.map(id => fetchEngagement(id).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        setDemos(results.filter((e): e is Engagement => e !== null));
        setLoadingDemos(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to load the demos.');
        setLoadingDemos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive max-w-md text-center px-6">{error}</p>
      </div>
    );
  }

  if (authLoading || loadingDemos || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Preparing your demo…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="mb-8 space-y-3">
        <Badge variant="secondary" className="uppercase tracking-wide">Read-only demo</Badge>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Explore the Carlorbiz Strategic Tool
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          These are three fully worked strategic plans — pick one, take the guided tour, and
          interrogate it the way your own board would. Everything here is a live working plan,
          not a slideshow. You can look at anything; nothing you do changes the data.
        </p>
      </div>

      <div className="grid gap-4">
        {demos.map(eng => (
          <Link key={eng.id} href={`/e/${eng.slug ?? eng.short_code ?? eng.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{eng.name}</CardTitle>
                  <Badge variant="default">Living plan</Badge>
                </div>
                {eng.client_name && <CardDescription>{eng.client_name}</CardDescription>}
              </CardHeader>
              {eng.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{eng.description}</p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg border bg-muted/40 p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Want to go further? We can set you up with a private sandbox — your own editable
          copy of a plan, with more questions for Nera and changes that stick between visits.
        </p>
        <RequestAccessDialog triggerLabel="Request a private sandbox" triggerVariant="outline" />
      </div>
    </div>
  );
}
