import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
    key: "hosting",
    label: "Hosting",
    items: [
      { to: "/vhosts",    label: "Virtual Hosts", icon: "🌍" },
      { to: "/databases", label: "Databases",     icon: "🗄" },
      { to: "/backups",   label: "Backups",       icon: "💾" },
      { to: "/email",     label: "Email",         icon: "✉" },
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
      { to: "/network",    label: "Network",    icon: "🛜" },
      { to: "/files",      label: "Files",      icon: "📂" },
      { to: "/console",    label: "Console",    icon: ">_" },
      { to: "/ai",         label: "AI Assistant", icon: "✦" },
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
    { to: "/ssh-keys",      label: "SSH Keys",      icon: "🔑" },
    { to: "/users",         label: "Users",         icon: "👥" },
    { to: "/audit",         label: "Audit Log",     icon: "🗒" },
    { to: "/settings",      label: "Settings",      icon: "🔧" },
    { to: "/logs",          label: "App Logs",      icon: "📋" },
  ],
};

function findActiveGroup(pathname: string, groups: Group[]): string | null {
  for (const g of groups) {
    for (const item of g.items) {
      const match = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
      if (match) return g.key;
    }
  }
  return null;
}

function NavGroup({ group, open, onToggle, onNavigate }: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 mt-1 rounded text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
      >
        {group.label}
        <span
          className="text-[9px] transition-transform duration-150"
          style={{ transform: open ? "none" : "rotate(-90deg)" }}
        >▾</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {group.items.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
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

interface SidebarProps {
  /** When true, renders as visible (mobile drawer mode — no hidden md:flex). */
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobile, onClose }: SidebarProps = {}) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const groups = user?.is_admin ? [...GROUPS, ADMIN_GROUP] : GROUPS;

  const [openKey, setOpenKey] = useState<string | null>(() => findActiveGroup(pathname, groups));

  useEffect(() => {
    const g = findActiveGroup(pathname, groups);
    if (g) setOpenKey(g);
  }, [pathname]);

  function toggle(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <aside className={`${mobile ? "flex" : "hidden md:flex"} flex-col w-64 h-screen bg-slate-800 border-r border-slate-700/50 px-3 py-4`}>
      <div className="flex items-center justify-between px-2 mb-4">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-indigo-400 text-xl font-bold">Server.IQ</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mr-1 text-xl leading-none"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="flex flex-col flex-1 overflow-y-auto min-h-0">
        {groups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            open={openKey === group.key}
            onToggle={() => toggle(group.key)}
            onNavigate={onClose}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-700/50 pt-3 mt-3">
        <p className="px-3 text-xs text-slate-500 truncate">{user?.name}</p>
        <p className="px-3 text-xs text-slate-600 truncate">{user?.email}</p>
        <button
          onClick={() => { logout(); onClose?.(); }}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors mt-1"
        >
          ↩ Logout
        </button>
      </div>
    </aside>
  );
}
