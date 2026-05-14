// =============================================================================
// scripts/seed-rural-futures-australia.ts
//
// One-time bulk seed for the Rural Futures Australia demo engagement.
// Uploads PDFs from docs/demo-3-abstracts/ → st-documents storage bucket,
// creates st_documents rows with rich research metadata (authors, journal,
// year, DOI, external link), links each abstract to its primary Theme and
// Discipline lenses, then POSTs to st-ingest-document so chunks land in
// knowledge_chunks.
//
// Usage:
//   $env:SUPABASE_SERVICE_ROLE_KEY="..." ; npx tsx scripts/seed-rural-futures-australia.ts
//   $env:SUPABASE_SERVICE_ROLE_KEY="..." ; npx tsx scripts/seed-rural-futures-australia.ts --limit 1
//   $env:SUPABASE_SERVICE_ROLE_KEY="..." ; npx tsx scripts/seed-rural-futures-australia.ts --only Bradford
//
// Idempotency: if a document with the same DOI already exists for this
// engagement, the script skips it. Storage uploads use a timestamped path so
// they never collide; re-running cleanly re-processes anything that wasn't
// already done.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = 'https://lgcmjneodjrtjtwbomsj.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  console.error('Set it in your shell before running:');
  console.error('  $env:SUPABASE_SERVICE_ROLE_KEY="..." ; npx tsx scripts/seed-rural-futures-australia.ts');
  process.exit(1);
}

const ENGAGEMENT_ID = 'a1b2c3d4-0003-4000-8000-000000000001';
const PDF_DIR = 'docs/demo-3-abstracts';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Theme + discipline commitment IDs (from seed SQL) ──────────────────────

const THEMES = {
  integrated_care: 'c0000001-0003-4000-8000-000000000001',
  digital_health: 'c0000001-0003-4000-8000-000000000002',
  workforce: 'c0000001-0003-4000-8000-000000000003',
  knowledge_networks: 'c0000001-0003-4000-8000-000000000004',
} as const;

const DISC = {
  allied_health: 'c0000003-0003-4000-8000-000000000001',
  gp_generalism: 'c0000003-0003-4000-8000-000000000002',
  indigenous: 'c0000003-0003-4000-8000-000000000003',
  paediatric: 'c0000003-0003-4000-8000-000000000004',
  pharmacy: 'c0000003-0003-4000-8000-000000000005',
  nursing_paramed: 'c0000003-0003-4000-8000-000000000006',
  policy: 'c0000003-0003-4000-8000-000000000007',
} as const;

// ── The 19 abstract mappings ───────────────────────────────────────────────
// (Reed et al. 2021 — interprofessional simulation — PDF unavailable, skipped.)

interface AbstractMeta {
  filename: string;
  title: string;
  authors: string;
  institution: string | null;
  year: number;
  journal: string;
  doi: string;
  externalLink: string;
  takeaway: string;
  primaryThemeId: string;
  disciplineIds: string[];
}

const ABSTRACTS: AbstractMeta[] = [
  {
    filename: '1-s2.0-S0168851025000600-main.pdf',
    title: 'Fostering integrated healthcare in rural Australia: A review of service models for older Australians with preventable chronic conditions',
    authors: 'M. Hamiduzzaman, V. McLennan, H. Gaffney, Sarah Miles, Sarah Crook, Lewis Grove, Matthew Gray, V. Flood',
    institution: null,
    year: 2025,
    journal: 'Health Policy',
    doi: '10.1016/j.healthpol.2025.105304',
    externalLink: 'https://doi.org/10.1016/j.healthpol.2025.105304',
    takeaway: 'Integrated healthcare models in rural Australia show promise in improving patient and healthcare outcomes for older adults with preventable chronic conditions.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.gp_generalism, DISC.policy],
  },
  {
    filename: 's12889-020-08912-1.pdf',
    title: 'Rural chronic disease research patterns in the United Kingdom, United States, Canada, Australia and New Zealand: a systematic integrative review',
    authors: 'Rebecca T Disler, K. Glenister, Julian R Wright',
    institution: null,
    year: 2019,
    journal: 'BMC Public Health',
    doi: '10.1186/s12889-020-08912-1',
    externalLink: 'https://doi.org/10.1186/s12889-020-08912-1',
    takeaway: 'Innovative service models and telehealth are well-represented in rural chronic disease research, but data on health outcomes is sparse.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.gp_generalism, DISC.indigenous, DISC.policy],
  },
  {
    filename: 'Australian J Rural Health - 2024 - Hyett - Rural community‐centred co‐planning for sustainable rural health systems.pdf',
    title: 'Rural community-centred co-planning for sustainable rural health systems',
    authors: 'Nerida Hyett, Mandy Hutchinson, D. Doyle, Trevor Adem, Dallas Coghill, Pam Harvey, Catherine Lees, Belinda G O\'Sullivan',
    institution: 'La Trobe University Rural Health School',
    year: 2024,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.13162',
    externalLink: 'https://doi.org/10.1111/ajr.13162',
    takeaway: 'Community-centred co-design with rural health stakeholders generates locally tailored ideas and improves rural health system sustainability through workforce strengthening, integrated services, and innovative models of care.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.gp_generalism, DISC.policy],
  },
  {
    filename: 'py23135.pdf',
    title: 'Healthy ageing in remote Cape York: a co-designed Integrated Allied Health Service Model',
    authors: 'Alice Cairns, Danielle Rodda, Frances Wymarra, Katrina Bird',
    institution: 'James Cook University',
    year: 2024,
    journal: 'Australian Journal of Primary Health',
    doi: '10.1071/py23135',
    externalLink: 'https://doi.org/10.1071/py23135',
    takeaway: 'The Integrated Allied Health Service Model in remote Cape York improves access to healthcare services, delivers targeted rehabilitation, and addresses community and workforce capacity needs for adults with chronic disease, disability, or frailty.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.allied_health, DISC.indigenous, DISC.gp_generalism],
  },
  {
    filename: 'Australian J Rural Health - 2024 - Argus - Sustaining multidisciplinary teams in rural and remote primary care.pdf',
    title: 'Sustaining multidisciplinary teams in rural and remote primary care',
    authors: 'Geoffrey R. Argus',
    institution: null,
    year: 2024,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.13144',
    externalLink: 'https://doi.org/10.1111/ajr.13144',
    takeaway: 'A need-based workforce planning approach and appropriate primary care funding models are crucial for sustaining multidisciplinary health care teams in rural and remote communities.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.gp_generalism, DISC.policy],
  },
  {
    filename: 'Australian J Rural Health - 2021 - Stewart - Australia s Rural Health Multidisciplinary Training program  Preparing for the.pdf',
    title: 'Australia\'s Rural Health Multidisciplinary Training program: Preparing for the rural health workforce that Australia needs',
    authors: 'R. Stewart, Faye McMillan AM',
    institution: 'Office of the National Rural Health Commissioner',
    year: 2021,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.12808',
    externalLink: 'https://doi.org/10.1111/ajr.12808',
    takeaway: 'The Rural Health Multidisciplinary Training program is preparing a high-quality rural health workforce by incorporating innovations in education, rural models of care, service learning, and longer, high-quality rural placements.',
    primaryThemeId: THEMES.workforce,
    disciplineIds: [DISC.indigenous, DISC.gp_generalism, DISC.policy],
  },
  {
    filename: 'py23023.pdf',
    title: 'A collaborative primary health care model for children and young people in rural Australia: explorations of cross-sectoral leader action',
    authors: 'S. Randall, Danielle White, Sarah Dennis',
    institution: null,
    year: 2023,
    journal: 'Australian Journal of Primary Health',
    doi: '10.1071/py23023',
    externalLink: 'https://doi.org/10.1071/py23023',
    takeaway: 'Cross-sectoral collaboration and strong change management principles can make a primary healthcare model for rural Australian children and young people transferable to other remote communities.',
    primaryThemeId: THEMES.knowledge_networks,
    disciplineIds: [DISC.paediatric, DISC.gp_generalism],
  },
  {
    filename: 'Australian J Rural Health - 2025 - Miller - Reducing Health Inequity for Children and Young People in Rural Australia  Are.pdf',
    title: 'Reducing Health Inequity for Children and Young People in Rural Australia: Are Digital Interventions a Panacea? A Rural Generalist\'s Commentary',
    authors: 'Corin Miller, H. Smithers-Sheedy, Nan Hu, D. Schmidt, Annemarie Christie, T. Morris, Lena Sanci, R. Lingam',
    institution: null,
    year: 2025,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.70015',
    externalLink: 'https://doi.org/10.1111/ajr.70015',
    takeaway: 'Digital interventions show promise in improving health outcomes for rural Australian children and young people, but are not a panacea due to infrastructure, cultural, and patient preferences limitations.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.paediatric, DISC.gp_generalism],
  },
  {
    filename: 'Australian J Rural Health - 2022 - White - Competition or collaboration in regional Australia  A cross‐border and.pdf',
    title: 'Competition or collaboration in regional Australia? A cross-border and multi-university approach to maximising rural health investments, community health and health workforce outcomes',
    authors: 'Danielle White, Debra Jones, P. Harvey, Fiona Wright, L. Tarrant, Louise Hodgetts, K. Allen, Steffanie Oxford, Andrina Mitcham, K. Livingstone',
    institution: 'Sunraysia Collaboration (NSW + VIC RHMT-funded departments)',
    year: 2022,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.12919',
    externalLink: 'https://doi.org/10.1111/ajr.12919',
    takeaway: 'The Sunraysia Collaboration mitigates potential competition between universities, maximising Rural Health Multidisciplinary Training Program investments and regional health workforce outcomes.',
    primaryThemeId: THEMES.workforce,
    disciplineIds: [DISC.policy, DISC.gp_generalism],
  },
  {
    filename: 'JMDH-360654-bridging-allied-health-professional-roles-to-improve-patient.pdf',
    title: 'Bridging Allied Health Professional Roles to Improve Patient Outcomes in Rural and Remote Australia: A Descriptive Qualitative Study',
    authors: 'S. Taylor, Aimee Culic, S. Harris, Rebecca Senini, R. Stephenson, B. Glass',
    institution: 'James Cook University',
    year: 2022,
    journal: 'Journal of Multidisciplinary Healthcare',
    doi: '10.2147/jmdh.s360654',
    externalLink: 'https://doi.org/10.2147/jmdh.s360654',
    takeaway: 'Interdisciplinary collaboration between pharmacists and allied health professionals can improve patient outcomes in rural and remote communities, but role ambiguity remains a major barrier.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.allied_health, DISC.pharmacy],
  },
  {
    filename: 'journal.pone.0331327.pdf',
    title: 'A scoping review of innovations that promote interprofessional collaboration (IPC) in primary care for older adults living with age-related chronic disease in rural areas',
    authors: 'Valerie Elliot, Julie G Kosteniuk, Duane P. Minish, C. Cameron, Megan E O\'Connell, Debra Morgan',
    institution: 'University of Saskatchewan',
    year: 2025,
    journal: 'PLOS One',
    doi: '10.1371/journal.pone.0331327',
    externalLink: 'https://doi.org/10.1371/journal.pone.0331327',
    takeaway: 'Innovations promoting interprofessional collaboration in primary care for older rural adults with age-related chronic diseases can enhance availability, earlier detection, and improved care, but face challenges and gaps in the literature.',
    primaryThemeId: THEMES.integrated_care,
    disciplineIds: [DISC.gp_generalism, DISC.allied_health],
  },
  {
    filename: 'Australian J Rural Health - 2025 - Krahe - Factors That Influence Digital Health Implementation in Rural  Regional  and.pdf',
    title: 'Factors That Influence Digital Health Implementation in Rural, Regional, and Remote Australia: An Overview of Reviews and Recommended Strategies',
    authors: 'M. Krahe, S. Baker, L. Woods, S. L. Larkins',
    institution: 'James Cook University',
    year: 2025,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.70045',
    externalLink: 'https://doi.org/10.1111/ajr.70045',
    takeaway: 'This study identified key influencing factors and recommended implementation strategies to mitigate barriers, potentially facilitating the successful implementation of digital health in rural, regional, and remote Australia.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.policy],
  },
  {
    filename: 'Medical Journal of Australia - 2024 - Osman - Beyond the planned and expected  the unintended consequences of telehealth in.pdf',
    title: 'Beyond the planned and expected: the unintended consequences of telehealth in rural and remote Australia through a complexity lens',
    authors: 'Sagda Osman, K. Churruca, L. Ellis, Jeffrey Braithwaite',
    institution: 'Macquarie University',
    year: 2024,
    journal: 'Medical Journal of Australia',
    doi: '10.5694/mja2.52294',
    externalLink: 'https://doi.org/10.5694/mja2.52294',
    takeaway: 'Telehealth can improve health access and reduce costs in rural and remote areas, but its use may lead to unintended consequences, such as reduced skill in rural health staff and increased workload on clinicians.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.policy],
  },
  {
    filename: 'article_print_3808.pdf',
    title: 'Telehealth services in rural and remote Australia: a systematic review of models of care and factors influencing success and sustainability',
    authors: 'Narelle K Bradford, L. Caffery, Anthony C. Smith',
    institution: 'University of Queensland Centre for Online Health',
    year: 2016,
    journal: 'Rural and Remote Health',
    doi: '10.22605/rrh3808',
    externalLink: 'https://doi.org/10.22605/rrh3808',
    takeaway: 'Telehealth services in rural and remote Australia can improve access to healthcare when supported by vision, ownership, adaptability, economics, efficiency, and equipment.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.gp_generalism, DISC.policy],
  },
  {
    filename: 'krahe-et-al-2024-digital-health-implementation-in-australia-a-scientometric-review-of-the-research.pdf',
    title: 'Digital health implementation in Australia: A scientometric review of the research',
    authors: 'M. Krahe, S. L. Larkins, Nico Adams',
    institution: 'James Cook University',
    year: 2024,
    journal: 'Digital Health',
    doi: '10.1177/20552076241297729',
    externalLink: 'https://doi.org/10.1177/20552076241297729',
    takeaway: 'Digital health implementation research in Australia has shown sustained growth since 2019, with a focus on telehealth and remote health, but a lack of studies on rural and remote areas.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.policy],
  },
  {
    filename: 'article_print_5754.pdf',
    title: 'Patient and provider perspectives on eHealth interventions in Canada and Australia: a scoping review',
    authors: 'M. LeBlanc, S. Petrie, S. Paskaran, D. Carson, P. Peters',
    institution: 'Carleton University',
    year: 2020,
    journal: 'Rural and Remote Health',
    doi: '10.22605/rrh5754',
    externalLink: 'https://doi.org/10.22605/rrh5754',
    takeaway: 'eHealth interventions in rural communities can provide benefits like decreased travel time and increased access to services, but face technological issues, lack of face-to-face contact, and resource disparities.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.policy],
  },
  {
    filename: 'PIIS266660652100033X.pdf',
    title: 'A cross-jurisdictional research collaboration aiming to improve health outcomes in the tropical north of Australia',
    authors: 'Kevin Williams, Sean Rung, H. D\'Antoine, B. Currie',
    institution: 'Menzies School of Health Research',
    year: 2021,
    journal: 'The Lancet Regional Health: Western Pacific',
    doi: '10.1016/j.lanwpc.2021.100124',
    externalLink: 'https://doi.org/10.1016/j.lanwpc.2021.100124',
    takeaway: 'The HOT North program aims to improve health outcomes in the tropical north of Australia by focusing on researcher retention, practitioner collaborations, and knowledge transfer through cross-jurisdictional networks.',
    primaryThemeId: THEMES.knowledge_networks,
    disciplineIds: [DISC.indigenous, DISC.policy],
  },
  {
    filename: 's12913-023-09265-2.pdf',
    title: 'Telehealth in remote Australia: a supplementary tool or an alternative model of care replacing face-to-face consultations?',
    authors: 'Supriya Mathew, M. Fitts, Zania Liddle, L. Bourke, Narelle Campbell, L. Murakami-Gold, D. Russell, J. Humphreys, E. Mullholand, Yuejen Zhao, Michael P. Jones, J. Boffa, Mark Ramjan, Annie Tangey, Rosalie Schultz, J. Wakerman',
    institution: 'Menzies School of Health Research',
    year: 2023,
    journal: 'BMC Health Services Research',
    doi: '10.1186/s12913-023-09265-2',
    externalLink: 'https://doi.org/10.1186/s12913-023-09265-2',
    takeaway: 'Telehealth can improve access to healthcare in remote areas of Australia when complemented with adequate face-to-face services and culturally safe digital navigation.',
    primaryThemeId: THEMES.digital_health,
    disciplineIds: [DISC.indigenous, DISC.gp_generalism],
  },
  {
    filename: 'Australian J Rural Health - 2024 - Tegen - RuralHealthConnect  A network for evidence  innovation and action.pdf',
    title: 'RuralHealthConnect: A network for evidence, innovation and action',
    authors: 'Susanne Tegen',
    institution: 'National Rural Health Alliance',
    year: 2024,
    journal: 'The Australian Journal of Rural Health',
    doi: '10.1111/ajr.13118',
    externalLink: 'https://doi.org/10.1111/ajr.13118',
    takeaway: 'RuralHealthConnect aims to improve access to evidence-based resources and maximise the value of government investment in rural health care by fostering real-time information exchange, capacity building, adaptation, and innovation.',
    primaryThemeId: THEMES.knowledge_networks,
    disciplineIds: [DISC.policy],
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

  return { limit, only };
}

async function alreadyIngested(doi: string): Promise<boolean> {
  const { data } = await supabase
    .from('st_documents')
    .select('id, status')
    .eq('engagement_id', ENGAGEMENT_ID)
    .eq('doi', doi)
    .maybeSingle();
  return data?.status === 'ingested' || data?.status === 'ingesting';
}

async function processOne(meta: AbstractMeta, index: number, total: number): Promise<void> {
  const tag = `[${index + 1}/${total}]`;
  console.log(`\n${tag} ${meta.authors.split(',')[0].trim()} ${meta.year} — ${meta.title.slice(0, 80)}...`);

  if (await alreadyIngested(meta.doi)) {
    console.log(`  ⤳ already ingested for DOI ${meta.doi}, skipping`);
    return;
  }

  // 1. Read PDF
  const pdfPath = join(PDF_DIR, meta.filename);
  let pdfBytes: Buffer;
  try {
    pdfBytes = await readFile(pdfPath);
  } catch (err) {
    console.error(`  ✗ PDF not found at ${pdfPath}: ${(err as Error).message}`);
    return;
  }
  console.log(`  • read ${Math.round(pdfBytes.length / 1024)}KB from disk`);

  // 2. Upload to storage
  const timestamp = Date.now();
  const safeName = meta.filename.replace(/[^\w.\-]/g, '_');
  const storagePath = `${ENGAGEMENT_ID}/${timestamp}-${safeName}`;
  const { error: uploadErr } = await supabase.storage
    .from('st-documents')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (uploadErr) {
    console.error(`  ✗ storage upload failed: ${uploadErr.message}`);
    return;
  }
  console.log(`  • uploaded → st-documents/${storagePath}`);

  // 3. Insert st_documents row
  const { data: doc, error: insertErr } = await supabase
    .from('st_documents')
    .insert({
      engagement_id: ENGAGEMENT_ID,
      title: meta.title,
      description: meta.takeaway,
      file_path: storagePath,
      file_type: 'pdf',
      file_size_bytes: pdfBytes.length,
      primary_commitment_id: meta.primaryThemeId,
      contains_pii: false,
      status: 'uploaded',
      authors: meta.authors,
      institution: meta.institution,
      publication_year: meta.year,
      journal: meta.journal,
      doi: meta.doi,
      external_link: meta.externalLink,
    })
    .select('id')
    .single();
  if (insertErr || !doc) {
    console.error(`  ✗ st_documents insert failed: ${insertErr?.message ?? 'unknown'}`);
    return;
  }
  console.log(`  • inserted doc ${doc.id}`);

  // 4. Insert commitment links (primary theme + discipline lenses)
  const links = [
    { document_id: doc.id, commitment_id: meta.primaryThemeId, link_type: 'primary' as const },
    ...meta.disciplineIds.map((cid) => ({
      document_id: doc.id,
      commitment_id: cid,
      link_type: 'tagged' as const,
    })),
  ];
  const { error: linkErr } = await supabase
    .from('st_commitment_document_links')
    .upsert(links, { onConflict: 'commitment_id,document_id' });
  if (linkErr) {
    console.warn(`  ! link warning: ${linkErr.message}`);
  } else {
    console.log(`  • linked to 1 theme + ${meta.disciplineIds.length} discipline(s)`);
  }

  // 5. Trigger ingestion
  console.log(`  • calling st-ingest-document...`);
  const ingestStart = Date.now();
  const ingestResp = await fetch(`${SUPABASE_URL}/functions/v1/st-ingest-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_id: doc.id }),
  });
  const ingestSeconds = ((Date.now() - ingestStart) / 1000).toFixed(1);
  if (!ingestResp.ok) {
    const errBody = await ingestResp.text();
    console.error(`  ✗ ingest failed in ${ingestSeconds}s: ${ingestResp.status} ${errBody.slice(0, 200)}`);
    return;
  }
  const result = await ingestResp.json();
  console.log(`  ✓ ingested in ${ingestSeconds}s — ${result.chunks_created} chunks`);
}

async function main() {
  const { limit, only } = parseArgs();
  const queue = (
    only
      ? ABSTRACTS.filter((a) => a.filename.toLowerCase().includes(only.toLowerCase()))
      : ABSTRACTS
  ).slice(0, limit);

  console.log(`Seeding Rural Futures Australia — ${queue.length} abstract(s)`);
  console.log(`Engagement: ${ENGAGEMENT_ID}`);
  console.log(`Supabase:   ${SUPABASE_URL}`);

  for (let i = 0; i < queue.length; i++) {
    await processOne(queue[i], i, queue.length);
  }

  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
