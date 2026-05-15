import type { KPIProps } from "./KPI.types";

export const KPI = ({
  title,
  value,
  hint,
}: KPIProps) => {
  return (
    <div
      className="
        bg-[#141c28]
        border border-white/10
        rounded-2xl
        p-5
        shadow-xl
      "
    >
      <span className="text-xs uppercase tracking-widest text-gray-400">
        {title}
      </span>

      <h2 className="text-3xl font-bold mt-2">
        {value}
      </h2>

      <p className="text-sm text-gray-400 mt-2">
        {hint}
      </p>
    </div>
  );
};