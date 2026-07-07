import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../mockClient', () => ({
  mockApiCall: <T>(data: T) => Promise.resolve(data),
}));

import { mockOrdenesExpedicionService, resetMockOrdenesExpedicionService } from './mockOrdenesExpedicionService';
import { mockStockPTService, resetMockStockPTService } from './mockStockPTService';
import { mockOrdenService } from './mockOrdenService';
import { mockFormulaService } from './mockFormulaService';

describe('mockOrdenesExpedicionService', () => {
  beforeEach(() => {
    resetMockStockPTService();
    resetMockOrdenesExpedicionService();
  });

  it('crea una expedición y descuenta stock PT', async () => {
    const inicial = await mockOrdenesExpedicionService.getAll();
    const lote = (await mockStockPTService.getAll())[0]!;

    const created = await mockOrdenesExpedicionService.create({
      stock_pt_id: lote.uid,
      cliente_id: 'cli-001',
      presentacion_key: 'GRANEL_KG',
      presentacion: 'GRANEL',
      cantidad: 10,
      unidad_cantidad: 'kg',
      precio_unitario_venta: 150,
      motivo: 'Venta',
      referencia: 'EXP-TEST',
    });

    expect(created.cliente_nombre).toBe('Estancia La Esperanza');
    expect(created.presentacion).toBe('GRANEL');

    const expediciones = await mockOrdenesExpedicionService.getAll();
    expect(expediciones.length).toBe(inicial.length + 1);
    expect(expediciones[0].referencia).toBe('EXP-TEST');
  });

  it('rechaza expediciones sin cliente', async () => {
    const stock = (await mockStockPTService.getAll())[0]!;

    await expect(mockOrdenesExpedicionService.create({
      stock_pt_id: stock.uid,
      cliente_id: '',
      presentacion_key: 'BOLSA_20',
      presentacion: 'BOLSA',
      cantidad: 1,
      unidad_cantidad: 'kg',
      precio_unitario_venta: 150,
    })).rejects.toThrow('El cliente destino es obligatorio.');
  });

  it('convierte toneladas a kg', async () => {
    const stock = (await mockStockPTService.getAll())[0]!;
    const created = await mockOrdenesExpedicionService.create({
      stock_pt_id: stock.uid,
      cliente_id: 'cli-001',
      presentacion_key: 'TONELADA',
      presentacion: 'GRANEL',
      cantidad: 1.25,
      unidad_cantidad: 'tonelada',
      precio_unitario_venta: 180,
    });

    expect(created.cantidad_original).toBe(1.25);
    expect(created.cantidad_kg).toBe(1250);
  });

  it('programa y reprograma la entrega de una orden', async () => {
    const expediciones = await mockOrdenesExpedicionService.getAll();
    const orden = expediciones.find((o) => o.estado === 'pendiente')!;
    
    // Programar
    const programada = await mockOrdenesExpedicionService.programarEntrega(orden.id, '2026-07-10', 'Nota de entrega');
    expect(programada.fecha_programada).toBe('2026-07-10');
    expect(programada.nota_programacion).toBe('Nota de entrega');

    // Reprogramar
    const reprogramada = await mockOrdenesExpedicionService.programarEntrega(orden.id, '2026-07-15', 'Nota actualizada');
    expect(reprogramada.fecha_programada).toBe('2026-07-15');
    expect(reprogramada.nota_programacion).toBe('Nota actualizada');
  });

  it('rechaza programar la entrega de una orden despachada o cancelada', async () => {
    const expediciones = await mockOrdenesExpedicionService.getAll();
    const despachada = expediciones.find((o) => o.estado === 'despachada')!;
    
    await expect(
      mockOrdenesExpedicionService.programarEntrega(despachada.id, '2026-07-10')
    ).rejects.toThrow('No se puede programar la entrega de una orden despachada o cancelada.');
  });

  it('mantiene consistencia de stock descontando y revirtiendo en la orden de producción correspondiente', async () => {
    const formula = (await mockFormulaService.findAll())[0]!;
    const prodOrder = await mockOrdenService.create({
      lote: 'OP-TEST-999',
      id_formula: formula.uid,
      nombre_producto: formula.nombre_producto,
      version_formula: formula.version,
      cantidad_objetivo: 90,
      estado: 'PENDIENTE',
      fecha_creacion: new Date().toISOString(),
      usuario_responsable: 'Sergio Monzón',
      id_silo: 'silo-001',
      destino_silo: 'Silo Lechera',
      detalle_insumos: [],
      costo_total_insumos: 0,
    });

    await mockOrdenService.startProduction(prodOrder.id);
    await mockOrdenService.finishProduction(prodOrder.id, {
      cantidad_real: 90,
      destino_silo: 'Silo Lechera',
      lote_salida: 'PT-TEST-999',
      merma: 0,
    });

    // Confirm that the Orders service returns 90 kg for both real and stock_disponible
    const ordenesAntes = await mockOrdenService.getAll();
    const ordenAntes = ordenesAntes.find(o => o.id === prodOrder.id)!;
    expect(ordenAntes.cantidad_real).toBe(90);
    expect(ordenAntes.stock_disponible).toBe(90);

    const stockLotes = await mockStockPTService.getAll();
    const createdStockPT = stockLotes.find((x) => x.lote === 'PT-TEST-999')!;
    expect(createdStockPT).toBeDefined();
    expect(createdStockPT.cantidad_total).toBe(90);

    const expedicion = await mockOrdenesExpedicionService.create({
      stock_pt_id: createdStockPT.uid,
      cliente_id: 'cli-001',
      presentacion_key: 'GRANEL_KG',
      presentacion: 'GRANEL',
      cantidad: 10,
      target_lote: 'PT-TEST-999',
      unidad_cantidad: 'kg',
      precio_unitario_venta: 200,
      motivo: 'Venta especial',
    } as any);

    await mockOrdenesExpedicionService.iniciarPreparacion(expedicion.id);
    await mockOrdenesExpedicionService.marcarLista(expedicion.id, 10);

    // Verify stock and production order available stock were reduced to 80 kg, while cantidad_real remains 90
    const updatedStock = (await mockStockPTService.getAll()).find((x) => x.uid === createdStockPT.uid)!;
    expect(updatedStock.cantidad_total).toBe(80);

    const ordenesDespues = await mockOrdenService.getAll();
    const ordenDespues = ordenesDespues.find(o => o.id === prodOrder.id)!;
    expect(ordenDespues.cantidad_real).toBe(90);
    expect(ordenDespues.stock_disponible).toBe(80);

    // Verify cancellation reverts stock and available stock, keeping cantidad_real 90
    await mockOrdenesExpedicionService.cancelar(expedicion.id);

    const revertedStock = (await mockStockPTService.getAll()).find((x) => x.uid === createdStockPT.uid)!;
    expect(revertedStock.cantidad_total).toBe(90);

    const ordenesRevertido = await mockOrdenService.getAll();
    const ordenRevertido = ordenesRevertido.find(o => o.id === prodOrder.id)!;
    expect(ordenRevertido.cantidad_real).toBe(90);
    expect(ordenRevertido.stock_disponible).toBe(90);
  });
});
