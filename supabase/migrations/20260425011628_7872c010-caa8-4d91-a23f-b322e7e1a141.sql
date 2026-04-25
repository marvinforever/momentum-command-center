
-- =================================================================
-- LEAD MAGNETS
-- =================================================================
create table public.lead_magnets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('CCS', 'Daily Brief', 'Application', 'Bonus', 'Strategy Session', 'Newsletter', 'Other')),
  status text check (status in ('Active', 'Paused', 'Retired')) default 'Active',
  hosted_on text check (hosted_on in ('Kajabi', 'ConvertKit', 'External')),
  url text,
  description text,
  total_downloads integer default 0,
  sequence_days integer,
  notes text,
  created_at timestamptz default now()
);
alter table public.lead_magnets enable row level security;
create policy "auth read lead_magnets" on public.lead_magnets for select to authenticated using (true);
create policy "auth write lead_magnets" on public.lead_magnets for all to authenticated using (true) with check (true);

-- =================================================================
-- OFFERS
-- =================================================================
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('Coaching Program', 'Course', 'Event', 'Done-For-You', 'Other')),
  status text check (status in ('Active', 'Paused', 'Sold Out', 'Retired')) default 'Active',
  price numeric,
  cohort_size integer,
  description text,
  url text,
  notes text,
  created_at timestamptz default now()
);
alter table public.offers enable row level security;
create policy "auth read offers" on public.offers for select to authenticated using (true);
create policy "auth write offers" on public.offers for all to authenticated using (true) with check (true);

-- =================================================================
-- CAMPAIGNS
-- =================================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text check (status in ('Planning', 'Live', 'Warming', 'Paused', 'Completed')) default 'Planning',
  type text check (type in ('Launch', 'Promo', 'Tour', 'Evergreen', 'Test', 'Outreach', 'Other')),
  primary_channel text check (primary_channel in ('YouTube', 'LinkedIn', 'Email', 'Meta Ads', 'Podcast', 'Multi-Channel', 'Other')),
  start_date date,
  end_date date,
  goal text,
  lead_goal integer,
  booking_goal integer,
  enrollment_goal integer,
  budget numeric,
  spend_to_date numeric default 0,
  notes text,
  lead_magnet_id uuid references public.lead_magnets(id),
  offer_id uuid references public.offers(id),
  created_at timestamptz default now()
);
alter table public.campaigns enable row level security;
create policy "auth read campaigns" on public.campaigns for select to authenticated using (true);
create policy "auth write campaigns" on public.campaigns for all to authenticated using (true) with check (true);

-- =================================================================
-- CONTENT
-- =================================================================
create table public.content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text check (channel in ('YouTube', 'YouTube Short', 'LinkedIn', 'Instagram', 'Podcast', 'Newsletter', 'Blog', 'Other')),
  format text check (format in ('Long-form Video', 'Short', 'Image', 'Carousel', 'Video', 'Reel', 'Newsletter', 'Article', 'Podcast Episode', 'Podcast Guest')),
  publish_date date,
  topic text,
  key_word text check (key_word in ('DIAGNOSE', 'CHAMPION', 'FREEDOM', 'LEGACY', 'IDENTITY', 'CAPACITY', 'CONNECTION', 'KINGDOM', 'OTHER')),
  reach integer default 0,
  engagement integer default 0,
  profile_views integer default 0,
  followers_gained integer default 0,
  leads_attributed integer default 0,
  effect_rating text check (effect_rating in ('High', 'Medium', 'Low', 'Untracked')) default 'Untracked',
  link text,
  notes text,
  campaign_id uuid references public.campaigns(id),
  created_at timestamptz default now()
);
alter table public.content enable row level security;
create policy "auth read content" on public.content for select to authenticated using (true);
create policy "auth write content" on public.content for all to authenticated using (true) with check (true);

-- =================================================================
-- LEADS
-- =================================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  first_touch_date date,
  lead_source text check (lead_source in ('YouTube', 'Facebook Ad', 'LinkedIn', 'Instagram', 'Podcast', 'Outreach', 'Client Referral', 'Direct/Other')),
  opt_in text check (opt_in in ('CCS', 'Daily Brief', 'Applications', 'Drop the Armor Free Bonus', 'High Performance SS', 'Newsletter', 'Other')),
  status text check (status in ('New', 'Nurturing', 'Booked Call', 'Held Call', 'Enrolled', 'Lost', 'Not a Fit')) default 'New',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  how_did_you_hear text,
  gender text check (gender in ('Male', 'Female', 'Unknown')),
  notes text,
  lead_magnet_id uuid references public.lead_magnets(id),
  campaign_id uuid references public.campaigns(id),
  created_at timestamptz default now()
);
alter table public.leads enable row level security;
create policy "auth read leads" on public.leads for select to authenticated using (true);
create policy "auth write leads" on public.leads for all to authenticated using (true) with check (true);

-- =================================================================
-- LEAD <-> CONTENT junction
-- =================================================================
create table public.lead_content (
  lead_id uuid references public.leads(id) on delete cascade,
  content_id uuid references public.content(id) on delete cascade,
  primary key (lead_id, content_id)
);
alter table public.lead_content enable row level security;
create policy "auth read lead_content" on public.lead_content for select to authenticated using (true);
create policy "auth write lead_content" on public.lead_content for all to authenticated using (true) with check (true);

-- =================================================================
-- DISCOVERY CALLS
-- =================================================================
create table public.discovery_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id),
  name text not null,
  call_date date,
  fu_date date,
  call_type text check (call_type in ('Discovery Call', 'Pre Qual', 'Reconnection Call')),
  fit_rating integer,
  status text check (status in ('Lost', 'Won', 'Pending', 'Not a Fit')) default 'Pending',
  lead_source text check (lead_source in ('YouTube', 'Facebook Ad', 'LinkedIn', 'Instagram', 'Podcast', 'Outreach', 'Client Referral', 'Direct/Other')),
  location text,
  role_position text,
  follow_up_actions text[],
  offer_id uuid references public.offers(id),
  notes text,
  created_at timestamptz default now()
);
alter table public.discovery_calls enable row level security;
create policy "auth read discovery_calls" on public.discovery_calls for select to authenticated using (true);
create policy "auth write discovery_calls" on public.discovery_calls for all to authenticated using (true) with check (true);

-- =================================================================
-- CHANNEL METRICS
-- =================================================================
create table public.channel_metrics (
  id uuid primary key default gen_random_uuid(),
  channel text check (channel in ('YouTube', 'LinkedIn', 'Instagram', 'Podcast', 'Email/Kajabi', 'Facebook', 'Twitter/X')),
  snapshot_date date,
  followers_subs integer,
  reach_28d integer,
  watch_time_hrs numeric,
  avg_watch_time text,
  ctr numeric,
  open_rate numeric,
  posts_episodes_released integer,
  net_change integer,
  notes text,
  created_at timestamptz default now()
);
alter table public.channel_metrics enable row level security;
create policy "auth read channel_metrics" on public.channel_metrics for select to authenticated using (true);
create policy "auth write channel_metrics" on public.channel_metrics for all to authenticated using (true) with check (true);

-- Helpful indexes
create index on public.leads (campaign_id);
create index on public.leads (first_touch_date);
create index on public.discovery_calls (lead_id);
create index on public.discovery_calls (call_date);
create index on public.content (campaign_id);
create index on public.content (publish_date);
create index on public.channel_metrics (channel, snapshot_date desc);
