import { useState } from "react";
import { Outlet } from "react-router-dom";
import Logo from "../ui/Logo";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel — slides in from left */}
          <div className="relative z-10 overflow-y-auto shadow-2xl">
            <Sidebar mobile onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-indigo-400 text-base font-bold">Server.IQ</span>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col gap-1 p-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Open menu"
          >
            <span className="block w-5 h-0.5 bg-current rounded" />
            <span className="block w-5 h-0.5 bg-current rounded" />
            <span className="block w-5 h-0.5 bg-current rounded" />
          </button>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
