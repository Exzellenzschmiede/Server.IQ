import { useEffect, useRef, useState } from "react";
import { copyEntry, createDir, deleteEntry, listFiles, readFile, writeFile } from "../api/files";
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
type ModalMode = "none" | "new-file" | "new-dir" | "copy" | "delete";

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

  const [modalMode, setModalMode] = useState<ModalMode>("none");
  const [modalInput, setModalInput] = useState("");
  const [modalTarget, setModalTarget] = useState<FileEntry | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);

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
    setPathStack(pathStack.slice(0, index));
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

  function openModal(mode: ModalMode, target?: FileEntry) {
    setModalMode(mode);
    setModalTarget(target ?? null);
    setModalError(null);
    setModalInput(mode === "copy" && target ? target.path : "");
    setTimeout(() => modalInputRef.current?.focus(), 50);
  }

  function closeModal() {
    setModalMode("none");
    setModalInput("");
    setModalTarget(null);
    setModalError(null);
  }

  async function confirmModal() {
    setActionLoading(true);
    setModalError(null);
    try {
      if (modalMode === "new-file") {
        const base = currentPath ?? "";
        const path = (base + "/" + modalInput.replace(/^\/+/, "")).replace(/\/+/g, "/");
        await writeFile(path, "");
        closeModal();
        navigate(currentPath);
      } else if (modalMode === "new-dir") {
        const base = currentPath ?? "";
        const path = (base + "/" + modalInput.replace(/^\/+/, "")).replace(/\/+/g, "/");
        await createDir(path);
        closeModal();
        navigate(currentPath);
      } else if (modalMode === "copy" && modalTarget) {
        await copyEntry(modalTarget.path, modalInput);
        closeModal();
        navigate(currentPath);
      } else if (modalMode === "delete" && modalTarget) {
        await deleteEntry(modalTarget.path);
        if (fileContent?.path === modalTarget.path) setFileContent(null);
        closeModal();
        navigate(currentPath);
      }
    } catch (e: unknown) {
      setModalError(errDetail(e) ?? "Fehler");
    } finally {
      setActionLoading(false);
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
            <button onClick={() => goToSegment(i)} className="hover:text-slate-200 transition-colors">
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
        {/* Toolbar */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => openModal("new-file")}
            className="px-3 py-1 text-xs bg-indigo-600/20 text-indigo-300 rounded hover:bg-indigo-600/30 transition-colors"
          >
            + Neue Datei
          </button>
          <button
            onClick={() => openModal("new-dir")}
            className="px-3 py-1 text-xs bg-sky-600/20 text-sky-300 rounded hover:bg-sky-600/30 transition-colors"
          >
            + Neuer Ordner
          </button>
        </div>

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
                <th className="pb-2 pr-4 text-right">Geändert</th>
                <th className="pb-2 text-right">Aktionen</th>
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
                  <td className="py-1.5 pr-4 text-right text-slate-500 text-xs">{formatDate(entry.modified)}</td>
                  <td
                    className="py-1.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal("copy", entry)}
                        title="Kopieren"
                        className="px-2 py-0.5 text-xs text-slate-400 bg-slate-700/50 rounded hover:bg-slate-600 transition-colors"
                      >
                        Kopieren
                      </button>
                      <button
                        onClick={() => openModal("delete", entry)}
                        title="Löschen"
                        className="px-2 py-0.5 text-xs text-red-400 bg-red-900/20 rounded hover:bg-red-900/40 transition-colors"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalMode !== "none" && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">
              {modalMode === "new-file" && "Neue Datei anlegen"}
              {modalMode === "new-dir" && "Neuen Ordner anlegen"}
              {modalMode === "copy" && `Kopieren: ${modalTarget?.name}`}
              {modalMode === "delete" && `${modalTarget?.is_dir ? "Ordner" : "Datei"} löschen`}
            </h2>

            {modalMode === "delete" ? (
              <div className="mb-4 space-y-1">
                <p className="text-sm text-slate-400">
                  <span className="font-mono text-slate-200">{modalTarget?.path}</span>
                </p>
                {modalTarget?.is_dir && (
                  <p className="text-xs text-yellow-400">⚠ Alle enthaltenen Dateien und Unterordner werden ebenfalls gelöscht.</p>
                )}
              </div>
            ) : (
              <input
                ref={modalInputRef}
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && modalInput.trim()) confirmModal(); }}
                placeholder={
                  modalMode === "new-file" ? "Dateiname (z. B. config.txt)"
                  : modalMode === "new-dir" ? "Ordnername"
                  : "Zielpfad (absolut)"
                }
                className="w-full bg-slate-900 text-slate-200 text-sm font-mono rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-indigo-500 mb-3"
              />
            )}

            {modalError && <p className="text-xs text-red-400 mb-3">{modalError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-1.5 text-sm text-slate-400 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmModal}
                disabled={actionLoading || (modalMode !== "delete" && !modalInput.trim())}
                className={`px-4 py-1.5 text-sm rounded disabled:opacity-50 transition-colors ${
                  modalMode === "delete"
                    ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                    : "bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                }`}
              >
                {actionLoading ? "…" : modalMode === "delete" ? "Löschen" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function errDetail(e: unknown): string | undefined {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
}
