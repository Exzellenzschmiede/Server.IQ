export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#0f172a"/>
      <rect x="5" y="7" width="22" height="5.5" rx="1.5" fill="#475569"/>
      <rect x="5" y="13.25" width="22" height="5.5" rx="1.5" fill="#6366f1"/>
      <rect x="5" y="19.5" width="22" height="5.5" rx="1.5" fill="#475569"/>
      <circle cx="23" cy="9.75" r="1.5" fill="#4ade80"/>
      <circle cx="23" cy="16" r="1.5" fill="#e2e8f0"/>
      <circle cx="23" cy="22.25" r="1.5" fill="#fbbf24"/>
      <path d="M6 16 L10 16 L12 13.5 L15 18.5 L17 16 L26 16"
        stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
    </svg>
  );
}
