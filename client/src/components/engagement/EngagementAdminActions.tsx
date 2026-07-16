// Super-admin teardown controls for a single engagement (CC-94).
// Renders "Reset" + "Delete" actions with destructive-confirm UX:
//   • Delete requires typing the engagement name to arm the button.
//   • Reset is a simpler confirm (keeps the engagement + roles, wipes content).
//   • A tripped live-campaign guard (409) surfaces inline with a gated
//     "Delete anyway" (force) path, itself behind type-to-confirm.
// Only mount this for internal_admin users — it drives a service-role function.

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteEngagement, LiveCampaignGuardError } from '@/lib/deleteEngagementApi';

interface Props {
  engagementId: string;
  engagementName: string;
  onDone?: () => void;
}

export default function EngagementAdminActions({ engagementId, engagementName, onDone }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  // Set when the 409 guard trips; upgrades the Delete dialog into a force flow.
  const [guard, setGuard] = useState<{ message: string } | null>(null);

  const nameMatches = confirmText.trim() === engagementName.trim();

  const resetDialogState = () => {
    setConfirmText('');
    setGuard(null);
    setBusy(false);
  };

  const runDelete = async (force: boolean) => {
    setBusy(true);
    try {
      const res = await deleteEngagement({ engagement_id: engagementId, mode: 'delete', force });
      toast.success(`Deleted "${engagementName}".`);
      setDeleteOpen(false);
      resetDialogState();
      onDone?.();
      return res;
    } catch (e) {
      if (e instanceof LiveCampaignGuardError) {
        // Keep the dialog open, re-arm type-to-confirm, show the guard message.
        setGuard({ message: e.message });
        setConfirmText('');
      } else {
        toast.error(e instanceof Error ? e.message : 'Delete failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    setBusy(true);
    try {
      await deleteEngagement({ engagement_id: engagementId, mode: 'reset' });
      toast.success(`Reset "${engagementName}" back to draft.`);
      setResetOpen(false);
      resetDialogState();
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); resetDialogState(); setResetOpen(true); }}
      >
        Reset
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); resetDialogState(); setDeleteOpen(true); }}
      >
        Delete
      </Button>

      {/* ── Reset confirm (simple) ─────────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={(o) => { if (!busy) { setResetOpen(o); if (!o) resetDialogState(); } }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reset engagement?</DialogTitle>
            <DialogDescription>
              This clears all content for <span className="font-medium">{engagementName}</span> — documents,
              knowledge chunks, pillars, stage insights and wizard setup — and drops its status back to
              <span className="font-medium"> draft</span>. The engagement and its people (roles &amp; respondents)
              are kept so you can re-walk the setup wizard. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetOpen(false); resetDialogState(); }} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runReset} disabled={busy}>
              {busy ? 'Resetting…' : 'Reset to draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm (type-to-arm) ───────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!busy) { setDeleteOpen(o); if (!o) resetDialogState(); } }}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{guard ? 'Delete a live campaign?' : 'Delete engagement?'}</DialogTitle>
            <DialogDescription>
              {guard ? (
                <span className="text-destructive">{guard.message}</span>
              ) : (
                <>
                  This permanently deletes <span className="font-medium">{engagementName}</span> and every
                  associated record — documents, chunks, commitments, reports, respondents, tokens and more.
                  This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Type the engagement name <span className="font-mono font-medium">{engagementName}</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={engagementName}
              autoFocus
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); resetDialogState(); }} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!nameMatches || busy}
              onClick={() => runDelete(guard != null)}
            >
              {busy ? 'Deleting…' : guard ? 'Delete anyway' : 'Delete engagement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
