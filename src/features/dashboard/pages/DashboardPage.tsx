import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import type jsPDF from 'jspdf';
import { Card } from '../../../shared/components/card';
import { LoadingState } from '../../../shared/components/table';
import { ROUTES } from '../../../app/config/routes';
import { useAlertas } from '../../alertas/hooks/useAlertas';
import type { AlertaOperativa } from '../../alertas/types/alerta';
import { buildAlertCategoryHtml, isFinancialAlert, isProductAlert } from '../../alertas/utils/alertasClasificacion';
import { BrandLogo } from '../../../shared/components/BrandLogo';
import { useDashboardOperativo } from '../hooks/useDashboardOperativo';
import { ApiService } from '../../../infrastructure/api';
import { usePermissions } from '../../auth/usePermissions';
import type { Cliente } from '../../clientes/types/cliente';
import type { MovimientoStockPT } from '../../productos/types';
import type { OrdenProduccion } from '../../ordenes/types';
import OrdenExpedicionModal from '../../ordenes/components/OrdenExpedicionModal';
import { DataTable, EmptyState, StatusBadge, TableBody, TableCell, TableHeader, TableRow } from '../../../shared/components/table';
import {
  buildDashboardExecutiveInsights,
  getDashboardPeriodoLabel,
  isWithinDashboardPeriodo,
  type DashboardPeriodo,
} from '../utils/dashboardExecutiveInsights';
import { buildDashboardTemporalInsights, filterAlertasByPeriodo } from '../utils/dashboardTemporalInsights';
import { fmtARS, fmtDateTime, fmtRelativeMinutes, getTrendTone } from '../components/dashboardFormat';
import { formatDateDDMMYYYY } from '../../../shared/utils/formatters';
import { KPIBox } from '../components/dashboardShared';
import { supabaseClient } from '../../../infrastructure/api/supabase/client';
import { runtimeConfig } from '../../../infrastructure/api/runtimeConfig';

type BusinessHealthLevel = 'excelente' | 'estable' | 'atencion' | 'critico';

const healthMeta: Record<BusinessHealthLevel, { label: string; className: string; accent: string }> = {
  excelente: { label: 'Salud excelente', className: 'text-emerald-700', accent: 'from-emerald-500 to-cyan-500' },
  estable: { label: 'Salud estable', className: 'text-cyan-700', accent: 'from-cyan-500 to-blue-500' },
  atencion: { label: 'Salud con atención', className: 'text-amber-700', accent: 'from-amber-500 to-orange-500' },
  critico: { label: 'Salud crítica', className: 'text-rose-700', accent: 'from-rose-500 to-red-500' },
};

const addPdfSectionTitle = (doc: jsPDF, title: string, y: number) => {
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, y);
  return y + 6;
};

const addPdfLine = (doc: jsPDF, label: string, value: string, y: number, valueX = 82) => {
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(label, 14, y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  const wrapped = doc.splitTextToSize(value, 110);
  doc.text(wrapped, valueX, y);
  return y + Math.max(6, wrapped.length * 4.5);
};

const buildAlertRanking = (alertas: AlertaOperativa[], periodo: DashboardPeriodo, now: Date, limit: number) => {
  const priorityScore = (priority: string) => (priority === 'critica' ? 3 : priority === 'media' ? 2 : 1);
  const stateScore = (state: string) => (state === 'pendiente' ? 3 : state === 'en seguimiento' ? 2 : state === 'atendida' ? 1 : 0);

  return filterAlertasByPeriodo([...alertas], periodo, now)
    .filter((a) => a.estado !== 'atendida' && a.estado !== 'descartada')
    .sort((a, b) => {
      const priorityDelta = priorityScore(b.prioridad) - priorityScore(a.prioridad);
      if (priorityDelta !== 0) return priorityDelta;
      return stateScore(b.estado) - stateScore(a.estado);
    })
    .slice(0, limit);
};

const PERIODOS: DashboardPeriodo[] = ['HOY', 'SEMANA', 'MES', 'NEXT_7', 'NEXT_30'];

export const DashboardPage = () => {
  const { summary, alertas, loadError: alertasLoadError } = useAlertas();
  const { kpis, consumoMensual, stockResumenes, ptInsights, expedicionInsights, loading, reload, lastUpdatedAt, loadError: dashboardLoadError } = useDashboardOperativo();
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientosPT, setMovimientosPT] = useState<MovimientoStockPT[]>([]);
  const [periodo, setPeriodo] = useState<DashboardPeriodo>('MES');
  const [isExpedicionOpen, setIsExpedicionOpen] = useState(false);
  const { canAccess } = usePermissions();
  const canCreateExpedition = canAccess('ordenes', 'create');
  const navigate = useNavigate();
  const dashboardNow = useMemo(() => new Date(), []);
  const updatedAtLabel = useMemo(() => fmtDateTime(lastUpdatedAt), [lastUpdatedAt]);
  const relativeUpdatedLabel = useMemo(() => fmtRelativeMinutes(lastUpdatedAt), [lastUpdatedAt]);
  const periodoLabel = useMemo(() => getDashboardPeriodoLabel(periodo), [periodo]);
  const criticalAlerts = useMemo(() => alertas.filter((a) => a.prioridad === 'critica' && a.estado !== 'atendida'), [alertas]);
  const productCriticalAlerts = useMemo(() => criticalAlerts.filter(isProductAlert), [criticalAlerts]);
  const financialCriticalAlerts = useMemo(() => criticalAlerts.filter(isFinancialAlert), [criticalAlerts]);

  const [movimientosFlujo, setMovimientosFlujo] = useState<any[]>([]);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [stockLotesMP, setStockLotesMP] = useState<any[]>([]);
  const [stockPT, setStockPT] = useState<any[]>([]);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [ordenesResult, clientesResult, movimientosResult] = await Promise.all([
          ApiService.ordenes.getAll(),
          ApiService.clientes.getAll(),
          ApiService.stockPT.getMovimientos(),
        ]);
        setOrdenes(ordenesResult);
        setClientes(clientesResult);
        setMovimientosPT(movimientosResult);

        const mode = runtimeConfig.mode;
        if (mode === 'supabase') {
          const [flujoRes, compRes, stockLotesRes, stockPtRes] = await Promise.all([
            supabaseClient.from('flujo_caja_movimientos').select('fecha,created_at,tipo,monto,origen_operativo,estado').is('deleted_at', null).eq('estado', 'CONFIRMADO'),
            supabaseClient.from('comprobantes').select('fecha_emision,created_at,tipo,total,saldo').is('deleted_at', null),
            supabaseClient.from('stock_lotes_mp').select('cantidad_actual,costo_unitario').is('deleted_at', null),
            supabaseClient.from('stock_pt').select('costo_total').is('deleted_at', null),
          ]);
          if (flujoRes.data) setMovimientosFlujo(flujoRes.data);
          if (compRes.data) setComprobantes(compRes.data);
          if (stockLotesRes.data) setStockLotesMP(stockLotesRes.data);
          if (stockPtRes.data) setStockPT(stockPtRes.data);
        } else {
          // Fallback mock data
          setMovimientosFlujo([
            { fecha: new Date().toISOString(), tipo: 'INGRESO', monto: 1200000, origen_operativo: 'VENTA_PT', estado: 'CONFIRMADO' },
            { fecha: new Date().toISOString(), tipo: 'EGRESO', monto: 800000, origen_operativo: 'PAGO', estado: 'CONFIRMADO' },
          ]);
          setComprobantes([
            { fecha_emision: new Date().toISOString(), tipo: 'FACTURA_VENTA', total: 1200000, saldo: 400000 }
          ]);
        }
      } catch (e) {
        console.error('Error loading dashboard page data:', e);
      }
    };
    void loadAllData();
  }, []);

  useEffect(() => {
    const seenKey = 'nutribalance_alerts_seen_session';
    if (sessionStorage.getItem(seenKey) === 'true') return;
    if (criticalAlerts.length === 0) return;
    sessionStorage.setItem(seenKey, 'true');
    void Swal.fire({
      title: 'Atención requerida',
      html: `
        <div style="margin-top:6px;color:#64748b;font-size:14px;line-height:1.6;">
          Se detectaron alertas críticas que requieren seguimiento.
        </div>
        <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:14px;">
          ${buildAlertCategoryHtml(
            'Productos y operación',
            'Incluye stock, producción, lotes, inventario, insumos, producto terminado y trazabilidad operativa.',
            productCriticalAlerts,
            'red',
          )}
          ${buildAlertCategoryHtml(
            'Financieras',
            'Incluye flujo de caja, tesorería, cuentas por cobrar y pagar, costos, ingresos y finanzas.',
            financialCriticalAlerts,
            'amber',
          )}
        </div>
      `,
      background: '#ffffff',
      color: '#0f172a',
      width: 'min(1040px, calc(100vw - 24px))',
      padding: '0',
      showCloseButton: true,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Ver alertas operativas',
      denyButtonText: 'Ver alertas financieras',
      cancelButtonText: 'Continuar al panel',
      customClass: {
        popup: 'rounded-[28px] border border-amber-200 shadow-[0_30px_90px_rgba(15,23,42,.18)] overflow-hidden',
        htmlContainer: 'mx-0 px-5 pb-5',
        title: 'pt-6 px-5 text-left text-2xl font-black text-slate-900',
        actions: 'px-5 pb-5 justify-end gap-3',
        confirmButton: 'rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold',
        denyButton: 'rounded-full bg-amber-600 px-4 py-2.5 text-sm font-semibold',
        cancelButton: 'rounded-full bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700',
        closeButton: 'text-slate-400 hover:text-slate-600',
      },
      didOpen: () => {
        const popup = document.querySelector('.swal2-popup');
        if (popup) {
          popup.setAttribute('style', `${popup.getAttribute('style') ?? ''} border-top: 6px solid #ef4444;`);
        }
      },
    }).then((r) => {
      if (r.isConfirmed) navigate(ROUTES.ALERTAS);
      if (r.isDenied) navigate(ROUTES.TESORERIA);
    });
  }, [criticalAlerts.length, financialCriticalAlerts, navigate, productCriticalAlerts]);

  const consumoTop = useMemo(() => {
    const map = new Map<string, number>();
    consumoMensual.forEach((c) => map.set(c.insumo, (map.get(c.insumo) ?? 0) + c.consumo_kg));
    const arr = [...map.entries()].map(([insumo, total]) => ({ insumo, total }));
    const max = Math.max(1, ...arr.map((x) => x.total));
    return arr.sort((a, b) => b.total - a.total).slice(0, 6).map((x) => ({ ...x, pct: (x.total / max) * 100 }));
  }, [consumoMensual]);

  const consumoLine = useMemo(() => {
    const map = new Map<string, number>();
    consumoMensual.forEach((c) => {
      map.set(c.mes, (map.get(c.mes) ?? 0) + c.consumo_kg);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([mes, total]) => ({ mes, value: total }));
  }, [consumoMensual]);

  const stockMpResumen = stockResumenes.stockMateriaPrima;
  const stockPtResumen = stockResumenes.stockProductoTerminado;
  const stockMpTop = useMemo(() => {
    return [...stockMpResumen]
      .sort((a, b) => b.stock_actual - a.stock_actual)
      .slice(0, 6);
  }, [stockMpResumen]);
  const stockMpMax = Math.max(1, ...stockMpTop.map((item) => item.stock_actual));

  const estadoMateriaPrima = useMemo(() => {
    const total = Math.max(1, kpis.stock_total_mp);
    const comprometido = Math.max(0, Math.min(kpis.stock_comprometido_mp, total));
    const disponible = Math.max(0, Math.min(kpis.stock_disponible_mp, total));
    const committedPct = Math.max(0, Math.min(100, (comprometido / total) * 100));
    const availablePct = Math.max(0, Math.min(100, (disponible / total) * 100));

    return [
      { label: 'Comprometido', value: comprometido, pct: committedPct, color: 'bg-orange-500' },
      { label: 'Disponible', value: disponible, pct: availablePct, color: 'bg-emerald-500' },
    ];
  }, [kpis.stock_comprometido_mp, kpis.stock_disponible_mp, kpis.stock_total_mp]);

  const ptRanking = useMemo(() => {
    return [...stockPtResumen]
      .sort((a, b) => b.stock_actual - a.stock_actual)
      .slice(0, 10);
  }, [stockPtResumen]);

  const executiveMovimientos = useMemo(() => {
    return movimientosPT.filter((mov) => isWithinDashboardPeriodo(mov.created_at, periodo, dashboardNow));
  }, [dashboardNow, movimientosPT, periodo]);

  const executiveInsights = useMemo(
    () => buildDashboardExecutiveInsights(executiveMovimientos, clientes, periodo, dashboardNow),
    [clientes, dashboardNow, executiveMovimientos, periodo],
  );

  const temporalInsights = useMemo(
    () => buildDashboardTemporalInsights(ordenes, movimientosPT, alertas, periodo, dashboardNow, movimientosFlujo, comprobantes, stockLotesMP, stockPT),
    [alertas, dashboardNow, movimientosPT, ordenes, periodo, movimientosFlujo, comprobantes, stockLotesMP, stockPT],
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const proximasCobranzas = useMemo(() => {
    const list: any[] = [];
    comprobantes.forEach((c) => {
      if (c.tipo === 'FACTURA_VENTA' && ['PENDIENTE', 'PENDIENTE_COBRO'].includes(c.estado_financiero || c.estado)) {
        const dateStr = c.fecha_vencimiento || c.created_at;
        if (dateStr && dateStr.split('T')[0] >= todayStr) {
          list.push({
            id: c.id,
            tercero: c.tercero || 'Venta PT',
            fecha: dateStr.split('T')[0],
            monto: Number(c.saldo),
            tipo: 'COBRO',
            comprobante: c.numero || 'Factura',
          });
        }
      }
    });
    return list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [comprobantes, todayStr]);

  const proximosPagos = useMemo(() => {
    const list: any[] = [];
    comprobantes.forEach((c) => {
      if (c.tipo === 'FACTURA_COMPRA' && ['PENDIENTE', 'PENDIENTE_PAGO'].includes(c.estado_financiero || c.estado)) {
        const dateStr = c.fecha_vencimiento || c.created_at;
        if (dateStr && dateStr.split('T')[0] >= todayStr) {
          list.push({
            id: c.id,
            tercero: c.tercero || 'Compra MP',
            fecha: dateStr.split('T')[0],
            monto: Number(c.saldo),
            tipo: 'PAGO',
            comprobante: c.numero || 'Factura',
          });
        }
      }
    });
    return list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [comprobantes, todayStr]);

  const vencidosList = useMemo(() => {
    const list: any[] = [];
    comprobantes.forEach((c) => {
      const isPending = ['PENDIENTE', 'PENDIENTE_COBRO', 'PENDIENTE_PAGO', 'VENCIDO'].includes(c.estado_financiero || c.estado);
      if (isPending) {
        const dateStr = c.fecha_vencimiento || c.created_at;
        if (dateStr && dateStr.split('T')[0] < todayStr) {
          list.push({
            id: c.id,
            tercero: c.tercero || (c.tipo === 'FACTURA_VENTA' ? 'Venta PT' : 'Compra MP'),
            fecha: dateStr.split('T')[0],
            monto: Number(c.saldo),
            tipo: c.tipo === 'FACTURA_VENTA' ? 'COBRO' : 'PAGO',
            comprobante: c.numero || 'Factura',
          });
        }
      }
    });
    return list.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [comprobantes, todayStr]);

  const ordenesRecientes = useMemo(
    () => ordenes.filter((orden) => isWithinDashboardPeriodo(orden.fecha_creacion, periodo, dashboardNow)),
    [dashboardNow, ordenes, periodo],
  );

  const recientes = useMemo(
    () => ordenesRecientes
      .slice()
      .sort((a, b) => +new Date(b.fecha_creacion) - +new Date(a.fecha_creacion))
      .slice(0, 5),
    [ordenesRecientes],
  );

  const handleExportPdf = () => {
    void import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      let cursorY = 16;
      const addPageIfNeeded = (needed = 12) => {
        if (cursorY + needed < height - 12) return;
        doc.addPage();
        cursorY = 16;
      };
      const advance = (nextY: number) => {
        cursorY = nextY;
        return cursorY;
      };
      const writeSectionTitle = (title: string) => {
        cursorY = addPdfSectionTitle(doc, title, cursorY);
      };
      const writeLine = (label: string, value: string, valueX?: number) => {
        cursorY = addPdfLine(doc, label, value, cursorY, valueX);
      };

      doc.setFillColor(14, 165, 233);
      doc.rect(0, 0, width, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('NutriBalance', 14, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Dashboard Ejecutivo', 14, 20);
      doc.text(`Generado: ${formatDateDDMMYYYY(new Date())}`, width - 14, 20, { align: 'right' });

      cursorY = 32;
      addPageIfNeeded(36);
      writeSectionTitle('Producción');
      writeLine('Órdenes pendientes', `${kpis.ordenes_pendientes}`);
      writeLine('Órdenes en proceso', `${kpis.ordenes_en_proceso}`);
      writeLine('Órdenes finalizadas', `${kpis.ordenes_finalizadas}`);
      writeLine('Producción total', `${kpis.produccion_total.toLocaleString('es-AR')} kg`);
      writeLine('Merma total', `${kpis.merma_total.toLocaleString('es-AR')} kg`);

      cursorY = advance(cursorY + 2);
      addPageIfNeeded(30);
      writeSectionTitle('Inventario');
      writeLine('Stock físico MP', `${kpis.stock_total_mp.toLocaleString('es-AR')} kg`);
      writeLine('Stock comprometido MP', `${kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg`);
      writeLine('Stock disponible MP', `${kpis.stock_disponible_mp.toLocaleString('es-AR')} kg`);
      writeLine('Lotes críticos', `${kpis.stock_critico}`);
      writeLine('Stock PT total', `${kpis.stock_total_pt.toLocaleString('es-AR')} kg`);
      writeLine('Valor inventario PT', valorInventarioPtLabel);

      cursorY = advance(cursorY + 2);
      addPageIfNeeded(30);
      writeSectionTitle('Finanzas');
      writeLine('Egresos', fmtARS(temporalInsights.costos));
      writeLine('Ingresos', fmtARS(temporalInsights.ingresos));
      writeLine('Flujo de caja', fmtARS(temporalInsights.flujoCaja));
      writeLine('Proteína promedio fórmula', `${kpis.proteina_promedio_formula.toFixed(2)}%`);

      cursorY = advance(cursorY + 2);
      addPageIfNeeded(30);
      writeSectionTitle('Alertas Operativas');
      writeLine('Alertas activas', `${temporalInsights.alertas.length}`);
      writeLine('Pendientes', `${summary.pendientes}`);
      writeLine('Críticas activas', `${summary.criticas}`);
      writeLine('En seguimiento', `${summary.seguimiento}`);

      cursorY = advance(cursorY + 2);
      addPageIfNeeded(24);
      writeSectionTitle('Periodo y actualización');
      writeLine('Periodo actual', periodoLabel);
      writeLine('Última actualización', updatedAtLabel);
      writeLine('Antigüedad', relativeUpdatedLabel);

      doc.save(`dashboard-ejecutivo-${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  };

  const alertasTop = useMemo(() => buildAlertRanking(alertas, periodo, dashboardNow, 3), [alertas, dashboardNow, periodo]);

  const top5Alertas = useMemo(() => buildAlertRanking(alertas, periodo, dashboardNow, 5), [alertas, dashboardNow, periodo]);

  const businessHealth = useMemo(() => {
    const scoreParts = [
      kpis.ordenes_pendientes === 0 ? 18 : Math.max(0, 18 - kpis.ordenes_pendientes * 3),
      kpis.stock_critico === 0 ? 18 : Math.max(0, 18 - kpis.stock_critico * 4),
      temporalInsights.flujoCaja >= 0 ? 22 : Math.max(0, 22 + Math.max(-22, temporalInsights.flujoCaja / 100000)),
      summary.criticas === 0 ? 20 : Math.max(0, 20 - summary.criticas * 4),
      summary.pendientes === 0 ? 12 : Math.max(0, 12 - summary.pendientes * 2),
      kpis.proteina_promedio_formula >= 18 ? 10 : Math.max(0, (kpis.proteina_promedio_formula / 18) * 10),
    ];
    const score = Math.max(0, Math.min(100, Math.round(scoreParts.reduce((acc, item) => acc + item, 0))));
    const level: BusinessHealthLevel = score >= 82 ? 'excelente' : score >= 65 ? 'estable' : score >= 45 ? 'atencion' : 'critico';
    return {
      score,
      level,
      alerts: top5Alertas.length,
      productionRisk: kpis.ordenes_pendientes > kpis.ordenes_finalizadas ? 'Producción con más pendiente que cierre reciente.' : 'Producción bajo control relativo.',
      inventoryRisk: kpis.stock_critico > 0 ? `${kpis.stock_critico} lotes en condición crítica.` : 'Inventario sin lotes críticos activos.',
      financeRisk: temporalInsights.flujoCaja < 0 ? 'Flujo de caja negativo en el período actual.' : 'Flujo de caja positivo o balanceado.',
      alertRisk: summary.criticas > 0 ? `${summary.criticas} alertas críticas requieren atención.` : 'Sin alertas críticas activas.',
    };
  }, [kpis.ordenes_finalizadas, kpis.ordenes_pendientes, kpis.proteina_promedio_formula, kpis.stock_critico, summary.criticas, summary.pendientes, temporalInsights.flujoCaja, top5Alertas.length]);

  const resumenEjecutivo = useMemo(() => {
    const statements: string[] = [];
    statements.push(
      `Salud general ${healthMeta[businessHealth.level].label.toLowerCase()} con ${businessHealth.score}/100 puntos.`,
    );
    if (temporalInsights.flujoCaja >= 0) {
      statements.push(`El flujo de caja se mantiene positivo en ${fmtARS(Math.abs(temporalInsights.flujoCaja))}.`);
    } else {
      statements.push(`El flujo de caja está por debajo de cero en ${fmtARS(Math.abs(temporalInsights.flujoCaja))}.`);
    }
    if (kpis.stock_critico > 0) {
      statements.push(`Hay ${kpis.stock_critico} lotes críticos que pueden afectar continuidad operativa.`);
    } else {
      statements.push('No se observan lotes críticos en el inventario de materia prima.');
    }
    if (summary.criticas > 0) {
      statements.push(`Se detectaron ${summary.criticas} alertas críticas abiertas.`);
    } else {
      statements.push('No hay alertas críticas abiertas en el período vigente.');
    }
    return statements.join(' ');
  }, [businessHealth.level, businessHealth.score, kpis.stock_critico, summary.criticas, temporalInsights.flujoCaja]);

  const formatDatoAsociado = (dato: Record<string, unknown>) => {
    const parts: string[] = [];
    if (typeof dato.insumo === 'string' && dato.insumo.trim()) parts.push(dato.insumo);
    if (typeof dato.producto === 'string' && dato.producto.trim()) parts.push(dato.producto);
    if (typeof dato.lote === 'string' && dato.lote.trim()) parts.push(`Lote ${dato.lote}`);
    if (typeof dato.orden === 'string' && dato.orden.trim()) parts.push(`OP ${dato.orden}`);
    if (typeof dato.disponible_kg === 'number') parts.push(`Disponible ${dato.disponible_kg.toLocaleString('es-AR')} kg`);
    if (typeof dato.umbral_kg === 'number') parts.push(`Umbral ${dato.umbral_kg.toLocaleString('es-AR')} kg`);
    if (typeof dato.cantidad_objetivo === 'number') parts.push(`Objetivo ${dato.cantidad_objetivo.toLocaleString('es-AR')} kg`);
    return parts.length > 0 ? parts.join(' · ') : 'Sin dato asociado';
  };

  const valorInventarioPtLabel = kpis.stock_total_pt > 0
    ? (kpis.valor_inventario_pt > 0 ? fmtARS(kpis.valor_inventario_pt) : 'Sin costo confiable')
    : 'Sin stock PT';

  const productionTrend = useMemo(() => getTrendTone(kpis.produccion_total, undefined), [kpis.produccion_total]);
  const inventoryTrend = useMemo(() => getTrendTone(kpis.stock_total_mp + kpis.stock_total_pt, undefined), [kpis.stock_total_mp, kpis.stock_total_pt]);
  const financeTrend = useMemo(() => getTrendTone(temporalInsights.ingresos - temporalInsights.costos, undefined), [temporalInsights.ingresos, temporalInsights.costos]);
  const alertsTrend = useMemo(() => getTrendTone(alertasTop.length, undefined, false), [alertasTop.length]);
  const dashboardErrors = [dashboardLoadError, alertasLoadError].filter((error): error is string => Boolean(error));

  if (!loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Ejecutivo</p>
              <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Dirección</h1>
              <p className="text-sm text-slate-500 mt-2">Respuesta rápida sobre la salud del negocio hoy, con vista resumida de producción, inventario y finanzas.</p>
            </div>
            <BrandLogo variant="full" className="max-w-[280px] self-start md:self-center" />
          </div>
        </Card>

        {dashboardErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {dashboardErrors.length === 1 ? dashboardErrors[0] : 'Algunas secciones del dashboard no pudieron actualizarse.'}
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-r ${healthMeta[businessHealth.level].accent}`} />
          <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Salud General del Negocio</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">Lectura ejecutiva automática</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">Indicador consolidado calculado a partir de producción, inventario, finanzas y alertas operativas.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Puntaje</p>
                  <p className={`mt-1 text-4xl font-black ${healthMeta[businessHealth.level].className}`}>{businessHealth.score}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Estado general</p>
                  <p className={`mt-2 text-xl font-black ${healthMeta[businessHealth.level].className}`}>{healthMeta[businessHealth.level].label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{resumenEjecutivo}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Factores de riesgo</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>{businessHealth.productionRisk}</li>
                    <li>{businessHealth.inventoryRisk}</li>
                    <li>{businessHealth.financeRisk}</li>
                    <li>{businessHealth.alertRisk}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <KPIBox label="Órdenes pendientes" value={`${kpis.ordenes_pendientes}`} trend={productionTrend} updatedAt={updatedAtLabel} tone="cyan" />
              <KPIBox label="Stock crítico" value={`${kpis.stock_critico}`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="red" />
              <KPIBox label="Flujo de caja" value={fmtARS(temporalInsights.flujoCaja)} trend={financeTrend} updatedAt={updatedAtLabel} tone={temporalInsights.flujoCaja >= 0 ? 'cyan' : 'red'} />
              <KPIBox label="Clientes atendidos" value={`${executiveInsights.topClientesPorVolumen.length}`} trend={alertsTrend} updatedAt={updatedAtLabel} tone="fuchsia" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold">Resumen Ejecutivo automático</h3>
              <p className="text-xs text-slate-500">Generado localmente desde los KPIs actuales, sin servicios externos.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600">{periodoLabel}</span>
          </div>
          <p className="text-sm leading-6 text-slate-700">{resumenEjecutivo}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold">Top alertas críticas</h3>
              <p className="text-xs text-slate-500">Alertas priorizadas por impacto operativo dentro del período seleccionado.</p>
            </div>
            <Link to={ROUTES.ALERTAS} className="text-sm font-semibold text-red-700 hover:text-red-800">Ir a alertas</Link>
          </div>
          {top5Alertas.length === 0 ? <p className="text-sm text-slate-700">No hay alertas operativas activas en este momento.</p> : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {top5Alertas.map((alerta, idx) => (
                <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">#{idx + 1}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">{alerta.titulo}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (loading && stockResumenes.stockMateriaPrima.length === 0 && stockResumenes.stockProductoTerminado.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Ejecutivo</p>
          <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Dirección</h1>
          <p className="text-sm text-slate-500 mt-2">Consolidado de Producción, Inventario, Finanzas y Alertas Operativas.</p>
        </Card>
        <LoadingState label="Cargando dashboard consolidado..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Dashboard Ejecutivo</p>
            <h1 className="text-3xl font-black mt-1">Centro Ejecutivo de Dirección</h1>
            <p className="text-sm text-slate-500 mt-2">Vista consolidada de Producción, Inventario, Finanzas y Alertas Operativas.</p>
          </div>
          <BrandLogo variant="full" className="max-w-[280px] self-start md:self-center" />
        </div>
      </Card>

      {dashboardErrors.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dashboardErrors.length === 1 ? dashboardErrors[0] : 'Algunas secciones del dashboard no pudieron actualizarse.'}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${healthMeta[businessHealth.level].accent}`} />
        <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Salud General del Negocio</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">Lectura ejecutiva automática</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Indicador consolidado calculado a partir de producción, inventario, finanzas y alertas operativas.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Puntaje</p>
                <p className={`mt-1 text-4xl font-black ${healthMeta[businessHealth.level].className}`}>{businessHealth.score}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">sobre 100</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Estado general</p>
                <p className={`mt-2 text-xl font-black ${healthMeta[businessHealth.level].className}`}>{healthMeta[businessHealth.level].label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{resumenEjecutivo}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Factores de riesgo</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>{businessHealth.productionRisk}</li>
                  <li>{businessHealth.inventoryRisk}</li>
                  <li>{businessHealth.financeRisk}</li>
                  <li>{businessHealth.alertRisk}</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <KPIBox label="Órdenes pendientes" value={`${kpis.ordenes_pendientes}`} trend={productionTrend} updatedAt={updatedAtLabel} tone="cyan" />
            <KPIBox label="Stock crítico" value={`${kpis.stock_critico}`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="red" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold">Resumen Ejecutivo automático</h3>
            <p className="text-xs text-slate-500">Generado localmente desde los KPIs actuales, sin servicios externos.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
            {periodoLabel}
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-700">{resumenEjecutivo}</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold">Top 5 Alertas</h3>
            <p className="text-xs text-slate-500">Alertas priorizadas por impacto operativo dentro del período seleccionado.</p>
          </div>
          <Link to={ROUTES.ALERTAS} className="text-sm font-semibold text-red-700 hover:text-red-800">
            Ir a alertas
          </Link>
        </div>
        {top5Alertas.length === 0 ? (
          <p className="text-sm text-slate-700">No hay alertas operativas activas en este momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {top5Alertas.map((alerta, idx) => (
              <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">#{idx + 1}</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{alerta.titulo}</p>
                    <p className="mt-1 text-xs text-slate-500">{alerta.area.toUpperCase()} · {alerta.estado}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-widest ${
                    alerta.prioridad === 'critica'
                      ? 'bg-red-100 text-red-700'
                      : alerta.prioridad === 'media'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {alerta.prioridad}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{formatDatoAsociado(alerta.datoAsociado as Record<string, unknown>)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Dashboard ejecutivo</p>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Ventas y clientes por período</h2>
            <p className="text-sm text-slate-500 mt-2">La vista se actualiza con datos reales de salidas de PT, clientes y stock.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriodo(item)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
                  periodo === item
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getDashboardPeriodoLabel(item)}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-slate-800"
            >
              Exportar PDF
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Periodo actual</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{periodoLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Última actualización</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{updatedAtLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{relativeUpdatedLabel}</p>
            </div>
          </div>
        </div>
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Producción</h2>
            <p className="text-sm text-slate-500">Fabricación, despachos y movimiento operativo del período.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPIBox label="Órdenes pendientes" value={`${kpis.ordenes_pendientes}`} trend={productionTrend} updatedAt={updatedAtLabel} tone="cyan" />
            <KPIBox label="Órdenes en proceso" value={`${kpis.ordenes_en_proceso}`} trend={productionTrend} updatedAt={updatedAtLabel} tone="cyan" />
            <KPIBox label="Órdenes finalizadas" value={`${kpis.ordenes_finalizadas}`} trend={productionTrend} updatedAt={updatedAtLabel} tone="emerald" />
            <KPIBox label="Producción total" value={`${kpis.produccion_total.toLocaleString('es-AR')} kg`} trend={productionTrend} updatedAt={updatedAtLabel} tone="emerald" helper={`Merma total: ${kpis.merma_total.toLocaleString('es-AR')} kg`} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card>
              <h3 className="font-semibold mb-3">Ventas por producto terminado</h3>
              <p className="text-xs text-slate-500 mb-3">Monto y kg vendidos en {executiveInsights.periodoLabel.toLowerCase()}.</p>
              {executiveInsights.ventasPorProducto.length === 0 ? (
                <p className="text-sm text-slate-500">Sin ventas de producto terminado.</p>
              ) : (
                <div className="space-y-3">
                  {executiveInsights.ventasPorProducto.map((item, idx) => {
                    const max = Math.max(1, executiveInsights.ventasPorProducto[0]?.importe ?? 1);
                    const width = Math.max(8, (item.importe / max) * 100);
                    return (
                      <div key={`${item.producto_id ?? item.producto_nombre}-${idx}`} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.producto_nombre}</p>
                            <p className="text-slate-500">{item.kg.toLocaleString('es-AR')} kg · {item.clientes_atendidos} clientes</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-emerald-700">{fmtARS(item.importe)}</p>
                            <p className="text-slate-500">{item.movimientos} movimientos</p>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold mb-3">Kg despachados por producto</h3>
              <p className="text-xs text-slate-500 mb-3">Volumen total de salidas de PT en el período.</p>
              {executiveInsights.kgDespachadosPorProducto.length === 0 ? (
                <p className="text-sm text-slate-500">Sin despachos de producto terminado.</p>
              ) : (
                <div className="space-y-3">
                  {executiveInsights.kgDespachadosPorProducto.map((item, idx) => {
                    const max = Math.max(1, executiveInsights.kgDespachadosPorProducto[0]?.kg ?? 1);
                    const width = Math.max(8, (item.kg / max) * 100);
                    return (
                      <div key={`${item.producto_id ?? item.producto_nombre}-${idx}`} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.producto_nombre}</p>
                            <p className="text-slate-500">{item.movimientos} salidas · Último {item.ultima_fecha ? formatDateDDMMYYYY(item.ultima_fecha) : 'Sin dato'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-cyan-700">{item.kg.toLocaleString('es-AR')} kg</p>
                            <p className="text-slate-500">{fmtARS(item.importe)}</p>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold mb-3">Top clientes por volumen</h3>
              <p className="text-xs text-slate-500 mb-3">Ranking de clientes por kg despachados.</p>
              {executiveInsights.topClientesPorVolumen.length === 0 ? (
                <p className="text-sm text-slate-500">Sin volumen para mostrar.</p>
              ) : (
                <div className="space-y-2">
                  {executiveInsights.topClientesPorVolumen.map((item, idx) => {
                    const max = Math.max(1, executiveInsights.topClientesPorVolumen[0]?.kg ?? 1);
                    const width = Math.max(8, (item.kg / max) * 100);
                    return (
                      <div key={`${item.cliente_id ?? item.cliente_nombre}-${idx}`} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.cliente_nombre}</p>
                            <p className="text-slate-500">{item.movimientos} salidas · {fmtARS(item.importe)}</p>
                          </div>
                          <p className="font-semibold text-fuchsia-700 shrink-0">{item.kg.toLocaleString('es-AR')} kg</p>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </section>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Egresos</p>
            <p className="mt-2 text-3xl font-black text-orange-500">{fmtARS(temporalInsights.costos)}</p>
            <p className="mt-2 text-xs text-slate-500">Egresos de caja en {periodoLabel.toLowerCase()}.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Ingresos</p>
            <p className="mt-2 text-3xl font-black text-emerald-500">{fmtARS(temporalInsights.ingresos)}</p>
            <p className="mt-2 text-xs text-slate-500">Ingresos de caja en {periodoLabel.toLowerCase()}.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Flujo de caja</p>
            <p className={`mt-2 text-3xl font-black ${temporalInsights.flujoCaja >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
              {fmtARS(temporalInsights.flujoCaja)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ingresos menos egresos del período.</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-widest text-slate-500">Alertas</p>
            <p className="mt-2 text-3xl font-black text-fuchsia-600">{temporalInsights.alertas.length}</p>
            <p className="mt-2 text-xs text-slate-500">Alertas operativas dentro de {periodoLabel.toLowerCase()}.</p>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Inventario</h2>
          <p className="text-sm text-slate-500">Materia prima y producto terminado con consolidado operativo.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Stock físico MP" value={`${kpis.stock_total_mp.toLocaleString('es-AR')} kg`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="cyan" />
          <KPIBox label="Stock comprometido MP" value={`${kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="orange" />
          <KPIBox label="Stock disponible MP" value={`${kpis.stock_disponible_mp.toLocaleString('es-AR')} kg`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="emerald" />
          <KPIBox label="Lotes críticos" value={`${kpis.stock_critico}`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="red" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPIBox label="Stock PT total" value={`${kpis.stock_total_pt.toLocaleString('es-AR')} kg`} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="fuchsia" />
          <KPIBox label="Valor inventario PT" value={valorInventarioPtLabel} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="violet" helper="Suma de costo_total de stock_pt." />
          <KPIBox label="Valor inventario MP" value={fmtARS(kpis.valor_inventario_mp)} trend={inventoryTrend} updatedAt={updatedAtLabel} tone="emerald" helper="Suma de cantidad_actual * costo_unitario de stock_lotes_mp." />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Stock real por materia prima</h3>
            <p className="text-xs text-slate-500 mb-3">Top insumos por stock físico real, consolidado desde `stock_mp_resumen`.</p>
            {stockMpTop.length === 0 ? (
              <div className="h-48 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin stock de materia prima disponible todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {stockMpTop.map((item, idx) => {
                  const width = Math.max(8, (item.stock_actual / stockMpMax) * 100);
                  return (
                    <div key={item.insumo_id} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.nombre_insumo}</p>
                          <p className="text-slate-500">
                            Disponible {item.stock_disponible.toLocaleString('es-AR')} kg · Comprometido {item.stock_comprometido.toLocaleString('es-AR')} kg
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-cyan-700">{item.stock_actual.toLocaleString('es-AR')} kg</p>
                          <p className="text-slate-400 uppercase tracking-widest text-[10px]">#{idx + 1}</p>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 transition-all duration-300"
                          style={{ width: `${width}%` }}
                          title={`${item.nombre_insumo}: ${item.stock_actual.toLocaleString('es-AR')} kg`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Consumo mensual por insumo</h3>
            {consumoTop.length === 0 ? <p className="text-sm text-slate-700">Sin consumo mensual disponible todavía.</p> : (
            <div className="space-y-2">
              {consumoTop.map((c) => (
                <div key={c.insumo}>
                  <div className="flex justify-between text-xs"><span>{c.insumo}</span><span>{c.total.toLocaleString('es-AR')} kg</span></div>
                  <div className="h-2 bg-slate-200 rounded-full"><div className="h-2 bg-cyan-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${c.pct}%` }} /></div>
                </div>
              ))}
            </div>)}
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">Consumo mensual total de MP</h3>
            {consumoLine.length === 0 ? <p className="text-sm text-slate-700">Sin histórico suficiente para graficar consumo.</p> : (
            <div className="flex items-end gap-2 h-44">
              {consumoLine.map((p) => (
                <div key={p.mes} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full max-w-8 bg-emerald-500/70 rounded-t" style={{ height: `${Math.max(8, p.value / Math.max(1, Math.max(...consumoLine.map((x) => x.value))) * 140)}px` }} />
                  <span className="text-[10px] text-slate-500">{p.mes.slice(5)}</span>
                </div>
              ))}
            </div>)}
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Resumen de Producto Terminado</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><p className="text-xs text-slate-500">Stock PT total</p><p className="text-3xl font-black mt-2 text-fuchsia-300">{kpis.stock_total_pt.toLocaleString('es-AR')} kg</p></Card>
          <Card>
            <p className="text-xs text-slate-500">Valor inventario PT</p>
            <p className="text-3xl font-black mt-2 text-violet-300">{valorInventarioPtLabel}</p>
            <p className="text-xs text-slate-400 mt-2">Base estimada desde órdenes finalizadas con costo real disponible.</p>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Órdenes de Producción</h2>
              <p className="text-sm text-slate-500">Fabricación de producto terminado.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.ORDENES}?crear=1`)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-blue-500"
            >
              Nueva orden de producción
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Pendientes</p>
              <p className="mt-2 text-3xl font-black text-blue-300">{kpis.ordenes_pendientes}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">En proceso</p>
              <p className="mt-2 text-3xl font-black text-sky-300">{kpis.ordenes_en_proceso}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Finalizadas</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{kpis.ordenes_finalizadas}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Producción total</p>
              <p className="mt-2 text-2xl font-black text-amber-300">{kpis.produccion_total.toLocaleString('es-AR')} kg</p>
              <p className="mt-2 text-xs text-slate-500">
                Merma total: {kpis.merma_total.toLocaleString('es-AR')} kg · Costo prom.: {fmtARS(kpis.costo_promedio_produccion)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Órdenes de Expedición</h2>
              <p className="text-sm text-slate-500">Salida y despacho de producto terminado hacia clientes.</p>
            </div>
            {canCreateExpedition ? (
              <button
                type="button"
                onClick={() => setIsExpedicionOpen(true)}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-cyan-500"
              >
                Nueva orden de expedición
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Registradas</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.expediciones_registradas}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Kg expedidos</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.kg_expedidos.toLocaleString('es-AR')}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Clientes atendidos</p>
              <p className="mt-2 text-3xl font-black text-cyan-700">{expedicionInsights.resumen.clientes_atendidos}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Producto más expedido</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{expedicionInsights.resumen.producto_mas_expedido}</p>
              <p className="mt-2 text-xs text-slate-500">{expedicionInsights.resumen.kg_producto_mas_expedido.toLocaleString('es-AR')} kg</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {expedicionInsights.porCliente.slice(0, 3).map((item) => (
              <div key={`${item.fecha}-${item.producto_nombre}-${item.cliente_nombre}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.cliente_nombre}</p>
                  <p className="truncate text-xs text-slate-500">{item.producto_nombre} · {item.presentacion.replace('_', ' ').toLowerCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-cyan-700">{item.kg.toLocaleString('es-AR')} kg</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">{formatDateDDMMYYYY(item.fecha)}</p>
                </div>
              </div>
            ))}
            {expedicionInsights.porCliente.length === 0 ? (
              <p className="text-sm text-slate-500">Sin expediciones registradas todavía.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Finanzas</h2>
          <p className="text-sm text-slate-500">Caja Real (Movimientos confirmados) y Caja Proyectada (A vencimiento) de {periodoLabel.toLowerCase()}.</p>
        </div>
        
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">Flujo de Caja Real</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPIBox label="Ingresos del periodo" value={fmtARS(temporalInsights.ingresosReales)} trend={financeTrend} updatedAt={updatedAtLabel} tone="emerald" helper="Ingresos cobrados y confirmados en caja." />
            <KPIBox label="Egresos del periodo" value={fmtARS(temporalInsights.egresosReales)} trend={financeTrend} updatedAt={updatedAtLabel} tone="orange" helper="Egresos pagados y confirmados en caja." />
            <KPIBox label="Flujo neto" value={fmtARS(temporalInsights.flujoReal)} trend={financeTrend} updatedAt={updatedAtLabel} tone={temporalInsights.flujoReal >= 0 ? 'cyan' : 'red'} helper="Ingresos reales - egresos reales." />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">Flujo de Caja Proyectado</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPIBox label="Cuentas por cobrar" value={fmtARS(temporalInsights.ingresosProyectados)} trend={financeTrend} updatedAt={updatedAtLabel} tone="emerald" helper="Ingresos pendientes a cobrar con vencimiento en el período." />
            <KPIBox label="Cuentas por pagar" value={fmtARS(temporalInsights.egresosProyectados)} trend={financeTrend} updatedAt={updatedAtLabel} tone="orange" helper="Egresos pendientes a pagar con vencimiento en el período." />
            <KPIBox label="Flujo proyectado" value={fmtARS(temporalInsights.flujoProyectado)} trend={financeTrend} updatedAt={updatedAtLabel} tone={temporalInsights.flujoProyectado >= 0 ? 'cyan' : 'red'} helper="Cuentas por cobrar - cuentas por pagar del periodo futuro." />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2">Saldos Vencidos (Fuera de término)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KPIBox label="Vencidos por Cobrar" value={fmtARS(temporalInsights.vencidosCobrar)} trend={financeTrend} updatedAt={updatedAtLabel} tone="emerald" helper="Cuentas por cobrar cuyo vencimiento ya pasó." />
            <KPIBox label="Vencidos por Pagar" value={fmtARS(temporalInsights.vencidosPagar)} trend={financeTrend} updatedAt={updatedAtLabel} tone="red" helper="Cuentas por pagar cuyo vencimiento ya pasó." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <KPIBox label="Costos producción ejecutados" value={fmtARS(temporalInsights.costosProduccionEjecutados)} trend={financeTrend} updatedAt={updatedAtLabel} tone="orange" helper="Insumos consumidos en órdenes finalizadas o en proceso." />
          <KPIBox label="Costos producción comprometidos" value={fmtARS(temporalInsights.costosComprometidos)} trend={financeTrend} updatedAt={updatedAtLabel} tone="slate" helper="Insumos estimados para órdenes pendientes." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Próximas Cobranzas</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {proximasCobranzas.length === 0 ? (
                <p className="text-xs text-slate-500">No hay cobranzas programadas.</p>
              ) : (
                proximasCobranzas.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.tercero}</p>
                      <p className="text-slate-400 text-[10px]">{item.comprobante} · Vence: {formatDateDDMMYYYY(item.fecha)}</p>
                    </div>
                    <span className="font-bold text-emerald-600 shrink-0 ml-2">{fmtARS(item.monto)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Próximos Pagos</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {proximosPagos.length === 0 ? (
                <p className="text-xs text-slate-500">No hay pagos programados.</p>
              ) : (
                proximosPagos.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.tercero}</p>
                      <p className="text-slate-400 text-[10px]">{item.comprobante} · Vence: {formatDateDDMMYYYY(item.fecha)}</p>
                    </div>
                    <span className="font-bold text-orange-600 shrink-0 ml-2">{fmtARS(item.monto)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Saldos Vencidos</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {vencidosList.length === 0 ? (
                <p className="text-xs text-slate-500">No hay saldos vencidos.</p>
              ) : (
                vencidosList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded-xl bg-red-50 border border-red-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.tercero}</p>
                      <p className="text-red-400 text-[10px]">{item.comprobante} · Venció: {formatDateDDMMYYYY(item.fecha)}</p>
                    </div>
                    <span className={`font-bold shrink-0 ml-2 ${item.tipo === 'COBRO' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmtARS(item.monto)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Alertas Operativas</h2>
          <p className="text-sm text-slate-500">Señales críticas y seguimiento de problemas operativos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIBox label="Alertas activas" value={`${temporalInsights.alertas.length}`} trend={alertsTrend} updatedAt={updatedAtLabel} tone="fuchsia" />
          <KPIBox label="Pendientes" value={`${summary.pendientes}`} trend={alertsTrend} updatedAt={updatedAtLabel} tone="red" />
          <KPIBox label="Críticas activas" value={`${summary.criticas}`} trend={alertsTrend} updatedAt={updatedAtLabel} tone="red" />
          <KPIBox label="En seguimiento" value={`${summary.seguimiento}`} trend={alertsTrend} updatedAt={updatedAtLabel} tone="orange" />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Estado de Materia Prima</h3>
          <p className="text-xs text-slate-500 mb-3">Stock total con desglose entre comprometido y disponible.</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Stock total MP</p>
                <p className="text-2xl font-black text-cyan-300">{kpis.stock_total_mp.toLocaleString('es-AR')} kg</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Comprometido: <span className="font-semibold text-orange-600">{kpis.stock_comprometido_mp.toLocaleString('es-AR')} kg</span></p>
                <p>Disponible: <span className="font-semibold text-emerald-600">{kpis.stock_disponible_mp.toLocaleString('es-AR')} kg</span></p>
              </div>
            </div>
            <div className="h-4 rounded-full bg-slate-200 overflow-hidden flex">
              <div className="bg-orange-500 transition-all duration-300" style={{ width: `${estadoMateriaPrima[0].pct}%` }} title={`Comprometido: ${estadoMateriaPrima[0].value.toLocaleString('es-AR')} kg`} />
              <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${estadoMateriaPrima[1].pct}%` }} title={`Disponible: ${estadoMateriaPrima[1].value.toLocaleString('es-AR')} kg`} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-500">
              {estadoMateriaPrima.map((segment) => (
                <span key={segment.label} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${segment.color}`} />
                  {segment.label}
                </span>
              ))}
            </div>
          </div>
          {stockMpResumen.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Insumos con menor disponibilidad</p>
              {stockMpResumen
                .slice()
                .sort((a, b) => a.stock_disponible - b.stock_disponible)
                .slice(0, 3)
                .map((item) => (
                  <div key={item.insumo_id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.nombre_insumo}</p>
                      <p className="text-xs text-slate-500">{item.estado} · Umbral {item.umbral_alerta.toLocaleString('es-AR')} {item.unidad}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{item.stock_disponible.toLocaleString('es-AR')} {item.unidad}</p>
                  </div>
                ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Stock de Producto Terminado por Producto</h3>
          <p className="text-xs text-slate-500 mb-3">Top 10 productos con mayor saldo consolidado.</p>
          {ptRanking.length === 0 ? (
            <p className="text-sm text-slate-700">Sin producto terminado consolidado todavía.</p>
          ) : (
            <div className="space-y-3">
              {ptRanking.map((item) => {
                const max = Math.max(1, ptRanking[0]?.stock_actual ?? 1);
                const pct = (item.stock_actual / max) * 100;
                return (
                  <div key={`${item.nombre_producto}-${item.producto_id ?? 'sin-id'}`}>
                    <div className="flex items-start justify-between gap-3 text-xs mb-1">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                        <p className="text-slate-500">
                          {item.estado} · {item.cantidad_lotes} lotes
                          {item.version_formula ? ` · v${item.version_formula}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-violet-700">{item.stock_actual.toLocaleString('es-AR')} {item.unidad}</p>
                        <p className="text-slate-500">{fmtARS(item.valor_monetario)}</p>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-300" style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold">Top 3 alertas críticas</h3>
              <p className="text-xs text-slate-500">Alertas reales ordenadas por prioridad operativa.</p>
            </div>
            <Link to={ROUTES.ALERTAS} className="text-sm font-semibold text-red-700 hover:text-red-800">
              Ir a alertas
            </Link>
          </div>
          {alertasTop.length === 0 ? (
            <p className="text-sm text-slate-700">No hay alertas operativas activas en este momento.</p>
          ) : (
            <div className="space-y-3">
              {alertasTop.map((alerta) => (
                <div key={alerta.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{alerta.titulo}</p>
                      <p className="text-xs text-slate-500 mt-1">{alerta.area.toUpperCase()} · {alerta.estado}</p>
                    </div>
                    <span className={`text-[11px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${
                      alerta.prioridad === 'critica'
                        ? 'bg-red-100 text-red-700'
                        : alerta.prioridad === 'media'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {alerta.prioridad}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{formatDatoAsociado(alerta.datoAsociado as Record<string, unknown>)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Stock real por materia prima</h3>
          <p className="text-xs text-slate-500 mb-3">Top insumos por stock físico real, consolidado desde `stock_mp_resumen`.</p>
          {stockMpTop.length === 0 ? (
            <div className="h-48 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              Sin stock de materia prima disponible todavía.
            </div>
          ) : (
            <div className="space-y-3">
              {stockMpTop.map((item, idx) => {
                const width = Math.max(8, (item.stock_actual / stockMpMax) * 100);
                return (
                  <div key={item.insumo_id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.nombre_insumo}</p>
                        <p className="text-slate-500">
                          Disponible {item.stock_disponible.toLocaleString('es-AR')} kg · Comprometido {item.stock_comprometido.toLocaleString('es-AR')} kg
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-cyan-700">{item.stock_actual.toLocaleString('es-AR')} kg</p>
                        <p className="text-slate-400 uppercase tracking-widest text-[10px]">#{idx + 1}</p>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 transition-all duration-300"
                        style={{ width: `${width}%` }}
                        title={`${item.nombre_insumo}: ${item.stock_actual.toLocaleString('es-AR')} kg`}
                      />
                    </div>
                  </div>
                );
              })}
              </div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Consumo mensual por insumo</h3>
          {consumoTop.length === 0 ? <p className="text-sm text-slate-700">Sin consumo mensual disponible todavía.</p> : (
          <div className="space-y-2">
            {consumoTop.map((c) => (
              <div key={c.insumo}>
                <div className="flex justify-between text-xs"><span>{c.insumo}</span><span>{c.total.toLocaleString('es-AR')} kg</span></div>
                <div className="h-2 bg-slate-200 rounded-full"><div className="h-2 bg-cyan-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${c.pct}%` }} /></div>
              </div>
            ))}
          </div>)}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Consumo mensual total de MP</h3>
          {consumoLine.length === 0 ? <p className="text-sm text-slate-700">Sin histórico suficiente para graficar consumo.</p> : (
          <div className="flex items-end gap-2 h-44">
            {consumoLine.map((p) => (
              <div key={p.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full max-w-8 bg-emerald-500/70 rounded-t" style={{ height: `${Math.max(8, p.value / Math.max(1, Math.max(...consumoLine.map((x) => x.value))) * 140)}px` }} />
                <span className="text-[10px] text-slate-500">{p.mes.slice(5)}</span>
              </div>
            ))}
          </div>)}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Producto Terminado</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Salidas de producto terminado</h3>
            <p className="text-xs text-slate-500 mb-3">Egresos consolidados por producto terminado en kg.</p>
            {ptInsights.salidasPorProducto.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin salidas registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {ptInsights.salidasPorProducto.map((item, idx) => {
                  const max = Math.max(1, ptInsights.salidasPorProducto[0]?.kg_salidos ?? 1);
                  const width = Math.max(8, (item.kg_salidos / max) * 100);
                  return (
                    <div key={`${item.producto_id}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                          <p className="text-slate-500">{item.cantidad_movimientos} movimientos · Última salida {item.ultima_salida ? formatDateDDMMYYYY(item.ultima_salida) : 'Sin dato'}</p>
                        </div>
                        <p className="font-semibold text-blue-700 shrink-0">{item.kg_salidos.toLocaleString('es-AR')} kg</p>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">% de producto terminado</h3>
            <p className="text-xs text-slate-500 mb-3">Participación del stock PT actual por producto.</p>
            {ptInsights.participacionStock.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin stock de producto terminado para calcular participación.
              </div>
            ) : (
              <div className="space-y-3">
                {ptInsights.participacionStock.map((item, idx) => {
                  const max = Math.max(1, ptInsights.participacionStock[0]?.stock_actual ?? 1);
                  const width = Math.max(8, (item.stock_actual / max) * 100);
                  return (
                    <div key={`${item.producto_id ?? item.nombre_producto}-${idx}`} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{item.nombre_producto}</p>
                          <p className="text-slate-500">{item.stock_actual.toLocaleString('es-AR')} kg · {item.porcentaje.toFixed(1)}%</p>
                        </div>
                        <p className="font-semibold text-violet-700 shrink-0">{item.porcentaje.toFixed(1)}%</p>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3">PT entregado por cliente</h3>
            <p className="text-xs text-slate-500 mb-3">Últimas salidas con cliente asociado, producto y fecha.</p>
            {ptInsights.entregasPorCliente.length === 0 ? (
              <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Sin movimientos de clientes para mostrar.
              </div>
            ) : (
              <div className="space-y-2">
                {ptInsights.entregasPorCliente.map((item, idx) => (
                  <div key={`${item.producto_nombre}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.cliente_nombre}</p>
                        <p className="text-xs text-slate-500 truncate">{item.producto_nombre} · {formatDateDDMMYYYY(item.fecha)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-700">{item.kg.toLocaleString('es-AR')} kg</p>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">{item.referencia ?? 'Sin referencia'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>

      <Card className="border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Alertas operativas</h2>
            <p className="text-sm text-slate-500 mt-1">Pendientes detectadas: {summary.pendientes} · Críticas activas: {summary.criticas}</p>
            <p className="text-xs text-slate-400 mt-1">La auditoría operativa real vive en el módulo Trazabilidad; aquí solo ves el estado resumido de alertas.</p>
          </div>
          <Link to={ROUTES.ALERTAS} className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-700 text-sm font-semibold">Ver alertas operativas</Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold mb-3">Órdenes recientes</h2>
        <DataTable minWidthClassName="min-w-[680px]">
          <TableHeader><tr><TableCell header>Lote</TableCell><TableCell header>Producto</TableCell><TableCell header>Responsable</TableCell><TableCell header>Objetivo</TableCell><TableCell header>Estado</TableCell></tr></TableHeader>
          <TableBody>
            {recientes.map((o) => <TableRow key={o.id}><TableCell>{o.lote}</TableCell><TableCell>{o.nombre_producto}</TableCell><TableCell>{o.usuario_responsable}</TableCell><TableCell>{o.cantidad_objetivo.toLocaleString('es-AR')} kg</TableCell><TableCell><StatusBadge value={o.estado} /></TableCell></TableRow>)}
            {recientes.length === 0 ? <EmptyState colSpan={5} message="Todavía no hay órdenes para mostrar." /> : null}
          </TableBody>
        </DataTable>
      </Card>

      {loading ? <p className="text-sm text-gray-500">Cargando métricas…</p> : null}
      {isExpedicionOpen ? (
        <OrdenExpedicionModal
          onClose={() => setIsExpedicionOpen(false)}
          onSuccess={reload}
        />
      ) : null}
    </div>
  );
};

export default DashboardPage;
