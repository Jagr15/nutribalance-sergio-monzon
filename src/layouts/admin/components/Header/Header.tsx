import { FiSearch, FiSettings } from "react-icons/fi";
import Swal from "sweetalert2";
import { getSessionUser } from "../../../../features/auth/session";
import { useAlertas } from "../../../../features/alertas/hooks/useAlertas";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../../app/config/routes";
import { BrandLogo } from "../../../../shared/components/BrandLogo";
import { buildAlertCategoryHtml, isFinancialAlert, isProductAlert } from "../../../../features/alertas/utils/alertasClasificacion";

export const Header = () => {
  const currentUser = getSessionUser();
  const { alertas } = useAlertas();
  const navigate = useNavigate();
  const criticalAlerts = alertas.filter((alerta) => alerta.prioridad === "critica" && alerta.estado !== "atendida" && alerta.estado !== "descartada");
  const financialAlerts = criticalAlerts.filter(isFinancialAlert);
  const operationalAlerts = criticalAlerts.filter(isProductAlert);
  const financialCount = financialAlerts.length;
  const operationalCount = operationalAlerts.length;

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

  const openAlertas = (kind: "financial" | "operational") => {
    const { title, description, alerts, tone, confirmButtonText, navigateTo } = kind === "financial"
      ? {
          title: "Campana financiera",
          description: "Alertas críticas relacionadas con cheques, presupuesto, descubierto, cartera y vencimientos financieros.",
          alerts: financialAlerts,
          tone: "amber" as const,
          confirmButtonText: "Ver finanzas",
          navigateTo: ROUTES.TESORERIA,
        }
      : {
          title: "Campana operativa",
          description: "Alertas críticas relacionadas con stock, producción, inventario y trazabilidad.",
          alerts: operationalAlerts,
          tone: "red" as const,
          confirmButtonText: "Ver operaciones",
          navigateTo: ROUTES.ALERTAS,
        };

    void Swal.fire({
      title,
      html: `
        <div style="text-align:left; color:#0f172a; font-size:14px; line-height:1.55;">
          <p style="margin:0; color:#64748b; font-size:14px;">${description}</p>
          <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:14px;">
            ${buildAlertCategoryHtml(
              kind === "financial" ? "Finanzas" : "Operación",
              kind === "financial"
                ? "Incluye cheques, presupuesto, descubierto, cartera, cuentas y vencimientos financieros."
                : "Incluye stock, producción, inventario, trazabilidad y órdenes operativas.",
              alerts,
              tone,
            )}
          </div>
        </div>
      `,
      background: "#ffffff",
      color: "#0f172a",
      width: "min(1040px, calc(100vw - 24px))",
      padding: "0",
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Cerrar",
      confirmButtonColor: kind === "financial" ? "#d97706" : "#dc2626",
      cancelButtonColor: "#e2e8f0",
      customClass: {
        popup: "rounded-[28px] border border-amber-200 shadow-[0_30px_90px_rgba(15,23,42,.18)] overflow-hidden",
        htmlContainer: "mx-0 px-5 pb-5",
        title: "pt-6 px-5 text-left text-2xl font-black text-slate-900",
        actions: "px-5 pb-5 justify-end gap-3",
        confirmButton: "rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold",
        cancelButton: "rounded-full bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700",
        closeButton: "text-slate-400 hover:text-slate-600",
      },
    }).then((result) => {
      if (result.isConfirmed) {
        navigate(navigateTo);
      }
    });
  };

  return (
    <header className="min-h-[104px] md:min-h-[112px] border-b border-slate-200 flex items-center justify-between px-4 md:px-8 py-3 bg-white gap-3">
      <div className="flex items-center gap-5 min-w-0">
        <BrandLogo variant="compact" className="shrink-0 max-w-[9rem]" />
        <div className="min-w-0 leading-tight">
          <h2 className="text-xl md:text-[1.7rem] font-black truncate">Ditmona Agro</h2>
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
          aria-label="Campana financiera"
          onClick={() => openAlertas("financial")}
          className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition flex items-center justify-center relative border border-amber-200"
        >
          <span className="text-base font-black">$</span>
          {financialCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
              {financialCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          aria-label="Campana operativa"
          onClick={() => openAlertas("operational")}
          className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 transition flex items-center justify-center relative border border-sky-200"
        >
          <FiSettings size={16} />
          {operationalCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
              {operationalCount}
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
