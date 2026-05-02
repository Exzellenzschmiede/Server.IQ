import { useEffect, useState } from "react";
import {
  createConnection, createDatabase, createUser, deleteConnection,
  dropDatabase, dropUser, grantPrivileges, listConnections,
  listDatabases, listTables, listUsers, runQuery,
} from "../api/databases";
import type { DBConnection, DatabaseInfo, DBUserInfo, QueryResult, TableInfo } from "../api/databases";
import Spinner from "../components/ui/Spinner";

function fmt(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function DatabasePage() {
  const [connections, setConnections] = useState<DBConnection[]>([]);
  const [selectedConn, setSelectedConn] = useState<DBConnection | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [users, setUsers] = useState<DBUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [tab, setTab] = useState<"databases" | "users" | "query">("databases");

  // SQL
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);

  // Add connection form
  const [showConnForm, setShowConnForm] = useState(false);
  const [connForm, setConnForm] = useState({ name: "", db_type: "postgresql", host: "127.0.0.1", port: 5432, username: "postgres", password: "" });
  const [connSaving, setConnSaving] = useState(false);

  // Add DB / User
  const [newDbName, setNewDbName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [grantDb, setGrantDb] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    listConnections().then(setConnections).finally(() => setLoading(false));
  }, []);

  async function selectConn(conn: DBConnection) {
    setSelectedConn(conn); setSelectedDb(null); setTables([]); setTab("databases");
    setDbLoading(true);
    try {
      const [dbs, us] = await Promise.all([listDatabases(conn.id), conn.db_type === "postgresql" ? listUsers(conn.id) : Promise.resolve([])]);
      setDatabases(dbs); setUsers(us);
    } finally { setDbLoading(false); }
  }

  async function selectDb(name: string) {
    setSelectedDb(name); setTableLoading(true);
    try { setTables(await listTables(selectedConn!.id, name)); }
    finally { setTableLoading(false); }
  }

  async function handleAddConn(e: React.FormEvent) {
    e.preventDefault(); setConnSaving(true);
    try {
      const c = await createConnection({ ...connForm, port: Number(connForm.port) });
      setConnections(p => [...p, c]);
      setShowConnForm(false);
    } finally { setConnSaving(false); }
  }

  async function handleDeleteConn(id: number) {
    if (!confirm("Remove this connection?")) return;
    await deleteConnection(id);
    setConnections(p => p.filter(c => c.id !== id));
    if (selectedConn?.id === id) setSelectedConn(null);
  }

  async function handleCreateDb(e: React.FormEvent) {
    e.preventDefault(); setActionError("");
    try {
      await createDatabase(selectedConn!.id, newDbName);
      setDatabases(p => [...p, { name: newDbName, size_bytes: null, owner: null }]);
      setNewDbName("");
    } catch (err: unknown) {
      setActionError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error");
    }
  }

  async function handleDropDb(name: string) {
    if (!confirm(`Drop database '${name}'? This is irreversible.`)) return;
    await dropDatabase(selectedConn!.id, name);
    setDatabases(p => p.filter(d => d.name !== name));
    if (selectedDb === name) { setSelectedDb(null); setTables([]); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault(); setActionError("");
    try {
      await createUser(selectedConn!.id, newUsername, newPassword);
      setUsers(p => [...p, { username: newUsername, superuser: false }]);
      setNewUsername(""); setNewPassword("");
    } catch (err: unknown) {
      setActionError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error");
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault(); setActionError("");
    try { await grantPrivileges(selectedConn!.id, newUsername, grantDb); setGrantDb(""); }
    catch (err: unknown) { setActionError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error"); }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault(); setQuerying(true);
    try { setQueryResult(await runQuery(selectedConn!.id, sql, selectedDb ?? undefined)); }
    finally { setQuerying(false); }
  }

  return (
    <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 h-full max-h-screen overflow-hidden">
      {/* Connection sidebar */}
      <div className="md:w-56 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold">Databases</h1>
          <button onClick={() => setShowConnForm(v => !v)} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add</button>
        </div>
        {loading ? <Spinner /> : connections.map(c => (
          <button key={c.id} onClick={() => selectConn(c)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedConn?.id === c.id ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"}`}>
            <div className="font-medium truncate">{c.name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{c.db_type} · {c.host}:{c.port}</div>
            <button onClick={e => { e.stopPropagation(); handleDeleteConn(c.id); }}
              className="text-[10px] text-red-400 hover:text-red-300 mt-1">Remove</button>
          </button>
        ))}
        {connections.length === 0 && !loading && (
          <p className="text-xs text-slate-500 px-1">No connections yet.</p>
        )}

        {/* Add connection form */}
        {showConnForm && (
          <form onSubmit={handleAddConn} className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
            <p className="font-semibold text-slate-300">New connection</p>
            {[
              { label: "Name", key: "name", type: "text", placeholder: "Local PG" },
              { label: "Host", key: "host", type: "text", placeholder: "127.0.0.1" },
              { label: "Port", key: "port", type: "number", placeholder: "5432" },
              { label: "User", key: "username", type: "text", placeholder: "postgres" },
              { label: "Password", key: "password", type: "password", placeholder: "" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-500">{f.label}</label>
                <input type={f.type} value={(connForm as never)[f.key]} placeholder={f.placeholder}
                  onChange={e => setConnForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
              </div>
            ))}
            <div>
              <label className="text-slate-500">Type</label>
              <select value={connForm.db_type} onChange={e => setConnForm(p => ({ ...p, db_type: e.target.value }))}
                className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500">
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            <button type="submit" disabled={connSaving} className="w-full btn-primary py-1 text-xs">
              {connSaving ? <Spinner size="sm" /> : "Save"}
            </button>
          </form>
        )}
      </div>

      {/* Main panel */}
      {selectedConn ? (
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          <div className="flex gap-2 border-b border-slate-700 pb-2 shrink-0">
            {(["databases", "users", "query"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${tab === t ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"}`}>
                {t}
              </button>
            ))}
          </div>

          {dbLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <>
              {/* Databases tab */}
              {tab === "databases" && (
                <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
                  <div className="w-64 shrink-0 overflow-y-auto space-y-1">
                    <form onSubmit={handleCreateDb} className="flex gap-1 mb-2">
                      <input value={newDbName} onChange={e => setNewDbName(e.target.value)}
                        placeholder="New database name" required
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
                      <button type="submit" className="btn-primary px-2 py-1 text-xs">+</button>
                    </form>
                    {databases.map(d => (
                      <div key={d.name} className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${selectedDb === d.name ? "bg-indigo-600/20 text-indigo-300" : "hover:bg-slate-700/50 text-slate-300"}`}
                        onClick={() => selectDb(d.name)}>
                        <span className="font-mono">{d.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500">{fmt(d.size_bytes)}</span>
                          <button onClick={e => { e.stopPropagation(); handleDropDb(d.name); }} className="text-red-400 hover:text-red-300">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {selectedDb ? (
                      tableLoading ? <Spinner /> : (
                        <div>
                          <p className="text-xs text-slate-500 mb-2">{tables.length} table{tables.length !== 1 ? "s" : ""} in <code className="text-indigo-300">{selectedDb}</code></p>
                          <table className="w-full text-xs">
                            <thead><tr className="text-left text-slate-500 border-b border-slate-700">
                              <th className="pb-1 pr-4">Table</th><th className="pb-1 pr-4">Rows (est.)</th><th className="pb-1">Size</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-700/30">
                              {tables.map(t => (
                                <tr key={t.name} className="text-slate-300">
                                  <td className="py-1 pr-4 font-mono">{t.name}</td>
                                  <td className="py-1 pr-4 text-slate-400">{t.row_estimate?.toLocaleString() ?? "—"}</td>
                                  <td className="py-1 text-slate-400">{fmt(t.size_bytes)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : <p className="text-xs text-slate-500">Select a database to view tables.</p>}
                  </div>
                </div>
              )}

              {/* Users tab */}
              {tab === "users" && (
                <div className="space-y-4 overflow-y-auto">
                  {actionError && <p className="text-xs text-red-400">{actionError}</p>}
                  <div className="flex gap-3 flex-wrap">
                    <form onSubmit={handleCreateUser} className="flex gap-2 items-end flex-wrap">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">New user</label>
                        <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username" required
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••" required
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500" />
                      </div>
                      <button type="submit" className="btn-primary px-3 py-1.5 text-xs">Create</button>
                    </form>
                    <form onSubmit={handleGrant} className="flex gap-2 items-end flex-wrap">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Grant <code>{newUsername || "user"}</code> on</label>
                        <select value={grantDb} onChange={e => setGrantDb(e.target.value)} required
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500">
                          <option value="">Select database…</option>
                          {databases.map(d => <option key={d.name}>{d.name}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="btn-secondary px-3 py-1.5 text-xs">Grant all</button>
                    </form>
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-slate-500 border-b border-slate-700">
                      <th className="pb-1 pr-4">Username</th><th className="pb-1 pr-4">Superuser</th><th className="pb-1" />
                    </tr></thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {users.map(u => (
                        <tr key={u.username} className="text-slate-300">
                          <td className="py-1 pr-4 font-mono">{u.username}</td>
                          <td className="py-1 pr-4">{u.superuser ? <span className="text-amber-400">yes</span> : "—"}</td>
                          <td className="py-1 text-right">
                            <button onClick={() => { if (confirm(`Drop user '${u.username}'?`)) dropUser(selectedConn.id, u.username).then(() => setUsers(p => p.filter(x => x.username !== u.username))); }}
                              className="text-red-400 hover:text-red-300 text-[10px]">Drop</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Query tab */}
              {tab === "query" && (
                <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
                  <form onSubmit={handleQuery} className="flex gap-2 shrink-0">
                    <textarea value={sql} onChange={e => setSql(e.target.value)} rows={3}
                      placeholder="SELECT * FROM pg_tables LIMIT 20;"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none" />
                    <button type="submit" disabled={querying || !sql.trim()} className="btn-primary px-4 text-sm self-end disabled:opacity-40">
                      {querying ? <Spinner size="sm" /> : "Run"}
                    </button>
                  </form>
                  {queryResult && (
                    <div className="flex-1 overflow-auto min-h-0">
                      {queryResult.error
                        ? <p className="text-xs text-red-400 font-mono">{queryResult.error}</p>
                        : (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">{queryResult.rowcount} row{queryResult.rowcount !== 1 ? "s" : ""}</p>
                            <div className="overflow-x-auto">
                              <table className="text-xs w-max">
                                <thead><tr className="text-left text-slate-500 border-b border-slate-700">
                                  {queryResult.columns.map(c => <th key={c} className="pb-1 pr-4 font-mono">{c}</th>)}
                                </tr></thead>
                                <tbody className="divide-y divide-slate-700/20">
                                  {queryResult.rows.map((row, i) => (
                                    <tr key={i} className="text-slate-300">
                                      {row.map((v, j) => <td key={j} className="py-0.5 pr-4 font-mono max-w-xs truncate">{v ?? <span className="text-slate-600">NULL</span>}</td>)}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          Select a connection on the left to get started.
        </div>
      )}
    </div>
  );
}
