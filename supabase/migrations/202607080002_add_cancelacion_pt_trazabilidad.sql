-- Migration: Add CANCELACION_PT to public.trazabilidad_eventos check constraint
alter table public.trazabilidad_eventos
  drop constraint if exists trazabilidad_eventos_tipo_chk;

alter table public.trazabilidad_eventos
  add constraint trazabilidad_eventos_tipo_chk
  check (
    tipo in (
      'AJUSTE',
      'CONSUMO_MP',
      'DESPACHO_PT',
      'INGRESO_MP',
      'INGRESO_PT',
      'PRODUCCION_FIN',
      'PRODUCCION_INICIO',
      'RESERVA_MP',
      'RESERVA_PT',
      'LIBERACION_RESERVA_PT',
      'CANCELACION_EXPEDICION',
      'CANCELACION_PT'
    )
  );
