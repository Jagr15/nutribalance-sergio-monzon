// src/infrastructure/api/mocks/mockFormulaService.ts
import type { Formula } from '../../../../features/formulas/types';
import formulasData from '../data/formulas.json';
import { mockApiCall } from '../mockClient';

type FormulaRaw = Omit<Formula, 'ultima_edicion'> & { ultima_edicion: string };

// Mapeo inicial para asegurar que las fechas sean objetos Date
let mockFormulas: Formula[] = (formulasData as unknown as FormulaRaw[]).map((f) => ({
  ...f,
  ultima_edicion: new Date(f.ultima_edicion)
}));

export const mockFormulaService = {
  // Obtener todas las recetas
  findAll: async (): Promise<Formula[]> => {
    return mockApiCall([...mockFormulas]);
  },

  // Obtener una receta específica
  getById: async (uid: string): Promise<Formula | undefined> => {
    const formula = mockFormulas.find((f) => f.uid === uid);
    return mockApiCall(formula);
  },

  // Crear una nueva fórmula con VALIDACIÓN DE NEGOCIO
  create: async (data: Omit<Formula, 'uid' | 'ultima_edicion'>): Promise<Formula> => {
    // REGLA DE ORO: Validación del 100%
    const sumaTotal = data.ingredientes.reduce((acc, ing) => acc + ing.porcentaje, 0);
    
    // Usamos un margen de error mínimo por decimales (ej. 99.999 es válido como 100)
    if (Math.abs(sumaTotal - 100) > 0.01) {
      throw new Error(`La fórmula no suma 100% (Suma actual: ${sumaTotal.toFixed(2)}%).`);
    }

    const newFormula: Formula = {
      ...data,
      uid: `for-${Math.floor(Math.random() * 10000)}`,
      esta_activa: true,
      ultima_edicion: new Date()
    };

    mockFormulas = [newFormula, ...mockFormulas];
    return mockApiCall(newFormula);
  },

  // Actualizar datos de la receta
  update: async (uid: string, data: Partial<Formula>): Promise<Formula> => {
    // Si se actualizan ingredientes, validamos el 100% nuevamente
    if (data.ingredientes) {
      const suma = data.ingredientes.reduce((acc, ing) => acc + ing.porcentaje, 0);
      if (Math.abs(suma - 100) > 0.01) {
        throw new Error("Los nuevos porcentajes deben sumar 100%");
      }
    }

    mockFormulas = mockFormulas.map((f) => 
      f.uid === uid ? { ...f, ...data, ultima_edicion: new Date() } : f
    );
    
    const updated = mockFormulas.find((f) => f.uid === uid);
    if (!updated) throw new Error("Fórmula no encontrada");
    
    return mockApiCall(updated);
  },

  // Borrado lógico (según el requerimiento: desactivar en lugar de eliminar físicamente)
  delete: async (uid: string): Promise<boolean> => {
    mockFormulas = mockFormulas.map((f) =>
      f.uid === uid ? { ...f, esta_activa: false, ultima_edicion: new Date() } : f
    );
    return mockApiCall(true);
  }
};
