create extension if not exists "pgcrypto";

create table if not exists submarkets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text,
  legality_notes text,
  revenue_notes text,
  lead_volume_notes text,
  social_trust_score integer default 0,
  priority_score integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  submarket_id uuid references submarkets(id) on delete set null,
  source_platform text,
  listing_url text,
  property_address text,
  bedrooms numeric,
  bathrooms numeric,
  price text,
  owner_name text,
  owner_contact text,
  listing_text text,
  notes text,
  status text default 'new',
  created_at timestamp with time zone default now()
);

create table if not exists lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  revenue_potential integer default 0,
  visual_gap integer default 0,
  copy_gap integer default 0,
  pricing_gap integer default 0,
  reachability integer default 0,
  owner_pain integer default 0,
  regulation_risk integer default 0,
  total_score integer default 0,
  score_reasoning text,
  created_at timestamp with time zone default now()
);

create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  loom_script text,
  sms_script text,
  email_script text,
  linkedin_script text,
  follow_up_1 text,
  follow_up_2 text,
  created_at timestamp with time zone default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  report_title text,
  report_summary text,
  revenue_estimate_low numeric,
  revenue_estimate_mid numeric,
  revenue_estimate_high numeric,
  recommended_fixes text,
  created_at timestamp with time zone default now()
);
