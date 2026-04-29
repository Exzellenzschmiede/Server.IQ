interface GaugeChartProps {
  value: number;
  label: string;
  unit?: string;
}

function color(v: number) {
  if (v < 60) return "#34d399";
  if (v < 85) return "#fbbf24";
  return "#f87171";
}

export default function GaugeChart({ value, label, unit = "%" }: GaugeChartProps) {
  const radius = 38;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 100) / 100);
  const c = color(value);

  return (
    <div className="card flex flex-col items-center gap-1 py-5">
      <svg width="100" height="58" viewBox="0 0 100 58">
        <path
          d={`M 12 50 A ${radius} ${radius} 0 0 1 88 50`}
          fill="none"
          stroke="#334155"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 12 50 A ${radius} ${radius} 0 0 1 88 50`}
          fill="none"
          stroke={c}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
        <text
          x="50"
          y="46"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f1f5f9"
          fontSize="14"
          fontWeight="bold"
        >
          {Math.round(value)}
          {unit}
        </text>
      </svg>
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}
