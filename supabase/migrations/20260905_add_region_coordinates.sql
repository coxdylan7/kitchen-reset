-- Add geographic service-area fields to existing pilot regions.
alter table public.pilot_regions
  add column if not exists latitude double precision;

alter table public.pilot_regions
  add column if not exists longitude double precision;

alter table public.pilot_regions
  add column if not exists radius_miles numeric(6,2) not null default 3;

alter table public.pilot_regions
  drop constraint if exists pilot_regions_borough_check;

alter table public.pilot_regions
  drop constraint if exists pilot_regions_state_check;

alter table public.pilot_regions
  add constraint pilot_regions_state_check
  check (state in ('NY', 'NJ', 'CT'));
