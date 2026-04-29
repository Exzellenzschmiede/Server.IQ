import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
