import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { SEO } from "@/components/SEO";
import { Target, Compass, BrainCircuit, ArrowRight } from "lucide-react";

const PERSON_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Carla Taylor",
  jobTitle: "Founder & Strategic Consultant",
  description: "Strategic consultant helping organisations find what makes them irreplaceable. 30 years leading transformation across healthcare, hospitality, and professional services. Builder of AI-powered knowledge platforms.",
  image: "https://carlorbiz.com.au/images/carla-headshot.jpg",
  url: "https://carlorbiz.com.au/about-me",
  sameAs: [
    "https://www.linkedin.com/in/carlajane/",
    "https://carlorbiz.com.au"
  ],
  worksFor: {
    "@type": "Organization",
    name: "Carlorbiz",
    url: "https://carlorbiz.com.au",
    logo: "https://carlorbiz.com.au/og-image.png",
    description: "Strategic consulting and AI-powered knowledge platforms for organisations whose expertise needs to outlast any single engagement.",
    foundingDate: "2020",
    founder: { "@type": "Person", name: "Carla Taylor" },
    areaServed: { "@type": "Country", name: "Australia" },
    knowsAbout: [
      "Strategic consulting",
      "AI-powered knowledge platforms",
      "Digital transformation",
      "Transformation staging",
      "Knowledge management systems",
      "DAIS methodology"
    ]
  },
};

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Carlorbiz",
  description: "I replace static strategy with live decision systems organisations actually use. AI-powered knowledge platforms for Australian peak bodies, healthcare, and education.",
  url: "https://carlorbiz.com.au",
  founder: { "@type": "Person", name: "Carla Taylor" },
  areaServed: "Australia",
  serviceType: ["Strategic Consulting", "AI Knowledge Systems", "Decision Architecture"],
};

const ENTRY_POINTS = [
  {
    icon: Target,
    problem: "Strategy exists but nothing happens",
    heading: "Execution System Build",
    description: "You've done the strategy work. The slides exist. But six months later, nothing's moved. I build live execution systems that turn strategy into trackable, owned action.",
    href: "/services#execution",
    cta: "Fix the execution gap",
  },
  {
    icon: Compass,
    problem: "Overwhelmed, fragmented, reactive",
    heading: "Clarity & Decision Architecture",
    description: "Too many priorities. No shared framework for decisions. Your team is busy but not aligned. I build the decision architecture that cuts through the noise.",
    href: "/services#clarity",
    cta: "Get structured clarity",
  },
  {
    icon: BrainCircuit,
    problem: "Want AI but don't know where to start",
    heading: "AI Knowledge System",
    description: "You know AI matters but chatbots and dashboards aren't strategy. I structure your deep expertise into a living knowledge system your organisation actually uses.",
    href: "/services#see-it-working",
    cta: "See how Nera works",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Carlorbiz — Live Decision Systems & AI Knowledge Platforms"
        description="I replace static strategy with live decision systems organisations actually use. AI-powered knowledge platforms for Australian peak bodies, healthcare, and education."
        canonicalUrl="https://carlorbiz.com.au"
        jsonLd={[PERSON_SCHEMA, SERVICE_SCHEMA]}
      />
      <Navbar />

      {/* Hero Section — answers: What do you do? Who is it for? What changes? */}
      <main className="flex-1 flex flex-col">
        <section className="bg-white text-[var(--color-brand-dark)] py-20 lg:py-32 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[var(--color-brand-primary)] to-transparent rounded-full opacity-5 blur-3xl pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>

          <div className="container mx-auto px-4 lg:px-8 relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-8">
              <h1 className="font-heading text-5xl lg:text-6xl font-extrabold leading-tight drop-shadow-sm">
                <span className="text-[#2D7E32]">Strategy that lives </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
                  inside your organisation.
                </span>
              </h1>

              <div className="font-body text-xl lg:text-2xl text-gray-600 font-medium leading-relaxed max-w-2xl space-y-4">
                <p>
                  I replace static strategy decks with live decision systems and AI-powered knowledge platforms that your team actually uses &mdash; long after the engagement ends.
                </p>
                <p className="text-lg text-gray-500">
                  For peak bodies, healthcare, and education leaders who are done with consultants who disappear.
                </p>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <Link href="/contact">
                  <Button size="lg" className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg">
                    Book a Free Strategy Call
                  </Button>
                </Link>
                <Link href="/services#what-will-it-cost">
                  <Button size="lg" variant="outline" className="h-14 px-8 rounded-full font-bold tracking-widest border-2 border-[#2D7E32]/20 text-[#2D7E32] hover:bg-[#2D7E32]/5 transition-all">
                    Try a Decision Tool
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-gray-400 font-body">
                30 minutes. No pitch deck. Just strategy.
              </p>
            </div>

            {/* Right side portrait */}
            <div className="flex-1 flex justify-center w-full min-h-[400px]">
              <div className="relative w-full max-w-lg flex items-center justify-center p-4">
                 <img
                   src="/images/carla-portrait.webp"
                   alt="Carla Taylor — Strategic Consultant & Founder of Carlorbiz"
                   loading="eager"
                   className="w-full h-auto object-contain mix-blend-multiply hover:scale-[1.02] transition-transform duration-700 ease-out drop-shadow-lg"
                 />
              </div>
            </div>
          </div>
        </section>

        {/* Social proof strip — credibility for cold traffic */}
        <section className="bg-[#2E4A3A] py-6">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3 text-sm font-body">
              <span className="text-white/70">
                <strong className="text-white font-bold">30+ years</strong> leading transformation
              </span>
              <span className="hidden sm:inline text-white/30">|</span>
              <span className="text-white/70">
                Peak bodies, healthcare &amp; education
              </span>
              <span className="hidden sm:inline text-white/30">|</span>
              <span className="text-white/70">
                Systems that <strong className="text-[#D5B13A] font-bold">stay after I leave</strong>
              </span>
            </div>
          </div>
        </section>

        {/* Entry Point Cards — three buyer segments */}
        <section className="bg-[#F9F9F9] py-20 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="font-heading text-3xl lg:text-4xl font-extrabold">
                <span className="text-[#2D7E32]">Where are you </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
                  right now?
                </span>
              </h2>
              <p className="font-body text-lg text-gray-500 mt-4 max-w-2xl mx-auto">
                Every engagement starts from one of these three situations. Find yours.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {ENTRY_POINTS.map((ep) => (
                <Link key={ep.heading} href={ep.href}>
                  <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 p-8 h-full flex flex-col cursor-pointer border-t-4 border-t-[var(--color-brand-accent)] hover:border-t-[#2D7E32]">
                    <ep.icon className="h-8 w-8 text-[#D5B13A] mb-4 group-hover:text-[#2D7E32] transition-colors" />
                    <p className="font-body text-sm font-semibold text-[#D5B13A] uppercase tracking-wider mb-2">
                      {ep.problem}
                    </p>
                    <h3 className="font-heading text-xl font-extrabold text-[var(--color-brand-dark)] mb-3">
                      {ep.heading}
                    </h3>
                    <p className="font-body text-gray-600 leading-relaxed flex-1">
                      {ep.description}
                    </p>
                    <div className="mt-6 flex items-center gap-2 font-heading font-bold text-sm text-[#2D7E32] group-hover:text-[#D5B13A] uppercase tracking-widest transition-colors">
                      {ep.cta} <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* What Changes — outcome-focused, not abstract */}
        <section className="bg-white py-20 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1 space-y-6">
                <h2 className="font-heading text-4xl lg:text-5xl font-extrabold">
                  <span className="text-[#2D7E32]">What changes after </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
                    working with me
                  </span>
                </h2>
                <div className="prose prose-lg text-[var(--color-brand-dark)] max-w-none">
                  <p>Your strategy stops living in a PDF nobody opens. It becomes a live system your team interacts with every week &mdash; with clear decisions, visible progress, and AI that amplifies your expertise instead of replacing it.</p>
                  <p className="font-bold border-l-4 border-[var(--color-brand-primary)] pl-6 py-2 bg-[#F9F9F9] text-xl text-[var(--color-brand-dark)]">
                    You own the system. You own the capability. The consultant leaves &mdash; the infrastructure stays.
                  </p>
                  <p>That&apos;s the difference between a consulting engagement and a decision system. One gives you a document. The other gives you an unfair advantage.</p>
                </div>
              </div>
              <div className="order-1 md:order-2 bg-[#F9F9F9] p-12 shadow-sm border-t-8 border-[var(--color-brand-accent)] relative rounded-xl">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent pointer-events-none rounded-tr-xl"></div>
                 <h3 className="font-heading text-3xl font-bold mb-6 text-[var(--color-brand-dark)]">
                   How this is different
                 </h3>
                 <ul className="space-y-4 font-body text-lg text-gray-600">
                   <li className="flex items-start gap-3">
                     <span className="w-2 h-2 rounded-full bg-[#D5B13A] mt-2.5 flex-shrink-0" />
                     <span><strong className="text-[var(--color-brand-dark)]">Not slides.</strong> Live, interactive decision environments.</span>
                   </li>
                   <li className="flex items-start gap-3">
                     <span className="w-2 h-2 rounded-full bg-[#D5B13A] mt-2.5 flex-shrink-0" />
                     <span><strong className="text-[var(--color-brand-dark)]">Not dependency.</strong> Your team owns the capability from day one.</span>
                   </li>
                   <li className="flex items-start gap-3">
                     <span className="w-2 h-2 rounded-full bg-[#D5B13A] mt-2.5 flex-shrink-0" />
                     <span><strong className="text-[var(--color-brand-dark)]">Not generic AI.</strong> Your expertise, structured into a system that learns.</span>
                   </li>
                 </ul>
                 <div className="mt-8">
                   <Link href="/services">
                      <button className="font-heading font-bold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] uppercase tracking-widest text-sm flex items-center gap-2 transition-colors">
                        See how it works <ArrowRight className="h-4 w-4" />
                      </button>
                   </Link>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Nera Showcase — make the differentiator visible */}
        <section className="bg-[#2E4A3A] py-20 lg:py-24 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-[#2D7E32] to-transparent rounded-full opacity-10 blur-3xl pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>

          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <p className="font-body text-sm font-semibold text-[#D5B13A] uppercase tracking-widest">
                  Built-in AI &mdash; not bolted on
                </p>
                <h2 className="font-heading text-4xl lg:text-5xl font-extrabold leading-tight">
                  Ask Nera how your strategy would hold up.
                </h2>
                <p className="font-body text-xl text-white/80 leading-relaxed">
                  Nera is the AI knowledge system built into every client platform. It doesn&apos;t give generic answers &mdash; it draws from your organisation&apos;s own structured expertise to surface decisions, frameworks, and blind spots.
                </p>
                <p className="font-body text-lg text-white/60">
                  This isn&apos;t a chatbot. It&apos;s a strategic reasoning layer trained on what makes your organisation irreplaceable.
                </p>
                <div className="pt-4">
                  <Link href="/services#see-it-working">
                    <Button size="lg" className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg">
                      Try Nera on this site
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
                <p className="font-body text-xs font-semibold text-[#D5B13A] uppercase tracking-widest mb-4">
                  Example prompts
                </p>
                <ul className="space-y-4">
                  {[
                    "Explain the four stages of the DAIS methodology",
                    "How does a knowledge platform differ from a dashboard?",
                    "What does Transformation Staging actually involve?",
                  ].map((prompt) => (
                    <li key={prompt} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D5B13A] mt-2 flex-shrink-0" />
                      <span className="font-body text-white/70 text-base italic">&ldquo;{prompt}&rdquo;</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="font-body text-sm text-white/50">
                    Nera is live on this site with a 3-question preview. Clients get unlimited access inside their own platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final conversion CTA — last chance before footer */}
        <section className="bg-[#F9F9F9] py-16 lg:py-20 border-t border-gray-100">
          <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl space-y-6">
            <h2 className="font-heading text-3xl lg:text-4xl font-extrabold">
              <span className="text-[#2D7E32]">Not sure where </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
                to start?
              </span>
            </h2>
            <p className="font-body text-lg text-gray-600 leading-relaxed">
              Most clients don&apos;t arrive with a clear brief. They arrive with a situation.
              Tell me what you&apos;re navigating and I&apos;ll tell you honestly whether I can help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Link href="/contact">
                <Button size="lg" className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg">
                  Book a Free Strategy Call
                </Button>
              </Link>
              <a href="mailto:carla@carlorbiz.com.au">
                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full font-bold tracking-widest border-2 border-[#2D7E32]/20 text-[#2D7E32] hover:bg-[#2D7E32]/5 transition-all">
                  Email Me Directly <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </a>
            </div>
            <p className="text-sm text-gray-400 font-body">
              30 minutes. No pitch deck. If I can&apos;t help, I&apos;ll say so.
            </p>
          </div>
        </section>

        {/* DAIS methodology reference */}
        <section className="bg-white py-12">
          <div className="container mx-auto px-4 lg:px-8 text-center">
            <p className="font-body text-base text-gray-600 italic">
              One methodology underneath everything:{" "}
              <Link href="/services">
                <span className="font-semibold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] not-italic transition-colors cursor-pointer">
                  Discover, Architect, Implement, Sustain.
                </span>
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="container mx-auto px-4 text-center">
          <img
            src="/images/carlorbiz-logo.webp"
            alt="Carlorbiz Logo"
            className="h-16 mb-5 mx-auto w-auto object-contain"
          />
          <p className="text-xs text-gray-400 font-body uppercase tracking-wider">&copy; Carla Taylor t/as Carlorbiz, {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
