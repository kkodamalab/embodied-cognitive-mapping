create table if not exists public.ecm_views (
  id uuid primary key,
  room_id text not null,
  name text not null,
  owner_name text not null,
  read_only boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists ecm_views_room_id_idx on public.ecm_views (room_id);
alter table public.ecm_views enable row level security;

-- Ver.2 intentionally uses unlisted, high-entropy Room URLs instead of accounts.
-- Tighten these policies when authenticated ownership is introduced.
create policy "anonymous room view read" on public.ecm_views for select to anon using (true);
create policy "anonymous room view insert" on public.ecm_views for insert to anon with check (true);
create policy "anonymous room view update" on public.ecm_views for update to anon using (true) with check (true);
create policy "anonymous room view delete" on public.ecm_views for delete to anon using (true);

alter publication supabase_realtime add table public.ecm_views;
