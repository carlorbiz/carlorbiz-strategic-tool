import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { submitFollowUp, FollowUpSubmission } from '@/lib/followUpApi';

type ContactMethod = 'email' | 'phone' | 'teams';

export default function FollowUpPage() {
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [contactDetails, setContactDetails] = useState('');
  const [availability, setAvailability] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholders: Record<ContactMethod, string> = {
    email: 'your.name@example.com',
    phone: '04XX XXX XXX',
    teams: 'your.name@organisation.com.au',
  };

  const isValid = name.trim().length > 0 && contactDetails.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    const data: FollowUpSubmission = {
      name: name,
      contact_method: contactMethod,
      contact_details: contactDetails,
      availability_notes: availability || null,
    };

    const result = await submitFollowUp(data);

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 text-center space-y-4">
        <img src="/logo.png" alt="Logo" className="h-12" />
        <h1 className="text-xl font-semibold">Thanks!</h1>
        <p className="text-muted-foreground max-w-md">
          Your details have been submitted. Someone from the team will be in
          touch to arrange a follow-up at a time that suits you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-12 mx-auto"
          />
          <h1 className="text-xl font-semibold">Follow-up Contact</h1>
          <p className="text-sm text-muted-foreground">
            Thanks for offering to chat further about your feedback. Please
            leave your details below and someone from the team will reach out to
            arrange a time.
          </p>
          <p className="text-xs text-muted-foreground">
            This form is completely separate from your feedback interview — your
            responses remain anonymous.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">First name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name"
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Preferred contact method</Label>
            <RadioGroup
              value={contactMethod}
              onValueChange={(v) => {
                setContactMethod(v as ContactMethod);
                setContactDetails('');
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="method-email" />
                <Label htmlFor="method-email" className="font-normal">
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="phone" id="method-phone" />
                <Label htmlFor="method-phone" className="font-normal">
                  Phone
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="teams" id="method-teams" />
                <Label htmlFor="method-teams" className="font-normal">
                  Teams
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">
              {contactMethod === 'email'
                ? 'Email address'
                : contactMethod === 'phone'
                  ? 'Phone number'
                  : 'Teams email address'}
            </Label>
            <Input
              id="details"
              type={contactMethod === 'email' || contactMethod === 'teams' ? 'email' : 'tel'}
              value={contactDetails}
              onChange={(e) => setContactDetails(e.target.value)}
              placeholder={placeholders[contactMethod]}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">
              Availability / preferred times{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g. Tuesdays and Thursdays after 2pm AEST, mornings are best..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Please include your time zone (e.g. AEST, ACST, AWST) as Australia has multiple time zones.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
}
