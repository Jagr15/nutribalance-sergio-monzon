import { useState } from "react";
import Swal from "sweetalert2";
import { Card } from "../../../shared/components/card";
import { FiArrowRight, FiCheckCircle, FiSearch, FiTruck } from "react-icons/fi";

type CasoTrazabilidad = {
  id: string;
  loteMP: string;
  proveedor: string;
  insumo: string;
  orden: string;
  producto: string;
  siloDestino: string;
  cliente: string;
  estado: "Entregado" | "Trazado";
  consumoUsadoKg: number;
  productoGeneradoKg: number;
  costoAsociadoArs: number;
};

const casos: CasoTrazabilidad[] = [
  {
    id: "caso-1",
    loteMP: "MAIZ-2026-001",
    proveedor: "Agro Insumos Pampeanos",
    insumo: "Maíz",
    orden: "OP-2026-103",
    producto: "Alimento Lechera",
    siloDestino: "Silo Lechera",
    cliente: "Estancia La Esperanza",
    estado: "Entregado",
    consumoUsadoKg: 12500,
    productoGeneradoKg: 11800,
    costoAsociadoArs: 2415800,
  },
  {
    id: "caso-2",
    loteMP: "SOJA-2026-014",
    proveedor: "Agro Insumos Pampeanos",
    insumo: "Harina de soja",
    orden: "OP-2026-109",
    producto: "Pellet Cerdo Crecimiento",
    siloDestino: "Silo PT-02",
    cliente: "Feedlot Los Álamos",
    estado: "Trazado",
    consumoUsadoKg: 9400,
    productoGeneradoKg: 8800,
    costoAsociadoArs: 2269000,
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const TrazabilidadPage = () => {
  const [selectedId, setSelectedId] = useState(casos[0].id);
  const caso = casos.find((item) => item.id === selectedId) || casos[0];

  const openRecorrido = () => {
    void Swal.fire({
      title: `Recorrido completo · ${caso.orden}`,
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <p style="margin:0 0 8px;"><strong>Origen:</strong> ${caso.loteMP} (${caso.insumo}) · ${caso.proveedor}</p>
          <p style="margin:0 0 8px;"><strong>Transformación:</strong> Orden ${caso.orden} en ${caso.siloDestino}</p>
          <p style="margin:0 0 8px;"><strong>Resultado:</strong> ${caso.producto} · ${caso.productoGeneradoKg.toLocaleString("es-AR")} kg</p>
          <p style="margin:0 0 8px;"><strong>Destino comercial:</strong> ${caso.cliente}</p>
          <p style="margin:0;"><strong>Costo asociado:</strong> ${formatCurrency(caso.costoAsociadoArs)}</p>
        </div>
      `,
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Cerrar",
    });
  };

  const openConsultaLote = () => {
    void Swal.fire({
      title: `Consulta por lote · ${caso.loteMP}`,
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <p style="margin:0 0 8px;"><strong>Proveedor:</strong> ${caso.proveedor}</p>
          <p style="margin:0 0 8px;"><strong>Insumo:</strong> ${caso.insumo}</p>
          <p style="margin:0 0 8px;"><strong>Consumo usado:</strong> ${caso.consumoUsadoKg.toLocaleString("es-AR")} kg</p>
          <p style="margin:0 0 8px;"><strong>Orden vinculada:</strong> ${caso.orden}</p>
          <p style="margin:0;"><strong>Producto generado:</strong> ${caso.producto}</p>
        </div>
      `,
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Cerrar",
    });
  };

  const openConsultaCliente = () => {
    void Swal.fire({
      title: `Consulta por cliente · ${caso.cliente}`,
      html: `
        <div style="text-align:left; color:#f8fafc; font-size:14px;">
          <p style="margin:0 0 8px;"><strong>Producto recibido:</strong> ${caso.producto}</p>
          <p style="margin:0 0 8px;"><strong>Orden de origen:</strong> ${caso.orden}</p>
          <p style="margin:0 0 8px;"><strong>Lote de materia prima:</strong> ${caso.loteMP}</p>
          <p style="margin:0 0 8px;"><strong>Silo despacho:</strong> ${caso.siloDestino}</p>
          <p style="margin:0;"><strong>Estado:</strong> ${caso.estado}</p>
        </div>
      `,
      background: "#0d121b",
      color: "#fff",
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Cerrar",
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm uppercase tracking-widest text-blue-400">Control de trazabilidad</p>
        <h1 className="text-3xl font-bold mt-2">Trazabilidad</h1>
        <p className="text-gray-400 mt-2">Seguimiento visual desde lote de materia prima hasta cliente final.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {casos.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={`text-left rounded-2xl border p-4 transition ${selectedId === item.id ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-[#141c28] hover:bg-white/5"}`}
          >
            <p className="text-xs uppercase tracking-widest text-gray-400">Caso de trazabilidad</p>
            <h3 className="text-lg font-bold mt-1">{item.loteMP}</h3>
            <p className="text-sm text-gray-400 mt-1">{item.producto} · {item.cliente}</p>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <Card className="xl:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Flujo de trazabilidad</h2>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
            <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-400 uppercase">Lote MP</p>
              <p className="font-semibold mt-1">{caso.loteMP}</p>
              <p className="text-xs text-gray-400 mt-1">{caso.insumo}</p>
            </div>
            <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-400 uppercase">Orden</p>
              <p className="font-semibold mt-1">{caso.orden}</p>
            </div>
            <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-400 uppercase">Producto</p>
              <p className="font-semibold mt-1">{caso.producto}</p>
            </div>
            <div className="flex justify-center"><FiArrowRight className="text-blue-400" /></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-400 uppercase">Cliente</p>
              <p className="font-semibold mt-1">{caso.cliente}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold mb-2">Consulta hacia adelante</h3>
              <p className="text-sm text-gray-300">Desde {caso.loteMP} se consumió materia prima en {caso.orden}, generando {caso.producto} con destino {caso.cliente}.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-semibold mb-2">Consulta hacia atrás</h3>
              <p className="text-sm text-gray-300">Desde el cliente {caso.cliente} se rastrea la orden {caso.orden} hasta el lote de origen {caso.loteMP}.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button type="button" onClick={openRecorrido} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-medium inline-flex items-center gap-2">
              <FiTruck size={14} /> Ver recorrido completo
            </button>
            <button type="button" onClick={openConsultaLote} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiSearch size={14} /> Consultar por lote
            </button>
            <button type="button" onClick={openConsultaCliente} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium inline-flex items-center gap-2">
              <FiSearch size={14} /> Consultar por cliente
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Resumen lateral</h2>
          <div className="space-y-3 text-sm">
            <p><span className="text-gray-400">Lote origen:</span> {caso.loteMP}</p>
            <p><span className="text-gray-400">Consumo usado:</span> {caso.consumoUsadoKg.toLocaleString("es-AR")} kg</p>
            <p><span className="text-gray-400">Producto generado:</span> {caso.productoGeneradoKg.toLocaleString("es-AR")} kg</p>
            <p><span className="text-gray-400">Cliente destino:</span> {caso.cliente}</p>
            <p><span className="text-gray-400">Costo asociado ARS:</span> {formatCurrency(caso.costoAsociadoArs)}</p>
            <div className="pt-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 inline-flex items-center gap-1">
                <FiCheckCircle size={12} /> {caso.estado} / Trazado
              </span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default TrazabilidadPage;
