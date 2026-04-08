import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen,
  MessageSquare,
  Users,
  Settings,
  ArrowRight,
  Shield,
  Wifi,
  FileText,
} from 'lucide-react';

const stages = [
  {
    number: '01',
    title: 'Intelligence Briefing',
    description:
      'Comprehensive strategic plan with interactive charts, Victoria map, and evidence-based analysis. Export as PDF for Board distribution.',
    icon: BookOpen,
    href: '/briefing',
    colour: 'bg-primary',
  },
  {
    number: '02',
    title: 'Stakeholder Engagement',
    description:
      'Pre-meeting Nera-conversation tool that draws out richer stakeholder input through guided dialogue, feeding directly into workshop sessions.',
    icon: MessageSquare,
    href: '#',
    colour: 'bg-[var(--cb-gold)]',
    requiresSession: true,
  },
  {
    number: '03',
    title: 'Live Workshop',
    description:
      'Real-time facilitation with QR-code photo upload, OCR extraction, AI-powered decision engine, and Board-approved report generation.',
    icon: Users,
    href: '#',
    colour: 'bg-secondary',
    requiresSession: true,
  },
];

const features = [
  {
    icon: Shield,
    title: 'Secure & Role-Based',
    description: 'Supabase auth with admin, client, and stakeholder roles.',
  },
  {
    icon: Wifi,
    title: 'Offline-Ready PWA',
    description: 'Service worker caching for full offline workshop operation.',
  },
  {
    icon: FileText,
    title: 'PDF Report Export',
    description: 'Board-approved strategy documents with decisions and impact analysis.',
  },
];

export default function Home() {
  const { isAuthenticated, isAdmin, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="font-heading font-semibold text-lg text-foreground leading-tight">
                Carlorbiz
              </h1>
              <p className="text-xs text-muted-foreground">Strategic Planning Toolkit</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors no-underline"
              >
                <Settings className="w-4 h-4" />
                Admin
              </Link>
            )}
            {isAuthenticated ? (
              <span className="text-sm text-muted-foreground">
                {user?.full_name || user?.email}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Guest</span>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container text-center max-w-3xl">
          <h2 className="font-heading text-4xl md:text-5xl font-bold mb-6">
            <span className="cb-heading-gradient-soft">Strategic Planning</span>
            <br />
            <span className="text-foreground">From Insight to Action</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            A progressive toolkit that guides stakeholders from pre-meeting engagement through live
            Board workshops to polished strategy documents — all in a single reusable platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/briefing"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity no-underline"
            >
              View Intelligence Briefing
              <ArrowRight className="w-4 h-4" />
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors no-underline"
              >
                <Settings className="w-4 h-4" />
                Manage Sessions
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="cb-divider-gold mx-auto max-w-xl" />

      {/* Three Stages */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl">
          <h3 className="font-heading text-2xl font-semibold text-center text-foreground mb-12">
            Three-Stage Strategic Planning Arc
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {stages.map((stage) => (
              <div
                key={stage.number}
                className="bg-card rounded-xl border border-border p-6 cb-card-accent-top hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg ${stage.colour} flex items-center justify-center`}
                  >
                    <stage.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Stage {stage.number}
                  </span>
                </div>
                <h4 className="font-heading font-semibold text-lg text-foreground mb-2">
                  {stage.title}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">{stage.description}</p>
                {stage.requiresSession ? (
                  <span className="text-xs text-muted-foreground italic">
                    Requires active session
                  </span>
                ) : (
                  <Link
                    href={stage.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors no-underline"
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container max-w-4xl">
          <div className="grid sm:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="text-center p-4">
                <feature.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h5 className="font-heading font-semibold text-foreground mb-1">{feature.title}</h5>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Carlorbiz. Strategic Planning Toolkit.
          </p>
        </div>
      </footer>
    </div>
  );
}
