import { useState } from "react";
import {
  reinstallContainer,
  removeContainer,
  restartContainer,
  startContainer,
  stopContainer,
} from "../../api/docker";
import type { ContainerInfo } from "../../types/docker";
import Spinner from "../ui/Spinner";

interface Props {
  container: ContainerInfo;
  onRefresh: () => void;
  onViewLogs?: () => void;
}

type Action = "start" | "stop" | "restart" | "remove" | "reinstall" | null;

export default function ContainerActions({ container, onRefresh, onViewLogs }: Props) {
  const [pending, setPending] = useState<Action>(null);
  const [confirm, setConfirm] = useState<"remove" | "reinstall" | null>(null);

  const run = async (action: Action, fn: () => Promise<unknown>) => {
    if (!action) return;
    setPending(action);
    try {
      await fn();
      onRefresh();
    } catch {
      /* swallow — could add toast later */
    } finally {
      setPending(null);
      setConfirm(null);
    }
  };

  const isRunning = container.status === "running";

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {isRunning ? (
          <button
            className="btn-ghost"
            disabled={!!pending}
            onClick={() => run("stop", () => stopContainer(container.id))}
          >
            {pending === "stop" ? <Spinner size="sm" /> : "Stop"}
          </button>
        ) : (
          <button
            className="btn-primary"
            disabled={!!pending}
            onClick={() => run("start", () => startContainer(container.id))}
          >
            {pending === "start" ? <Spinner size="sm" /> : "Start"}
          </button>
        )}

        {isRunning && (
          <button
            className="btn-ghost"
            disabled={!!pending}
            onClick={() => run("restart", () => restartContainer(container.id))}
          >
            {pending === "restart" ? <Spinner size="sm" /> : "Restart"}
          </button>
        )}

        {onViewLogs && (
          <button className="btn-ghost" onClick={onViewLogs}>
            Logs
          </button>
        )}

        <button
          className="btn-ghost"
          disabled={!!pending}
          onClick={() => setConfirm("reinstall")}
        >
          Reinstall
        </button>

        <button
          className="btn-danger"
          disabled={!!pending}
          onClick={() => setConfirm("remove")}
        >
          Delete
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="card max-w-sm w-full space-y-4">
            <h3 className="font-semibold text-lg capitalize">
              {confirm} {container.name}?
            </h3>
            <p className="text-sm text-slate-400">
              {confirm === "remove"
                ? "This will permanently delete the container. This cannot be undone."
                : "This will stop the container, pull the latest image, and recreate it."}
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className={confirm === "remove" ? "btn-danger" : "btn-primary"}
                disabled={!!pending}
                onClick={() => {
                  if (confirm === "remove") {
                    run("remove", () => removeContainer(container.id, true));
                  } else {
                    run("reinstall", () => reinstallContainer(container.id));
                  }
                }}
              >
                {pending ? <Spinner size="sm" /> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
