import { useCallback, useEffect, useState } from "react";
import { getServices } from "../api/system";
import StatusBadge from "../components/ui/StatusBadge";
import type { ServiceStatus } from "../types/system";

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getServices()
      .then((res) => {
        setServices(res.services);
        setLastChecked(new Date());
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Services</h1>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">
              Checked {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} disabled={loading} className="btn-ghost">
            Refresh
          </button>
        </div>
      </div>

      <div className="card divide-y divide-slate-700/50">
        {loading && services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">Loading…</p>
        ) : services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">No services found</p>
        ) : (
          services.map((s) => (
            <div key={s.name} className="flex items-center justify-between py-3 px-1 gap-4">
              <div>
                <p className="font-medium text-sm">{s.display_name}</p>
                <p className="text-xs text-slate-500">{s.name}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
