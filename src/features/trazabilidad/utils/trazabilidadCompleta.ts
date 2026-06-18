import type { Cliente } from '../../clientes/types/cliente';
import type { Formula } from '../../formulas/types';
import type { MovimientoStockPT } from '../../productos/types';
import type { TrazabilidadCadenaCompletaRow, TrazabilidadPorOP } from '../types';

const salidaTypes = new Set(['SALIDA', 'DESPACHO_PT']);

const num = (value: unknown) => Number(value ?? 0);

const resolveClienteNombre = (clienteId: string | null | undefined, clientes: Cliente[]) => {
  if (!clienteId) return 'Sin cliente asociado';
  return clientes.find((cliente) => cliente.uid === clienteId)?.nombre ?? 'Sin cliente asociado';
};

const resolveFormula = (formulaId: string | null | undefined, formulas: Formula[]) => {
  if (!formulaId) return { nombre: 'Sin fórmula', version: null as number | null };
  const match = formulas.find((formula) => formula.uid === formulaId || formula.nombre_producto === formulaId);
  if (!match) return { nombre: formulaId, version: null as number | null };
  return { nombre: match.nombre_producto, version: typeof match.version === 'number' ? match.version : null };
};

export const buildTrazabilidadCompleta = (
  movimientosPT: MovimientoStockPT[],
  trazabilidadOP: TrazabilidadPorOP[],
  formulas: Formula[],
  clientes: Cliente[],
): TrazabilidadCadenaCompletaRow[] => {
  const opByNumero = new Map<string, TrazabilidadPorOP>();
  const opByPtId = new Map<string, TrazabilidadPorOP>();

  trazabilidadOP.forEach((op) => {
    opByNumero.set(op.numero_orden, op);
    op.pt_generado.forEach((pt) => {
      if (pt.stock_pt_id) opByPtId.set(pt.stock_pt_id, op);
      if (pt.lote_pt) opByNumero.set(pt.lote_pt, op);
    });
  });

  return movimientosPT
    .filter((mov) => salidaTypes.has(mov.tipo))
    .map((movimiento) => {
      const op = (movimiento.stock_pt_id && opByPtId.get(movimiento.stock_pt_id))
        || (movimiento.numero_orden && opByNumero.get(movimiento.numero_orden))
        || (movimiento.lote && opByNumero.get(movimiento.lote))
        || null;
      const formula = resolveFormula(op?.formula, formulas);
      const clienteNombre = movimiento.cliente_nombre ?? resolveClienteNombre(movimiento.cliente_id, clientes);
      const lotesMp = op?.lotes_mp_usados ?? [];
      const insumos = op?.mp_planificada.map((item) => `${item.insumo} (${item.lote_mp})`) ?? [];

      return {
        cliente_id: movimiento.cliente_id ?? null,
        cliente_nombre: clienteNombre,
        producto: movimiento.nombre_producto,
        lote_pt: movimiento.lote,
        op: op?.numero_orden ?? movimiento.numero_orden ?? 'Sin dato',
        formula: formula.nombre,
        version_formula: op?.version_formula ?? formula.version,
        lotes_mp: lotesMp,
        insumos,
        kg: num(movimiento.cantidad),
        fecha: movimiento.created_at,
        referencia: movimiento.referencia ?? movimiento.motivo ?? null,
      };
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};
