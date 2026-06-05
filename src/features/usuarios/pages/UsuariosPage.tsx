import { useEffect, useState } from 'react';
import { Card } from '../../../shared/components/card';
import { usuarioService } from '../services/usuarioService';
import type { Usuario } from '../types/usuario';

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await usuarioService.findAll();
        setUsuarios(data);
      } catch (error: unknown) {
        setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Administración</p>
        <h1 className="text-3xl font-bold mt-2">Usuarios</h1>
      </section>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 text-red-700">
          {loadError}
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-500">Cargando usuarios...</p>
        </Card>
      ) : null}

      {!isLoading && usuarios.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No hay usuarios registrados.</p>
        </Card>
      ) : null}

      {!isLoading && usuarios.length > 0 ? (
        <Card>
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.uid} className="border-b border-slate-100">
                    <td className="py-2">{u.nombre_completo || 'Sin dato'}</td>
                    <td className="py-2">{u.username || 'Sin dato'}</td>
                    <td className="py-2">{u.email || 'Sin dato'}</td>
                    <td className="py-2">{u.role || 'Sin dato'}</td>
                    <td className="py-2">{u.esta_activo ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

export default UsuariosPage;
