import { useState } from "react";

interface Props {
  onVoltar: () => void;
}

export function EsqueceuSenhaPage({ onVoltar }: Props) {
  const [identificador, setIdentificador] = useState("");
  const [err, setErr] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identificador.trim()) { setErr("Informe seu usuário ou e-mail"); return; }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim() }),
      });
      if (res.ok) setEnviado(true);
      else setErr((await res.json().catch(() => ({}))).error || "Erro ao solicitar redefinição");
    } catch {
      setErr("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <img src="/favicon.svg" alt="" style={{ width: 72, height: 72, marginBottom: -10 }} />
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 22, fontWeight: 800 }}>Esqueci minha senha</div>
        </div>
        {enviado ? (
          <div className="alert alert-success" style={{ marginBottom: 14 }}>
            Se o usuário existir e tiver e-mail cadastrado, enviamos um link de redefinição. Confira sua caixa de entrada (e o spam). O link vale por 1 hora.
          </div>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Usuário ou e-mail</label>
              <input
                className="input"
                value={identificador}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setIdentificador(e.target.value); setErr(""); }}
                onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
              />
            </div>
            {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={submit} disabled={loading}>
              {loading ? <><span className="pulse">●</span> Enviando...</> : "Enviar link de redefinição"}
            </button>
          </>
        )}
        <button type="button" onClick={onVoltar} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 12.5 }}>
          ← Voltar ao login
        </button>
      </div>
    </div>
  );
}
