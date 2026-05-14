import { useState, useEffect } from "react";
import type { Entrega, Toast } from "../types";
import { fmtDateStr } from "../helpers";

interface Props {
  entregas: Entrega[];
  setEntregas: (action: React.SetStateAction<Entrega[]>) => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

export function CancelarEntregaPage({ entregas, setEntregas, toast }: Props) {
  const pendentes = entregas.filter(e => e.status === "pendente_assinatura");
  const assinadas = entregas.filter(e => e.status === "assinado");
  const [confirm, setConfirm] = useState<Entrega | null>(null);
  const [motivo, setMotivo] = useState("");
  const [tab, setTab] = useState("pendentes");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [tab, pageSize]);

  const doCancel = (id: number | undefined) => {
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, status: "cancelado", motivo_cancelamento: motivo || "Cancelado pelo operador" } as Entrega : e));
    setConfirm(null); setMotivo("");
    toast("Entrega cancelada com sucesso.", "info");
  };

  const lista = tab === "pendentes" ? pendentes : assinadas;
  const totalPages = Math.max(1, Math.ceil(lista.length / pageSize));
  const paginated  = lista.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        ⚠️ O cancelamento é irreversível. Use com cautela para entregas com erro de lançamento ou devoluções de EPI.
      </div>
      <div className="tab-bar">
        <div className={`tab${tab === "pendentes" ? " active" : ""}`} onClick={() => setTab("pendentes")}>Pendentes ({pendentes.length})</div>
        <div className={`tab${tab === "assinadas" ? " active" : ""}`} onClick={() => setTab("assinadas")}>Assinadas ({assinadas.length})</div>
      </div>
      {lista.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">{tab === "pendentes" ? "✅" : "📋"}</div>Nenhuma entrega {tab === "pendentes" ? "pendente" : "assinada"}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {paginated.map(e => (
            <div key={e.id} className="card">
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ fontFamily: "IBM Plex Mono", color: "var(--text3)", fontSize: 11, marginRight: 8 }}>#{String(e.id).padStart(4,"0")}</span>
                    {e.funcionario}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{fmtDateStr(e.data)}</span>
                    <span className="badge badge-gray">{e.itens.length} item{e.itens.length !== 1 ? "s" : ""}</span>
                    {e.status === "assinado" && <span className="badge badge-green">✓ Assinado</span>}
                    {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {e.itens.map((item, i) => <span key={i} style={{ fontSize: 13 }} title={item.nome}>{item.img}</span>)}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirm(e)}>🚫 Cancelar Entrega</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {lista.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => setPageSize(n)}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{lista.length} registro{lista.length !== 1 ? "s" : ""}</span>
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
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🚫 Cancelar Entrega #{String(confirm.id).padStart(4,"0")}</span><button className="close-btn" onClick={() => setConfirm(null)}>×</button></div>
            <div className="modal-body">
              <div className="alert alert-error" style={{ marginBottom: 16 }}>Esta ação é irreversível e ficará registrada no histórico.</div>
              <div className="input-group">
                <label className="input-label">Motivo do cancelamento (opcional)</label>
                <textarea className="input" value={motivo} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotivo(e.target.value)} placeholder="Ex: Erro de lançamento, devolução de EPI, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Voltar</button>
              <button className="btn btn-danger" onClick={() => doCancel(confirm.id)}>🚫 Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}