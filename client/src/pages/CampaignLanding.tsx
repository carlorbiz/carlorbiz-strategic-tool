import { useState } from "react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SEO } from "@/components/SEO";
import { Send, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Campaign configuration type                                        */
/* ------------------------------------------------------------------ */

export interface CampaignConfig {
  /** URL slug used in /lp/:slug */
  slug: string;
  /** SEO & OG */
  seo: { title: string; description: string };
  /** Above-fold hero */
  hero: {
    /** Small caps label above the headline */
    sector: string;
    /** Large headline — the buyer's problem as a statement */
    headline: string;
    /** 1–2 sentences expanding the pain */
    subtext: string;
    /** CTA button label */
    cta: string;
  };
  /** Three short differentiators below the fold */
  differentiators: { icon: LucideIcon; title: string; body: string }[];
  /** Social proof strip */
  proof: {
    /** e.g. "30 years across healthcare, peak bodies & education" */
    stat: string;
    /** Short client-type callout */
    sectors: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Inline lead-capture form (replaces redirecting to /contact)        */
/* ------------------------------------------------------------------ */

type FormStatus = "idle" | "sending" | "success" | "error";

function CampaignForm({ campaign }: { campaign: CampaignConfig }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const webhookUrl = import.meta.env.VITE_CONTACT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            organisation,
            message,
            situation: campaign.slug,
            submitted_at: new Date().toISOString(),
            source: `carlorbiz.com.au/lp/${campaign.slug}`,
          }),
        });
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckCircle className="h-12 w-12 text-[#2D7E32] mx-auto" />
        <h3 className="font-heading text-xl font-bold text-[#2D7E32]">
          Got it — I'll be in touch within one business day.
        </h3>
        <p className="text-gray-500 text-sm">
          In the meantime, feel free to explore the{" "}
          <Link href="/" className="text-[#2D7E32] underline">
            main site
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lp-name" className="font-heading font-bold text-sm">
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lp-email" className="font-heading font-bold text-sm">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lp-phone" className="font-heading font-bold text-sm">
            Phone
          </Label>
          <Input
            id="lp-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+61 ..."
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lp-org" className="font-heading font-bold text-sm">
            Organisation
          </Label>
          <Input
            id="lp-org"
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="Your organisation"
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lp-msg" className="font-heading font-bold text-sm">
          What's the biggest challenge right now?
        </Label>
        <Textarea
          id="lp-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A sentence or two is plenty."
          rows={3}
          className="resize-none"
        />
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>
            Something went wrong. Try again or email{" "}
            <a
              href="mailto:carla@carlorbiz.com.au"
              className="underline"
            >
              carla@carlorbiz.com.au
            </a>{" "}
            directly.
          </span>
        </div>
      )}

      <Button
        type="submit"
        disabled={status === "sending"}
        className="h-13 px-8 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg gap-2 w-full"
      >
        <Send className="h-4 w-4" />
        {status === "sending" ? "Sending..." : "Book My Strategy Call"}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        No spam. No obligation. Just a focused 30-minute conversation.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function CampaignLanding({
  campaigns,
}: {
  campaigns: CampaignConfig[];
}) {
  const [, params] = useRoute("/lp/:slug");
  const slug = params?.slug ?? "";
  const campaign = campaigns.find((c) => c.slug === slug);

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Campaign not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title={campaign.seo.title}
        description={campaign.seo.description}
        canonicalUrl={`https://carlorbiz.com.au/lp/${campaign.slug}`}
      />

      {/* Minimal header — logo only, no navigation distractions */}
      <header className="bg-white border-b border-gray-100 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/">
            <img
              src="/images/carlorbiz-logo.webp"
              alt="Carlorbiz"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <a
            href="mailto:carla@carlorbiz.com.au"
            className="text-sm text-gray-500 hover:text-[#2D7E32] transition-colors font-body hidden sm:block"
          >
            carla@carlorbiz.com.au
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Hero + inline form ─── */}
        <section className="bg-white py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Left: messaging */}
              <div className="space-y-6 lg:sticky lg:top-8">
                <p className="font-body text-sm font-semibold text-[#D5B13A] uppercase tracking-widest">
                  {campaign.hero.sector}
                </p>
                <h1 className="font-heading text-4xl lg:text-5xl font-extrabold leading-tight text-[var(--color-brand-dark)]">
                  {campaign.hero.headline}
                </h1>
                <p className="font-body text-xl text-gray-600 leading-relaxed max-w-lg">
                  {campaign.hero.subtext}
                </p>

                {/* Social proof strip */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#D5B13A]/30">
                    <img
                      src="/images/carla-portrait.webp"
                      alt="Carla Taylor"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-heading text-sm font-bold text-[var(--color-brand-dark)]">
                      Carla Taylor
                    </p>
                    <p className="font-body text-xs text-gray-500">
                      {campaign.proof.stat}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: lead-capture form */}
              <div className="bg-[#F9F9F9] rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
                <h2 className="font-heading text-xl font-bold text-[var(--color-brand-dark)] mb-1">
                  {campaign.hero.cta}
                </h2>
                <p className="font-body text-sm text-gray-500 mb-6">
                  30 minutes. No pitch deck. Just strategy.
                </p>
                <CampaignForm campaign={campaign} />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Differentiators ─── */}
        <section className="bg-[#F9F9F9] py-16 lg:py-20 border-t border-gray-100">
          <div className="container mx-auto px-4 lg:px-8">
            <h2 className="font-heading text-2xl lg:text-3xl font-extrabold text-center mb-12">
              <span className="text-[#2D7E32]">What you get </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
                that's different
              </span>
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {campaign.differentiators.map((d) => (
                <div
                  key={d.title}
                  className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
                >
                  <d.icon className="h-7 w-7 text-[#D5B13A] mb-3" />
                  <h3 className="font-heading text-lg font-bold text-[var(--color-brand-dark)] mb-2">
                    {d.title}
                  </h3>
                  <p className="font-body text-gray-600 text-sm leading-relaxed">
                    {d.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Credibility strip ─── */}
        <section className="bg-[#2E4A3A] py-12 text-white">
          <div className="container mx-auto px-4 lg:px-8 text-center space-y-4">
            <p className="font-body text-lg text-white/80 max-w-2xl mx-auto">
              {campaign.proof.sectors}
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50 font-body">
              <span>30+ years in transformation</span>
              <span className="hidden sm:inline">·</span>
              <span>Peak bodies, healthcare, education</span>
              <span className="hidden sm:inline">·</span>
              <span>AI-powered systems that stay after I leave</span>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-4 lg:px-8 text-center space-y-6 max-w-xl">
            <h2 className="font-heading text-3xl font-extrabold text-[var(--color-brand-dark)]">
              Ready to talk?
            </h2>
            <p className="font-body text-gray-600">
              Scroll up to book a call, or email me directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="#top">
                <Button
                  size="lg"
                  className="h-13 px-8 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg"
                >
                  Book a Strategy Call
                </Button>
              </a>
              <a href="mailto:carla@carlorbiz.com.au">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 px-8 rounded-full font-bold tracking-widest border-2 border-[#2D7E32]/20 text-[#2D7E32] hover:bg-[#2D7E32]/5 transition-all"
                >
                  Email Carla <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal footer */}
      <footer className="bg-white border-t border-gray-100 py-6">
        <div className="container mx-auto px-4 text-center">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-[#2D7E32] transition-colors font-body"
          >
            carlorbiz.com.au
          </Link>
          <span className="text-xs text-gray-300 mx-2">·</span>
          <span className="text-xs text-gray-400 font-body">
            &copy; Carla Taylor t/as Carlorbiz, {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
