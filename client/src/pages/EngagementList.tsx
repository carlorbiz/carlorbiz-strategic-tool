import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEngagements } from '@/lib/engagementApi';
import type { Engagement, EngagementStatus } from '@/types/engagement';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EngagementAdminActions from '@/components/engagement/EngagementAdminActions';

const STATUS_BADGE: Record<EngagementStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  active: { label: 'Active', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'secondary' },
  living: { label: 'Living', variant: 'default' },
  archived: { label: 'Archived', variant: 'outline' },
};

export default function EngagementList() {
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEngagements = useCallback(() => {
    fetchEngagements()
      .then(setEngagements)
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    loadEngagements();
  }, [authLoading, isAuthenticated, loadEngagements]);

  const isAdmin = profile?.role === 'internal_admin';

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading engagements...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Strategic Tool
          </h1>
          <p className="text-muted-foreground">Sign in to access your engagements.</p>
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (engagements.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            No engagements yet
          </h1>
          <p className="text-muted-foreground">
            {profile?.role === 'internal_admin'
              ? 'Create your first engagement to get started.'
              : "You haven't been invited to any engagements yet."}
          </p>
          {profile?.role === 'internal_admin' && (
            <Link href="/setup">
              <Button>New engagement</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Engagements
        </h1>
        {profile?.role === 'internal_admin' && (
          <Link href="/setup">
            <Button>New engagement</Button>
          </Link>
        )}
      </div>
      <div className="grid gap-4">
        {engagements.map(eng => {
          const badge = STATUS_BADGE[eng.status];
          return (
            <Link key={eng.id} href={`/e/${eng.short_code}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{eng.name}</CardTitle>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <EngagementAdminActions
                          engagementId={eng.id}
                          engagementName={eng.name}
                          onDone={loadEngagements}
                        />
                      )}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  </div>
                  {eng.client_name && (
                    <CardDescription>{eng.client_name}</CardDescription>
                  )}
                </CardHeader>
                {eng.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {eng.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
