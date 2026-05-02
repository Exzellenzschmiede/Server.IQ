import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/",           label: "Dashboard",  icon: "▣",  mono: false },
  { to: "/services",   label: "Services",   icon: "⚡", mono: false },
  { to: "/containers", label: "Containers", icon: "🐳", mono: false },
  { to: "/console",    label: "Console",    icon: ">_", mono: true  },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700/50 flex safe-area-inset-bottom z-40">
      {NAV.map(({ to, label, icon, mono }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
              isActive ? "text-indigo-400" : "text-slate-500"
            }`
          }
        >
          <span className={mono ? "font-mono text-sm font-bold leading-none" : "text-lg leading-none"}>{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
