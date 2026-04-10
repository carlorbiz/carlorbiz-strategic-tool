-- Seed: Services page folder + 4 tabs
-- Requires migration 20260405000000_add_accordion_fields_to_tabs.sql to be applied first.

-- Insert the Services folder
INSERT INTO folders (slug, label, icon, order_index)
VALUES ('services', 'Services', 'briefcase', 100)
ON CONFLICT (slug) DO NOTHING;

-- Tab 1: Strategic Consulting (PDF)
INSERT INTO tabs (
  slug, label, icon, content, order_index,
  is_supplementary, is_visible, folder_id, file_url,
  toc_max_depth, requires_auth, content_type, summary, description
)
SELECT
  'strategic-consulting',
  'Strategic Consulting',
  'file-text',
  '',
  1,
  false,
  true,
  (SELECT id FROM folders WHERE slug = 'services'),
  NULL,
  NULL,
  false,
  'pdf',
  'Finding your point of difference and building everything around it.',
  E'Strategic transformation starts with one question: what can you do that no one else can?\n\nThe DAIS methodology begins with Discover — genuine investigation into what makes your organisation irreplaceable before a single strategic priority is named. Then we Architect everything around that advantage. The deliverable isn''t a document. It''s structure you can actually build from.\n\nThe proof: a government-funded healthcare workforce agency needed a 2026-2030 strategic plan that would stay alive, not gather dust. We built both the plan and the implementation toolkit together.'
WHERE NOT EXISTS (
  SELECT 1 FROM tabs WHERE slug = 'strategic-consulting'
    AND folder_id = (SELECT id FROM folders WHERE slug = 'services')
);

-- Tab 2: AI-Powered Knowledge Systems (PDF)
INSERT INTO tabs (
  slug, label, icon, content, order_index,
  is_supplementary, is_visible, folder_id, file_url,
  toc_max_depth, requires_auth, content_type, summary, description
)
SELECT
  'ai-powered-knowledge-systems',
  'AI-Powered Knowledge Systems',
  'brain-circuit',
  '',
  2,
  false,
  true,
  (SELECT id FROM folders WHERE slug = 'services'),
  NULL,
  NULL,
  false,
  'pdf',
  'When your biggest challenge is getting the right knowledge to the right people — this is what we build.',
  E'Most organisations sit on deep, valuable expertise that never gets fully leveraged. It lives in people''s heads, in documents nobody reads, in institutional knowledge that walks out the door with every leadership transition.\n\nWhen the DAIS methodology reveals that the core problem is inaccessible knowledge — this is the solution. We Architect a knowledge platform around your specific domain, Implement it with an embedded AI assistant trained on your verified content, and build the Sustain infrastructure so it keeps working without ongoing developer dependency.\n\nThe proof: Australia''s rural and remote medical training body needed complex regulatory knowledge to be consistently accessible to a small national team and a geographically dispersed stakeholder base. We built a complete digital knowledge platform. 40-page policy documents replaced by a 3-minute guided decision tree. From "I don''t know" to instant authority.'
WHERE NOT EXISTS (
  SELECT 1 FROM tabs WHERE slug = 'ai-powered-knowledge-systems'
    AND folder_id = (SELECT id FROM folders WHERE slug = 'services')
);

-- Tab 3: Transformation Staging (text/markdown)
INSERT INTO tabs (
  slug, label, icon, content, order_index,
  is_supplementary, is_visible, folder_id, file_url,
  toc_max_depth, requires_auth, content_type, summary, description
)
SELECT
  'transformation-staging',
  'Transformation Staging',
  'layers',
  E'Digital transformation done well is a competitive advantage. Done badly — or done too fast, without stopping to check what else needs to align — it creates something worse than standing still. It creates visible inconsistency. And visible inconsistency destroys trust faster than any competitor ever could.\n\nThe digital doom loop is real. Organisations pour investment into new platforms, new tools, new websites — and then wonder why stakeholder confidence isn''t following. The answer is almost always the same: the digital front door got an upgrade, but the experience behind it didn''t.\n\nTransformation Staging is the process of mapping every touchpoint — digital and human — before change begins. Not to slow things down, but to sequence them deliberately. So your platform, your people, your phone manner, your meeting conduct, and your community presence all tell the same story at the same time.\n\nBecause if your website promises one thing and your team delivers another, the website is working against you.\n\nThis is where strategic consulting and technology capability meet. Carlorbiz doesn''t build platforms in isolation — we build them inside a plan.\n\n---\n\n*Further reading: [The Digital Doom Loop](https://makethemostoftoday.com)*',
  3,
  false,
  true,
  (SELECT id FROM folders WHERE slug = 'services'),
  NULL,
  NULL,
  false,
  'text',
  'A flashy new platform means nothing if your phone system still plays hold music from the 1980s.',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM tabs WHERE slug = 'transformation-staging'
    AND folder_id = (SELECT id FROM folders WHERE slug = 'services')
);

-- Tab 4: See It Working (nera)
INSERT INTO tabs (
  slug, label, icon, content, order_index,
  is_supplementary, is_visible, folder_id, file_url,
  toc_max_depth, requires_auth, content_type, summary, description
)
SELECT
  'see-it-working',
  'See It Working',
  'sparkles',
  '',
  4,
  false,
  true,
  (SELECT id FROM folders WHERE slug = 'services'),
  NULL,
  NULL,
  false,
  'nera',
  'This site runs on exactly what we build for clients. Ask Nera anything.',
  E'This site is built on the same platform we build for clients. It''s not a brochure — it''s a stage.\n\nNera is the embedded AI assistant trained on Carlorbiz''s knowledge. Ask her about the DAIS methodology, what a knowledge platform engagement looks like, or how Transformation Staging might apply to your organisation.'
WHERE NOT EXISTS (
  SELECT 1 FROM tabs WHERE slug = 'see-it-working'
    AND folder_id = (SELECT id FROM folders WHERE slug = 'services')
);
