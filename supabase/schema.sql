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
alter table public.bookings add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
alter table public.bookings add column if not exists paid_at timestamptz;
alter table public.bookings add column if not exists worker_payout_status text not null default 'pending';
alter table public.bookings add column if not exists worker_payout_transfer_id text;

create table if not exists public.customer_lockboxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instructions text not null,
  access_code text not null,
  confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_checkins (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('en_route', 'arrived', 'in_progress', 'completed')),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

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
alter table public.customer_lockboxes enable row level security;
alter table public.booking_checkins enable row level security;

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
    and exists (select 1 from public.worker_profiles where user_id = auth.uid() and available = true)
  );
create policy "Workers can accept open bookings"
  on public.bookings for update using (
    status = 'matching' and worker_id is null
    and exists (select 1 from public.worker_profiles where user_id = auth.uid() and available = true)
  ) with check (
    worker_id = auth.uid() and status = 'assigned'
  );
create policy "Workers can view their assigned bookings"
  on public.bookings for select using (worker_id = auth.uid());
create policy "Customers can manage their lockbox"
  on public.customer_lockboxes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Customers can view their checkins"
  on public.booking_checkins for select using (
    exists (select 1 from public.bookings where bookings.id = booking_id and bookings.user_id = auth.uid())
  );
create policy "Workers can manage assigned checkins"
  on public.booking_checkins for all using (worker_id = auth.uid()) with check (worker_id = auth.uid());

create or replace function public.start_booking_checkin(target_booking uuid)
returns public.booking_checkins
language plpgsql
security definer
set search_path = public
as $$
declare result public.booking_checkins;
begin
  update public.bookings
  set status = 'in_progress'
  where id = target_booking
    and worker_id = auth.uid()
    and status = 'assigned';
  if not found then raise exception 'Booking is not assigned to this worker'; end if;
  insert into public.booking_checkins (booking_id, worker_id, status, started_at)
  values (target_booking, auth.uid(), 'in_progress', now())
  on conflict (booking_id) do update set status = 'in_progress', started_at = coalesce(public.booking_checkins.started_at, now()), updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.update_booking_checkin(target_booking uuid, next_status text)
returns public.booking_checkins
language plpgsql
security definer
set search_path = public
as $$
declare result public.booking_checkins;
begin
  if next_status not in ('en_route', 'arrived', 'in_progress', 'completed') then
    raise exception 'Invalid worker status';
  end if;
  if not exists (
    select 1 from public.bookings
    where id = target_booking and worker_id = auth.uid()
      and status in ('assigned', 'in_progress')
  ) then raise exception 'Booking is not assigned to this worker'; end if;
  update public.bookings
  set status = case when next_status = 'completed' then 'completed' else case when next_status = 'in_progress' then 'in_progress' else 'assigned' end end
  where id = target_booking and worker_id = auth.uid();
  insert into public.booking_checkins (booking_id, worker_id, status, started_at, ended_at)
  values (target_booking, auth.uid(), next_status, case when next_status = 'in_progress' then now() else null end, case when next_status = 'completed' then now() else null end)
  on conflict (booking_id) do update set
    status = excluded.status,
    started_at = case when excluded.status = 'in_progress' then coalesce(public.booking_checkins.started_at, now()) else public.booking_checkins.started_at end,
    ended_at = case when excluded.status = 'completed' then now() else null end,
    updated_at = now()
  returning * into result;
  return result;
end;
$$;
grant execute on function public.update_booking_checkin(uuid, text) to authenticated;
grant execute on function public.start_booking_checkin(uuid) to authenticated;

create or replace function public.get_active_lockbox_code(target_booking uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare code text;
begin
  if not exists (
    select 1 from public.bookings b
    join public.booking_checkins c on c.booking_id = b.id
    where b.id = target_booking and b.worker_id = auth.uid()
      and c.worker_id = auth.uid() and c.status = 'in_progress'
      and c.started_at is not null and c.started_at > now() - interval '4 hours'
  ) then raise exception 'Lockbox access is only available during an active clean'; end if;
  select access_code into code from public.customer_lockboxes l
  join public.bookings b on b.user_id = l.user_id
  where b.id = target_booking and l.confirmed = true;
  if code is null then raise exception 'No confirmed lockbox code is available'; end if;
  return code;
end;
$$;
grant execute on function public.get_active_lockbox_code(uuid) to authenticated;
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
