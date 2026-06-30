-- RPC segura para reset total conservando auth.users y public.usuarios.
-- Limpia tablas operativas, maestras y configuraciones con TRUNCATE ... RESTART IDENTITY CASCADE.

create or replace function public.reset_total_solo_usuarios()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_current_user public.usuarios%rowtype;
  v_tables text[] := array[
    'public.ordenes_expedicion',
    'public.orden_consumo_lotes',
    'public.ordenes_produccion',
    'public.stock_pt_movimientos',
    'public.stock_pt',
    'public.stock_movimientos',
    'public.stock_lotes_mp',
    'public.trazabilidad_eventos',
    'public.historial_compras_mp',
    'public.clientes',
    'public.proveedores',
    'public.formula_ingredientes',
    'public.formulas',
    'public.insumos',
    'public.movimientos_financieros',
    'public.movimientos_costos',
    'public.costos',
    'public.flujo_caja_movimientos',
    'public.comprobantes',
    'public.presupuestos_mensuales',
    'public.historico_contable_importado',
    'public.tesoreria_cheques',
    'public.cuentas_bancarias',
    'public.alertas_estado',
    'public.alerta_configuraciones',
    'public.silos',
    'public.configuracion_empaques',
    'public.producto_empaques',
    'public.categorias_financieras',
    'public.plan_cuentas'
  ];
  v_sql text;
  v_tables_cleaned text[] := '{}';
  v_total_tables integer := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.';
  end if;

  select u.*
    into v_current_user
  from public.usuarios u
  where lower(u.email) = v_request_email
    and u.esta_activo = true
  order by case when upper(coalesce(u.role::text, '')) = 'SUPERADMIN' then 1 when upper(coalesce(u.role::text, '')) = 'ADMIN' then 2 else 3 end
  limit 1;

  if v_current_user.id is null then
    raise exception 'No se pudo verificar el usuario administrador.';
  end if;

  if upper(coalesce(v_current_user.role::text, '')) not in ('SUPERADMIN', 'ADMIN') then
    raise exception 'Solo un usuario administrador puede ejecutar el reset total.';
  end if;

  select string_agg(format('%I.%I', split_part(t, '.', 1), split_part(t, '.', 2)), ', ')
    into v_sql
  from unnest(v_tables) as t
  where to_regclass(t) is not null;

  if v_sql is not null then
    execute format('truncate table %s restart identity cascade', v_sql);
  end if;

  select coalesce(array_agg(split_part(t, '.', 2) order by t), '{}')
    into v_tables_cleaned
  from unnest(v_tables) as t
  where to_regclass(t) is not null;

  v_total_tables := coalesce(array_length(v_tables_cleaned, 1), 0);

  if to_regclass('public.auditoria_acciones') is not null then
    insert into public.auditoria_acciones (
      legacy_uid,
      usuario_id,
      usuario_login,
      usuario_nombre,
      rol,
      modulo,
      accion,
      entidad,
      entidad_ref,
      payload
    ) values (
      concat('aud-reset-', replace(gen_random_uuid()::text, '-', '')),
      v_current_user.id,
      v_current_user.email,
      v_current_user.nombre,
      upper(coalesce(v_current_user.role::text, '')),
      'admin',
      'reset_total_solo_usuarios',
      'base_datos',
      null,
      jsonb_build_object(
        'tablas_limpiadas', v_tables_cleaned,
        'tablas_totales', v_total_tables
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'tablas_limpiadas', v_tables_cleaned,
    'tablas_totales', v_total_tables
  );
end;
$$;

revoke all on function public.reset_total_solo_usuarios() from public;
grant execute on function public.reset_total_solo_usuarios() to authenticated;
