-- Migration 202607020016_caja_projection.sql

-- Add columns to flujo_caja_movimientos
ALTER TABLE public.flujo_caja_movimientos
ADD COLUMN IF NOT EXISTS fecha_operacion date,
ADD COLUMN IF NOT EXISTS fecha_vencimiento date,
ADD COLUMN IF NOT EXISTS estado_financiero text,
ADD COLUMN IF NOT EXISTS fecha_cobro_pago date;

-- Add columns to comprobantes
ALTER TABLE public.comprobantes
ADD COLUMN IF NOT EXISTS fecha_operacion date,
ADD COLUMN IF NOT EXISTS estado_financiero text;

-- Fill default values for existing rows
UPDATE public.flujo_caja_movimientos
SET fecha_operacion = fecha::date,
    estado_financiero = CASE WHEN tipo = 'INGRESO' THEN 'COBRADO' ELSE 'PAGADO' END
WHERE estado = 'CONFIRMADO';

UPDATE public.flujo_caja_movimientos
SET fecha_operacion = fecha::date,
    estado_financiero = CASE WHEN tipo = 'INGRESO' THEN 'PENDIENTE_COBRO' ELSE 'PENDIENTE_PAGO' END
WHERE estado = 'PENDIENTE';

UPDATE public.comprobantes
SET fecha_operacion = fecha_emision,
    estado_financiero = CASE 
      WHEN tipo = 'FACTURA_VENTA' AND estado = 'PAGADO' THEN 'COBRADO'
      WHEN tipo = 'FACTURA_VENTA' AND estado = 'PENDIENTE' THEN 'PENDIENTE_COBRO'
      WHEN tipo = 'FACTURA_VENTA' AND estado = 'VENCIDO' THEN 'VENCIDO'
      WHEN tipo = 'FACTURA_COMPRA' AND estado = 'PAGADO' THEN 'PAGADO'
      WHEN tipo = 'FACTURA_COMPRA' AND estado = 'PENDIENTE' THEN 'PENDIENTE_PAGO'
      WHEN tipo = 'FACTURA_COMPRA' AND estado = 'VENCIDO' THEN 'VENCIDO'
      ELSE 'CANCELADO'
    END;
