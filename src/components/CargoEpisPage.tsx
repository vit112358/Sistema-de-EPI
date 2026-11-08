import { useEffect, useState } from "react";
import type { Cargo, Epi, Toast } from "../types";
import { apiFetch } from "../api";

interface Props {
  cargos: Cargo[];
  epis: Epi[];
  toast: (msg: string, type?: Toast['type']) => void;
}

// Cadastro do vínculo Cargo ↔ EPI: define quais EPIs aparecem na Nova Entrega para cada cargo.
export function CargoEpisPage({ cargos, epis, toast }: Props) {
  const [vinculos, setVinculos] = useState<{ cargo_id: number; epi_id: number }[]>([]);
  const [cargoId, setCargoId] = useState<number | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    apiFetch('/api/cargo-epis').then(r => r.json()).then(setVinculos)
      .catch(() => toast("Erro ao carregar vínculos", "error"));
  }, []);

  const escolher = (id: number) => {
    setCargoId(id);
    setMarcados(new Set(vinculos.filter(v => v.cargo_id === id).map(v => v.epi_id)));
    setBusca("");
  };

  const toggle = (id: number) => setMarcados(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const salvar = async () => {
    if (cargoId === null) return;
    setSalvando(true);
    try {
      const r = await apiFetch(`/api/cargos/${cargoId}/epis`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epi_ids: [...marcados] }),
      });
      if (!r.ok) throw new Error();
      setVinculos(prev => [...prev.filter(v => v.cargo_id !== cargoId), ...[...marcados].map(epi_id => ({ cargo_id: cargoId, epi_id }))]);
      toast("Vínculos salvos!", "success");
    } catch { toast("Erro ao salvar vínculos", "error"); }
    setSalvando(false);
  };

  // mesma regra da Nova Entrega: cas_json (vários CAs) ou o CA único legado
  const casDoEpi = (e: Epi): string => {
    try { if (e.cas_json) return (JSON.parse(e.cas_json) as { numero: string }[]).map(c => c.numero).filter(Boolean).join(", "); } catch { /* cai no CA único */ }
    return e.ca || "";
  };

  const lista = epis.filter(e => e.id != null && (!busca.trim() || e.nome.toLowerCase().includes(busca.trim().toLowerCase())));
  const qtdDoCargo = (id: number) => vinculos.filter(v => v.cargo_id === id).length;

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: 16 }}>
        ℹ️ Na Nova Entrega, o funcionário só verá os EPIs vinculados ao cargo dele. Cargo sem nenhum EPI vinculado mostra todos.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 2fr", gap: 16, alignItems: "start" }}>
        <div className="card">
          <div className="card-header"><span className="card-title">🏷️ Cargos</span></div>
          <div className="card-body">
            {cargos.length === 0 && <div className="empty-state">Nenhum cargo cadastrado</div>}
            {cargos.map(c => (
              <div key={c.id} onClick={() => escolher(c.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 4,
                  border: cargoId === c.id ? "1px solid var(--orange)" : "1px solid transparent", background: cargoId === c.id ? "var(--orange-dim)" : undefined }}>
                <span style={{ fontWeight: 500 }}>{c.nome}</span>
                <span className={`badge ${qtdDoCargo(c.id) ? "badge-blue" : "badge-gray"}`}>{qtdDoCargo(c.id)} EPI{qtdDoCargo(c.id) !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">🦺 EPIs do cargo{cargoId !== null ? `: ${cargos.find(c => c.id === cargoId)?.nome ?? ""}` : ""}</span>
            {cargoId !== null && (
              <button className="btn btn-primary" disabled={salvando} onClick={salvar}>💾 Salvar ({marcados.size})</button>
            )}
          </div>
          <div className="card-body">
            {cargoId === null ? (
              <div className="empty-state"><div className="empty-icon">👈</div>Selecione um cargo para vincular EPIs</div>
            ) : (
              <>
                <input className="input" style={{ marginBottom: 12, maxWidth: 300 }} placeholder="Filtrar EPI..." value={busca}
                  onChange={e => setBusca(e.target.value)} />
                {lista.length === 0 && <div className="empty-state">Nenhum EPI encontrado</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {lista.map(e => (
                    <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                      border: marcados.has(e.id!) ? "1px solid var(--orange)" : "1px solid var(--border)", background: marcados.has(e.id!) ? "var(--orange-dim)" : undefined }}>
                      <input type="checkbox" checked={marcados.has(e.id!)} onChange={() => toggle(e.id!)} />
                      <span>{e.img}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, display: "block" }}>{e.nome}</span>
                        <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text3)", display: "block" }}>
                          {casDoEpi(e) ? `CA ${casDoEpi(e)}` : "sem CA"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
