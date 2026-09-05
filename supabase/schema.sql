create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  service_tier text not null default 'Standard Reset',
  price_cents integer not null default 7900 check (price_cents >= 0),
  bonus_cents integer not null default 0 check (bonus_cents >= 0),
  duration_minutes integer not null default 70,
  deadline text not null,
  notes text,
  status text not null default 'matching' check (status in ('received', 'matching', 'assigned', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  primary_region text not null,
  available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings add column if not exists worker_id uuid references auth.users(id) on delete set null;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_addresses (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  borough text not null check (borough in ('Brooklyn', 'Manhattan')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  borough text not null check (borough in ('Brooklyn', 'Manhattan')),
  state text not null default 'NY' check (state in ('NY', 'NJ', 'CT')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.pilot_regions add column if not exists description text;
alter table public.pilot_regions add column if not exists map_url text;
alter table public.pilot_regions add column if not exists state text not null default 'NY';
alter table public.pilot_regions add column if not exists latitude double precision;
alter table public.pilot_regions add column if not exists longitude double precision;
alter table public.pilot_regions add column if not exists radius_miles numeric(6,2) not null default 3;
alter table public.pilot_regions drop constraint if exists pilot_regions_borough_check;
alter table public.pilot_regions add constraint pilot_regions_state_check check (state in ('NY', 'NJ', 'CT'));

create table if not exists public.professional_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  neighborhood text not null,
  region text,
  experience text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.professional_applications
  add column if not exists region text;

alter table public.bookings enable row level security;
alter table public.booking_photos enable row level security;
alter table public.admin_users enable row level security;
alter table public.pilot_addresses enable row level security;
alter table public.pilot_regions enable row level security;
alter table public.professional_applications enable row level security;
alter table public.worker_profiles enable row level security;

create policy "Users can view their bookings"
  on public.bookings for select using (auth.uid() = user_id);
create policy "Users can create their bookings"
  on public.bookings for insert with check (auth.uid() = user_id);
create policy "Admins can view all bookings"
  on public.bookings for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
create policy "Workers can view open bookings"
  on public.bookings for select using (
    status = 'matching'
    and exists (select 1 from public.worker_profiles where user_id = auth.uid())
  );
create policy "Workers can accept open bookings"
  on public.bookings for update using (
    status = 'matching' and worker_id is null
    and exists (select 1 from public.worker_profiles where user_id = auth.uid())
  ) with check (
    worker_id = auth.uid() and status = 'assigned'
  );
create policy "Workers can manage their worker profile"
  on public.worker_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view their booking photos"
  on public.booking_photos for select using (auth.uid() = user_id);
create policy "Users can create their booking photos"
  on public.booking_photos for insert with check (auth.uid() = user_id);
create policy "Admins can view all booking photos"
  on public.booking_photos for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

create policy "Users can check their admin access"
  on public.admin_users for select using (auth.uid() = user_id);
create policy "Anyone can view active pilot addresses"
  on public.pilot_addresses for select using (active = true);
create policy "Anyone can view active pilot regions"
  on public.pilot_regions for select using (active = true);
create policy "Admins can manage pilot regions"
  on public.pilot_regions for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
create policy "Admins can manage pilot addresses"
  on public.pilot_addresses for all using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
create policy "Anyone can submit professional applications"
  on public.professional_applications for insert with check (true);
create policy "Admins can view professional applications"
  on public.professional_applications for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', false)
on conflict (id) do nothing;

create policy "Users can upload their booking photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view their booking photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'booking-photos' and (storage.foldername(name))[1] = auth.uid()::text);
