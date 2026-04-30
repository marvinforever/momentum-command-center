
-- Enable pgvector if not already enabled
create extension if not exists vector;

-- a) brands table
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  status text default 'Active',
  primary_youtube_channel_id uuid references public.youtube_channels(id),
  brand_color_primary text,
  brand_color_accent text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.brands enable row level security;
create policy "anon and auth read brands" on public.brands for select to anon, authenticated using (true);
create policy "auth write brands" on public.brands for all to authenticated using (true) with check (true);

-- Seed brands
insert into public.brands (id, name, slug, brand_color_primary, brand_color_accent, description) values
  ('b1111111-0000-0000-0000-000000000001', 'Christine Jewell', 'christine-jewell', '#C4924A', '#6B8E7F', 'Christine''s personal brand. Faith-based exec coaching for high-achieving men whose marriages are quietly struggling. Voice: warm, direct, soulful, never hype-y.'),
  ('b1111111-0000-0000-0000-000000000002', 'Intentional Agribusiness', 'intentional-agribusiness', '#2C3E5C', '#6B8E7F', 'The agribusiness brand. Industry-focused content for farmers and agricultural leaders.')
on conflict (id) do nothing;

-- b) brand_voice_profiles table
create table if not exists public.brand_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  voice_summary text,
  tone_descriptors jsonb default '[]'::jsonb,
  banned_phrases jsonb default '[]'::jsonb,
  required_phrases jsonb default '[]'::jsonb,
  preferred_cta_styles jsonb default '[]'::jsonb,
  audience_profile text,
  brand_promises text,
  thumbnail_style_rules text,
  approved_title_examples jsonb default '[]'::jsonb,
  rejected_title_examples jsonb default '[]'::jsonb,
  approved_description_examples jsonb default '[]'::jsonb,
  approved_thumbnail_text_examples jsonb default '[]'::jsonb,
  source_documents jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.brand_voice_profiles enable row level security;
create policy "anon and auth read brand_voice_profiles" on public.brand_voice_profiles for select to anon, authenticated using (true);
create policy "auth write brand_voice_profiles" on public.brand_voice_profiles for all to authenticated using (true) with check (true);

-- Seed Christine voice profile
insert into public.brand_voice_profiles (brand_id, voice_summary, tone_descriptors, banned_phrases, audience_profile, thumbnail_style_rules) values
  ('b1111111-0000-0000-0000-000000000001',
   'Warm, direct, soulful. Faith-grounded. Speaks to high-achieving men whose marriages are quietly struggling. Never hype-y, never generic. Truth-telling. Often poses a question that names the buyer''s experience without diagnosing them. References Christianity naturally without preaching.',
   '["warm", "direct", "soulful", "no-hype", "truth-telling", "spiritual without being preachy"]'::jsonb,
   '["unlock your potential", "game-changing", "transform your life overnight", "life-changing secret", "ultimate guide to", "must-read"]'::jsonb,
   'High-achieving men (CEOs, entrepreneurs, executives) whose marriages are quietly struggling. They won''t search "marriage counseling" — they search "why do I feel empty" or "successful but disconnected."',
   'Clean, warm tones. Christine''s face should be prominent. Text overlay should be a provocative question or bold statement, never clickbait. Use brand gold (#C4924A) accents. No busy backgrounds.'
  );

-- Seed Intentional Agribusiness voice profile
insert into public.brand_voice_profiles (brand_id, voice_summary, tone_descriptors, banned_phrases, audience_profile, thumbnail_style_rules) values
  ('b1111111-0000-0000-0000-000000000002',
   'Industry-direct, practical, no-fluff. Speaks to working farmers and ag executives. Uses specific industry terminology. Avoids consumer-marketing speak.',
   '["direct", "practical", "industry-specific", "no-fluff", "authoritative"]'::jsonb,
   '["hack your farm", "disrupting agriculture", "game-changing", "revolutionary"]'::jsonb,
   'Working farmers, ag executives, agribusiness owners. They value practical advice backed by real experience. Skeptical of marketing speak.',
   'Professional, clean. Agricultural imagery. Bold text overlays with industry-specific language. Use brand navy (#2C3E5C) accents.'
  );

-- c) youtube_videos table
create table if not exists public.youtube_videos (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content(id) on delete cascade,
  brand_id uuid references public.brands(id),
  youtube_channel_id uuid references public.youtube_channels(id),
  youtube_video_id text not null unique,
  current_title text,
  current_description text,
  current_tags jsonb default '[]'::jsonb,
  current_thumbnail_url text,
  duration_seconds integer,
  published_at timestamptz,
  is_short boolean default false,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  impressions integer default 0,
  ctr numeric,
  watch_time_minutes numeric,
  avg_view_duration_seconds integer,
  optimization_status text default 'untouched',
  last_optimized_at timestamptz,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists youtube_videos_brand_idx on public.youtube_videos(brand_id);
create index if not exists youtube_videos_status_idx on public.youtube_videos(optimization_status);
create index if not exists youtube_videos_published_idx on public.youtube_videos(published_at desc);
alter table public.youtube_videos enable row level security;
create policy "anon and auth read youtube_videos" on public.youtube_videos for select to anon, authenticated using (true);
create policy "auth write youtube_videos" on public.youtube_videos for all to authenticated using (true) with check (true);

-- d) video_transcripts table
create table if not exists public.video_transcripts (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid not null references public.youtube_videos(id) on delete cascade,
  transcript_text text,
  language text default 'en',
  segments jsonb,
  fetched_at timestamptz default now()
);
alter table public.video_transcripts enable row level security;
create policy "anon and auth read video_transcripts" on public.video_transcripts for select to anon, authenticated using (true);
create policy "auth write video_transcripts" on public.video_transcripts for all to authenticated using (true) with check (true);

-- e) optimization_runs table
create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid not null references public.youtube_videos(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  triggered_by_user text,
  trigger_type text default 'manual',
  ai_model text default 'claude-sonnet-4-6',
  input_summary text,
  raw_output jsonb,
  status text default 'pending',
  cost_usd numeric,
  latency_ms integer,
  error text,
  created_at timestamptz default now(),
  approved_at timestamptz,
  published_at timestamptz
);
create index if not exists optimization_runs_video_idx on public.optimization_runs(youtube_video_id);
create index if not exists optimization_runs_status_idx on public.optimization_runs(status);
alter table public.optimization_runs enable row level security;
create policy "anon and auth read optimization_runs" on public.optimization_runs for select to anon, authenticated using (true);
create policy "auth write optimization_runs" on public.optimization_runs for all to authenticated using (true) with check (true);

-- f) optimization_outputs table
create table if not exists public.optimization_outputs (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  output_type text not null,
  variant_index integer,
  content text,
  content_json jsonb,
  rationale text,
  brand_voice_score numeric,
  human_sounding_score numeric,
  approval_likelihood_score numeric,
  seo_score numeric,
  passed_guardrails boolean default true,
  guardrail_warnings jsonb default '[]'::jsonb,
  selected_by_user boolean default false,
  selected_at timestamptz,
  selected_by_user_email text,
  created_at timestamptz default now()
);
create index if not exists optimization_outputs_run_idx on public.optimization_outputs(optimization_run_id);
create index if not exists optimization_outputs_type_idx on public.optimization_outputs(output_type);
alter table public.optimization_outputs enable row level security;
create policy "anon and auth read optimization_outputs" on public.optimization_outputs for select to anon, authenticated using (true);
create policy "auth write optimization_outputs" on public.optimization_outputs for all to authenticated using (true) with check (true);

-- g) thumbnail_generations table
create table if not exists public.thumbnail_generations (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid references public.optimization_runs(id) on delete cascade,
  youtube_video_id uuid references public.youtube_videos(id),
  brand_id uuid references public.brands(id),
  variant_index integer,
  prompt text,
  generation_model text default 'flux-pro',
  image_url text,
  storage_path text,
  text_overlay text,
  layout_notes text,
  brand_voice_score numeric,
  selected_by_user boolean default false,
  cost_usd numeric,
  created_at timestamptz default now()
);
alter table public.thumbnail_generations enable row level security;
create policy "anon and auth read thumbnail_generations" on public.thumbnail_generations for select to anon, authenticated using (true);
create policy "auth write thumbnail_generations" on public.thumbnail_generations for all to authenticated using (true) with check (true);

-- h) approval_feedback table
create table if not exists public.approval_feedback (
  id uuid primary key default gen_random_uuid(),
  optimization_output_id uuid references public.optimization_outputs(id) on delete cascade,
  thumbnail_generation_id uuid references public.thumbnail_generations(id) on delete cascade,
  brand_id uuid references public.brands(id),
  output_type text,
  output_content text,
  rating text not null,
  reason text,
  rated_by_user_email text,
  rated_at timestamptz default now()
);
create index if not exists approval_feedback_brand_idx on public.approval_feedback(brand_id);
create index if not exists approval_feedback_rating_idx on public.approval_feedback(rating);
alter table public.approval_feedback enable row level security;
create policy "anon and auth read approval_feedback" on public.approval_feedback for select to anon, authenticated using (true);
create policy "auth write approval_feedback" on public.approval_feedback for all to authenticated using (true) with check (true);

-- i) audit_queue table
create table if not exists public.audit_queue (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid not null references public.youtube_videos(id) on delete cascade,
  brand_id uuid references public.brands(id),
  opportunity_score numeric,
  reasons jsonb default '[]'::jsonb,
  priority_rank integer,
  status text default 'queued',
  assigned_to_user_email text,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index if not exists audit_queue_priority_idx on public.audit_queue(priority_rank);
create index if not exists audit_queue_status_idx on public.audit_queue(status);
alter table public.audit_queue enable row level security;
create policy "anon and auth read audit_queue" on public.audit_queue for select to anon, authenticated using (true);
create policy "auth write audit_queue" on public.audit_queue for all to authenticated using (true) with check (true);

-- j) optimization_performance table
create table if not exists public.optimization_performance (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  youtube_video_id uuid not null references public.youtube_videos(id),
  baseline_views integer,
  baseline_impressions integer,
  baseline_ctr numeric,
  baseline_watch_time_minutes numeric,
  baseline_taken_at timestamptz,
  after_7d_views integer,
  after_7d_impressions integer,
  after_7d_ctr numeric,
  after_7d_watch_time_minutes numeric,
  after_7d_taken_at timestamptz,
  after_30d_views integer,
  after_30d_impressions integer,
  after_30d_ctr numeric,
  after_30d_watch_time_minutes numeric,
  after_30d_taken_at timestamptz,
  ctr_delta_pct numeric,
  views_delta_pct numeric,
  watch_time_delta_pct numeric,
  optimization_won boolean,
  notes text
);
create index if not exists optimization_performance_run_idx on public.optimization_performance(optimization_run_id);
alter table public.optimization_performance enable row level security;
create policy "anon and auth read optimization_performance" on public.optimization_performance for select to anon, authenticated using (true);
create policy "auth write optimization_performance" on public.optimization_performance for all to authenticated using (true) with check (true);

-- Storage bucket for thumbnails
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', true) on conflict (id) do nothing;

-- Public read policy for thumbnails bucket
create policy "Public read thumbnails" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "Auth upload thumbnails" on storage.objects for insert to authenticated with check (bucket_id = 'thumbnails');
create policy "Auth update thumbnails" on storage.objects for update to authenticated using (bucket_id = 'thumbnails');
