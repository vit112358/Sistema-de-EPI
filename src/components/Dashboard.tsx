import { useState, useEffect } from "react";
import type { Epi, Funcionario, Entrega } from "../types";

interface Props {
  epis: Epi[];
  funcionarios: Funcionario[];
  entregas: Entrega[];
  onNav: (page: string) => void;
}

export function Dashboard({ epis, funcionarios, entregas, onNav }: Props) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);
  const alertas = epis.filter(e => e.estoque <= e.minimo);
  const pendentes = entregas.filter(e => e.status === "pendente_assinatura");

  return (
    <div>
      <div className="stats-grid">
        {[
          { icon: "📦", value: epis.length, label: "EPIs Cadastrados", color: "orange" },
          { icon: "👷", value: funcionarios.length, label: "Funcionários", color: "blue" },
          { icon: "📋", value: entregas.filter(e => e.status === "assinado").length, label: "Entregas Assinadas", color: "green" },
          { icon: "⚠️", value: alertas.length + pendentes.length, label: "Alertas Pendentes", color: "red" },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`} style={{ opacity: animated ? 1 : 0, transform: animated ? "none" : "translateY(12px)", transition: `all 0.4s ${i * 0.08}s` }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Últimas Entregas</span><button className="btn btn-ghost btn-sm" onClick={() => onNav("entregas")}>Ver todas</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Funcionário</th><th>Status</th><th>Assinatura</th></tr></thead>
              <tbody>
                {entregas.slice(0, 4).map(e => (
                  <tr key={e.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{e.funcionario.split(" ").slice(0, 2).join(" ")}</div><div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{e.data}</div></td>
                    <td>
                      {e.status === "assinado" && <span className="badge badge-green">✓ Assinado</span>}
                      {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                      {e.status === "cancelado" && <span className="badge badge-gray">✕ Cancelado</span>}
                    </td>
                    <td>
                      {e.tipo_assinatura === "facial" && <span className="badge badge-blue">👤 Facial</span>}
                      {e.tipo_assinatura === "digital" && <span className="badge badge-blue">👆 Digital</span>}
                      {e.tipo_assinatura === "manual" && <span className="badge badge-gray">✍️ Manual</span>}
                      {!e.tipo_assinatura && <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔴 Alertas</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.map(e => (<div key={e.id} className="alert alert-error"><div style={{ fontSize: 18 }}>{e.img}</div><div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{e.nome}</div><div style={{ fontSize: 11, opacity: 0.8 }}>Estoque: {e.estoque} · Mínimo: {e.minimo}</div></div></div>))}
            {pendentes.map(e => (<div key={e.id} className="alert alert-warning"><div style={{ fontSize: 18 }}>📋</div><div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Entrega #{String(e.id).padStart(4,"0")} pendente</div><div style={{ fontSize: 11, opacity: 0.8 }}>{e.funcionario.split(" ")[0]} · Aguardando assinatura</div></div></div>))}
            {alertas.length === 0 && pendentes.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div>Tudo em ordem</div>}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><span className="card-title">Ações Rápidas</span></div>
        <div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => onNav("nova-entrega")}>📋 Nova Entrega</button>
          <button className="btn btn-ghost" onClick={() => onNav("cancelar-entrega")}>🚫 Cancelar Entrega</button>
          <button className="btn btn-ghost" onClick={() => onNav("funcionarios")}>👷 Funcionários</button>
          <button className="btn btn-ghost" onClick={() => onNav("biometria")}>👆 Biometria</button>
          <button className="btn btn-ghost" onClick={() => onNav("relatorio-troca")}>🔄 Relatório de Trocas</button>
        </div>
      </div>
    </div>
  );
}