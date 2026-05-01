import { Outlet } from "react-router-dom";
import Logo from "../ui/Logo";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-2.5 px-4 py-3 bg-slate-800 border-b border-slate-700/50">
          <Logo size={24} />
          <span className="text-indigo-400 text-base font-bold">Server.IQ</span>
        </header>
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
