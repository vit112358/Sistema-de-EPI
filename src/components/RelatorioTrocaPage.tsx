import { useState } from "react";
import type { Epi, Funcionario, Entrega } from "../types";
import { addDays, daysUntil, fmtDate, fmtDateStr } from "../helpers";

interface Props {
  epis: Epi[];
  funcionarios: Funcionario[];
  entregas: Entrega[];
}

interface TrocaItem {
  func: Funcionario;
  epi: Epi;
  entrega: Entrega;
  dataEntrega: string;
  dataTroca: Date;
  diasRestantes: number;
  urgencia: "atrasado" | "critico" | "proximo" | "ok";
}

export function RelatorioTrocaPage({ epis, funcionarios, entregas }: Props) {
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [filtroFunc, setFiltroFunc] = useState("todos");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const trocas: TrocaItem[] = [];
  entregas.filter(e => e.status === "assinado").forEach(entrega => {
    const func = funcionarios.find(f => f.id === entrega.funcionario_id);
    if (!func) return;
    entrega.itens.forEach(item => {
      const epi = epis.find(e => e.id === item.epi_id);
      if (!epi?.periodicidade) return;
      const dataTroca = addDays(entrega.data, epi.periodicidade);
      const dias = daysUntil(dataTroca);
      trocas.push({
        func, epi, entrega,
        dataEntrega: entrega.data,
        dataTroca,
        diasRestantes: dias,
        urgencia: dias < 0 ? "atrasado" : dias <= 30 ? "critico" : dias <= 90 ? "proximo" : "ok",
      });
    });
  });

  trocas.sort((a, b) => a.diasRestantes - b.diasRestantes);

  const filtrados = trocas.filter(t => {
    if (filtroUrgencia !== "todos" && t.urgencia !== filtroUrgencia) return false;
    if (filtroFunc !== "todos" && t.func.id !== +filtroFunc) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const paginados  = filtrados.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const counts = {
    atrasado: trocas.filter(t => t.urgencia === "atrasado").length,
    critico: trocas.filter(t => t.urgencia === "critico").length,
    proximo: trocas.filter(t => t.urgencia === "proximo").length,
    ok: trocas.filter(t => t.urgencia === "ok").length,
  };

  const urgLabel: Record<string, string> = { atrasado: "🔴 Atrasado", critico: "🟠 Crítico (≤30d)", proximo: "🟡 Próximo (≤90d)", ok: "🟢 Em dia" };
  const urgClass: Record<string, string> = { atrasado: "badge-red", critico: "badge-orange", proximo: "badge-orange", ok: "badge-green" };

  const exportarExcel = () => {
    const statusLabel: Record<string, string> = { atrasado: "Atrasado", critico: "Crítico (≤30d)", proximo: "Próximo (≤90d)", ok: "Em dia" };
    const linhas = [
      ["Funcionário", "Matrícula", "Setor", "EPI", "CA", "Periodicidade (dias)", "Última Entrega", "Próxima Troca", "Dias Restantes", "Status"],
      ...trocas.map(t => [
        t.func.nome, t.func.matricula, t.func.setor, t.epi.nome, t.epi.ca ?? "",
        t.epi.periodicidade ?? "", fmtDateStr(t.dataEntrega), fmtDate(t.dataTroca), t.diasRestantes, statusLabel[t.urgencia],
      ])
    ];
    const csv = "﻿" + linhas.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-trocas-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Atrasados", value: counts.atrasado, color: "red", icon: "🔴", key: "atrasado" },
    { label: "Críticos (≤30d)", value: counts.critico, color: "orange", icon: "🟠", key: "critico" },
    { label: "Próximos (≤90d)", value: counts.proximo, color: "orange", icon: "🟡", key: "proximo" },
    { label: "Em dia", value: counts.ok, color: "green", icon: "🟢", key: "ok" },
  ] as const;

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        {statCards.map(s => (
          <div
            key={s.key}
            className={`stat-card ${s.color}`}
            style={{ cursor: "pointer", outline: filtroUrgencia === s.key ? "2px solid var(--orange)" : "none" }}
            onClick={() => { setFiltroUrgencia(filtroUrgencia === s.key ? "todos" : s.key); setCurrentPage(1); }}
          >
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">🔄 Calendário de Trocas de EPI</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportarExcel}>⬇️ Exportar Excel</button>
            <select className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} value={filtroFunc} onChange={e => { setFiltroFunc(e.target.value); setCurrentPage(1); }}>
              <option value="todos">Todos funcionários</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.split(" ")[0]} {f.nome.split(" ")[1]}</option>)}
            </select>
            <select className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} value={filtroUrgencia} onChange={e => { setFiltroUrgencia(e.target.value); setCurrentPage(1); }}>
              <option value="todos">Todos status</option>
              <option value="atrasado">🔴 Atrasados</option>
              <option value="critico">🟠 Críticos</option>
              <option value="proximo">🟡 Próximos</option>
              <option value="ok">🟢 Em dia</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div>Nenhum registro encontrado</div>
          ) : (
            <table>
              <thead>
                <tr><th>Funcionário</th><th>EPI</th><th>Periodicidade</th><th>Última Entrega</th><th>Próxima Troca</th><th>Dias Restantes</th><th>Status</th></tr>
              </thead>
              <tbody>
                {paginados.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.func.nome.split(" ").slice(0, 2).join(" ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{t.func.matricula} · {t.func.setor}</div>
                    </td>
                    <td>
                      <span style={{ marginRight: 6 }}>{t.epi.img}</span>
                      <span style={{ fontWeight: 500 }}>{t.epi.nome}</span>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{t.epi.ca}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{t.epi.periodicidade}d</span>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>(~{Math.round((t.epi.periodicidade ?? 0) / 30)} meses)</div>
                    </td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{fmtDateStr(t.dataEntrega)}</span></td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 600 }}>{fmtDate(t.dataTroca)}</span></td>
                    <td>
                      <span
                        style={{ fontFamily: "IBM Plex Mono", fontSize: 13, fontWeight: 700 }}
                        className={t.diasRestantes < 0 ? "urgency-critical" : t.diasRestantes <= 30 ? "urgency-warning" : "urgency-ok"}
                      >
                        {t.diasRestantes < 0 ? `${Math.abs(t.diasRestantes)}d atrasado` : `${t.diasRestantes}d`}
                      </span>
                    </td>
                    <td><span className={`badge ${urgClass[t.urgencia]}`}>{urgLabel[t.urgencia]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtrados.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
              {[10, 25, 50].map(n => (
                <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
              ))}
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</span>
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