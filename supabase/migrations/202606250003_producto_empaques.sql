create table if not exists public.producto_empaques (
  id uuid primary key default gen_random_uuid(),
  producto_id text not null,
  tipo_empaque text not null,
  capacidad_kg numeric(14,3) not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producto_empaques_tipo_chk check (tipo_empaque in ('BOLSA', 'BIG_BAG')),
  constraint producto_empaques_capacidad_chk check (
    (tipo_empaque = 'BOLSA' and capacidad_kg in (15, 20, 25, 40))
    or
    (tipo_empaque = 'BIG_BAG' and capacidad_kg in (500, 1000))
  )
);

create unique index if not exists producto_empaques_unique_producto_tipo_capacidad
  on public.producto_empaques (producto_id, tipo_empaque, capacidad_kg)
  where activo = true;
