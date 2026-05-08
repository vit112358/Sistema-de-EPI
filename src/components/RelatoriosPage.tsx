import type { Epi, Entrega } from "../types";

interface Props {
  epis: Epi[];
  entregas: Entrega[];
}

export function RelatoriosPage({ epis, entregas }: Props) {
  const total = entregas.length;
  const assinados = entregas.filter(e => e.status === "assinado").length;
  const facial = entregas.filter(e => e.tipo_assinatura === "facial").length;
  const digital = entregas.filter(e => e.tipo_assinatura === "digital").length;
  const manual = entregas.filter(e => e.tipo_assinatura === "manual").length;
  const pct = (v: number) => total ? ((v / total) * 100).toFixed(0) : 0;

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "Taxa de Conformidade", value: pct(assinados) + "%", color: "green", icon: "✅" },
          { label: "Confiança Média Biométrica", value: "95.4%", color: "orange", icon: "📊" },
          { label: "Total de Entregas", value: total, color: "blue", icon: "📋" },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Tipos de Assinatura</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Facial", icon: "👤", value: facial, color: "var(--blue)" },
              { label: "Digital", icon: "👆", value: digital, color: "var(--orange)" },
              { label: "Manual", icon: "✍️", value: manual, color: "var(--text2)" },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span>{item.icon} {item.label}</span>
                  <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{item.value} ({pct(item.value)}%)</span>
                </div>
                <div className="confidence-bar">
                  <div className="confidence-fill" style={{ width: pct(item.value) + "%", background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Estoque de EPIs</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>EPI</th><th>Estoque</th><th>Status</th></tr></thead>
              <tbody>
                {epis.map(e => (
                  <tr key={e.id}>
                    <td><span style={{ marginRight: 6 }}>{e.img}</span>{e.nome.split(" ").slice(0, 2).join(" ")}</td>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{e.estoque}</span>
                      <span style={{ color: "var(--text3)", fontSize: 11 }}>/{e.minimo}</span>
                    </td>
                    <td>
                      {e.estoque <= e.minimo
                        ? <span className="badge badge-red">⚠ Crítico</span>
                        : <span className="badge badge-green">✓ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}