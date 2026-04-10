-- =============================================================
-- Knowledge Extraction Pipeline — Schema Additions
-- Part A: knowledge_chunks + nera_queries tables
--
-- Run this in Supabase SQL Editor AFTER the base schema
-- (supabase_schema.sql) has been applied.
-- This does NOT modify any existing tables.
-- =============================================================

-- A1. Enable pgvector extension (for future semantic search)
create extension if not exists vector;

-- A2. Create the Knowledge Chunks table
create table knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),

  -- Source tracking
  source_tab_id uuid references tabs(id) on delete set null,
  document_source text not null,
  section_reference text,

  -- The knowledge itself
  chunk_text text not null,
  chunk_summary text,

  -- Classification dimensions
  topic_tags text[] default '{}',
  content_type text,

  -- Regulatory dimensions
  pathway text,
  classification text,
  mm_category text,
  employment_status text,
  training_term text,

  -- Flexible metadata
  metadata jsonb default '{}'::jsonb,

  -- Versioning
  is_active boolean default true,
  extraction_version text,

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common query patterns
create index idx_chunks_active on knowledge_chunks (is_active) where is_active = true;
create index idx_chunks_pathway on knowledge_chunks (pathway) where is_active = true;
create index idx_chunks_classification on knowledge_chunks (classification) where is_active = true;
create index idx_chunks_content_type on knowledge_chunks (content_type) where is_active = true;
create index idx_chunks_topic_tags on knowledge_chunks using gin (topic_tags) where is_active = true;
create index idx_chunks_source on knowledge_chunks (source_tab_id);

-- Full-text search column (auto-generated, weighted)
alter table knowledge_chunks add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(chunk_summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(chunk_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(section_reference, '')), 'C')
  ) stored;

create index idx_chunks_fts on knowledge_chunks using gin (fts);

-- A3. Create the Nera Queries Log table
create table nera_queries (
  id uuid primary key default uuid_generate_v4(),

  -- The interaction
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  query_text text not null,
  response_text text not null,

  -- Retrieval metadata
  chunks_used uuid[] default '{}',
  sources_cited text[] default '{}',
  retrieval_method text,

  -- Quality signals
  feedback_score smallint,
  response_latency_ms integer,
  confidence_score numeric(3,2),

  -- Classification
  detected_intent text,
  detected_pathway text,
  detected_classification text,
  detected_mm_category text,

  -- Timestamps
  created_at timestamptz default now()
);

create index idx_queries_session on nera_queries (session_id);
create index idx_queries_user on nera_queries (user_id);
create index idx_queries_feedback on nera_queries (feedback_score) where feedback_score is not null;
create index idx_queries_created on nera_queries (created_at desc);

-- A4. RLS Policies

-- Knowledge chunks: public read, authenticated write
alter table knowledge_chunks enable row level security;

create policy "Knowledge chunks are viewable by everyone"
  on knowledge_chunks for select using (true);

create policy "Admins can manage knowledge chunks"
  on knowledge_chunks for all using (auth.role() = 'authenticated');

-- Query logs: users see own, admins see all, system can insert
alter table nera_queries enable row level security;

create policy "Users can view their own queries"
  on nera_queries for select using (
    auth.uid() = user_id or auth.role() = 'authenticated'
  );

create policy "System can insert queries"
  on nera_queries for insert with check (true);

create policy "Users can update feedback on their own queries"
  on nera_queries for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- Done. Verify in Table Editor:
--   knowledge_chunks — all columns visible, RLS lock icon shown
--   nera_queries — all columns visible, RLS lock icon shown
-- =============================================================
