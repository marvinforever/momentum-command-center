
-- seo_keyword_research
create table if not exists public.seo_keyword_research (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid references public.youtube_videos(id) on delete cascade,
  optimization_run_id uuid references public.optimization_runs(id),
  keyword text not null,
  source text check (source in ('youtube_autocomplete', 'youtube_search', 'google_trends', 'transcript_extract', 'manual', 'competitor_inferred')),
  search_volume_estimate integer,
  competition_score numeric,
  relevance_score numeric,
  is_target boolean default false,
  rank_position_at_optimization integer,
  raw jsonb,
  created_at timestamptz default now()
);
create index if not exists seo_keyword_research_video_idx on public.seo_keyword_research(youtube_video_id);
create index if not exists seo_keyword_research_target_idx on public.seo_keyword_research(is_target) where is_target = true;
alter table public.seo_keyword_research enable row level security;
create policy "anon and auth read seo_keyword_research" on public.seo_keyword_research for select to anon, authenticated using (true);
create policy "auth write seo_keyword_research" on public.seo_keyword_research for all to authenticated using (true) with check (true);

-- seo_competitor_videos
create table if not exists public.seo_competitor_videos (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid references public.optimization_runs(id) on delete cascade,
  target_keyword text not null,
  competitor_youtube_video_id text not null,
  rank_position integer,
  channel_id text,
  channel_name text,
  title text,
  description_excerpt text,
  tags jsonb default '[]'::jsonb,
  views integer,
  likes integer,
  comments integer,
  publish_date date,
  duration_seconds integer,
  thumbnail_url text,
  title_length integer,
  title_starts_with_question boolean,
  title_contains_number boolean,
  description_length integer,
  tag_count integer,
  raw jsonb,
  fetched_at timestamptz default now()
);
create index if not exists seo_competitor_videos_run_idx on public.seo_competitor_videos(optimization_run_id);
create index if not exists seo_competitor_videos_keyword_idx on public.seo_competitor_videos(target_keyword);
alter table public.seo_competitor_videos enable row level security;
create policy "anon and auth read seo_competitor_videos" on public.seo_competitor_videos for select to anon, authenticated using (true);
create policy "auth write seo_competitor_videos" on public.seo_competitor_videos for all to authenticated using (true) with check (true);

-- video_seo_scores
create table if not exists public.video_seo_scores (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid not null references public.youtube_videos(id) on delete cascade,
  optimization_run_id uuid references public.optimization_runs(id),
  scored_at timestamptz default now(),
  overall_score numeric,
  title_score numeric,
  description_score numeric,
  tags_score numeric,
  thumbnail_score numeric,
  engagement_signals_score numeric,
  metadata_completeness_score numeric,
  keyword_alignment_score numeric,
  issues jsonb default '[]'::jsonb,
  raw jsonb
);
create index if not exists video_seo_scores_video_idx on public.video_seo_scores(youtube_video_id);
create index if not exists video_seo_scores_scored_at_idx on public.video_seo_scores(scored_at desc);
alter table public.video_seo_scores enable row level security;
create policy "anon and auth read video_seo_scores" on public.video_seo_scores for select to anon, authenticated using (true);
create policy "auth write video_seo_scores" on public.video_seo_scores for all to authenticated using (true) with check (true);

-- keyword_rankings
create table if not exists public.keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id uuid not null references public.youtube_videos(id) on delete cascade,
  keyword text not null,
  rank_position integer,
  total_results_estimated integer,
  checked_at timestamptz default now()
);
create index if not exists keyword_rankings_video_idx on public.keyword_rankings(youtube_video_id, keyword);
create index if not exists keyword_rankings_keyword_idx on public.keyword_rankings(keyword);
create index if not exists keyword_rankings_checked_at_idx on public.keyword_rankings(checked_at desc);
alter table public.keyword_rankings enable row level security;
create policy "anon and auth read keyword_rankings" on public.keyword_rankings for select to anon, authenticated using (true);
create policy "auth write keyword_rankings" on public.keyword_rankings for all to authenticated using (true) with check (true);
