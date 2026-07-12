// Setup Wizard Step 5 — Invite (CC-94, increment 4, final).
//
// Paste the participants' emails; each gets attached to this engagement with
// the participant role (looked up from st_engagement_roles — created by
// st-setup-engagement) and given a personal magic link via the
// st-provision-campaign-user edge function. Provisioning is sequential (kind
// to the auth admin API) with per-row result cards; links are copied and sent
// by hand — the tool never emails anyone.
//
// Invites are OPTIONAL: the NFP flow often preloads the engagement first and
// invites people later, so finishing with zero invites is a first-class path.
//
// "Finish" completes the wizard: completed_at on st_engagement_setup,
// st_engagements.status → 'active' (RLS lets the creating admin do this
// directly), then navigate to the engagement at /e/{slug} (falling back to
// the UUID route — fetchEngagement resolves both).

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { provisionCampaignRespondent, type CampaignProvisionResult } from '@/lib/campaignApi';
import { updateSetupFields } from '@/lib/setupApi';
import { Badge } from '@/components/ui/badge';
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
import { Loader2 } from 'lucide-react';

interface SetupInviteStepProps {
  engagementId: string;
  /** Human-readable engagement slug; null falls back to the UUID route. */
  slug: string | null;
  onBack: () => void;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Row extends CampaignProvisionResult {
  status: 'ok' | 'error';
  error?: string;
}

export function SetupInviteStep({ engagementId, slug, onBack }: SetupInviteStepProps) {
  const [, setLocation] = useLocation();

  // The participant role for THIS engagement (st-setup-engagement created it).
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [emailsText, setEmailsText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Where invited people land — and where the wizard goes on Finish.
  const engagementPath = `/e/${slug ?? engagementId}`;

  useEffect(() => {
    if (!supabase) {
      setRoleError('Supabase not configured');
      return;
    }
    let cancelled = false;
    supabase
      .from('st_engagement_roles')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('role_key', 'participant')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setRoleError(
            "Couldn't find the participant role for this engagement — you can still finish setup and invite people later from the admin console.",
          );
        } else {
          setRoleId(data.id as string);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const parseEmails = (): string[] => {
    const raw = emailsText
      .split(/[\s,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(raw));
  };

  const handleProvision = async () => {
    const emails = parseEmails();
    if (emails.length === 0) {
      toast.error('Paste at least one email first.');
      return;
    }
    const invalid = emails.filter(e => !EMAIL_RE.test(e));
    if (invalid.length) {
      toast.error(`These don't look like emails: ${invalid.join(', ')}`);
      return;
    }
    if (!roleId) {
      toast.error(roleError ?? 'Still looking up the participant role — try again in a moment.');
      return;
    }

    setBusy(true);
    setRows([]);
    setProgress({ done: 0, total: emails.length });
    const results: Row[] = [];
    // Sequential — kind to the auth admin API and easy to read.
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        const r = await provisionCampaignRespondent({
          email,
          engagement_id: engagementId,
          role_id: roleId,
          landing_path: engagementPath,
        });
        results.push({ ...r, status: 'ok' });
      } catch (e) {
        results.push({
          email,
          user_id: '',
          magic_link: null,
          status: 'error',
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
      setProgress({ done: i + 1, total: emails.length });
      setRows([...results]);
    }
    setBusy(false);
    const ok = results.filter(r => r.status === 'ok' && r.magic_link).length;
    if (ok === emails.length) {
      toast.success(`All ${ok} link${ok === 1 ? '' : 's'} ready — copy and send them.`);
    } else {
      toast.warning(`${ok} of ${emails.length} links ready — check the rows below.`);
    }
  };

  const copyAll = () => {
    const lines = rows
      .filter(r => r.magic_link)
      .map(r => `${r.email}\t${r.magic_link}`)
      .join('\n');
    if (!lines) {
      toast.error('No links to copy yet.');
      return;
    }
    navigator.clipboard.writeText(lines);
    toast.success('All links copied (email <tab> link).');
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await updateSetupFields(engagementId, { completed_at: new Date().toISOString() });
      if (!supabase) throw new Error('Supabase not configured');
      const { error } = await supabase
        .from('st_engagements')
        .update({ status: 'active' })
        .eq('id', engagementId);
      if (error) throw error;
      toast.success("Setup complete — the engagement is live. Here's how it looks.");
      setLocation(engagementPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't finish setup — please try again.");
      setFinishing(false);
    }
  };

  const invitedCount = rows.filter(r => r.status === 'ok').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle style={{ fontFamily: 'var(--font-heading)' }}>Invite</CardTitle>
        <CardDescription>
          Invite the people whose input matters — each gets their own private link, no logins to
          remember. You send the links yourself, so nothing goes out until you're ready. Prefer to
          invite people later? Just finish — you can always come back to this from the admin
          console.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-invite-emails">Who should be invited?</Label>
          <textarea
            id="setup-invite-emails"
            className="w-full min-h-32 rounded-md border border-input bg-background p-3 text-sm font-mono"
            placeholder={'name@example.com\nname2@example.com'}
            value={emailsText}
            onChange={e => setEmailsText(e.target.value)}
            disabled={busy || finishing}
          />
          <p className="text-xs text-muted-foreground">
            One per line, or separated by commas — duplicates are ignored.
          </p>
        </div>

        {roleError && rows.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">{roleError}</p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleProvision} disabled={busy || finishing || Boolean(roleError)}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating links… {progress?.done ?? 0}/{progress?.total ?? 0}
              </>
            ) : (
              'Create invite links'
            )}
          </Button>
          {rows.length > 0 && (
            <Button variant="outline" onClick={copyAll} disabled={busy}>
              Copy all links
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            {rows.map(r => (
              <Card
                key={r.email}
                className={
                  r.status === 'ok' && !r.magic_link
                    ? 'border-amber-400 dark:border-amber-600'
                    : undefined
                }
              >
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.email}</span>
                    <Badge variant={r.status === 'ok' ? 'secondary' : 'destructive'}>
                      {r.status === 'ok' ? (r.magic_link ? 'link ready' : 'invited, no link') : 'failed'}
                    </Badge>
                  </div>
                  {r.magic_link && (
                    <div className="flex gap-2">
                      <Input readOnly value={r.magic_link} className="text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(r.magic_link!);
                          toast.success('Copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  )}
                  {r.status === 'ok' && !r.magic_link && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {r.warning ??
                        "They're attached to the engagement, but a sign-in link couldn't be minted — mint one later from the admin console."}
                    </p>
                  )}
                  {r.status === 'error' && <p className="text-xs text-destructive">{r.error}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy || finishing}>
          Back
        </Button>
        <Button onClick={handleFinish} disabled={busy || finishing}>
          {finishing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finishing…
            </>
          ) : invitedCount > 0 ? (
            'Finish setup'
          ) : (
            'Finish without inviting'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
