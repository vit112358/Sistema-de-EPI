import { useEffect, useState } from "react";
import type { Funcionario, Treinamento, TreinamentoRegistro, Toast } from "../types";
import { apiFetch } from "../api";
import { daysUntil, fmtDateStr } from "../helpers";
import { addMeses, fmtPeriodicidade } from "./TreinamentosPage";

interface Props {
  funcionarios: Funcionario[];
  toast: (msg: string, type?: Toast['type']) => void;
}

type Urgencia = "atrasado" | "critico" | "proximo" | "ok" | "nunca";

interface Item {
  func: Funcionario;
  treinamento: string;
  periodicidade: number;
  data: string | null;       // última realização
  vencimento: string | null;
  diasRestantes: number | null;
  urgencia: Urgencia;
}

const urgLabel: Record<Urgencia, string> = { atrasado: "🔴 Vencido", critico: "🟠 Crítico (≤30d)", proximo: "🟡 Próximo (≤90d)", ok: "🟢 Em dia", nunca: "⚪ Nunca realizado" };
const urgClass: Record<Urgencia, string> = { atrasado: "badge-red", critico: "badge-orange", proximo: "badge-orange", ok: "badge-green", nunca: "badge-gray" };
const ordem: Record<Urgencia, number> = { atrasado: 0, nunca: 1, critico: 2, proximo: 3, ok: 4 };

export function RelatorioTreinamentosPage({ funcionarios, toast }: Props) {
  const [tipos, setTipos] = useState<Treinamento[]>([]);
  const [registros, setRegistros] = useState<TreinamentoRegistro[]>([]);
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [filtroFunc, setFiltroFunc] = useState("todos");
  const [filtroTrein, setFiltroTrein] = useState("todos");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/treinamentos').then(r => r.json()),
      apiFetch('/api/treinamento-registros').then(r => r.json()),
    ]).then(([t, r]) => { setTipos(t); setRegistros(r); })
      .catch(() => toast("Erro ao carregar relatório de treinamentos", "error"));
  }, []);

  // só a realização mais recente de cada (funcionário, treinamento) conta: uma reciclagem encerra o vencimento anterior
  const ultimo = new Map<string, TreinamentoRegistro>();
  registros.forEach(r => {
    const k = `${r.funcionario_id}|${r.treinamento}`;
    const atual = ultimo.get(k);
    if (!atual || r.data > atual.data || (r.data === atual.data && r.id > atual.id)) ultimo.set(k, r);
  });

  const itens: Item[] = [];
  funcionarios.forEach(func => {
    const vistos = new Set<string>();
    ultimo.forEach(r => {
      if (r.funcionario_id !== func.id) return;
      vistos.add(r.treinamento);
      const venc = addMeses(r.data, r.periodicidade_meses);
      const [y, m, d] = venc.split("-").map(Number);
      const dias = daysUntil(new Date(y, m - 1, d));
      itens.push({
        func, treinamento: r.treinamento, periodicidade: r.periodicidade_meses,
        data: r.data, vencimento: venc, diasRestantes: dias,
        urgencia: dias < 0 ? "atrasado" : dias <= 30 ? "critico" : dias <= 90 ? "proximo" : "ok",
      });
    });
    // alerta extra: tipo cadastrado que o funcionário nunca fez
    tipos.filter(t => !vistos.has(t.nome)).forEach(t => itens.push({
      func, treinamento: t.nome, periodicidade: t.periodicidade_meses,
      data: null, vencimento: null, diasRestantes: null, urgencia: "nunca",
    }));
  });
  itens.sort((a, b) => ordem[a.urgencia] - ordem[b.urgencia] || (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));

  const filtrados = itens.filter(t =>
    (filtroUrgencia === "todos" || t.urgencia === filtroUrgencia) &&
    (filtroFunc === "todos" || t.func.id === +filtroFunc) &&
    (filtroTrein === "todos" || t.treinamento === filtroTrein));

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const paginados = filtrados.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const count = (u: Urgencia) => itens.filter(t => t.urgencia === u).length;

  const exportarExcel = () => {
    const linhas = [
      ["Funcionário", "Matrícula", "Setor", "Treinamento", "Periodicidade", "Última Realização", "Vencimento", "Dias Restantes", "Status"],
      ...itens.map(t => [
        t.func.nome, t.func.matricula, t.func.setor, t.treinamento, fmtPeriodicidade(t.periodicidade),
        fmtDateStr(t.data), fmtDateStr(t.vencimento), t.diasRestantes ?? "", urgLabel[t.urgencia].replace(/^\S+\s/, ""),
      ]),
    ];
    const csv = "﻿" + linhas.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-treinamentos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Vencidos", value: count("atrasado"), color: "red", icon: "🔴", key: "atrasado" },
    { label: "Nunca realizados", value: count("nunca"), color: "orange", icon: "⚪", key: "nunca" },
    { label: "Críticos (≤30d)", value: count("critico"), color: "orange", icon: "🟠", key: "critico" },
    { label: "Próximos (≤90d)", value: count("proximo"), color: "orange", icon: "🟡", key: "proximo" },
    { label: "Em dia", value: count("ok"), color: "green", icon: "🟢", key: "ok" },
  ] as const;

  const sel = { width: "auto", padding: "5px 10px", fontSize: 12 };

  return (
    <div>
      {count("atrasado") > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚠️ {count("atrasado")} treinamento{count("atrasado") !== 1 ? "s" : ""} vencido{count("atrasado") !== 1 ? "s" : ""} — reciclagem necessária.
        </div>
      )}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.key} className={`stat-card ${s.color}`}
            style={{ cursor: "pointer", outline: filtroUrgencia === s.key ? "2px solid var(--orange)" : "none" }}
            onClick={() => { setFiltroUrgencia(filtroUrgencia === s.key ? "todos" : s.key); setCurrentPage(1); }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">🎓 Calendário de Treinamentos</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportarExcel}>⬇️ Exportar Excel</button>
            <select className="input" style={sel} value={filtroFunc} onChange={e => { setFiltroFunc(e.target.value); setCurrentPage(1); }}>
              <option value="todos">Todos funcionários</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.split(" ").slice(0, 2).join(" ")}</option>)}
            </select>
            <select className="input" style={sel} value={filtroTrein} onChange={e => { setFiltroTrein(e.target.value); setCurrentPage(1); }}>
              <option value="todos">Todos treinamentos</option>
              {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
            <select className="input" style={sel} value={filtroUrgencia} onChange={e => { setFiltroUrgencia(e.target.value); setCurrentPage(1); }}>
              <option value="todos">Todos status</option>
              {(Object.keys(urgLabel) as Urgencia[]).map(u => <option key={u} value={u}>{urgLabel[u]}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div>Nenhum registro encontrado</div>
          ) : (
            <table>
              <thead>
                <tr><th>Funcionário</th><th>Treinamento</th><th>Periodicidade</th><th>Última Realização</th><th>Vencimento</th><th>Dias Restantes</th><th>Status</th></tr>
              </thead>
              <tbody>
                {paginados.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.func.nome.split(" ").slice(0, 2).join(" ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{t.func.matricula} · {t.func.setor}</div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.treinamento}</td>
                    <td>{fmtPeriodicidade(t.periodicidade)}</td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{fmtDateStr(t.data)}</span></td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 600 }}>{fmtDateStr(t.vencimento)}</span></td>
                    <td>
                      {t.diasRestantes === null ? <span style={{ color: "var(--text3)" }}>—</span> : (
                        <span style={{ fontFamily: "IBM Plex Mono", fontSize: 13, fontWeight: 700 }}
                          className={t.diasRestantes < 0 ? "urgency-critical" : t.diasRestantes <= 30 ? "urgency-warning" : "urgency-ok"}>
                          {t.diasRestantes < 0 ? `${Math.abs(t.diasRestantes)}d vencido` : `${t.diasRestantes}d`}
                        </span>
                      )}
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
              {[10, 25, 50].map(n => <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>)}
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
