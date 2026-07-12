import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessagesSquare, Layers, FileCheck2, Radar } from 'lucide-react';
import { BrandLogo } from '@/components/layout/BrandLogo';

// MTMOT Strategy Engine product page (CC-84) — the public front door at
// strategy.mtmot.com. Positions the Engine as the board-level (ELEVATE) tier of
// Make The Most Of Today, and leads straight into the open demo. No sign-up.

const GREEN = '#2D7E32';
const GOLD = '#D5B13A';

const FEATURES = [
  {
    icon: MessagesSquare,
    title: 'Interviews, not surveys',
    body: 'Stakeholders talk to Nera in a natural conversation. She elicits what matters, cites her sources, and never makes them fill in a form.',
  },
  {
    icon: Layers,
    title: 'A living evidence corpus',
    body: "Every interview, workshop, document and survey files against the organisation's own strategic commitments — a memory that compounds between engagements.",
  },
  {
    icon: FileCheck2,
    title: 'Funder-ready deliverables',
    body: 'Board-grade reports generated against your templates in minutes, every claim cited back to the evidence — not the 10–40 hours a quarter most teams lose to it.',
  },
  {
    icon: Radar,
    title: 'Drift watch',
    body: 'Surfaces the gap between what was committed and what is actually happening — silent commitments, scope creep, distribution imbalances — with an audit trail.',
  },
];

export default function MtmotProductPage() {
  return (
    <div className="min-h-screen bg-white text-[#1f2a24]">
      {/* No per-surface header here (CC-89): the replicated mtmot.com header
          (App.tsx) is the ONLY top bar on the MTMOT skin. The bar that used to
          sit here — EP3 green logo, "Strategy Engine", "Walk the demo →" —
          now lives in the page footer below. */}

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: GOLD }}>
          The board-level tier of Make The Most Of Today
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Board-grade strategy,<br />self-serve.
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          A conversational evidence platform for strategic engagements — stakeholder interviews,
          cumulative synthesis, and a cited, board-ready plan that keeps living after the workshop ends.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/demo">
            <Button size="lg" className="rounded-full px-8 gap-2 text-white" style={{ backgroundColor: GREEN }}>
              Walk a live demo <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-500">Three fully worked plans. No sign-up.</p>
      </section>

      {/* Proof band */}
      <section className="border-y border-gray-100 bg-[#F7F9F7]">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center">
          <p className="text-xl md:text-2xl font-medium leading-snug" style={{ fontFamily: 'var(--font-heading)' }}>
            See how a real consultancy runs its client engagements on the Engine.
          </p>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            The demo plans are live engagements run by Carlorbiz Consulting — the proof that a
            consultant can subscribe to the Engine and deliver their own clients on it.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EAF3EB' }}>
                <f.icon className="w-5 h-5" style={{ color: GREEN }} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="mt-1 text-gray-600 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-100 bg-[#F7F9F7]">
        <div className="max-w-4xl mx-auto px-6 py-14">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: 'var(--font-heading)' }}>
            How an engagement runs
          </h2>
          <ol className="grid sm:grid-cols-4 gap-6 text-center">
            {[
              ['1', 'Interview', 'Stakeholders talk to Nera; every transcript joins the corpus.'],
              ['2', 'Synthesise', 'Each stage distils into themes, tensions and emerging commitments.'],
              ['3', 'Deliver', 'A cited, board-ready plan — with the commitments as the living taxonomy.'],
              ['4', 'Keep living', 'Updates, surveys and drift watch keep the plan honest between board cycles.'],
            ].map(([n, t, b]) => (
              <li key={n}>
                <div className="w-9 h-9 rounded-full mx-auto flex items-center justify-center text-white font-bold" style={{ backgroundColor: GOLD }}>{n}</div>
                <h4 className="mt-3 font-semibold">{t}</h4>
                <p className="mt-1 text-sm text-gray-600">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Walk it the way your board would.
        </h2>
        <p className="mt-4 text-gray-600 max-w-xl mx-auto">
          Open a worked plan, take the guided tour, and interrogate it live. Nothing you do changes the data.
        </p>
        <div className="mt-8">
          <Link href="/demo">
            <Button size="lg" className="rounded-full px-8 gap-2 text-white" style={{ backgroundColor: GREEN }}>
              Explore the demo <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer — carries the per-surface bar moved out of the header (CC-89):
          the EP3 green house mark → mtmot.com, the "Strategy Engine" surface
          name, and the local "Walk the demo →" action. Non-sticky. */}
      <footer className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* MTMOT house mark (EP3/ELEVATE green) → back to the mtmot.com landing. */}
            <BrandLogo imgClassName="h-9 w-auto object-contain" />
            <span className="text-sm font-semibold shrink-0" style={{ color: GREEN }}>
              Strategy Engine
            </span>
          </div>
          <Link href="/demo">
            <span className="text-sm font-semibold cursor-pointer hover:opacity-80" style={{ color: GREEN }}>
              Walk the demo →
            </span>
          </Link>
        </div>
        <div className="border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-5 text-sm text-gray-500 text-center sm:text-left">
            MTMOT Strategy Engine — a Make The Most of Today Pty Ltd product.
          </div>
        </div>
      </footer>
    </div>
  );
}
