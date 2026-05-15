import type { ReactNode } from "react";

import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";

interface Props {
  children: ReactNode;
}

export const AdminLayout = ({ children }: Props) => {
  return (
    <div className="flex bg-[#0a0e14] text-white min-h-screen">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="p-8 flex-1 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  );
};