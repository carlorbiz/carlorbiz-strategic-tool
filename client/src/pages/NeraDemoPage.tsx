import { Navbar } from '@/components/layout/Navbar';
import { SEO } from '@/components/SEO';
import { NeraLayer2Gate } from '@/components/viewers/NeraLayer2Gate';

export default function NeraDemoPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Nera Demo — Adaptive Interview Experience | Carlorbiz"
        description="Experience Nera's branching interview capability. Three scenarios, adaptive questioning, personalised insight cards. See what a conversation captures that a survey never will."
        canonicalUrl="https://carlorbiz.com.au/nera-demo"
      />
      <Navbar />

      <main className="flex-1 w-full bg-[#F9F9F9]">
        {/* Hero */}
        <section className="bg-white text-[var(--color-brand-dark)] py-12 lg:py-16 relative overflow-hidden border-b border-gray-100">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[var(--color-brand-primary)] to-transparent rounded-full opacity-5 blur-3xl pointer-events-none transform translate-x-1/2 -translate-y-1/2" />

          <div className="container mx-auto px-4 lg:px-8 relative z-10 max-w-3xl text-center space-y-4">
            <h1 className="font-heading text-3xl lg:text-4xl font-extrabold leading-tight">
              <span className="text-[#2D7E32]">Adaptive </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6B7C73] to-[#AAB2B7]">
                Interview Experience
              </span>
            </h1>
            <p className="font-body text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Unlike a survey, Nera doesn&rsquo;t ask everyone the same questions. She listens to what you actually say &mdash; and follows that thread. Every conversation is different. Every insight card reflects you.
            </p>
          </div>
        </section>

        {/* Layer 2 Gate + Conversations */}
        <div className="container mx-auto px-4 lg:px-8 py-10 max-w-3xl">
          <NeraLayer2Gate />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="container mx-auto px-4 text-center">
          <img
            src="/images/carlorbiz-logo.webp"
            alt="Carlorbiz Logo"
            className="h-12 mb-4 mx-auto w-auto object-contain"
          />
          <p className="text-xs text-gray-400 font-body uppercase tracking-wider">
            &copy; Carla Taylor t/as Carlorbiz, {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
