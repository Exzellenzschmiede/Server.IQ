import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Logo from "../ui/Logo";

const NAV = [
  { to: "/",           label: "Dashboard",   icon: "▣" },
  { to: "/health",     label: "Health",      icon: "🩺" },
  { to: "/services",   label: "Services",    icon: "⚡" },
  { to: "/containers", label: "Containers",  icon: "🐳" },
  { to: "/firewall",   label: "Firewall",    icon: "🛡" },
  { to: "/fail2ban",   label: "Fail2ban",    icon: "🚫" },
  { to: "/ports",      label: "Ports",       icon: "🔌" },
  { to: "/ssl",        label: "SSL Certs",   icon: "🔒" },
  { to: "/cron",       label: "Cron Jobs",   icon: "⏰" },
  { to: "/updates",    label: "Updates",     icon: "🔄" },
  { to: "/bandwidth",  label: "Bandwidth",   icon: "📊" },
  { to: "/access-log", label: "Access Log",  icon: "📡" },
  { to: "/nginx",      label: "Nginx",       icon: "🌐" },
  { to: "/files",      label: "Files",       icon: "📂" },
  { to: "/console",    label: "Console",     icon: ">_" },
];

const ADMIN_NAV = [
  { to: "/notifications", label: "Notifications", icon: "🔔" },
  { to: "/cleanup",       label: "Cleanup",        icon: "🧹" },
  { to: "/power",         label: "Power",          icon: "⏻" },
  { to: "/users",         label: "Users",          icon: "👥" },
  { to: "/settings",      label: "Settings",       icon: "🔧" },
  { to: "/logs",          label: "App Logs",        icon: "📋" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-slate-800 border-r border-slate-700/50 px-3 py-4 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <Logo size={28} />
        <span className="text-indigo-400 text-xl font-bold">Server.IQ</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
              }`
            }
          >
            <span className={icon === ">_" ? "font-mono text-xs font-bold" : ""}>{icon}</span>
            {label}
          </NavLink>
        ))}

        {user?.is_admin && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Admin</span>
            </div>
            {ADMIN_NAV.map(({ to, label, icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                  }`
                }
              >
                <span>{icon}</span>{label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-slate-700/50 pt-3 mt-3">
        <p className="px-3 text-xs text-slate-500 truncate">{user?.name}</p>
        <p className="px-3 text-xs text-slate-600 truncate">{user?.email}</p>
        <button onClick={logout}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors mt-1">
          ↩ Logout
        </button>
      </div>
    </aside>
  );
}
