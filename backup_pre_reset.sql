


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ordenes_expedicion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "numero_expedicion" "text" NOT NULL,
    "stock_pt_id" "uuid" NOT NULL,
    "producto_id" "text" NOT NULL,
    "nombre_producto" "text" NOT NULL,
    "lote_pt" "text" NOT NULL,
    "cliente_id" "uuid",
    "presentacion" "text" NOT NULL,
    "cantidad" numeric(14,3) NOT NULL,
    "estado" "text" DEFAULT 'REGISTRADA'::"text" NOT NULL,
    "motivo" "text",
    "referencia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cantidad_original" numeric(14,3) DEFAULT 0,
    "unidad_original" "text" DEFAULT 'kg'::"text",
    "cantidad_kg" numeric(14,3) DEFAULT 0,
    "modo_calculo" "text" DEFAULT 'kg_requeridos'::"text",
    "empaque_id" "uuid",
    "tipo_empaque" "text",
    "capacidad_empaque_kg" numeric(14,3) DEFAULT 1,
    "cantidad_empaques" numeric(14,3) DEFAULT 0,
    "sobrante_kg" numeric(14,3) DEFAULT 0,
    "unidad_cantidad" "text" DEFAULT 'kg'::"text",
    CONSTRAINT "ordenes_expedicion_cantidad_chk" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "ordenes_expedicion_cantidad_kg_chk" CHECK (("cantidad_kg" > (0)::numeric)),
    CONSTRAINT "ordenes_expedicion_cantidad_original_chk" CHECK (("cantidad_original" > (0)::numeric)),
    CONSTRAINT "ordenes_expedicion_estado_chk" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'preparando'::"text", 'lista'::"text", 'despachada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "ordenes_expedicion_presentacion_chk" CHECK (("presentacion" = ANY (ARRAY['GRANEL'::"text", 'BIG_BAG'::"text", 'BOLSA'::"text"]))),
    CONSTRAINT "ordenes_expedicion_unidad_cantidad_chk" CHECK (("unidad_cantidad" = ANY (ARRAY['kg'::"text", 'tonelada'::"text"])))
);


ALTER TABLE "public"."ordenes_expedicion" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_orden_expedicion"("p_orden_id" "uuid", "p_presentacion" "text" DEFAULT NULL::"text", "p_cantidad" numeric DEFAULT NULL::numeric, "p_cantidad_original" numeric DEFAULT NULL::numeric, "p_unidad_cantidad" "text" DEFAULT NULL::"text", "p_motivo" "text" DEFAULT NULL::"text", "p_referencia" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."ordenes_expedicion"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_unidad text;
  v_nueva_cantidad_kg numeric;
  v_delta numeric;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado <> 'pendiente' then
    raise exception 'Solo se puede editar una orden pendiente.';
  end if;

  v_unidad := lower(trim(coalesce(p_unidad_cantidad, v_orden.unidad_cantidad)));
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if coalesce(p_cantidad, v_orden.cantidad_original) <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  v_nueva_cantidad_kg := round(coalesce(p_cantidad_original, v_orden.cantidad_original) * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);
  v_delta := v_nueva_cantidad_kg - v_orden.cantidad_kg;

  select * into v_stock_pt from public.stock_pt where id = v_orden.stock_pt_id for update;
  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  if v_delta > 0 and (v_stock_pt.cantidad_total - coalesce(v_stock_pt.cantidad_comprometida, 0)) < v_delta then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) + v_delta),
      updated_at = now()
  where id = v_stock_pt.id;

  update public.ordenes_expedicion set
    presentacion = coalesce(p_presentacion, presentacion),
    cantidad = coalesce(p_cantidad, cantidad),
    cantidad_original = coalesce(p_cantidad_original, cantidad_original),
    unidad_original = coalesce(p_unidad_cantidad, unidad_original),
    unidad_cantidad = v_unidad,
    cantidad_kg = v_nueva_cantidad_kg,
    modo_calculo = coalesce(modo_calculo, 'kg_requeridos'),
    motivo = coalesce(p_motivo, motivo),
    referencia = coalesce(p_referencia, referencia),
    updated_at = now()
  where id = p_orden_id;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', abs(v_delta), v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    case when v_delta >= 0 then 'Ajuste al alza de reserva' else 'Ajuste a la baja de reserva' end,
    coalesce(p_referencia, v_orden.numero_expedicion), v_orden.cliente_id
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;


ALTER FUNCTION "public"."actualizar_orden_expedicion"("p_orden_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_motivo" "text", "p_referencia" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_orden_produccion_con_reserva"("p_orden_id" "uuid", "p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") RETURNS TABLE("id" "uuid", "legacy_uid" "text", "lote" "text", "id_formula_legacy" "text", "nombre_producto" "text", "version_formula" integer, "cantidad_objetivo" numeric, "cantidad_real" numeric, "merma_manual" numeric, "id_silo_legacy" "text", "destino_silo" "text", "estado" "text", "fecha_creacion" timestamp with time zone, "usuario_responsable" "text", "costo_total_insumos" numeric)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_item record;
  v_lote_id uuid;
  v_disponible numeric;
  v_consumo_count integer;
begin
  select *
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'No se puede editar una orden finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    raise exception 'No se puede editar una orden anulada.';
  end if;

  if p_detalle is null or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  -- Liberar reserva anterior antes de recalcular la nueva versión.
  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  delete from public.orden_consumo_lotes
  where orden_id = v_orden.id;

  insert into public.orden_consumo_lotes (
    orden_id,
    lote_id,
    id_lote_legacy,
    insumo_id,
    id_insumo_legacy,
    nombre_insumo,
    cantidad_usada,
    tipo_unidad,
    costo_unitario,
    costo_total
  )
  select
    v_orden.id,
    d.lote_id,
    d.id_lote,
    d.insumo_id,
    d.id_insumo,
    d.nombre_insumo,
    d.cantidad_usada,
    d.tipo_unidad,
    d.costo_unitario,
    d.costo_total
  from jsonb_to_recordset(p_detalle) as d(
    id_lote text,
    id_insumo text,
    nombre_insumo text,
    cantidad_usada numeric,
    tipo_unidad text,
    costo_unitario numeric,
    costo_total numeric,
    lote_id uuid,
    insumo_id uuid
  );

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes
  where orden_id = v_orden.id;

  if v_consumo_count = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    select (sl.cantidad_actual - sl.cantidad_comprometida)
    into v_disponible
    from public.stock_lotes_mp sl
    where sl.id = v_lote_id
      and sl.deleted_at is null
    for update;

    if v_disponible is null or v_disponible + 0.0001 < v_item.cantidad_usada then
      raise exception 'Stock insuficiente para % en lote %.', v_item.nombre_insumo, v_item.id_lote_legacy;
    end if;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = sl.cantidad_comprometida + v_item.cantidad_usada
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    legacy_uid = p_legacy_uid,
    lote = p_lote,
    formula_id = p_formula_id,
    id_formula_legacy = p_id_formula_legacy,
    nombre_producto = p_nombre_producto,
    version_formula = p_version_formula,
    cantidad_objetivo = p_cantidad_objetivo,
    cantidad_real = p_cantidad_real,
    merma_manual = p_merma_manual,
    silo_id = p_silo_id,
    id_silo_legacy = p_id_silo_legacy,
    destino_silo = p_destino_silo,
    fecha_creacion = p_fecha_creacion,
    usuario_responsable = p_usuario_responsable,
    usuario_id = p_usuario_id,
    costo_total_insumos = p_costo_total_insumos
  where op.id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'RESERVA_MP',
    format('Edición de reserva OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'accion', 'EDICION_RESERVA',
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid,
      'detalle', p_detalle
    ),
    v_orden.usuario_id
  );

  return query
  select
    op.id,
    op.legacy_uid,
    op.lote,
    op.id_formula_legacy,
    op.nombre_producto,
    op.version_formula,
    op.cantidad_objetivo,
    op.cantidad_real,
    op.merma_manual,
    op.id_silo_legacy,
    op.destino_silo,
    op.estado,
    op.fecha_creacion,
    op.usuario_responsable,
    op.costo_total_insumos
  from public.ordenes_produccion op
  where op.id = v_orden.id;
end;
$$;


ALTER FUNCTION "public"."actualizar_orden_produccion_con_reserva"("p_orden_id" "uuid", "p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anular_orden_produccion_con_liberacion"("p_orden_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_item record;
  v_lote_id uuid;
begin
  select *
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'No se puede anular una orden finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    return true;
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  update public.ordenes_produccion op
  set
    deleted_at = now(),
    estado = 'ANULADO'
  where op.id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'AJUSTE',
    format('Anulación OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'accion', 'ANULAR_OP',
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid
    ),
    v_orden.usuario_id
  );

  return true;
end;
$$;


ALTER FUNCTION "public"."anular_orden_produccion_con_liberacion"("p_orden_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_stock_movement"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.tipo = 'ENTRADA' then
    update public.stock_lotes_mp
    set
      cantidad_actual = cantidad_actual + new.cantidad,
      cantidad_inicial = cantidad_inicial + new.cantidad
    where id = new.lote_id;
  elsif new.tipo = 'SALIDA' then
    update public.stock_lotes_mp
    set cantidad_actual = cantidad_actual - new.cantidad
    where id = new.lote_id
      and cantidad_actual - new.cantidad >= 0;

    if not found then
      raise exception 'Movimiento inválido: stock negativo no permitido para lote %', new.lote_id;
    end if;
  else
    -- AJUSTE: cantidad positive; metadata.delta_sign = 1 or -1
    if coalesce((new.metadata ->> 'delta_sign')::int, 1) = -1 then
      update public.stock_lotes_mp
      set cantidad_actual = cantidad_actual - new.cantidad
      where id = new.lote_id
        and cantidad_actual - new.cantidad >= 0;

      if not found then
        raise exception 'Ajuste inválido: stock negativo no permitido para lote %', new.lote_id;
      end if;
    else
      update public.stock_lotes_mp
      set cantidad_actual = cantidad_actual + new.cantidad
      where id = new.lote_id;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."apply_stock_movement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_estado_stock_pt"("p_saldo" numeric, "p_inicial" numeric) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when coalesce(p_inicial, 0) <= 0 then 'OK'
    when p_saldo / nullif(p_inicial, 0) <= 0.2 then 'CRITICO'
    when p_saldo / nullif(p_inicial, 0) <= 0.4 then 'BAJO'
    else 'OK'
  end;
$$;


ALTER FUNCTION "public"."calcular_estado_stock_pt"("p_saldo" numeric, "p_inicial" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancelar_orden_expedicion"("p_orden_id" "uuid") RETURNS SETOF "public"."ordenes_expedicion"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_tipo_evento text;
begin
  select * into v_orden
  from public.ordenes_expedicion
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;

  if v_orden.estado = 'cancelada' then
    return query select * from public.ordenes_expedicion where id = p_orden_id;
  end if;

  if v_orden.estado not in ('pendiente', 'preparando', 'lista') then
    raise exception 'No se puede cancelar una orden ya despachada.';
  end if;

  select * into v_stock_pt
  from public.stock_pt
  where id = v_orden.stock_pt_id
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) - v_orden.cantidad_kg),
      updated_at = now()
  where id = v_stock_pt.id;

  v_tipo_evento := case when v_orden.estado = 'lista' then 'CANCELACION_EXPEDICION' else 'LIBERACION_RESERVA_PT' end;

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', v_orden.cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    case when v_orden.estado = 'lista' then 'Cancelación de expedición' else 'Liberación de reserva por cancelación' end,
    v_orden.numero_expedicion, v_orden.cliente_id
  );

  update public.ordenes_expedicion
  set estado = 'cancelada', updated_at = now()
  where id = v_orden.id;

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, v_tipo_evento, v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_orden.cantidad_kg, 'estado_anterior', v_orden.estado),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;


ALTER FUNCTION "public"."cancelar_orden_expedicion"("p_orden_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configuracion_empaques_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."configuracion_empaques_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_orden_produccion_con_reserva"("p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_estado" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") RETURNS TABLE("id" "uuid", "legacy_uid" "text", "lote" "text", "id_formula_legacy" "text", "nombre_producto" "text", "version_formula" integer, "cantidad_objetivo" numeric, "cantidad_real" numeric, "merma_manual" numeric, "id_silo_legacy" "text", "destino_silo" "text", "estado" "text", "fecha_creacion" timestamp with time zone, "usuario_responsable" "text", "costo_total_insumos" numeric)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_item record;
  v_lote_id uuid;
  v_disponible numeric;
  v_consumo_count integer;
  v_numero_op text;
begin
  if p_estado is distinct from 'PENDIENTE' then
    raise exception 'La orden debe crearse en estado PENDIENTE.';
  end if;

  if p_cantidad_objetivo is null or p_cantidad_objetivo <= 0 then
    raise exception 'La cantidad objetivo debe ser mayor a cero.';
  end if;

  if p_detalle is null or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  v_numero_op := nullif(btrim(coalesce(p_lote, '')), '');
  if v_numero_op is null then
    v_numero_op := public.generar_numero_orden_produccion();
  end if;

  insert into public.ordenes_produccion (
    legacy_uid,
    lote,
    formula_id,
    id_formula_legacy,
    nombre_producto,
    version_formula,
    cantidad_objetivo,
    cantidad_real,
    merma_manual,
    silo_id,
    id_silo_legacy,
    destino_silo,
    estado,
    fecha_creacion,
    usuario_responsable,
    usuario_id,
    costo_total_insumos
  ) values (
    coalesce(nullif(btrim(p_legacy_uid), ''), v_numero_op),
    v_numero_op,
    p_formula_id,
    p_id_formula_legacy,
    p_nombre_producto,
    p_version_formula,
    p_cantidad_objetivo,
    p_cantidad_real,
    p_merma_manual,
    p_silo_id,
    p_id_silo_legacy,
    p_destino_silo,
    p_estado,
    p_fecha_creacion,
    p_usuario_responsable,
    p_usuario_id,
    p_costo_total_insumos
  )
  returning * into v_orden;

  insert into public.orden_consumo_lotes (
    orden_id,
    lote_id,
    id_lote_legacy,
    insumo_id,
    id_insumo_legacy,
    nombre_insumo,
    cantidad_usada,
    tipo_unidad,
    costo_unitario,
    costo_total
  )
  select
    v_orden.id,
    d.lote_id,
    d.id_lote,
    d.insumo_id,
    d.id_insumo,
    d.nombre_insumo,
    d.cantidad_usada,
    d.tipo_unidad,
    d.costo_unitario,
    d.costo_total
  from jsonb_to_recordset(p_detalle) as d(
    id_lote text,
    id_insumo text,
    nombre_insumo text,
    cantidad_usada numeric,
    tipo_unidad text,
    costo_unitario numeric,
    costo_total numeric,
    lote_id uuid,
    insumo_id uuid
  );

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes
  where orden_id = v_orden.id;

  if v_consumo_count = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    select (sl.cantidad_actual - sl.cantidad_comprometida)
    into v_disponible
    from public.stock_lotes_mp sl
    where sl.id = v_lote_id
      and sl.deleted_at is null
    for update;

    if v_disponible is null or v_disponible + 0.0001 < v_item.cantidad_usada then
      raise exception 'Stock insuficiente para % en lote %.', v_item.nombre_insumo, v_item.id_lote_legacy;
    end if;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = sl.cantidad_comprometida + v_item.cantidad_usada
    where sl.id = v_lote_id;
  end loop;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'RESERVA_MP',
    format('Reserva MP OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid,
      'detalle', p_detalle
    ),
    v_orden.usuario_id
  );

  return query
  select
    op.id,
    op.legacy_uid,
    op.lote,
    op.id_formula_legacy,
    op.nombre_producto,
    op.version_formula,
    op.cantidad_objetivo,
    op.cantidad_real,
    op.merma_manual,
    op.id_silo_legacy,
    op.destino_silo,
    op.estado,
    op.fecha_creacion,
    op.usuario_responsable,
    op.costo_total_insumos
  from public.ordenes_produccion op
  where op.id = v_orden.id;
end;
$$;


ALTER FUNCTION "public"."crear_orden_produccion_con_reserva"("p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_estado" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."despachar_orden_expedicion"("p_orden_id" "uuid") RETURNS SETOF "public"."ordenes_expedicion"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_expedicion%rowtype;
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
begin
  select * into v_orden from public.ordenes_expedicion where id = p_orden_id for update;
  if not found then
    raise exception 'La orden de expedición no existe.';
  end if;
  if v_orden.estado = 'despachada' then
    return query select * from public.ordenes_expedicion where id = p_orden_id;
  end if;
  if v_orden.estado <> 'lista' then
    raise exception 'La orden debe estar en estado lista para despachar.';
  end if;

  select * into v_stock_pt from public.stock_pt where id = v_orden.stock_pt_id for update;
  if not found then
    raise exception 'El stock PT no existe.';
  end if;
  if coalesce(v_stock_pt.cantidad_comprometida, 0) < v_orden.cantidad_kg then
    raise exception 'La reserva comprometida no coincide con la orden.';
  end if;
  if v_stock_pt.cantidad_total < v_orden.cantidad_kg then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);
  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - v_orden.cantidad_kg, v_saldo_inicial);

  update public.stock_pt
  set cantidad_total = cantidad_total - v_orden.cantidad_kg,
      cantidad_comprometida = greatest(0, coalesce(cantidad_comprometida, 0) - v_orden.cantidad_kg),
      estado = v_estado,
      updated_at = now()
  where id = v_stock_pt.id;

  update public.ordenes_expedicion
  set estado = 'despachada', updated_at = now()
  where id = v_orden.id
    and estado <> 'despachada';

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'SALIDA', v_orden.cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado,
    round(v_orden.cantidad_kg * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6),
    coalesce(v_orden.motivo, 'Salida de producto terminado'),
    v_orden.numero_expedicion,
    v_orden.cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    null, v_stock_pt.id, 'DESPACHO_PT', v_orden.numero_expedicion,
    jsonb_build_object('cantidad_kg', v_orden.cantidad_kg, 'estado', 'despachada'),
    null
  );

  return query select * from public.ordenes_expedicion where id = p_orden_id;
end;
$$;


ALTER FUNCTION "public"."despachar_orden_expedicion"("p_orden_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalizar_orden_produccion"("p_orden_id" "uuid", "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_destino_silo" "text", "p_lote_salida" "text") RETURNS TABLE("id" "uuid", "legacy_uid" "text", "lote" "text", "id_formula_legacy" "text", "nombre_producto" "text", "version_formula" integer, "cantidad_objetivo" numeric, "cantidad_real" numeric, "merma_manual" numeric, "id_silo_legacy" "text", "destino_silo" "text", "estado" "text", "fecha_creacion" timestamp with time zone, "usuario_responsable" "text", "costo_total_insumos" numeric)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_silo public.silos%rowtype;
  v_stock_pt_id uuid;
  v_consumo_count integer;
  v_detalle jsonb;
  v_item record;
  v_lote record;
  v_insumo_db_id uuid;
  v_lote_id uuid;
  v_consumo_real numeric;
  v_factor numeric;
  v_disponible numeric;
  v_a_consumir numeric;
  v_consumido_lote numeric;
  v_costo_unitario numeric;
begin
  if p_cantidad_real is null or p_cantidad_real <= 0 then
    raise exception 'La cantidad real debe ser mayor a cero.';
  end if;

  if p_destino_silo is null or btrim(p_destino_silo) = '' then
    raise exception 'Debe indicar el silo de destino.';
  end if;

  if p_lote_salida is null or btrim(p_lote_salida) = '' then
    raise exception 'Debe indicar el lote de salida de producto terminado.';
  end if;

  select op.*
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  if v_orden.estado = 'ANULADO' then
    raise exception 'No se puede finalizar una orden anulada.';
  end if;

  if v_orden.estado <> 'EN PROCESO' then
    raise exception 'Solo se puede finalizar una orden EN PROCESO.';
  end if;

  if exists (
    select 1
    from public.stock_pt pt
    where pt.orden_id = v_orden.id
      and pt.deleted_at is null
  ) then
    raise exception 'La orden ya se encuentra finalizada.';
  end if;

  select s.*
  into v_silo
  from public.silos s
  where s.nombre = p_destino_silo
    and s.deleted_at is null
  limit 1;

  if not found then
    raise exception 'Silo de destino inválido.';
  end if;

  select count(*) into v_consumo_count
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  if v_consumo_count = 0 then
    raise exception 'La orden no tiene consumo planificado.';
  end if;

  if v_orden.cantidad_objetivo is null or v_orden.cantidad_objetivo <= 0 then
    raise exception 'La cantidad objetivo de la orden es inválida.';
  end if;

  v_factor := p_cantidad_real / v_orden.cantidad_objetivo;
  v_costo_unitario := round(coalesce(v_orden.costo_total_insumos, 0) / nullif(p_cantidad_real, 0), 6);

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.insumo_id,
      ocl.id_insumo_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(ocl.insumo_id, ins_legacy.id, ins_nombre.id) as insumo_db_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.insumos ins_legacy
      on ins_legacy.legacy_uid = ocl.id_insumo_legacy
      and ins_legacy.deleted_at is null
      and ins_legacy.esta_activo = true
    left join public.insumos ins_nombre
      on regexp_replace(lower(btrim(ins_nombre.nombre)), '[^a-z0-9]+', '', 'g')
         = regexp_replace(lower(btrim(ocl.nombre_insumo)), '[^a-z0-9]+', '', 'g')
      and ins_nombre.deleted_at is null
      and ins_nombre.esta_activo = true
    where ocl.orden_id = v_orden.id
    order by ocl.id asc
  loop
    if v_item.cantidad_usada <= 0 then
      raise exception 'Cantidad inválida para %.', v_item.nombre_insumo;
    end if;

    v_consumo_real := round(v_item.cantidad_usada * v_factor, 3);
    if v_consumo_real <= 0 then
      raise exception 'El consumo real calculado para % es inválido.', v_item.nombre_insumo;
    end if;

    v_insumo_db_id := v_item.insumo_db_id_resuelto;
    if v_insumo_db_id is null then
      raise exception 'No se pudo resolver el insumo % para la orden %.', v_item.nombre_insumo, v_orden.legacy_uid;
    end if;

    v_a_consumir := v_consumo_real;

    for v_lote in
      select
        sl.id,
        sl.legacy_uid,
        sl.lote,
        sl.cantidad_actual,
        sl.cantidad_comprometida,
        sl.costo_unitario
      from public.stock_lotes_mp sl
      where sl.deleted_at is null
        and sl.insumo_id = v_insumo_db_id
        and coalesce(sl.cantidad_actual, 0) > 0
      order by sl.fecha_ingreso asc, sl.created_at asc, sl.id asc
      for update of sl
    loop
      exit when v_a_consumir <= 0;

      v_disponible := round(greatest(0, v_lote.cantidad_actual - coalesce(v_lote.cantidad_comprometida, 0)), 3);
      if v_disponible <= 0 then
        continue;
      end if;

      v_lote_id := v_lote.id;
      v_consumido_lote := least(v_a_consumir, v_disponible);

      insert into public.stock_movimientos (
        lote_id,
        tipo,
        origen,
        cantidad,
        observaciones,
        metadata
      ) values (
        v_lote_id,
        'SALIDA',
        'PRODUCCION',
        v_consumido_lote,
        format('Consumo OP %s - %s', coalesce(v_orden.legacy_uid, v_orden.lote), v_item.nombre_insumo),
        jsonb_build_object(
          'orden_id', v_orden.id,
          'orden_legacy_uid', v_orden.legacy_uid,
          'lote_mp_legacy_uid', coalesce(v_lote.legacy_uid, v_lote.lote),
          'insumo_id', v_insumo_db_id,
          'nombre_insumo', v_item.nombre_insumo,
          'cantidad_planificada', v_item.cantidad_usada,
          'cantidad_real', v_consumido_lote,
          'factor_aplicado', v_factor
        )
      );

      update public.stock_lotes_mp sl_upd
      set cantidad_actual = greatest(0, coalesce(sl_upd.cantidad_actual, 0) - v_consumido_lote),
          cantidad_comprometida = greatest(0, coalesce(sl_upd.cantidad_comprometida, 0) - v_consumido_lote)
      where sl_upd.id = v_lote_id;

      v_a_consumir := round(v_a_consumir - v_consumido_lote, 3);
    end loop;

    if v_a_consumir > 0.0005 then
      raise exception 'Stock insuficiente para %.', v_item.nombre_insumo;
    end if;
  end loop;

  update public.ordenes_produccion op
  set
    estado = 'FINALIZADO',
    cantidad_real = p_cantidad_real,
    merma_manual = p_merma_manual,
    destino_silo = p_destino_silo,
    silo_id = v_silo.id,
    id_silo_legacy = v_silo.legacy_uid
  where op.id = v_orden.id;

  select jsonb_agg(
    jsonb_build_object(
      'id_lote', ocl.id_lote_legacy,
      'id_insumo', ocl.id_insumo_legacy,
      'nombre_insumo', ocl.nombre_insumo,
      'cantidad_usada', ocl.cantidad_usada,
      'tipo_unidad', ocl.tipo_unidad,
      'costo_unitario', ocl.costo_unitario,
      'costo_total', ocl.costo_total
    )
  ) into v_detalle
  from public.orden_consumo_lotes ocl
  where ocl.orden_id = v_orden.id;

  insert into public.stock_pt (
    legacy_uid,
    orden_id,
    id_orden_legacy,
    numero_orden,
    nombre_producto,
    cantidad_total,
    cantidad_inicial,
    costo_unitario_estimado,
    id_formula_legacy,
    version_formula,
    lote,
    unidad_medida,
    estado,
    silo_id,
    id_silo_legacy,
    nombre_silo,
    detalle_insumos,
    usuario
  ) values (
    'pt-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    v_orden.legacy_uid,
    v_orden.legacy_uid,
    v_orden.nombre_producto,
    p_cantidad_real,
    p_cantidad_real,
    v_costo_unitario,
    v_orden.id_formula_legacy,
    v_orden.version_formula,
    p_lote_salida,
    'KG',
    'OK',
    v_silo.id,
    v_silo.legacy_uid,
    v_silo.nombre,
    coalesce(v_detalle, '[]'::jsonb),
    v_orden.usuario_responsable
  )
  returning stock_pt.id into v_stock_pt_id;

  return query
  select
    op.id,
    op.legacy_uid,
    op.lote,
    op.id_formula_legacy,
    op.nombre_producto,
    op.version_formula,
    op.cantidad_objetivo,
    op.cantidad_real,
    op.merma_manual,
    op.id_silo_legacy,
    op.destino_silo,
    op.estado,
    op.fecha_creacion,
    op.usuario_responsable,
    op.costo_total_insumos
  from public.ordenes_produccion op
  where op.id = v_orden.id;
end;
$$;


ALTER FUNCTION "public"."finalizar_orden_produccion"("p_orden_id" "uuid", "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_destino_silo" "text", "p_lote_salida" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generar_numero_orden_produccion"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_numero bigint;
begin
  v_numero := nextval('public.ordenes_produccion_numero_seq');
  return 'OP-' || lpad(v_numero::text, 6, '0');
end;
$$;


ALTER FUNCTION "public"."generar_numero_orden_produccion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."liberar_reserva_orden_produccion"("p_orden_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  v_orden public.ordenes_produccion%rowtype;
  v_item record;
  v_lote_id uuid;
begin
  select *
  into v_orden
  from public.ordenes_produccion op
  where op.id = p_orden_id
    and op.deleted_at is null
  for update;

  if not found then
    raise exception 'Orden no encontrada.';
  end if;

  if v_orden.estado = 'FINALIZADO' then
    raise exception 'No se puede liberar la reserva de una orden finalizada.';
  end if;

  for v_item in
    select
      ocl.id_lote_legacy,
      ocl.nombre_insumo,
      ocl.cantidad_usada,
      coalesce(
        ocl.lote_id,
        sl_legacy.id,
        sl_nombre.id
      ) as lote_id_resuelto
    from public.orden_consumo_lotes ocl
    left join public.stock_lotes_mp sl_legacy
      on sl_legacy.legacy_uid = ocl.id_lote_legacy
      and sl_legacy.deleted_at is null
    left join public.stock_lotes_mp sl_nombre
      on sl_nombre.lote = ocl.id_lote_legacy
      and sl_nombre.deleted_at is null
    where ocl.orden_id = v_orden.id
  loop
    if v_item.lote_id_resuelto is null then
      raise exception 'No se encontró lote %.', v_item.id_lote_legacy;
    end if;

    v_lote_id := v_item.lote_id_resuelto;

    update public.stock_lotes_mp sl
    set cantidad_comprometida = greatest(0, sl.cantidad_comprometida - v_item.cantidad_usada)
    where sl.id = v_lote_id;
  end loop;

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_orden.id,
    'AJUSTE',
    format('Liberación de reserva OP %s', coalesce(v_orden.legacy_uid, v_orden.lote)),
    jsonb_build_object(
      'accion', 'LIBERAR_RESERVA',
      'orden_id', v_orden.id,
      'orden_legacy_uid', v_orden.legacy_uid
    ),
    v_orden.usuario_id
  );

  return true;
end;
$$;


ALTER FUNCTION "public"."liberar_reserva_orden_produccion"("p_orden_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_orden_expedicion"("p_stock_pt_id" "uuid", "p_cliente_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric DEFAULT NULL::numeric, "p_unidad_cantidad" "text" DEFAULT NULL::"text", "p_modo_calculo" "text" DEFAULT NULL::"text", "p_empaque_id" "uuid" DEFAULT NULL::"uuid", "p_tipo_empaque" "text" DEFAULT NULL::"text", "p_capacidad_empaque_kg" numeric DEFAULT NULL::numeric, "p_cantidad_empaques" numeric DEFAULT NULL::numeric, "p_sobrante_kg" numeric DEFAULT NULL::numeric, "p_motivo" "text" DEFAULT NULL::"text", "p_referencia" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."ordenes_expedicion"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_numero_expedicion text;
  v_legacy_uid text;
  v_presentacion text := upper(trim(coalesce(p_presentacion, '')));
  v_unidad text := lower(trim(coalesce(p_unidad_cantidad, 'kg')));
  v_cantidad_kg numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad a expedir debe ser mayor a cero.';
  end if;
  if p_cantidad_original is null or p_cantidad_original <= 0 then
    raise exception 'La cantidad original debe ser mayor a cero.';
  end if;
  if v_unidad not in ('kg', 'tonelada') then
    raise exception 'La unidad de medida no es válida.';
  end if;
  if p_cliente_id is null then
    raise exception 'El cliente destino es obligatorio.';
  end if;
  if v_presentacion not in ('GRANEL', 'BIG_BAG', 'BOLSA') then
    raise exception 'La presentación seleccionada no es válida.';
  end if;

  v_cantidad_kg := round(p_cantidad_original * case when v_unidad = 'tonelada' then 1000 else 1 end, 3);

  select *
  into v_stock_pt
  from public.stock_pt pt
  where pt.id = p_stock_pt_id
    and pt.deleted_at is null
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  if (v_stock_pt.cantidad_total - coalesce(v_stock_pt.cantidad_comprometida, 0)) < v_cantidad_kg then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  update public.stock_pt
  set cantidad_comprometida = coalesce(cantidad_comprometida, 0) + v_cantidad_kg,
      updated_at = now()
  where id = v_stock_pt.id;

  v_numero_expedicion := format('EXP-%s-%06s', to_char(now(), 'YYYY'), nextval('public.ordenes_expedicion_numero_seq'));
  v_legacy_uid := 'exp-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.ordenes_expedicion (
    legacy_uid, numero_expedicion, stock_pt_id, producto_id, nombre_producto, lote_pt,
    cliente_id, presentacion, cantidad, cantidad_original, unidad_original, unidad_cantidad, cantidad_kg,
    modo_calculo, empaque_id, tipo_empaque, capacidad_empaque_kg, cantidad_empaques, sobrante_kg,
    estado, motivo, referencia
  ) values (
    v_legacy_uid, v_numero_expedicion, v_stock_pt.id,
    coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, p_cliente_id, v_presentacion, p_cantidad,
    p_cantidad_original, v_unidad, v_unidad, v_cantidad_kg,
    coalesce(p_modo_calculo, 'kg_requeridos'), p_empaque_id, p_tipo_empaque,
    coalesce(p_capacidad_empaque_kg, 1), coalesce(p_cantidad_empaques, p_cantidad_original), coalesce(p_sobrante_kg, 0),
    'pendiente',
    coalesce(p_motivo, 'Despacho de producto terminado'),
    coalesce(p_referencia, v_numero_expedicion)
  );

  insert into public.stock_pt_movimientos (
    stock_pt_id, producto_id, nombre_producto, lote, numero_orden, silo, tipo, cantidad, unidad,
    costo_unitario, valor_total, motivo, referencia, cliente_id
  ) values (
    v_stock_pt.id, coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto),
    v_stock_pt.nombre_producto, v_stock_pt.lote, v_stock_pt.numero_orden, v_stock_pt.nombre_silo,
    'AJUSTE', v_cantidad_kg, v_stock_pt.unidad_medida, v_stock_pt.costo_unitario_estimado, 0,
    'Reserva de stock para orden de expedición', v_numero_expedicion, p_cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid, orden_id, stock_pt_id, tipo, referencia, payload, usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''), v_stock_pt.orden_id, v_stock_pt.id, 'RESERVA_PT', v_numero_expedicion,
    jsonb_build_object('cantidad_kg', v_cantidad_kg, 'cantidad_original', p_cantidad_original, 'unidad', v_unidad, 'estado', 'pendiente'),
    null
  );

  return query select * from public.ordenes_expedicion where legacy_uid = v_legacy_uid;
end;
$$;


ALTER FUNCTION "public"."registrar_orden_expedicion"("p_stock_pt_id" "uuid", "p_cliente_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_modo_calculo" "text", "p_empaque_id" "uuid", "p_tipo_empaque" "text", "p_capacidad_empaque_kg" numeric, "p_cantidad_empaques" numeric, "p_sobrante_kg" numeric, "p_motivo" "text", "p_referencia" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_pt" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "orden_id" "uuid",
    "id_orden_legacy" "text",
    "numero_orden" "text",
    "nombre_producto" "text" NOT NULL,
    "cantidad_total" numeric(14,3) NOT NULL,
    "lote" "text" NOT NULL,
    "unidad_medida" "text" NOT NULL,
    "estado" "text" DEFAULT 'OK'::"text" NOT NULL,
    "silo_id" "uuid",
    "id_silo_legacy" "text",
    "nombre_silo" "text",
    "detalle_insumos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "fecha_ingreso" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "cantidad_inicial" numeric(14,3),
    "costo_unitario_estimado" numeric(14,6),
    "id_formula_legacy" "text",
    "version_formula" integer,
    "cantidad_comprometida" numeric(14,3) DEFAULT 0 NOT NULL,
    CONSTRAINT "stock_pt_cantidad_comprometida_non_negative" CHECK (("cantidad_comprometida" >= (0)::numeric)),
    CONSTRAINT "stock_pt_cantidad_inicial_non_negative" CHECK ((("cantidad_inicial" IS NULL) OR ("cantidad_inicial" >= (0)::numeric))),
    CONSTRAINT "stock_pt_cantidad_non_negative" CHECK (("cantidad_total" >= (0)::numeric)),
    CONSTRAINT "stock_pt_comprometida_lte_total" CHECK (("cantidad_comprometida" <= "cantidad_total")),
    CONSTRAINT "stock_pt_costo_unitario_estimado_non_negative" CHECK ((("costo_unitario_estimado" IS NULL) OR ("costo_unitario_estimado" >= (0)::numeric))),
    CONSTRAINT "stock_pt_estado_chk" CHECK (("estado" = ANY (ARRAY['OK'::"text", 'BAJO'::"text", 'CRITICO'::"text"])))
);


ALTER TABLE "public"."stock_pt" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text" DEFAULT NULL::"text", "p_referencia" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."stock_pt"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
  v_producto_id text;
  v_valor_total numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad de salida debe ser mayor a cero.';
  end if;

  select *
  into v_stock_pt
  from public.stock_pt pt
  where pt.id = p_stock_pt_id
    and pt.deleted_at is null
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);

  if v_stock_pt.cantidad_total < p_cantidad then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - p_cantidad, v_saldo_inicial);
  v_producto_id := coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto);
  v_valor_total := round(p_cantidad * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6);

  update public.stock_pt
  set
    cantidad_total = cantidad_total - p_cantidad,
    estado = v_estado,
    updated_at = now()
  where id = v_stock_pt.id;

  insert into public.stock_pt_movimientos (
    stock_pt_id,
    producto_id,
    nombre_producto,
    lote,
    numero_orden,
    silo,
    tipo,
    cantidad,
    unidad,
    costo_unitario,
    valor_total,
    motivo,
    referencia
  ) values (
    v_stock_pt.id,
    v_producto_id,
    v_stock_pt.nombre_producto,
    v_stock_pt.lote,
    v_stock_pt.numero_orden,
    v_stock_pt.nombre_silo,
    'SALIDA',
    p_cantidad,
    v_stock_pt.unidad_medida,
    v_stock_pt.costo_unitario_estimado,
    v_valor_total,
    coalesce(p_motivo, 'Salida de producto terminado'),
    p_referencia
  );

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    stock_pt_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_stock_pt.orden_id,
    v_stock_pt.id,
    'DESPACHO_PT',
    coalesce(p_referencia, format('Salida PT %s', v_stock_pt.lote)),
    jsonb_build_object(
      'cantidad', p_cantidad,
      'motivo', coalesce(p_motivo, 'Salida de producto terminado'),
      'lote', v_stock_pt.lote,
      'saldo_anterior', v_stock_pt.cantidad_total,
      'saldo_nuevo', v_stock_pt.cantidad_total - p_cantidad
    ),
    null
  );

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;


ALTER FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text" DEFAULT NULL::"text", "p_referencia" "text" DEFAULT NULL::"text", "p_cliente_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "public"."stock_pt"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_stock_pt public.stock_pt%rowtype;
  v_saldo_inicial numeric;
  v_estado text;
  v_producto_id text;
  v_valor_total numeric;
  v_cliente_nombre text;
  v_cliente_legacy_uid text;
  v_categoria_id uuid;
  v_centro_costo_id uuid;
  v_comprobante_id uuid;
  v_comprobante_legacy_uid text;
  v_numero_comprobante text;
  v_fecha_vencimiento date;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad de salida debe ser mayor a cero.';
  end if;

  select *
  into v_stock_pt
  from public.stock_pt pt
  where pt.id = p_stock_pt_id
    and pt.deleted_at is null
  for update;

  if not found then
    raise exception 'El stock PT no existe.';
  end if;

  v_saldo_inicial := coalesce(v_stock_pt.cantidad_inicial, v_stock_pt.cantidad_total);

  if v_stock_pt.cantidad_total < p_cantidad then
    raise exception 'No hay saldo suficiente en el lote de PT.';
  end if;

  v_estado := public.calcular_estado_stock_pt(v_stock_pt.cantidad_total - p_cantidad, v_saldo_inicial);
  v_producto_id := coalesce(v_stock_pt.id_formula_legacy, v_stock_pt.nombre_producto);
  v_valor_total := round(p_cantidad * coalesce(v_stock_pt.costo_unitario_estimado, 0), 6);

  update public.stock_pt
  set
    cantidad_total = cantidad_total - p_cantidad,
    estado = v_estado,
    updated_at = now()
  where id = v_stock_pt.id;

  insert into public.stock_pt_movimientos (
    stock_pt_id,
    producto_id,
    nombre_producto,
    lote,
    numero_orden,
    silo,
    tipo,
    cantidad,
    unidad,
    costo_unitario,
    valor_total,
    motivo,
    referencia,
    cliente_id
  ) values (
    v_stock_pt.id,
    v_producto_id,
    v_stock_pt.nombre_producto,
    v_stock_pt.lote,
    v_stock_pt.numero_orden,
    v_stock_pt.nombre_silo,
    'SALIDA',
    p_cantidad,
    v_stock_pt.unidad_medida,
    v_stock_pt.costo_unitario_estimado,
    v_valor_total,
    coalesce(p_motivo, 'Salida de producto terminado'),
    p_referencia,
    p_cliente_id
  );

  insert into public.trazabilidad_eventos (
    legacy_uid,
    orden_id,
    stock_pt_id,
    tipo,
    referencia,
    payload,
    usuario_id
  ) values (
    'trz-' || replace(gen_random_uuid()::text, '-', ''),
    v_stock_pt.orden_id,
    v_stock_pt.id,
    'DESPACHO_PT',
    coalesce(p_referencia, format('Salida PT %s', v_stock_pt.lote)),
    jsonb_build_object(
      'cantidad', p_cantidad,
      'motivo', coalesce(p_motivo, 'Salida de producto terminado'),
      'lote', v_stock_pt.lote,
      'saldo_anterior', v_stock_pt.cantidad_total,
      'saldo_nuevo', v_stock_pt.cantidad_total - p_cantidad,
      'cliente_id', p_cliente_id
    ),
    null
  );

  if p_cliente_id is not null and v_valor_total > 0 then
    select c.nombre, c.legacy_uid
    into v_cliente_nombre, v_cliente_legacy_uid
    from public.clientes c
    where c.id = p_cliente_id
      and c.deleted_at is null;

    if not found then
      raise exception 'El cliente destino no existe.';
    end if;

    select cf.id
    into v_categoria_id
    from public.categorias_financieras cf
    where cf.legacy_uid = 'cat-ventas'
      and cf.deleted_at is null
    limit 1;

    select cc.id
    into v_centro_costo_id
    from public.centros_costo cc
    where cc.legacy_uid = 'cc-planta'
      and cc.deleted_at is null
    limit 1;

    v_numero_comprobante := format(
      'FV-PT-%s-%s',
      to_char(now(), 'YYYY'),
      lpad(nextval('public.comprobantes_numero_seq')::text, 6, '0')
    );
    v_comprobante_legacy_uid := 'cxc-' || replace(gen_random_uuid()::text, '-', '');
    v_fecha_vencimiento := (now() + interval '30 days')::date;

    insert into public.comprobantes (
      legacy_uid,
      tipo,
      numero,
      fecha_emision,
      fecha_vencimiento,
      tercero,
      estado,
      total,
      saldo,
      cliente_id
    ) values (
      v_comprobante_legacy_uid,
      'FACTURA_VENTA',
      v_numero_comprobante,
      now()::date,
      v_fecha_vencimiento,
      v_cliente_nombre,
      'PENDIENTE',
      v_valor_total,
      v_valor_total,
      p_cliente_id
    )
    returning id into v_comprobante_id;

    insert into public.flujo_caja_movimientos (
      legacy_uid,
      fecha,
      tipo,
      origen_operativo,
      descripcion,
      monto,
      categoria_id,
      centro_costo_id,
      comprobante_id,
      stock_pt_id,
      estado,
      metadata
    ) values (
      'fcm-' || replace(gen_random_uuid()::text, '-', ''),
      now(),
      'INGRESO',
      'VENTA_PT',
      coalesce(p_referencia, format('Venta PT %s', v_stock_pt.nombre_producto)),
      v_valor_total,
      v_categoria_id,
      v_centro_costo_id,
      v_comprobante_id,
      v_stock_pt.id,
      'CONFIRMADO',
      jsonb_build_object(
        'cliente_id', p_cliente_id,
        'cliente_nombre', v_cliente_nombre,
        'cliente_legacy_uid', v_cliente_legacy_uid,
        'producto', v_stock_pt.nombre_producto,
        'lote_pt', v_stock_pt.lote,
        'cantidad', p_cantidad,
        'comprobante_legacy_uid', v_comprobante_legacy_uid
      )
    )
    on conflict (legacy_uid) do update set
      fecha = excluded.fecha,
      tipo = excluded.tipo,
      origen_operativo = excluded.origen_operativo,
      descripcion = excluded.descripcion,
      monto = excluded.monto,
      categoria_id = excluded.categoria_id,
      centro_costo_id = excluded.centro_costo_id,
      comprobante_id = excluded.comprobante_id,
      stock_pt_id = excluded.stock_pt_id,
      estado = excluded.estado,
      metadata = excluded.metadata;
  end if;

  return query
  select *
  from public.stock_pt
  where id = v_stock_pt.id;
end;
$$;


ALTER FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text", "p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerta_configuraciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modulo" "text" NOT NULL,
    "entidad_tipo" "text" NOT NULL,
    "entidad_id" "uuid",
    "nombre" "text" NOT NULL,
    "umbral_minimo" numeric(14,3),
    "umbral_critico" numeric(14,3),
    "unidad" "text",
    "dias_anticipacion" integer,
    "severidad" "text" DEFAULT 'media'::"text" NOT NULL,
    "esta_activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alerta_configuraciones_severidad_chk" CHECK (("severidad" = ANY (ARRAY['verde'::"text", 'amarillo'::"text", 'rojo'::"text", 'media'::"text", 'critica'::"text", 'informativa'::"text"])))
);


ALTER TABLE "public"."alerta_configuraciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertas_estado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alerta_key" "text" NOT NULL,
    "estado" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "comentario" "text",
    "usuario_id" "uuid",
    "origen" "text",
    "prioridad" "text",
    "ultima_actualizacion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alertas_estado_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'EN_SEGUIMIENTO'::"text", 'ATENDIDA'::"text", 'DESCARTADA'::"text"])))
);


ALTER TABLE "public"."alertas_estado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auditoria_acciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "usuario_id" "uuid",
    "usuario_login" "text",
    "usuario_nombre" "text",
    "rol" "text",
    "modulo" "text" NOT NULL,
    "accion" "text" NOT NULL,
    "entidad" "text",
    "entidad_ref" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auditoria_acciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categorias_financieras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "area" "text" NOT NULL,
    "plan_cuenta_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "categorias_tipo_mov_chk" CHECK (("tipo_movimiento" = ANY (ARRAY['INGRESO'::"text", 'EGRESO'::"text", 'TRANSFERENCIA'::"text"])))
);


ALTER TABLE "public"."categorias_financieras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."centros_costo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."centros_costo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "razon_social" "text",
    "cuit" "text",
    "email" "text",
    "telefono" "text",
    "direccion" "text",
    "localidad" "text",
    "provincia" "text",
    "segmento" "text",
    "ubicacion" "text",
    "contacto" "text",
    "producto_principal" "text",
    "condicion_comercial" "text",
    "estado" "text" DEFAULT 'Activo'::"text" NOT NULL,
    "observaciones" "text",
    "ultima_compra" "date",
    "saldo_pendiente_ars" numeric(14,2) DEFAULT 0 NOT NULL,
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "clientes_saldo_non_negative" CHECK (("saldo_pendiente_ars" >= (0)::numeric))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comprobantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "tipo" "text" NOT NULL,
    "numero" "text",
    "fecha_emision" "date" NOT NULL,
    "fecha_vencimiento" "date",
    "tercero" "text",
    "estado" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "total" numeric(16,2) DEFAULT 0 NOT NULL,
    "saldo" numeric(16,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "cliente_id" "uuid",
    CONSTRAINT "comprobantes_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'PAGADO'::"text", 'VENCIDO'::"text", 'ANULADO'::"text"]))),
    CONSTRAINT "comprobantes_tipo_chk" CHECK (("tipo" = ANY (ARRAY['FACTURA_COMPRA'::"text", 'FACTURA_VENTA'::"text", 'RECIBO'::"text", 'PAGO'::"text", 'AJUSTE'::"text"])))
);


ALTER TABLE "public"."comprobantes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."comprobantes_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."comprobantes_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion_empaques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_empaque" "text" NOT NULL,
    "capacidad_kg" numeric(14,3) NOT NULL,
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "configuracion_empaques_capacidad_chk" CHECK (((("tipo_empaque" = 'BOLSA'::"text") AND ("capacidad_kg" = ANY (ARRAY[(15)::numeric, (20)::numeric, (25)::numeric, (40)::numeric]))) OR (("tipo_empaque" = 'BIG_BAG'::"text") AND ("capacidad_kg" = ANY (ARRAY[(500)::numeric, (1000)::numeric]))))),
    CONSTRAINT "configuracion_empaques_tipo_chk" CHECK (("tipo_empaque" = ANY (ARRAY['BOLSA'::"text", 'BIG_BAG'::"text"])))
);


ALTER TABLE "public"."configuracion_empaques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_bancarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "banco" "text" NOT NULL,
    "alias" "text",
    "cbu" "text",
    "moneda" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "saldo_actual" numeric(16,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."cuentas_bancarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flujo_caja_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "text" NOT NULL,
    "origen_operativo" "text",
    "descripcion" "text" NOT NULL,
    "monto" numeric(16,2) NOT NULL,
    "categoria_id" "uuid",
    "centro_costo_id" "uuid",
    "cuenta_bancaria_id" "uuid",
    "forma_pago_id" "uuid",
    "comprobante_id" "uuid",
    "orden_produccion_id" "uuid",
    "stock_lote_mp_id" "uuid",
    "stock_pt_id" "uuid",
    "estado" "text" DEFAULT 'CONFIRMADO'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "origen_modulo" "text",
    "origen_id" "text",
    CONSTRAINT "flujo_caja_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'CONFIRMADO'::"text", 'ANULADO'::"text"]))),
    CONSTRAINT "flujo_caja_monto_positive" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "flujo_caja_movimientos_origen_modulo_chk" CHECK ((("origen_modulo" IS NULL) OR ("origen_modulo" = ANY (ARRAY['costos'::"text", 'finanzas'::"text", 'stock'::"text", 'produccion'::"text", 'tesoreria'::"text", 'clientes'::"text", 'otros'::"text"])))),
    CONSTRAINT "flujo_caja_tipo_chk" CHECK (("tipo" = ANY (ARRAY['INGRESO'::"text", 'EGRESO'::"text", 'TRANSFERENCIA'::"text"])))
);


ALTER TABLE "public"."flujo_caja_movimientos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formas_pago" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "dias_plazo" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "formas_pago_dias_plazo_non_negative" CHECK (("dias_plazo" >= 0)),
    CONSTRAINT "formas_pago_tipo_chk" CHECK (("tipo" = ANY (ARRAY['EFECTIVO'::"text", 'TRANSFERENCIA'::"text", 'CHEQUE'::"text", 'TARJETA'::"text", 'CTA_CTE'::"text"])))
);


ALTER TABLE "public"."formas_pago" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formula_ingredientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "formula_id" "uuid" NOT NULL,
    "insumo_id" "uuid" NOT NULL,
    "nombre_insumo" "text" NOT NULL,
    "porcentaje" numeric(8,4) NOT NULL,
    "orden" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aporte_proteina_pct" numeric(10,6),
    "aporte_proteina_g_kg" numeric(10,6),
    "costo_unitario_usado" numeric(14,6),
    "costo_contribucion_kg" numeric(14,6),
    "fuente_costo" "text",
    CONSTRAINT "formula_ingredientes_fuente_costo_chk" CHECK ((("fuente_costo" IS NULL) OR ("fuente_costo" = ANY (ARRAY['ULTIMO_LOTE'::"text", 'REFERENCIA'::"text", 'SIN_COSTO'::"text"])))),
    CONSTRAINT "formula_ingredientes_porcentaje_non_negative" CHECK (("porcentaje" >= (0)::numeric))
);


ALTER TABLE "public"."formula_ingredientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formulas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre_producto" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "esta_activa" boolean DEFAULT true NOT NULL,
    "ultima_edicion" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id_usuario" "uuid",
    "author" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "proteina_calculada_pct" numeric(10,4),
    "costo_total" numeric(14,6),
    "costo_por_kg" numeric(14,6),
    "costo_por_tonelada" numeric(14,6),
    "advertencias_nutricionales" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "advertencias_costos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "formulas_version_positive" CHECK (("version" > 0))
);


ALTER TABLE "public"."formulas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insumos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "unidad_medida" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "umbral_alerta" numeric(14,3) DEFAULT 0 NOT NULL,
    "ref_costo_unitario" numeric(14,6),
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "proteina_bruta_pct" numeric(8,4),
    "humedad_pct" numeric(8,4),
    "fibra_pct" numeric(8,4),
    "grasa_pct" numeric(8,4),
    "cenizas_pct" numeric(8,4),
    "unidad_base" "text",
    "observaciones" "text",
    "costo" numeric(14,6),
    "unidad_costo" "text",
    "costo_por_kg" numeric(14,6),
    "costo_por_tonelada" numeric(14,6),
    CONSTRAINT "insumos_cenizas_pct_range" CHECK ((("cenizas_pct" IS NULL) OR (("cenizas_pct" >= (0)::numeric) AND ("cenizas_pct" <= (100)::numeric)))),
    CONSTRAINT "insumos_fibra_pct_range" CHECK ((("fibra_pct" IS NULL) OR (("fibra_pct" >= (0)::numeric) AND ("fibra_pct" <= (100)::numeric)))),
    CONSTRAINT "insumos_grasa_pct_range" CHECK ((("grasa_pct" IS NULL) OR (("grasa_pct" >= (0)::numeric) AND ("grasa_pct" <= (100)::numeric)))),
    CONSTRAINT "insumos_humedad_pct_range" CHECK ((("humedad_pct" IS NULL) OR (("humedad_pct" >= (0)::numeric) AND ("humedad_pct" <= (100)::numeric)))),
    CONSTRAINT "insumos_proteina_bruta_pct_range" CHECK ((("proteina_bruta_pct" IS NULL) OR (("proteina_bruta_pct" >= (0)::numeric) AND ("proteina_bruta_pct" <= (100)::numeric)))),
    CONSTRAINT "insumos_ref_costo_non_negative" CHECK ((("ref_costo_unitario" IS NULL) OR ("ref_costo_unitario" >= (0)::numeric))),
    CONSTRAINT "insumos_umbral_alerta_non_negative" CHECK (("umbral_alerta" >= (0)::numeric)),
    CONSTRAINT "insumos_unidad_costo_check" CHECK ((("unidad_costo" IS NULL) OR ("unidad_costo" = ANY (ARRAY['KG'::"text", 'TON'::"text"]))))
);


ALTER TABLE "public"."insumos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proveedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre_empresa" "text" NOT NULL,
    "contacto_nombre" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "email" "text",
    "direccion" "text" NOT NULL,
    "documento" "text",
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "producto_que_provee" "text",
    CONSTRAINT "proveedores_email_chk" CHECK ((POSITION(('@'::"text") IN ("email")) > 1))
);


ALTER TABLE "public"."proveedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_lotes_mp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "insumo_id" "uuid" NOT NULL,
    "proveedor_id" "uuid" NOT NULL,
    "lote" "text" NOT NULL,
    "remito_nro" "text" NOT NULL,
    "ubicacion" "text" NOT NULL,
    "cantidad_inicial" numeric(14,3) NOT NULL,
    "cantidad_actual" numeric(14,3) NOT NULL,
    "cantidad_comprometida" numeric(14,3) DEFAULT 0 NOT NULL,
    "costo_unitario" numeric(14,6) NOT NULL,
    "costo_total" numeric(14,6) NOT NULL,
    "fecha_ingreso" timestamp with time zone NOT NULL,
    "id_usuario" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "stock_lotes_mp_cantidad_actual_non_negative" CHECK (("cantidad_actual" >= (0)::numeric)),
    CONSTRAINT "stock_lotes_mp_cantidad_comprometida_non_negative" CHECK (("cantidad_comprometida" >= (0)::numeric)),
    CONSTRAINT "stock_lotes_mp_cantidad_inicial_positive" CHECK (("cantidad_inicial" > (0)::numeric)),
    CONSTRAINT "stock_lotes_mp_comprometida_lte_actual" CHECK (("cantidad_comprometida" <= "cantidad_actual")),
    CONSTRAINT "stock_lotes_mp_costo_total_non_negative" CHECK (("costo_total" >= (0)::numeric)),
    CONSTRAINT "stock_lotes_mp_costo_unitario_non_negative" CHECK (("costo_unitario" >= (0)::numeric))
);


ALTER TABLE "public"."stock_lotes_mp" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."historial_compras_mp" AS
 SELECT "p"."nombre_empresa" AS "proveedor",
    "p"."legacy_uid" AS "id_proveedor",
    "i"."nombre" AS "insumo",
    "i"."legacy_uid" AS "id_insumo",
    "sl"."fecha_ingreso" AS "fecha_compra",
    "sl"."lote",
    "sl"."cantidad_inicial" AS "cantidad",
    "sl"."costo_unitario",
    "sl"."costo_total"
   FROM (("public"."stock_lotes_mp" "sl"
     JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
     JOIN "public"."proveedores" "p" ON (("p"."id" = "sl"."proveedor_id")))
  WHERE (("sl"."deleted_at" IS NULL) AND ("i"."deleted_at" IS NULL) AND ("p"."deleted_at" IS NULL));


ALTER VIEW "public"."historial_compras_mp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_contable_importado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "tipo" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "monto" numeric(16,2) NOT NULL,
    "origen_operativo" "text" NOT NULL,
    "estado" "text" DEFAULT 'CONFIRMADO'::"text" NOT NULL,
    "source_batch_uid" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "historico_contable_importado_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'CONFIRMADO'::"text", 'ANULADO'::"text"]))),
    CONSTRAINT "historico_contable_importado_tipo_chk" CHECK (("tipo" = ANY (ARRAY['INGRESO'::"text", 'EGRESO'::"text", 'TRANSFERENCIA'::"text"])))
);


ALTER TABLE "public"."historico_contable_importado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orden_consumo_lotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orden_id" "uuid" NOT NULL,
    "lote_id" "uuid",
    "id_lote_legacy" "text",
    "insumo_id" "uuid",
    "id_insumo_legacy" "text",
    "nombre_insumo" "text" NOT NULL,
    "cantidad_usada" numeric(14,3) NOT NULL,
    "tipo_unidad" "text" NOT NULL,
    "costo_unitario" numeric(14,6) NOT NULL,
    "costo_total" numeric(14,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orden_consumo_lotes_cantidad_positive" CHECK (("cantidad_usada" > (0)::numeric)),
    CONSTRAINT "orden_consumo_lotes_costo_total_non_negative" CHECK (("costo_total" >= (0)::numeric)),
    CONSTRAINT "orden_consumo_lotes_costo_unitario_non_negative" CHECK (("costo_unitario" >= (0)::numeric))
);


ALTER TABLE "public"."orden_consumo_lotes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ordenes_expedicion_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ordenes_expedicion_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ordenes_produccion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "lote" "text" NOT NULL,
    "formula_id" "uuid",
    "id_formula_legacy" "text",
    "nombre_producto" "text" NOT NULL,
    "version_formula" integer NOT NULL,
    "cantidad_objetivo" numeric(14,3) NOT NULL,
    "cantidad_real" numeric(14,3),
    "merma_manual" numeric(14,3),
    "silo_id" "uuid",
    "id_silo_legacy" "text",
    "destino_silo" "text",
    "estado" "text" NOT NULL,
    "fecha_creacion" timestamp with time zone NOT NULL,
    "usuario_responsable" "text" NOT NULL,
    "usuario_id" "uuid",
    "costo_total_insumos" numeric(14,6) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ordenes_cantidad_objetivo_positive" CHECK (("cantidad_objetivo" > (0)::numeric)),
    CONSTRAINT "ordenes_cantidad_real_non_negative" CHECK ((("cantidad_real" IS NULL) OR ("cantidad_real" >= (0)::numeric))),
    CONSTRAINT "ordenes_merma_non_negative" CHECK ((("merma_manual" IS NULL) OR ("merma_manual" >= (0)::numeric))),
    CONSTRAINT "ordenes_produccion_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'EN PROCESO'::"text", 'FINALIZADO'::"text", 'ANULADO'::"text"])))
);


ALTER TABLE "public"."ordenes_produccion" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ordenes_produccion_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ordenes_produccion_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_cuentas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "naturaleza" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "plan_cuentas_naturaleza_chk" CHECK (("naturaleza" = ANY (ARRAY['DEUDORA'::"text", 'ACREEDORA'::"text"]))),
    CONSTRAINT "plan_cuentas_tipo_chk" CHECK (("tipo" = ANY (ARRAY['ACTIVO'::"text", 'PASIVO'::"text", 'PATRIMONIO'::"text", 'INGRESO'::"text", 'EGRESO'::"text", 'RESULTADO'::"text"])))
);


ALTER TABLE "public"."plan_cuentas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."presupuestos_mensuales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "anio" integer NOT NULL,
    "mes" integer NOT NULL,
    "categoria_id" "uuid",
    "centro_costo_id" "uuid",
    "monto_presupuestado" numeric(16,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "rubro_id" "uuid",
    CONSTRAINT "presupuestos_mes_chk" CHECK ((("mes" >= 1) AND ("mes" <= 12))),
    CONSTRAINT "presupuestos_monto_non_negative" CHECK (("monto_presupuestado" >= (0)::numeric))
);


ALTER TABLE "public"."presupuestos_mensuales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producto_empaques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "producto_id" "text" NOT NULL,
    "tipo_empaque" "text" NOT NULL,
    "capacidad_kg" numeric(14,3) NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "producto_empaques_capacidad_chk" CHECK (((("tipo_empaque" = 'BOLSA'::"text") AND ("capacidad_kg" = ANY (ARRAY[(15)::numeric, (20)::numeric, (25)::numeric, (40)::numeric]))) OR (("tipo_empaque" = 'BIG_BAG'::"text") AND ("capacidad_kg" = ANY (ARRAY[(500)::numeric, (1000)::numeric]))))),
    CONSTRAINT "producto_empaques_tipo_chk" CHECK (("tipo_empaque" = ANY (ARRAY['BOLSA'::"text", 'BIG_BAG'::"text"])))
);


ALTER TABLE "public"."producto_empaques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."silos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "nombre" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "tipo_uso" "text" DEFAULT 'MATERIA_PRIMA'::"text" NOT NULL,
    CONSTRAINT "silos_tipo_uso_check" CHECK (("tipo_uso" = ANY (ARRAY['MATERIA_PRIMA'::"text", 'PRODUCTO_TERMINADO'::"text"])))
);


ALTER TABLE "public"."silos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lote_id" "uuid" NOT NULL,
    "usuario_id" "uuid",
    "tipo" "text" NOT NULL,
    "origen" "text" NOT NULL,
    "cantidad" numeric(14,3) NOT NULL,
    "observaciones" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movimientos_cantidad_positive" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "stock_movimientos_origen_chk" CHECK (("origen" = ANY (ARRAY['COMPRA'::"text", 'PRODUCCION'::"text", 'VENTA'::"text", 'MERMA'::"text", 'AJUSTE'::"text"]))),
    CONSTRAINT "stock_movimientos_tipo_chk" CHECK (("tipo" = ANY (ARRAY['ENTRADA'::"text", 'SALIDA'::"text", 'AJUSTE'::"text"])))
);


ALTER TABLE "public"."stock_movimientos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stock_mp_resumen" AS
 SELECT "i"."legacy_uid" AS "insumo_id",
    "i"."nombre" AS "nombre_insumo",
    "i"."unidad_medida" AS "unidad",
    (COALESCE("sum"("sl"."cantidad_actual"), (0)::numeric))::numeric(14,3) AS "stock_actual",
    (COALESCE("sum"("sl"."cantidad_comprometida"), (0)::numeric))::numeric(14,3) AS "stock_comprometido",
    (COALESCE("sum"(("sl"."cantidad_actual" - "sl"."cantidad_comprometida")), (0)::numeric))::numeric(14,3) AS "stock_disponible",
    (COALESCE("i"."umbral_alerta", (0)::numeric))::numeric(14,3) AS "umbral_alerta",
        CASE
            WHEN (COALESCE("sum"(("sl"."cantidad_actual" - "sl"."cantidad_comprometida")), (0)::numeric) <= COALESCE("i"."umbral_alerta", (0)::numeric)) THEN 'CRITICO'::"text"
            WHEN (COALESCE("sum"(("sl"."cantidad_actual" - "sl"."cantidad_comprometida")), (0)::numeric) <= (COALESCE("i"."umbral_alerta", (0)::numeric) * (2)::numeric)) THEN 'BAJO'::"text"
            ELSE 'OK'::"text"
        END AS "estado"
   FROM ("public"."insumos" "i"
     LEFT JOIN "public"."stock_lotes_mp" "sl" ON ((("sl"."insumo_id" = "i"."id") AND ("sl"."deleted_at" IS NULL))))
  WHERE ("i"."deleted_at" IS NULL)
  GROUP BY "i"."id", "i"."legacy_uid", "i"."nombre", "i"."unidad_medida", "i"."umbral_alerta";


ALTER VIEW "public"."stock_mp_resumen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_pt_movimientos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stock_pt_id" "uuid",
    "producto_id" "text",
    "nombre_producto" "text" NOT NULL,
    "lote" "text" NOT NULL,
    "numero_orden" "text",
    "silo" "text",
    "tipo" "text" NOT NULL,
    "cantidad" numeric(14,3) NOT NULL,
    "unidad" "text" NOT NULL,
    "costo_unitario" numeric(14,6),
    "valor_total" numeric(14,6),
    "motivo" "text",
    "referencia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cliente_id" "uuid",
    CONSTRAINT "stock_pt_movimientos_cantidad_chk" CHECK (("cantidad" > (0)::numeric)),
    CONSTRAINT "stock_pt_movimientos_costo_chk" CHECK ((("costo_unitario" IS NULL) OR ("costo_unitario" >= (0)::numeric))),
    CONSTRAINT "stock_pt_movimientos_tipo_chk" CHECK (("tipo" = ANY (ARRAY['INGRESO'::"text", 'SALIDA'::"text", 'AJUSTE'::"text"]))),
    CONSTRAINT "stock_pt_movimientos_valor_chk" CHECK ((("valor_total" IS NULL) OR ("valor_total" >= (0)::numeric)))
);


ALTER TABLE "public"."stock_pt_movimientos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."stock_pt_resumen" AS
 WITH "base" AS (
         SELECT "pt"."id" AS "stock_pt_id",
            COALESCE("pt"."id_formula_legacy", "op"."id_formula_legacy", "pt"."nombre_producto") AS "producto_id",
            "pt"."nombre_producto",
            "pt"."unidad_medida" AS "unidad",
            "pt"."cantidad_total",
            COALESCE("pt"."cantidad_inicial", "pt"."cantidad_total") AS "cantidad_inicial",
            COALESCE("pt"."costo_unitario_estimado",
                CASE
                    WHEN (("pt"."cantidad_total" > (0)::numeric) AND (COALESCE("op"."costo_total_insumos", (0)::numeric) > (0)::numeric)) THEN ("op"."costo_total_insumos" / NULLIF("pt"."cantidad_total", (0)::numeric))
                    ELSE (0)::numeric
                END) AS "costo_unitario_estimado",
            "pt"."estado",
            "pt"."updated_at",
            "pt"."fecha_ingreso",
            "pt"."numero_orden",
            "pt"."id_formula_legacy",
            "pt"."version_formula"
           FROM ("public"."stock_pt" "pt"
             LEFT JOIN "public"."ordenes_produccion" "op" ON (("op"."id" = "pt"."orden_id")))
          WHERE ("pt"."deleted_at" IS NULL)
        )
 SELECT "producto_id",
    "nombre_producto",
    "unidad",
    (COALESCE("sum"("cantidad_total"), (0)::numeric))::numeric(14,3) AS "stock_actual",
    (COALESCE("sum"(("cantidad_total" * "costo_unitario_estimado")), (0)::numeric))::numeric(14,6) AS "valor_monetario",
        CASE
            WHEN (COALESCE("sum"("cantidad_inicial"), (0)::numeric) <= (0)::numeric) THEN 'OK'::"text"
            WHEN ((COALESCE("sum"("cantidad_total"), (0)::numeric) / NULLIF(COALESCE("sum"("cantidad_inicial"), (0)::numeric), (0)::numeric)) <= 0.2) THEN 'CRITICO'::"text"
            WHEN ((COALESCE("sum"("cantidad_total"), (0)::numeric) / NULLIF(COALESCE("sum"("cantidad_inicial"), (0)::numeric), (0)::numeric)) <= 0.4) THEN 'BAJO'::"text"
            ELSE 'OK'::"text"
        END AS "estado",
    ("count"(*))::integer AS "cantidad_lotes",
    "max"(GREATEST(COALESCE("updated_at", "fecha_ingreso"), "fecha_ingreso")) AS "ultima_actualizacion",
    ("array_agg"("numero_orden" ORDER BY COALESCE("updated_at", "fecha_ingreso") DESC))[1] AS "numero_orden",
    ("array_agg"("id_formula_legacy" ORDER BY COALESCE("updated_at", "fecha_ingreso") DESC))[1] AS "id_formula",
    ("array_agg"("version_formula" ORDER BY COALESCE("updated_at", "fecha_ingreso") DESC))[1] AS "version_formula"
   FROM "base"
  GROUP BY "producto_id", "nombre_producto", "unidad";


ALTER VIEW "public"."stock_pt_resumen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tesoreria_cheques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "numero" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "tercero" "text" NOT NULL,
    "importe" numeric(16,2) NOT NULL,
    "fecha_emision" "date" NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "estado" "text" DEFAULT 'PENDIENTE'::"text" NOT NULL,
    "cliente_id" "uuid",
    "cliente_nombre" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "fecha_acreditacion" "date",
    CONSTRAINT "tesoreria_cheques_estado_chk" CHECK (("estado" = ANY (ARRAY['PENDIENTE'::"text", 'A_DEPOSITAR'::"text", 'DEPOSITADO'::"text", 'COBRADO'::"text", 'RECHAZADO'::"text", 'ENDOSADO'::"text", 'VENCIDO'::"text"]))),
    CONSTRAINT "tesoreria_cheques_importe_non_negative" CHECK (("importe" >= (0)::numeric)),
    CONSTRAINT "tesoreria_cheques_tipo_chk" CHECK (("tipo" = ANY (ARRAY['EMITIDO'::"text", 'RECIBIDO'::"text"])))
);


ALTER TABLE "public"."tesoreria_cheques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trazabilidad_eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "orden_id" "uuid",
    "stock_lote_mp_id" "uuid",
    "stock_pt_id" "uuid",
    "tipo" "text" NOT NULL,
    "referencia" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "fecha_evento" timestamp with time zone DEFAULT "now"() NOT NULL,
    "usuario_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trazabilidad_eventos_tipo_chk" CHECK (("tipo" = ANY (ARRAY['AJUSTE'::"text", 'CONSUMO_MP'::"text", 'DESPACHO_PT'::"text", 'INGRESO_MP'::"text", 'INGRESO_PT'::"text", 'PRODUCCION_FIN'::"text", 'PRODUCCION_INICIO'::"text", 'RESERVA_MP'::"text", 'RESERVA_PT'::"text", 'LIBERACION_RESERVA_PT'::"text", 'CANCELACION_EXPEDICION'::"text"])))
);


ALTER TABLE "public"."trazabilidad_eventos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ultimo_precio_pagado_insumo" AS
 WITH "compras_ordenadas" AS (
         SELECT "i"."legacy_uid" AS "id_insumo",
            "i"."nombre" AS "insumo",
            "p"."legacy_uid" AS "id_proveedor",
            "p"."nombre_empresa" AS "ultimo_proveedor",
            "sl"."fecha_ingreso" AS "fecha_ultima_compra",
            "sl"."costo_unitario" AS "ultimo_precio",
            "lead"("sl"."costo_unitario") OVER (PARTITION BY "i"."id" ORDER BY "sl"."fecha_ingreso" DESC, "sl"."created_at" DESC, "sl"."id" DESC) AS "precio_compra_anterior",
            "row_number"() OVER (PARTITION BY "i"."id" ORDER BY "sl"."fecha_ingreso" DESC, "sl"."created_at" DESC, "sl"."id" DESC) AS "rn"
           FROM (("public"."stock_lotes_mp" "sl"
             JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
             JOIN "public"."proveedores" "p" ON (("p"."id" = "sl"."proveedor_id")))
          WHERE (("sl"."deleted_at" IS NULL) AND ("i"."deleted_at" IS NULL) AND ("p"."deleted_at" IS NULL))
        )
 SELECT "insumo",
    "id_insumo",
    "ultimo_proveedor",
    "id_proveedor",
    "fecha_ultima_compra",
    "ultimo_precio",
    "precio_compra_anterior",
    (("ultimo_precio" - "precio_compra_anterior"))::numeric(14,6) AS "variacion_absoluta",
        CASE
            WHEN (("precio_compra_anterior" IS NULL) OR ("precio_compra_anterior" = (0)::numeric)) THEN NULL::numeric
            ELSE "round"(((("ultimo_precio" - "precio_compra_anterior") / "precio_compra_anterior") * (100)::numeric), 2)
        END AS "variacion_pct"
   FROM "compras_ordenadas"
  WHERE ("rn" = 1);


ALTER VIEW "public"."ultimo_precio_pagado_insumo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legacy_uid" "text",
    "role_id" "uuid",
    "nombre" "text" NOT NULL,
    "email" "text" NOT NULL,
    "esta_activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_costos_formula_vs_real" AS
 WITH "formulas_base" AS (
         SELECT COALESCE("f"."legacy_uid", (("f"."nombre_producto" || '::'::"text") || COALESCE(("f"."version")::"text", '0'::"text"))) AS "clave_formula",
            "f"."legacy_uid" AS "producto_formula_id",
            "f"."nombre_producto",
            "f"."version" AS "version_formula",
            (COALESCE("f"."costo_por_kg", (0)::numeric))::numeric(14,6) AS "costo_formulado_kg",
            (COALESCE("f"."costo_por_tonelada", (COALESCE("f"."costo_por_kg", (0)::numeric) * (1000)::numeric)))::numeric(14,6) AS "costo_formulado_ton"
           FROM "public"."formulas" "f"
          WHERE ("f"."deleted_at" IS NULL)
        ), "ops_agg" AS (
         SELECT COALESCE("op"."id_formula_legacy", (("op"."nombre_producto" || '::'::"text") || COALESCE(("op"."version_formula")::"text", '0'::"text"))) AS "clave_formula",
            "max"("op"."id_formula_legacy") AS "producto_formula_id",
            "max"("op"."nombre_producto") AS "nombre_producto",
            "max"("op"."version_formula") AS "version_formula",
            (COALESCE("sum"("op"."costo_total_insumos"), (0)::numeric))::numeric(14,6) AS "costo_total_insumos",
            (COALESCE("sum"(COALESCE("op"."cantidad_real", "op"."cantidad_objetivo")), (0)::numeric))::numeric(14,6) AS "cantidad_real_total",
            ("array_agg"("op"."lote" ORDER BY "op"."fecha_creacion" DESC))[1] AS "ultima_op",
            "max"("op"."fecha_creacion") AS "ultima_fecha"
           FROM "public"."ordenes_produccion" "op"
          WHERE (("op"."deleted_at" IS NULL) AND ("op"."estado" = 'FINALIZADO'::"text"))
          GROUP BY COALESCE("op"."id_formula_legacy", (("op"."nombre_producto" || '::'::"text") || COALESCE(("op"."version_formula")::"text", '0'::"text")))
        )
 SELECT COALESCE("f"."producto_formula_id", "o"."producto_formula_id", "o"."clave_formula") AS "producto_formula_id",
    COALESCE("f"."nombre_producto", "o"."nombre_producto", 'Sin dato'::"text") AS "nombre_producto",
    COALESCE("f"."version_formula", "o"."version_formula") AS "version_formula",
    (COALESCE("f"."costo_formulado_kg", (0)::numeric))::numeric(14,6) AS "costo_formulado_kg",
    (COALESCE("f"."costo_formulado_ton", (COALESCE("f"."costo_formulado_kg", (0)::numeric) * (1000)::numeric)))::numeric(14,6) AS "costo_formulado_ton",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN (("o"."costo_total_insumos" / "o"."cantidad_real_total"))::numeric(14,6)
            ELSE (0)::numeric(14,6)
        END AS "costo_real_kg",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN ((("o"."costo_total_insumos" / "o"."cantidad_real_total") * (1000)::numeric))::numeric(14,6)
            ELSE (0)::numeric(14,6)
        END AS "costo_real_ton",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN ((("o"."costo_total_insumos" / "o"."cantidad_real_total") - COALESCE("f"."costo_formulado_kg", (0)::numeric)))::numeric(14,6)
            ELSE ((- COALESCE("f"."costo_formulado_kg", (0)::numeric)))::numeric(14,6)
        END AS "variacion_abs",
    (
        CASE
            WHEN (COALESCE("f"."costo_formulado_kg", (0)::numeric) > (0)::numeric) THEN (((
            CASE
                WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN ("o"."costo_total_insumos" / "o"."cantidad_real_total")
                ELSE (0)::numeric
            END - COALESCE("f"."costo_formulado_kg", (0)::numeric)) / COALESCE("f"."costo_formulado_kg", (1)::numeric)) * (100)::numeric)
            ELSE (0)::numeric
        END)::numeric(14,6) AS "variacion_pct",
    "o"."ultima_op",
    "o"."ultima_fecha"
   FROM ("formulas_base" "f"
     LEFT JOIN "ops_agg" "o" ON (("o"."clave_formula" = "f"."clave_formula")))
UNION ALL
 SELECT "o"."producto_formula_id",
    "o"."nombre_producto",
    "o"."version_formula",
    (0)::numeric(14,6) AS "costo_formulado_kg",
    (0)::numeric(14,6) AS "costo_formulado_ton",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN (("o"."costo_total_insumos" / "o"."cantidad_real_total"))::numeric(14,6)
            ELSE (0)::numeric(14,6)
        END AS "costo_real_kg",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN ((("o"."costo_total_insumos" / "o"."cantidad_real_total") * (1000)::numeric))::numeric(14,6)
            ELSE (0)::numeric(14,6)
        END AS "costo_real_ton",
        CASE
            WHEN (COALESCE("o"."cantidad_real_total", (0)::numeric) > (0)::numeric) THEN (("o"."costo_total_insumos" / "o"."cantidad_real_total"))::numeric(14,6)
            ELSE (0)::numeric(14,6)
        END AS "variacion_abs",
    (0)::numeric(14,6) AS "variacion_pct",
    "o"."ultima_op",
    "o"."ultima_fecha"
   FROM ("ops_agg" "o"
     LEFT JOIN "formulas_base" "f" ON (("f"."clave_formula" = "o"."clave_formula")))
  WHERE ("f"."clave_formula" IS NULL);


ALTER VIEW "public"."vw_costos_formula_vs_real" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_dashboard_alertas_operativas" AS
 WITH "stock_bajo" AS (
         SELECT ('stock_bajo_minimo:'::"text" || ("sl"."id")::"text") AS "alerta_id",
            'Stock bajo mínimo'::"text" AS "tipo",
            'critica'::"text" AS "prioridad",
            'stock'::"text" AS "area",
            "format"('El lote %s (%s) está por debajo del umbral.'::"text", "sl"."lote", "i"."nombre") AS "titulo",
            "jsonb_build_object"('lote', "sl"."lote", 'insumo', "i"."nombre") AS "dato_asociado",
            "now"() AS "fecha_evento"
           FROM ("public"."stock_lotes_mp" "sl"
             JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
          WHERE (("sl"."deleted_at" IS NULL) AND ("i"."deleted_at" IS NULL) AND (("sl"."cantidad_actual" - "sl"."cantidad_comprometida") <= COALESCE("i"."umbral_alerta", (0)::numeric)))
        ), "lote_sin_costo" AS (
         SELECT ('lote_sin_costo:'::"text" || ("sl"."id")::"text") AS "?column?",
            'Lote sin costo'::"text" AS "text",
            'media'::"text" AS "text",
            'costos'::"text" AS "text",
            "format"('El lote %s no tiene costo unitario válido.'::"text", "sl"."lote") AS "format",
            "jsonb_build_object"('lote', "sl"."lote", 'insumo', "i"."nombre") AS "jsonb_build_object",
            "now"() AS "now"
           FROM ("public"."stock_lotes_mp" "sl"
             JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
          WHERE (("sl"."deleted_at" IS NULL) AND ((COALESCE("sl"."costo_unitario", (0)::numeric) <= (0)::numeric) OR (COALESCE("sl"."costo_total", (0)::numeric) <= (0)::numeric)))
        ), "insumo_sin_pb" AS (
         SELECT ('insumo_sin_pb:'::"text" || ("i"."id")::"text") AS "?column?",
            'Insumo sin PB'::"text" AS "text",
            'media'::"text" AS "text",
            'costos'::"text" AS "text",
            "format"('El insumo %s no tiene proteína bruta configurada.'::"text", "i"."nombre") AS "format",
            "jsonb_build_object"('insumo', "i"."nombre") AS "jsonb_build_object",
            "now"() AS "now"
           FROM "public"."insumos" "i"
          WHERE (("i"."deleted_at" IS NULL) AND (("i"."proteina_bruta_pct" IS NULL) OR ("i"."proteina_bruta_pct" <= (0)::numeric)))
        ), "formula_fuera" AS (
         SELECT ('formula_fuera_100:'::"text" || ("f"."id")::"text") AS "?column?",
            'Fórmula fuera de 100%'::"text" AS "text",
            'critica'::"text" AS "text",
            'produccion'::"text" AS "text",
            "format"('La fórmula %s suma %s%%.'::"text", "f"."nombre_producto", "round"("sum"("fi"."porcentaje"), 2)) AS "format",
            "jsonb_build_object"('producto', "f"."nombre_producto") AS "jsonb_build_object",
            "now"() AS "now"
           FROM ("public"."formulas" "f"
             JOIN "public"."formula_ingredientes" "fi" ON (("fi"."formula_id" = "f"."id")))
          WHERE ("f"."deleted_at" IS NULL)
          GROUP BY "f"."id", "f"."nombre_producto"
         HAVING ("abs"(("sum"("fi"."porcentaje") - (100)::numeric)) > 0.01)
        ), "merma_alta" AS (
         SELECT ('merma_alta:'::"text" || ("o"."id")::"text") AS "?column?",
            'Merma alta'::"text" AS "text",
            'critica'::"text" AS "text",
            'produccion'::"text" AS "text",
            "format"('La orden %s reporta merma alta (%s kg).'::"text", COALESCE("o"."legacy_uid", "o"."lote"), "round"(COALESCE("o"."merma_manual", (0)::numeric), 2)) AS "format",
            "jsonb_build_object"('orden', COALESCE("o"."legacy_uid", "o"."lote"), 'producto', "o"."nombre_producto") AS "jsonb_build_object",
            "o"."updated_at"
           FROM "public"."ordenes_produccion" "o"
          WHERE (("o"."deleted_at" IS NULL) AND ("o"."estado" = 'FINALIZADO'::"text") AND (COALESCE("o"."merma_manual", (0)::numeric) > GREATEST((100)::numeric, (COALESCE("o"."cantidad_objetivo", (0)::numeric) * 0.05))))
        ), "silo_saturado" AS (
         SELECT ('silo_saturado:'::"text" || COALESCE(("sp"."silo_id")::"text", 'sin-silo'::"text")) AS "?column?",
            'Silo saturado'::"text" AS "text",
            'media'::"text" AS "text",
            'productos'::"text" AS "text",
            "format"('El silo %s acumula %s lotes PT activos.'::"text", COALESCE("sp"."nombre_silo", 'Sin silo'::"text"), ("count"(*))::"text") AS "format",
            "jsonb_build_object"('lote', COALESCE("sp"."nombre_silo", 'Sin silo'::"text"), 'producto', 'PT') AS "jsonb_build_object",
            "now"() AS "now"
           FROM "public"."stock_pt" "sp"
          WHERE ("sp"."deleted_at" IS NULL)
          GROUP BY "sp"."silo_id", "sp"."nombre_silo"
         HAVING ("count"(*) >= 5)
        ), "trazabilidad_incompleta" AS (
         WITH "t" AS (
                 SELECT "trazabilidad_eventos"."orden_id",
                    "bool_or"(("trazabilidad_eventos"."tipo" = 'CONSUMO_MP'::"text")) AS "has_consumo",
                    "bool_or"(("trazabilidad_eventos"."tipo" = 'PRODUCCION_FIN'::"text")) AS "has_fin",
                    "bool_or"(("trazabilidad_eventos"."tipo" = 'INGRESO_PT'::"text")) AS "has_ingreso_pt"
                   FROM "public"."trazabilidad_eventos"
                  GROUP BY "trazabilidad_eventos"."orden_id"
                )
         SELECT ('trazabilidad_incompleta:'::"text" || ("o"."id")::"text") AS "?column?",
            'Producción sin trazabilidad completa'::"text" AS "text",
            'critica'::"text" AS "text",
            'produccion'::"text" AS "text",
            "format"('La orden %s no tiene eventos completos de trazabilidad.'::"text", COALESCE("o"."legacy_uid", "o"."lote")) AS "format",
            "jsonb_build_object"('orden', COALESCE("o"."legacy_uid", "o"."lote"), 'producto', "o"."nombre_producto") AS "jsonb_build_object",
            "o"."updated_at"
           FROM ("public"."ordenes_produccion" "o"
             LEFT JOIN "t" ON (("t"."orden_id" = "o"."id")))
          WHERE (("o"."deleted_at" IS NULL) AND ("o"."estado" = 'FINALIZADO'::"text") AND (NOT COALESCE(("t"."has_consumo" AND "t"."has_fin" AND "t"."has_ingreso_pt"), false)))
        )
 SELECT "stock_bajo"."alerta_id",
    "stock_bajo"."tipo",
    "stock_bajo"."prioridad",
    "stock_bajo"."area",
    "stock_bajo"."titulo",
    "stock_bajo"."dato_asociado",
    "stock_bajo"."fecha_evento"
   FROM "stock_bajo"
UNION ALL
 SELECT "lote_sin_costo"."?column?" AS "alerta_id",
    "lote_sin_costo"."text" AS "tipo",
    "lote_sin_costo"."text_1" AS "prioridad",
    "lote_sin_costo"."text_2" AS "area",
    "lote_sin_costo"."format" AS "titulo",
    "lote_sin_costo"."jsonb_build_object" AS "dato_asociado",
    "lote_sin_costo"."now" AS "fecha_evento"
   FROM "lote_sin_costo" "lote_sin_costo"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "now")
UNION ALL
 SELECT "insumo_sin_pb"."?column?" AS "alerta_id",
    "insumo_sin_pb"."text" AS "tipo",
    "insumo_sin_pb"."text_1" AS "prioridad",
    "insumo_sin_pb"."text_2" AS "area",
    "insumo_sin_pb"."format" AS "titulo",
    "insumo_sin_pb"."jsonb_build_object" AS "dato_asociado",
    "insumo_sin_pb"."now" AS "fecha_evento"
   FROM "insumo_sin_pb" "insumo_sin_pb"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "now")
UNION ALL
 SELECT "formula_fuera"."?column?" AS "alerta_id",
    "formula_fuera"."text" AS "tipo",
    "formula_fuera"."text_1" AS "prioridad",
    "formula_fuera"."text_2" AS "area",
    "formula_fuera"."format" AS "titulo",
    "formula_fuera"."jsonb_build_object" AS "dato_asociado",
    "formula_fuera"."now" AS "fecha_evento"
   FROM "formula_fuera" "formula_fuera"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "now")
UNION ALL
 SELECT "merma_alta"."?column?" AS "alerta_id",
    "merma_alta"."text" AS "tipo",
    "merma_alta"."text_1" AS "prioridad",
    "merma_alta"."text_2" AS "area",
    "merma_alta"."format" AS "titulo",
    "merma_alta"."jsonb_build_object" AS "dato_asociado",
    "merma_alta"."updated_at" AS "fecha_evento"
   FROM "merma_alta" "merma_alta"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "updated_at")
UNION ALL
 SELECT "silo_saturado"."?column?" AS "alerta_id",
    "silo_saturado"."text" AS "tipo",
    "silo_saturado"."text_1" AS "prioridad",
    "silo_saturado"."text_2" AS "area",
    "silo_saturado"."format" AS "titulo",
    "silo_saturado"."jsonb_build_object" AS "dato_asociado",
    "silo_saturado"."now" AS "fecha_evento"
   FROM "silo_saturado" "silo_saturado"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "now")
UNION ALL
 SELECT "trazabilidad_incompleta"."?column?" AS "alerta_id",
    "trazabilidad_incompleta"."text" AS "tipo",
    "trazabilidad_incompleta"."text_1" AS "prioridad",
    "trazabilidad_incompleta"."text_2" AS "area",
    "trazabilidad_incompleta"."format" AS "titulo",
    "trazabilidad_incompleta"."jsonb_build_object" AS "dato_asociado",
    "trazabilidad_incompleta"."updated_at" AS "fecha_evento"
   FROM "trazabilidad_incompleta" "trazabilidad_incompleta"("?column?", "text", "text_1", "text_2", "format", "jsonb_build_object", "updated_at");


ALTER VIEW "public"."vw_dashboard_alertas_operativas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_dashboard_costos_resumen" AS
 WITH "formula_totals" AS (
         SELECT "f"."id",
            "f"."legacy_uid",
            "f"."nombre_producto",
            (COALESCE("sum"("fi"."porcentaje"), (0)::numeric))::numeric(10,4) AS "formula_total_pct",
            (COALESCE("sum"((("fi"."porcentaje" / 100.0) * COALESCE("i"."proteina_bruta_pct", (0)::numeric))), (0)::numeric))::numeric(10,4) AS "proteina_formula_pct"
           FROM (("public"."formulas" "f"
             LEFT JOIN "public"."formula_ingredientes" "fi" ON (("fi"."formula_id" = "f"."id")))
             LEFT JOIN "public"."insumos" "i" ON (("i"."id" = "fi"."insumo_id")))
          WHERE ("f"."deleted_at" IS NULL)
          GROUP BY "f"."id", "f"."legacy_uid", "f"."nombre_producto"
        ), "consumo" AS (
         SELECT ("date_trunc"('month'::"text", "o"."fecha_creacion"))::"date" AS "mes",
            "ocl"."nombre_insumo",
            ("sum"("ocl"."cantidad_usada"))::numeric(14,3) AS "consumo_kg"
           FROM ("public"."orden_consumo_lotes" "ocl"
             JOIN "public"."ordenes_produccion" "o" ON (("o"."id" = "ocl"."orden_id")))
          WHERE ("o"."deleted_at" IS NULL)
          GROUP BY (("date_trunc"('month'::"text", "o"."fecha_creacion"))::"date"), "ocl"."nombre_insumo"
        )
 SELECT (COALESCE("avg"("proteina_formula_pct"), (0)::numeric))::numeric(10,4) AS "proteina_promedio_formula",
    COALESCE("jsonb_agg"("jsonb_build_object"('id_formula', "legacy_uid", 'nombre_producto', "nombre_producto", 'total_pct', "formula_total_pct", 'proteina_pct', "proteina_formula_pct") ORDER BY "nombre_producto") FILTER (WHERE ("id" IS NOT NULL)), '[]'::"jsonb") AS "formulas",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('mes', "to_char"(("c"."mes")::timestamp with time zone, 'YYYY-MM'::"text"), 'insumo', "c"."nombre_insumo", 'consumo_kg', "c"."consumo_kg") ORDER BY "c"."mes", "c"."nombre_insumo") AS "jsonb_agg"
           FROM "consumo" "c"), '[]'::"jsonb") AS "consumo_mensual"
   FROM "formula_totals" "ft";


ALTER VIEW "public"."vw_dashboard_costos_resumen" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_dashboard_produccion_resumen" AS
 WITH "ord" AS (
         SELECT "ordenes_produccion"."id",
            "ordenes_produccion"."legacy_uid",
            "ordenes_produccion"."lote",
            "ordenes_produccion"."formula_id",
            "ordenes_produccion"."id_formula_legacy",
            "ordenes_produccion"."nombre_producto",
            "ordenes_produccion"."version_formula",
            "ordenes_produccion"."cantidad_objetivo",
            "ordenes_produccion"."cantidad_real",
            "ordenes_produccion"."merma_manual",
            "ordenes_produccion"."silo_id",
            "ordenes_produccion"."id_silo_legacy",
            "ordenes_produccion"."destino_silo",
            "ordenes_produccion"."estado",
            "ordenes_produccion"."fecha_creacion",
            "ordenes_produccion"."usuario_responsable",
            "ordenes_produccion"."usuario_id",
            "ordenes_produccion"."costo_total_insumos",
            "ordenes_produccion"."created_at",
            "ordenes_produccion"."updated_at",
            "ordenes_produccion"."deleted_at"
           FROM "public"."ordenes_produccion"
          WHERE ("ordenes_produccion"."deleted_at" IS NULL)
        ), "trz" AS (
         SELECT "trazabilidad_eventos"."orden_id",
            "bool_or"(("trazabilidad_eventos"."tipo" = 'CONSUMO_MP'::"text")) AS "has_consumo",
            "bool_or"(("trazabilidad_eventos"."tipo" = 'PRODUCCION_FIN'::"text")) AS "has_fin",
            "bool_or"(("trazabilidad_eventos"."tipo" = 'INGRESO_PT'::"text")) AS "has_ingreso_pt"
           FROM "public"."trazabilidad_eventos"
          GROUP BY "trazabilidad_eventos"."orden_id"
        )
 SELECT (COALESCE("sum"(
        CASE
            WHEN ("ord"."estado" = 'PENDIENTE'::"text") THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "ordenes_pendientes",
    (COALESCE("sum"(
        CASE
            WHEN ("ord"."estado" = 'EN PROCESO'::"text") THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "ordenes_en_proceso",
    (COALESCE("sum"(
        CASE
            WHEN ("ord"."estado" = 'FINALIZADO'::"text") THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "ordenes_finalizadas",
    (COALESCE("sum"(
        CASE
            WHEN ("ord"."estado" = 'FINALIZADO'::"text") THEN "ord"."cantidad_real"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(14,3) AS "produccion_total",
    (COALESCE("avg"(
        CASE
            WHEN (("ord"."estado" = 'FINALIZADO'::"text") AND ("ord"."cantidad_real" > (0)::numeric)) THEN ("ord"."costo_total_insumos" / "ord"."cantidad_real")
            ELSE NULL::numeric
        END), (0)::numeric))::numeric(14,6) AS "costo_promedio_produccion",
    (COALESCE("sum"(
        CASE
            WHEN ("ord"."estado" = 'FINALIZADO'::"text") THEN COALESCE("ord"."merma_manual", (0)::numeric)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(14,3) AS "merma_total",
    (COALESCE("sum"(
        CASE
            WHEN (("ord"."estado" = 'FINALIZADO'::"text") AND (NOT COALESCE(("trz"."has_consumo" AND "trz"."has_fin" AND "trz"."has_ingreso_pt"), false))) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "produccion_sin_trazabilidad"
   FROM ("ord"
     LEFT JOIN "trz" ON (("trz"."orden_id" = "ord"."id")));


ALTER VIEW "public"."vw_dashboard_produccion_resumen" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_dashboard_stock_resumen" AS
 WITH "mp" AS (
         SELECT (COALESCE("sum"("sl"."cantidad_actual"), (0)::numeric))::numeric(14,3) AS "stock_total_mp",
            (COALESCE("sum"(("sl"."costo_total" *
                CASE
                    WHEN ("sl"."cantidad_inicial" > (0)::numeric) THEN ("sl"."cantidad_actual" / "sl"."cantidad_inicial")
                    ELSE (0)::numeric
                END)), (0)::numeric))::numeric(14,3) AS "valor_inventario_mp",
            (COALESCE("sum"(
                CASE
                    WHEN (("sl"."cantidad_actual" - "sl"."cantidad_comprometida") <= COALESCE("i"."umbral_alerta", (0)::numeric)) THEN 1
                    ELSE 0
                END), (0)::bigint))::integer AS "stock_critico"
           FROM ("public"."stock_lotes_mp" "sl"
             JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
          WHERE (("sl"."deleted_at" IS NULL) AND ("i"."deleted_at" IS NULL))
        ), "pt" AS (
         SELECT (COALESCE("sum"("sp"."cantidad_total"), (0)::numeric))::numeric(14,3) AS "stock_total_pt",
            (COALESCE("sum"(("sp"."cantidad_total" *
                CASE
                    WHEN ("op"."cantidad_real" > (0)::numeric) THEN ("op"."costo_total_insumos" / "op"."cantidad_real")
                    ELSE (0)::numeric
                END)), (0)::numeric))::numeric(14,3) AS "valor_inventario_pt"
           FROM ("public"."stock_pt" "sp"
             LEFT JOIN "public"."ordenes_produccion" "op" ON (("op"."id" = "sp"."orden_id")))
          WHERE ("sp"."deleted_at" IS NULL)
        )
 SELECT "mp"."stock_total_mp",
    "mp"."stock_critico",
    "mp"."valor_inventario_mp",
    "pt"."stock_total_pt",
    "pt"."valor_inventario_pt"
   FROM "mp",
    "pt";


ALTER VIEW "public"."vw_dashboard_stock_resumen" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_dashboard_trazabilidad" AS
 SELECT "te"."id",
    "te"."fecha_evento",
    "te"."tipo",
    "te"."referencia",
    "te"."payload",
    "op"."legacy_uid" AS "orden_legacy_uid",
    "op"."lote" AS "orden_lote",
    "op"."nombre_producto",
    "sl"."legacy_uid" AS "lote_mp_legacy_uid",
    "sl"."lote" AS "lote_mp",
    "sp"."legacy_uid" AS "stock_pt_legacy_uid",
    "sp"."lote" AS "lote_pt",
    "sp"."nombre_silo" AS "silo_destino"
   FROM ((("public"."trazabilidad_eventos" "te"
     LEFT JOIN "public"."ordenes_produccion" "op" ON (("op"."id" = "te"."orden_id")))
     LEFT JOIN "public"."stock_lotes_mp" "sl" ON (("sl"."id" = "te"."stock_lote_mp_id")))
     LEFT JOIN "public"."stock_pt" "sp" ON (("sp"."id" = "te"."stock_pt_id")))
  ORDER BY "te"."fecha_evento" DESC;


ALTER VIEW "public"."vw_dashboard_trazabilidad" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_finanzas_kpis" AS
 WITH "mov_mes" AS (
         SELECT (COALESCE("sum"(
                CASE
                    WHEN (("flujo_caja_movimientos"."tipo" = 'INGRESO'::"text") AND ("flujo_caja_movimientos"."estado" = 'CONFIRMADO'::"text")) THEN "flujo_caja_movimientos"."monto"
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "ingresos_mes",
            (COALESCE("sum"(
                CASE
                    WHEN (("flujo_caja_movimientos"."tipo" = 'EGRESO'::"text") AND ("flujo_caja_movimientos"."estado" = 'CONFIRMADO'::"text")) THEN "flujo_caja_movimientos"."monto"
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "egresos_mes"
           FROM "public"."flujo_caja_movimientos"
          WHERE (("flujo_caja_movimientos"."deleted_at" IS NULL) AND ("date_trunc"('month'::"text", "flujo_caja_movimientos"."fecha") = "date_trunc"('month'::"text", "now"())))
        ), "cuentas" AS (
         SELECT (COALESCE("sum"(
                CASE
                    WHEN (("c"."tipo" = 'FACTURA_COMPRA'::"text") AND ("c"."estado" = ANY (ARRAY['PENDIENTE'::"text", 'VENCIDO'::"text"]))) THEN "c"."saldo"
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "cuentas_por_pagar",
            (COALESCE("sum"(
                CASE
                    WHEN (("c"."tipo" = 'FACTURA_VENTA'::"text") AND ("c"."estado" = ANY (ARRAY['PENDIENTE'::"text", 'VENCIDO'::"text"]))) THEN "c"."saldo"
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "cuentas_por_cobrar"
           FROM "public"."comprobantes" "c"
          WHERE ("c"."deleted_at" IS NULL)
        ), "oper" AS (
         SELECT (COALESCE("sum"(
                CASE
                    WHEN ("o"."estado" = 'FINALIZADO'::"text") THEN "o"."costo_total_insumos"
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "costo_produccion",
            (COALESCE("sum"(
                CASE
                    WHEN ("o"."estado" = 'FINALIZADO'::"text") THEN (COALESCE("o"."merma_manual", (0)::numeric) *
                    CASE
                        WHEN ("o"."cantidad_real" > (0)::numeric) THEN ("o"."costo_total_insumos" / "o"."cantidad_real")
                        ELSE (0)::numeric
                    END)
                    ELSE (0)::numeric
                END), (0)::numeric))::numeric(16,2) AS "perdida_merma"
           FROM "public"."ordenes_produccion" "o"
          WHERE ("o"."deleted_at" IS NULL)
        ), "inv" AS (
         SELECT ((COALESCE(( SELECT "sum"(("stock_lotes_mp"."costo_total" *
                        CASE
                            WHEN ("stock_lotes_mp"."cantidad_inicial" > (0)::numeric) THEN ("stock_lotes_mp"."cantidad_actual" / "stock_lotes_mp"."cantidad_inicial")
                            ELSE (0)::numeric
                        END)) AS "sum"
                   FROM "public"."stock_lotes_mp"
                  WHERE ("stock_lotes_mp"."deleted_at" IS NULL)), (0)::numeric))::numeric(16,2) + (COALESCE(( SELECT "sum"(("sp"."cantidad_total" *
                        CASE
                            WHEN ("op"."cantidad_real" > (0)::numeric) THEN ("op"."costo_total_insumos" / "op"."cantidad_real")
                            ELSE (0)::numeric
                        END)) AS "sum"
                   FROM ("public"."stock_pt" "sp"
                     LEFT JOIN "public"."ordenes_produccion" "op" ON (("op"."id" = "sp"."orden_id")))
                  WHERE ("sp"."deleted_at" IS NULL)), (0)::numeric))::numeric(16,2)) AS "valorizacion_inventario"
        ), "saldo" AS (
         SELECT (COALESCE("sum"("cuentas_bancarias"."saldo_actual"), (0)::numeric))::numeric(16,2) AS "saldo_actual"
           FROM "public"."cuentas_bancarias"
          WHERE ("cuentas_bancarias"."deleted_at" IS NULL)
        )
 SELECT "saldo"."saldo_actual",
    "mov_mes"."ingresos_mes",
    "mov_mes"."egresos_mes",
    (("mov_mes"."ingresos_mes" - "mov_mes"."egresos_mes"))::numeric(16,2) AS "flujo_neto",
    (
        CASE
            WHEN ("mov_mes"."ingresos_mes" > (0)::numeric) THEN ((("mov_mes"."ingresos_mes" - "mov_mes"."egresos_mes") / "mov_mes"."ingresos_mes") * (100)::numeric)
            ELSE (0)::numeric
        END)::numeric(10,4) AS "margen_operativo",
    "oper"."costo_produccion",
    "inv"."valorizacion_inventario",
    "cuentas"."cuentas_por_pagar",
    "cuentas"."cuentas_por_cobrar",
    "oper"."perdida_merma"
   FROM "mov_mes",
    "cuentas",
    "oper",
    "inv",
    "saldo";


ALTER VIEW "public"."vw_finanzas_kpis" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_ingresos_pt_por_producto" AS
 WITH "ingresos_financieros" AS (
         SELECT "f"."stock_pt_id",
            ("sum"("f"."monto"))::numeric(16,2) AS "importe_total",
            "max"("f"."fecha") AS "ultima_fecha"
           FROM ("public"."flujo_caja_movimientos" "f"
             LEFT JOIN "public"."categorias_financieras" "cf" ON (("cf"."id" = "f"."categoria_id")))
          WHERE (("f"."deleted_at" IS NULL) AND ("f"."estado" = 'CONFIRMADO'::"text") AND ("f"."tipo" = 'INGRESO'::"text") AND (("f"."origen_operativo" = 'VENTA'::"text") OR ("cf"."legacy_uid" = 'cat-ventas'::"text")) AND ("f"."stock_pt_id" IS NOT NULL))
          GROUP BY "f"."stock_pt_id"
        ), "salidas" AS (
         SELECT "m"."stock_pt_id",
            COALESCE(NULLIF(TRIM(BOTH FROM "m"."nombre_producto"), ''::"text"), 'Sin producto'::"text") AS "producto",
            "m"."cantidad",
            "m"."valor_total",
            "m"."costo_unitario",
            "m"."cliente_id",
            "m"."created_at",
            "i"."importe_total" AS "importe_financiero",
            "i"."ultima_fecha" AS "fecha_financiera"
           FROM ("public"."stock_pt_movimientos" "m"
             LEFT JOIN "ingresos_financieros" "i" ON (("i"."stock_pt_id" = "m"."stock_pt_id")))
          WHERE ("m"."tipo" = ANY (ARRAY['SALIDA'::"text", 'DESPACHO_PT'::"text"]))
        ), "lotes" AS (
         SELECT "salidas"."stock_pt_id",
            "salidas"."producto",
            ("sum"("salidas"."cantidad"))::numeric(14,3) AS "cantidad_kg",
            (COALESCE("max"("salidas"."importe_financiero"), "sum"(COALESCE("salidas"."valor_total", ("salidas"."cantidad" * COALESCE("salidas"."costo_unitario", (0)::numeric))))))::numeric(16,2) AS "importe_total",
            "max"(GREATEST("salidas"."created_at", COALESCE("salidas"."fecha_financiera", "salidas"."created_at"))) AS "ultima_fecha"
           FROM "salidas"
          GROUP BY "salidas"."stock_pt_id", "salidas"."producto"
        ), "clientes" AS (
         SELECT "salidas"."producto",
            ("count"(DISTINCT "salidas"."cliente_id"))::integer AS "clientes_count"
           FROM "salidas"
          WHERE ("salidas"."cliente_id" IS NOT NULL)
          GROUP BY "salidas"."producto"
        ), "totales" AS (
         SELECT "lotes"."producto",
            ("sum"("lotes"."cantidad_kg"))::numeric(14,3) AS "cantidad_kg",
            ("sum"("lotes"."importe_total"))::numeric(16,2) AS "importe_total",
            "max"("lotes"."ultima_fecha") AS "ultima_fecha"
           FROM "lotes"
          GROUP BY "lotes"."producto"
        )
 SELECT "t"."producto",
    "t"."cantidad_kg",
    "t"."importe_total",
    COALESCE("c"."clientes_count", 0) AS "clientes_count",
    "t"."ultima_fecha"
   FROM ("totales" "t"
     LEFT JOIN "clientes" "c" USING ("producto"))
  ORDER BY "t"."importe_total" DESC, "t"."cantidad_kg" DESC;


ALTER VIEW "public"."vw_ingresos_pt_por_producto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_finanzas_reportes" AS
 WITH "base" AS (
         SELECT ("date_trunc"('month'::"text", "f"."fecha"))::"date" AS "mes",
            "f"."tipo",
            COALESCE("cf"."nombre", 'Sin categoría'::"text") AS "categoria",
            "f"."monto",
            COALESCE("f"."origen_operativo", 'MANUAL'::"text") AS "origen_operativo",
            "cf"."legacy_uid" AS "categoria_legacy_uid"
           FROM ("public"."flujo_caja_movimientos" "f"
             LEFT JOIN "public"."categorias_financieras" "cf" ON (("cf"."id" = "f"."categoria_id")))
          WHERE (("f"."deleted_at" IS NULL) AND ("f"."estado" = 'CONFIRMADO'::"text"))
        ), "rentabilidad" AS (
         SELECT COALESCE("o"."id_formula_legacy", 'SIN_FORMULA'::"text") AS "id_formula",
            "o"."nombre_producto",
            ("sum"(COALESCE("o"."costo_total_insumos", (0)::numeric)))::numeric(16,2) AS "costo_total",
            ("sum"(COALESCE("o"."cantidad_real", (0)::numeric)))::numeric(16,3) AS "kg_total"
           FROM "public"."ordenes_produccion" "o"
          WHERE (("o"."deleted_at" IS NULL) AND ("o"."estado" = 'FINALIZADO'::"text"))
          GROUP BY COALESCE("o"."id_formula_legacy", 'SIN_FORMULA'::"text"), "o"."nombre_producto"
        )
 SELECT "jsonb_build_object"('flujo_caja_mensual', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('mes', "to_char"(("x"."mes")::timestamp with time zone, 'YYYY-MM'::"text"), 'ingresos', "x"."ingresos", 'egresos', "x"."egresos", 'neto', "x"."neto") ORDER BY "x"."mes"), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "base"."mes",
                    "sum"(
                        CASE
                            WHEN ("base"."tipo" = 'INGRESO'::"text") THEN "base"."monto"
                            ELSE (0)::numeric
                        END) AS "ingresos",
                    "sum"(
                        CASE
                            WHEN ("base"."tipo" = 'EGRESO'::"text") THEN "base"."monto"
                            ELSE (0)::numeric
                        END) AS "egresos",
                    "sum"(
                        CASE
                            WHEN ("base"."tipo" = 'INGRESO'::"text") THEN "base"."monto"
                            ELSE (- "base"."monto")
                        END) AS "neto"
                   FROM "base"
                  GROUP BY "base"."mes") "x"), 'gastos_por_categoria', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('categoria', "g"."categoria", 'monto', "g"."total") ORDER BY "g"."total" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "base"."categoria",
                    ("sum"("base"."monto"))::numeric(16,2) AS "total"
                   FROM "base"
                  WHERE ("base"."tipo" = 'EGRESO'::"text")
                  GROUP BY "base"."categoria") "g"), 'ingresos_por_categoria', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('categoria', "i"."categoria", 'monto', "i"."total") ORDER BY "i"."total" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "base"."categoria",
                    ("sum"("base"."monto"))::numeric(16,2) AS "total"
                   FROM "base"
                  WHERE (("base"."tipo" = 'INGRESO'::"text") AND (COALESCE("base"."categoria_legacy_uid", ''::"text") <> 'cat-ventas'::"text"))
                  GROUP BY "base"."categoria") "i"), 'ingresos_pt_por_producto', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('producto', "vw_ingresos_pt_por_producto"."producto", 'cantidad_kg', "vw_ingresos_pt_por_producto"."cantidad_kg", 'importe_total', "vw_ingresos_pt_por_producto"."importe_total", 'clientes_count', "vw_ingresos_pt_por_producto"."clientes_count", 'ultima_fecha', "vw_ingresos_pt_por_producto"."ultima_fecha") ORDER BY "vw_ingresos_pt_por_producto"."importe_total" DESC, "vw_ingresos_pt_por_producto"."cantidad_kg" DESC), '[]'::"jsonb") AS "coalesce"
           FROM "public"."vw_ingresos_pt_por_producto"), 'rentabilidad_por_formula', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('id_formula', "rentabilidad"."id_formula", 'nombre_producto', "rentabilidad"."nombre_producto", 'costo_total', "rentabilidad"."costo_total", 'kg_total', "rentabilidad"."kg_total", 'costo_promedio_kg',
                CASE
                    WHEN ("rentabilidad"."kg_total" > (0)::numeric) THEN ("rentabilidad"."costo_total" / "rentabilidad"."kg_total")
                    ELSE (0)::numeric
                END) ORDER BY "rentabilidad"."costo_total" DESC), '[]'::"jsonb") AS "coalesce"
           FROM "rentabilidad"), 'costo_operativo_mensual', ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('mes', "to_char"(("c"."mes")::timestamp with time zone, 'YYYY-MM'::"text"), 'monto', "c"."total") ORDER BY "c"."mes"), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "base"."mes",
                    ("sum"("base"."monto"))::numeric(16,2) AS "total"
                   FROM "base"
                  WHERE ("base"."tipo" = 'EGRESO'::"text")
                  GROUP BY "base"."mes") "c")) AS "payload";


ALTER VIEW "public"."vw_finanzas_reportes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_movimientos_mp_auditoria" AS
 SELECT "sm"."created_at" AS "fecha",
    "sm"."tipo" AS "tipo_movimiento",
    "i"."nombre" AS "insumo",
    "sl"."lote" AS "lote_mp",
    "sm"."cantidad",
    "i"."unidad_medida" AS "unidad",
    COALESCE("op"."legacy_uid", ("sm"."metadata" ->> 'orden_legacy_uid'::"text")) AS "op_relacionada",
    COALESCE("op"."lote", ("sm"."metadata" ->> 'orden_legacy_uid'::"text")) AS "op_lote",
    "sm"."origen",
    "sm"."observaciones"
   FROM ((("public"."stock_movimientos" "sm"
     JOIN "public"."stock_lotes_mp" "sl" ON (("sl"."id" = "sm"."lote_id")))
     JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
     LEFT JOIN "public"."ordenes_produccion" "op" ON (("op"."id" = (NULLIF(("sm"."metadata" ->> 'orden_id'::"text"), ''::"text"))::"uuid")))
  WHERE ("sl"."deleted_at" IS NULL);


ALTER VIEW "public"."vw_movimientos_mp_auditoria" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_trazabilidad_por_op" AS
 SELECT "op"."id" AS "op_id",
    "op"."legacy_uid" AS "orden_legacy_uid",
    "op"."lote" AS "numero_orden",
    "op"."nombre_producto" AS "producto",
    "op"."id_formula_legacy" AS "formula",
    "op"."version_formula",
    "op"."estado" AS "estado_op",
    "op"."cantidad_objetivo",
    "op"."cantidad_real",
    "op"."merma_manual",
    "op"."destino_silo",
    "op"."usuario_responsable",
    "op"."fecha_creacion",
    "op"."updated_at" AS "actualizada_en",
    COALESCE("mp"."mp_planificada", '[]'::"jsonb") AS "mp_planificada",
    COALESCE("to_jsonb"("mp"."lotes_mp_usados"), '[]'::"jsonb") AS "lotes_mp_usados",
    COALESCE("mp_mov"."mp_movimientos", '[]'::"jsonb") AS "mp_movimientos",
    COALESCE("ptg"."pt_generado", '[]'::"jsonb") AS "pt_generado",
    COALESCE("pts"."salidas_pt", '[]'::"jsonb") AS "salidas_pt",
    COALESCE("ev"."eventos", '[]'::"jsonb") AS "eventos"
   FROM ((((("public"."ordenes_produccion" "op"
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('insumo', "i"."nombre", 'lote_mp', COALESCE("sl"."legacy_uid", "sl"."lote"), 'cantidad', "ocl"."cantidad_usada", 'unidad', "ocl"."tipo_unidad", 'costo_unitario', "ocl"."costo_unitario", 'costo_total', "ocl"."costo_total") ORDER BY "ocl"."id") FILTER (WHERE ("ocl"."id" IS NOT NULL)) AS "mp_planificada",
            "array_agg"(DISTINCT COALESCE("sl"."legacy_uid", "sl"."lote")) FILTER (WHERE ("sl"."id" IS NOT NULL)) AS "lotes_mp_usados"
           FROM (("public"."orden_consumo_lotes" "ocl"
             LEFT JOIN "public"."stock_lotes_mp" "sl" ON ((("sl"."id" = "ocl"."lote_id") AND ("sl"."deleted_at" IS NULL))))
             LEFT JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
          WHERE ("ocl"."orden_id" = "op"."id")) "mp" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('tipo', "sm"."tipo", 'insumo', "i"."nombre", 'lote_mp', "sl"."lote", 'cantidad', "sm"."cantidad", 'unidad', "i"."unidad_medida", 'origen', "sm"."origen", 'observaciones', "sm"."observaciones", 'fecha', "sm"."created_at") ORDER BY "sm"."created_at") FILTER (WHERE ("sm"."id" IS NOT NULL)) AS "mp_movimientos"
           FROM (("public"."stock_movimientos" "sm"
             JOIN "public"."stock_lotes_mp" "sl" ON ((("sl"."id" = "sm"."lote_id") AND ("sl"."deleted_at" IS NULL))))
             JOIN "public"."insumos" "i" ON (("i"."id" = "sl"."insumo_id")))
          WHERE ((NULLIF(("sm"."metadata" ->> 'orden_id'::"text"), ''::"text"))::"uuid" = "op"."id")) "mp_mov" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('stock_pt_id', "pt"."id", 'lote_pt', "pt"."lote", 'cantidad', "pt"."cantidad_total", 'unidad', "pt"."unidad_medida", 'silo', "pt"."nombre_silo", 'fecha', "pt"."fecha_ingreso") ORDER BY "pt"."fecha_ingreso") FILTER (WHERE ("pt"."id" IS NOT NULL)) AS "pt_generado"
           FROM "public"."stock_pt" "pt"
          WHERE (("pt"."orden_id" = "op"."id") AND ("pt"."deleted_at" IS NULL))) "ptg" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('tipo', "ptm"."tipo", 'cantidad', "ptm"."cantidad", 'motivo', "ptm"."motivo", 'referencia', "ptm"."referencia", 'fecha', "ptm"."created_at", 'cliente_id', "ptm"."cliente_id", 'cliente_nombre', "c"."nombre", 'stock_pt_id', "ptm"."stock_pt_id", 'lote_pt', "ptm"."lote") ORDER BY "ptm"."created_at") FILTER (WHERE ("ptm"."id" IS NOT NULL)) AS "salidas_pt"
           FROM (("public"."stock_pt" "pt"
             LEFT JOIN "public"."stock_pt_movimientos" "ptm" ON ((("ptm"."stock_pt_id" = "pt"."id") AND ("ptm"."tipo" = 'SALIDA'::"text"))))
             LEFT JOIN "public"."clientes" "c" ON (("c"."id" = "ptm"."cliente_id")))
          WHERE (("pt"."orden_id" = "op"."id") AND ("pt"."deleted_at" IS NULL))) "pts" ON (true))
     LEFT JOIN LATERAL ( SELECT "jsonb_agg"("jsonb_build_object"('tipo', "te"."tipo", 'referencia', "te"."referencia", 'fecha', "te"."fecha_evento", 'payload', "te"."payload") ORDER BY "te"."fecha_evento") FILTER (WHERE ("te"."id" IS NOT NULL)) AS "eventos"
           FROM "public"."trazabilidad_eventos" "te"
          WHERE ("te"."orden_id" = "op"."id")) "ev" ON (true));


ALTER VIEW "public"."vw_trazabilidad_por_op" OWNER TO "postgres";


ALTER TABLE ONLY "public"."alerta_configuraciones"
    ADD CONSTRAINT "alerta_configuraciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas_estado"
    ADD CONSTRAINT "alertas_estado_alerta_key_key" UNIQUE ("alerta_key");



ALTER TABLE ONLY "public"."alertas_estado"
    ADD CONSTRAINT "alertas_estado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_acciones"
    ADD CONSTRAINT "auditoria_acciones_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."auditoria_acciones"
    ADD CONSTRAINT "auditoria_acciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorias_financieras"
    ADD CONSTRAINT "categorias_financieras_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."categorias_financieras"
    ADD CONSTRAINT "categorias_financieras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."centros_costo"
    ADD CONSTRAINT "centros_costo_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."centros_costo"
    ADD CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion_empaques"
    ADD CONSTRAINT "configuracion_empaques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_bancarias"
    ADD CONSTRAINT "cuentas_bancarias_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."cuentas_bancarias"
    ADD CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formas_pago"
    ADD CONSTRAINT "formas_pago_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."formas_pago"
    ADD CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formula_ingredientes"
    ADD CONSTRAINT "formula_ingredientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formulas"
    ADD CONSTRAINT "formulas_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."formulas"
    ADD CONSTRAINT "formulas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_contable_importado"
    ADD CONSTRAINT "historico_contable_importado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insumos"
    ADD CONSTRAINT "insumos_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."insumos"
    ADD CONSTRAINT "insumos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orden_consumo_lotes"
    ADD CONSTRAINT "orden_consumo_lotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_expedicion"
    ADD CONSTRAINT "ordenes_expedicion_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."ordenes_expedicion"
    ADD CONSTRAINT "ordenes_expedicion_numero_expedicion_key" UNIQUE ("numero_expedicion");



ALTER TABLE ONLY "public"."ordenes_expedicion"
    ADD CONSTRAINT "ordenes_expedicion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ordenes_produccion"
    ADD CONSTRAINT "ordenes_produccion_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."ordenes_produccion"
    ADD CONSTRAINT "ordenes_produccion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_cuentas"
    ADD CONSTRAINT "plan_cuentas_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."plan_cuentas"
    ADD CONSTRAINT "plan_cuentas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presupuestos_mensuales"
    ADD CONSTRAINT "presupuestos_mensuales_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."presupuestos_mensuales"
    ADD CONSTRAINT "presupuestos_mensuales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."producto_empaques"
    ADD CONSTRAINT "producto_empaques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."silos"
    ADD CONSTRAINT "silos_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."silos"
    ADD CONSTRAINT "silos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_lotes_mp"
    ADD CONSTRAINT "stock_lotes_mp_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."stock_lotes_mp"
    ADD CONSTRAINT "stock_lotes_mp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movimientos"
    ADD CONSTRAINT "stock_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_pt"
    ADD CONSTRAINT "stock_pt_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."stock_pt_movimientos"
    ADD CONSTRAINT "stock_pt_movimientos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_pt"
    ADD CONSTRAINT "stock_pt_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tesoreria_cheques"
    ADD CONSTRAINT "tesoreria_cheques_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."tesoreria_cheques"
    ADD CONSTRAINT "tesoreria_cheques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_legacy_uid_key" UNIQUE ("legacy_uid");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "configuracion_empaques_unique_tipo_capacidad_activa" ON "public"."configuracion_empaques" USING "btree" ("tipo_empaque", "capacidad_kg") WHERE ("esta_activo" = true);



CREATE UNIQUE INDEX "historico_contable_importado_content_hash_uk" ON "public"."historico_contable_importado" USING "btree" ("content_hash");



CREATE INDEX "historico_contable_importado_fecha_idx" ON "public"."historico_contable_importado" USING "btree" ("fecha" DESC);



CREATE UNIQUE INDEX "historico_contable_importado_legacy_uid_uk" ON "public"."historico_contable_importado" USING "btree" ("legacy_uid");



CREATE INDEX "idx_alerta_configuraciones_activa" ON "public"."alerta_configuraciones" USING "btree" ("esta_activa");



CREATE INDEX "idx_alerta_configuraciones_modulo" ON "public"."alerta_configuraciones" USING "btree" ("modulo");



CREATE UNIQUE INDEX "idx_alerta_configuraciones_unica" ON "public"."alerta_configuraciones" USING "btree" ("modulo", "entidad_tipo", COALESCE(("entidad_id")::"text", ''::"text"), "nombre");



CREATE INDEX "idx_alertas_estado_actualizacion" ON "public"."alertas_estado" USING "btree" ("ultima_actualizacion" DESC);



CREATE INDEX "idx_alertas_estado_estado" ON "public"."alertas_estado" USING "btree" ("estado");



CREATE INDEX "idx_auditoria_acciones_created_at" ON "public"."auditoria_acciones" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_auditoria_acciones_modulo_accion" ON "public"."auditoria_acciones" USING "btree" ("modulo", "accion");



CREATE INDEX "idx_auditoria_acciones_usuario_login" ON "public"."auditoria_acciones" USING "btree" ("usuario_login");



CREATE INDEX "idx_categorias_financieras_tipo" ON "public"."categorias_financieras" USING "btree" ("tipo_movimiento");



CREATE INDEX "idx_clientes_deleted_at" ON "public"."clientes" USING "btree" ("deleted_at");



CREATE INDEX "idx_comprobantes_cliente_id" ON "public"."comprobantes" USING "btree" ("cliente_id");



CREATE INDEX "idx_comprobantes_estado" ON "public"."comprobantes" USING "btree" ("estado");



CREATE INDEX "idx_flujo_caja_categoria" ON "public"."flujo_caja_movimientos" USING "btree" ("categoria_id");



CREATE INDEX "idx_flujo_caja_fecha" ON "public"."flujo_caja_movimientos" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_flujo_caja_orden" ON "public"."flujo_caja_movimientos" USING "btree" ("orden_produccion_id");



CREATE INDEX "idx_flujo_caja_origen_costos" ON "public"."flujo_caja_movimientos" USING "btree" ("origen_modulo", "origen_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_flujo_caja_tipo_estado" ON "public"."flujo_caja_movimientos" USING "btree" ("tipo", "estado");



CREATE INDEX "idx_formula_ingredientes_formula_id" ON "public"."formula_ingredientes" USING "btree" ("formula_id");



CREATE INDEX "idx_formulas_deleted_at" ON "public"."formulas" USING "btree" ("deleted_at");



CREATE INDEX "idx_insumos_deleted_at" ON "public"."insumos" USING "btree" ("deleted_at");



CREATE INDEX "idx_orden_consumo_lotes_orden_id" ON "public"."orden_consumo_lotes" USING "btree" ("orden_id");



CREATE INDEX "idx_ordenes_expedicion_cliente_id" ON "public"."ordenes_expedicion" USING "btree" ("cliente_id");



CREATE INDEX "idx_ordenes_expedicion_created_at" ON "public"."ordenes_expedicion" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ordenes_expedicion_estado" ON "public"."ordenes_expedicion" USING "btree" ("estado");



CREATE INDEX "idx_ordenes_expedicion_stock_pt_id" ON "public"."ordenes_expedicion" USING "btree" ("stock_pt_id");



CREATE INDEX "idx_ordenes_produccion_deleted_at" ON "public"."ordenes_produccion" USING "btree" ("deleted_at");



CREATE INDEX "idx_ordenes_produccion_formula_id" ON "public"."ordenes_produccion" USING "btree" ("formula_id");



CREATE INDEX "idx_presupuestos_mensuales_rubro_periodo" ON "public"."presupuestos_mensuales" USING "btree" ("rubro_id", "anio", "mes");



CREATE UNIQUE INDEX "idx_presupuestos_mensuales_rubro_periodo_unique" ON "public"."presupuestos_mensuales" USING "btree" ("rubro_id", "anio", "mes") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_presupuestos_periodo" ON "public"."presupuestos_mensuales" USING "btree" ("anio", "mes");



CREATE INDEX "idx_proveedores_deleted_at" ON "public"."proveedores" USING "btree" ("deleted_at");



CREATE INDEX "idx_silos_deleted_at" ON "public"."silos" USING "btree" ("deleted_at");



CREATE INDEX "idx_stock_lotes_mp_deleted_at" ON "public"."stock_lotes_mp" USING "btree" ("deleted_at");



CREATE INDEX "idx_stock_lotes_mp_insumo_id" ON "public"."stock_lotes_mp" USING "btree" ("insumo_id");



CREATE INDEX "idx_stock_lotes_mp_lote" ON "public"."stock_lotes_mp" USING "btree" ("lote");



CREATE INDEX "idx_stock_lotes_mp_proveedor_id" ON "public"."stock_lotes_mp" USING "btree" ("proveedor_id");



CREATE INDEX "idx_stock_movimientos_lote_id_created_at" ON "public"."stock_movimientos" USING "btree" ("lote_id", "created_at" DESC);



CREATE INDEX "idx_stock_pt_deleted_at" ON "public"."stock_pt" USING "btree" ("deleted_at");



CREATE INDEX "idx_stock_pt_movimientos_cliente_id" ON "public"."stock_pt_movimientos" USING "btree" ("cliente_id");



CREATE INDEX "idx_stock_pt_movimientos_created_at" ON "public"."stock_pt_movimientos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stock_pt_movimientos_producto_id" ON "public"."stock_pt_movimientos" USING "btree" ("producto_id");



CREATE INDEX "idx_stock_pt_movimientos_stock_pt_id" ON "public"."stock_pt_movimientos" USING "btree" ("stock_pt_id");



CREATE INDEX "idx_stock_pt_orden_id" ON "public"."stock_pt" USING "btree" ("orden_id");



CREATE INDEX "idx_tesoreria_cheques_cliente_id" ON "public"."tesoreria_cheques" USING "btree" ("cliente_id");



CREATE INDEX "idx_tesoreria_cheques_tipo" ON "public"."tesoreria_cheques" USING "btree" ("tipo");



CREATE INDEX "idx_tesoreria_cheques_vencimiento" ON "public"."tesoreria_cheques" USING "btree" ("fecha_vencimiento");



CREATE INDEX "idx_trazabilidad_eventos_orden_id_fecha" ON "public"."trazabilidad_eventos" USING "btree" ("orden_id", "fecha_evento" DESC);



CREATE INDEX "idx_usuarios_deleted_at" ON "public"."usuarios" USING "btree" ("deleted_at");



CREATE INDEX "idx_usuarios_role_id" ON "public"."usuarios" USING "btree" ("role_id");



CREATE UNIQUE INDEX "producto_empaques_unique_producto_tipo_capacidad" ON "public"."producto_empaques" USING "btree" ("producto_id", "tipo_empaque", "capacidad_kg") WHERE ("activo" = true);



CREATE UNIQUE INDEX "ux_flujo_caja_costos_origen_activo" ON "public"."flujo_caja_movimientos" USING "btree" ("origen_modulo", "origen_id") WHERE (("deleted_at" IS NULL) AND ("origen_modulo" = 'costos'::"text") AND ("origen_id" IS NOT NULL));



CREATE OR REPLACE TRIGGER "trg_alerta_configuraciones_updated_at" BEFORE UPDATE ON "public"."alerta_configuraciones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_alertas_estado_updated_at" BEFORE UPDATE ON "public"."alertas_estado" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_apply_stock_movement" BEFORE INSERT ON "public"."stock_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."apply_stock_movement"();



CREATE OR REPLACE TRIGGER "trg_categorias_financieras_updated_at" BEFORE UPDATE ON "public"."categorias_financieras" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_centros_costo_updated_at" BEFORE UPDATE ON "public"."centros_costo" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comprobantes_updated_at" BEFORE UPDATE ON "public"."comprobantes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_configuracion_empaques_updated_at" BEFORE UPDATE ON "public"."configuracion_empaques" FOR EACH ROW EXECUTE FUNCTION "public"."configuracion_empaques_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cuentas_bancarias_updated_at" BEFORE UPDATE ON "public"."cuentas_bancarias" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flujo_caja_movimientos_updated_at" BEFORE UPDATE ON "public"."flujo_caja_movimientos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_formas_pago_updated_at" BEFORE UPDATE ON "public"."formas_pago" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_formula_ingredientes_updated_at" BEFORE UPDATE ON "public"."formula_ingredientes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_formulas_updated_at" BEFORE UPDATE ON "public"."formulas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_insumos_updated_at" BEFORE UPDATE ON "public"."insumos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orden_consumo_lotes_updated_at" BEFORE UPDATE ON "public"."orden_consumo_lotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ordenes_produccion_updated_at" BEFORE UPDATE ON "public"."ordenes_produccion" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plan_cuentas_updated_at" BEFORE UPDATE ON "public"."plan_cuentas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_presupuestos_mensuales_updated_at" BEFORE UPDATE ON "public"."presupuestos_mensuales" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_proveedores_updated_at" BEFORE UPDATE ON "public"."proveedores" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_silos_updated_at" BEFORE UPDATE ON "public"."silos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_stock_lotes_mp_updated_at" BEFORE UPDATE ON "public"."stock_lotes_mp" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_stock_pt_updated_at" BEFORE UPDATE ON "public"."stock_pt" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tesoreria_cheques_updated_at" BEFORE UPDATE ON "public"."tesoreria_cheques" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_usuarios_updated_at" BEFORE UPDATE ON "public"."usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."auditoria_acciones"
    ADD CONSTRAINT "auditoria_acciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."categorias_financieras"
    ADD CONSTRAINT "categorias_financieras_plan_cuenta_id_fkey" FOREIGN KEY ("plan_cuenta_id") REFERENCES "public"."plan_cuentas"("id");



ALTER TABLE ONLY "public"."comprobantes"
    ADD CONSTRAINT "comprobantes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financieras"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "public"."comprobantes"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_forma_pago_id_fkey" FOREIGN KEY ("forma_pago_id") REFERENCES "public"."formas_pago"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_orden_produccion_id_fkey" FOREIGN KEY ("orden_produccion_id") REFERENCES "public"."ordenes_produccion"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_stock_lote_mp_id_fkey" FOREIGN KEY ("stock_lote_mp_id") REFERENCES "public"."stock_lotes_mp"("id");



ALTER TABLE ONLY "public"."flujo_caja_movimientos"
    ADD CONSTRAINT "flujo_caja_movimientos_stock_pt_id_fkey" FOREIGN KEY ("stock_pt_id") REFERENCES "public"."stock_pt"("id");



ALTER TABLE ONLY "public"."formula_ingredientes"
    ADD CONSTRAINT "formula_ingredientes_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."formula_ingredientes"
    ADD CONSTRAINT "formula_ingredientes_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."formulas"
    ADD CONSTRAINT "formulas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."orden_consumo_lotes"
    ADD CONSTRAINT "orden_consumo_lotes_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."orden_consumo_lotes"
    ADD CONSTRAINT "orden_consumo_lotes_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."stock_lotes_mp"("id");



ALTER TABLE ONLY "public"."orden_consumo_lotes"
    ADD CONSTRAINT "orden_consumo_lotes_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ordenes_expedicion"
    ADD CONSTRAINT "ordenes_expedicion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ordenes_expedicion"
    ADD CONSTRAINT "ordenes_expedicion_stock_pt_id_fkey" FOREIGN KEY ("stock_pt_id") REFERENCES "public"."stock_pt"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ordenes_produccion"
    ADD CONSTRAINT "ordenes_produccion_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "public"."formulas"("id");



ALTER TABLE ONLY "public"."ordenes_produccion"
    ADD CONSTRAINT "ordenes_produccion_silo_id_fkey" FOREIGN KEY ("silo_id") REFERENCES "public"."silos"("id");



ALTER TABLE ONLY "public"."ordenes_produccion"
    ADD CONSTRAINT "ordenes_produccion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."presupuestos_mensuales"
    ADD CONSTRAINT "presupuestos_mensuales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_financieras"("id");



ALTER TABLE ONLY "public"."presupuestos_mensuales"
    ADD CONSTRAINT "presupuestos_mensuales_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "public"."centros_costo"("id");



ALTER TABLE ONLY "public"."presupuestos_mensuales"
    ADD CONSTRAINT "presupuestos_mensuales_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."categorias_financieras"("id");



ALTER TABLE ONLY "public"."stock_lotes_mp"
    ADD CONSTRAINT "stock_lotes_mp_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."stock_lotes_mp"
    ADD CONSTRAINT "stock_lotes_mp_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id");



ALTER TABLE ONLY "public"."stock_lotes_mp"
    ADD CONSTRAINT "stock_lotes_mp_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id");



ALTER TABLE ONLY "public"."stock_movimientos"
    ADD CONSTRAINT "stock_movimientos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."stock_lotes_mp"("id");



ALTER TABLE ONLY "public"."stock_movimientos"
    ADD CONSTRAINT "stock_movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."stock_pt_movimientos"
    ADD CONSTRAINT "stock_pt_movimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_pt_movimientos"
    ADD CONSTRAINT "stock_pt_movimientos_stock_pt_id_fkey" FOREIGN KEY ("stock_pt_id") REFERENCES "public"."stock_pt"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_pt"
    ADD CONSTRAINT "stock_pt_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id");



ALTER TABLE ONLY "public"."stock_pt"
    ADD CONSTRAINT "stock_pt_silo_id_fkey" FOREIGN KEY ("silo_id") REFERENCES "public"."silos"("id");



ALTER TABLE ONLY "public"."tesoreria_cheques"
    ADD CONSTRAINT "tesoreria_cheques_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id");



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_stock_lote_mp_id_fkey" FOREIGN KEY ("stock_lote_mp_id") REFERENCES "public"."stock_lotes_mp"("id");



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_stock_pt_id_fkey" FOREIGN KEY ("stock_pt_id") REFERENCES "public"."stock_pt"("id");



ALTER TABLE ONLY "public"."trazabilidad_eventos"
    ADD CONSTRAINT "trazabilidad_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE "public"."configuracion_empaques" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_empaques_delete_authenticated" ON "public"."configuracion_empaques" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "configuracion_empaques_insert_authenticated" ON "public"."configuracion_empaques" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "configuracion_empaques_select_authenticated" ON "public"."configuracion_empaques" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "configuracion_empaques_update_authenticated" ON "public"."configuracion_empaques" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tesoreria_cheques" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tesoreria_cheques_delete_authenticated" ON "public"."tesoreria_cheques" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "tesoreria_cheques_delete_public" ON "public"."tesoreria_cheques" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "tesoreria_cheques_insert_authenticated" ON "public"."tesoreria_cheques" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "tesoreria_cheques_insert_public" ON "public"."tesoreria_cheques" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "tesoreria_cheques_select_authenticated" ON "public"."tesoreria_cheques" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "tesoreria_cheques_select_public" ON "public"."tesoreria_cheques" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "tesoreria_cheques_update_authenticated" ON "public"."tesoreria_cheques" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "tesoreria_cheques_update_public" ON "public"."tesoreria_cheques" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON TABLE "public"."ordenes_expedicion" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_expedicion" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_expedicion" TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_orden_expedicion"("p_orden_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_motivo" "text", "p_referencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_orden_expedicion"("p_orden_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_motivo" "text", "p_referencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_orden_expedicion"("p_orden_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_motivo" "text", "p_referencia" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."actualizar_orden_produccion_con_reserva"("p_orden_id" "uuid", "p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_orden_produccion_con_reserva"("p_orden_id" "uuid", "p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_orden_produccion_con_reserva"("p_orden_id" "uuid", "p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."anular_orden_produccion_con_liberacion"("p_orden_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."anular_orden_produccion_con_liberacion"("p_orden_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anular_orden_produccion_con_liberacion"("p_orden_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_stock_movement"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_stock_movement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_stock_movement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_estado_stock_pt"("p_saldo" numeric, "p_inicial" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_estado_stock_pt"("p_saldo" numeric, "p_inicial" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_estado_stock_pt"("p_saldo" numeric, "p_inicial" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancelar_orden_expedicion"("p_orden_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancelar_orden_expedicion"("p_orden_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancelar_orden_expedicion"("p_orden_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."configuracion_empaques_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."configuracion_empaques_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."configuracion_empaques_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crear_orden_produccion_con_reserva"("p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_estado" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."crear_orden_produccion_con_reserva"("p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_estado" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crear_orden_produccion_con_reserva"("p_legacy_uid" "text", "p_lote" "text", "p_formula_id" "uuid", "p_id_formula_legacy" "text", "p_nombre_producto" "text", "p_version_formula" integer, "p_cantidad_objetivo" numeric, "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_silo_id" "uuid", "p_id_silo_legacy" "text", "p_destino_silo" "text", "p_estado" "text", "p_fecha_creacion" timestamp with time zone, "p_usuario_responsable" "text", "p_usuario_id" "uuid", "p_costo_total_insumos" numeric, "p_detalle" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."despachar_orden_expedicion"("p_orden_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."despachar_orden_expedicion"("p_orden_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."despachar_orden_expedicion"("p_orden_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."finalizar_orden_produccion"("p_orden_id" "uuid", "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_destino_silo" "text", "p_lote_salida" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finalizar_orden_produccion"("p_orden_id" "uuid", "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_destino_silo" "text", "p_lote_salida" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalizar_orden_produccion"("p_orden_id" "uuid", "p_cantidad_real" numeric, "p_merma_manual" numeric, "p_destino_silo" "text", "p_lote_salida" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generar_numero_orden_produccion"() TO "anon";
GRANT ALL ON FUNCTION "public"."generar_numero_orden_produccion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generar_numero_orden_produccion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."liberar_reserva_orden_produccion"("p_orden_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."liberar_reserva_orden_produccion"("p_orden_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."liberar_reserva_orden_produccion"("p_orden_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_orden_expedicion"("p_stock_pt_id" "uuid", "p_cliente_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_modo_calculo" "text", "p_empaque_id" "uuid", "p_tipo_empaque" "text", "p_capacidad_empaque_kg" numeric, "p_cantidad_empaques" numeric, "p_sobrante_kg" numeric, "p_motivo" "text", "p_referencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_orden_expedicion"("p_stock_pt_id" "uuid", "p_cliente_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_modo_calculo" "text", "p_empaque_id" "uuid", "p_tipo_empaque" "text", "p_capacidad_empaque_kg" numeric, "p_cantidad_empaques" numeric, "p_sobrante_kg" numeric, "p_motivo" "text", "p_referencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_orden_expedicion"("p_stock_pt_id" "uuid", "p_cliente_id" "uuid", "p_presentacion" "text", "p_cantidad" numeric, "p_cantidad_original" numeric, "p_unidad_cantidad" "text", "p_modo_calculo" "text", "p_empaque_id" "uuid", "p_tipo_empaque" "text", "p_capacidad_empaque_kg" numeric, "p_cantidad_empaques" numeric, "p_sobrante_kg" numeric, "p_motivo" "text", "p_referencia" "text") TO "service_role";



GRANT ALL ON TABLE "public"."stock_pt" TO "anon";
GRANT ALL ON TABLE "public"."stock_pt" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_pt" TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text", "p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text", "p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_salida_stock_pt"("p_stock_pt_id" "uuid", "p_cantidad" numeric, "p_motivo" "text", "p_referencia" "text", "p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."alerta_configuraciones" TO "anon";
GRANT ALL ON TABLE "public"."alerta_configuraciones" TO "authenticated";
GRANT ALL ON TABLE "public"."alerta_configuraciones" TO "service_role";



GRANT ALL ON TABLE "public"."alertas_estado" TO "anon";
GRANT ALL ON TABLE "public"."alertas_estado" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas_estado" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_acciones" TO "anon";
GRANT ALL ON TABLE "public"."auditoria_acciones" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria_acciones" TO "service_role";



GRANT ALL ON TABLE "public"."categorias_financieras" TO "anon";
GRANT ALL ON TABLE "public"."categorias_financieras" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_financieras" TO "service_role";



GRANT ALL ON TABLE "public"."centros_costo" TO "anon";
GRANT ALL ON TABLE "public"."centros_costo" TO "authenticated";
GRANT ALL ON TABLE "public"."centros_costo" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."comprobantes" TO "anon";
GRANT ALL ON TABLE "public"."comprobantes" TO "authenticated";
GRANT ALL ON TABLE "public"."comprobantes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comprobantes_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comprobantes_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comprobantes_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion_empaques" TO "anon";
GRANT ALL ON TABLE "public"."configuracion_empaques" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion_empaques" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_bancarias" TO "service_role";



GRANT ALL ON TABLE "public"."flujo_caja_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."flujo_caja_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."flujo_caja_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."formas_pago" TO "anon";
GRANT ALL ON TABLE "public"."formas_pago" TO "authenticated";
GRANT ALL ON TABLE "public"."formas_pago" TO "service_role";



GRANT ALL ON TABLE "public"."formula_ingredientes" TO "anon";
GRANT ALL ON TABLE "public"."formula_ingredientes" TO "authenticated";
GRANT ALL ON TABLE "public"."formula_ingredientes" TO "service_role";



GRANT ALL ON TABLE "public"."formulas" TO "anon";
GRANT ALL ON TABLE "public"."formulas" TO "authenticated";
GRANT ALL ON TABLE "public"."formulas" TO "service_role";



GRANT ALL ON TABLE "public"."insumos" TO "anon";
GRANT ALL ON TABLE "public"."insumos" TO "authenticated";
GRANT ALL ON TABLE "public"."insumos" TO "service_role";



GRANT ALL ON TABLE "public"."proveedores" TO "anon";
GRANT ALL ON TABLE "public"."proveedores" TO "authenticated";
GRANT ALL ON TABLE "public"."proveedores" TO "service_role";



GRANT ALL ON TABLE "public"."stock_lotes_mp" TO "anon";
GRANT ALL ON TABLE "public"."stock_lotes_mp" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_lotes_mp" TO "service_role";



GRANT ALL ON TABLE "public"."historial_compras_mp" TO "anon";
GRANT ALL ON TABLE "public"."historial_compras_mp" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_compras_mp" TO "service_role";



GRANT ALL ON TABLE "public"."historico_contable_importado" TO "anon";
GRANT ALL ON TABLE "public"."historico_contable_importado" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_contable_importado" TO "service_role";



GRANT ALL ON TABLE "public"."orden_consumo_lotes" TO "anon";
GRANT ALL ON TABLE "public"."orden_consumo_lotes" TO "authenticated";
GRANT ALL ON TABLE "public"."orden_consumo_lotes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ordenes_expedicion_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ordenes_expedicion_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ordenes_expedicion_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ordenes_produccion" TO "anon";
GRANT ALL ON TABLE "public"."ordenes_produccion" TO "authenticated";
GRANT ALL ON TABLE "public"."ordenes_produccion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ordenes_produccion_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ordenes_produccion_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ordenes_produccion_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plan_cuentas" TO "anon";
GRANT ALL ON TABLE "public"."plan_cuentas" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_cuentas" TO "service_role";



GRANT ALL ON TABLE "public"."presupuestos_mensuales" TO "anon";
GRANT ALL ON TABLE "public"."presupuestos_mensuales" TO "authenticated";
GRANT ALL ON TABLE "public"."presupuestos_mensuales" TO "service_role";



GRANT ALL ON TABLE "public"."producto_empaques" TO "anon";
GRANT ALL ON TABLE "public"."producto_empaques" TO "authenticated";
GRANT ALL ON TABLE "public"."producto_empaques" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."silos" TO "anon";
GRANT ALL ON TABLE "public"."silos" TO "authenticated";
GRANT ALL ON TABLE "public"."silos" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."stock_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."stock_mp_resumen" TO "anon";
GRANT ALL ON TABLE "public"."stock_mp_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_mp_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."stock_pt_movimientos" TO "anon";
GRANT ALL ON TABLE "public"."stock_pt_movimientos" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_pt_movimientos" TO "service_role";



GRANT ALL ON TABLE "public"."stock_pt_resumen" TO "anon";
GRANT ALL ON TABLE "public"."stock_pt_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_pt_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."tesoreria_cheques" TO "anon";
GRANT ALL ON TABLE "public"."tesoreria_cheques" TO "authenticated";
GRANT ALL ON TABLE "public"."tesoreria_cheques" TO "service_role";



GRANT ALL ON TABLE "public"."trazabilidad_eventos" TO "anon";
GRANT ALL ON TABLE "public"."trazabilidad_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."trazabilidad_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."ultimo_precio_pagado_insumo" TO "anon";
GRANT ALL ON TABLE "public"."ultimo_precio_pagado_insumo" TO "authenticated";
GRANT ALL ON TABLE "public"."ultimo_precio_pagado_insumo" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."vw_costos_formula_vs_real" TO "anon";
GRANT ALL ON TABLE "public"."vw_costos_formula_vs_real" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_costos_formula_vs_real" TO "service_role";



GRANT ALL ON TABLE "public"."vw_dashboard_alertas_operativas" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_alertas_operativas" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_alertas_operativas" TO "service_role";



GRANT ALL ON TABLE "public"."vw_dashboard_costos_resumen" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_costos_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_costos_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."vw_dashboard_produccion_resumen" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_produccion_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_produccion_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."vw_dashboard_stock_resumen" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_stock_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_stock_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."vw_dashboard_trazabilidad" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_trazabilidad" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_trazabilidad" TO "service_role";



GRANT ALL ON TABLE "public"."vw_finanzas_kpis" TO "anon";
GRANT ALL ON TABLE "public"."vw_finanzas_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_finanzas_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."vw_ingresos_pt_por_producto" TO "anon";
GRANT ALL ON TABLE "public"."vw_ingresos_pt_por_producto" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_ingresos_pt_por_producto" TO "service_role";



GRANT ALL ON TABLE "public"."vw_finanzas_reportes" TO "anon";
GRANT ALL ON TABLE "public"."vw_finanzas_reportes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_finanzas_reportes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_movimientos_mp_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."vw_movimientos_mp_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_movimientos_mp_auditoria" TO "service_role";



GRANT ALL ON TABLE "public"."vw_trazabilidad_por_op" TO "anon";
GRANT ALL ON TABLE "public"."vw_trazabilidad_por_op" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_trazabilidad_por_op" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































