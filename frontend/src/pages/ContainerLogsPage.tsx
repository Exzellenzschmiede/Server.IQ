import { useNavigate, useParams } from "react-router-dom";
import LogViewer from "../components/containers/LogViewer";
import { useContainerLogs } from "../hooks/useContainerLogs";

export default function ContainerLogsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lines, connected, clear, reconnect } = useContainerLogs(id ?? "");

  if (!id) return null;

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-0px)]">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700/50">
        <button
          onClick={() => navigate("/containers")}
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          ← Back
        </button>
        <span className="text-sm font-medium truncate">
          Logs — <span className="font-mono text-slate-400">{id.slice(0, 12)}</span>
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <LogViewer
          lines={lines}
          connected={connected}
          onClear={clear}
          onReconnect={reconnect}
        />
      </div>
    </div>
  );
}
