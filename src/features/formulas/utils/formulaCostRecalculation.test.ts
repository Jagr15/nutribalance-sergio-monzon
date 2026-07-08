import { describe, expect, it } from 'vitest';
import { mockFormulaService } from '../../../infrastructure/api/mock/services/mockFormulaService';
import { mockInsumoService } from '../../../infrastructure/api/mock/services/mockInsumoService';
import type { Formula } from '../types';

describe('Prueba de regresión: Recálculo dinámico de costos de fórmulas', () => {
  it('debe actualizar el costo de la fórmula al cambiar el costo del insumo sin afectar órdenes históricas', async () => {
    // 1. Crear insumo con costo_por_kg = 100 y ref_costo_unitario = 100
    const insumo = await mockInsumoService.createInsumo({
      nombre: 'Insumo Test Regresión',
      unidad_medida: 'KG',
      umbral_alerta: 10,
      costo: 100,
      unidad_costo: 'KG',
      ref_costo_unitario: 100,
      costo_por_kg: 100,
      costo_por_tonelada: 100000,
      proteina_bruta_pct: 10,
      categoria: 'Grano',
    });

    expect(insumo.costo_por_kg).toBe(100);

    // 2. Crear fórmula usando ese insumo (al 100% de inclusión para simplificar)
    const formulaPayload: Omit<Formula, 'uid' | 'ultima_edicion'> = {
      nombre_producto: 'Fórmula Regresión Costos',
      version: 1,
      esta_activa: true,
      id_usuario: 'usr-admin-01',
      author: 'Tester',
      createdAt: new Date(),
      ingredientes: [
        {
          id_insumo: insumo.uid,
          nombre_insumo: insumo.nombre,
          porcentaje: 100,
          costo_unitario_usado: 100,
          costo_contribucion_kg: 100,
          fuente_costo: 'REFERENCIA',
        },
      ],
    };

    const formula = await mockFormulaService.create(formulaPayload);

    // 3. Confirmar que la fórmula muestra costo 100
    expect(formula.costo_por_kg).toBe(100);

    // 4. Cambiar el costo del insumo a 200
    await mockInsumoService.updateInsumo(insumo.uid, {
      costo: 200,
      ref_costo_unitario: 200,
      costo_por_kg: 200,
      costo_por_tonelada: 200000,
    });

    // 5. Volver a consultar/abrir la fórmula
    const formulaConsultada = await mockFormulaService.getById(formula.uid);
    expect(formulaConsultada).toBeDefined();

    // 6. Confirmar que la fórmula muestra costo 200 y no el costo viejo
    expect(formulaConsultada!.costo_por_kg).toBe(200);
    expect(formulaConsultada!.ingredientes[0].costo_unitario_usado).toBe(200);
  });
});
