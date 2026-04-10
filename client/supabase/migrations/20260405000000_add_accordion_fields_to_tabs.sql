-- Add columns needed for accordion-based pages
ALTER TABLE tabs
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('video', 'pdf', 'text', 'cards', 'nera')),
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN tabs.content_type IS 'Renderer type for accordion content: video, pdf, text, cards, nera';
COMMENT ON COLUMN tabs.summary IS '1-line teaser shown in collapsed accordion header';
COMMENT ON COLUMN tabs.description IS 'Short intro text shown above PDF/video content when accordion opens';
