import { useEffect, useState } from "react";
import { getSslCerts } from "../api/ssl";
import type { CertInfo } from "../types/ssl";

function daysColor(days: number, expired: boolean): string {
  if (expired) return "text-red-400";
  if (days <= 7) return "text-red-400";
  if (days <= 30) return "text-yellow-400";
  return "text-emerald-400";
}

function daysLabel(days: number, expired: boolean): string {
  if (expired) return "Expired";
  return `${days} days`;
}

export default function SslPage() {
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSslCerts()
      .then(setCerts)
      .catch(() => setError("Failed to load SSL certificates"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold">SSL Certificates</h1>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {!loading && certs.length === 0 && !error && (
        <div className="card text-sm text-slate-500">
          No Let's Encrypt certificates found under <code className="text-slate-400">/etc/letsencrypt/live/</code>.
        </div>
      )}

      <div className="space-y-3">
        {certs.map((cert) => (
          <div key={cert.domain} className="card flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200">{cert.domain}</p>
              <p className="text-xs text-slate-500 mt-0.5">Valid from: {cert.not_before}</p>
              <p className="text-xs text-slate-500">Expires: {cert.not_after}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${daysColor(cert.days_remaining, cert.expired)}`}>
                {daysLabel(cert.days_remaining, cert.expired)}
              </p>
              <p className="text-xs text-slate-500">remaining</p>
              {cert.days_remaining <= 30 && !cert.expired && (
                <p className="text-xs text-yellow-400 mt-1">⚠ Renewal recommended</p>
              )}
              {cert.expired && (
                <p className="text-xs text-red-400 mt-1">✗ Certificate expired!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
