import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, FileDown, Home, LogIn, LogOut, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { TabContent, TabFolder } from "@/types/cms";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarNavigationProps {
  folders: TabFolder[];
  tabs: TabContent[];
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  showWelcome?: boolean;
  onShowWelcome?: () => void;
}

export function SidebarNavigation({
  folders,
  tabs,
  activeTab,
  setActiveTab,
  showWelcome,
  onShowWelcome,
}: SidebarNavigationProps) {
  const { isAuthenticated, profile, signOut } = useAuth();
  const [, setLocation] = useLocation();

  // Track which folder is expanded (only one at a time for accordion behavior)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(folders[0]?.id || null);

  // Group tabs by folder
  const tabsByFolder = useMemo(() => {
    const map = new Map<string | null, TabContent[]>();
    tabs.forEach((tab) => {
      const key = tab.folder_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tab);
    });
    // Sort tabs within each folder by order_index
    map.forEach((folderTabs) => {
      folderTabs.sort((a, b) => a.order_index - b.order_index);
    });
    return map;
  }, [tabs]);

  // Toggle folder expansion (accordion: only one open at a time)
  const toggleFolder = (folderId: string) => {
    setExpandedFolder(prev => prev === folderId ? null : folderId);
  };

  const isAdmin = profile?.role === 'internal_admin' || profile?.role === 'client_admin';

  return (
    <Sidebar>
      <SidebarContent>
        {/* Welcome / Home link */}
        {onShowWelcome && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowWelcome}
                  isActive={showWelcome}
                  className={
                    showWelcome
                      ? "border-l-3 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium min-h-10 h-auto py-2.5 leading-tight"
                      : "text-sidebar-foreground/85 hover:bg-transparent hover:text-sidebar-foreground hover:ring-2 hover:ring-sidebar-primary min-h-10 h-auto py-2.5 leading-tight"
                  }
                >
                  <Home className="h-4 w-4 mr-2" />
                  Welcome
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Render folders with accordion behavior */}
        {folders.map((folder) => {
          const folderTabs = tabsByFolder.get(folder.id) || [];
          if (folderTabs.length === 0) return null;

          // Downloads folder: single clickable item, no accordion
          if (folder.slug === 'downloads') {
            const isActive = folderTabs.some(t => t.id === activeTab);
            return (
              <SidebarGroup key={folder.id}>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveTab(folderTabs[0].id)}
                      isActive={isActive}
                      className={
                        isActive
                          ? "border-l-3 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium min-h-10 h-auto py-2.5 leading-tight"
                          : "text-sidebar-foreground/85 hover:bg-transparent hover:text-sidebar-foreground hover:ring-2 hover:ring-sidebar-primary min-h-10 h-auto py-2.5 leading-tight"
                      }
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      {folder.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            );
          }

          const isExpanded = expandedFolder === folder.id;

          return (
            <SidebarGroup key={folder.id}>
              <SidebarGroupLabel
                onClick={() => toggleFolder(folder.id)}
                className="text-xs font-bold uppercase tracking-wide text-sidebar-foreground/60 cursor-pointer hover:text-sidebar-foreground/80 transition-colors flex items-center justify-between group"
              >
                <span>{folder.label}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </SidebarGroupLabel>
              {isExpanded && (
                <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                  <SidebarMenu>
                    {folderTabs.map((tab) => (
                      <SidebarMenuItem key={tab.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveTab(tab.id)}
                          isActive={activeTab === tab.id}
                          className={
                            activeTab === tab.id
                              ? "border-l-3 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium min-h-10 h-auto py-2.5 leading-tight"
                              : "text-sidebar-foreground/85 hover:bg-transparent hover:text-sidebar-foreground hover:ring-2 hover:ring-sidebar-primary min-h-10 h-auto py-2.5 leading-tight"
                          }
                        >
                          {tab.label}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              )}
            </SidebarGroup>
          );
        })}

        {/* Standalone tabs (no folder) */}
        {tabsByFolder.get(null) && tabsByFolder.get(null)!.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wide text-sidebar-foreground/60">
              Other
            </SidebarGroupLabel>
            <SidebarMenu>
              {tabsByFolder.get(null)!.map((tab) => (
                <SidebarMenuItem key={tab.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveTab(tab.id)}
                    isActive={activeTab === tab.id}
                    className={
                      activeTab === tab.id
                        ? "border-l-3 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium min-h-10 h-auto py-2.5 leading-tight"
                        : "text-sidebar-foreground/85 hover:bg-transparent hover:text-sidebar-foreground hover:ring-2 hover:ring-sidebar-primary min-h-10 h-auto py-2.5 leading-tight"
                    }
                  >
                    {tab.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Auth footer */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {isAuthenticated ? (
          <div className="space-y-2">
            <p className="text-xs text-sidebar-foreground/50 truncate px-1">
              {profile?.email}
            </p>
            <div className="flex gap-1">
              {isAdmin && (
                <button
                  onClick={() => setLocation("/admin")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors flex-1"
                >
                  <Shield className="h-3 w-3" />
                  Admin
                </button>
              )}
              <button
                onClick={async () => { await signOut(); setLocation("/"); }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors flex-1"
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setLocation("/login")}
            className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors w-full"
          >
            <LogIn className="h-3 w-3" />
            Team Login
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
