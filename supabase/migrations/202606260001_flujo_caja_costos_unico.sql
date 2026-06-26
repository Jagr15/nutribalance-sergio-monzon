create unique index if not exists ux_flujo_caja_costos_origen_activo
  on public.flujo_caja_movimientos (origen_modulo, origen_id)
  where deleted_at is null
    and origen_modulo = 'costos'
    and origen_id is not null;
