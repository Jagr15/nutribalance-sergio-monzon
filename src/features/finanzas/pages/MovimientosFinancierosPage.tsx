import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiArrowLeft } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { useFinanzas } from '../hooks/useFinanzas';
import { ROUTES } from '../../../app/config/routes';
import type { MovimientoFinanciero, TipoMovimientoFinanciero } from '../types';
import { MovimientosTable } from '../components/MovimientosTable';

const dateLabel = (value: string) => formatDateDDMMYYYY(value);
const dateInputToKey = (value: string) => (value ? new Date(`${value}T00:00:00`).getTime() : null);

const matches = (row: MovimientoFinanciero, query: string) => {
  if (!query) return true;
  const haystack = `${row.descripcion} ${row.categoria ?? ''} ${row.tipo} ${row.estado}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const sortDesc = (a: MovimientoFinanciero, b: MovimientoFinanciero) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime();

const MovimientosFinancierosPage = () => {
  const navigate = useNavigate();
  const { movimientos, loading, refresh } = useFinanzas();
  const [query, setQuery] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipo, setTipo] = useState<TipoMovimientoFinanciero | ''>('');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState<MovimientoFinanciero['estado'] | ''>('');
  const [page, setPage] = useState(0);

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const from = dateInputToKey(desde);
    const to = dateInputToKey(hasta);
    return [...movimientos]
      .filter((row) => matches(row, normalized))
      .filter((row) => (tipo ? row.tipo === tipo : true))
      .filter((row) => (categoria ? (row.categoria ?? '').toLowerCase().includes(categoria.toLowerCase()) : true))
      .filter((row) => (estado ? row.estado === estado : true))
      .filter((row) => (from ? new Date(row.fecha).getTime() >= from : true))
      .filter((row) => (to ? new Date(row.fecha).getTime() <= to + 86399999 : true))
      .sort(sortDesc);
  }, [categoria, desde, estado, movimientos, normalized, hasta, tipo]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const exportExcel = () => {
    void import('xlsx').then((XLSX) => {
    const rows = filtered.map((row) => ({
      Fecha: dateLabel(row.fecha),
      Tipo: row.tipo,
      Descripcion: row.descripcion,
      Origen: row.origen_operativo ?? '-',
      Categoria: row.categoria ?? '-',
      'Centro costo': row.centro_costo ?? '-',
      Monto: row.monto,
      Estado: row.estado,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, 'movimientos-financieros.xlsx');
    });
  };

  const total = filtered.length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200">Costos</p>
        <h1 className="mt-2 text-3xl font-semibold">Historial financiero</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Consulta y exporta todos los movimientos financieros con filtros globales y paginación.</p>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Filtros</h2>
            <p className="text-sm text-slate-500">Búsqueda global, fechas, tipo, categoría y estado.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate(ROUTES.COSTOS)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <FiArrowLeft size={14} />
              Volver a Costos
            </button>
            <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              <FiDownload size={14} />
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="block xl:col-span-2">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Búsqueda</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" placeholder="Buscar por descripción, categoría, tipo o estado" />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha desde</span>
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Fecha hasta</span>
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo</span>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMovimientoFinanciero | ''); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              <option value="">Todos</option>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Categoría</span>
            <input value={categoria} onChange={(e) => { setCategoria(e.target.value); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm" placeholder="Filtrar categoría" />
          </label>
          <label className="block">
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estado</span>
            <select value={estado} onChange={(e) => { setEstado(e.target.value as MovimientoFinanciero['estado'] | ''); setPage(0); }} className="ui-input mt-1 w-full rounded-2xl px-4 py-3 text-sm">
              <option value="">Todos</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Total de registros encontrados: {total}</p>
          <p className="text-sm text-slate-500">Página {safePage + 1} de {totalPages}</p>
        </div>
      </Card>

      <MovimientosTable
        movimientos={pageRows}
        limit={pageRows.length}
        showOrigenAndCentroCosto={true}
        onRefresh={refresh}
      />

      {filtered.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            Anterior
          </button>
          <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            Siguiente
          </button>
        </div>
      ) : null}

      {loading ? <Card><p className="text-sm text-slate-500">Cargando movimientos...</p></Card> : null}
    </div>
  );
};

export default MovimientosFinancierosPage;
