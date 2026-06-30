-- ensure global packaging configuration exists and is readable/writable in Supabase remote
create table if not exists public.configuracion_empaques (
  id uuid primary key default gen_random_uuid(),
  tipo_empaque text not null,
  capacidad_kg numeric(14,3) not null,
  esta_activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint configuracion_empaques_tipo_chk check (tipo_empaque in ('BOLSA', 'BIG_BAG')),
  constraint configuracion_empaques_capacidad_chk check (
    (tipo_empaque = 'BOLSA' and capacidad_kg in (15, 20, 25, 40))
    or
    (tipo_empaque = 'BIG_BAG' and capacidad_kg in (500, 1000))
  )
);

alter table public.configuracion_empaques enable row level security;

drop policy if exists "configuracion_empaques_select_authenticated" on public.configuracion_empaques;
create policy "configuracion_empaques_select_authenticated"
  on public.configuracion_empaques
  for select
  to authenticated
  using (true);

drop policy if exists "configuracion_empaques_insert_authenticated" on public.configuracion_empaques;
create policy "configuracion_empaques_insert_authenticated"
  on public.configuracion_empaques
  for insert
  to authenticated
  with check (true);

drop policy if exists "configuracion_empaques_update_authenticated" on public.configuracion_empaques;
create policy "configuracion_empaques_update_authenticated"
  on public.configuracion_empaques
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "configuracion_empaques_delete_authenticated" on public.configuracion_empaques;
create policy "configuracion_empaques_delete_authenticated"
  on public.configuracion_empaques
  for delete
  to authenticated
  using (true);

create unique index if not exists configuracion_empaques_unique_tipo_capacidad_activa
  on public.configuracion_empaques (tipo_empaque, capacidad_kg)
  where esta_activo = true;

create or replace function public.configuracion_empaques_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_configuracion_empaques_updated_at on public.configuracion_empaques;
create trigger trg_configuracion_empaques_updated_at
before update on public.configuracion_empaques
for each row execute function public.configuracion_empaques_touch_updated_at();

insert into public.configuracion_empaques (tipo_empaque, capacidad_kg, esta_activo, created_at, updated_at)
select 'BOLSA', cap, true, now(), now()
from (values (15), (20), (25), (40)) as bolsa(cap)
on conflict do nothing;

insert into public.configuracion_empaques (tipo_empaque, capacidad_kg, esta_activo, created_at, updated_at)
select 'BIG_BAG', cap, true, now(), now()
from (values (500), (1000)) as bb(cap)
on conflict do nothing;
