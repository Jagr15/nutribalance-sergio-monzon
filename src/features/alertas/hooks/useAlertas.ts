import { useCallback, useEffect, useMemo, useState } from "react";
import { getAlertasOperativas, setEstadoAlerta } from "../services/alertasService";
import type { AlertaOperativa, EstadoAlerta, PrioridadAlerta } from "../types/alerta";

export const useAlertas = () => {
  const [alertas, setAlertas] = useState<AlertaOperativa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    void getAlertasOperativas()
      .then((rows) => {
        setAlertas(rows);
      })
      .catch((error) => {
        console.error("Error cargando alertas operativas:", error);
        setAlertas([]);
        setLoadError("No se pudieron cargar las alertas operativas.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      refresh();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  useEffect(() => {
    const handle = () => refresh();
    window.addEventListener("alertas-updated", handle);
    return () => window.removeEventListener("alertas-updated", handle);
  }, [refresh]);

  const summary = useMemo(() => {
    const pendientes = alertas.filter((a) => a.estado === "pendiente").length;
    const criticas = alertas.filter((a) => a.prioridad === "critica" && a.estado !== "atendida").length;
    const seguimiento = alertas.filter((a) => a.estado === "en seguimiento").length;
    const top = [...alertas]
      .sort((a, b) => {
        const score = (p: PrioridadAlerta) => (p === "critica" ? 3 : p === "media" ? 2 : 1);
        return score(b.prioridad) - score(a.prioridad);
      })
      .slice(0, 3);

    return { pendientes, criticas, seguimiento, top };
  }, [alertas]);

  const updateEstado = (id: string, estado: EstadoAlerta) => {
    setEstadoAlerta(id, estado);
    refresh();
  };

  return { alertas, summary, refresh, updateEstado, isLoading, loadError };
};
