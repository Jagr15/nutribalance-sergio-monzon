import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiLock, FiShield, FiTrendingUp, FiUser } from "react-icons/fi";
import { authenticateDemoUser, saveSession } from "../session";

const benefits = [
  "Control de producción",
  "Inventario por lotes",
  "Costos operativos",
  "Alertas inteligentes",
  "Trazabilidad preparada",
];

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    window.setTimeout(() => {
      const user = authenticateDemoUser(login, password);
      if (!user) {
        setLoading(false);
        setError("No pudimos validar el acceso. Revisá usuario y contraseña.");
        return;
      }

      saveSession(user);
      navigate(redirectTo, { replace: true });
    }, 350);
  };

  return (
    <div className="min-h-screen bg-[#07111e] text-white px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-6xl rounded-3xl border border-white/10 bg-[#0d1828] shadow-[0_30px_90px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative p-8 md:p-12 bg-gradient-to-br from-[#0b1f39] via-[#0b2847] to-[#0d1828] border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-cyan-100">
                <FiShield size={14} /> Plataforma operativa
              </div>

              <div>
                <h1 className="text-4xl md:text-5xl font-black leading-tight">Nutribalance</h1>
                <p className="mt-3 text-cyan-100/90 text-lg md:text-xl">Sistema de Producción e Inventario</p>
                <p className="mt-5 text-slate-200/85 max-w-xl leading-relaxed">
                  Gestioná operación, lotes y costos en una sola vista para tomar decisiones con velocidad y precisión.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-slate-100 flex items-center gap-2"
                  >
                    <FiCheckCircle className="text-cyan-300 shrink-0" size={15} />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-8 md:p-10 bg-[#0c1422]">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-bold">Acceso operativo</h2>
              <p className="text-sm text-slate-400 mt-2">Ingresá con tu cuenta para continuar al tablero ejecutivo.</p>

              <form className="space-y-4 mt-8" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="login" className="text-sm text-slate-300 block mb-2">
                    Email o usuario
                  </label>
                  <div className="relative">
                    <FiUser size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login"
                      type="text"
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      className="w-full bg-[#07101c] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400"
                      placeholder="admin@nutribalance.com"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="text-sm text-slate-300 block mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <FiLock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-[#07101c] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400"
                      placeholder="Ingresá tu contraseña"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-300/35 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl py-3 text-sm font-semibold transition"
                >
                  {loading ? "Validando acceso..." : "Ingresar al sistema"}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-xs text-cyan-50">
                <p className="uppercase tracking-[0.18em] text-[10px] text-cyan-200 mb-2 flex items-center gap-2">
                  <FiTrendingUp size={12} /> Acceso operativo
                </p>
                <p>
                  Usuario: <span className="font-semibold">admin@nutribalance.com</span>
                </p>
                <p>
                  Contraseña: <span className="font-semibold">admin123</span>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
