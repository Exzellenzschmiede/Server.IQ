import { useEffect, useState } from "react";
import {
  createAlias, createMailbox, deleteAlias, deleteMailbox,
  deleteQueueItem, flushMailQueue, getMailQueue, getMailStatus,
  listAliases, listMailboxes,
} from "../api/email";
import type { MailAlias, Mailbox, MailQueueItem, MailStatus } from "../api/email";
import Spinner from "../components/ui/Spinner";

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
}

export default function EmailPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [tab, setTab] = useState<"mailboxes" | "aliases" | "queue">("mailboxes");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [aliases, setAliases] = useState<MailAlias[]>([]);
  const [queue, setQueue] = useState<MailQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState("");

  // New mailbox
  const [mbEmail, setMbEmail] = useState("");
  const [mbPassword, setMbPassword] = useState("");
  const [mbCreating, setMbCreating] = useState(false);
  const [mbError, setMbError] = useState("");

  // New alias
  const [aliasSource, setAliasSource] = useState("");
  const [aliasDest, setAliasDest] = useState("");
  const [aliasCreating, setAliasCreating] = useState(false);
  const [aliasError, setAliasError] = useState("");

  useEffect(() => {
    getMailStatus().then(setStatus).catch(() => setError("Failed to check mail status.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!status?.postfix_installed) return;
    loadTab();
  }, [tab, status]);

  async function loadTab() {
    setTabLoading(true);
    try {
      if (tab === "mailboxes") setMailboxes(await listMailboxes());
      else if (tab === "aliases") setAliases(await listAliases());
      else setQueue(await getMailQueue());
    } finally { setTabLoading(false); }
  }

  async function handleAddMailbox(e: React.FormEvent) {
    e.preventDefault(); setMbCreating(true); setMbError("");
    try {
      await createMailbox(mbEmail, mbPassword);
      setMailboxes(p => [...p, { email: mbEmail, domain: mbEmail.split("@")[1], local_part: mbEmail.split("@")[0] }]);
      setMbEmail(""); setMbPassword("");
    } catch (err: unknown) {
      setMbError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create mailbox");
    } finally { setMbCreating(false); }
  }

  async function handleDeleteMailbox(email: string) {
    if (!confirm(`Delete mailbox ${email}?`)) return;
    await deleteMailbox(email);
    setMailboxes(p => p.filter(m => m.email !== email));
  }

  async function handleAddAlias(e: React.FormEvent) {
    e.preventDefault(); setAliasCreating(true); setAliasError("");
    try {
      await createAlias(aliasSource, aliasDest);
      setAliases(p => [...p, { source: aliasSource, destination: aliasDest }]);
      setAliasSource(""); setAliasDest("");
    } catch (err: unknown) {
      setAliasError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create alias");
    } finally { setAliasCreating(false); }
  }

  async function handleFlush() {
    await flushMailQueue();
    setQueue(await getMailQueue());
  }

  async function handleDeleteQueueItem(id: string) {
    await deleteQueueItem(id);
    setQueue(p => p.filter(q => q.queue_id !== id));
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  const stackOk = status?.postfix_installed && status?.dovecot_installed;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold">Email</h1>

      {/* Status card */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Mail Stack Status</h2>
        {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Postfix installed", ok: status?.postfix_installed ?? false },
            { label: "Dovecot installed", ok: status?.dovecot_installed ?? false },
            { label: "Postfix running",   ok: status?.postfix_running   ?? false },
            { label: "Dovecot running",   ok: status?.dovecot_running   ?? false },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 bg-slate-700/30 rounded-lg px-3 py-2">
              <StatusDot ok={ok} />
              <span className="text-xs text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Not installed warning */}
      {!stackOk && (
        <div className="card border border-amber-500/30 bg-amber-900/10 space-y-3">
          <h2 className="text-sm font-semibold text-amber-300">⚠ Mail stack not installed</h2>
          <p className="text-xs text-slate-400">
            Postfix and Dovecot are required to manage mailboxes. Install them on your server:
          </p>
          <pre className="bg-slate-950 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto">{
`apt update && apt install -y postfix dovecot-imapd dovecot-pop3d

# Configure Postfix for virtual mailboxes — add to /etc/postfix/main.cf:
virtual_mailbox_domains = /etc/postfix/virtual_domains
virtual_mailbox_maps = hash:/etc/postfix/vmailbox
virtual_alias_maps = hash:/etc/postfix/virtual
virtual_mailbox_base = /var/mail/vhosts
virtual_minimum_uid = 100
virtual_uid_maps = static:5000
virtual_gid_maps = static:5000

# Create vmail user:
groupadd -g 5000 vmail
useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -m

systemctl restart postfix dovecot`}
          </pre>
        </div>
      )}

      {/* Management tabs */}
      {stackOk && (
        <>
          <div className="flex gap-2 border-b border-slate-700 pb-2">
            {(["mailboxes", "aliases", "queue"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${tab === t ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:text-slate-200"}`}>
                {t}
              </button>
            ))}
          </div>

          {tabLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <>
              {/* Mailboxes */}
              {tab === "mailboxes" && (
                <div className="space-y-3">
                  <form onSubmit={handleAddMailbox} className="card flex gap-3 flex-wrap items-end">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email address</label>
                      <input value={mbEmail} onChange={e => setMbEmail(e.target.value)} placeholder="user@domain.com" required
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Password</label>
                      <input type="password" value={mbPassword} onChange={e => setMbPassword(e.target.value)} required
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={mbCreating} className="btn-primary px-4 py-2 text-sm">
                      {mbCreating ? <Spinner size="sm" /> : "Add mailbox"}
                    </button>
                    {mbError && <p className="text-xs text-red-400 w-full">{mbError}</p>}
                  </form>
                  <div className="card divide-y divide-slate-700/50">
                    {mailboxes.length === 0
                      ? <p className="text-sm text-slate-500 py-4 text-center">No mailboxes configured.</p>
                      : mailboxes.map(m => (
                        <div key={m.email} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <span className="text-slate-200">{m.email}</span>
                            <span className="text-xs text-slate-500 ml-2">Maildir</span>
                          </div>
                          <button onClick={() => handleDeleteMailbox(m.email)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Aliases */}
              {tab === "aliases" && (
                <div className="space-y-3">
                  <form onSubmit={handleAddAlias} className="card flex gap-3 flex-wrap items-end">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Source (alias)</label>
                      <input value={aliasSource} onChange={e => setAliasSource(e.target.value)} placeholder="info@domain.com" required
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <span className="text-slate-400 self-end pb-2">→</span>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Destination</label>
                      <input value={aliasDest} onChange={e => setAliasDest(e.target.value)} placeholder="admin@domain.com" required
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <button type="submit" disabled={aliasCreating} className="btn-primary px-4 py-2 text-sm">
                      {aliasCreating ? <Spinner size="sm" /> : "Add alias"}
                    </button>
                    {aliasError && <p className="text-xs text-red-400 w-full">{aliasError}</p>}
                  </form>
                  <div className="card divide-y divide-slate-700/50">
                    {aliases.length === 0
                      ? <p className="text-sm text-slate-500 py-4 text-center">No aliases configured.</p>
                      : aliases.map(a => (
                        <div key={a.source} className="flex items-center justify-between py-2 text-sm">
                          <div className="flex items-center gap-3">
                            <code className="text-indigo-300">{a.source}</code>
                            <span className="text-slate-500">→</span>
                            <code className="text-slate-300">{a.destination}</code>
                          </div>
                          <button onClick={() => { deleteAlias(a.source); setAliases(p => p.filter(x => x.source !== a.source)); }}
                            className="text-xs text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Mail queue */}
              {tab === "queue" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">{queue.length} message{queue.length !== 1 ? "s" : ""} in queue</p>
                    <div className="flex gap-2">
                      <button onClick={loadTab} className="btn-ghost text-xs px-3 py-1.5">Refresh</button>
                      {queue.length > 0 && <button onClick={handleFlush} className="btn-primary text-xs px-3 py-1.5">Flush queue</button>}
                    </div>
                  </div>
                  {queue.length === 0
                    ? <p className="text-sm text-slate-500 card py-8 text-center">Mail queue is empty.</p>
                    : (
                      <div className="card divide-y divide-slate-700/50">
                        {queue.map(q => (
                          <div key={q.queue_id} className="py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <code className="text-indigo-300">{q.queue_id}</code>
                                <span className="text-slate-400">{q.sender}</span>
                                <span className="text-slate-500">{q.size} bytes</span>
                              </div>
                              <button onClick={() => handleDeleteQueueItem(q.queue_id)} className="text-red-400 hover:text-red-300">Remove</button>
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              → {q.recipients.join(", ")}
                              {q.status && q.status !== "queued" && <span className="ml-2 text-amber-400">{q.status}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
