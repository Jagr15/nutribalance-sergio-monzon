import type{ CardProps } from "./Card.types";

export const Card = ({
  children,
  className = "",
}: CardProps) => {
  return (
    <div
      className={`
        bg-[#141c28]
        border border-white/10
        rounded-2xl
        p-6
        shadow-xl
        ${className}
      `}
    >
      {children}
    </div>
  );
};