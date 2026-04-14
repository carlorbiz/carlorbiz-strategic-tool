import { useState, useEffect } from 'react';
import { useEngagement } from '@/contexts/EngagementContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchDeliverables } from '@/lib/reportApi';
import type { EngagementDeliverable } from '@/types/engagement';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowRight, Loader2, Shield, UserCheck, FileText } from 'lucide-react';

/**
 * HandoverFlow — transitions an engagement from delivered → living.
 *
 * Per §15 of living-platform-vision.md:
 * - Consultant drops to no access (or revoked entirely)
 * - Full admin ownership transfers to the named client admin
 * - The consultant is gone unless the client buys ongoing maintenance
 *
 * This is a clean role flip with a hard ownership boundary.
 */
export function HandoverFlow() {
  const { engagement, isEngagementAdmin, refresh } = useEngagement();
  const { user } = useAuth();
  const [deliverables, setDeliverables] = useState<EngagementDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [handing, setHanding] = useState(false);
  const [clientAdminEmail, setClientAdminEmail] = useState('');

  useEffect(() => {
    if (!engagement) return;
    fetchDeliverables(engagement.id)
      .then(setDeliverables)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [engagement?.id]);

  const publishedDeliverables = deliverables.filter(d => d.is_published);
  const canHandover = isEngagementAdmin && publishedDeliverables.length > 0;

  const handleHandover = async () => {
    if (!engagement || !supabase || !user) return;
    setHanding(true);

    try {
      // 1. Look up the client admin user by email (if provided)
      let clientAdminId: string | null = null;
      if (clientAdminEmail.trim()) {
        const { data: clientProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', clientAdminEmail.trim().toLowerCase())
          .maybeSingle();

        if (!clientProfile) {
          toast.error(`No user found with email "${clientAdminEmail}". They need to sign up first.`);
          setHanding(false);
          return;
        }
        clientAdminId = clientProfile.id;
      }

      // 2. Transition engagement to 'living'
      const updatePayload: Record<string, unknown> = {
        status: 'living',
        handed_over_at: new Date().toISOString(),
      };
      if (clientAdminId) {
        updatePayload.handed_over_to = clientAdminId;
      }

      const { error: statusErr } = await supabase
        .from('st_engagements')
        .update(updatePayload)
        .eq('id', engagement.id);

      if (statusErr) throw statusErr;

      // 3. If client admin specified, grant them client_admin role
      if (clientAdminId) {
        // Find or create the client_admin role for this engagement
        const { data: existingRole } = await supabase
          .from('st_engagement_roles')
          .select('id')
          .eq('engagement_id', engagement.id)
          .eq('role_key', 'client_admin')
          .maybeSingle();

        let roleId = existingRole?.id;

        if (!roleId) {
          const { data: newRole } = await supabase
            .from('st_engagement_roles')
            .insert({
              engagement_id: engagement.id,
              role_key: 'client_admin',
              label: 'Administrator',
              permissions: { read: true, write: true, admin: true },
            })
            .select('id')
            .single();
          roleId = newRole?.id;
        }

        if (roleId) {
          await supabase.from('st_user_engagement_roles').insert({
            user_id: clientAdminId,
            engagement_id: engagement.id,
            role_id: roleId,
          });
        }
      }

      // 4. Revoke the current user's facilitator role (consultant walks away)
      const { data: facilitatorRoles } = await supabase
        .from('st_user_engagement_roles')
        .select('id, role:st_engagement_roles(role_key)')
        .eq('user_id', user.id)
        .eq('engagement_id', engagement.id)
        .is('revoked_at', null);

      if (facilitatorRoles) {
        const facRole = facilitatorRoles.find(
          (r: any) => r.role?.role_key === 'facilitator'
        );
        if (facRole) {
          await supabase
            .from('st_user_engagement_roles')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', facRole.id);
        }
      }

      toast.success('Engagement handed over — now in living mode');
      setConfirmOpen(false);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Handover failed';
      toast.error(msg);
    } finally {
      setHanding(false);
    }
  };

  if (!engagement || engagement.status !== 'delivered') return null;

  return (
    <div className="space-y-4">
      {/* Deliverables summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm">Deliverables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : deliverables.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No deliverables yet. The engagement needs a deliverable before handover.
            </p>
          ) : (
            <div className="space-y-2">
              {deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.title}</span>
                  <Badge variant={d.is_published ? 'default' : 'outline'}>
                    {d.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Handover card */}
      {canHandover && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <CardTitle className="text-sm text-green-900">Ready for Handover</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-green-800 mb-3">
              Transition this engagement to <strong>living</strong> mode.
              The client takes full ownership. Your facilitator access will be revoked.
              The client can invite you back later on a maintenance retainer if they choose.
            </p>
            <div className="mb-3">
              <Label className="text-xs">Client admin email (optional — grants them admin role)</Label>
              <Input
                value={clientAdminEmail}
                onChange={(e) => setClientAdminEmail(e.target.value)}
                placeholder="client-admin@example.com"
                className="mt-1"
              />
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setConfirmOpen(true)}
            >
              <UserCheck className="w-3 h-3 mr-1" /> Hand Over to Client
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              Confirm Handover
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block mb-2">This will:</span>
              <ul className="list-disc ml-4 space-y-1">
                <li>Transition the engagement to <strong>living</strong> mode</li>
                {clientAdminEmail && (
                  <li>Grant <strong>{clientAdminEmail}</strong> full admin access</li>
                )}
                <li>Revoke your facilitator role — <strong>you will lose access</strong></li>
                <li>Open the document upload, drift-watch, and reporting surfaces for the client</li>
              </ul>
              <span className="block mt-3 text-amber-600 font-medium">
                This action cannot be undone without the client re-inviting you.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHandover} disabled={handing}>
              {handing ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Handing over...</>
              ) : (
                <><ArrowRight className="w-3 h-3 mr-1" /> Confirm Handover</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
