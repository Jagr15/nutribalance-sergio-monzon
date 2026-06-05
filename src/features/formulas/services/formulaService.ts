import { ApiService } from '../../../infrastructure/api/';
import type { Formula } from '../types';
import { assertPermission } from '../../auth/accessControl';
import { auditAction } from '../../auth/audit';

export const formulaService = {
  /**
   * Recupera el listado completo de recetas/fórmulas.
   */
  getAll: (): Promise<Formula[]> => {
    return ApiService.formulas.findAll();
  },

  /**
   * Obtiene el detalle de una versión específica de fórmula.
   */
  getById: async (uid: string): Promise<Formula | undefined> => {
    return ApiService.formulas.getById(uid);
  },

  /**
   * Registra una nueva fórmula. 
   * Nota: El mock validará que la suma de porcentajes sea 100%.
   */
  create: (data: Omit<Formula, 'uid' | 'ultima_edicion'>): Promise<Formula> => {
    assertPermission('formulas', 'create_formula');
    return ApiService.formulas.create(data).then(async (result) => {
      await auditAction({
        modulo: 'formulas',
        accion: 'create_formula',
        entidad: 'formula',
        entidad_ref: result.uid,
        payload: { nombre_producto: result.nombre_producto, version: result.version },
      });
      return result;
    });
  },

  /**
   * Actualiza una fórmula existente. 
   * Útil para corregir nombres o ajustar porcentajes en versiones borradores.
   */
  update: (uid: string, data: Partial<Formula>): Promise<Formula> => {
    assertPermission('formulas', 'edit_formula');
    return ApiService.formulas.update(uid, data).then(async (result) => {
      await auditAction({
        modulo: 'formulas',
        accion: 'edit_formula',
        entidad: 'formula',
        entidad_ref: uid,
        payload: data as Record<string, unknown>,
      });
      return result;
    });
  },

  /**
   * Realiza un borrado lógico de la fórmula (cambia estado a 'esta_activa: false').
   * En este sistema de producción, no eliminamos datos para mantener la trazabilidad.
   */
  delete: (uid: string): Promise<boolean> => {
    return ApiService.formulas.delete(uid);
  },

  /**
   * Método especializado para clonar una fórmula y crear una nueva versión.
   * (Requerimiento de Sergio Monzón para evolucionar recetas).
   */
  createNewVersion: async (baseFormula: Formula): Promise<Formula> => {
    const nextVersion = {
      nombre_producto: baseFormula.nombre_producto,
      ingredientes: baseFormula.ingredientes,
      version: baseFormula.version + 1,
      esta_activa: true,
      id_usuario: baseFormula.id_usuario,
      author: baseFormula.author,
      createdAt: baseFormula.createdAt,
    };
    return ApiService.formulas.create(nextVersion);
  }
};
