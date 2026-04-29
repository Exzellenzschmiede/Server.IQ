interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: "indigo" | "emerald" | "amber" | "rose";
}

const COLORS = {
  indigo: "text-indigo-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

export default function MetricCard({
  label,
  value,
  sub,
  icon,
  color = "indigo",
}: MetricCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`text-3xl ${COLORS[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}
