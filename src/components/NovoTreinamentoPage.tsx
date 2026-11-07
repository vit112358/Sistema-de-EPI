import { useEffect, useState } from "react";
import type { Funcionario, Treinamento, Toast } from "../types";
import { apiFetch } from "../api";
import { fmtDateStr } from "../helpers";
import { addMeses, fmtPeriodicidade } from "./TreinamentosPage";

interface Props {
  funcionarios: Funcionario[];
  toast: (msg: string, type?: Toast['type']) => void;
  onNav: (page: string) => void;
}

const hoje = () => new Date().toISOString().split("T")[0];

export function NovoTreinamentoPage({ funcionarios, toast, onNav }: Props) {
  const [step, setStep] = useState(0);
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [tipos, setTipos] = useState<Treinamento[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [data, setData] = useState(hoje());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/treinamentos').then(r => r.json()).then(setTipos).catch(() => toast("Erro ao carregar treinamentos", "error"));
  }, []);

  const sel = tipos.filter(t => selected.includes(t.id));
  const toggle = (id: number) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const reset = () => { setStep(0); setFunc(null); setSelected([]); setData(hoje()); };

  const confirmar = async () => {
    setSaving(true);
    try {
      const r = await apiFetch('/api/treinamento-registros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionario_id: func!.id, data, treinamento_ids: selected }),
      });
      if (!r.ok) throw new Error();
      toast("Treinamento registrado!", "success");
      setStep(3);
    } catch {
      toast("Erro ao registrar treinamento", "error");
    }
    setSaving(false);
  };

  const tabela = (
    <table>
      <thead><tr><th>Treinamento</th><th>Periodicidade</th><th>Realizado em</th><th>Próximo vencimento</th></tr></thead>
      <tbody>{sel.map(t => (
        <tr key={t.id}>
          <td style={{ fontWeight: 500 }}>{t.nome}</td>
          <td>{fmtPeriodicidade(t.periodicidade_meses)}</td>
          <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{fmtDateStr(data)}</td>
          <td style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "var(--orange)" }}>{fmtDateStr(addMeses(data, t.periodicidade_meses))}</td>
        </tr>
      ))}</tbody>
    </table>
  );

  if (step === 3) return (
    <div>
      <div className="alert alert-success" style={{ marginBottom: 20 }}>✅ Treinamento registrado com sucesso!</div>
      <div className="card">
        <div className="card-header"><span className="card-title">{func?.nome}</span></div>
        <div className="card-body">{tabela}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={reset}>Novo Treinamento</button>
        <button className="btn btn-ghost" onClick={() => onNav("treinamentos")}>Ver Histórico</button>
      </div>
    </div>
  );

  const steps = ["Funcionário", "Treinamentos", "Confirmar", "Recibo"];
  return (
    <div>
      <div className="steps">{steps.map((s, i) => (<div key={i} className={`step${i === step ? " active" : i < step ? " done" : ""}`}><div className="step-circle">{i < step ? "✓" : i + 1}</div><div className="step-label">{s}</div></div>))}</div>

      {step === 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Selecionar Funcionário</span></div>
          <div className="card-body">
            <div className="func-grid">
              {funcionarios.map(f => (
                <div key={f.id} className="func-card" style={{ cursor: "pointer", border: func?.id === f.id ? "1px solid var(--orange)" : undefined, background: func?.id === f.id ? "var(--orange-dim)" : undefined }} onClick={() => setFunc(f)}>
                  <div className="func-avatar">{f.nome[0]}</div>
                  <div><div className="func-name">{f.nome}</div><div className="func-info">{f.matricula} · {f.cargo}</div>{func?.id === f.id && <span className="badge badge-orange" style={{ marginTop: 4 }}>Selecionado</span>}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!func} onClick={() => setStep(1)}>Próximo →</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Treinamentos realizados</span></div>
          <div className="card-body">
            <div className="input-group" style={{ maxWidth: 220, marginBottom: 16 }}>
              <label className="input-label">Data de realização</label>
              <input className="input" type="date" max={hoje()} value={data} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData(e.target.value)} />
            </div>
            {tipos.length === 0
              ? <div className="empty-state"><div className="empty-icon">🎓</div>Nenhum tipo de treinamento cadastrado (menu Cadastros)</div>
              : <div className="epi-grid">{tipos.map(t => {
                  const on = selected.includes(t.id);
                  return (
                    <div key={t.id} className="epi-card" style={{ cursor: "pointer", border: on ? "1px solid var(--orange)" : undefined, background: on ? "var(--orange-dim)" : undefined }} onClick={() => toggle(t.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><div className="epi-icon">🎓</div>{on && <span className="badge badge-orange">✓</span>}</div>
                      <div className="epi-name">{t.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 4, fontFamily: "IBM Plex Mono" }}>🔄 {fmtPeriodicidade(t.periodicidade_meses)}</div>
                    </div>
                  );
                })}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Voltar</button>
              <button className="btn btn-primary" disabled={selected.length === 0 || !data} onClick={() => setStep(2)}>Próximo ({selected.length}) →</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Confirmação — {func?.nome}</span></div>
          <div className="card-body">{tabela}</div>
          <div className="modal-footer">
            <button className="btn btn-ghost" disabled={saving} onClick={() => setStep(1)}>← Editar</button>
            <button className="btn btn-primary" disabled={saving} onClick={confirmar}>{saving ? "⏳ Salvando..." : "✅ Confirmar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
