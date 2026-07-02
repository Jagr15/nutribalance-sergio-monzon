import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type {
  AlertaTesoreriaRaw,
  ChequeTesoreriaRow,
  ClienteCarteraRow,
  FinanzasTesoreriaInsights,
  GastoPorRubro,
  PresupuestoVsRealRubro,
  ProyeccionFlujoRow,
  RubroFinanciero,
  RubroFinancieroCatalogo,
} from '../types';

const num = (value: unknown) => Number(value ?? 0);
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;

export interface PresupuestoMensualRow {
  rubro?: string | null;
  categoria?: string | null;
  centro_costo?: string | null;
  monto_presupuestado: number | string | null;
  anio: number;
  mes: number;
}

export interface FlujoCajaRubroRow {
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';
  origen_operativo?: string | null;
  descripcion: string;
  monto: number | string | null;
  categoria?: string | null;
  centro_costo?: string | null;
}

export interface ComprobanteCarteraRow {
  cliente_id?: string | null;
  tercero?: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: string;
  saldo: number | string | null;
  tipo: string;
}

export interface ChequeTesoreriaSourceRow {
  id: string;
  numero: string;
  tipo: 'EMITIDO' | 'RECIBIDO';
  tercero: string;
  importe: number | string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'PENDIENTE' | 'A_DEPOSITAR' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'ENDOSADO' | 'VENCIDO';
  fecha_acreditacion?: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
}

export interface FlujoProjectionInputs {
  saldoActual: number;
  cartera: ClienteCarteraRow[];
  chequesEmitidos: ChequeTesoreriaRow[];
  chequesRecibidos: ChequeTesoreriaRow[];
  egresoPromedioDiario: number;
}

export interface BuildTesoreriaInputs {
  rubros?: RubroFinancieroCatalogo[];
}

const monthKey = (isoLike: string) => {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentMonthKey = monthKey(today.toISOString());

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const normalizeChequeTipo = (value: unknown): 'EMITIDO' | 'RECIBIDO' => {
  const text = String(value ?? '').trim().toUpperCase();
  return text === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
};

const normalizeChequeEstado = (value: unknown): EstadoChequeTesoreria => {
  const clean = String(value ?? '').trim().toUpperCase().replace(/[\s_]+/g, '_');
  if (clean === 'PENDIENTE' || clean === 'RECIBIDO') return 'PENDIENTE';
  if (clean === 'A_DEPOSITAR') return 'A_DEPOSITAR';
  if (clean === 'DEPOSITADO') return 'DEPOSITADO';
  if (clean === 'COBRADO' || clean === 'PAGADO') return 'COBRADO';
  if (clean === 'RECHAZADO') return 'RECHAZADO';
  if (clean === 'ENDOSADO') return 'ENDOSADO';
  if (clean === 'VENCIDO') return 'VENCIDO';
  return 'PENDIENTE';
};

const normalizeToLocalDateStr = (dateVal: any): string => {
  if (!dateVal) return '';
  
  if (dateVal instanceof Date) {
    if (Number.isNaN(dateVal.getTime())) return '';
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const str = String(dateVal).trim();
  if (!str) return '';

  const datePart = str.split(/[T ]/)[0];

  const slashParts = datePart.split('/');
  if (slashParts.length === 3) {
    let day = slashParts[0];
    let month = slashParts[1];
    let year = slashParts[2];
    if (year.length === 2) year = '20' + year;
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dashParts = datePart.split('-');
  if (dashParts.length === 3) {
    let year = dashParts[0];
    let month = dashParts[1];
    let day = dashParts[2];
    
    if (year.length === 2 && day.length === 4) {
      const temp = year;
      year = day;
      day = temp;
    }
    
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

const getDiffDays = (dateStr1: string, dateStr2: string): number => {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(`${dateStr1}T00:00:00`);
  const d2 = new Date(`${dateStr2}T00:00:00`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};
const resolveRubroNombre = (
  row: Pick<FlujoCajaRubroRow, 'categoria' | 'centro_costo' | 'origen_operativo' | 'descripcion'>,
  rubros: RubroFinancieroCatalogo[],
) => {
  const categoria = normalize(row.categoria);
  const match = rubros.find((rubro) => normalize(rubro.nombre) === categoria && rubro.activo);
  return match?.nombre ?? classifyRubro(row);
};

export const classifyRubro = (row: Pick<FlujoCajaRubroRow, 'categoria' | 'centro_costo' | 'origen_operativo' | 'descripcion'>): RubroFinanciero => {
  const categoria = normalize(row.categoria);
  const centro = normalize(row.centro_costo);
  const origen = normalize(row.origen_operativo);
  const descripcion = normalize(row.descripcion);

  if (categoria.includes('compra') || origen.includes('compra')) return 'Compras MP';
  if (categoria.includes('venta') || origen.includes('venta') || origen.includes('cobranza')) return 'Otros';
  if (origen.includes('produccion') || categoria.includes('produccion') || descripcion.includes('produccion') || descripcion.includes('op')) return 'Producción';
  if (categoria.includes('logistica') || centro.includes('logistica') || origen.includes('logistica') || origen.includes('despacho') || descripcion.includes('flete')) return 'Logística';
  if (descripcion.includes('nomina') || descripcion.includes('nómina') || descripcion.includes('sueldo') || descripcion.includes('salario') || descripcion.includes('personal')) return 'Nómina';
  if (descripcion.includes('servicio') || descripcion.includes('internet') || descripcion.includes('luz') || descripcion.includes('agua') || descripcion.includes('alquiler')) return 'Servicios';
  if (descripcion.includes('marketing') || descripcion.includes('publicidad') || descripcion.includes('campaña') || descripcion.includes('redes')) return 'Marketing';
  if (centro.includes('administracion') || centro.includes('administración')) return 'Servicios';
  return 'Otros';
};

const pickClientName = (clienteId: string | null | undefined, tercero: string | null | undefined, clientes: Cliente[]) => {
  if (clienteId) {
    const found = clientes.find((cliente) => cliente.uid === clienteId);
    if (found) return found.nombre;
  }
  return tercero?.trim() || 'Sin cliente asociado';
};

export const buildPresupuestoVsReal = (
  presupuestos: PresupuestoMensualRow[],
  movimientos: FlujoCajaRubroRow[],
  rubros: RubroFinancieroCatalogo[] = [],
): { rows: PresupuestoVsRealRubro[]; warning: string | null } => {
  const egresos = movimientos.filter((movimiento) => movimiento.tipo === 'EGRESO');
  const actualByRubro = new Map<string, number>();
  const historicByRubro = new Map<string, number[]>();
  const currentBudgetByRubro = new Map<string, number>();

  egresos.forEach((movimiento) => {
    const rubro = resolveRubroNombre(movimiento, rubros);
    const amount = num(movimiento.monto);
    const isCurrentMonth = monthKey(movimiento.fecha) === currentMonthKey;
    if (isCurrentMonth) {
      actualByRubro.set(rubro, (actualByRubro.get(rubro) ?? 0) + amount);
    } else {
      const current = historicByRubro.get(rubro) ?? [];
      current.push(amount);
      historicByRubro.set(rubro, current);
    }
  });

  presupuestos.forEach((row) => {
    if (row.anio !== currentYear || row.mes !== currentMonth) return;
    const rubro = resolveRubroNombre({
      categoria: row.categoria ?? null,
      centro_costo: row.centro_costo ?? null,
      origen_operativo: null,
      descripcion: row.categoria ?? row.centro_costo ?? 'presupuesto',
    }, rubros);
    currentBudgetByRubro.set(rubro, (currentBudgetByRubro.get(rubro) ?? 0) + num(row.monto_presupuestado));
  });

  const catalogo = rubros.length > 0 ? rubros : [
    { id: 'Compras MP', nombre: 'Compras MP', tipo: 'EGRESO', activo: true },
    { id: 'Producción', nombre: 'Producción', tipo: 'EGRESO', activo: true },
    { id: 'Logística', nombre: 'Logística', tipo: 'EGRESO', activo: true },
    { id: 'Nómina', nombre: 'Nómina', tipo: 'EGRESO', activo: true },
    { id: 'Servicios', nombre: 'Servicios', tipo: 'EGRESO', activo: true },
    { id: 'Marketing', nombre: 'Marketing', tipo: 'EGRESO', activo: true },
    { id: 'Otros', nombre: 'Otros', tipo: 'EGRESO', activo: true },
  ];
  const rows = catalogo.map((rubro) => {
    const presupuesto = currentBudgetByRubro.get(rubro.nombre) ?? 0;
    const real = actualByRubro.get(rubro.nombre) ?? 0;
    const historical = historicByRubro.get(rubro.nombre) ?? [];
    const generated = presupuesto <= 0 && historical.length > 0;
    const fallback = historical.length > 0 ? historical.reduce((acc, value) => acc + value, 0) / historical.length : 0;
    const finalBudget = presupuesto > 0 ? presupuesto : fallback;
    const variacionAbs = real - finalBudget;
    const variacionPct = finalBudget > 0 ? (variacionAbs / finalBudget) * 100 : 0;
    return {
      rubro: rubro.nombre,
      presupuesto: Number(finalBudget.toFixed(2)),
      real: Number(real.toFixed(2)),
      variacion_abs: Number(variacionAbs.toFixed(2)),
      variacion_pct: Number(variacionPct.toFixed(2)),
      generado: generated,
    };
  });

  return {
    rows,
    warning: rows.some((row) => row.generado) ? 'Se generaron presupuestos iniciales desde el histórico para algunos rubros sin presupuesto cargado.' : null,
  };
};

export const buildGastosPorRubro = (movimientos: FlujoCajaRubroRow[]): GastoPorRubro[] => {
  const totals = new Map<string, number>();
  movimientos.filter((movimiento) => movimiento.tipo === 'EGRESO').forEach((movimiento) => {
    const rubro = resolveRubroNombre(movimiento, []);
    totals.set(rubro, (totals.get(rubro) ?? 0) + num(movimiento.monto));
  });
  const total = Math.max(1, [...totals.values()].reduce((acc, value) => acc + value, 0));
  const rows = [...totals.entries()]
    .map(([rubro, monto]) => ({ rubro, monto: Number(monto.toFixed(2)), porcentaje: Number(((monto / total) * 100).toFixed(2)) }))
    .filter((row) => row.monto > 0)
    .sort((a, b) => b.monto - a.monto);
  const roundedTotal = rows.reduce((acc, row) => acc + row.porcentaje, 0);
  if (rows.length > 0 && roundedTotal !== 100) {
    const lastIndex = rows.length - 1;
    rows[lastIndex] = {
      ...rows[lastIndex],
      porcentaje: Number((rows[lastIndex].porcentaje + (100 - roundedTotal)).toFixed(2)),
    };
  }
  return rows;
};

export const buildVariacionesPorRubro = (rows: PresupuestoVsRealRubro[], sortBy: 'desviacion' | 'menor_desviacion' | 'mayor_gasto' | 'menor_gasto' = 'desviacion') => {
  const sorted = [...rows];
  if (sortBy === 'desviacion') sorted.sort((a, b) => Math.abs(b.variacion_pct) - Math.abs(a.variacion_pct));
  if (sortBy === 'menor_desviacion') sorted.sort((a, b) => Math.abs(a.variacion_pct) - Math.abs(b.variacion_pct));
  if (sortBy === 'mayor_gasto') sorted.sort((a, b) => b.real - a.real);
  if (sortBy === 'menor_gasto') sorted.sort((a, b) => a.real - b.real);
  return sorted;
};

export const buildCarteraClientes = (
  clientes: Cliente[],
  comprobantes: ComprobanteCarteraRow[],
  ventasPT: MovimientoStockPT[],
): ClienteCarteraRow[] => {
  const ventasByCliente = new Map<string, { ultimaCompra: string | null }>();
  ventasPT.forEach((movimiento) => {
    if (!movimiento.cliente_id) return;
    const current = ventasByCliente.get(movimiento.cliente_id) ?? { ultimaCompra: null };
    current.ultimaCompra = !current.ultimaCompra || new Date(movimiento.created_at).getTime() > new Date(current.ultimaCompra).getTime()
      ? movimiento.created_at
      : current.ultimaCompra;
    ventasByCliente.set(movimiento.cliente_id, current);
  });

  const grouped = new Map<string, ClienteCarteraRow>();
  comprobantes
    .filter((row) => row.tipo === 'FACTURA_VENTA' && num(row.saldo) > 0)
    .forEach((row) => {
      const key = row.cliente_id ?? row.tercero ?? 'sin-cliente';
      const clienteNombre = pickClientName(row.cliente_id, row.tercero, clientes);
      const current = grouped.get(key) ?? {
        cliente_id: row.cliente_id ?? null,
        cliente_nombre: clienteNombre,
        saldo_pendiente: 0,
        ultima_compra: ventasByCliente.get(row.cliente_id ?? '')?.ultimaCompra ?? row.fecha_emision,
        dias_atraso: null,
        proximo_vencimiento: null,
      };
      current.saldo_pendiente += num(row.saldo);
      const vencStr = row.fecha_vencimiento ? normalizeToLocalDateStr(row.fecha_vencimiento) : '';
      if (vencStr && (!current.proximo_vencimiento || vencStr < normalizeToLocalDateStr(current.proximo_vencimiento))) {
        current.proximo_vencimiento = row.fecha_vencimiento;
      }
      current.ultima_compra = ventasByCliente.get(row.cliente_id ?? '')?.ultimaCompra ?? current.ultima_compra;
      if (vencStr) {
        const localToday = new Date();
        const getLocalDateStr = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const todayStr = getLocalDateStr(localToday);
        const diffDays = getDiffDays(todayStr, vencStr);
        if (diffDays > 0) {
          current.dias_atraso = current.dias_atraso === null ? diffDays : Math.max(current.dias_atraso, diffDays);
        }
      }
      grouped.set(key, current);
    });

  return [...grouped.values()].sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
};

export const buildChequesTesoreria = (rows: ChequeTesoreriaSourceRow[]): { emitidos: ChequeTesoreriaRow[]; recibidos: ChequeTesoreriaRow[] } => {
  const mapRow = (row: ChequeTesoreriaSourceRow): ChequeTesoreriaRow => ({
    id: row.id,
    numero: row.numero,
    tipo: normalizeChequeTipo(row.tipo),
    tercero: row.tercero,
    importe: num(row.importe),
    fecha_emision: normalizeToLocalDateStr(row.fecha_emision),
    fecha_vencimiento: normalizeToLocalDateStr(row.fecha_vencimiento),
    fecha_acreditacion: row.fecha_acreditacion ? normalizeToLocalDateStr(row.fecha_acreditacion) : null,
    estado: normalizeChequeEstado(row.estado),
    cliente_id: row.cliente_id,
    cliente_nombre: row.cliente_nombre,
  });

  const emitidos = rows.filter((row) => normalizeChequeTipo(row.tipo) === 'EMITIDO').map(mapRow).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
  const recibidos = rows.filter((row) => normalizeChequeTipo(row.tipo) === 'RECIBIDO').map(mapRow).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
  return { emitidos, recibidos };
};

export const buildProyeccionFlujo = (inputs: FlujoProjectionInputs): ProyeccionFlujoRow[] => {
  const localToday = new Date();
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalDateStr(localToday);

  const cxcPorVencer = inputs.cartera
    .filter((row) => row.proximo_vencimiento && row.saldo_pendiente > 0)
    .map((row) => {
      const venceStr = normalizeToLocalDateStr(row.proximo_vencimiento);
      return {
        saldo: row.saldo_pendiente,
        days: Math.max(0, getDiffDays(venceStr, todayStr)),
      };
    });
  const chequesRecibidos = inputs.chequesRecibidos.map((row) => {
    const venceStr = normalizeToLocalDateStr(row.fecha_vencimiento);
    return {
      saldo: row.importe,
      days: Math.max(0, getDiffDays(venceStr, todayStr)),
    };
  });
  const chequesEmitidos = inputs.chequesEmitidos.map((row) => {
    const venceStr = normalizeToLocalDateStr(row.fecha_vencimiento);
    return {
      saldo: row.importe,
      days: Math.max(0, getDiffDays(venceStr, todayStr)),
    };
  });

  const horizons = [0, 7, 15, 30] as const;
  return horizons.map((days) => {
    const ingresosEstimados = cxcPorVencer.filter((row) => row.days <= days).reduce((acc, row) => acc + row.saldo, 0)
      + chequesRecibidos.filter((row) => row.days <= days).reduce((acc, row) => acc + row.saldo, 0);
    const egresosEstimados = chequesEmitidos.filter((row) => row.days <= days).reduce((acc, row) => acc + row.saldo, 0)
      + inputs.egresoPromedioDiario * days;
    const horizonte: ProyeccionFlujoRow['horizonte'] = days === 0 ? 'Hoy' : `${days} días` as ProyeccionFlujoRow['horizonte'];
    return {
      horizonte,
      saldo_estimado: Number((inputs.saldoActual + ingresosEstimados - egresosEstimados).toFixed(2)),
      ingresos_estimados: Number(ingresosEstimados.toFixed(2)),
      egresos_estimados: Number(egresosEstimados.toFixed(2)),
    };
  });
};

export const buildAlertasTesoreria = (inputs: {
  saldoActual: number;
  cartera: ClienteCarteraRow[];
  chequesEmitidos: ChequeTesoreriaRow[];
  chequesRecibidos: ChequeTesoreriaRow[];
  proyeccionFlujo: ProyeccionFlujoRow[];
}): AlertaTesoreriaRaw[] => {
  const alerts: AlertaTesoreriaRaw[] = [];
  const today = new Date();
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalDateStr(today);

  // Emitidos
  inputs.chequesEmitidos.forEach((cheque) => {
    const normalizedEstado = normalizeChequeEstado(cheque.estado);
    if (['COBRADO', 'DEPOSITADO', 'ENDOSADO', 'PAGADO'].includes(normalizedEstado)) {
      return;
    }

    const fechaRef = normalizeToLocalDateStr(cheque.fecha_vencimiento);
    if (!fechaRef) return;

    // Vencido
    if (fechaRef < todayStr) {
      alerts.push({
        alerta_id: `tes-cheque-emitido-vencido-${cheque.id}`,
        tipo: 'Cheque emitido vencido',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Cheque emitido ${cheque.numero} vencido`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
    }
    // Vence hoy
    else if (fechaRef === todayStr) {
      alerts.push({
        alerta_id: `tes-cheque-emitido-hoy-${cheque.id}`,
        tipo: 'Cheque emitido vence hoy / cubrir fondos',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Cheque emitido ${cheque.numero} vence hoy / cubrir fondos`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
    }
    // Próximo a vencer
    else {
      const diff = getDiffDays(fechaRef, todayStr);
      if (diff > 0 && diff <= 7) {
        alerts.push({
          alerta_id: `tes-cheque-emitido-proximo-${cheque.id}`,
          tipo: 'Cheque emitido próximo a vencer',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque emitido ${cheque.numero} próximo a vencer`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
          },
          fecha_evento: cheque.fecha_vencimiento,
        });
      }
    }
  });

  // Recibidos
  inputs.chequesRecibidos.forEach((cheque) => {
    const normalizedEstado = normalizeChequeEstado(cheque.estado);
    if (['COBRADO', 'DEPOSITADO', 'ENDOSADO', 'PAGADO'].includes(normalizedEstado)) {
      return;
    }

    const fechaRef = normalizeToLocalDateStr(cheque.fecha_vencimiento);
    if (!fechaRef) return;

    if (normalizedEstado === 'RECHAZADO') {
      alerts.push({
        alerta_id: `tes-cheque-recibido-rechazado-${cheque.id}`,
        tipo: 'Cheque recibido rechazado',
        prioridad: 'media',
        area: 'tesoreria',
        titulo: `Cheque recibido ${cheque.numero} rechazado`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
      return;
    }

    // Vencido
    if (fechaRef < todayStr) {
      alerts.push({
        alerta_id: `tes-cheque-recibido-vencido-${cheque.id}`,
        tipo: 'Cheque recibido vencido',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Cheque recibido ${cheque.numero} vencido`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
    }
    // Vence hoy / listo para depositar
    else if (fechaRef === todayStr) {
      alerts.push({
        alerta_id: `tes-cheque-recibido-hoy-${cheque.id}`,
        tipo: 'Cheque recibido listo para depositar',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Cheque recibido ${cheque.numero} listo para depositar`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
    }
    // Próximo a vencer / listo para depositar
    else {
      const diff = getDiffDays(fechaRef, todayStr);
      if (diff > 0 && diff <= 7) {
        alerts.push({
          alerta_id: `tes-cheque-recibido-proximo-${cheque.id}`,
          tipo: 'Cheque recibido próximo a vencer',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque recibido ${cheque.numero} próximo a vencer`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
          },
          fecha_evento: cheque.fecha_vencimiento,
        });
      }
    }
  });

  // Risk of overdraft check
  const pendingChequesEmitidos = inputs.chequesEmitidos.filter((cheque) => {
    const est = normalizeChequeEstado(cheque.estado);
    return est === 'PENDIENTE' || est === 'A_DEPOSITAR';
  });
  const pendingChequesRecibidos = inputs.chequesRecibidos.filter((cheque) => {
    const est = normalizeChequeEstado(cheque.estado);
    return est === 'PENDIENTE' || est === 'A_DEPOSITAR';
  });

  const saldoProyectadoAlVencimiento = (cheque: ChequeTesoreriaRow) => {
    const vencimientoStr = normalizeToLocalDateStr(cheque.fecha_vencimiento);
    const saldoCxc = inputs.cartera
      .filter((row) => {
        const rowVencStr = normalizeToLocalDateStr(row.proximo_vencimiento);
        return rowVencStr && row.saldo_pendiente > 0 && rowVencStr <= vencimientoStr;
      })
      .reduce((acc, row) => acc + row.saldo_pendiente, 0);
    const recibidosHastaVencimiento = pendingChequesRecibidos
      .filter((row) => {
        const rowVencStr = normalizeToLocalDateStr(row.fecha_vencimiento);
        return rowVencStr && rowVencStr <= vencimientoStr;
      })
      .reduce((acc, row) => acc + row.importe, 0);
    const emitidosHastaVencimiento = pendingChequesEmitidos
      .filter((row) => {
        const rowVencStr = normalizeToLocalDateStr(row.fecha_vencimiento);
        return row.id !== cheque.id && rowVencStr && rowVencStr <= vencimientoStr;
      })
      .reduce((acc, row) => acc + row.importe, 0);
    return inputs.saldoActual + saldoCxc + recibidosHastaVencimiento - emitidosHastaVencimiento - cheque.importe;
  };

  pendingChequesEmitidos.forEach((cheque) => {
    const saldoProyectado = saldoProyectadoAlVencimiento(cheque);
    if (saldoProyectado < 0) {
      alerts.push({
        alerta_id: `tes-cheque-descubierto-${cheque.id}`,
        tipo: 'Riesgo de descubierto por cheque',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Cheque emitido ${cheque.numero} vence pronto`,
        dato_asociado: {
          cheque: cheque.numero,
          tercero: cheque.tercero,
          importe: cheque.importe,
          vence: cheque.fecha_vencimiento,
          saldo_proyectado: Number(saldoProyectado.toFixed(2)),
        },
        fecha_evento: cheque.fecha_vencimiento,
      });
    }
  });

  inputs.cartera
    .filter((row) => row.dias_atraso !== null && row.dias_atraso > 0)
    .slice(0, 5)
    .forEach((row) => {
      alerts.push({
        alerta_id: `tes-cxc-${row.cliente_id ?? row.cliente_nombre}`,
        tipo: 'Cuenta por cobrar vencida',
        prioridad: row.dias_atraso && row.dias_atraso > 30 ? 'critica' : 'media',
        area: 'tesoreria',
        titulo: `Cuenta por cobrar vencida: ${row.cliente_nombre}`,
        dato_asociado: {
          cliente: row.cliente_nombre,
          saldo: row.saldo_pendiente,
          atraso_dias: row.dias_atraso,
        },
        fecha_evento: row.proximo_vencimiento ?? today.toISOString(),
      });
    });

  inputs.proyeccionFlujo
    .filter((row) => row.saldo_estimado < 0)
    .forEach((row) => {
      alerts.push({
        alerta_id: `tes-flujo-${row.horizonte}`,
        tipo: 'Flujo de caja proyectado negativo',
        prioridad: 'critica',
        area: 'tesoreria',
        titulo: `Posible flujo negativo en ${row.horizonte}`,
        dato_asociado: {
          horizonte: row.horizonte,
          saldo_estimado: row.saldo_estimado,
        },
        fecha_evento: today.toISOString(),
      });
    });

  return alerts;
};

export const buildTesoreriaInsights = (
  presupuestos: PresupuestoMensualRow[],
  movimientos: FlujoCajaRubroRow[],
  clientes: Cliente[],
  comprobantes: ComprobanteCarteraRow[],
  ventasPT: MovimientoStockPT[],
  cheques: ChequeTesoreriaSourceRow[],
  saldoActual: number,
  inputs: BuildTesoreriaInputs = {},
): FinanzasTesoreriaInsights => {
  const presupuestoResult = buildPresupuestoVsReal(presupuestos, movimientos, inputs.rubros ?? []);
  const gastosPorRubro = buildGastosPorRubro(movimientos);
  const variacionesPorRubro = buildVariacionesPorRubro(presupuestoResult.rows);
  const carteraClientes = buildCarteraClientes(clientes, comprobantes, ventasPT);
  const { emitidos, recibidos } = buildChequesTesoreria(cheques);
  const egresosDelMes = movimientos.filter((movimiento) => movimiento.tipo === 'EGRESO' && monthKey(movimiento.fecha) === currentMonthKey);
  const egresoPromedioDiario = egresosDelMes.reduce((acc, row) => acc + num(row.monto), 0) / Math.max(1, new Date().getDate());
  const proyeccionFlujo = buildProyeccionFlujo({
    saldoActual,
    cartera: carteraClientes,
    chequesEmitidos: emitidos,
    chequesRecibidos: recibidos,
    egresoPromedioDiario,
  });

  return {
    presupuestoVsReal: presupuestoResult.rows,
    gastosPorRubro,
    variacionesPorRubro,
    carteraClientes,
    chequesEmitidos: emitidos,
    chequesRecibidos: recibidos,
    proyeccionFlujo,
    alertasTesoreria: buildAlertasTesoreria({
      saldoActual,
      cartera: carteraClientes,
      chequesEmitidos: emitidos,
      chequesRecibidos: recibidos,
      proyeccionFlujo,
    }),
  };
};
