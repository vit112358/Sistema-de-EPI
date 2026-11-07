import { useEffect, useState } from "react";
import type { TreinamentoRegistro, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { apiFetch } from "../api";
import { fmtDateStr } from "../helpers";
import { addMeses, fmtPeriodicidade } from "./TreinamentosPage";

interface Props {
  toast: (msg: string, type?: Toast['type']) => void;
}

export function HistoricoTreinamentosPage({ toast }: Props) {
  const [lista, setLista] = useState<TreinamentoRegistro[]>([]);
  const [busca, setBusca] = useState("");
  const [ordemNome, setOrdemNome] = useState<"asc" | "desc" | null>(null);
  const [confirmDel, setConfirmDel] = useState<TreinamentoRegistro | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const carregar = () =>
    apiFetch('/api/treinamento-registros').then(r => r.json()).then(setLista).catch(() => toast("Erro ao carregar histórico", "error"));
  useEffect(() => { carregar(); }, []);
  useEffect(() => { setCurrentPage(1); }, [busca, ordemNome, pageSize]);

  const del = async (r: TreinamentoRegistro) => {
    try {
      const res = await apiFetch(`/api/treinamento-registros/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast("Registro excluído.", "info");
      carregar();
    } catch {
      toast("Erro ao excluir registro", "error");
    }
    setConfirmDel(null);
  };

  const hoje = new Date().toISOString().split("T")[0];
  let filtered = lista;
  if (busca.trim()) {
    const termo = busca.trim().toLowerCase();
    filtered = filtered.filter(r => r.funcionario.toLowerCase().includes(termo) || r.treinamento.toLowerCase().includes(termo));
  }
  if (ordemNome) {
    filtered = [...filtered].sort((a, b) => (ordemNome === "asc" ? 1 : -1) * a.funcionario.localeCompare(b.funcionario, "pt-BR"));
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <input type="text" className="input" placeholder="Filtrar por funcionário ou treinamento..." value={busca}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)} style={{ maxWidth: 320 }} />
        {busca && <button className="btn btn-ghost btn-sm" onClick={() => setBusca("")}>✕ Limpar</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setOrdemNome(p => p === null ? "asc" : p === "asc" ? "desc" : null)}>
                  Funcionário {ordemNome === "asc" ? "↑" : ordemNome === "desc" ? "↓" : "↕"}
                </th>
                <th>Treinamento</th><th>Realizado em</th><th>Periodicidade</th><th>Vencimento</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => {
                const venc = addMeses(r.data, r.periodicidade_meses);
                return (
                  <tr key={r.id}>
                    <td><span style={{ fontFamily: "IBM Plex Mono", color: "var(--text3)", fontSize: 12 }}>#{String(r.id).padStart(4, "0")}</span></td>
                    <td><span style={{ fontWeight: 600 }}>{r.funcionario.split(" ").slice(0, 2).join(" ")}</span></td>
                    <td>{r.treinamento}</td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{fmtDateStr(r.data)}</span></td>
                    <td>{fmtPeriodicidade(r.periodicidade_meses)}</td>
                    <td>
                      <span className={`badge ${venc < hoje ? "badge-red" : "badge-green"}`}>
                        {venc < hoje ? "⚠ Vencido " : "✓ "}{fmtDateStr(venc)}
                      </span>
                    </td>
                    <td><div className="action-btns"><button className="btn btn-danger btn-xs" onClick={() => setConfirmDel(r)}>🗑 Excluir</button></div></td>
                  </tr>
                );
              })}
              {paginated.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>Nenhum registro</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => setPageSize(n)}>{n}</button>)}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
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
      {confirmDel && (
        <ConfirmDialog icon="🗑" title="Excluir registro" danger
          desc={`Excluir "${confirmDel.treinamento}" de ${confirmDel.funcionario.split(" ")[0]} (${fmtDateStr(confirmDel.data)})? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}
