alter table public.flujo_caja_movimientos
  add column if not exists origen_modulo text,
  add column if not exists origen_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flujo_caja_movimientos_origen_modulo_chk'
  ) then
    alter table public.flujo_caja_movimientos
      add constraint flujo_caja_movimientos_origen_modulo_chk
      check (origen_modulo is null or origen_modulo in ('costos', 'finanzas', 'stock', 'produccion', 'tesoreria', 'clientes', 'otros'));
  end if;
end;
$$;

create index if not exists idx_flujo_caja_origen_costos
  on public.flujo_caja_movimientos (origen_modulo, origen_id)
  where deleted_at is null;

