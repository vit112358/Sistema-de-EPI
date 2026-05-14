import { useState } from "react";
import type { Funcionario, Cargo, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DateInput } from "./DateInput";

interface FuncModalProps {
  func: Funcionario;
  cargos: Cargo[];
  onClose: () => void;
  onSave: (f: Funcionario) => void;
  onDelete: (() => void) | null;
}

function FuncModal({ func, cargos, onClose, onSave, onDelete }: FuncModalProps) {
  const [f, setF] = useState<Funcionario>({ ...func });
  const setores = ["Produção","Manutenção","Logística","Qualidade","Segurança","Administrativo","TI","RH"];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{func.id ? `Editar — ${func.nome.split(" ")[0]}` : "Novo Funcionário"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="input-row">
            <div className="input-group" style={{ gridColumn: "1 / -1" }}><label className="input-label">Nome Completo</label><input className="input" value={f.nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, nome: e.target.value }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Matrícula</label><input className="input" value={f.matricula} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, matricula: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Data de Admissão</label><DateInput className="input" value={f.admissao ?? ""} onChange={v => setF(p => ({ ...p, admissao: v }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Setor</label><select className="input" value={f.setor} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF(p => ({ ...p, setor: e.target.value }))}>{setores.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="input-group"><label className="input-label">Cargo</label><select className="input" value={f.cargo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF(p => ({ ...p, cargo: e.target.value }))}><option value="">Selecione...</option>{cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">E-mail</label><input className="input" type="email" value={f.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Telefone</label><input className="input" value={f.telefone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, telefone: e.target.value }))} /></div>
          </div>
        </div>
        <div className="modal-footer">
          {func.id && onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>🗑 Excluir Funcionário</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  funcionarios: Funcionario[];
  setFuncionarios: (action: React.SetStateAction<Funcionario[]>) => void;
  onAddFuncionario: (f: Omit<Funcionario, 'id' | 'biometrias'>) => Promise<{ ok: boolean; error?: string }>;
  cargos: Cargo[];
  toast: (msg: string, type?: Toast['type']) => void;
}

export function FuncionariosPage({ funcionarios, setFuncionarios, onAddFuncionario, cargos, toast }: Props) {
  const [addModal, setAddModal] = useState(false);
  const [editFunc, setEditFunc] = useState<Funcionario | null>(null);
  const [confirmDel, setConfirmDel] = useState<Funcionario | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(funcionarios.length / pageSize));
  const paginated  = funcionarios.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const saveFunc = async (f: Funcionario) => {
    if (!f.nome.trim() || !f.matricula.trim() || !f.email.trim() || !f.telefone.trim()) {
      toast("Preencha nome, matrícula, e-mail e telefone", "error");
      return;
    }
    if (!f.cargo) {
      toast("Selecione um cargo", "error");
      return;
    }
    if (f.id) {
      setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, ...f } : x));
      toast("Dados atualizados!", "success");
      setEditFunc(null); setAddModal(false);
    } else {
      const result = await onAddFuncionario(f);
      if (result.ok) {
        toast("Funcionário cadastrado!", "success");
        setEditFunc(null); setAddModal(false);
      } else {
        toast(result.error || "Erro ao criar funcionário", "error");
      }
    }
  };

  const deleteFunc = (f: Funcionario) => {
    setFuncionarios(prev => prev.filter(x => x.id !== f.id));
    toast("Funcionário excluído!", "success");
    setConfirmDel(null);
    setEditFunc(null);
    setAddModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
          {funcionarios.filter(f => f.biometrias.length > 0).length}/{funcionarios.length} com biometria
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Novo Funcionário</button>
      </div>
      <div className="card">
        <div className="card-body">
          {funcionarios.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👷</div>Nenhum funcionário cadastrado</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Funcionário</th>
                  <th>Matrícula</th>
                  <th>Setor</th>
                  <th>Cargo</th>
                  <th>Biometria</th>
                  <th style={{ width: 120 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((f, i) => (
                  <tr key={f.id}>
                    <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>
                      {String((currentPage - 1) * pageSize + i + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                          {f.nome[0]}
                        </div>
                        <span style={{ fontWeight: 600 }}>{f.nome}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{f.matricula}</td>
                    <td>{f.setor}</td>
                    <td>{f.cargo}</td>
                    <td>
                      {f.biometrias.length > 0
                        ? <span className="badge badge-green">👆 {f.biometrias.length} biometria{f.biometrias.length > 1 ? "s" : ""}</span>
                        : <span className="badge badge-orange">⚠ Sem biometria</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditFunc(f)}>✏️ Editar</button>
                        <button className="btn btn-danger btn-xs" onClick={() => setConfirmDel(f)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {funcionarios.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{funcionarios.length} funcionário{funcionarios.length !== 1 ? "s" : ""}</span>
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
      {(editFunc || addModal) && (
        <FuncModal
          func={editFunc || { nome: "", matricula: "", setor: "Produção", cargo: "", email: "", telefone: "", admissao: "", biometrias: [] }}
          cargos={cargos}
          onClose={() => { setEditFunc(null); setAddModal(false); }}
          onSave={saveFunc}
          onDelete={editFunc ? () => setConfirmDel(editFunc) : null}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          icon="⚠️"
          title="Excluir Funcionário?"
          desc={`Esta ação é irreversível. "${confirmDel.nome}" e todos os seus dados serão permanentemente removidos do sistema.`}
          danger
          confirmLabel="Excluir Permanentemente"
          onConfirm={() => deleteFunc(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}