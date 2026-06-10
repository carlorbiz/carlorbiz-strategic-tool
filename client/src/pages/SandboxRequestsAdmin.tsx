// Admin: triage Tier-2 extended-access requests. Approve → provisions a private
// sandbox (clones the chosen demo) and returns a magic link to send the prospect.
// Routed at /admin/sandbox behind ProtectedRoute (admin only). The provisioning
// edge function additionally enforces internal_admin.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  fetchSandboxRequests,
  provisionSandbox,
  rejectSandboxRequest,
  type SandboxRequest,
} from '@/lib/sandboxApi';

const DEMOS: { id: string; label: string }[] = [
  { id: 'a1b2c3d4-0001-4000-8000-000000000001', label: 'Acme Catering Group' },
  { id: 'a1b2c3d4-0002-4000-8000-000000000001', label: 'National Allied Health Peak Council' },
  { id: 'a1b2c3d4-0003-4000-8000-000000000001', label: 'Rural Futures Australia' },
];

function demoLabel(id: string | null): string {
  return DEMOS.find((d) => d.id === id)?.label ?? '—';
}

export default function SandboxRequestsAdmin() {
  const [requests, setRequests] = useState<SandboxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickedDemo, setPickedDemo] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    fetchSandboxRequests()
      .then(setRequests)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApprove = async (req: SandboxRequest) => {
    const demoId = pickedDemo[req.id] || req.demo_engagement_id || DEMOS[0].id;
    setBusyId(req.id);
    try {
      const result = await provisionSandbox({
        email: req.email,
        demo_engagement_id: demoId,
        full_name: req.full_name ?? undefined,
        organisation: req.organisation ?? undefined,
        request_id: req.id,
      });
      if (result.magic_link) {
        setLinks((prev) => ({ ...prev, [req.id]: result.magic_link! }));
        toast.success('Sandbox created — copy the magic link to send.');
      } else {
        toast.warning(result.warning ?? 'Sandbox created, but no magic link was returned.');
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: SandboxRequest) => {
    setBusyId(req.id);
    try {
      await rejectSandboxRequest(req.id);
      toast.success('Request rejected.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reject.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading requests…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
        Sandbox requests
      </h1>
      <p className="text-muted-foreground mb-8">
        Prospects who asked for extended access. Approve to create their private sandbox and
        generate a magic link.
      </p>

      {requests.length === 0 && (
        <p className="text-muted-foreground">No requests yet.</p>
      )}

      <div className="space-y-4">
        {requests.map((req) => {
          const statusVariant =
            req.status === 'pending' ? 'default' : req.status === 'approved' ? 'secondary' : 'outline';
          const isPending = req.status === 'pending';
          return (
            <Card key={req.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{req.email}</CardTitle>
                  <Badge variant={statusVariant}>{req.status}</Badge>
                </div>
                <CardDescription>
                  {req.full_name ? `${req.full_name} · ` : ''}
                  {req.organisation ?? 'Unknown org'} · requested {new Date(req.requested_at).toLocaleDateString()}
                  {req.demo_engagement_id ? ` · viewing ${demoLabel(req.demo_engagement_id)}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {req.message && (
                  <p className="text-sm text-muted-foreground italic">"{req.message}"</p>
                )}

                {links[req.id] && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Magic link (send to prospect):</p>
                    <div className="flex gap-2">
                      <Input readOnly value={links[req.id]} className="text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(links[req.id]);
                          toast.success('Copied');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}

                {isPending && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={pickedDemo[req.id] || req.demo_engagement_id || DEMOS[0].id}
                      onChange={(e) =>
                        setPickedDemo((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                    >
                      {DEMOS.map((d) => (
                        <option key={d.id} value={d.id}>
                          Clone: {d.label}
                        </option>
                      ))}
                    </select>
                    <Button onClick={() => handleApprove(req)} disabled={busyId === req.id}>
                      {busyId === req.id ? 'Working…' : 'Approve & provision'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReject(req)}
                      disabled={busyId === req.id}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
