import { useState } from "react";
import type { Cargo, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  cargos: Cargo[];
  setCargos: React.Dispatch<React.SetStateAction<Cargo[]>>;
  toast: (msg: string, type?: Toast['type']) => void;
}

export function CargosPage({ cargos, setCargos, toast }: Props) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [nome, setNome] = useState("");
  const [confirmDel, setConfirmDel] = useState<Cargo | null>(null);

  const openAdd = () => { setEditing(null); setNome(""); setModal(true); };
  const openEdit = (c: Cargo) => { setEditing(c); setNome(c.nome); setModal(true); };

  const save = () => {
    if (!nome.trim()) return;
    if (editing) {
      fetch(`/api/cargos/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .catch(() => {});
      setCargos(prev => prev.map(c => c.id === editing.id ? { ...c, nome: nome.trim() } : c));
      toast("Cargo atualizado!", "success");
    } else {
      const tempId = Date.now();
      fetch('/api/cargos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .then(r => r.json()).then(data => setCargos(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c)))
        .catch(() => {});
      setCargos(prev => [...prev, { id: tempId, nome: nome.trim() }]);
      toast("Cargo cadastrado!", "success");
    }
    setModal(false);
  };

  const del = (c: Cargo) => {
    fetch(`/api/cargos/${c.id}`, { method: 'DELETE' }).catch(() => {});
    setCargos(prev => prev.filter(x => x.id !== c.id));
    setConfirmDel(null);
    toast("Cargo removido!", "success");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Novo Cargo</button>
      </div>
      <div className="card">
        <div className="card-body">
          {cargos.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏷️</div>Nenhum cargo cadastrado</div>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Nome do Cargo</th><th style={{ width: 100 }}>Ações</th></tr></thead>
              <tbody>
                {cargos.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-ghost btn-xs" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(c)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? "Editar Cargo" : "Novo Cargo"}</span>
              <button className="close-btn" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nome do Cargo</label>
                <input className="input" value={nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && save()} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!nome.trim()} onClick={save}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}
      {confirmDel && <ConfirmDialog icon="🗑" title="Remover cargo?" desc={`Remover "${confirmDel.nome}"? Funcionários com esse cargo não serão afetados.`} danger confirmLabel="Remover" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}
    </div>
  );
}