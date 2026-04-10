export interface ThemeSettings {
  primary_color: string; // Hex code
  secondary_color: string; // Hex code
  font_heading: string; // Font family name
  font_body: string; // Font family name
  radius: string; // e.g., '0.5rem'
}

export interface FooterSection {
  title: string;
  content: string; // Can be plain text or markdown for lists
}

export interface WelcomeBanner {
  enabled: boolean;
  content: string; // Markdown
}

export interface AppSettings {
  id: string;
  app_title: string;
  header_subtitle: string;
  footer_text: string; // Copyright line at bottom
  footer_links: { label: string; url: string }[];
  footer_sections: FooterSection[]; // The 3-column footer sections
  welcome_banner: WelcomeBanner | null;
  theme: ThemeSettings;
}

export interface TabFolder {
  id: string;
  slug: string;
  label: string;
  icon: string;
  order_index: number;
}

export type TabContentType = 'video' | 'pdf' | 'text' | 'cards' | 'nera' | 'decision-tree';

export interface TabContent {
  id: string;
  slug: string; // e.g., 'acknowledgement', 'executiveSummary'
  label: string;
  icon: string;
  content: string; // Markdown content
  order_index: number;
  is_supplementary: boolean; // If true, goes in the bottom box
  is_visible: boolean;
  folder_id: string | null;
  file_url: string | null; // URL to downloadable file in Supabase storage
  toc_max_depth: number | null; // Max heading level shown in TOC (e.g. 2 = H2 only, 4 = H2-H4)
  requires_auth: boolean; // If true, only visible to authenticated users (TPAs + admins)
  content_type: TabContentType; // Determines which renderer to use in AccordionPage
  summary: string | null; // 1-line teaser shown in collapsed accordion header
  page_slug: string | null; // Groups tabs into accordion pages (e.g. 'about-me', 'services')
  description: string | null; // Short intro text shown above content (for PDFs, Nera intros, decision tree intros)
}

// Decision Tree types

export interface DecisionTreeResultNode {
  type: 'result';
  id: string;
  title: string;
  content_markdown?: string;       // Static markdown content for this result
  image_url?: string;              // Prominent screenshot/image for this node
  image_alt?: string;              // Alt text for the image
  source_tab_slug?: string;        // Tab slug to sync content from
  source_section?: string;         // Heading within that tab to extract
  last_synced_at?: string;         // ISO timestamp of last sync from source tab
}

export interface DecisionTreeQuestionNode {
  id: string;
  question: string;
  help_text?: string;
  image_url?: string;              // Screenshot shown alongside the question
  image_alt?: string;              // Alt text for the image
  options: {
    label: string;
    next: DecisionTreeNode;
  }[];
}

export type DecisionTreeNode = DecisionTreeQuestionNode | DecisionTreeResultNode;

export interface DecisionTree {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  tree_data: DecisionTreeNode;
  requires_auth: boolean;
  is_visible: boolean;
  order_index: number;
  category: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CMSData {
  settings: AppSettings;
  tabs: TabContent[];
  folders: TabFolder[];
  decisionTrees: DecisionTree[];
}
