import { useState } from "react";
import type { Usuario, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { apiFetch } from "../api";

interface Props {
  users: Usuario[];
  setUsers: (action: React.SetStateAction<Usuario[]>) => void;
  currentUser: Usuario;
  toast: (msg: string, type?: Toast['type']) => void;
}

interface FormState {
  nome: string;
  username: string;
  senha: string;
  role: string;
}

export function CadastroUsuariosPage({ users, setUsers, currentUser, toast }: Props) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>({ nome: "", username: "", senha: "", role: "operador" });
  const [confirm, setConfirm] = useState<Usuario | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const paginated  = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openNew = () => { setForm({ nome: "", username: "", senha: "", role: "operador" }); setEditing(null); setModal(true); };
  const openEdit = (u: Usuario) => { setForm({ nome: u.nome, username: u.username, senha: "", role: u.role }); setEditing(u); setModal(true); };

  const save = async () => {
    if (!form.nome.trim() || !form.username.trim() || (!editing && !form.senha.trim())) {
      toast("Preencha todos os campos obrigatórios", "error"); return;
    }
    const dup = users.find(u => u.username === form.username && u.id !== editing?.id);
    if (dup) { toast("Username já existe", "error"); return; }
    try {
      if (editing) {
        const payload: Partial<Usuario> = { nome: form.nome, username: form.username, role: form.role };
        if (form.senha) (payload as Record<string, string>).senha = form.senha;
        await apiFetch(`/api/users/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...payload } : u));
        toast("Usuário atualizado!", "success");
      } else {
        const res = await apiFetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const data = await res.json();
        setUsers(prev => [...prev, { ...form, id: data.id }]);
        toast("Usuário criado!", "success");
      }
    } catch { toast("Erro ao salvar usuário", "error"); }
    setModal(false);
  };

  const del = async (u: Usuario) => {
    if (u.id === currentUser.id) { toast("Não é possível excluir o usuário atual", "error"); return; }
    const admins = users.filter(x => x.role === "admin");
    if (u.role === "admin" && admins.length === 1) { toast("Deve existir ao menos um administrador", "error"); return; }
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
    } catch { toast("Erro ao remover usuário", "error"); return; }
    setUsers(prev => prev.filter(x => x.id !== u.id));
    toast("Usuário removido", "success");
    setConfirm(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openNew}>+ Novo Usuário</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Username</th><th>Perfil</th><th></th></tr></thead>
            <tbody>
              {paginated.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.nome}</div>
                    {u.id === currentUser.id && <span className="badge badge-orange" style={{ marginTop: 4 }}>Você</span>}
                  </td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{u.username}</span></td>
                  <td>
                    {u.role === "admin"       ? <span className="badge badge-purple">Admin</span>
                    : u.role === "colaborador" ? <span className="badge badge-green">Colaborador</span>
                    :                           <span className="badge badge-gray">Operador</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(u)}>✏️ Editar</button>
                      {u.id !== currentUser.id && <button className="btn btn-danger btn-xs" onClick={() => setConfirm(u)}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {users.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{users.length} usuário{users.length !== 1 ? "s" : ""}</span>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>← Anterior</button>
              <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text2)", minWidth: 70, textAlign: "center" }}>{currentPage} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima →</button>
            </div>
          )}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? "Editar Usuário" : "Novo Usuário"}</span>
              <button className="close-btn" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group"><label className="input-label">Nome *</label><input className="input" value={form.nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Username *</label><input className="input" value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, username: e.target.value }))} /></div>
              <div className="input-group">
                <label className="input-label">Senha {editing ? "(deixe em branco para manter)" : "*"}</label>
                <input className="input" type="password" value={form.senha} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, senha: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Perfil</label>
                <select className="input" value={form.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Administrador</option>
                  <option value="operador">Operador</option>
                  <option value="colaborador">Colaborador</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          icon="🗑"
          title="Excluir usuário?"
          desc={`Tem certeza que deseja remover "${confirm.nome}"?`}
          danger
          confirmLabel="Excluir"
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}