-- Configuración persistente de reglas de alertas

create table if not exists public.alerta_configuraciones (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  entidad_tipo text not null,
  entidad_id uuid,
  nombre text not null,
  umbral_minimo numeric(14,3),
  umbral_critico numeric(14,3),
  unidad text,
  dias_anticipacion integer,
  severidad text not null default 'media',
  esta_activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerta_configuraciones_severidad_chk check (severidad in ('verde', 'amarillo', 'rojo', 'media', 'critica', 'informativa'))
);

create unique index if not exists idx_alerta_configuraciones_unica
  on public.alerta_configuraciones(modulo, entidad_tipo, coalesce(entidad_id::text, ''), nombre);

create index if not exists idx_alerta_configuraciones_modulo on public.alerta_configuraciones(modulo);
create index if not exists idx_alerta_configuraciones_activa on public.alerta_configuraciones(esta_activa);

create trigger trg_alerta_configuraciones_updated_at before update on public.alerta_configuraciones
for each row execute function public.set_updated_at();

insert into public.alerta_configuraciones (modulo, entidad_tipo, nombre, umbral_minimo, umbral_critico, unidad, dias_anticipacion, severidad, esta_activa)
values
  ('stock', 'insumo', 'Stock MP estándar', 1000, 500, 'KG', null, 'amarillo', true),
  ('stock', 'producto_terminado', 'Stock PT estándar', 1000, 500, 'KG', null, 'amarillo', true),
  ('tesoreria', 'cheque_emitido', 'Cheques emitidos', null, null, null, 7, 'rojo', true),
  ('tesoreria', 'cheque_recibido', 'Cheques recibidos', null, null, null, 7, 'amarillo', true),
  ('produccion', 'orden', 'Órdenes en proceso', null, null, null, 5, 'amarillo', true)
on conflict do nothing;
