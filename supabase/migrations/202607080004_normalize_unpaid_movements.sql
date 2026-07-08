-- Normalize pending financial movements using the real Supabase schema.
-- Rules:
-- 1. VENTA_PT must be identified by tipo = 'INGRESO' + origen_operativo = 'VENTA_PT'.
-- 2. COMPRA_MP must be identified by tipo = 'EGRESO' + origen_operativo = 'COMPRA_MP'.
-- 3. Pending invoices stay in CxC/CxP and must not remain as confirmed cash movements.
-- 4. Real collections/payments keep confirmed cash treatment.

-- Pending sales invoices should not stay as confirmed cash.
update public.flujo_caja_movimientos as f
set
  estado = 'PENDIENTE',
  estado_financiero = 'PENDIENTE_COBRO',
  fecha_cobro_pago = null,
  updated_at = now()
from public.comprobantes as c
where f.comprobante_id = c.id
  and f.tipo = 'INGRESO'
  and f.origen_operativo = 'VENTA_PT'
  and c.tipo = 'FACTURA_VENTA'
  and coalesce(c.saldo, 0) > 0
  and coalesce(c.estado, '') <> 'ANULADO'
  and (
    f.estado = 'CONFIRMADO'
    or coalesce(f.estado_financiero, '') in ('COBRADO', 'PAGADO')
    or f.fecha_cobro_pago is not null
  );

-- Fully paid sales invoices should be marked as collected cash.
update public.flujo_caja_movimientos as f
set
  estado = 'CONFIRMADO',
  estado_financiero = 'COBRADO',
  fecha_cobro_pago = coalesce(f.fecha_cobro_pago, current_date::text),
  updated_at = now()
from public.comprobantes as c
where f.comprobante_id = c.id
  and f.tipo = 'INGRESO'
  and f.origen_operativo = 'VENTA_PT'
  and c.tipo = 'FACTURA_VENTA'
  and coalesce(c.saldo, 0) <= 0
  and coalesce(c.estado, '') in ('PAGADO', 'COBRADO');

-- Pending purchase invoices should not stay as confirmed cash.
update public.flujo_caja_movimientos as f
set
  estado = 'PENDIENTE',
  estado_financiero = 'PENDIENTE_PAGO',
  fecha_cobro_pago = null,
  updated_at = now()
from public.comprobantes as c
where f.comprobante_id = c.id
  and f.tipo = 'EGRESO'
  and f.origen_operativo = 'COMPRA_MP'
  and c.tipo = 'FACTURA_COMPRA'
  and coalesce(c.saldo, 0) > 0
  and coalesce(c.estado, '') <> 'ANULADO'
  and (
    f.estado = 'CONFIRMADO'
    or coalesce(f.estado_financiero, '') in ('COBRADO', 'PAGADO')
    or f.fecha_cobro_pago is not null
  );

-- Fully paid purchase invoices should be marked as paid cash.
update public.flujo_caja_movimientos as f
set
  estado = 'CONFIRMADO',
  estado_financiero = 'PAGADO',
  fecha_cobro_pago = coalesce(f.fecha_cobro_pago, current_date::text),
  updated_at = now()
from public.comprobantes as c
where f.comprobante_id = c.id
  and f.tipo = 'EGRESO'
  and f.origen_operativo = 'COMPRA_MP'
  and c.tipo = 'FACTURA_COMPRA'
  and coalesce(c.saldo, 0) <= 0
  and coalesce(c.estado, '') in ('PAGADO', 'COBRADO');

-- Legacy COMPRA_MP movements without comprobante stay pending until there is an explicit payment signal.
update public.flujo_caja_movimientos as f
set
  estado = 'PENDIENTE',
  estado_financiero = 'PENDIENTE_PAGO',
  fecha_cobro_pago = null,
  updated_at = now()
where f.comprobante_id is null
  and f.tipo = 'EGRESO'
  and f.origen_operativo = 'COMPRA_MP'
  and coalesce(f.fecha_cobro_pago, '') = ''
  and coalesce(f.estado_financiero, '') not in ('PAGADO', 'COBRADO')
  and f.estado <> 'ANULADO';

-- Real collections and payments should remain confirmed cash.
update public.flujo_caja_movimientos as f
set
  estado = 'CONFIRMADO',
  estado_financiero = case
    when f.tipo = 'INGRESO' then 'COBRADO'
    when f.tipo = 'EGRESO' then 'PAGADO'
    else f.estado_financiero
  end,
  fecha_cobro_pago = coalesce(f.fecha_cobro_pago, f.fecha_operacion, current_date::text),
  updated_at = now()
where f.origen_operativo in ('COBRANZA', 'PAGO')
  and f.estado <> 'ANULADO';
