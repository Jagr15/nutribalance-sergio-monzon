import type { RuntimeConfig } from './runtimeConfig';

type RuntimeConfigErrorScreenProps = {
  runtimeConfig: RuntimeConfig;
};

export const RuntimeConfigErrorScreen = ({ runtimeConfig }: RuntimeConfigErrorScreenProps) => {
  const requiredVariables = [
    { key: 'VITE_USE_MOCKS', value: 'false' },
    { key: 'VITE_SUPABASE_URL', value: 'https://TU-PROYECTO.supabase.co' },
    { key: 'VITE_SUPABASE_ANON_KEY', value: 'TU_ANON_KEY_PUBLICA' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center">
        <section className="w-full rounded-3xl border border-rose-500/30 bg-slate-900/90 p-8 shadow-2xl shadow-black/30">
          <p className="mb-3 inline-flex rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-rose-200">
            Error de configuración
          </p>
          <h1 className="text-3xl font-black text-white md:text-4xl">La app no puede iniciar en producción</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Detectamos una configuración inválida para el despliegue. La app se detiene para evitar correr con mocks o sin credenciales de Supabase.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-950/80 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Problemas detectados</h2>
            <ul className="mt-4 space-y-2 text-sm text-rose-100">
              {runtimeConfig.errors.map((error) => (
                <li key={error} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  {error}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Variables requeridas</h2>
            <div className="mt-4 grid gap-3">
              {requiredVariables.map((variable) => (
                <div key={variable.key} className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <span className="font-mono text-sm text-cyan-200">{variable.key}</span>
                  <span className="font-mono text-xs text-slate-400">{variable.value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-slate-400">
            Revisa las variables en Vercel y vuelve a desplegar. En desarrollo local puedes seguir usando el modo mock, pero en producción el backend debe ser Supabase.
          </p>
        </section>
      </div>
    </main>
  );
};
