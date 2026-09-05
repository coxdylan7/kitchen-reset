create table if not exists public.worker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  primary_region text not null,
  available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists worker_id uuid references auth.users(id) on delete set null;

alter table public.worker_profiles enable row level security;
drop policy if exists "Workers can manage their worker profile" on public.worker_profiles;
create policy "Workers can manage their worker profile"
  on public.worker_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Workers can view open bookings" on public.bookings;
create policy "Workers can view open bookings"
  on public.bookings for select using (
    status = 'matching'
    and exists (select 1 from public.worker_profiles where user_id = auth.uid())
  );

drop policy if exists "Workers can accept open bookings" on public.bookings;
create policy "Workers can accept open bookings"
  on public.bookings for update using (
    status = 'matching' and worker_id is null
    and exists (select 1 from public.worker_profiles where user_id = auth.uid())
  ) with check (
    worker_id = auth.uid() and status = 'assigned'
  );
