import { useState } from "react";
import type { Cargo, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { apiFetch } from "../api";

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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(cargos.length / pageSize));
  const paginated  = cargos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openAdd = () => { setEditing(null); setNome(""); setModal(true); };
  const openEdit = (c: Cargo) => { setEditing(c); setNome(c.nome); setModal(true); };

  const save = () => {
    if (!nome.trim()) return;
    if (editing) {
      apiFetch(`/api/cargos/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .catch(() => {});
      setCargos(prev => prev.map(c => c.id === editing.id ? { ...c, nome: nome.trim() } : c));
      toast("Cargo atualizado!", "success");
    } else {
      const tempId = Date.now();
      apiFetch('/api/cargos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .then(r => r.json()).then(data => setCargos(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c)))
        .catch(() => {});
      setCargos(prev => [...prev, { id: tempId, nome: nome.trim() }]);
      toast("Cargo cadastrado!", "success");
    }
    setModal(false);
  };

  const del = (c: Cargo) => {
    apiFetch(`/api/cargos/${c.id}`, { method: 'DELETE' }).catch(() => {});
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
                {paginated.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{String((currentPage - 1) * pageSize + i + 1).padStart(2, "0")}</td>
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
      {cargos.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{cargos.length} cargo{cargos.length !== 1 ? "s" : ""}</span>
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