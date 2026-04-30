import { useEffect, useState } from "react";
import { listFiles, readFile } from "../api/files";
import type { FileContentResponse, FileEntry, FileListResponse } from "../types/files";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export default function FilesPage() {
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [pathStack, setPathStack] = useState<(string | undefined)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  async function navigate(path: string | undefined) {
    setLoading(true);
    setFileContent(null);
    setError(null);
    try {
      const r = await listFiles(path);
      setListing(r);
      setCurrentPath(path);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { navigate(undefined); }, []);

  function openDir(entry: FileEntry) {
    setPathStack((prev) => [...prev, currentPath]);
    navigate(entry.path);
  }

  function goBack() {
    const stack = [...pathStack];
    const prev = stack.pop();
    setPathStack(stack);
    navigate(prev);
  }

  async function openFile(entry: FileEntry) {
    setFileLoading(true);
    setError(null);
    try {
      const r = await readFile(entry.path);
      setFileContent(r);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Datei konnte nicht gelesen werden");
    } finally {
      setFileLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Dateibrowser</h1>
        {pathStack.length > 0 && (
          <button
            onClick={goBack}
            className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
          >
            ← Zurück
          </button>
        )}
      </div>

      {listing && (
        <p className="text-xs text-slate-500 font-mono">
          {currentPath ?? "/"} —{" "}
          <span className="text-slate-400">
            Erlaubte Pfade: {listing.allowed_roots.join(", ")}
          </span>
        </p>
      )}

      {error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* File viewer */}
      {fileContent && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono text-slate-400 truncate">{fileContent.path}</p>
            <button
              onClick={() => setFileContent(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              ✕ Schließen
            </button>
          </div>
          {fileContent.truncated && (
            <p className="text-xs text-yellow-400 mb-2">⚠ Datei zu groß — erste 512 KB angezeigt</p>
          )}
          <pre className="text-xs font-mono text-slate-300 overflow-auto max-h-96 bg-slate-900 rounded p-3 whitespace-pre-wrap break-all">
            {fileContent.content}
          </pre>
        </div>
      )}

      {fileLoading && (
        <div className="card text-sm text-slate-500">Datei wird geladen…</div>
      )}

      {/* Directory listing */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Lade…</p>
        ) : listing && listing.entries.length === 0 ? (
          <p className="text-sm text-slate-500">Leer</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4 text-right">Größe</th>
                <th className="pb-2 text-right">Geändert</th>
              </tr>
            </thead>
            <tbody>
              {listing?.entries.map((entry) => (
                <tr
                  key={entry.path}
                  onClick={() => (entry.is_dir ? openDir(entry) : openFile(entry))}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer"
                >
                  <td className="py-2 pr-4">
                    <span className="mr-2">{entry.is_dir ? "📁" : "📄"}</span>
                    <span className={entry.is_dir ? "text-sky-400" : "text-slate-300"}>{entry.name}</span>
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-500 text-xs">
                    {entry.is_dir ? "—" : formatSize(entry.size)}
                  </td>
                  <td className="py-2 text-right text-slate-500 text-xs">{formatDate(entry.modified)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
