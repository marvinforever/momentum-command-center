-- a) youtube_channels lookup table
create table if not exists public.youtube_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel_id text unique not null,
  handle text,
  status text default 'Active',
  created_at timestamptz default now()
);

alter table public.youtube_channels enable row level security;

create policy "anon and auth read youtube_channels" on public.youtube_channels
  for select to anon, authenticated using (true);
create policy "auth write youtube_channels" on public.youtube_channels
  for all to authenticated using (true) with check (true);

insert into public.youtube_channels (id, name, channel_id, handle) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Christine Jewell', 'CHRISTINE_PLACEHOLDER', '@christinejewell'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Intentional Ag Leader', 'INTENTIONAL_AG_PLACEHOLDER', '@intentionalagleader')
on conflict (id) do nothing;

-- b) content table additions
alter table public.content
  add column if not exists youtube_channel_id uuid references public.youtube_channels(id),
  add column if not exists youtube_video_id text unique;

create index if not exists content_youtube_video_id_idx on public.content (youtube_video_id);
create index if not exists content_youtube_channel_id_idx on public.content (youtube_channel_id);

-- c) channel_metrics account_label
alter table public.channel_metrics
  add column if not exists account_label text;

create index if not exists channel_metrics_account_label_idx
  on public.channel_metrics (channel, account_label, snapshot_date desc);