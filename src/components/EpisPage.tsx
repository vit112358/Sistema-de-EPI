import { useState } from "react";
import type { Epi } from "../types";
import type { Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface EpiModalProps {
  epi: Epi;
  onClose: () => void;
  onSave: (epi: Epi) => void;
  onDelete: (() => void) | null;
}

function EpiModal({ epi, onClose, onSave, onDelete }: EpiModalProps) {
  const [f, setF] = useState<Epi>({ ...epi });
  const initCas = (): { numero: string; validade: string }[] => {
    try { if (epi.cas_json) return JSON.parse(epi.cas_json); } catch {}
    return epi.ca ? [{ numero: epi.ca, validade: epi.validade || "" }] : [{ numero: "", validade: "" }];
  };
  const [cas, setCas] = useState<{ numero: string; validade: string }[]>(initCas);
  const emojis = ["🪖","🧤","🥾","🥽","🔇","🦺","😷","🧣","🧰","🔦"];
  const categorias = ["Proteção da Cabeça","Proteção das Mãos","Proteção dos Pés","Proteção Visual","Proteção Auditiva","Sinalização","Proteção Respiratória","Proteção do Corpo"];
  const handleSave = () => {
    const casValidos = cas.filter(c => c.numero.trim());
    onSave({ ...f, cas_json: JSON.stringify(casValidos), ca: casValidos[0]?.numero || "", validade: casValidos[0]?.validade || "" });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{epi.id ? `Editar — ${epi.nome}` : "Novo EPI"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {emojis.map(e => (<button key={e} onClick={() => setF(p => ({ ...p, img: e }))} style={{ fontSize: 22, background: f.img === e ? "var(--orange-dim)" : "var(--surface2)", border: `1px solid ${f.img === e ? "var(--orange)" : "var(--border)"}`, borderRadius: 6, padding: 6, cursor: "pointer" }}>{e}</button>))}
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Nome do EPI</label><input className="input" value={f.nome} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, nome: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Categoria</label><select className="input" value={f.categoria} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setF(p => ({ ...p, categoria: e.target.value }))}>{categorias.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="input-group">
            <label className="input-label">Números CA — máx. 5 <span style={{ fontWeight: 400, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>({cas.length}/5)</span></label>
            {cas.map((ca, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  {i === 0 && <label className="input-label" style={{ marginBottom: 4 }}>Número CA</label>}
                  <input className="input" placeholder="Número CA" value={ca.numero}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setCas(p => p.map((c, j) => j === i ? { ...c, numero: ev.target.value } : c))} />
                </div>
                <div style={{ width: 160 }}>
                  {i === 0 && <label className="input-label" style={{ marginBottom: 4 }}>Vencimento do CA</label>}
                  <input className="input" type="date" value={ca.validade}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setCas(p => p.map((c, j) => j === i ? { ...c, validade: ev.target.value } : c))} />
                </div>
                {cas.length > 1 && (
                  <button onClick={() => setCas(p => p.filter((_, j) => j !== i))}
                    style={{ background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--red)", cursor: "pointer", padding: "4px 10px", fontSize: 16, marginBottom: 1 }}>×</button>
                )}
              </div>
            ))}
            {cas.length < 5 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCas(p => [...p, { numero: "", validade: "" }])}>+ Adicionar CA</button>
            )}
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Fabricante</label><input className="input" value={f.fabricante ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, fabricante: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Norma Técnica</label><input className="input" value={f.norma ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, norma: e.target.value }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Estoque Atual</label><input className="input" type="number" value={f.estoque} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, estoque: +e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Estoque Mínimo</label><input className="input" type="number" value={f.minimo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, minimo: +e.target.value }))} /></div>
          </div>
          <div className="input-group">
            <label className="input-label">⏱ Periodicidade de Troca (dias)</label>
            <input className="input" type="number" value={f.periodicidade ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, periodicidade: +e.target.value }))} placeholder="Ex: 90 = troca a cada 3 meses" />
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, fontFamily: "IBM Plex Mono" }}>
              {f.periodicidade ? `Troca a cada ${f.periodicidade} dias (~${Math.round(f.periodicidade/30)} meses)` : "Defina a frequência de substituição obrigatória"}
            </div>
          </div>
          <div className="input-group"><label className="input-label">Descrição / Especificação</label><textarea className="input" value={f.descricao ?? ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setF(p => ({ ...p, descricao: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          {epi.id && onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>🗑 Excluir EPI</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  epis: Epi[];
  setEpis: (action: React.SetStateAction<Epi[]>) => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

export function EpisPage({ epis, setEpis, toast }: Props) {
  const [addModal, setAddModal] = useState(false);
  const [editEpi, setEditEpi] = useState<Epi | null>(null);
  const [confirmDel, setConfirmDel] = useState<Epi | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(epis.length / pageSize));
  const paginated  = epis.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const saveEpi = (f: Epi) => {
    if (f.id) {
      setEpis(prev => prev.map(e => e.id === f.id ? f : e));
      toast("EPI atualizado com sucesso!", "success");
    } else {
      const novoEpi = { ...f, id: Date.now() };
      setEpis(prev => [...prev, novoEpi]);
      toast("EPI cadastrado com sucesso!", "success");
    }
    setEditEpi(null);
    setAddModal(false);
  };

  const deleteEpi = (e: Epi) => {
    setEpis(prev => prev.filter(x => x.id !== e.id));
    toast("EPI excluído!", "success");
    setConfirmDel(null);
    setEditEpi(null);
    setAddModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
          {epis.filter(e => e.estoque <= e.minimo).length} alertas · clique em um EPI para editar
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Novo EPI</button>
      </div>
      <div className="epi-grid">
        {paginated.map(e => {
          const pct = Math.min(100, (e.estoque / (e.minimo * 3)) * 100);
          const low = e.estoque <= e.minimo;
          const color = low ? "var(--red)" : pct > 60 ? "var(--green)" : "var(--orange)";
          return (
            <div key={e.id} className={`epi-card${low ? " low" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="epi-icon">{e.img}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  {low && <span className="badge badge-red">⚠ Baixo</span>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditEpi(e)}>✏️ Editar</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirmDel(e)}>🗑</button>
                  </div>
                </div>
              </div>
              <div className="epi-name">{e.nome}</div>
              <div className="epi-ca">{(() => { try { if (e.cas_json) return JSON.parse(e.cas_json).map((c: { numero: string }) => c.numero).filter(Boolean).join(" · "); } catch {} return e.ca || ""; })()} · {e.categoria}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, fontFamily: "IBM Plex Mono" }}>
                🔄 Troca: a cada {e.periodicidade}d · {e.fabricante}
              </div>
              <div className="epi-stock">
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Estoque</span>
                <div className="stock-bar-wrap"><div className="stock-bar" style={{ width: pct + "%", background: color }} /></div>
                <span className="stock-num" style={{ color }}>{e.estoque}</span>
              </div>
            </div>
          );
        })}
      </div>
      {epis.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{epis.length} EPI{epis.length !== 1 ? "s" : ""}</span>
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
      {(editEpi || addModal) && (
        <EpiModal
          epi={editEpi || { nome: "", ca: "", cas_json: null, categoria: "Proteção da Cabeça", estoque: 0, minimo: 0, validade: "", img: "🪖", periodicidade: 90, descricao: "", norma: "", fabricante: "" }}
          onClose={() => { setEditEpi(null); setAddModal(false); }}
          onSave={saveEpi}
          onDelete={editEpi ? () => setConfirmDel(editEpi) : null}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          icon="⚠️"
          title="Excluir EPI?"
          desc={`Esta ação é irreversível. O EPI "${confirmDel.nome}" será permanentemente removido do sistema.`}
          danger
          confirmLabel="Excluir Permanentemente"
          onConfirm={() => deleteEpi(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}