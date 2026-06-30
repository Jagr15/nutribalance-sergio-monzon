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

create unique index if not exists configuracion_empaques_unique_tipo_capacidad_activa
  on public.configuracion_empaques (tipo_empaque, capacidad_kg)
  where esta_activo = true;

insert into public.configuracion_empaques (tipo_empaque, capacidad_kg, esta_activo, created_at, updated_at)
select distinct tipo_empaque, capacidad_kg, true, now(), now()
from public.producto_empaques
where activo = true
on conflict do nothing;
