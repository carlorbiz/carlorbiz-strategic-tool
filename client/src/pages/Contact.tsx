import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle, AlertCircle, Target, Compass, BrainCircuit } from 'lucide-react';
import { SEO } from '@/components/SEO';

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

const SITUATIONS = [
  { id: 'execution', icon: Target, label: "Strategy exists but nothing happens", short: "Execution gap" },
  { id: 'clarity', icon: Compass, label: "Overwhelmed, fragmented, reactive", short: "Need clarity" },
  { id: 'ai', icon: BrainCircuit, label: "Want AI but don't know where to start", short: "AI readiness" },
  { id: 'other', icon: null, label: "Something else", short: "Other" },
] as const;

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [message, setMessage] = useState('');
  const [situation, setSituation] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const webhookUrl = import.meta.env.VITE_CONTACT_WEBHOOK_URL;

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            organisation,
            situation,
            message,
            submitted_at: new Date().toISOString(),
            source: 'carlorbiz.com.au',
          }),
        });
      }

      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
      setOrganisation('');
      setSituation('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Contact Carlorbiz — Start the Conversation"
        description="Ready to replace static strategy with live decision systems? Tell me what you're working on."
        canonicalUrl="https://carlorbiz.com.au/contact"
      />
      <Navbar />

      <main className="flex-1 w-full bg-[#F9F9F9]">
        {/* Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-24">
            <h1 className="font-heading text-4xl lg:text-5xl font-extrabold leading-tight">
              <span className="text-[#2D7E32]">Let's Talk </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
                Strategy
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 font-body leading-relaxed max-w-xl">
              Tell me what you're navigating. The more context you share, the more useful our first conversation will be.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="container mx-auto px-4 lg:px-8 py-12">
          {status === 'success' ? (
            <div className="text-center py-16 space-y-4">
              <CheckCircle className="h-16 w-16 text-[#2D7E32] mx-auto" />
              <h2 className="font-heading text-2xl font-bold text-[#2D7E32]">Message sent</h2>
              <p className="text-gray-600">Thank you for reaching out. I'll be in touch soon.</p>
              <Button
                onClick={() => setStatus('idle')}
                variant="outline"
                className="mt-4"
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-10">

              {/* Situation selector — buyer self-identification */}
              <div className="space-y-3">
                <Label className="font-heading font-bold text-sm">
                  Which sounds most like your situation?
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SITUATIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSituation(s.id)}
                      className={`flex items-start gap-3 text-left rounded-lg border-2 p-4 transition-all ${
                        situation === s.id
                          ? 'border-[#2D7E32] bg-[#2D7E32]/5 shadow-sm'
                          : 'border-gray-200 hover:border-[#D5B13A]/50 hover:bg-[#F9F9F9]'
                      }`}
                    >
                      {s.icon && <s.icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${situation === s.id ? 'text-[#2D7E32]' : 'text-[#D5B13A]'}`} />}
                      <span className={`font-body text-sm leading-snug ${situation === s.id ? 'text-[#2D7E32] font-semibold' : 'text-gray-600'}`}>
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-heading font-bold text-sm">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-heading font-bold text-sm">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-heading font-bold text-sm">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 ..."
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organisation" className="font-heading font-bold text-sm">
                    Organisation
                  </Label>
                  <Input
                    id="organisation"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    placeholder="Your company or organisation"
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="font-heading font-bold text-sm">
                  What are you working on? <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder="What's the challenge or opportunity? What would a good outcome look like for you?"
                  rows={6}
                  className="resize-none"
                />
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Something went wrong. Please try again or email carla@carlorbiz.com.au directly.</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={status === 'sending'}
                className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg gap-2 w-full md:w-auto"
              >
                <Send className="h-4 w-4" />
                {status === 'sending' ? 'Sending...' : 'Send Message'}
              </Button>

              <p className="text-xs text-gray-400 font-body">
                Or email me directly at{' '}
                <a href="mailto:carla@carlorbiz.com.au" className="text-[#2D7E32] hover:underline">
                  carla@carlorbiz.com.au
                </a>
              </p>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="container mx-auto px-4 text-center">
          <img
            src="/images/carlorbiz-logo.webp"
            alt="Carlorbiz Logo"
            className="h-16 mb-5 mx-auto w-auto object-contain"
          />
          <p className="text-xs text-gray-400 font-body uppercase tracking-wider">
            &copy; Carla Taylor t/as Carlorbiz, {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
