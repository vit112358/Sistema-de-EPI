import { useState } from "react";
import { jsPDF } from "jspdf";
import type { Entrega, Funcionario } from "../types";
import { fmtDateStr } from "../helpers";
import { DateInput } from "./DateInput";

// ponytail: mesma ideia de "EPIs por Funcionário", mas num único relatório com todos os funcionários.
interface Props {
  entregas: Entrega[];
  funcionarios: Funcionario[];
}

interface Linha { func: string; matricula: string; cargo: string; data: string; epi: string; qtd: number }

export function RelatorioEpisTodosPage({ entregas, funcionarios }: Props) {
  const hoje = new Date().toISOString().split("T")[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [busca, setBusca] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const b = busca.trim().toLowerCase();
  const linhas: Linha[] = entregas
    .filter(e => e.status === "assinado" && e.data >= dataInicio && e.data <= dataFim)
    .flatMap(e => {
      const f = funcionarios.find(x => x.id === e.funcionario_id);
      return e.itens.map(i => ({
        func: e.funcionario, matricula: f?.matricula ?? "", cargo: f?.cargo || "(sem cargo)",
        data: e.data, epi: i.nome, qtd: i.qtd || 1,
      }));
    })
    .filter(l => !b || l.func.toLowerCase().includes(b) || l.epi.toLowerCase().includes(b))
    .sort((x, y) => x.func.localeCompare(y.func) || x.data.localeCompare(y.data) || x.epi.localeCompare(y.epi));

  const totalQtd = linhas.reduce((s, l) => s + l.qtd, 0);
  const nFuncs = new Set(linhas.map(l => l.func)).size;
  const totalPages = Math.max(1, Math.ceil(linhas.length / pageSize));
  const paginadas = linhas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const gerarPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const mg = 12, rowH = 7;
    const cols: [string, number][] = [["Funcionário", 70], ["Matrícula", 25], ["Cargo", 55], ["Data", 25], ["EPI", 80], ["Qtd", 15]];
    const cw = cols.reduce((s, [, w]) => s + w, 0);
    let y = mg;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("RELATÓRIO DE EPIs ENTREGUES - TODOS OS FUNCIONÁRIOS", 148.5, y, { align: "center" });
    y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Período: ${fmtDateStr(dataInicio)} a ${fmtDateStr(dataFim)}  ·  ${nFuncs} funcionário(s)  ·  ${totalQtd} un`, mg, y);
    y += 6;

    const th = () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setFillColor(240, 240, 240);
      doc.rect(mg, y, cw, rowH, "F");
      let x = mg; cols.forEach(([t, w]) => { doc.text(t, x + 2, y + 5); x += w; }); y += rowH;
      doc.setFont("helvetica", "normal");
    };
    th();
    linhas.forEach(l => {
      if (y + rowH > 200) { doc.addPage(); y = mg; th(); }
      let x = mg;
      [l.func, l.matricula, l.cargo, fmtDateStr(l.data), l.epi, String(l.qtd)].forEach((c, i) => {
        doc.text(doc.splitTextToSize(c, cols[i][1] - 4)[0] ?? "", x + 2, y + 5); x += cols[i][1];
      });
      doc.setDrawColor(220); doc.line(mg, y + rowH, mg + cw, y + rowH); y += rowH;
    });
    doc.save(`epis_todos_funcionarios_${dataInicio}_a_${dataFim}.pdf`);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">De</label>
              <DateInput className="input" value={dataInicio} onChange={v => { setDataInicio(v); setCurrentPage(1); }} style={{ width: 160 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Até</label>
              <DateInput className="input" value={dataFim} onChange={v => { setDataFim(v); setCurrentPage(1); }} style={{ width: 160 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label className="input-label">Funcionário ou EPI</label>
              <input type="text" className="input" placeholder="Filtrar por funcionário ou EPI..." value={busca}
                onChange={e => { setBusca(e.target.value); setCurrentPage(1); }} />
            </div>
            {busca && <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(""); setCurrentPage(1); }}>✕ Limpar</button>}
            <button className="btn btn-ghost" disabled={linhas.length === 0} onClick={gerarPdf}>⬇️ Baixar PDF</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Funcionário</th><th>Matrícula</th><th>Cargo</th><th>Data</th><th>EPI</th><th>Qtd</th></tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                  Nenhuma entrega assinada no período selecionado
                </td></tr>
              )}
              {paginadas.map((l, i) => (
                <tr key={i}>
                  <td><span style={{ fontWeight: 600 }}>{l.func}</span></td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{l.matricula}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--text2)" }}>{l.cargo}</span></td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{fmtDateStr(l.data)}</span></td>
                  <td>{l.epi}</td>
                  <td><span style={{ fontFamily: "IBM Plex Mono" }}>{l.qtd}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
              {[10, 25, 50].map(n => <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>)}
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>
                {linhas.length} linha{linhas.length !== 1 ? "s" : ""} · {nFuncs} funcionário{nFuncs !== 1 ? "s" : ""} · {totalQtd} un
              </span>
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
