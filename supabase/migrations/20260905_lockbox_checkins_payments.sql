alter table public.bookings add column if not exists payment_status text not null default 'pending';
alter table public.bookings add column if not exists paid_at timestamptz;

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
alter table public.customer_lockboxes enable row level security;
alter table public.booking_checkins enable row level security;
drop policy if exists "Customers can manage their lockbox" on public.customer_lockboxes;
create policy "Customers can manage their lockbox" on public.customer_lockboxes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Customers can view their checkins" on public.booking_checkins;
create policy "Customers can view their checkins" on public.booking_checkins for select using (exists (select 1 from public.bookings where bookings.id = booking_id and bookings.user_id = auth.uid()));
drop policy if exists "Workers can manage assigned checkins" on public.booking_checkins;
create policy "Workers can manage assigned checkins" on public.booking_checkins for all using (worker_id = auth.uid()) with check (worker_id = auth.uid());
create or replace function public.start_booking_checkin(target_booking uuid) returns public.booking_checkins language plpgsql security definer set search_path = public as $$
declare result public.booking_checkins;
begin
 update public.bookings set status='in_progress' where id=target_booking and worker_id=auth.uid() and status='assigned';
 if not found then raise exception 'Booking is not assigned to this worker'; end if;
 insert into public.booking_checkins(booking_id,worker_id,status,started_at) values(target_booking,auth.uid(),'in_progress',now())
 on conflict (booking_id) do update set status='in_progress',started_at=coalesce(public.booking_checkins.started_at,now()),updated_at=now()
 returning * into result;
 return result;
end; $$;
create or replace function public.update_booking_checkin(target_booking uuid, next_status text) returns public.booking_checkins language plpgsql security definer set search_path = public as $$
declare result public.booking_checkins;
begin
 if next_status not in ('en_route','arrived','in_progress','completed') then raise exception 'Invalid worker status'; end if;
 if not exists (select 1 from public.bookings where id=target_booking and worker_id=auth.uid() and status in ('assigned','in_progress')) then raise exception 'Booking is not assigned to this worker'; end if;
 update public.bookings set status=case when next_status='completed' then 'completed' when next_status='in_progress' then 'in_progress' else 'assigned' end where id=target_booking and worker_id=auth.uid();
 insert into public.booking_checkins(booking_id,worker_id,status,started_at,ended_at) values(target_booking,auth.uid(),next_status,case when next_status='in_progress' then now() else null end,case when next_status='completed' then now() else null end)
 on conflict (booking_id) do update set status=excluded.status,started_at=case when excluded.status='in_progress' then coalesce(public.booking_checkins.started_at,now()) else public.booking_checkins.started_at end,ended_at=case when excluded.status='completed' then now() else null end,updated_at=now()
 returning * into result;
 return result;
end; $$;
grant execute on function public.update_booking_checkin(uuid, text) to authenticated;
grant execute on function public.start_booking_checkin(uuid) to authenticated;
grant execute on function public.get_active_lockbox_code(uuid) to authenticated;
create or replace function public.get_active_lockbox_code(target_booking uuid) returns text language plpgsql security definer set search_path=public as $$
declare code text;
begin
 if not exists (select 1 from public.bookings b join public.booking_checkins c on c.booking_id=b.id where b.id=target_booking and b.worker_id=auth.uid() and c.worker_id=auth.uid() and c.status='in_progress' and c.started_at > now()-interval '4 hours') then raise exception 'Lockbox access is only available during an active clean'; end if;
 select access_code into code from public.customer_lockboxes l join public.bookings b on b.user_id=l.user_id where b.id=target_booking and l.confirmed=true;
 if code is null then raise exception 'No confirmed lockbox code is available'; end if;
 return code;
end; $$;
