import { useEffect, useState } from "react";
import { getSslCerts, renewCert } from "../api/ssl";
import type { CertInfo, RenewResponse } from "../types/ssl";

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
  const [renewing, setRenewing] = useState<string | null>(null);
  const [renewResult, setRenewResult] = useState<Record<string, RenewResponse>>({});

  function loadCerts() {
    return getSslCerts()
      .then(setCerts)
      .catch(() => setError("Could not load SSL certificates"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCerts(); }, []);

  async function handleRenew(domain: string) {
    setRenewing(domain);
    setRenewResult((prev) => {
      const next = { ...prev };
      delete next[domain];
      return next;
    });
    try {
      const result = await renewCert(domain);
      setRenewResult((prev) => ({ ...prev, [domain]: result }));
      if (result.success) {
        // reload cert list to show updated expiry
        const fresh = await getSslCerts();
        setCerts(fresh);
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Unknown error";
      setRenewResult((prev) => ({
        ...prev,
        [domain]: { domain, success: false, output: detail },
      }));
    } finally {
      setRenewing(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-xl font-bold">SSL Certificates</h1>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {!loading && certs.length === 0 && !error && (
        <div className="card text-sm text-slate-500">
          No Let's Encrypt certificates found under <code className="text-slate-400">/etc/letsencrypt/live/</code>.
        </div>
      )}

      <div className="space-y-3">
        {certs.map((cert) => {
          const result = renewResult[cert.domain];
          const isRenewing = renewing === cert.domain;
          return (
            <div key={cert.domain} className="card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200">{cert.domain}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Valid from: {cert.not_before}</p>
                  <p className="text-xs text-slate-500">Expires: {cert.not_after}</p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${daysColor(cert.days_remaining, cert.expired)}`}>
                      {daysLabel(cert.days_remaining, cert.expired)}
                    </p>
                    <p className="text-xs text-slate-500">until expiry</p>
                  </div>
                  <button
                    onClick={() => handleRenew(cert.domain)}
                    disabled={isRenewing || renewing !== null}
                    className="px-3 py-1.5 text-xs rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isRenewing ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        Renewing…
                      </span>
                    ) : "↻ Renew"}
                  </button>
                </div>
              </div>

              {/* Status hints */}
              {!result && cert.days_remaining <= 30 && !cert.expired && (
                <p className="text-xs text-yellow-400">⚠ Renewal recommended</p>
              )}
              {!result && cert.expired && (
                <p className="text-xs text-red-400">✗ Certificate expired!</p>
              )}

              {/* Renewal result */}
              {result && (
                <div className={`rounded-lg p-3 space-y-1 ${result.success ? "bg-emerald-900/20 border border-emerald-500/20" : "bg-red-900/20 border border-red-500/20"}`}>
                  <p className={`text-xs font-semibold ${result.success ? "text-emerald-400" : "text-red-400"}`}>
                    {result.success ? "✓ Renewal successful" : "✗ Renewal failed"}
                  </p>
                  {result.output && (
                    <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {result.output}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
