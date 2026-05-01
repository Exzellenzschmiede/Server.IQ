import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Logo from "../ui/Logo";

interface NavItem { to: string; label: string; icon: string }
interface Group { key: string; label: string; items: NavItem[] }

const GROUPS: Group[] = [
  {
    key: "overview",
    label: "Overview",
    items: [
      { to: "/",       label: "Dashboard", icon: "▣" },
      { to: "/health", label: "Health",    icon: "🩺" },
    ],
  },
  {
    key: "infra",
    label: "Services & Containers",
    items: [
      { to: "/services",   label: "Services",   icon: "⚡" },
      { to: "/containers", label: "Containers", icon: "🐳" },
    ],
  },
  {
    key: "network",
    label: "Network & Security",
    items: [
      { to: "/firewall",   label: "Firewall",   icon: "🛡" },
      { to: "/fail2ban",   label: "Fail2ban",   icon: "🚫" },
      { to: "/ports",      label: "Ports",      icon: "🔌" },
      { to: "/ssl",        label: "SSL Certs",  icon: "🔒" },
      { to: "/nginx",      label: "Nginx",      icon: "🌐" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { to: "/updates",    label: "Updates",    icon: "🔄" },
      { to: "/cron",       label: "Cron Jobs",  icon: "⏰" },
      { to: "/bandwidth",  label: "Bandwidth",  icon: "📊" },
      { to: "/access-log", label: "Access Log", icon: "📡" },
      { to: "/files",      label: "Files",      icon: "📂" },
      { to: "/console",    label: "Console",    icon: ">_" },
    ],
  },
];

const ADMIN_GROUP: Group = {
  key: "admin",
  label: "Admin",
  items: [
    { to: "/notifications", label: "Notifications", icon: "🔔" },
    { to: "/cleanup",       label: "Cleanup",       icon: "🧹" },
    { to: "/power",         label: "Power",         icon: "⏻" },
    { to: "/users",         label: "Users",         icon: "👥" },
    { to: "/settings",      label: "Settings",      icon: "🔧" },
    { to: "/logs",          label: "App Logs",      icon: "📋" },
  ],
};

const LS_KEY = "sidebar_collapsed";

function loadCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")); }
  catch { return new Set(); }
}

function NavGroup({ group, collapsed, onToggle }: {
  group: Group;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 mt-1 rounded text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
      >
        {group.label}
        <span className="text-[9px] transition-transform duration-150" style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}>▾</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {group.items.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                }`
              }
            >
              <span className={icon === ">_" ? "font-mono text-xs font-bold" : "text-base leading-none"}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const groups = user?.is_admin ? [...GROUPS, ADMIN_GROUP] : GROUPS;

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-slate-800 border-r border-slate-700/50 px-3 py-4 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 mb-4">
        <Logo size={28} />
        <span className="text-indigo-400 text-xl font-bold">Server.IQ</span>
      </div>

      <nav className="flex flex-col flex-1">
        {groups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            collapsed={collapsed.has(group.key)}
            onToggle={() => toggle(group.key)}
          />
        ))}
      </nav>

      <div className="border-t border-slate-700/50 pt-3 mt-3">
        <p className="px-3 text-xs text-slate-500 truncate">{user?.name}</p>
        <p className="px-3 text-xs text-slate-600 truncate">{user?.email}</p>
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
