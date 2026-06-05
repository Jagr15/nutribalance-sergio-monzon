import { useMemo, useState, useEffect } from 'react';
import { Card } from '../../../shared/components/card';
import { FiArrowRight, FiSearch } from 'react-icons/fi';
import { StatusBadge } from '../../../shared/components/table';
import { dashboardOperativoService } from '../../dashboard/services/dashboardOperativoService';
import type { TrazabilidadVisualRow } from '../../dashboard/types/operativo';
import { ApiService } from '../../../infrastructure/api';
import { EstadoOrden } from '../../ordenes/types';
import type { OrdenProduccion } from '../../ordenes/types';
import type { Formula } from '../../formulas/types';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-AR');
};

const EVENT_LABEL: Record<string, string> = {
  CONSUMO_MP: 'Consumo de Materia Prima',
  PRODUCCION_INICIO: 'Inicio de Producción',
  PRODUCCION_FIN: 'Fin de Producción',
  INGRESO_PT: 'Ingreso Producto Terminado',
  AJUSTE: 'Ajuste',
  DESPACHO_PT: 'Despacho PT',
};

const toVisualFallback = (ordenes: OrdenProduccion[]): TrazabilidadVisualRow[] => {
  const rows: TrazabilidadVisualRow[] = [];
  ordenes.forEach((orden) => {
    rows.push({
      id: `${orden.id}-inicio`,
      fecha_evento: orden.fecha_creacion,
      tipo: 'PRODUCCION_INICIO',
      referencia: `Orden ${orden.lote} creada`,
      payload: { estado: orden.estado },
      orden_legacy_uid: orden.id,
      orden_lote: orden.lote,
      nombre_producto: orden.nombre_producto,
      lote_mp_legacy_uid: null,
      lote_mp: null,
      stock_pt_legacy_uid: null,
      lote_pt: null,
      silo_destino: orden.destino_silo ?? null,
    });

    (orden.detalle_insumos ?? []).forEach((d, idx) => {
      rows.push({
        id: `${orden.id}-consumo-${idx}`,
        fecha_evento: orden.fecha_creacion,
        tipo: 'CONSUMO_MP',
        referencia: `${d.nombre_insumo} consumido`,
        payload: { cantidad_usada: d.cantidad_usada, lote_mp: d.id_lote },
        orden_legacy_uid: orden.id,
        orden_lote: orden.lote,
        nombre_producto: orden.nombre_producto,
        lote_mp_legacy_uid: d.id_lote ?? null,
        lote_mp: d.id_lote ?? null,
        stock_pt_legacy_uid: null,
        lote_pt: null,
        silo_destino: orden.destino_silo ?? null,
      });
    });

    if (orden.estado === EstadoOrden.FINALIZADO) {
      const finFecha = new Date(orden.fecha_creacion).toISOString();
      rows.push({
        id: `${orden.id}-fin`,
        fecha_evento: finFecha,
        tipo: 'PRODUCCION_FIN',
        referencia: `Orden ${orden.lote} finalizada`,
        payload: { cantidad_real: orden.cantidad_real ?? null, merma_manual: orden.merma_manual ?? null },
        orden_legacy_uid: orden.id,
        orden_lote: orden.lote,
        nombre_producto: orden.nombre_producto,
        lote_mp_legacy_uid: null,
        lote_mp: null,
        stock_pt_legacy_uid: orden.lote ?? null,
        lote_pt: orden.lote,
        silo_destino: orden.destino_silo ?? null,
      });
      rows.push({
        id: `${orden.id}-ingreso-pt`,
        fecha_evento: finFecha,
        tipo: 'INGRESO_PT',
        referencia: `Ingreso PT ${orden.lote}`,
        payload: { cantidad_real: orden.cantidad_real ?? null },
        orden_legacy_uid: orden.id,
        orden_lote: orden.lote,
        nombre_producto: orden.nombre_producto,
        lote_mp_legacy_uid: null,
        lote_mp: null,
        stock_pt_legacy_uid: orden.lote ?? null,
        lote_pt: orden.lote,
        silo_destino: orden.destino_silo ?? null,
      });
    }
  });
  return rows.sort((a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime());
};

const payloadSummary = (payload: Record<string, unknown>) => {
  const entries = Object.entries(payload ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  return entries.slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
};

const toValidNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readProteinFromPayload = (payload: Record<string, unknown>): number | null => {
  const candidates = [
    payload.proteina_objetivo_pct,
    payload.proteina_calculada_pct,
    payload.proteina_pct,
    payload.proteina,
  ];
  for (const candidate of candidates) {
    const value = toValidNumber(candidate);
    if (value !== null) return value;
  }
  return null;
};

const TrazabilidadPage = () => {
  const [events, setEvents] = useState<TrazabilidadVisualRow[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<'lote' | 'orden' | 'silo' | 'tipo'>('lote');

  useEffect(() => {
    const load = async () => {
      try {
        const [data, formulasData] = await Promise.all([
          dashboardOperativoService.getTrazabilidad(),
          ApiService.formulas.findAll().catch(() => [] as Formula[]),
        ]);
        setFormulas(formulasData);
        setInfoMessage(null);
        if (data.length > 0) {
          setEvents(data);
          setError(null);
          return;
        }
        const ordenes = await ApiService.ordenes.getAll();
        setOrdenes(ordenes);
        setEvents(toVisualFallback(ordenes));
        setError(null);
        setInfoMessage('Trazabilidad reconstruida desde órdenes locales');
      } catch {
        try {
          const [ordenes, formulasData] = await Promise.all([
            ApiService.ordenes.getAll(),
            ApiService.formulas.findAll().catch(() => [] as Formula[]),
          ]);
          setOrdenes(ordenes);
          setFormulas(formulasData);
          setEvents(toVisualFallback(ordenes));
          setError(null);
          setInfoMessage('Trazabilidad reconstruida desde órdenes locales');
        } catch {
          setEvents([]);
          setInfoMessage(null);
          setError('No pudimos cargar la trazabilidad en este momento.');
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const formulaByNombre = useMemo(() => {
    const map = new Map<string, Formula>();
    [...formulas]
      .sort((a, b) => b.version - a.version)
      .forEach((f) => {
        const key = (f.nombre_producto ?? '').trim().toLowerCase();
        if (!key || map.has(key)) return;
        map.set(key, f);
      });
    return map;
  }, [formulas]);

  const formulaById = useMemo(() => {
    const map = new Map<string, Formula>();
    formulas.forEach((f) => map.set(f.uid, f));
    return map;
  }, [formulas]);

  const ordenByRef = useMemo(() => {
    const map = new Map<string, OrdenProduccion>();
    ordenes.forEach((o) => {
      map.set(o.id, o);
      map.set(o.lote, o);
    });
    return map;
  }, [ordenes]);

  const getProteinLabel = (ev: TrazabilidadVisualRow): string => {
    const payloadProtein = readProteinFromPayload(ev.payload ?? {});
    if (payloadProtein !== null) return `${payloadProtein.toFixed(2)}%`;
    const orderRef = ev.orden_legacy_uid ?? ev.orden_lote ?? '';
    const orden = orderRef ? ordenByRef.get(orderRef) : undefined;
    if (orden) {
      const formulaByOrderId = formulaById.get(orden.id_formula);
      if (typeof formulaByOrderId?.proteina_calculada_pct === 'number') {
        return `${formulaByOrderId.proteina_calculada_pct.toFixed(2)}%`;
      }
      const byOrderName = formulaByNombre.get((orden.nombre_producto ?? '').trim().toLowerCase());
      if (typeof byOrderName?.proteina_calculada_pct === 'number') {
        return `${byOrderName.proteina_calculada_pct.toFixed(2)}%`;
      }
    }
    const key = (ev.nombre_producto ?? '').trim().toLowerCase();
    const formula = key ? formulaByNombre.get(key) : undefined;
    if (typeof formula?.proteina_calculada_pct === 'number') {
      return `${formula.proteina_calculada_pct.toFixed(2)}%`;
    }
    return 'Sin dato';
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = [...events].sort((a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime());
    if (!q) return source;
    return source.filter((ev) => {
      if (filtro === 'lote') return `${ev.lote_mp ?? ''} ${ev.lote_pt ?? ''}`.toLowerCase().includes(q);
      if (filtro === 'orden') return `${ev.orden_legacy_uid ?? ''} ${ev.orden_lote ?? ''}`.toLowerCase().includes(q);
      if (filtro === 'tipo') return `${ev.tipo ?? ''}`.toLowerCase().includes(q);
      return `${ev.silo_destino ?? ''}`.toLowerCase().includes(q);
    });
  }, [events, filtro, query]);

  const flujo = useMemo(() => {
    if (filtered.length === 0) return null;
    const mp = filtered.find((e) => e.lote_mp)?.lote_mp ?? filtered.find((e) => e.lote_mp_legacy_uid)?.lote_mp_legacy_uid ?? null;
    const orden = filtered.find((e) => e.orden_lote)?.orden_lote ?? filtered.find((e) => e.orden_legacy_uid)?.orden_legacy_uid ?? null;
    const pt = filtered.find((e) => e.lote_pt)?.lote_pt ?? filtered.find((e) => e.stock_pt_legacy_uid)?.stock_pt_legacy_uid ?? null;
    const silo = filtered.find((e) => e.silo_destino)?.silo_destino ?? null;
    return {
      mp: mp ?? 'Sin dato',
      orden: orden ?? 'Sin dato',
      pt: pt ?? 'Sin dato',
      silo: silo ?? 'Sin dato',
    };
  }, [filtered]);

  const summary = useMemo(() => {
    const orders = new Set(filtered.map((e) => e.orden_legacy_uid ?? e.orden_lote).filter(Boolean));
    const lotesMp = new Set(filtered.map((e) => e.lote_mp ?? e.lote_mp_legacy_uid).filter(Boolean));
    const lotesPt = new Set(filtered.map((e) => e.lote_pt ?? e.stock_pt_legacy_uid).filter(Boolean));
    return {
      eventos: filtered.length,
      ordenes: orders.size,
      lotesMp: lotesMp.size,
      lotesPt: lotesPt.size,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Control de trazabilidad</p>
        <h1 className="text-3xl font-bold mt-2">Trazabilidad</h1>
      </section>

      <Card>
        <div className="flex flex-col md:flex-row gap-3">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'lote' | 'orden' | 'silo')} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
            <option value="lote">Buscar por lote</option>
            <option value="orden">Buscar por orden</option>
            <option value="silo">Buscar por silo</option>
            <option value="tipo">Buscar por tipo</option>
          </select>
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-3 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ingresá valor de búsqueda" className="w-full rounded-lg bg-white border border-slate-200 pl-9 pr-3 py-2" />
          </div>
        </div>
      </Card>

      {error ? <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card> : null}
      {!error && infoMessage ? <Card className="border-slate-200 bg-slate-50 text-slate-700">{infoMessage}</Card> : null}

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <Card className="xl:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Flujo MP → Orden → PT</h2>
          {flujo ? (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500 uppercase">MP</p><p className="font-semibold mt-1">{flujo.mp}</p></div>
              <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500 uppercase">Orden</p><p className="font-semibold mt-1">{flujo.orden}</p></div>
              <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500 uppercase">PT</p><p className="font-semibold mt-1">{flujo.pt}</p></div>
              <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500 uppercase">Silo</p><p className="font-semibold mt-1">{flujo.silo}</p></div>
            </div>
          ) : (
            <p className="text-slate-500">Sin resultados para el filtro actual.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Resumen</h2>
          <p className="text-sm text-slate-700">Eventos totales: <strong>{summary.eventos}</strong></p>
          <p className="text-sm text-slate-700 mt-2">Órdenes involucradas: <strong>{summary.ordenes}</strong></p>
          <p className="text-sm text-slate-700 mt-2">Lotes MP: <strong>{summary.lotesMp}</strong></p>
          <p className="text-sm text-slate-700 mt-2">Lotes PT: <strong>{summary.lotesPt}</strong></p>
          <p className="text-sm text-slate-700 mt-2">Filtro activo: <strong>{filtro}</strong></p>
        </Card>
      </section>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Timeline de eventos</h2>
        {loading ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            <p className="text-slate-500">Cargando eventos de trazabilidad...</p>
          </div>
        ) : null}
        {!loading && events.length === 0 ? <p className="text-slate-700">No hay eventos de trazabilidad disponibles.</p> : null}
        {!loading && events.length > 0 && filtered.length === 0 ? <p className="text-slate-700">No hay resultados para la búsqueda aplicada.</p> : null}
        <div className="space-y-3">
          {filtered.slice(0, 100).map((ev) => (
            <div key={ev.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 hover:bg-slate-50 transition-colors">
              {(() => {
                const proteina = getProteinLabel(ev);
                const cantidadConsumida = toValidNumber(ev.payload?.cantidad_usada);
                const mp = ev.lote_mp || ev.lote_mp_legacy_uid || 'Sin dato';
                const ordenRef = ev.orden_lote || ev.orden_legacy_uid || 'Sin dato';
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{fmtDate(ev.fecha_evento)}</span><span>·</span><span>{EVENT_LABEL[ev.tipo] ?? ev.tipo}</span>
                      </div>
                      <StatusBadge value={ev.tipo} />
                    </div>
                    <p className="font-semibold mt-1 text-slate-900">{ev.referencia || 'Sin referencia'}</p>
                    {ev.tipo === 'CONSUMO_MP' ? (
                      <p className="text-sm text-slate-700 mt-1">
                        MP: {mp} · Orden: {ordenRef} · Cantidad usada: {cantidadConsumida !== null ? `${cantidadConsumida} kg` : 'Sin dato'} · Proteína objetivo: {proteina}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-700 mt-1">Lote MP: {ev.lote_mp || '-'} · Orden: {ev.orden_legacy_uid || ev.orden_lote || '-'} · PT: {ev.lote_pt || '-'} · Silo: {ev.silo_destino || '-'}</p>
                    )}
                    {ev.tipo !== 'CONSUMO_MP' ? <p className="text-sm text-slate-700 mt-1">Proteína objetivo: {proteina}</p> : null}
                    {payloadSummary(ev.payload).trim() ? <p className="text-xs text-slate-500 mt-1">Detalle: {payloadSummary(ev.payload)}</p> : null}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default TrazabilidadPage;
