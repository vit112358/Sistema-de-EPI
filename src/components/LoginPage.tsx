import { useState } from "react";
import type { Usuario } from "../types";
import { setToken } from "../api";

interface Props {
  onLogin: (u: Usuario) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState("admin");
  const [pass, setPass] = useState("");
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
      });
      if (res.ok) {
        const { token, ...user }: Usuario & { token: string } = await res.json();
        setToken(token);
        onLogin(user as Usuario);
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
          <div style={{ fontSize: 48, marginBottom: 10 }}>🦺</div>
          <div style={{ fontFamily: "Barlow Condensed", fontSize: 26, fontWeight: 800 }}>SISTEMA EPI</div>
          <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", letterSpacing: 1 }}>CONTROLE DE EQUIPAMENTOS · v2.1</div>
        </div>
        <div className="input-group"><label className="input-label">Usuário</label><input className="input" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setUsername(e.target.value); setErr(""); }} /></div>
        <div className="input-group"><label className="input-label">Senha</label><input className="input" type="password" value={pass} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPass(e.target.value); setErr(""); }} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()} /></div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={submit} disabled={loading}>
          {loading ? <><span className="pulse">●</span> Autenticando...</> : "Entrar"}
        </button>
      </div>
    </div>
  );
}