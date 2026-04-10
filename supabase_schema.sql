-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. App Settings Table
create table app_settings (
  id text primary key default 'default',
  app_title text not null default 'First Nations GP Training Supports',
  header_subtitle text not null default 'National Scoping Project Report',
  footer_text text not null default '© 2024 First Nations GP Training Supports',
  footer_links jsonb default '[]'::jsonb,
  theme jsonb default '{
    "primary_color": "#2F5233",
    "secondary_color": "#D9EAD3",
    "font_heading": "Merriweather",
    "font_body": "Inter",
    "radius": "0.75rem"
  }'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Folders Table
create table folders (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  icon text not null default '📁',
  order_index integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tabs Table
create table tabs (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  icon text not null,
  content text not null, -- Markdown content
  order_index integer not null default 0,
  is_supplementary boolean default false,
  is_visible boolean default true,
  folder_id uuid references folders(id) on delete set null,
  file_url text, -- URL to downloadable file in Supabase storage
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Row Level Security (RLS) Policies
alter table app_settings enable row level security;
alter table folders enable row level security;
alter table tabs enable row level security;

-- Allow public read access
create policy "Public settings are viewable by everyone" 
  on app_settings for select using (true);

create policy "Public tabs are viewable by everyone"
  on tabs for select using (true);

create policy "Public folders are viewable by everyone"
  on folders for select using (true);

-- Allow authenticated users (admins) to insert/update/delete
create policy "Admins can update settings"
  on app_settings for all using (auth.role() = 'authenticated');

create policy "Admins can manage tabs"
  on tabs for all using (auth.role() = 'authenticated');

create policy "Admins can manage folders"
  on folders for all using (auth.role() = 'authenticated');

-- 4. Initial Data Seeding (Optional - App will fallback to defaults if empty, but good to have)
insert into app_settings (id, app_title) values ('default', 'First Nations GP Training Supports')
on conflict (id) do nothing;
