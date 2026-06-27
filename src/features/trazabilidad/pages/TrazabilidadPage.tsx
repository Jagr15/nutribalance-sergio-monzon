import { FiAlertTriangle, FiSearch } from 'react-icons/fi';
import { Card } from '../../../shared/components/card';
import { useTrazabilidadHistoria } from '../hooks/useTrazabilidadHistoria';

const fmtDate = (value: string | Date | null | undefined) => {
  if (!value) return 'Sin fecha';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-AR');
};

const optionKey = (item: { id?: string; legacy_uid?: string; value?: string; label?: string }, index: number) =>
  `${item.id ?? item.legacy_uid ?? item.value ?? item.label ?? 'option'}-${index}`;

const TrazabilidadPage = () => {
  const {
    loading,
    error,
    loteInsumo,
    setLoteInsumo,
    producto,
    setProducto,
    venta,
    setVenta,
    cliente,
    setCliente,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    lotesOptions,
    productosOptions,
    ventaOptions,
    clienteOptions,
    resultado,
    resetFilters,
  } = useTrazabilidadHistoria();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm uppercase tracking-widest text-blue-400">Control de trazabilidad</p>
        <h1 className="text-3xl font-bold">Trazabilidad del lote</h1>
        <p className="max-w-3xl text-slate-500">
          Consultá la secuencia completa de eventos para auditoría: desde insumos hasta clientes o desde una venta hacia los lotes de insumo usados.
        </p>
      </section>

      <Card>
        <div className="flex items-end justify-start lg:justify-end">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Lote de insumo</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-3.5 text-slate-400" />
              <select
                value={loteInsumo}
                onChange={(event) => setLoteInsumo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-9 py-3 text-sm text-slate-900"
              >
                <option value="">Seleccioná un lote</option>
                {lotesOptions.map((option, index) => (
                  <option key={optionKey(option, index)} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Producto</label>
            <select
              value={producto}
              onChange={(event) => setProducto(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todos</option>
              {productosOptions.map((option, index) => (
                <option key={optionKey(option, index)} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Venta / pedido</label>
            <select
              value={venta}
              onChange={(event) => setVenta(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todos</option>
              {ventaOptions.map((option, index) => (
                <option key={optionKey(option, index)} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Cliente</label>
            <select
              value={cliente}
              onChange={(event) => setCliente(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="">Todos</option>
              {clienteOptions.map((option, index) => (
                <option key={optionKey(option, index)} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Fecha desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Fecha hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-red-700">
          {error}
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            <p className="text-slate-500">Cargando historial de movimientos...</p>
          </div>
        </Card>
      ) : null}

      {!loading && !error && !resultado ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-lg font-semibold text-slate-900">Completá los filtros para consultar la trazabilidad</p>
            <p className="mt-2 text-sm text-slate-500">
              En modo hacia adelante, elegí un lote de insumo. En modo hacia atrás, buscá una venta, pedido, cliente o producto.
            </p>
          </div>
        </Card>
      ) : null}

      {!loading && !error && resultado ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Trazabilidad del lote</h2>
              <p className="text-sm text-slate-500">
                {resultado.sentido === 'ADELANTE'
                  ? 'Insumo → producción → lote terminado → venta → cliente.'
                  : 'Venta / pedido / cliente → producción → lotes de insumo.'}
              </p>
            </div>

            {resultado.advertencias.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Trazabilidad incompleta</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {resultado.advertencias.map((warning, index) => (
                        <li key={`${warning}-${index}`}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {resultado.movimientos.map((movimiento, index) => (
                <article key={`${movimiento.fecha}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-500">{movimiento.tipo}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{movimiento.entidad}</h3>
                      <p className="mt-1 text-sm text-slate-600">{movimiento.detalle}</p>
                    </div>
                    <p className="text-sm text-slate-500">{fmtDate(movimiento.fecha)}</p>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Referencia</p>
                      <p className="mt-1 font-semibold">{movimiento.referencia ?? 'Sin referencia'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Orden</p>
                      <p className="mt-1 font-semibold">{movimiento.orden_lote ?? 'Sin orden'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Cliente</p>
                      <p className="mt-1 font-semibold">{movimiento.cliente ?? 'Sin cliente'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Lote MP</p>
                      <p className="mt-1 font-semibold">{movimiento.lote_mp ?? 'Sin lote'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Lote PT</p>
                      <p className="mt-1 font-semibold">{movimiento.lote_pt ?? 'Sin lote'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Evento</p>
                      <p className="mt-1 font-semibold">Secuencia consolidada</p>
                    </div>
                  </div>
                </article>
              ))}

              {resultado.movimientos.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  No hay movimientos para los filtros actuales.
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold">Resumen de auditoría</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Origen</p>
                <p className="mt-1 font-semibold">{resultado.origen}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Destino</p>
                <p className="mt-1 font-semibold">{resultado.destino ?? 'Sin destino'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Estado</p>
                <p className="mt-1 font-semibold">{resultado.trazabilidad_completa ? 'Completa' : 'Incompleta'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Cantidad de eventos</p>
                <p className="mt-1 font-semibold">{resultado.movimientos.length}</p>
              </div>
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
};

export default TrazabilidadPage;
