import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authenticateDemoUser, saveSession } from "../session";

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
        setError("Credenciales inválidas. Verificá usuario y contraseña.");
        return;
      }

      saveSession(user);
      navigate(redirectTo, { replace: true });
    }, 350);
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0f1722] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-bold">Nutribalance</h1>
          <p className="text-sm text-gray-400 mt-2">Sistema de Producción e Inventario</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login" className="text-sm text-gray-300 block mb-2">
              Email o usuario
            </label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="w-full bg-[#0a111b] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              placeholder="admin@nutribalance.com"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm text-gray-300 block mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-[#0a111b] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/60 disabled:cursor-not-allowed rounded-xl py-2.5 text-sm font-semibold transition"
          >
            {loading ? "Validando acceso..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-100">
          <p className="uppercase tracking-widest text-[10px] text-blue-200 mb-2">Acceso de validación</p>
          <p>Usuario: <span className="font-semibold">admin@nutribalance.com</span></p>
          <p>Contraseña: <span className="font-semibold">admin123</span></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
