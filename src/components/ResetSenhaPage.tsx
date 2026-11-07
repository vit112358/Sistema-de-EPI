import { useState } from "react";

interface Props {
  token: string;
  onConcluido: () => void;
}

export function ResetSenhaPage({ token, onConcluido }: Props) {
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (!senhaNova || !confirmar) { setErr("Preencha todos os campos"); return; }
    if (senhaNova !== confirmar) { setErr("A nova senha e a confirmação não coincidem"); return; }
    if (senhaNova.length < 8) { setErr("A nova senha deve ter no mínimo 8 caracteres"); return; }
    if (!/[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senhaNova)) {
      setErr("A nova senha deve conter ao menos 1 número ou caractere especial");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha_nova: senhaNova }),
      });
      if (res.ok) setOk(true);
      else setErr((await res.json().catch(() => ({}))).error || "Erro ao redefinir senha");
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
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 22, fontWeight: 800 }}>Redefinir senha</div>
        </div>
        {ok ? (
          <>
            <div className="alert alert-success" style={{ marginBottom: 14 }}>Senha redefinida com sucesso! Entre com a nova senha.</div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={onConcluido}>Ir para o login</button>
          </>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Nova senha</label>
              <input className="input" type="password" value={senhaNova} onChange={e => { setSenhaNova(e.target.value); setErr(""); }} />
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Mínimo 8 caracteres com ao menos 1 número ou símbolo</div>
            </div>
            <div className="input-group">
              <label className="input-label">Confirmar nova senha</label>
              <input className="input" type="password" value={confirmar} onChange={e => { setConfirmar(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={submit} disabled={loading}>
              {loading ? <><span className="pulse">●</span> Salvando...</> : "Definir nova senha"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
