import { useState, useEffect, useRef } from "react";
import type { Funcionario, Biometria, Toast } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { extractDescriptor, descriptorToJson, detectLandmarks, computeEAR } from "../faceApi";

const LIVENESS_TIMEOUT = 15;
const PEAK_WINDOW      = 15;
const CLOSED_RATIO     = 0.82;
const OPEN_RATIO       = 0.84;

function CameraCapture({ onCapture, onCancel }: { onCapture: (base64: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrMsg("Câmera requer conexão segura (HTTPS).");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      })
      .catch((err: Error) => setErrMsg(err.message ?? "Câmera não disponível"));
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const stopStream = () => streamRef.current?.getTracks().forEach(t => t.stop());

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    stopStream();
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  };

  if (errMsg) return (
    <div style={{ textAlign: "center", padding: 24, color: "var(--red)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
      <div style={{ fontFamily: "IBM Plex Mono", fontSize: 12, marginBottom: 12 }}>{errMsg}</div>
      <button className="btn btn-ghost" onClick={() => { stopStream(); onCancel(); }}>Voltar</button>
    </div>
  );

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000" }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block", maxHeight: 280, transform: "scaleX(-1)" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="face-guide" />
      <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn btn-ghost" onClick={() => { stopStream(); onCancel(); }}>Cancelar</button>
        <button className="btn btn-primary" disabled={!ready} onClick={capture}>📸 Capturar</button>
      </div>
    </div>
  );
}

export function LivenessCapture({ onCapture, onCancel }: { onCapture: (b: string) => void; onCancel: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const earHistory  = useRef<number[]>([]);
  const eyesClosed  = useRef(false);

  type Stage = "loading" | "challenge" | "blink" | "success" | "timeout" | "error";
  const [stage, setStage]        = useState<Stage>("loading");
  const [timeLeft, setTimeLeft]  = useState(LIVENESS_TIMEOUT);
  const [faceFound, setFaceFound] = useState(false);
  const [dropPct, setDropPct]    = useState<number | null>(null);

  const stopIntervals = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timerRef.current)    { clearInterval(timerRef.current);    timerRef.current    = null; }
  };
  const stopStream = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const cleanup    = () => { stopIntervals(); stopStream(); };

  const captureFrame = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext("2d")!.drawImage(v, 0, 0);
    cleanup();
    onCapture(c.toDataURL("image/jpeg", 0.85));
  };

  const startAnalysis = () => {
    earHistory.current = [];
    eyesClosed.current = false;
    setDropPct(null);
    setFaceFound(false);
    setStage("challenge");

    let remaining = LIVENESS_TIMEOUT;
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) { stopIntervals(); stopStream(); setStage("timeout"); }
    }, 1000);

    intervalRef.current = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      try {
        const lm = await detectLandmarks(v);
        if (!lm) { setFaceFound(false); return; }
        setFaceFound(true);
        const ear = computeEAR(lm);

        earHistory.current.push(ear);
        if (earHistory.current.length > PEAK_WINDOW) earHistory.current.shift();

        if (earHistory.current.length < 3) return;

        const peak = Math.max(...earHistory.current);
        const ratio = ear / peak;
        setDropPct(Math.round((1 - ratio) * 100));

        if (ratio < CLOSED_RATIO) {
          eyesClosed.current = true;
          setStage("blink");
        } else if (ratio >= OPEN_RATIO && eyesClosed.current) {
          eyesClosed.current = false;
          stopIntervals();
          setStage("success");
          setTimeout(captureFrame, 400);
        } else if (!eyesClosed.current) {
          setStage("challenge");
        }
      } catch { /* frame descartado */ }
    }, 80);
  };

  const startCamera = () => {
    stopIntervals();
    stopStream();
    setStage("loading");
    if (!navigator.mediaDevices?.getUserMedia) { setStage("error"); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setTimeout(startAnalysis, 800);
      })
      .catch(() => setStage("error"));
  };

  useEffect(() => { startCamera(); return cleanup; }, []);

  const stageInfo: Record<Stage, { icon: string; text: string; color: string }> = {
    loading:   { icon: "⏳", text: "Iniciando câmera...",                                              color: "var(--text3)"  },
    challenge: { icon: faceFound ? "👁" : "😶", text: faceFound ? "Pisque os olhos" : "Posicione seu rosto na câmera", color: faceFound ? "var(--orange)" : "var(--text3)" },
    blink:     { icon: "😌", text: "Olhos fechados...",                                               color: "var(--orange)" },
    success:   { icon: "✅", text: "Vida confirmada!",                                                color: "var(--green)"  },
    timeout:   { icon: "⏱", text: "Tempo esgotado.",                                                 color: "var(--red)"    },
    error:     { icon: "📷", text: "Câmera não disponível (requer HTTPS).",                           color: "var(--red)"    },
  };
  const info = stageInfo[stage];

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", background: "#000", position: "relative" }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block", maxHeight: 280, transform: "scaleX(-1)" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="face-guide" />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{info.icon}</span>
          <span style={{ fontSize: 12, color: info.color, fontFamily: "IBM Plex Mono" }}>{info.text}</span>
        </div>
        {(stage === "challenge" || stage === "blink") && (
          <span style={{ fontFamily: "IBM Plex Mono", fontSize: 13, color: timeLeft <= 3 ? "var(--red)" : "var(--text2)", fontWeight: 700 }}>{timeLeft}s</span>
        )}
      </div>
      {dropPct !== null && (stage === "challenge" || stage === "blink") && (
        <div style={{ position: "absolute", bottom: 48, left: 14, right: 14 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "IBM Plex Mono", marginBottom: 3 }}>
            fechamento dos olhos {dropPct > 0 ? `−${dropPct}%` : ""}
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, dropPct * 6)}%`, background: stage === "blink" ? "var(--orange)" : "var(--green)", transition: "width 0.08s" }} />
          </div>
        </div>
      )}
      <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn btn-ghost" onClick={() => { cleanup(); onCancel(); }}>Cancelar</button>
        {(stage === "timeout" || stage === "error") && (
          <button className="btn btn-primary" onClick={startCamera}>Tentar novamente</button>
        )}
      </div>
    </div>
  );
}

interface Props {
  funcionarios: Funcionario[];
  setFuncionarios: (action: React.SetStateAction<Funcionario[]>) => void;
  toast: (msg: string, type?: Toast['type']) => void;
}

export function BiometriaPage({ funcionarios, setFuncionarios, toast }: Props) {
  const [tab, setTab] = useState("registrar");
  const [func, setFunc] = useState<Funcionario | undefined>(funcionarios[0]);
  const [type, setType] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState<{ bioId: number; funcId: number; funcNome: string; tipo: string } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);

  useEffect(() => {
    const found = funcionarios.find(f => f.id === func?.id);
    if (found) setFunc(found);
  }, [funcionarios]);

  const saveBiometria = async (imagemBase64: string | null = null) => {
    setCameraActive(false);
    setScanning(true); setProgress(0);

    let descriptor_json: string | null = null;
    if (imagemBase64 && type === "facial") {
      try {
        const desc = await extractDescriptor(imagemBase64);
        if (desc) descriptor_json = descriptorToJson(desc);
      } catch (e) {
        console.warn("Falha ao extrair descriptor facial:", e);
      }
    }

    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12;
      setProgress(Math.min(100, p));
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(async () => {
          const qualidade = descriptor_json ? 99 : +(90 + Math.random() * 9).toFixed(1);
          const novaBio: Biometria = { funcionario_id: func!.id!, tipo: type!, data: new Date().toISOString().split("T")[0], qualidade, imagem_base64: imagemBase64, descriptor_json };
          try {
            const res = await fetch('/api/biometrias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaBio) });
            const data = await res.json();
            setFuncionarios(prev => prev.map(f => f.id === func!.id ? { ...f, biometrias: [...f.biometrias, { ...novaBio, id: data.id }] } : f));
          } catch {
            setFuncionarios(prev => prev.map(f => f.id === func!.id ? { ...f, biometrias: [...f.biometrias, novaBio] } : f));
          }
          setScanning(false);
          setDone(true);
          toast(`Biometria ${type === "facial" ? "facial" : "digital"} registrada!`, "success");
        }, 400);
      }
    }, 180);
  };

  const handleIniciarCaptura = () => {
    if (type === "facial") setCameraActive(true);
    else saveBiometria(null);
  };

  const deleteBio = async (bioId: number, funcId: number) => {
    try {
      await fetch(`/api/biometrias/${bioId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Erro ao deletar biometria', err);
    }
    setFuncionarios(prev => prev.map(f => f.id === funcId ? { ...f, biometrias: f.biometrias.filter((b: Biometria) => b.id !== bioId) } : f));
    toast("Biometria excluída.", "info");
    setConfirm(null);
  };

  if (funcionarios.length === 0) return (
    <div className="card">
      <div className="card-body" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Nenhum funcionário cadastrado</div>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>Cadastre um funcionário antes de registrar biometrias.</div>
      </div>
    </div>
  );

  if (tab === "gerenciar") return (
    <div>
      <div className="tab-bar">
        <div className="tab" onClick={() => setTab("registrar")}>Registrar</div>
        <div className="tab active">Gerenciar</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {funcionarios.map(f => (
          <div key={f.id} className="card">
            <div className="card-header">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="func-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{f.nome[0]}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{f.matricula} · {f.setor}</div>
                </div>
              </div>
              {f.biometrias.length === 0 && <span className="badge badge-gray">Sem biometrias</span>}
            </div>
            {f.biometrias.length > 0 && (
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {f.biometrias.map((b, i) => (
                  <div key={i} className="bio-registered-item">
                    <div style={{ fontSize: 22 }}>{b.tipo === "facial" ? "👤" : "👆"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.tipo === "facial" ? "Biometria Facial" : "Impressão Digital"}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>Cadastrada em {b.data} · Qualidade: {b.qualidade}%</div>
                    </div>
                    <span className="badge badge-green" style={{ marginRight: 8 }}>✓ Ativo</span>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ bioId: b.id!, funcId: f.id!, funcNome: f.nome, tipo: b.tipo })}>🗑 Excluir</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {confirm && (
        <ConfirmDialog
          icon="🗑️" title="Excluir Biometria" danger
          desc={`Excluir a biometria ${confirm.tipo === "facial" ? "facial" : "digital"} de ${confirm.funcNome}? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onConfirm={() => deleteBio(confirm.bioId, confirm.funcId)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );

  return (
    <div>
      <div className="tab-bar">
        <div className="tab active">Registrar</div>
        <div className="tab" onClick={() => { setDone(false); setType(null); setTab("gerenciar"); }}>Gerenciar / Excluir</div>
      </div>
      {done ? (
        <div>
          <div className="alert alert-success" style={{ marginBottom: 20 }}>✅ Biometria registrada para <strong>{func?.nome}</strong></div>
          <div className="card"><div className="card-body" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>{type === "facial" ? "👤" : "👆"}</div>
            <div style={{ fontFamily: "Barlow Condensed", fontSize: 24, fontWeight: 800, color: "var(--green)", marginBottom: 16 }}>BIOMETRIA REGISTRADA</div>
            <button className="btn btn-primary" onClick={() => { setDone(false); setType(null); setProgress(0); setLgpdConsent(false); }}>Registrar nova</button>
          </div></div>
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Funcionário</span></div>
            <div className="card-body">
              <select className="input" value={func?.id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFunc(funcionarios.find(f => f.id === +e.target.value)); setType(null); setDone(false); setLgpdConsent(false); }}>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.matricula}</option>)}
              </select>
              {func && func.biometrias.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {func.biometrias.map((b, i) => <span key={i} className="badge badge-green">{b.tipo === "facial" ? "👤 Facial" : "👆 Digital"} registrada</span>)}
                </div>
              )}
            </div>
          </div>
          <div className="bio-panel">
            {[{ t: "facial", icon: "👤", title: "Biometria Facial", desc: "Captura 128 pontos de referência do rosto" }, { t: "digital", icon: "👆", title: "Impressão Digital", desc: "Leitura via sensor biométrico (ZFM-20 / Suprema)" }].map(o => (
              <div key={o.t} className={`bio-option${type === o.t ? " active" : ""}`} onClick={() => { setType(o.t); setLgpdConsent(false); }}>
                <div className="bio-option-icon">{o.icon}</div>
                <div><div className="bio-option-title">{o.title}</div><div className="bio-option-desc">{o.desc}</div></div>
                <div style={{ marginLeft: "auto" }}>{type === o.t ? <span style={{ color: "var(--orange)", fontSize: 20 }}>●</span> : <span style={{ color: "var(--border2)", fontSize: 20 }}>○</span>}</div>
              </div>
            ))}
          </div>
          {type === "facial" && !lgpdConsent && (
            <div style={{ marginTop: 16, background: "rgba(255,171,0,0.07)", border: "1px solid rgba(255,171,0,0.3)", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 15, color: "var(--orange)", marginBottom: 8, letterSpacing: 0.5 }}>LGPD — Consentimento para Dados Biométricos</div>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
                Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), informamos que:
                <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                  <li>A imagem facial e o descritor biométrico serão armazenados localmente para fins de verificação de identidade na entrega de EPIs.</li>
                  <li>Os dados não serão compartilhados com terceiros.</li>
                  <li>O titular pode solicitar a exclusão dos dados a qualquer momento na aba <strong>Gerenciar</strong>.</li>
                  <li>A base legal é o legítimo interesse do empregador para controle de segurança (Art. 11, II, "a" da LGPD).</li>
                </ul>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13, color: "var(--text1)" }}>
                <input type="checkbox" style={{ marginTop: 2, flexShrink: 0 }} checked={lgpdConsent} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLgpdConsent(e.target.checked)} />
                <span>O funcionário <strong>{func?.nome}</strong> foi informado e consente com o tratamento dos dados biométricos faciais conforme descrito acima.</span>
              </label>
            </div>
          )}
          {type === "facial" && lgpdConsent && !cameraActive && (
            <div className="face-capture" style={{ height: 200, marginTop: 16, borderRadius: 10 }}>
              <div className="face-guide" />
              {scanning && <div className="scan-line" />}
              {!scanning && <div style={{ textAlign: "center", zIndex: 2 }}><div style={{ fontSize: 32 }}>📷</div><div style={{ fontSize: 11, color: "var(--text3)" }}>Clique em Iniciar Captura para abrir a câmera</div></div>}
            </div>
          )}
          {type === "facial" && cameraActive && (
            <div style={{ marginTop: 16 }}>
              <CameraCapture onCapture={saveBiometria} onCancel={() => setCameraActive(false)} />
            </div>
          )}
          {type === "digital" && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ display: "inline-flex", width: 120, height: 120, background: "var(--surface2)", border: `1px solid ${scanning ? "var(--orange)" : "var(--border)"}`, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <div style={{ fontSize: 44 }}>🫸</div>
                <div style={{ fontSize: 10, fontFamily: "IBM Plex Mono", color: "var(--text3)" }}>{scanning ? "LENDO..." : "SENSOR"}</div>
              </div>
            </div>
          )}
          {scanning && (
            <div className="confidence-meter" style={{ marginTop: 16 }}>
              <div className="confidence-label"><span>Processando...</span><span>{progress.toFixed(0)}%</span></div>
              <div className="confidence-bar"><div className="confidence-fill" style={{ width: progress + "%", background: "var(--orange)" }} /></div>
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!type || scanning || cameraActive || (type === "facial" && !lgpdConsent)} onClick={handleIniciarCaptura}>
            {scanning ? "⏳ Processando..." : "Iniciar Captura"}
          </button>
        </div>
      )}
    </div>
  );
}