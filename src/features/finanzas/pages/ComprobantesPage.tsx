import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { FiPlus, FiSearch, FiXCircle, FiAlertCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { Card } from '../../../shared/components/card';
import { ApiService } from '../../../infrastructure/api';
import { comprobanteService, type Comprobante } from '../services/comprobanteService';
import type { Cliente } from '../../clientes/types/cliente';
import type { Proveedor } from '../../proveedores/types/proveedor';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { filterComprobantes, paginateComprobantes } from '../utils/comprobantesPagination';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

const tipoBadge: Record<string, string> = {
  FACTURA_VENTA: 'bg-blue-50 text-blue-700 border-blue-200',
  FACTURA_COMPRA: 'bg-orange-50 text-orange-700 border-orange-200',
  RECIBO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAGO: 'bg-purple-50 text-purple-700 border-purple-200',
  AJUSTE: 'bg-slate-100 text-slate-700 border-slate-300',
};

const tipoLabel: Record<string, string> = {
  FACTURA_VENTA: 'Factura Venta (CxC)',
  FACTURA_COMPRA: 'Factura Compra (CxP)',
  RECIBO: 'Recibo (Cobro)',
  PAGO: 'Orden Pago',
  AJUSTE: 'Ajuste',
};

const estadoBadge: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  PAGADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VENCIDO: 'bg-red-50 text-red-700 border-red-200',
  ANULADO: 'bg-slate-100 text-slate-500 border-slate-200',
};

const ComprobantesPage: React.FC = () => {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, clientsList, suppliersList] = await Promise.all([
        comprobanteService.getAll(),
        ApiService.clientes.getAll(),
        ApiService.proveedores.getAll(),
      ]);
      setComprobantes(list);
      setClientes(clientsList);
      setProveedores(suppliersList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los comprobantes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, tipoFilter, estadoFilter]);

  const filtered = useMemo(() => {
    return filterComprobantes(comprobantes, searchTerm, tipoFilter, estadoFilter);
  }, [comprobantes, searchTerm, tipoFilter, estadoFilter]);

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(() => {
    return paginateComprobantes(filtered, currentPage, itemsPerPage);
  }, [filtered, currentPage]);

  // KPIs
  const totalCxC = useMemo(() => {
    return comprobantes
      .filter(c => c.tipo === 'FACTURA_VENTA' && c.estado === 'PENDIENTE')
      .reduce((sum, c) => sum + c.saldo, 0);
  }, [comprobantes]);

  const totalCxP = useMemo(() => {
    return comprobantes
      .filter(c => c.tipo === 'FACTURA_COMPRA' && c.estado === 'PENDIENTE')
      .reduce((sum, c) => sum + c.saldo, 0);
  }, [comprobantes]);

  const handleAnular = async (comp: Comprobante) => {
    const result = await Swal.fire({
      title: '¿Confirmás la anulación?',
      text: `Se anulará el comprobante ${comp.numero || ''} por ${formatCurrency(comp.total)}. Esta operación cancelará los saldos pendientes asociados.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      background: '#ffffff',
      color: '#0f172a',
    });

    if (result.isConfirmed) {
      try {
        await comprobanteService.anular(comp.id);
        await Swal.fire({
          icon: 'success',
          title: 'Comprobante Anulado',
          text: 'El comprobante ha sido anulado con éxito.',
          confirmButtonColor: '#2563eb',
        });
        await loadData();
      } catch (err) {
        await Swal.fire({
          icon: 'error',
          title: 'Error al anular',
          text: err instanceof Error ? err.message : 'No se pudo anular el comprobante.',
          confirmButtonColor: '#2563eb',
        });
      }
    }
  };

  const handleCreateComprobante = () => {
    let selectedTipo = 'FACTURA_VENTA';
    
    const updateTerceroOptions = (tipo: string) => {
      const select = document.getElementById('com-tercero-select') as HTMLSelectElement;
      if (!select) return;
      select.innerHTML = '';
      
      if (tipo === 'FACTURA_VENTA' || tipo === 'RECIBO') {
        clientes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id || c.uid;
          opt.textContent = c.nombre;
          select.appendChild(opt);
        });
      } else {
        proveedores.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.uid;
          opt.textContent = p.nombre_empresa;
          select.appendChild(opt);
        });
      }
    };

    void Swal.fire({
      title: 'Nuevo Comprobante Manual',
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px; display:grid; gap:12px;">
          <div>
            <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Tipo de Comprobante</label>
            <select id="com-tipo" class="swal2-input" style="width:100%; margin:0; box-sizing:border-box;">
              <option value="FACTURA_VENTA">Factura de Venta (CxC)</option>
              <option value="FACTURA_COMPRA">Factura de Compra (CxP)</option>
              <option value="RECIBO">Recibo (Cobro)</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Número de Comprobante</label>
            <input id="com-numero" type="text" class="swal2-input" placeholder="Ej: 0001-00028912" style="width:100%; margin:0; box-sizing:border-box;" />
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Tercero (Cliente / Proveedor)</label>
            <select id="com-tercero-select" class="swal2-input" style="width:100%; margin:0; box-sizing:border-box;">
              <!-- Se llena dinámicamente -->
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Fecha de Emisión</label>
              <input id="com-fecha-emision" type="date" class="swal2-input" value="${new Date().toISOString().split('T')[0]}" style="width:100%; margin:0; box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Fecha de Vencimiento</label>
              <input id="com-fecha-vence" type="date" class="swal2-input" value="${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}" style="width:100%; margin:0; box-sizing:border-box;" />
            </div>
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; margin-bottom:4px;">Importe Total ($)</label>
            <input id="com-total" type="number" step="0.01" class="swal2-input" placeholder="0.00" style="width:100%; margin:0; box-sizing:border-box;" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      background: '#ffffff',
      color: '#0f172a',
      didOpen: () => {
        const comTipo = document.getElementById('com-tipo') as HTMLSelectElement;
        updateTerceroOptions(selectedTipo);
        if (comTipo) {
          comTipo.addEventListener('change', (e) => {
            selectedTipo = (e.target as HTMLSelectElement).value;
            updateTerceroOptions(selectedTipo);
          });
        }
      },
      preConfirm: () => {
        const tipo = (document.getElementById('com-tipo') as HTMLSelectElement).value;
        const numero = (document.getElementById('com-numero') as HTMLInputElement).value.trim();
        const terceroSelect = document.getElementById('com-tercero-select') as HTMLSelectElement;
        const terceroId = terceroSelect.value;
        const terceroNombre = terceroSelect.options[terceroSelect.selectedIndex]?.text || '';
        const fechaEmision = (document.getElementById('com-fecha-emision') as HTMLInputElement).value;
        const fechaVence = (document.getElementById('com-fecha-vence') as HTMLInputElement).value;
        const total = parseFloat((document.getElementById('com-total') as HTMLInputElement).value);

        if (!numero) {
          Swal.showValidationMessage('El número de comprobante es requerido.');
          return false;
        }
        if (!terceroId) {
          Swal.showValidationMessage('El tercero es requerido.');
          return false;
        }
        if (!fechaEmision) {
          Swal.showValidationMessage('La fecha de emisión es requerida.');
          return false;
        }
        if (isNaN(total) || total <= 0) {
          Swal.showValidationMessage('El importe total debe ser un número mayor a 0.');
          return false;
        }

        const isPaymentOrReceipt = tipo === 'RECIBO' || tipo === 'PAGO';

        return {
          tipo,
          numero,
          tercero: terceroNombre,
          fecha_emision: fechaEmision,
          fecha_vencimiento: isPaymentOrReceipt ? null : (fechaVence || null),
          total,
          saldo: isPaymentOrReceipt ? 0 : total,
          estado: isPaymentOrReceipt ? 'PAGADO' : 'PENDIENTE',
          cliente_id: (tipo === 'FACTURA_VENTA' || tipo === 'RECIBO') ? terceroId : null,
          fecha_operacion: fechaEmision,
          estado_financiero: tipo === 'FACTURA_VENTA' ? 'PENDIENTE_COBRO' :
                             tipo === 'FACTURA_COMPRA' ? 'PENDIENTE_PAGO' :
                             tipo === 'RECIBO' ? 'COBRADO' : 'PAGADO',
        };
      }
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        try {
          console.log('Enviando payload a comprobanteService.create:', result.value);
          await comprobanteService.create(result.value);
          await Swal.fire({
            icon: 'success',
            title: 'Comprobante Registrado',
            text: 'El comprobante ha sido creado con éxito.',
            confirmButtonColor: '#2563eb',
          });
          await loadData();
        } catch (err: any) {
          console.error('Error al registrar comprobante:', err);
          const errorMsg = err.message || 'No se pudo crear el comprobante.';
          const errorDetail = err.details ? `Detalle: ${err.details}` : '';
          const errorHint = err.hint ? `Sugerencia: ${err.hint}` : '';
          await Swal.fire({
            icon: 'error',
            title: 'Error al registrar',
            html: `
              <div style="text-align:left;">
                <p><strong>${errorMsg}</strong></p>
                ${errorDetail ? `<p style="font-size:12px; margin-top:8px;">${errorDetail}</p>` : ''}
                ${errorHint ? `<p style="font-size:12px; color:#64748b; margin-top:4px;">${errorHint}</p>` : ''}
              </div>
            `,
            confirmButtonColor: '#2563eb',
          });
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Comprobantes y Facturación</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de facturas de compra/venta manuales, recibos y saldos de cuentas corrientes.</p>
        </div>
        <button
          id="btn-nuevo-comprobante"
          onClick={handleCreateComprobante}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          <FiPlus />
          Nuevo Comprobante
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cuentas por Cobrar (CxC)</p>
          <p className="mt-3 text-3xl font-black text-blue-700">{formatCurrency(totalCxC)}</p>
          <p className="mt-2 text-xs text-slate-500">Total facturado a clientes pendiente de cobro.</p>
        </Card>
        <Card className="flex flex-col p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cuentas por Pagar (CxP)</p>
          <p className="mt-3 text-3xl font-black text-orange-700">{formatCurrency(totalCxP)}</p>
          <p className="mt-2 text-xs text-slate-500">Total facturado por proveedores pendiente de pago.</p>
        </Card>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-buscar-comprobantes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número o tercero..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            id="select-filtro-tipo"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 outline-none shadow-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="FACTURA_VENTA">Factura Venta</option>
            <option value="FACTURA_COMPRA">Factura Compra</option>
            <option value="RECIBO">Recibo</option>
            <option value="PAGO">Pago</option>
          </select>
          <select
            id="select-filtro-estado"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 outline-none shadow-sm"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
            <option value="VENCIDO">Vencido</option>
            <option value="ANULADO">Anulado</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
          <FiAlertCircle className="shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <Card className="p-8 text-center text-slate-500">
          Cargando comprobantes...
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          No se encontraron comprobantes.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Número</th>
                  <th className="px-6 py-4">Tercero</th>
                  <th className="px-6 py-4 text-right">Importe</th>
                  <th className="px-6 py-4 text-right">Saldo</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginated.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-slate-600">
                      {formatDateDDMMYYYY(comp.fecha_emision)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge[comp.tipo]}`}>
                        {tipoLabel[comp.tipo] || comp.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {comp.numero || 'S/N'}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {comp.tercero || '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrency(comp.total)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">
                      {formatCurrency(comp.saldo)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${estadoBadge[comp.estado]}`}>
                        {comp.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {comp.estado !== 'ANULADO' && (
                        <button
                          id={`btn-anular-${comp.id}`}
                          onClick={() => handleAnular(comp)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <FiXCircle />
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50">
            <span className="text-xs text-slate-600 font-semibold">
              {filtered.length} comprobantes • Página {Math.min(currentPage, totalPages)} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                id="btn-prev-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                aria-label="Anterior"
              >
                <FiChevronLeft size={16} />
              </button>
              <button
                type="button"
                id="btn-next-page"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                aria-label="Siguiente"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ComprobantesPage;
