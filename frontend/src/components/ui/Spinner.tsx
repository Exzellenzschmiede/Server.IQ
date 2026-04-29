interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  const cls = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-10 h-10 border-4",
  }[size];

  return (
    <div
      className={`${cls} border-slate-600 border-t-indigo-500 rounded-full animate-spin`}
    />
  );
}
