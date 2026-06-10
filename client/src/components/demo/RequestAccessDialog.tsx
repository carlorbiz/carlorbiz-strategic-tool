// "Request extended access" — a prospect asks for a private Tier-2 sandbox.
// Writes to st_sandbox_requests (write-only via RLS); an internal_admin then
// approves it from the Admin → Sandbox requests panel.

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { submitSandboxRequest } from '@/lib/sandboxApi';

interface RequestAccessDialogProps {
  demoEngagementId?: string;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'secondary' | 'outline';
  triggerClassName?: string;
  fullWidthTrigger?: boolean;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function RequestAccessDialog({
  demoEngagementId,
  triggerLabel = 'Request extended access',
  triggerVariant = 'default',
  triggerClassName,
  fullWidthTrigger,
}: RequestAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await submitSandboxRequest({
        email,
        full_name: fullName,
        organisation,
        message,
        demo_engagement_id: demoEngagementId,
      });
      toast.success("Thanks — we'll be in touch with your private sandbox shortly.");
      setOpen(false);
      setEmail('');
      setFullName('');
      setOrganisation('');
      setMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={triggerClassName}
          style={fullWidthTrigger ? { width: '100%' } : undefined}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request your own sandbox</DialogTitle>
          <DialogDescription>
            We'll set up a private copy of this plan that's yours to edit — add your own
            priorities and documents, and keep asking Nera. Your changes are saved and only
            you can see them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="ra-email">Email *</Label>
            <Input
              id="ra-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organisation.com.au"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ra-name">Name</Label>
            <Input
              id="ra-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ra-org">Organisation</Label>
            <Input
              id="ra-org"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="Your organisation"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ra-msg">Anything you'd like us to know?</Label>
            <Textarea
              id="ra-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What you're hoping to get out of a trial…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
