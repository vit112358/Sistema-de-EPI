import { useEffect, useState } from "react";
import type { Treinamento, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { apiFetch } from "../api";

interface Props {
  toast: (msg: string, type?: Toast['type']) => void;
}

const json = { 'Content-Type': 'application/json' };

export const fmtPeriodicidade = (m: number) =>
  m % 12 === 0 ? `${m / 12} ano${m / 12 > 1 ? "s" : ""}` : `${m} ${m === 1 ? "mês" : "meses"}`;

// data AAAA-MM-DD + N meses (31/01 + 1 mês = 28/02, não 03/03)
export const addMeses = (data: string, meses: number) => {
  const [y, m, d] = data.split("-").map(Number);
  const r = new Date(y, m - 1 + meses, d);
  if (r.getDate() !== d) r.setDate(0);
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
};

export function TreinamentosPage({ toast }: Props) {
  const [lista, setLista] = useState<Treinamento[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Treinamento | null>(null);
  const [nome, setNome] = useState("");
  const [meses, setMeses] = useState("12");
  const [confirmDel, setConfirmDel] = useState<Treinamento | null>(null);

  const carregar = () =>
    apiFetch('/api/treinamentos').then(r => r.json()).then(setLista).catch(() => toast("Erro ao carregar treinamentos", "error"));
  useEffect(() => { carregar(); }, []);

  const openAdd = () => { setEditing(null); setNome(""); setMeses("12"); setModal(true); };
  const openEdit = (t: Treinamento) => { setEditing(t); setNome(t.nome); setMeses(String(t.periodicidade_meses)); setModal(true); };

  const valido = nome.trim() !== "" && Number.isInteger(Number(meses)) && Number(meses) >= 1;

  const save = async () => {
    if (!valido) return;
    const body = JSON.stringify({ nome: nome.trim(), periodicidade_meses: Number(meses) });
    try {
      const r = await apiFetch(editing ? `/api/treinamentos/${editing.id}` : '/api/treinamentos',
        { method: editing ? 'PUT' : 'POST', headers: json, body });
      if (!r.ok) throw new Error();
      toast(editing ? "Treinamento atualizado!" : "Treinamento cadastrado!", "success");
      setModal(false);
      carregar();
    } catch {
      toast("Erro ao salvar (nome já existe?)", "error");
    }
  };

  const del = async (t: Treinamento) => {
    try {
      const r = await apiFetch(`/api/treinamentos/${t.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast("Treinamento removido!", "success");
      carregar();
    } catch {
      toast("Erro ao remover treinamento", "error");
    }
    setConfirmDel(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Novo Treinamento</button>
      </div>
      <div className="card">
        <div className="card-body">
          {lista.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🎓</div>Nenhum treinamento cadastrado</div>
          ) : (
            <table>
              <thead><tr><th>Treinamento</th><th>Periodicidade</th><th style={{ width: 100 }}>Ações</th></tr></thead>
              <tbody>
                {lista.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.nome}</td>
                    <td>{fmtPeriodicidade(t.periodicidade_meses)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(t)}>✏️</button>
                        <button className="btn btn-ghost btn-xs" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(t)}>🗑</button>
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
              <span className="modal-title">{editing ? "Editar Treinamento" : "Novo Treinamento"}</span>
              <button className="close-btn" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nome do Treinamento</label>
                <input className="input" value={nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNome(e.target.value)} autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label">Periodicidade (meses)</label>
                <input className="input" type="number" min={1} step={1} value={meses} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeses(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && save()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!valido} onClick={save}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}
      {confirmDel && <ConfirmDialog icon="🗑" title="Remover treinamento?" desc={`Remover "${confirmDel.nome}"?`} danger confirmLabel="Remover" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}
    </div>
  );
}
