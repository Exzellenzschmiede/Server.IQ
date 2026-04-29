import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬛" },
  { to: "/services", label: "Services", icon: "⚙️" },
  { to: "/containers", label: "Containers", icon: "🐳" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-slate-800 border-r border-slate-700/50 px-3 py-4">
      <div className="flex items-center gap-2 px-2 mb-6">
        <span className="text-indigo-400 text-xl font-bold">Server.IQ</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-700/50 pt-3 mt-3">
        <p className="px-3 text-xs text-slate-500 truncate">{user?.username}</p>
        <button
          onClick={logout}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors mt-1"
        >
          ↩ Logout
        </button>
      </div>
    </aside>
  );
}
