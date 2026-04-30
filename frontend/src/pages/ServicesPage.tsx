import { useCallback, useEffect, useState } from "react";
import { getServices, serviceAction } from "../api/system";
import { useAuth } from "../auth/AuthContext";
import StatusBadge from "../components/ui/StatusBadge";
import Spinner from "../components/ui/Spinner";
import type { ServiceStatus } from "../types/system";

type ActionKey = "start" | "stop" | "restart";

function ServiceRow({
  service,
  isAdmin,
}: {
  service: ServiceStatus;
  isAdmin: boolean;
}) {
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  async function run(action: ActionKey) {
    setPending(action);
    setFeedback(null);
    try {
      const res = await serviceAction(service.name, action);
      setFeedback({ ok: res.success, msg: res.success ? `${action} erfolgreich` : res.message });
    } catch {
      setFeedback({ ok: false, msg: "Fehler beim Ausführen des Befehls" });
    } finally {
      setPending(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  const isActive = service.status === "active";

  return (
    <div className="py-3 px-1 space-y-1">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-medium text-sm">{service.display_name}</p>
          <p className="text-xs text-slate-500">{service.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={service.status} />
          {isAdmin && (
            <div className="flex gap-1">
              {!isActive && (
                <button
                  className="btn-primary py-0.5 px-2.5 text-xs"
                  disabled={!!pending}
                  onClick={() => run("start")}
                >
                  {pending === "start" ? <Spinner size="sm" /> : "Start"}
                </button>
              )}
              {isActive && (
                <button
                  className="btn-ghost py-0.5 px-2.5 text-xs"
                  disabled={!!pending}
                  onClick={() => run("stop")}
                >
                  {pending === "stop" ? <Spinner size="sm" /> : "Stop"}
                </button>
              )}
              <button
                className="btn-ghost py-0.5 px-2.5 text-xs"
                disabled={!!pending}
                onClick={() => run("restart")}
              >
                {pending === "restart" ? <Spinner size="sm" /> : "Restart"}
              </button>
            </div>
          )}
        </div>
      </div>
      {feedback && (
        <p className={`text-xs ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.msg}
        </p>
      )}
    </div>
  );
}

export default function ServicesPage() {
  const { user } = useAuth();
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
              Geprüft {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refresh} disabled={loading} className="btn-ghost">
            Refresh
          </button>
        </div>
      </div>

      <div className="card divide-y divide-slate-700/50">
        {loading && services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">Laden…</p>
        ) : services.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">Keine Services gefunden</p>
        ) : (
          services.map((s) => (
            <ServiceRow key={s.name} service={s} isAdmin={!!user?.is_admin} />
          ))
        )}
      </div>

      {user?.is_admin && (
        <p className="text-xs text-slate-600 px-1">
          Aktionen führen <code className="font-mono">sudo systemctl &lt;action&gt; &lt;key&gt;</code> aus.
          Der Key muss dem systemd-Dienstnamen entsprechen.
        </p>
      )}
    </div>
  );
}
