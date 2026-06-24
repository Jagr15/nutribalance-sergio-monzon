import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiLoader, FiLock, FiShield, FiTrendingUp, FiUser, FiXCircle } from "react-icons/fi";
import { runtimeConfig } from "../../../infrastructure/api/runtimeConfig";
import { authenticateDemoUser, saveSession } from "../session";
import { BrandLogo } from "../../../shared/components/BrandLogo";

type LoginStatus = "idle" | "loading" | "success" | "error";

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
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [isLeaving, setIsLeaving] = useState(false);
  const isDemoMode = runtimeConfig.mode === "mock";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading" || status === "success") return;
    setError("");
    setStatus("loading");

    window.setTimeout(() => {
      const user = authenticateDemoUser(login, password);
      if (!user) {
        setStatus("error");
        setError("No pudimos validar tus credenciales. Revisá usuario y contraseña e intentá nuevamente.");
        window.setTimeout(() => setStatus("idle"), 900);
        return;
      }

      setStatus("success");
      saveSession(user);
      window.setTimeout(() => {
        setIsLeaving(true);
      }, 120);
      window.setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 320);
    }, 700);
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div className={`min-h-screen bg-[#f3f7fc] px-4 py-8 flex items-center justify-center transition-opacity duration-200 ${isLeaving ? "opacity-0" : "opacity-100"}`}>
      <div className="w-full max-w-6xl rounded-3xl border border-slate-200 bg-white shadow-[0_38px_110px_rgba(15,23,42,0.16)] overflow-hidden">
        <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
          <section className="relative overflow-hidden p-8 md:p-12 bg-gradient-to-br from-emerald-50 via-white to-amber-50 border-b lg:border-b-0 lg:border-r border-slate-200">
            <div className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-amber-300/20 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-emerald-800">
                  <FiShield size={14} /> Plataforma corporativa
                </div>

                <div className="space-y-5">
                  <div className="w-[170px] sm:w-[180px] md:w-[190px]">
                    <BrandLogo variant="full" className="w-full max-w-none" />
                  </div>
                  <div>
                    <h1 className="text-4xl md:text-5xl font-black leading-tight text-emerald-950">Ditmona Agro</h1>
                    <p className="mt-2 text-amber-700 text-lg md:text-xl font-semibold">Sistema de Producción e Inventario</p>
                    <p className="mt-4 text-slate-600 max-w-xl leading-relaxed">
                      Sistema operativo de producción, inventario y trazabilidad para coordinar la operación con mayor control y visibilidad.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {benefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 flex items-center gap-2 transition hover:border-emerald-200 hover:-translate-y-[1px]"
                    >
                      <FiCheckCircle className="text-emerald-500 shrink-0" size={15} />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                DITMON AGRO · Sistema de Producción e Inventario
              </p>
            </div>
          </section>

          <section className="flex items-center p-8 md:p-10 bg-white">
            <div className={`w-full max-w-md mx-auto transition-all duration-300 ${isError ? "animate-shake" : "animate-fade-slide"} ${isSuccess ? "scale-[1.01]" : ""}`}>
              <div className="mb-5 flex flex-col items-start gap-3">
                {isDemoMode ? (
                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    Modo Demo
                  </div>
                ) : null}
                <BrandLogo variant="full" className="w-[170px] sm:w-[180px] md:w-[190px] max-w-none" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-950">Acceso operativo</h2>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Ingresá con tu cuenta para continuar al tablero ejecutivo y operar producción, inventario y trazabilidad.
              </p>

              <form className="space-y-4 mt-10" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="login" className="text-sm text-slate-600 block mb-2">
                    Email o usuario
                  </label>
                  <div className="relative">
                    <FiUser size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login"
                      type="text"
                      value={login}
                      onChange={(event) => setLogin(event.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 transition"
                      placeholder="admin@ditmonaagro.com"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="text-sm text-slate-600 block mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <FiLock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 transition"
                      placeholder="Ingresá tu contraseña"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {(isError || isSuccess) && (
                  <div className={`rounded-xl px-4 py-3 text-sm border flex items-start gap-2 transition-all duration-300 ease-out ${isSuccess ? "border-emerald-300 bg-emerald-50 text-emerald-700 animate-bounce-soft" : "border-red-300 bg-red-50 text-red-800 shadow-sm"}`}>
                    {isSuccess ? <FiCheckCircle size={16} /> : <FiXCircle size={16} />}
                    {isSuccess ? "Acceso validado. Redirigiendo al dashboard..." : error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className={`w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200 ease-out flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md ${isSuccess ? "bg-emerald-700 text-white" : "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white"} disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                >
                  {isLoading ? <FiLoader className="animate-spin" size={16} /> : null}
                  {isLoading ? "Validando credenciales..." : isSuccess ? "Acceso correcto" : "Ingresar al sistema"}
                </button>
              </form>

              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <p className="uppercase tracking-[0.18em] text-[10px] text-amber-700 mb-2 flex items-center gap-2">
                  <FiTrendingUp size={12} /> Acceso operativo
                </p>
                <p>
                  Usuario: <span className="font-semibold">admin@ditmonaagro.com</span>
                </p>
                <p>
                  Contraseña: <span className="font-semibold">admin123</span>
                </p>
                <p className="mt-2">Perfiles demo: <span className="font-semibold">encargado / operario / produccion / inventario / finanzas / supervisor / lectura</span> (clave: <span className="font-semibold">demo123</span>)</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
