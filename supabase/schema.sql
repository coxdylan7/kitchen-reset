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

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
alter table public.booking_photos enable row level security;
alter table public.admin_users enable row level security;

create policy "Users can view their bookings"
  on public.bookings for select using (auth.uid() = user_id);
create policy "Users can create their bookings"
  on public.bookings for insert with check (auth.uid() = user_id);
create policy "Admins can view all bookings"
  on public.bookings for select using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

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

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', false)
on conflict (id) do nothing;

create policy "Users can upload their booking photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view their booking photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'booking-photos' and (storage.foldername(name))[1] = auth.uid()::text);
