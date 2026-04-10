-- Add content_type and summary columns to tabs table
-- content_type determines which renderer to use in the AccordionPage component
-- summary is a 1-line teaser shown in collapsed accordion headers

ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('video', 'pdf', 'text', 'cards')),
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS page_slug TEXT;

-- Index for efficient filtering by page_slug
CREATE INDEX IF NOT EXISTS idx_tabs_page_slug ON tabs (page_slug);
