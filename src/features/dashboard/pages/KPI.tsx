import type { KPIProps } from "../components/KPI/KPI.types";

export const KPI = ({
  title,
  value,
  hint,
}: KPIProps) => {
  return (
    <div
      className="ui-card p-5"
    >
      <span className="text-xs uppercase tracking-widest text-slate-500">
        {title}
      </span>

      <h2 className="text-3xl font-bold mt-2">
        {value}
      </h2>

      <p className="text-sm text-slate-500 mt-2">
        {hint}
      </p>
    </div>
  );
};
