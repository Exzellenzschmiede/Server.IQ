import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  generatePassword,
  listUsers,
  resetPassword,
  updateUser,
} from "../api/users";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/ui/Spinner";
import StatusBadge from "../components/ui/StatusBadge";
import type { UserResponse, UserRole } from "../types/auth";

// ── Password field with generate button ──────────────────────────────────────
function PasswordField({
  value,
  onChange,
  label = "Passwort",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const pwd = await generatePassword();
      onChange(pwd);
      setShow(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono"
        />
        <button type="button" onClick={() => setShow((v) => !v)} className="btn-ghost px-2">
          {show ? "●" : "○"}
        </button>
        <button type="button" onClick={generate} disabled={generating} className="btn-ghost px-2 text-xs">
          {generating ? <Spinner size="sm" /> : "↻ Gen"}
        </button>
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Create / Edit form ────────────────────────────────────────────────────────
function UserForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: UserResponse;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    role: (initial?.role ?? "user") as UserRole,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isEdit) {
        await updateUser(initial!.id, { name: form.name, email: form.email, role: form.role });
      } else {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
      }
      onSave();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Name</label>
        <input type="text" value={form.name} onChange={(e) => set("name")(e.target.value)}
          required minLength={2}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">E-Mail</label>
        <input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)}
          required
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Rolle</label>
        <select value={form.role} onChange={(e) => set("role")(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>
      {!isEdit && (
        <PasswordField value={form.password} onChange={set("password")} />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="btn-ghost">Abbrechen</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Spinner size="sm" /> : isEdit ? "Speichern" : "Anlegen"}
        </button>
      </div>
    </form>
  );
}

// ── Password reset modal ──────────────────────────────────────────────────────
function PasswordResetModal({ user, onSave, onClose }: { user: UserResponse; onSave: () => void; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await resetPassword(user.id, password);
      onSave();
    } catch {
      setError("Fehler beim Zurücksetzen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-400">Neues Passwort für <span className="text-slate-200">{user.name}</span> setzen.</p>
      <PasswordField value={password} onChange={setPassword} label="Neues Passwort" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="btn-ghost">Abbrechen</button>
        <button type="submit" disabled={saving || password.length < 8} className="btn-primary">
          {saving ? <Spinner size="sm" /> : "Zurücksetzen"}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Modal = { type: "create" } | { type: "edit"; user: UserResponse } | { type: "password"; user: UserResponse } | { type: "delete"; user: UserResponse } | null;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listUsers().then(setUsers).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeAndReload = () => { setModal(null); load(); };

  const handleDelete = async (user: UserResponse) => {
    setDeleting(true);
    try { await deleteUser(user.id); load(); setModal(null); }
    catch { /* TODO: toast */ }
    finally { setDeleting(false); }
  };

  if (!currentUser?.is_admin) {
    return <div className="p-6 text-slate-400">Kein Zugriff.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Benutzerverwaltung</h1>
        <button onClick={() => setModal({ type: "create" })} className="btn-primary">
          + Benutzer anlegen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : (
        <div className="card divide-y divide-slate-700/50">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{u.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${u.role === "admin" ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-600/40 text-slate-400"}`}>
                    {u.role === "admin" ? "Admin" : "User"}
                  </span>
                  {!u.is_active && <StatusBadge status="inactive" />}
                  {u.id === currentUser.id && (
                    <span className="text-xs text-slate-500">(ich)</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => setModal({ type: "edit", user: u })} className="btn-ghost text-xs py-1">
                  Bearbeiten
                </button>
                <button onClick={() => setModal({ type: "password", user: u })} className="btn-ghost text-xs py-1">
                  Passwort
                </button>
                {u.id !== currentUser.id && (
                  <button onClick={() => setModal({ type: "delete", user: u })} className="btn-danger text-xs py-1">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === "create" && (
        <Modal title="Benutzer anlegen" onClose={() => setModal(null)}>
          <UserForm onSave={closeAndReload} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "edit" && (
        <Modal title="Benutzer bearbeiten" onClose={() => setModal(null)}>
          <UserForm initial={modal.user} onSave={closeAndReload} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "password" && (
        <Modal title="Passwort zurücksetzen" onClose={() => setModal(null)}>
          <PasswordResetModal user={modal.user} onSave={closeAndReload} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "delete" && (
        <Modal title="Benutzer löschen?" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-400">
            <span className="text-slate-200">{modal.user.name}</span> ({modal.user.email}) wird dauerhaft gelöscht.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setModal(null)} className="btn-ghost">Abbrechen</button>
            <button onClick={() => handleDelete(modal.user)} disabled={deleting} className="btn-danger">
              {deleting ? <Spinner size="sm" /> : "Löschen"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
