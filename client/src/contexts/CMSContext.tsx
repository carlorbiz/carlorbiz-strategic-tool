import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CMSData, TabContent, TabFolder, AppSettings, DecisionTree } from '@/types/cms';

// Default Data (Fallback)
const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  app_title: 'Carlorbiz — Strategic Consulting',
  header_subtitle: 'Growth · Strategy',
  footer_text: '© Carla Taylor t/as Carlorbiz',
  footer_links: [],
  footer_sections: [
    {
      title: 'About',
      content: 'Strategic consulting for leaders navigating disruption, AI adoption, and organisational transformation.'
    },
    {
      title: 'Connect',
      content: '[carla@carlorbiz.com.au](mailto:carla@carlorbiz.com.au)'
    },
    {
      title: 'MTMOT',
      content: 'Tools, courses, and coaching at [makethemostoftoday.com](https://makethemostoftoday.com)'
    }
  ],
  welcome_banner: null,
  theme: {
    primary_color: '#2F5233', // Deep Forest Green
    secondary_color: '#D9EAD3', // Soft Sage Green
    font_heading: 'Merriweather',
    font_body: 'Inter',
    radius: '0.75rem'
  }
};

const DEFAULT_FOLDERS: TabFolder[] = [
  {
    id: 'folder-handbook',
    slug: 'handbook',
    label: 'The Handbook',
    icon: '',
    order_index: 0
  },
  {
    id: 'folder-resources',
    slug: 'resources',
    label: 'Resources & Tools',
    icon: '',
    order_index: 1
  }
];

const DEFAULT_TABS: TabContent[] = [
  {
    id: 'welcome',
    slug: 'welcome',
    label: 'Welcome',
    icon: '',
    content: '# Welcome\n\nThis is your Resource Hub. Content will be loaded from Supabase once configured.',
    order_index: 0,
    is_supplementary: false,
    is_visible: true,
    folder_id: null,
    file_url: null,
    toc_max_depth: null,
    requires_auth: false,
    content_type: 'text',
    summary: null,
    page_slug: null
  }
];

interface CMSContextType {
  settings: AppSettings;
  tabs: TabContent[];
  folders: TabFolder[];
  decisionTrees: DecisionTree[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateTab: (tab: TabContent) => Promise<void>;
  createTab: (tab: Omit<TabContent, 'id'>) => Promise<void>;
  deleteTab: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  createFolder: (folder: Omit<TabFolder, 'id'>) => Promise<void>;
  updateFolder: (folder: TabFolder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createDecisionTree: (tree: Omit<DecisionTree, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDecisionTree: (tree: DecisionTree) => Promise<void>;
  deleteDecisionTree: (id: string) => Promise<void>;
  getTabsByPageSlug: (pageSlug: string) => TabContent[];
}

const CMSContext = createContext<CMSContextType | undefined>(undefined);

export function CMSProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tabs, setTabs] = useState<TabContent[]>(DEFAULT_TABS);
  const [folders, setFolders] = useState<TabFolder[]>(DEFAULT_FOLDERS);
  const [decisionTrees, setDecisionTrees] = useState<DecisionTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme) {
      // Convert hex to OKLCH or just use hex directly if supported by Tailwind config
      // For simplicity in this context, we'll set CSS variables that Tailwind can use
      // Note: Tailwind 4 uses OKLCH by default, but we can override with hex
      
      // We need to update the style tag or root style
      root.style.setProperty('--primary-color', settings.theme.primary_color);
      root.style.setProperty('--secondary-color', settings.theme.secondary_color);
      root.style.setProperty('--radius', settings.theme.radius);
      root.style.setProperty('--font-heading', settings.theme.font_heading);
      root.style.setProperty('--font-body', settings.theme.font_body);
    }
  }, [settings.theme]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, using default data');
      setSettings(DEFAULT_SETTINGS);
      setTabs(DEFAULT_TABS);
      setFolders(DEFAULT_FOLDERS);
      setIsLoading(false);
      return;
    }

    // Safety-net timeout — individual fetches have their own 30s abort (supabase.ts).
    // This only fires if something unexpected hangs beyond that.
    const timeoutId = setTimeout(() => {
      console.warn('CMS fetch timed out, using default data');
      setIsLoading(false);
    }, 45000);

    try {
      if (!supabase) {
        clearTimeout(timeoutId);
        setIsLoading(false);
        return;
      }

      // Fetch Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching settings:', settingsError);
      } else if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch Tabs
      const { data: tabsData, error: tabsError } = await supabase
        .from('tabs')
        .select('*')
        .order('order_index', { ascending: true });

      if (tabsError) {
        console.error('Error fetching tabs:', tabsError);
      } else if (tabsData && tabsData.length > 0) {
        // Normalize folder_id: Supabase rows may not have this column yet,
        // so undefined must become null to match the Map grouping logic
        setTabs(tabsData.map(t => ({ ...t, folder_id: t.folder_id ?? null, file_url: t.file_url ?? null, toc_max_depth: t.toc_max_depth ?? null, requires_auth: t.requires_auth ?? false, content_type: t.content_type ?? 'text', summary: t.summary ?? null, page_slug: t.page_slug ?? null })));
      } else {
        console.log('No tabs found in DB, using defaults');
        setTabs(DEFAULT_TABS);
      }

      // Fetch Folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .order('order_index', { ascending: true });

      if (foldersError) {
        console.error('Error fetching folders:', foldersError);
      } else if (foldersData && foldersData.length > 0) {
        setFolders(foldersData);
      } else {
        console.log('No folders found in DB, using defaults');
        setFolders(DEFAULT_FOLDERS);
      }

      // Fetch Decision Trees
      const { data: treesData, error: treesError } = await supabase
        .from('decision_trees')
        .select('*')
        .order('order_index', { ascending: true });

      if (treesError) {
        console.error('Error fetching decision trees:', treesError);
      } else if (treesData) {
        setDecisionTrees(treesData);
      }

      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Unexpected error fetching CMS data:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to check if a string is a valid UUID
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const updateTab = async (updatedTab: TabContent) => {
    if (!isSupabaseConfigured() || !supabase) {
      setTabs(prev => prev.map(t => t.id === updatedTab.id ? updatedTab : t));
      return;
    }

    // If the ID is not a valid UUID, it's a default tab that needs to be inserted
    if (!isValidUUID(updatedTab.id)) {
      const { id, ...tabWithoutId } = updatedTab;
      const { error } = await supabase
        .from('tabs')
        .insert(tabWithoutId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tabs')
        .upsert(updatedTab);

      if (error) throw error;
    }

    // Update local state immediately so the UI reflects the save
    setTabs(prev => prev.map(t => t.id === updatedTab.id ? updatedTab : t));
    // Refresh from DB in background (don't block the caller / toast)
    fetchData().catch(() => {});
  };

  const createTab = async (newTab: Omit<TabContent, 'id'>) => {
    if (!isSupabaseConfigured() || !supabase) {
      const mockTab = { ...newTab, id: `temp-${Date.now()}` };
      setTabs(prev => [...prev, mockTab]);
      return;
    }

    const { error } = await supabase
      .from('tabs')
      .insert(newTab);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const deleteTab = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      setTabs(prev => prev.filter(t => t.id !== id));
      return;
    }

    const { error } = await supabase
      .from('tabs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const createFolder = async (newFolder: Omit<TabFolder, 'id'>) => {
    if (!isSupabaseConfigured() || !supabase) {
      const mockFolder = { ...newFolder, id: `temp-folder-${Date.now()}` };
      setFolders(prev => [...prev, mockFolder]);
      return;
    }

    const { error } = await supabase
      .from('folders')
      .insert(newFolder);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const updateFolder = async (updatedFolder: TabFolder) => {
    if (!isSupabaseConfigured() || !supabase) {
      setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
      return;
    }

    if (!isValidUUID(updatedFolder.id)) {
      const { id, ...folderWithoutId } = updatedFolder;
      const { error } = await supabase
        .from('folders')
        .insert(folderWithoutId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('folders')
        .upsert(updatedFolder);

      if (error) throw error;
    }

    fetchData().catch(() => {});
  };

  const deleteFolder = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      setFolders(prev => prev.filter(f => f.id !== id));
      // Unassign tabs from this folder
      setTabs(prev => prev.map(t => t.folder_id === id ? { ...t, folder_id: null } : t));
      return;
    }

    // Unassign tabs from this folder first
    const { error: tabsError } = await supabase
      .from('tabs')
      .update({ folder_id: null })
      .eq('folder_id', id);

    if (tabsError) throw tabsError;

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const createDecisionTree = async (newTree: Omit<DecisionTree, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseConfigured() || !supabase) {
      const mockTree = { ...newTree, id: `temp-tree-${Date.now()}` } as DecisionTree;
      setDecisionTrees(prev => [...prev, mockTree]);
      return;
    }

    const { error } = await supabase
      .from('decision_trees')
      .insert(newTree);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const updateDecisionTree = async (updatedTree: DecisionTree) => {
    if (!isSupabaseConfigured() || !supabase) {
      setDecisionTrees(prev => prev.map(t => t.id === updatedTree.id ? updatedTree : t));
      return;
    }

    const { created_at, updated_at, ...treeData } = updatedTree;
    const { error } = await supabase
      .from('decision_trees')
      .upsert(treeData);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const deleteDecisionTree = async (id: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      setDecisionTrees(prev => prev.filter(t => t.id !== id));
      return;
    }

    const { error } = await supabase
      .from('decision_trees')
      .delete()
      .eq('id', id);

    if (error) throw error;
    fetchData().catch(() => {});
  };

  const getTabsByPageSlug = (pageSlug: string): TabContent[] => {
    return tabs
      .filter(t => t.page_slug === pageSlug && t.is_visible)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const updateSettings = async (updatedSettings: AppSettings) => {
    if (!isSupabaseConfigured() || !supabase) {
      setSettings(updatedSettings);
      return;
    }

    // Only send columns that exist in the DB table.
    // footer_sections and welcome_banner require a migration to add them.
    const dbRow: Record<string, unknown> = {
      id: updatedSettings.id,
      app_title: updatedSettings.app_title,
      header_subtitle: updatedSettings.header_subtitle,
      footer_text: updatedSettings.footer_text,
      footer_links: updatedSettings.footer_links,
      theme: updatedSettings.theme,
    };

    // Include optional columns only if they were loaded from DB
    // (i.e. the migration has been run and the column exists).
    if ('footer_sections' in settings) {
      dbRow.footer_sections = updatedSettings.footer_sections;
    }
    if ('welcome_banner' in settings) {
      dbRow.welcome_banner = updatedSettings.welcome_banner;
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(dbRow);

    if (error) throw error;
    fetchData().catch(() => {});
  };


  return (
    <CMSContext.Provider value={{
      settings,
      tabs,
      folders,
      decisionTrees,
      isLoading,
      error,
      refreshData: fetchData,
      updateTab,
      createTab,
      deleteTab,
      updateSettings,
      createFolder,
      updateFolder,
      deleteFolder,
      createDecisionTree,
      updateDecisionTree,
      deleteDecisionTree,
      getTabsByPageSlug
    }}>
      {children}
    </CMSContext.Provider>
  );
}

export function useCMS() {
  const context = useContext(CMSContext);
  if (context === undefined) {
    throw new Error('useCMS must be used within a CMSProvider');
  }
  return context;
}
