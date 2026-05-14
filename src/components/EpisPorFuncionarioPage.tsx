import { useState } from "react";
import { jsPDF } from "jspdf";
import type { Entrega, Funcionario } from "../types";
import { declaracaoTermoEpi, COMPANY_CONFIG } from "../helpers";

interface Props {
  entregas: Entrega[];
  funcionarios: Funcionario[];
}

export function EpisPorFuncionarioPage({ entregas, funcionarios }: Props) {
  const hoje      = new Date().toISOString().split("T")[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [dataInicio, setDataInicio] = useState(inicioMes);
  const [dataFim,    setDataFim]    = useState(hoje);
  const [busca,      setBusca]      = useState("");
  const [pageSize,   setPageSize]   = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fmtDate = (s: string) => {
    const [yr, mo, dy] = s.split("-");
    return `${dy}/${mo}/${yr}`;
  };

  const entregasNoPeriodo = entregas.filter(
    e => e.status === "assinado" && e.data >= dataInicio && e.data <= dataFim
  );

  const linhas = funcionarios
    .map(f => ({ func: f, ents: entregasNoPeriodo.filter(e => e.funcionario_id === f.id) }))
    .filter(({ ents, func }) =>
      ents.length > 0 &&
      (!busca.trim() || func.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    );

  const totalPages = Math.max(1, Math.ceil(linhas.length / pageSize));
  const paginadas  = linhas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const gerarFicha = (func: Funcionario, ents: Entrega[]) => {
    const doc   = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const mg    = 15;
    const cw    = pageW - mg * 2;
    let y       = mg;

    const box = (h: number) => { doc.rect(mg, y, cw, h); };
    const vline = (x: number, h: number) => doc.line(x, y, x, y + h);

    doc.setLineWidth(0.4);
    doc.setDrawColor(0);

    // ── Título ─────────────────────────────────────────────────────────────────
    box(9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("FICHA DE ENTREGA DE EPI", pageW / 2, y + 6, { align: "center" });
    y += 9;

    // ── Cabeçalho funcionário ──────────────────────────────────────────────────
    const hdrH = 9;
    box(hdrH);
    const x2 = mg + cw * 0.58;
    const x3 = mg + cw * 0.78;
    vline(x2, hdrH);
    vline(x3, hdrH);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("FUNCIONÁRIO:", mg + 2, y + 3.5);
    doc.text("MATRÍCULA:",   x2 + 2,  y + 3.5);
    doc.text("CARGO:",       x3 + 2,  y + 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(func.nome,      mg + 2, y + 7.5);
    doc.text(func.matricula, x2 + 2, y + 7.5);
    const cargoLine = doc.splitTextToSize(func.cargo, pageW - x3 - mg - 3)[0] ?? "";
    doc.text(cargoLine,      x3 + 2, y + 7.5);
    y += hdrH;

    // ── Linha empresa ──────────────────────────────────────────────────────────
    const empH = 9;
    box(empH);
    const xEmp = mg + cw * 0.45;
    vline(xEmp, empH);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("EMPRESA:",   mg + 2,    y + 3.5);
    doc.text("ENDEREÇO:", xEmp + 2,  y + 3.5);
    doc.text("CNPJ:", xEmp + 2,  y + 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(COMPANY_CONFIG.nome, mg + 2, y + 7.5);
    const enderecoLine = doc.splitTextToSize(COMPANY_CONFIG.endereco, pageW - xEmp - mg - 3)[0] ?? "";
    doc.text(enderecoLine, xEmp + 2, y + 7.5);
    doc.text(COMPANY_CONFIG.cnpj, xEmp + 2, y + 7.5);
    y += empH;

    // ── Subtítulo ──────────────────────────────────────────────────────────────
    box(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("TERMO DE RECEBIMENTO E RESPONSABILIDADE DO EPI", pageW / 2, y + 4.8, { align: "center" });
    y += 7;

    // ── Declaração ─────────────────────────────────────────────────────────────
    const decl = declaracaoTermoEpi();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const declLines = doc.splitTextToSize(decl, cw - 6);
    const declH = declLines.length * 3.8 + 6;
    box(declH);
    doc.text(declLines, pageW / 2, y + 5, { align: "center" });
    y += declH;

    // ── Período ────────────────────────────────────────────────────────────────
    box(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      `PERÍODO DE ENTREGA:   ${fmtDate(dataInicio)}   a   ${fmtDate(dataFim)}`,
      pageW / 2, y + 4.8, { align: "center" }
    );
    y += 7;

    // ── Tabela ─────────────────────────────────────────────────────────────────
    const colW = [cw * 0.48, cw * 0.26, cw * 0.26];
    const thH  = 8;
    const rowH = 9;

    const drawTh = () => {
      doc.rect(mg, y, cw, thH);
      vline(mg + colW[0],            thH);
      vline(mg + colW[0] + colW[1],  thH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("EPI",              mg + colW[0] / 2,                       y + 5.5, { align: "center" });
      doc.text("DATA DA ENTREGA",  mg + colW[0] + colW[1] / 2,             y + 5.5, { align: "center" });
      doc.text("ASSINATURA",       mg + colW[0] + colW[1] + colW[2] / 2,   y + 5.5, { align: "center" });
      y += thH;
    };

    drawTh();

    // Expand all items
    const rows: { epi: string; data: string; tipo: string; sigId: string }[] = [];
    [...ents].sort((a, b) => a.data.localeCompare(b.data)).forEach(e => {
      const sigId = `#${String(e.id).padStart(4, "0")}`;
      e.itens.forEach(item => {
        rows.push({
          epi:   item.nome,
          data:  fmtDate(e.data),
          tipo:  e.tipo_assinatura === "facial"  ? "Facial"
               : e.tipo_assinatura === "digital" ? "Digital"
               : e.tipo_assinatura === "manual"  ? "Manual"
               : "—",
          sigId,
        });
      });
    });

    const totalRows = Math.max(rows.length + 2, 18);

    for (let i = 0; i < totalRows; i++) {
      if (y + rowH > pageH - mg) {
        doc.addPage();
        y = mg;
        drawTh();
      }
      doc.rect(mg, y, cw, rowH);
      vline(mg + colW[0],           rowH);
      vline(mg + colW[0] + colW[1], rowH);

      if (i < rows.length) {
        const sigX = mg + colW[0] + colW[1] + colW[2] / 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const epiLabel = doc.splitTextToSize(rows[i].epi, colW[0] - 4)[0] ?? "";
        doc.text(epiLabel, mg + 2, y + 5);
        doc.text(rows[i].data, mg + colW[0] + colW[1] / 2, y + 5, { align: "center" });
        // tipo de assinatura
        doc.setFontSize(7.5);
        doc.setTextColor(40, 40, 40);
        doc.text(rows[i].tipo, sigX, y + 3.8, { align: "center" });
        // ID da entrega em destaque
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(120, 100, 40);
        doc.text(rows[i].sigId, sigX, y + 7.2, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      }
      y += rowH;
    }

    doc.save(`ficha_epis_${func.nome.replace(/\s+/g, "_")}_${dataInicio}_a_${dataFim}.pdf`);
  };

  return (
    <div>
      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">De</label>
              <input
                type="date" className="input" value={dataInicio}
                onChange={e => { setDataInicio(e.target.value); setCurrentPage(1); }}
                style={{ width: 160 }}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Até</label>
              <input
                type="date" className="input" value={dataFim}
                onChange={e => { setDataFim(e.target.value); setCurrentPage(1); }}
                style={{ width: 160 }}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label className="input-label">Funcionário</label>
              <input
                type="text" className="input" placeholder="Filtrar por nome..."
                value={busca} onChange={e => { setBusca(e.target.value); setCurrentPage(1); }}
              />
            </div>
            {busca && (
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 0 }} onClick={() => { setBusca(""); setCurrentPage(1); }}>
                ✕ Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Cargo</th>
                <th>Matrícula</th>
                <th>Entregas no período</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                    Nenhuma entrega assinada no período selecionado
                  </td>
                </tr>
              )}
              {paginadas.map(({ func, ents }) => (
                <tr key={func.id}>
                  <td><span style={{ fontWeight: 600 }}>{func.nome}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--text2)" }}>{func.cargo}</span></td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{func.matricula}</span></td>
                  <td>
                    <span className="badge badge-blue">{ents.length} entrega{ents.length !== 1 ? "s" : ""}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
                      · {ents.reduce((acc, e) => acc + e.itens.length, 0)} item(ns)
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      title="Baixar ficha PDF"
                      onClick={() => gerarFicha(func, ents)}
                    >
                      ⬇️ Ficha PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
              {[10, 25, 50].map(n => (
                <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => { setPageSize(n); setCurrentPage(1); }}>{n}</button>
              ))}
              <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{linhas.length} funcionário{linhas.length !== 1 ? "s" : ""}</span>
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