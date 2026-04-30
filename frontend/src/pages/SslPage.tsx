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
  if (expired) return "Abgelaufen";
  return `${days} Tage`;
}

export default function SslPage() {
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSslCerts()
      .then(setCerts)
      .catch(() => setError("SSL-Zertifikate konnten nicht geladen werden"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-bold">SSL-Zertifikate</h1>

      {loading && <p className="text-sm text-slate-500">Lade…</p>}
      {error && <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {!loading && certs.length === 0 && !error && (
        <div className="card text-sm text-slate-500">
          Keine Let's-Encrypt-Zertifikate unter <code className="text-slate-400">/etc/letsencrypt/live/</code> gefunden.
        </div>
      )}

      <div className="space-y-3">
        {certs.map((cert) => (
          <div key={cert.domain} className="card flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200">{cert.domain}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Gültig ab: {cert.not_before}
              </p>
              <p className="text-xs text-slate-500">
                Läuft ab: {cert.not_after}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${daysColor(cert.days_remaining, cert.expired)}`}>
                {daysLabel(cert.days_remaining, cert.expired)}
              </p>
              <p className="text-xs text-slate-500">bis Ablauf</p>
              {cert.days_remaining <= 30 && !cert.expired && (
                <p className="text-xs text-yellow-400 mt-1">⚠ Erneuerung empfohlen</p>
              )}
              {cert.expired && (
                <p className="text-xs text-red-400 mt-1">✗ Zertifikat abgelaufen!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
