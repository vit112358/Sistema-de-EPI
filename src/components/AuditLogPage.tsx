import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api";

interface LogEntry {
  id: number;
  momento: string;
  usuario: string;
  acao: string;
  entidade: string | null;
  entidade_id: number | null;
  detalhe: string | null;
}

const ACAO_LABEL: Record<string, string> = {
  entrega_criada:         "📋 Entrega criada",
  entrega_assinada:       "✅ Assinatura",
  entrega_cancelada:      "🚫 Cancelamento",
  funcionario_criado:     "👷 Func. criado",
  funcionario_atualizado: "✏️ Func. editado",
  funcionario_deletado:   "🗑 Func. excluído",
  epi_criado:             "🦺 EPI criado",
  epi_atualizado:         "✏️ EPI editado",
  epi_deletado:           "🗑 EPI excluído",
  usuario_criado:         "👤 Usuário criado",
  usuario_atualizado:     "✏️ Usuário editado",
  usuario_deletado:       "🗑 Usuário excluído",
};

const ACAO_CLASS: Record<string, string> = {
  entrega_criada:         "badge-blue",
  entrega_assinada:       "badge-green",
  entrega_cancelada:      "badge-red",
  funcionario_criado:     "badge-green",
  funcionario_atualizado: "badge-orange",
  funcionario_deletado:   "badge-red",
  epi_criado:             "badge-green",
  epi_atualizado:         "badge-orange",
  epi_deletado:           "badge-red",
  usuario_criado:         "badge-green",
  usuario_atualizado:     "badge-orange",
  usuario_deletado:       "badge-red",
};

function fmtMomento(s: string) {
  try {
    const d = new Date(s + (s.includes("T") ? "" : "Z"));
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return s; }
}

export function AuditLogPage() {
  const [entries, setEntries]       = useState<LogEntry[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [usuarios, setUsuarios]     = useState<string[]>([]);
  const [filtroAcao, setFiltroAcao]         = useState("");
  const [filtroUsuario, setFiltroUsuario]   = useState("");
  const [pageSize, setPageSize]     = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    apiFetch("/api/users")
      .then(r => r.ok ? r.json() : [])
      .then((d: { username: string }[]) => {
        if (Array.isArray(d)) setUsuarios(d.map(u => u.username));
      });
  }, []);

  const fetchLog = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroAcao)    params.set("acao",    filtroAcao);
    if (filtroUsuario) params.set("usuario", filtroUsuario);
    params.set("limit",  String(pageSize));
    params.set("offset", String((currentPage - 1) * pageSize));
    apiFetch(`/api/audit-log?${params}`)
      .then(r => r.json())
      .then((d: { data: LogEntry[]; total: number }) => {
        if (Array.isArray(d?.data)) {
          setEntries(d.data);
          setTotal(d.total ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [filtroAcao, filtroUsuario, pageSize, currentPage]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const reset = () => setCurrentPage(1);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">🔍 Log de Auditoria</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
              value={filtroAcao}
              onChange={e => { setFiltroAcao(e.target.value); reset(); }}
            >
              <option value="">Todas as ações</option>
              {Object.entries(ACAO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
              value={filtroUsuario}
              onChange={e => { setFiltroUsuario(e.target.value); reset(); }}
            >
              <option value="">Todos os usuários</option>
              {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><div className="empty-icon">⏳</div>Carregando...</div>
          ) : entries.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div>Nenhum registro encontrado</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>ID</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>
                        {fmtMomento(e.momento)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 600 }}>{e.usuario}</span>
                    </td>
                    <td>
                      <span className={`badge ${ACAO_CLASS[e.acao] ?? "badge-gray"}`}>
                        {ACAO_LABEL[e.acao] ?? e.acao}
                      </span>
                    </td>
                    <td>
                      {e.entidade_id != null && (
                        <span style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "var(--text3)" }}>
                          #{String(e.entidade_id).padStart(4, "0")}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text2)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.detalhe ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
              {[10, 25, 50].map(n => (
                <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); reset(); }}>{n}</button>
              ))}
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{total} registro{total !== 1 ? "s" : ""}</span>
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
      </div>
    </div>
  );
}