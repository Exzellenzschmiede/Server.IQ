import type { ServiceState } from "../../types/system";

type Status = ServiceState | string;

const COLOR: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  running: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  exited: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  unknown: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function StatusBadge({ status }: { status: Status }) {
  const cls = COLOR[status] ?? COLOR.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
