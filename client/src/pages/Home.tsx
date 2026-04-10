import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Download, FileText, Menu } from "lucide-react";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { SearchBar } from "@/components/SearchBar";
import { TableOfContents } from "@/components/TableOfContents";
import { BackToTop } from "@/components/BackToTop";
import { WelcomePage } from "@/components/WelcomePage";
import { DecisionTreeViewer } from "@/components/DecisionTreeViewer";
import { useCMS } from "@/contexts/CMSContext";
import type { DecisionTree } from "@/types/cms";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

/**
 * Strip Google Docs custom header ID syntax from markdown content.
 * Google Docs exports headings with {#h.xxxxx} IDs that aren't supported
 * by standard markdown renderers. rehype-slug will auto-generate IDs anyway.
 */
const stripGoogleDocsHeaderIds = (content: string): string => {
  // Match {#h.xxxxxxx} patterns at end of heading lines
  return content.replace(/\s*\{#h\.[a-z0-9]+\}/gi, '');
};

/**
 * Check if content has markdown headings (H2-H4).
 * Used to determine whether to show TableOfContents.
 */
const hasHeadings = (content: string): boolean => {
  return /^#{2,4}\s+.+/m.test(content);
};

/**
 * Renders a string with the Gamma.app style gradient on the last words.
 * This ensures long headers have a solid first word and elegant silver gradient ends.
 */
const renderGradientHeading = (text: string) => {
  if (!text) return null;
  const words = text.split(' ');
  if (words.length <= 1) {
    return <span className="text-[#2D7E32]">{text}</span>;
  }
  const firstPart = words[0];
  const secondPart = words.slice(1).join(' ');
  
  return (
    <>
      <span className="text-[#2D7E32] mr-2">{firstPart}</span>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8C9399] to-[#D1D5DB]">
        {secondPart}
      </span>
    </>
  );
};


export default function Home() {
  const { settings, tabs, folders, decisionTrees, isLoading } = useCMS();
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTree, setActiveTree] = useState<DecisionTree | null>(null);
  const [activeTab, setActiveTab] = useState("acknowledgement");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [pendingSearch, setPendingSearch] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Derived state — must come before callbacks that reference these values
  const visibleTabs = useMemo(() => tabs.filter(t => t.is_visible && (!t.requires_auth || isAuthenticated)), [tabs, isAuthenticated]);
  const sortedFolders = useMemo(() => [...folders].sort((a, b) => a.order_index - b.order_index), [folders]);
  const tabsByFolder = useMemo(() => {
    const map = new Map<string | null, typeof visibleTabs>();
    visibleTabs.forEach(tab => {
      const key = tab.folder_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tab);
    });
    map.forEach(folderTabs => {
      folderTabs.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index);
    });
    return map;
  }, [visibleTabs]);
  const standaloneTabs = useMemo(() => (tabsByFolder.get(null) || []), [tabsByFolder]);
  const downloadsFolderId = useMemo(() => folders.find(f => f.slug === 'downloads')?.id ?? null, [folders]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    setActiveTree(null);
  }, []);

  const handleSelectTree = useCallback((tree: DecisionTree) => {
    setActiveTree(tree);
    setShowWelcome(false);
  }, []);

  const handleBackFromTree = useCallback(() => {
    setActiveTree(null);
    setShowWelcome(true);
  }, []);

  const handleTreeNavigateToTab = useCallback((tabSlug: string) => {
    const targetTab = tabs.find(t => t.slug === tabSlug);
    if (targetTab) {
      setActiveTree(null);
      setShowWelcome(false);
      if (targetTab.folder_id) {
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.add(targetTab.folder_id!);
          return next;
        });
      }
      setActiveTab(targetTab.id);
    }
  }, [tabs]);

  const handleSearchFocus = useCallback(() => {
    setShowWelcome(false);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('[data-search-input]');
      input?.focus();
    });
  }, []);

  const handleFindDownloads = useCallback(() => {
    // Look for a dedicated "downloads" folder first
    const downloadsFolder = folders.find(f => f.slug === 'downloads');
    if (downloadsFolder) {
      const folderTabs = tabsByFolder.get(downloadsFolder.id);
      setShowWelcome(false);
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(downloadsFolder.id);
        return next;
      });
      if (folderTabs && folderTabs.length > 0) {
        setActiveTab(folderTabs[0].id);
      }
      return;
    }
    // Fallback: find first tab with a file_url
    const downloadTab = visibleTabs.find(t => t.file_url);
    if (downloadTab) {
      setShowWelcome(false);
      if (downloadTab.folder_id) {
        setExpandedFolders(prev => {
          const next = new Set(prev);
          next.add(downloadTab.folder_id!);
          return next;
        });
      }
      setActiveTab(downloadTab.id);
    } else {
      setShowWelcome(false);
    }
  }, [visibleTabs, folders, tabsByFolder]);

  const handleToggleSidebar = useCallback(() => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-sidebar="trigger"]');
    trigger?.click();
  }, []);

  const showWelcomePage = useCallback(() => {
    setShowWelcome(true);
  }, []);

  // Scroll to top when switching tabs
  // Update browser tab title from CMS settings
  useEffect(() => {
    if (settings.app_title) {
      document.title = settings.app_title;
    }
  }, [settings.app_title]);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Sync route location with Active Tab for Navbar navigation!
  useEffect(() => {
    const slug = location.split('/').pop();
    if (slug && visibleTabs.length > 0) {
      const match = visibleTabs.find(t => t.slug === slug);
      if (match) {
        setActiveTab(match.id);
        setShowWelcome(false);
      }
    }
  }, [location, visibleTabs]);

  // Auto-expand the folder containing the active tab
  useEffect(() => {
    const activeTabData = visibleTabs.find(t => t.id === activeTab);
    if (activeTabData?.folder_id) {
      setExpandedFolders(prev => {
        if (prev.has(activeTabData.folder_id!)) return prev;
        const next = new Set(prev);
        next.add(activeTabData.folder_id!);
        return next;
      });
    }
  }, [activeTab, visibleTabs]);

  // Wrap setActiveTab so clicking any sidebar item also dismisses the welcome page
  const handleSetActiveTab = useCallback((tabId: string) => {
    if (showWelcome || activeTree) dismissWelcome();
    setActiveTab(tabId);
  }, [showWelcome, activeTree, dismissWelcome]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Ensure active tab exists in current tabs list
  useEffect(() => {
    if (!isLoading && tabs.length > 0) {
      const tabExists = tabs.find(t => t.id === activeTab);
      if (!tabExists) {
        setActiveTab(tabs[0].id);
      }
    }
  }, [tabs, isLoading, activeTab]);

  // Scroll to matched search text after tab switch
  useEffect(() => {
    if (!pendingSearch) return;

    const query = pendingSearch;
    setPendingSearch(null);

    // Wait for the tab content to render
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = contentRef.current;
        if (!container) return;

        const lowerQuery = query.toLowerCase();
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.textContent?.toLowerCase().includes(lowerQuery)) {
            const el = node.parentElement;
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.style.transition = 'background-color 0.3s';
              el.style.backgroundColor = 'rgba(234, 179, 8, 0.3)';
              setTimeout(() => {
                el.style.backgroundColor = '';
              }, 3000);
            }
            break;
          }
        }
      }, 100);
    });
  }, [activeTab, pendingSearch]);

  const handleSearchSelect = (sectionKey: string, searchQuery?: string) => {
    if (showWelcome) dismissWelcome();
    // Auto-expand the folder containing the target tab
    const targetTab = visibleTabs.find(t => t.id === sectionKey);
    if (targetTab?.folder_id) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(targetTab.folder_id!);
        return next;
      });
    }
    setActiveTab(sectionKey);
    if (searchQuery) {
      setPendingSearch(searchQuery);
    }
  };

  // Handle anchor link clicks within markdown content
  // Supports same-tab anchors (#heading-id) and cross-tab links (#tab:slug or #tab:slug#heading-id)
  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#tab:')) {
      e.preventDefault();
      // Cross-tab link: #tab:slug or #tab:slug#heading-id
      const withoutPrefix = href.slice(5); // remove '#tab:'
      const hashIndex = withoutPrefix.indexOf('#');
      const targetSlug = hashIndex >= 0 ? withoutPrefix.slice(0, hashIndex) : withoutPrefix;
      const targetHeading = hashIndex >= 0 ? withoutPrefix.slice(hashIndex + 1) : null;

      const targetTab = tabs.find(t => t.slug === targetSlug);
      if (targetTab) {
        // Auto-expand the folder containing the target tab
        if (targetTab.folder_id) {
          setExpandedFolders(prev => {
            const next = new Set(prev);
            next.add(targetTab.folder_id!);
            return next;
          });
        }
        setActiveTab(targetTab.id);
        if (targetHeading) {
          // Wait for tab content to render, then scroll to heading
          requestAnimationFrame(() => {
            setTimeout(() => {
              const el = document.getElementById(targetHeading);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 150);
          });
        }
      }
    } else if (href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.slice(1);
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [tabs]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Retained Global WordPress Responsive Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 w-full bg-[#F9F9F9] flex flex-col items-center">
        
        {/* Optional Search Bar integrated below header cleanly */}
        {!showWelcome && !activeTree && (
           <div className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 flex justify-end">
             <SearchBar onResultSelect={handleSearchSelect} />
           </div>
        )}
          {activeTree ? (
            <div className="container">
              <DecisionTreeViewer
                tree={activeTree}
                onBack={handleBackFromTree}
                onNavigateToTab={handleTreeNavigateToTab}
                isAuthenticated={isAuthenticated}
              />
            </div>
          ) : showWelcome ? (
            <div className="container">
              <WelcomePage onGetStarted={dismissWelcome} onSearchFocus={handleSearchFocus} onFindDownloads={handleFindDownloads} onToggleSidebar={handleToggleSidebar} onNavigate={setLocation} onSelectTree={handleSelectTree} decisionTrees={decisionTrees} banner={settings.welcome_banner} isAuthenticated={isAuthenticated} />
            </div>
          ) : (
          <div className="container py-8 md:py-12">
            <Tabs value={activeTab} onValueChange={handleSetActiveTab} className="space-y-8">

          {/* Content Rendering */}
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {tab.folder_id === downloadsFolderId && downloadsFolderId ? (
                /* Downloads folder: centered list with direct download buttons */
                <>
                  <div className="max-w-3xl mx-auto space-y-4 text-center">
                    <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
                      Downloads
                    </h2>
                    <p className="text-muted-foreground">
                      Click any item below to download it directly.
                    </p>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="max-w-3xl mx-auto space-y-3">
                    {(tabsByFolder.get(downloadsFolderId) || []).map((dlTab) => (
                      <Card key={dlTab.id} className="transition-colors hover:border-[var(--color-brand-accent)]/40 hover:shadow-md">
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-[var(--color-brand-accent)]/10 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-[var(--color-brand-accent)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-heading font-semibold text-sm text-foreground leading-tight">
                                {dlTab.label}
                              </h3>
                              {dlTab.content && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {dlTab.content.replace(/^#+\s+/gm, '').replace(/[*_`[\]]/g, '').split('\n').find(l => l.trim()) || ''}
                                </p>
                              )}
                            </div>
                            {dlTab.file_url ? (
                              <a
                                href={dlTab.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                              >
                                <Button size="sm" className="gap-1.5 flex-shrink-0">
                                  <Download className="h-4 w-4" />
                                  Download
                                </Button>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic flex-shrink-0">Coming soon</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : tab.file_url && tab.file_url.toLowerCase().endsWith('.pdf') ? (
                /* PDF tabs: inline PDF viewer, Gamma Presentation style */
                <>
                  <div className="max-w-6xl mx-auto space-y-4 px-4 text-center pb-8 border-b border-gray-200">
                    <h2 className="font-heading text-4xl lg:text-5xl font-extrabold">
                      {renderGradientHeading(tab.label)}
                    </h2>
                  </div>

                  <div className="w-full max-w-6xl mx-auto mt-8 bg-black/5 p-2 md:p-6 rounded-xl shadow-inner">
                    <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200/60">
                       <PDFViewer fileUrl={tab.file_url} title={tab.label} />
                    </div>
                  </div>
                </>
              ) : tab.file_url ? (
                /* Non-PDF downloadable files: TOC + Download side-by-side */
                <>
                  <div className="max-w-4xl space-y-4">
                    <h2 className="font-heading text-3xl font-bold md:text-4xl">
                      {renderGradientHeading(tab.label)}
                    </h2>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <TableOfContents content={stripGoogleDocsHeaderIds(tab.content)} maxDepth={tab.toc_max_depth ?? undefined} />
                    </div>
                    <Card className="bg-accent/5 border-accent/20">
                      <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <a
                            href={tab.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Button size="lg" className="h-14 px-10 rounded-full bg-gradient-to-r from-[#D5B13A] to-[#B5BDC6] text-white font-bold tracking-widest hover:opacity-90 hover:shadow-xl transition-all border-none shadow-lg gap-2">
                              <Download className="h-5 w-5" />
                              Download {tab.label}
                            </Button>
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-card shadow-sm">
                    <CardContent className="pt-6">
                      <div ref={contentRef} className="prose prose-stone dark:prose-invert max-w-none prose-headings:font-heading prose-a:text-primary prose-strong:text-primary">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSlug]}
                          components={{
                            a: ({ href, children, ...props }) => (
                              <a
                                href={href}
                                onClick={(e) => href && handleAnchorClick(e, href)}
                                {...props}
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {stripGoogleDocsHeaderIds(tab.content)}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                /* Standard Content Tabs */
                <>
                  <div className="max-w-4xl space-y-4">
                    <h2 className="font-heading text-3xl font-bold md:text-4xl">
                      {renderGradientHeading(tab.label)}
                    </h2>
                  </div>

                  <Separator className="bg-border/60" />

                  <TableOfContents content={stripGoogleDocsHeaderIds(tab.content)} maxDepth={tab.toc_max_depth ?? undefined} />

                  <Card className="bg-card shadow-sm">
                    <CardContent className="pt-6">
                      <div ref={contentRef} className="prose prose-stone dark:prose-invert max-w-none prose-headings:font-heading prose-a:text-primary prose-strong:text-primary">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSlug]}
                          components={{
                            a: ({ href, children, ...props }) => (
                              <a
                                href={href}
                                onClick={(e) => href && handleAnchorClick(e, href)}
                                {...props}
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {stripGoogleDocsHeaderIds(tab.content)}
                        </ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
          </div>
          )}
        </main>

        <footer className="w-full border-t border-gray-100 bg-white mt-16">
          <div className="container mx-auto px-4 py-12">
            {settings.footer_sections && settings.footer_sections.length > 0 && (
              <>
                <div className={`grid gap-8 ${settings.footer_sections.length === 1 ? '' : settings.footer_sections.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                  {settings.footer_sections.map((section, index) => (
                    <div key={index}>
                      <h4 className="font-heading font-bold mb-3 text-[var(--color-brand-dark)]">{section.title}</h4>
                      <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripGoogleDocsHeaderIds(section.content)}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-8" />
              </>
            )}
            <div className="flex flex-col items-center">
              <img 
                src="/images/carlorbiz-logo.webp" 
                alt="Carlorbiz Logo" 
                className="h-16 mb-5 w-auto object-contain"
              />
              <p className="text-xs text-gray-400 font-body uppercase tracking-wider">
                {settings.footer_text || `© Carla Taylor t/as Carlorbiz, ${new Date().getFullYear()}`}
              </p>
            </div>
          </div>
        </footer>

      {/* Back to Top Button */}
      <BackToTop />
    </div>
  );
}
