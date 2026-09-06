alter table public.worker_profiles
  add column if not exists stripe_account_id text,
  add column if not exists payouts_enabled boolean not null default false;
alter table public.bookings
  add column if not exists worker_payout_status text not null default 'pending',
  add column if not exists worker_payout_transfer_id text;

drop policy if exists "Workers can upload completion photos" on public.booking_photos;
create policy "Workers can upload completion photos"
  on public.booking_photos for insert
  with check (
    photo_type = 'finished'
    and exists (
      select 1 from public.bookings
      where bookings.id = booking_id
        and bookings.worker_id = auth.uid()
        and bookings.status in ('in_progress', 'completed')
    )
  );

drop policy if exists "Customers can view completion photos" on storage.objects;
create policy "Customers can view completion photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-photos'
    and (storage.foldername(name))[2] in (
      select id::text from public.bookings where user_id = auth.uid()
    )
  );

drop policy if exists "Workers can upload completion photos" on storage.objects;
create policy "Workers can upload completion photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.bookings
      where id = ((storage.foldername(name))[2])::uuid
        and worker_id = auth.uid()
        and status in ('in_progress', 'completed')
    )
  );
