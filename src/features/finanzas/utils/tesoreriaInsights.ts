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
const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
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
      const venc = row.fecha_vencimiento ? new Date(row.fecha_vencimiento) : null;
      if (venc && (!current.proximo_vencimiento || venc.getTime() < new Date(current.proximo_vencimiento).getTime())) {
        current.proximo_vencimiento = row.fecha_vencimiento;
      }
      current.ultima_compra = ventasByCliente.get(row.cliente_id ?? '')?.ultimaCompra ?? current.ultima_compra;
      if (venc) {
        const diffDays = Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
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
    tipo: row.tipo,
    tercero: row.tercero,
    importe: num(row.importe),
    fecha_emision: row.fecha_emision,
    fecha_vencimiento: row.fecha_vencimiento,
    fecha_acreditacion: row.fecha_acreditacion ?? null,
    estado: row.estado,
    cliente_id: row.cliente_id,
    cliente_nombre: row.cliente_nombre,
  });

  const emitidos = rows.filter((row) => row.tipo === 'EMITIDO').map(mapRow).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
  const recibidos = rows.filter((row) => row.tipo === 'RECIBIDO').map(mapRow).sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime());
  return { emitidos, recibidos };
};

export const buildProyeccionFlujo = (inputs: FlujoProjectionInputs): ProyeccionFlujoRow[] => {
  const cxcPorVencer = inputs.cartera
    .filter((row) => row.proximo_vencimiento && row.saldo_pendiente > 0)
    .map((row) => ({
      saldo: row.saldo_pendiente,
      days: Math.max(0, Math.ceil((new Date(row.proximo_vencimiento as string).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
    }));
  const chequesRecibidos = inputs.chequesRecibidos.map((row) => ({
    saldo: row.importe,
    days: Math.max(0, Math.ceil((new Date(row.fecha_vencimiento).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
  }));
  const chequesEmitidos = inputs.chequesEmitidos.map((row) => ({
    saldo: row.importe,
    days: Math.max(0, Math.ceil((new Date(row.fecha_vencimiento).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))),
  }));

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
  const todayStart = startOfToday();
  const todayTime = todayStart.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const within = (date: string, days: number) => {
    const diff = Math.ceil((new Date(date).getTime() - todayTime) / dayMs);
    return diff >= 0 && diff <= days;
  };
  const isToday = (date: string) => new Date(date).toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  const isTomorrow = (date: string) => Math.ceil((new Date(date).getTime() - todayTime) / dayMs) === 1;
  const pendingChequesEmitidos = inputs.chequesEmitidos.filter((cheque) => cheque.estado === 'PENDIENTE' || cheque.estado === 'A_DEPOSITAR');
  const pendingChequesRecibidos = inputs.chequesRecibidos.filter((cheque) => cheque.estado === 'PENDIENTE' || cheque.estado === 'A_DEPOSITAR');

  const saldoProyectadoAlVencimiento = (cheque: ChequeTesoreriaRow) => {
    const vencimiento = new Date(cheque.fecha_vencimiento).getTime();
    const saldoCxc = inputs.cartera
      .filter((row) => row.proximo_vencimiento && row.saldo_pendiente > 0 && new Date(row.proximo_vencimiento).getTime() <= vencimiento)
      .reduce((acc, row) => acc + row.saldo_pendiente, 0);
    const recibidosHastaVencimiento = pendingChequesRecibidos
      .filter((row) => new Date(row.fecha_vencimiento).getTime() <= vencimiento)
      .reduce((acc, row) => acc + row.importe, 0);
    const emitidosHastaVencimiento = pendingChequesEmitidos
      .filter((row) => row.id !== cheque.id && new Date(row.fecha_vencimiento).getTime() <= vencimiento)
      .reduce((acc, row) => acc + row.importe, 0);
    return inputs.saldoActual + saldoCxc + recibidosHastaVencimiento - emitidosHastaVencimiento - cheque.importe;
  };

    pendingChequesEmitidos
    .forEach((cheque) => {
      const saldoProyectado = saldoProyectadoAlVencimiento(cheque);
      if (saldoProyectado < 0) {
        alerts.push({
          alerta_id: `tes-cheque-descubierto-${cheque.id}`,
          tipo: 'Riesgo de descubierto por cheque',
          prioridad: 'critica',
          area: 'tesoreria',
          titulo: isToday(cheque.fecha_vencimiento)
            ? 'Hoy hay un cheque que cubrir'
            : `Cheque emitido ${cheque.numero} vence pronto`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
            saldo_proyectado: Number(saldoProyectado.toFixed(2)),
          },
          fecha_evento: cheque.fecha_vencimiento,
        });
        return;
      }

      if (isToday(cheque.fecha_vencimiento)) {
        alerts.push({
          alerta_id: `tes-cheque-emitido-hoy-${cheque.id}`,
          tipo: 'Cheque emitido que vence hoy',
          prioridad: 'critica',
          area: 'tesoreria',
          titulo: `Hoy hay un cheque que cubrir`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
            saldo_proyectado: Number(saldoProyectado.toFixed(2)),
          },
          fecha_evento: cheque.fecha_vencimiento,
        });
        return;
      }

      if (isTomorrow(cheque.fecha_vencimiento)) {
        alerts.push({
          alerta_id: `tes-cheque-emitido-${cheque.id}`,
          tipo: 'Cheque emitido que vence mañana',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque emitido ${cheque.numero} vence mañana`,
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

      if (within(cheque.fecha_vencimiento, 7)) {
        alerts.push({
          alerta_id: `tes-cheque-emitido-${cheque.id}`,
          tipo: 'Cheque emitido próximo a vencer',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque emitido ${cheque.numero} vence pronto`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
          },
          fecha_evento: cheque.fecha_vencimiento,
        });
      }
    });

  inputs.chequesRecibidos
    .forEach((cheque) => {
      if (cheque.estado === 'VENCIDO') {
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
        return;
      }
      if (cheque.estado === 'RECHAZADO') {
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
      if (cheque.estado === 'A_DEPOSITAR' && isToday(cheque.fecha_vencimiento)) {
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
        return;
      }
      if (cheque.estado === 'PENDIENTE' && isToday(cheque.fecha_vencimiento)) {
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
        return;
      }
      if ((cheque.estado === 'PENDIENTE' || cheque.estado === 'A_DEPOSITAR') && isTomorrow(cheque.fecha_vencimiento)) {
        alerts.push({
          alerta_id: `tes-cheque-recibido-manana-${cheque.id}`,
          tipo: 'Cheque recibido vence mañana',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque recibido ${cheque.numero} vence mañana`,
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
      if ((cheque.estado === 'PENDIENTE' || cheque.estado === 'A_DEPOSITAR') && within(cheque.fecha_vencimiento, 7)) {
        alerts.push({
          alerta_id: `tes-cheque-recibido-${cheque.id}`,
          tipo: 'Cheque recibido próximo a cobrar',
          prioridad: 'media',
          area: 'tesoreria',
          titulo: `Cheque recibido ${cheque.numero} vence pronto`,
          dato_asociado: {
            cheque: cheque.numero,
            tercero: cheque.tercero,
            importe: cheque.importe,
            vence: cheque.fecha_vencimiento,
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
