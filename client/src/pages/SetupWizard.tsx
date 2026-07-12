// Engagement Setup Wizard (CC-94, increments 1-3).
//
// /setup            → start a new engagement (Step 1: Details)
// /setup/:engagementId → resume a wizard already in progress
//
// Five steps: Details → Documents → Pillars → Questionnaire → Invite.
// Steps 1-4 are live (Details; Documents with the first upload treated as the
// strategic plan; Pillars proposed by st-extract-pillars and reviewed here;
// the getting-started Questionnaire seeded into Nera's knowledge by
// st-seed-questionnaire). Step 5 is a labelled placeholder that arrives in
// the next increment. The current step is persisted to st_engagement_setup
// on every transition so an admin can close the tab and pick up where they
// left off.
//
// Steps 2+ render inside an EngagementProvider so the existing document
// primitives (DocumentUpload / DocumentList) and vocabulary hooks just work.
//
// Internal-admin only: everyone else gets a polite not-available card.
// Deliberately NOT wired into the CarlorbizOnly host guard — host policy
// for /setup is decided later.

import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { EngagementProvider } from '@/contexts/EngagementContext';
import {
  createEngagementSetup,
  getEngagementSetup,
  updateSetupStep,
  type PillarProposalsPayload,
} from '@/lib/setupApi';
import { SetupDocumentsStep } from '@/components/setup/SetupDocumentsStep';
import { SetupPillarsStep } from '@/components/setup/SetupPillarsStep';
import { SetupQuestionnaireStep } from '@/components/setup/SetupQuestionnaireStep';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

const STEPS = [
  { n: 1, label: 'Details' },
  { n: 2, label: 'Documents' },
  { n: 3, label: 'Pillars' },
  { n: 4, label: 'Questionnaire' },
  { n: 5, label: 'Invite' },
] as const;

const PLACEHOLDER_COPY: Record<number, { title: string; blurb: string }> = {
  5: {
    title: 'Invite',
    blurb:
      "Finally, invite the people whose voices matter. Each person gets their own private conversation with Nera — no logins to remember, just a link.",
  },
};

export default function SetupWizard() {
  const params = useParams<{ engagementId?: string }>();
  const engagementId = params.engagementId ?? null;
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();

  const [step, setStep] = useState(1);
  const [engagementName, setEngagementName] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(engagementId));
  const [loadError, setLoadError] = useState<string | null>(null);
  // st_engagement_setup.pillar_proposals, lifted so Documents (which stashes
  // the strategic plan's document id in it) and Pillars (which reviews the
  // proposals) stay in sync without refetching between steps.
  const [pillarProposals, setPillarProposals] = useState<PillarProposalsPayload | null>(null);

  // Step 1 form
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [sector, setSector] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = isAuthenticated && profile?.role === 'internal_admin';

  // Resume: load the saved wizard state for an existing engagement.
  useEffect(() => {
    if (!engagementId || authLoading || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    getEngagementSetup(engagementId)
      .then(({ engagement, setup }) => {
        if (cancelled) return;
        setEngagementName(engagement.name);
        setPillarProposals(setup?.pillar_proposals ?? null);
        setStep(Math.min(Math.max(setup?.current_step ?? 2, 1), 5));
      })
      .catch(err => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this engagement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId, authLoading, isAdmin]);

  const goToStep = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), 5);
    setStep(clamped);
    if (engagementId) {
      // Persist quietly; a failed save shouldn't interrupt the flow.
      updateSetupStep(engagementId, clamped).catch(() => {
        toast.error("Couldn't save your place — your work is safe, but the wizard may reopen on an earlier step.");
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Give the engagement a name first.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createEngagementSetup({
        name: name.trim(),
        client_name: clientName.trim() || undefined,
        sector: sector.trim() || undefined,
        description: description.trim() || undefined,
      });
      // Move the saved position to step 2 before navigating so the resumed
      // wizard opens on Documents, not Details.
      await updateSetupStep(result.engagement_id, 2).catch(() => undefined);
      toast.success('Engagement created. On to documents.');
      setLocation(`/setup/${result.engagement_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong creating the engagement.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Gates ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>
              This page isn't available
            </CardTitle>
            <CardDescription>
              Setting up a new engagement is something the Carlorbiz team does. If you were
              expecting to see something here, get in touch and we'll sort it out.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/">
              <Button variant="outline">Back to home</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>
              Couldn't open that engagement
            </CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Link href="/setup">
              <Button>Start a new one</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to engagements</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Wizard chrome ──────────────────────────────────────────────────────────

  const placeholder = PLACEHOLDER_COPY[step];

  return (
    <div className="container mx-auto py-12 px-4 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          {engagementName ? `Setting up: ${engagementName}` : 'Set up a new engagement'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Five short steps. Nera does the heavy lifting — you stay in charge of every decision.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 space-y-3">
        <Progress value={((step - 1) / (STEPS.length - 1)) * 100} />
        <ol className="flex justify-between text-sm">
          {STEPS.map(s => (
            <li
              key={s.n}
              className={
                s.n === step
                  ? 'font-semibold text-foreground'
                  : s.n < step
                    ? 'text-foreground/70'
                    : 'text-muted-foreground'
              }
            >
              <span className="hidden sm:inline">{s.n}. </span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <Card>
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>The basics</CardTitle>
              <CardDescription>
                A few details to get started. Everything here can be changed later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="setup-name">What should we call this engagement?</Label>
                <Input
                  id="setup-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Riverside Health 2027 Strategic Plan"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-client">Which organisation is it for?</Label>
                <Input
                  id="setup-client"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="e.g. Riverside Community Health"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-sector">What sector do they work in?</Label>
                <Input
                  id="setup-sector"
                  value={sector}
                  onChange={e => setSector(e.target.value)}
                  placeholder="e.g. community health, aged care, local government"
                />
                <p className="text-xs text-muted-foreground">
                  In their words is fine — this helps Nera speak their language.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-purpose">What's this engagement about?</Label>
                <Textarea
                  id="setup-purpose"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="A sentence or two on what the organisation wants out of this — a new strategic plan, a review, a fresh direction..."
                  rows={4}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create and continue'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step >= 2 && engagementId && (
        <EngagementProvider engagementId={engagementId}>
          {step === 2 && (
            <SetupDocumentsStep
              engagementId={engagementId}
              pillarProposals={pillarProposals}
              onPillarProposalsChange={setPillarProposals}
              onBack={() => goToStep(1)}
              onNext={() => goToStep(3)}
            />
          )}

          {step === 3 && (
            <SetupPillarsStep
              engagementId={engagementId}
              pillarProposals={pillarProposals}
              onPillarProposalsChange={setPillarProposals}
              onBack={() => goToStep(2)}
              onNext={() => goToStep(4)}
            />
          )}

          {step === 4 && (
            <SetupQuestionnaireStep
              engagementId={engagementId}
              onBack={() => goToStep(3)}
              onNext={() => goToStep(5)}
            />
          )}

          {step === 5 && placeholder && (
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>{placeholder.title}</CardTitle>
                <CardDescription>{placeholder.blurb}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This step is built in the next increment — your progress is saved, so it's safe to
                  come back later.
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => goToStep(step - 1)}>
                  Back
                </Button>
                {step < 5 ? (
                  <Button onClick={() => goToStep(step + 1)}>Next</Button>
                ) : (
                  <Link href="/">
                    <Button variant="outline">Save and finish later</Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          )}
        </EngagementProvider>
      )}
    </div>
  );
}
