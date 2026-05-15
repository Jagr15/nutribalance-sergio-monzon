import { FiBell, FiSearch } from "react-icons/fi";

export const Header = () => {
  return (
    <header className="h-[80px] border-b border-white/10 flex items-center justify-between px-8 bg-[#0f1722]">
      
      <div>
        <h2 className="text-2xl font-bold">
          Dashboard
        </h2>

        <p className="text-sm text-gray-400">
          Control general del sistema
        </p>
      </div>

      <div className="flex items-center gap-5">

        <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <FiSearch />
        </button>

        <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <FiBell />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-500" />

          <div>
            <h4 className="font-semibold">
              Edwin
            </h4>

            <p className="text-xs text-gray-400">
              Administrador
            </p>
          </div>
        </div>

      </div>
    </header>
  );
};