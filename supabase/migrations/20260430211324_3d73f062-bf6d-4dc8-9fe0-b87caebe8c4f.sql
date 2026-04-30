
-- brand_resource_links table
create table if not exists public.brand_resource_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  link_label text not null,
  url text not null,
  category text check (category in ('lead_magnet', 'offer', 'social', 'main_site', 'other')) default 'other',
  display_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.brand_resource_links enable row level security;
create policy "anon and auth read brand_resource_links" on public.brand_resource_links for select to anon, authenticated using (true);
create policy "auth write brand_resource_links" on public.brand_resource_links for all to authenticated using (true) with check (true);

-- description_template column on brand_voice_profiles
alter table public.brand_voice_profiles
  add column if not exists description_template text default '{HOOK_LINE}

{BODY}

📌 In this video:
{TIMESTAMPS}

{CTA_BLOCK}

🔗 Resources:
{RESOURCE_LINKS}

{HASHTAGS}';
