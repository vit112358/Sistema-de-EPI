import { useState } from "react";
import type { SessionUser } from "../offline/session";

interface Props {
  onLogin: (u: SessionUser) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username || !pass) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, senha: pass }),
        credentials: 'include',
      });
      if (res.ok) {
        const user: SessionUser = await res.json();
        onLogin(user);
      } else {
        setErr("Credenciais inválidas");
      }
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
          <img src="/favicon.svg" alt="" style={{ width: 96, height: 96, marginBottom: -14 }} />
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 26, fontWeight: 800 }}>SegurID</div>
          <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", letterSpacing: 1 }}>CONTROLE DE EQUIPAMENTOS · v2.1</div>
        </div>
        <div className="input-group"><label className="input-label">Usuário</label><input className="input" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setUsername(e.target.value); setErr(""); }} /></div>
        <div className="input-group">
          <label className="input-label">Senha</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              style={{ paddingRight: 40 }}
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPass(e.target.value); setErr(""); }}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              aria-label={showPass ? "Esconder senha" : "Mostrar senha"}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 12.5, padding: 4 }}
            >
              {showPass ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={submit} disabled={loading}>
          {loading ? <><span className="pulse">●</span> Autenticando...</> : "Entrar"}
        </button>
      </div>
    </div>
  );
}