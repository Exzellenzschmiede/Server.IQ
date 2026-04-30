import { useEffect, useRef, useState } from "react";
import { listFiles, readFile, writeFile } from "../api/files";
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

type ViewMode = "view" | "edit";

export default function FilesPage() {
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [pathStack, setPathStack] = useState<(string | undefined)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [editBuffer, setEditBuffer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function navigate(path: string | undefined) {
    setLoading(true);
    setFileContent(null);
    setViewMode("view");
    setError(null);
    try {
      const r = await listFiles(path);
      setListing(r);
      setCurrentPath(path);
    } catch (e: unknown) {
      setError(errDetail(e) ?? "Fehler beim Laden");
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

  function goToSegment(index: number) {
    const parts = (currentPath ?? "/").split("/").filter(Boolean);
    const target = "/" + parts.slice(0, index + 1).join("/");
    const stackSnapshot = pathStack.slice(0, index);
    setPathStack(stackSnapshot);
    navigate(target || undefined);
  }

  async function openFile(entry: FileEntry) {
    setFileLoading(true);
    setError(null);
    setViewMode("view");
    try {
      const r = await readFile(entry.path);
      setFileContent(r);
      setEditBuffer(r.content);
    } catch (e: unknown) {
      setError(errDetail(e) ?? "Datei konnte nicht gelesen werden");
    } finally {
      setFileLoading(false);
    }
  }

  function startEdit() {
    setViewMode("edit");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setViewMode("view");
    if (fileContent) setEditBuffer(fileContent.content);
  }

  async function saveFile() {
    if (!fileContent) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await writeFile(fileContent.path, editBuffer);
      setFileContent(r);
      setViewMode("view");
      setSaveMsg({ text: "Gespeichert", ok: true });
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e: unknown) {
      setSaveMsg({ text: errDetail(e) ?? "Fehler beim Speichern", ok: false });
    } finally {
      setSaving(false);
    }
  }

  const pathParts = (currentPath ?? "/").split("/").filter(Boolean);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + breadcrumbs */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold mr-2">Dateibrowser</h1>
        {pathStack.length > 0 && (
          <button
            onClick={goBack}
            className="px-2 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
          >
            ← Zurück
          </button>
        )}
      </div>

      {/* Breadcrumb path */}
      <div className="flex flex-wrap items-center gap-1 text-xs font-mono text-slate-400">
        <button
          onClick={() => { setPathStack([]); navigate(undefined); }}
          className="hover:text-slate-200 transition-colors"
        >
          /
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-slate-600">/</span>
            <button
              onClick={() => goToSegment(i)}
              className="hover:text-slate-200 transition-colors"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {error && (
        <div className="card bg-red-600/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* File viewer / editor */}
      {(fileContent || fileLoading) && (
        <div className="card space-y-2">
          {fileContent && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-mono text-slate-400 truncate flex-1">{fileContent.path}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saveMsg && (
                    <span className={`text-xs ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {saveMsg.text}
                    </span>
                  )}
                  {viewMode === "view" ? (
                    <>
                      <button
                        onClick={startEdit}
                        className="px-3 py-1 text-xs bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/30 transition-colors"
                      >
                        ✏ Bearbeiten
                      </button>
                      <button
                        onClick={() => { setFileContent(null); setViewMode("view"); }}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={saveFile}
                        disabled={saving}
                        className="px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 disabled:opacity-50 transition-colors"
                      >
                        {saving ? "Speichert…" : "💾 Speichern"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs bg-slate-700 text-slate-400 rounded hover:bg-slate-600 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </>
                  )}
                </div>
              </div>

              {fileContent.truncated && (
                <p className="text-xs text-yellow-400">⚠ Datei zu groß — erste 2 MB angezeigt (kein Speichern möglich)</p>
              )}

              {viewMode === "view" ? (
                <pre className="text-xs font-mono text-slate-300 overflow-auto max-h-[60vh] bg-slate-900 rounded p-3 whitespace-pre-wrap break-all">
                  {fileContent.content || <span className="text-slate-600">(leer)</span>}
                </pre>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(e.target.value)}
                  disabled={saving || fileContent.truncated}
                  spellCheck={false}
                  className="w-full h-[60vh] text-xs font-mono text-slate-200 bg-slate-900 rounded p-3 border border-slate-600 focus:outline-none focus:border-indigo-500 resize-y"
                />
              )}
            </>
          )}
          {fileLoading && <p className="text-sm text-slate-500 py-4 text-center">Lade Datei…</p>}
        </div>
      )}

      {/* Directory listing */}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500 py-4 text-center">Lade…</p>
        ) : listing && listing.entries.length === 0 ? (
          <p className="text-sm text-slate-500">Verzeichnis ist leer</p>
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
                  className={`border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer ${
                    fileContent?.path === entry.path ? "bg-indigo-600/10" : ""
                  }`}
                >
                  <td className="py-1.5 pr-4">
                    <span className="mr-2 text-base">{entry.is_dir ? "📁" : "📄"}</span>
                    <span className={
                      entry.name.startsWith(".")
                        ? "text-slate-500"
                        : entry.is_dir
                        ? "text-sky-400"
                        : "text-slate-300"
                    }>
                      {entry.name}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 text-right text-slate-500 text-xs">
                    {entry.is_dir ? "—" : formatSize(entry.size)}
                  </td>
                  <td className="py-1.5 text-right text-slate-500 text-xs">{formatDate(entry.modified)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function errDetail(e: unknown): string | undefined {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
}
