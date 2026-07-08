// Admin: provision respondents for a shared elicitation campaign (CC-75).
// Paste emails → each is attached to the ONE shared engagement and given a
// magic link to send. Routed at /admin/campaign behind ProtectedRoute; the
// edge function additionally enforces internal_admin. Reusable for any campaign
// by changing the engagement/role fields — defaults are the Aventine campaign.

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { provisionCampaignRespondent, type CampaignProvisionResult } from '@/lib/campaignApi';

// Aventine campaign defaults (created 2026-07-08). Editable for reuse.
const DEFAULT_ENGAGEMENT_ID = '21d4614b-489b-41b9-8ec6-8cc91f3057a8';
const DEFAULT_ROLE_ID = '6b318eba-fc5f-4907-9664-55bf118a5991';
const DEFAULT_LANDING = '/elicit/aventine-strategic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Row extends CampaignProvisionResult {
  status: 'ok' | 'error';
  error?: string;
}

export default function CampaignProvisionAdmin() {
  const [engagementId, setEngagementId] = useState(DEFAULT_ENGAGEMENT_ID);
  const [roleId, setRoleId] = useState(DEFAULT_ROLE_ID);
  const [landingPath, setLandingPath] = useState(DEFAULT_LANDING);
  const [emailsText, setEmailsText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const parseEmails = (): string[] => {
    const raw = emailsText.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(raw));
  };

  const handleProvision = async () => {
    const emails = parseEmails();
    if (emails.length === 0) { toast.error('Paste at least one email.'); return; }
    const invalid = emails.filter(e => !EMAIL_RE.test(e));
    if (invalid.length) { toast.error(`Invalid email(s): ${invalid.join(', ')}`); return; }
    if (!engagementId.trim() || !roleId.trim()) { toast.error('Engagement ID and Role ID are required.'); return; }

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
          engagement_id: engagementId.trim(),
          role_id: roleId.trim(),
          landing_path: landingPath.trim() || undefined,
        });
        results.push({ ...r, status: 'ok' });
      } catch (e) {
        results.push({ email, user_id: '', magic_link: null, status: 'error', error: e instanceof Error ? e.message : 'Failed' });
      }
      setProgress({ done: i + 1, total: emails.length });
      setRows([...results]);
    }
    setBusy(false);
    const ok = results.filter(r => r.status === 'ok' && r.magic_link).length;
    toast[ok === emails.length ? 'success' : 'warning'](`Provisioned ${ok}/${emails.length}. Copy the links to send.`);
  };

  const copyAll = () => {
    const lines = rows.filter(r => r.magic_link).map(r => `${r.email}\t${r.magic_link}`).join('\n');
    if (!lines) { toast.error('No links to copy yet.'); return; }
    navigator.clipboard.writeText(lines);
    toast.success('All links copied (email <tab> link).');
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
        Campaign respondents
      </h1>
      <p className="text-muted-foreground mb-8">
        Paste the respondent emails. Each is attached to the shared engagement and given a
        personal magic link. Copy the links and send them yourself.
      </p>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaign target</CardTitle>
          <CardDescription>Defaults to the Aventine campaign. Change only to run a different one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Engagement ID</label>
            <Input value={engagementId} onChange={e => setEngagementId(e.target.value)} className="text-xs font-mono" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Role ID</label>
            <Input value={roleId} onChange={e => setRoleId(e.target.value)} className="text-xs font-mono" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Landing path</label>
            <Input value={landingPath} onChange={e => setLandingPath(e.target.value)} className="text-xs font-mono" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Respondent emails</CardTitle>
          <CardDescription>One per line (or comma/space separated). Duplicates are ignored.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-40 rounded-md border border-input bg-background p-3 text-sm font-mono"
            placeholder={"name@example.com\nname2@example.com"}
            value={emailsText}
            onChange={e => setEmailsText(e.target.value)}
            disabled={busy}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleProvision} disabled={busy}>
              {busy ? `Provisioning… ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Provision all'}
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" onClick={copyAll} disabled={busy}>Copy all links</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.email}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.email}</span>
                  <Badge variant={r.status === 'ok' ? 'secondary' : 'outline'}>
                    {r.status === 'ok' ? (r.magic_link ? 'link ready' : 'attached (no link)') : 'error'}
                  </Badge>
                </div>
                {r.magic_link && (
                  <div className="flex gap-2">
                    <Input readOnly value={r.magic_link} className="text-xs" />
                    <Button variant="outline" onClick={() => { navigator.clipboard.writeText(r.magic_link!); toast.success('Copied'); }}>
                      Copy
                    </Button>
                  </div>
                )}
                {r.status === 'error' && <p className="text-xs text-destructive">{r.error}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
