import { FiBell, FiSearch } from "react-icons/fi";
import Swal from "sweetalert2";
import { getSessionUser } from "../../../../features/auth/session";
import { useAlertas } from "../../../../features/alertas/hooks/useAlertas";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../../app/config/routes";
import { BrandLogo } from "../../../../shared/components/BrandLogo";

const getPriorityColor = (priority: string) => {
  if (priority === "critica") return "#f87171";
  if (priority === "media") return "#fb923c";
  return "#60a5fa";
};

export const Header = () => {
  const currentUser = getSessionUser();
  const { summary } = useAlertas();
  const navigate = useNavigate();

  const showInfo = (feature: string) => {
    void Swal.fire({
      icon: "info",
      title: "Configuración avanzada",
      text: `${feature} está pendiente de integración avanzada.`,
      background: "#ffffff",
      color: "#0f172a",
      confirmButtonColor: "#2563eb",
    });
  };

  const openAlertas = () => {
    const top = summary.top
      .map(
        (alerta) => `
          <div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px; color:${getPriorityColor(alerta.prioridad)}; font-weight:700; text-transform:uppercase; font-size:11px;">${alerta.prioridad} · ${alerta.area}</p>
            <p style="margin:0 0 6px; font-weight:700;">${alerta.titulo}</p>
            <p style="margin:0; color:#475569; font-size:12px;">${alerta.accionRecomendada}</p>
          </div>
        `
      )
      .join("");

    void Swal.fire({
      title: "Alertas operativas",
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px;">
          ${top}
          <p style="margin:12px 0 0; color:#93c5fd;">Críticas activas: ${summary.criticas} · Pendientes: ${summary.pendientes}</p>
        </div>
      `,
      background: "#ffffff",
      color: "#0f172a",
      showCancelButton: true,
      confirmButtonText: "Ver centro de alertas",
      cancelButtonText: "Cerrar",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#94a3b8",
    }).then((result) => {
      if (result.isConfirmed) {
        navigate(ROUTES.ALERTAS);
      }
    });
  };

  return (
    <header className="min-h-[72px] md:h-[80px] border-b border-slate-200 flex items-center justify-between px-4 md:px-8 py-3 bg-white gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <BrandLogo variant="compact" className="shrink-0" />
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold truncate">Nutribalance</h2>
          <p className="hidden md:block text-sm text-slate-500">Sistema de Producción e Inventario</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-5">
        <button
          type="button"
          aria-label="Buscar"
          onClick={() => showInfo("Búsqueda global")}
          className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center"
        >
          <FiSearch />
        </button>

        <button
          type="button"
          aria-label="Notificaciones"
          onClick={openAlertas}
          className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center relative"
        >
          <FiBell />
          {summary.criticas > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {summary.criticas}
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-blue-500" />

          <div className="hidden sm:block">
            <h4 className="font-semibold">{currentUser.name}</h4>
            <p className="text-xs text-slate-500">{currentUser.roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
