import type{ CardProps } from "./Card.types";

export const Card = ({
  children,
  className = "",
}: CardProps) => {
  return (
    <div
      className={`
        bg-white
        border border-slate-200
        rounded-2xl
        p-6
        shadow-[0_8px_28px_rgba(15,23,42,0.08)]
        transition-all duration-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)] hover:-translate-y-[1px]
        ${className}
      `}
    >
      {children}
    </div>
  );
};
