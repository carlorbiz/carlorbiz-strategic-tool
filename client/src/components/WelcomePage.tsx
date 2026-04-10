import { Search, ArrowUp, Download, PanelLeft, Megaphone, LogIn, MessageCircle, Compass, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WelcomeBanner, DecisionTree } from "@/types/cms";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WelcomePageProps {
  onGetStarted: () => void;
  onSearchFocus?: () => void;
  onFindDownloads?: () => void;
  onToggleSidebar?: () => void;
  onNavigate?: (path: string) => void;
  onSelectTree?: (tree: DecisionTree) => void;
  decisionTrees?: DecisionTree[];
  banner?: WelcomeBanner | null;
  isAuthenticated?: boolean;
}

const features = [
  {
    icon: PanelLeft,
    title: "Browse by topic",
    description:
      "Use the panel on the left to explore. Each section expands to reveal its resources.",
    action: "sidebar" as const,
    buttonLabel: "Open sidebar",
  },
  {
    icon: Search,
    title: "Search for anything",
    description:
      "Use the search bar to find content across every section instantly.",
    action: "search" as const,
    buttonLabel: "Search now",
  },
  {
    icon: Download,
    title: "Download resources",
    description:
      "Where a downloadable document is available, you'll find a download button near the top of that section.",
    action: "downloads" as const,
    buttonLabel: "Find downloads",
  },
  {
    icon: ArrowUp,
    title: "Jump back to top",
    description:
      "Scroll down and an arrow button appears in the bottom-right corner to jump back to the top.",
    action: "getstarted" as const,
    buttonLabel: "Get started",
  },
];

export function WelcomePage({ onGetStarted, onSearchFocus, onFindDownloads, onToggleSidebar, onNavigate, onSelectTree, decisionTrees, banner, isAuthenticated }: WelcomePageProps) {

  const visibleTrees = (decisionTrees || []).filter(t => t.is_visible && (!t.requires_auth || isAuthenticated));

  const handleFeatureClick = (action: string) => {
    switch (action) {
      case "sidebar":
        onToggleSidebar?.();
        break;
      case "search":
        onSearchFocus?.();
        break;
      case "downloads":
        onFindDownloads?.();
        break;
      default:
        onGetStarted();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12 md:py-16">
      {/* Banner */}
      {banner?.enabled && banner.content && (
        <div className="max-w-3xl w-full mb-8 rounded-xl border border-[var(--color-brand-accent)]/30 bg-[var(--color-brand-accent)]/5 p-5">
          <div className="flex gap-3">
            <Megaphone className="h-5 w-5 text-[var(--color-brand-accent)] flex-shrink-0 mt-0.5" />
            <div className="prose prose-sm prose-stone max-w-none [&_p]:m-0 [&_p+p]:mt-2 [&_a]:text-[var(--color-brand-accent)] [&_strong]:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {banner.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="max-w-2xl text-center space-y-4 mb-10">
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold leading-tight drop-shadow-sm">
          <span className="text-[#2D7E32]">Knowledge </span>
          <br className="md:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">Hub</span>
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Frameworks, resources, and strategic tools — all in one place.
          Browse by topic, search, or ask Nera.
        </p>
      </div>

      {/* Authenticated tools */}
      {isAuthenticated && (
        <div className="max-w-3xl w-full mb-10">
          <div className="rounded-xl border-2 border-[var(--color-brand-dark)]/20 bg-[var(--color-brand-dark)]/[0.03] p-6 md:p-8">
            <div className="text-center mb-6">
              <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">
                Your Tools
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                You're signed in — here's what's available to you.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-1">
              <div className="flex flex-col p-4 rounded-lg border bg-card shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-brand-dark)]/10 flex items-center justify-center mb-3">
                  <MessageCircle className="h-5 w-5 text-[var(--color-brand-dark)]" />
                </div>
                <h3 className="font-heading font-semibold text-foreground text-sm mb-1">
                  Nera AI Assistant
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nera can answer questions about Carlorbiz services, methodology, and the resources in this hub. Look for the chat icon in the bottom-right corner.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature grid */}
      <div className="grid gap-6 sm:grid-cols-2 max-w-3xl w-full mb-12">
        {features.map(({ icon: Icon, title, description, action, buttonLabel }) => (
          <button
            key={title}
            onClick={() => handleFeatureClick(action)}
            className="flex gap-4 p-5 rounded-xl border bg-card shadow-sm text-left transition-colors hover:border-[var(--color-brand-accent)]/40 hover:shadow-md group"
          >
            <div className="flex-shrink-0 flex items-start pt-0.5">
              <div className="h-10 w-10 rounded-lg bg-[var(--color-brand-accent)]/10 flex items-center justify-center group-hover:bg-[var(--color-brand-accent)]/20 transition-colors">
                <Icon className="h-5 w-5 text-[var(--color-brand-accent)]" />
              </div>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground mb-1">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                {description}
              </p>
              <span className="text-xs font-medium text-[var(--color-brand-accent)] group-hover:underline">
                {buttonLabel} &rarr;
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Interactive Guides */}
      {visibleTrees.length > 0 && (
        <div className="max-w-3xl w-full mb-12">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Compass className="h-5 w-5 text-[var(--color-brand-accent)]" />
              <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">
                Interactive Guides
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Step-by-step walkthroughs — answer a few questions and get exactly the help you need.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-1">
            {visibleTrees.map(tree => (
              <button
                key={tree.id}
                onClick={() => onSelectTree?.(tree)}
                className="flex items-center gap-4 p-5 rounded-xl border-2 border-[var(--color-brand-accent)]/20 bg-[var(--color-brand-accent)]/[0.03] text-left transition-all hover:border-[var(--color-brand-accent)]/50 hover:shadow-md hover:bg-[var(--color-brand-accent)]/[0.06] group"
              >
                <span className="text-2xl flex-shrink-0">{tree.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-foreground mb-0.5">
                    {tree.title}
                  </h3>
                  {tree.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {tree.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[var(--color-brand-accent)] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Button
        size="lg"
        onClick={onGetStarted}
        className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg gap-2"
      >
        Get started
      </Button>

      {/* Login link */}
      {!isAuthenticated ? (
        <button
          onClick={() => onNavigate?.("/login")}
          className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in for additional tools
        </button>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Choose a section from the sidebar, or ask Nera using the chat icon
          in the bottom-right corner.
        </p>
      )}
    </div>
  );
}
