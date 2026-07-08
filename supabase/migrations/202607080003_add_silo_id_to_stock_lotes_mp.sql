-- Migration: Add silo_id to public.stock_lotes_mp safely across environments.
alter table public.stock_lotes_mp
  add column if not exists silo_id uuid null;

create index if not exists idx_stock_lotes_mp_silo_id
  on public.stock_lotes_mp (silo_id);

do $$
declare
  silos_id_is_uuid boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'silos'
      and column_name = 'id'
      and udt_name = 'uuid'
  )
  into silos_id_is_uuid;

  if silos_id_is_uuid and not exists (
    select 1
    from pg_constraint
    where conname = 'stock_lotes_mp_silo_id_fkey'
      and conrelid = 'public.stock_lotes_mp'::regclass
  ) then
    alter table public.stock_lotes_mp
      add constraint stock_lotes_mp_silo_id_fkey
      foreign key (silo_id) references public.silos(id);
  end if;
end $$;

-- Backfill legacy rows by silo name without overwriting ubicacion.
update public.stock_lotes_mp as l
set silo_id = s.id
from public.silos as s
where l.silo_id is null
  and nullif(trim(l.ubicacion), '') is not null
  and trim(lower(l.ubicacion)) = trim(lower(s.nombre));
