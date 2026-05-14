import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import type { Entrega, Epi, Funcionario, Toast, TipoAssinatura } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { declaracaoCompletaEpi, addDays, fmtDate } from "../helpers";
import { apiFetch } from "../api";
import {
  compareDescriptors, descriptorToJson, extractDescriptor,
  isCurrentModelDescriptor, jsonToDescriptor
} from "../faceApi";
import { LivenessCapture } from "./BiometriaPage";

interface SignModalProps {
  entrega: Entrega;
  funcionarios: Funcionario[];
  currentUserRole: string;
  onClose: () => void;
  onSign: (tipo: TipoAssinatura, confianca: number | null, sigImg: string | null) => void;
}

function SignModal({ entrega, funcionarios, currentUserRole, onClose, onSign }: SignModalProps) {
  const isAdmin = currentUserRole === "admin";
  const [sigType, setSigType] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);

  const [faceStage, setFaceStage] = useState<"idle" | "capture" | "verifying" | "result">("idle");
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [faceScore, setFaceScore] = useState<number | null>(null);
  const [faceOverride, setFaceOverride] = useState(false);

  const func = funcionarios.find(f => f.id === entrega.funcionario_id);
  const getBio = (tipo: string) =>
    func?.biometrias?.filter(b => b.tipo === tipo).sort((a, b) => (b.data > a.data ? 1 : -1))[0] ?? null;
  const bioFacial  = getBio("facial");
  const bioDigital = getBio("digital");

  const bioOpts = [
    bioFacial  ? { t: "facial",  icon: "👤", title: "Facial",  bio: bioFacial  } : null,
    bioDigital ? { t: "digital", icon: "👆", title: "Digital", bio: bioDigital } : null,
    { t: "manual", icon: "✍️", title: "Manual", bio: null },
  ].filter(Boolean) as { t: string; icon: string; title: string; bio: any }[];

  const selectSigType = (t: string) => {
    setSigType(t);
    setFaceStage("idle");
    setFacePhoto(null);
    setFaceScore(null);
    setFaceOverride(false);
  };

  const handleFaceCapture = async (base64: string) => {
    setFacePhoto(base64);
    setFaceStage("verifying");
    try {
      const capturedDesc = await extractDescriptor(base64);
      if (!capturedDesc) { setFaceScore(-1); setFaceStage("result"); return; }

      let score: number;
      if (bioFacial?.descriptor_json && isCurrentModelDescriptor(bioFacial.descriptor_json)) {
        score = compareDescriptors(jsonToDescriptor(bioFacial.descriptor_json), capturedDesc);
      } else if (bioFacial?.imagem_base64) {
        const refDesc = await extractDescriptor(bioFacial.imagem_base64);
        if (refDesc) {
          score = compareDescriptors(refDesc, capturedDesc);
          if (bioFacial.id) {
            const newDescJson = descriptorToJson(refDesc);
            apiFetch(`/api/biometrias/${bioFacial.id}/descriptor`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ descriptor_json: newDescJson }),
            }).catch(() => {});
          }
        } else { setFaceScore(-2); setFaceStage("result"); return; }
      } else {
        setFaceScore(-2);
        setFaceStage("result");
        return;
      }
      setFaceScore(score);
    } catch {
      setFaceScore(-2);
    }
    setFaceStage("result");
  };

  const facePassed   = faceScore !== null && faceScore >= 60;
  const faceDetected = faceScore !== null && faceScore >= 0;
  const canSign = signing ? false
    : sigType === "facial"  ? (faceStage === "result" && faceDetected && (facePassed || (isAdmin && faceOverride)))
    : sigType === "manual"  ? hasSig
    : !!sigType;

  const startSign = () => {
    if (!canSign) return;
    const sigImg = sigType === "facial"
      ? facePhoto
      : sigType === "manual" && canvasRef.current
        ? canvasRef.current.toDataURL("image/png")
        : null;
    setSigning(true); setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => onSign(sigType! as TipoAssinatura, sigType === "facial" ? faceScore : null, sigImg), 400);
      } else setProgress(p);
    }, 150);
  };

  const getCanvasPos = (e: MouseEvent | TouchEvent, r: DOMRect, c: HTMLCanvasElement): [number, number] => {
    const src = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    return [(src.clientX - r.left) * (c.width / r.width), (src.clientY - r.top) * (c.height / r.height)];
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const c = canvasRef.current!;
    const cx = c.getContext("2d")!;
    const [x, y] = getCanvasPos(e.nativeEvent, c.getBoundingClientRect(), c);
    cx.beginPath(); cx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault?.();
    const c = canvasRef.current!;
    const cx = c.getContext("2d")!;
    const [x, y] = getCanvasPos(e.nativeEvent, c.getBoundingClientRect(), c);
    cx.lineTo(x, y); cx.strokeStyle = "#1a1a2e"; cx.lineWidth = 3; cx.lineCap = "round"; cx.lineJoin = "round"; cx.stroke(); setHasSig(true);
  };
  const stopDraw = () => { drawing.current = false; };
  const clearSig  = () => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setHasSig(false); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Assinar Entrega #{String(entrega.id).padStart(4, "0")}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
            Funcionário: <strong>{entrega.funcionario}</strong> · {entrega.itens.length} item(ns)
          </div>

          <div className="bio-panel">
            {bioOpts.map(o => (
              <div key={o.t} className={`bio-option${sigType === o.t ? " active" : ""}`} onClick={() => selectSigType(o.t)}>
                {o.t === "facial" && o.bio?.imagem_base64
                  ? <img src={o.bio.imagem_base64} alt="bio" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border2)" }} />
                  : <div className="bio-option-icon">{o.icon}</div>}
                <div>
                  <div className="bio-option-title">{o.title}</div>
                  <div className="bio-option-desc">
                    {o.bio
                      ? `Cadastrada em ${o.bio.data}${o.bio.qualidade ? ` · ${o.bio.qualidade}% qualidade` : ""}`
                      : "Assinatura manuscrita"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── FACIAL ── */}
          {sigType === "facial" && faceStage === "idle" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
              <div style={{ color: "var(--text2)", marginBottom: 6 }}>Posicione o rosto do funcionário na câmera</div>
              <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 20 }}>
                {bioFacial?.imagem_base64 ? "Foto de referência disponível — comparação real será realizada" : "Sem foto de referência cadastrada"}
              </div>
              <button className="btn btn-primary" onClick={() => setFaceStage("capture")}>Iniciar Câmera</button>
            </div>
          )}

          {sigType === "facial" && faceStage === "capture" && (
            <LivenessCapture onCapture={handleFaceCapture} onCancel={() => setFaceStage("idle")} />
          )}

          {sigType === "facial" && faceStage === "verifying" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              {facePhoto && <img src={facePhoto} alt="captura" style={{ width: 110, height: 110, borderRadius: 10, objectFit: "cover", border: "2px solid var(--border2)", marginBottom: 16 }} />}
              <div style={{ color: "var(--orange)", fontFamily: "IBM Plex Mono", fontSize: 13, marginBottom: 12 }}>Analisando identidade...</div>
              <div className="confidence-meter">
                <div className="confidence-label"><span>Processando</span><span style={{ fontFamily: "IBM Plex Mono" }}>⏳</span></div>
                <div className="confidence-bar" style={{ overflow: "hidden" }}><div className="confidence-fill bar-indeterminate" style={{ background: "var(--orange)" }} /></div>
              </div>
            </div>
          )}

          {sigType === "facial" && faceStage === "result" && faceScore === -1 && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>😶</div>
              <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: 8 }}>Nenhum rosto detectado</div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>Centralize o rosto e garanta boa iluminação.</div>
              <button className="btn btn-primary" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); }}>Tentar novamente</button>
            </div>
          )}

          {sigType === "facial" && faceStage === "result" && faceScore === -2 && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 600, color: "var(--orange)", marginBottom: 8 }}>Sem biometria de referência válida</div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>Recadastre a biometria na tela de Biometria.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-ghost" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); }}>Tentar novamente</button>
                <button className="btn btn-ghost" onClick={() => selectSigType("manual")}>Usar manual</button>
              </div>
            </div>
          )}

          {sigType === "facial" && faceStage === "result" && faceScore !== null && faceScore >= 0 && (
            <div>
              <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 6, letterSpacing: 1 }}>CADASTRO</div>
                  {bioFacial?.imagem_base64
                    ? <img src={bioFacial.imagem_base64} alt="ref" style={{ width: 96, height: 96, borderRadius: 10, objectFit: "cover", border: "2px solid var(--border2)" }} />
                    : <div style={{ width: 96, height: 96, borderRadius: 10, background: "var(--surface2)", border: "2px dashed var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>👤</div>}
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{facePassed ? "✅" : "⚠️"}</div>
                  <div style={{ fontFamily: "IBM Plex Mono", fontWeight: 700, fontSize: 22, color: facePassed ? "var(--green)" : "var(--red)" }}>{faceScore}%</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>confiança</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 6, letterSpacing: 1 }}>CAPTURA</div>
                  {facePhoto && <img src={facePhoto} alt="cap" style={{ width: 96, height: 96, borderRadius: 10, objectFit: "cover", border: `2px solid ${facePassed ? "var(--green)" : "var(--red)"}` }} />}
                </div>
              </div>
              {!facePassed && (
                <div style={{ background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>Confiança abaixo do limite (60%)</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>Verifique visualmente as fotos acima antes de prosseguir.</div>
                  {isAdmin ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={faceOverride} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFaceOverride(e.target.checked)} />
                      Confirmo visualmente que é o mesmo funcionário (override administrador)
                    </label>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
                      Apenas administradores podem aprovar com confiança abaixo do limite.
                    </div>
                  )}
                </div>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); setFaceOverride(false); }}>🔄 Tentar novamente</button>
            </div>
          )}

          {/* ── DIGITAL ── */}
          {sigType === "digital" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>👆</div>
              <div style={{ color: "var(--text2)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>Posicione o dedo no leitor biométrico</div>
            </div>
          )}

          {/* ── MANUAL ── */}
          {sigType === "manual" && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Assine abaixo:</div>
              <canvas ref={canvasRef} className="sig-canvas" width={480} height={110}
                style={{ width: "100%", display: "block", touchAction: "none" }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={clearSig}>Limpar</button>
            </div>
          )}

          {signing && (
            <div className="confidence-meter" style={{ marginTop: 14 }}>
              <div className="confidence-label"><span>Verificando...</span><span>{progress.toFixed(0)}%</span></div>
              <div className="confidence-bar"><div className="confidence-fill" style={{ width: progress + "%", background: "var(--orange)" }} /></div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!canSign || signing} onClick={startSign}>
            {signing ? "⏳ Verificando..." : "✅ Assinar"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  entregas: Entrega[];
  setEntregas: (action: React.SetStateAction<Entrega[]>) => void;
  epis: Epi[];
  funcionarios: Funcionario[];
  currentUserRole: string;
  toast: (msg: string, type?: Toast['type']) => void;
}

export function EntregasPage({ entregas, setEntregas, epis, funcionarios, currentUserRole, toast }: Props) {
  const [filter, setFilter] = useState("todos");
  const [busca, setBusca] = useState("");
  const [ordemNome, setOrdemNome] = useState<"asc" | "desc" | null>(null);
  const [signModal, setSignModal] = useState<Entrega | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Entrega | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [filter, busca, ordemNome, pageSize]);

  const gerarFicha = (entrega: Entrega) => {
    const fmtDataStr = (s: string) => { const [yr, mo, dy] = s.split("-"); return `${dy}/${mo}/${yr}`; };
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("FICHA DE ENTREGA DE EPI", pageW / 2, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`#${String(entrega.id).padStart(4,"0")} · ${fmtDataStr(entrega.data)}`, pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const nomeFuncionario = entrega.funcionario ?? "";
    const declaracao = declaracaoCompletaEpi(nomeFuncionario);

    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(declaracao, contentW);
    doc.text(linhas, margin, y);
    y += linhas.length * 4.5 + 10;

    doc.setFontSize(9);
    doc.text(`Data: ${fmtDataStr(entrega.data)}`, margin, y);
    y += 16;

    const sigLineW = 80;
    const sigLineX = (pageW - sigLineW) / 2;

    if (entrega.assinatura_img) {
      const isJpeg = entrega.assinatura_img.startsWith("data:image/jpeg");
      if (entrega.tipo_assinatura === "manual") {
        doc.addImage(entrega.assinatura_img, "PNG", sigLineX, y, sigLineW, 20);
        y += 22;
      } else if (entrega.tipo_assinatura === "facial" || entrega.tipo_assinatura === "facial_override") {
        const photoSz = 22;
        const textX = sigLineX + photoSz + 3;
        doc.addImage(entrega.assinatura_img, isJpeg ? "JPEG" : "PNG", sigLineX, y, photoSz, photoSz);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(entrega.tipo_assinatura === "facial_override" ? "Override admin — verificado visualmente" : "Assinado biometricamente por", textX, y + 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(nomeFuncionario, textX, y + 16);
        doc.setFont("helvetica", "normal");
        y += photoSz + 4;
      }
    }

    doc.setDrawColor(0, 0, 0);
    doc.line(sigLineX, y, sigLineX + sigLineW, y);
    y += 5;
    doc.setFontSize(9);
    const isFacialType = entrega.tipo_assinatura === "facial" || entrega.tipo_assinatura === "facial_override";
    if (!isFacialType || !entrega.assinatura_img) {
      doc.text(nomeFuncionario, pageW / 2, y, { align: "center" });
      y += 4;
    }
    doc.setTextColor(100, 100, 100);
    const sigLabel = entrega.tipo_assinatura === "digital" ? "Assinado biometricamente (Digital)"
                   : "Assinatura do Funcionário";
    doc.text(sigLabel, pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 14;

    const pageH = 297;
    const colW = [contentW * 0.42, contentW * 0.22, contentW * 0.14, contentW * 0.22];
    const headers = ["EPI / Descrição", "CA", "Quantidade", "Próxima Troca"];

    const drawTableHeader = (yPos: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageW - margin, yPos);
      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("EPIs ENTREGUES", margin, yPos);
      yPos += 6;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos - 4, contentW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let hx = margin;
      headers.forEach((h, i) => { doc.text(h, hx + 2, yPos); hx += colW[i]; });
      yPos += 5;
      doc.setFont("helvetica", "normal");
      return yPos;
    };

    if (y > pageH - 60) { doc.addPage(); y = 20; }
    y = drawTableHeader(y);

    (entrega.itens ?? []).forEach(item => {
      if (y > pageH - 20) { doc.addPage(); y = 20; y = drawTableHeader(y); }
      const epiData = epis?.find(e => e.id === item.epi_id);
      const periodicidade = epiData?.periodicidade ?? undefined;
      const proxTroca = periodicidade != null ? fmtDate(addDays(entrega.data, periodicidade)) : "—";
      const row = [item.nome, item.ca ?? "", `${item.qtd || 1} un`, proxTroca];
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y + 3, pageW - margin, y + 3);
      let colX = margin;
      row.forEach((cell, i) => {
        doc.setFontSize(8);
        const wrapped = doc.splitTextToSize(String(cell), colW[i] - 4);
        doc.text(wrapped, colX + 2, y);
        colX += colW[i];
      });
      y += 7;
    });

    doc.save(`ficha_epi_${nomeFuncionario.replace(/\s+/g, "_")}_${entrega.data}.pdf`);
  };

  const doSign = (id: number | undefined, tipo: TipoAssinatura, confianca: number | null, sigImg: string | null) => {
    const entrega = entregas.find(e => e.id === id);
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, status: "assinado", tipo_assinatura: tipo, confianca, assinatura_img: sigImg } : e));
    setSignModal(null);
    toast("Entrega assinada com sucesso!", "success");
    if (entrega) gerarFicha({ ...entrega, status: "assinado", tipo_assinatura: tipo, confianca, assinatura_img: sigImg });
  };

  const doCancel = (id: number | undefined) => {
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, status: "cancelado" } : e));
    setCancelConfirm(null);
    toast("Entrega cancelada.", "info");
  };

  let filtered = filter === "todos" ? entregas : entregas.filter(e => e.status === filter);
  if (busca.trim()) {
    const termo = busca.trim().toLowerCase();
    filtered = filtered.filter(e => e.funcionario.toLowerCase().includes(termo));
  }
  if (ordemNome) {
    filtered = [...filtered].sort((a, b) =>
      ordemNome === "asc"
        ? a.funcionario.localeCompare(b.funcionario, "pt-BR")
        : b.funcionario.localeCompare(a.funcionario, "pt-BR")
    );
  }

  const toggleOrdem = () =>
    setOrdemNome(prev => prev === null ? "asc" : prev === "asc" ? "desc" : null);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[["todos","Todos"],["assinado","Assinados"],["pendente_assinatura","Pendentes"],["cancelado","Cancelados"]].map(([v,l]) => (
          <button key={v} className={`btn ${filter === v ? "btn-primary" : "btn-ghost"} btn-sm`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        <input
          type="text"
          className="input"
          placeholder="Filtrar por funcionário..."
          value={busca}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        {busca && (
          <button className="btn btn-ghost btn-sm" onClick={() => setBusca("")}>✕ Limpar</button>
        )}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={toggleOrdem}>
                  Funcionário {ordemNome === "asc" ? "↑" : ordemNome === "desc" ? "↓" : "↕"}
                </th>
                <th>Data</th><th>Itens</th><th>Status</th><th>Assinatura</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(e => (
                <tr key={e.id}>
                  <td><span style={{ fontFamily: "IBM Plex Mono", color: "var(--text3)", fontSize: 12 }}>#{String(e.id).padStart(4,"0")}</span></td>
                  <td><span style={{ fontWeight: 600 }}>{e.funcionario.split(" ").slice(0,2).join(" ")}</span></td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{e.data}</span></td>
                  <td><span className="badge badge-gray">{e.itens.length} item{e.itens.length !== 1 ? "s" : ""}</span></td>
                  <td>
                    {e.status === "assinado"            && <span className="badge badge-green">✓ Assinado</span>}
                    {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                    {e.status === "cancelado"           && <span className="badge badge-gray">✕ Cancelado</span>}
                  </td>
                  <td>
                    {e.tipo_assinatura === "facial"          && <span className="badge badge-blue">👤{e.confianca != null ? ` ${e.confianca}%` : ""}</span>}
                    {e.tipo_assinatura === "facial_override" && <span className="badge badge-yellow">⚠️ Override{e.confianca != null ? ` ${e.confianca}%` : ""}</span>}
                    {e.tipo_assinatura === "digital"         && <span className="badge badge-blue">👆 Digital</span>}
                    {e.tipo_assinatura === "manual"          && <span className="badge badge-gray">✍️ Manual</span>}
                    {!e.tipo_assinatura                      && <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <div className="action-btns">
                      {e.status === "pendente_assinatura" && (
                        <>
                          <button className="btn btn-success btn-xs" onClick={() => setSignModal(e)}>✍️ Assinar</button>
                          <button className="btn btn-danger btn-xs" onClick={() => setCancelConfirm(e)}>✕ Cancelar</button>
                        </>
                      )}
                      {e.status !== "pendente_assinatura" && (
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Baixar ficha PDF"
                          onClick={() => gerarFicha(e)}
                          style={{ fontSize: 15, padding: "2px 6px" }}
                        >⬇️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>por página:</span>
            {[10, 25, 50].map(n => (
              <button key={n} className={`btn btn-sm ${pageSize === n ? "btn-primary" : "btn-ghost"}`} onClick={() => setPageSize(n)}>{n}</button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
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
      {signModal && (
        <SignModal
          entrega={signModal}
          funcionarios={funcionarios}
          currentUserRole={currentUserRole}
          onClose={() => setSignModal(null)}
          onSign={(tipo, confianca, sigImg) => doSign(signModal.id, tipo, confianca, sigImg)}
        />
      )}
      {cancelConfirm && (
        <ConfirmDialog icon="🚫" title="Cancelar Entrega" danger
          desc={`Cancelar a entrega #${String(cancelConfirm.id).padStart(4,"0")} de ${cancelConfirm.funcionario.split(" ")[0]}? Esta ação não pode ser desfeita.`}
          confirmLabel="Cancelar Entrega"
          onConfirm={() => doCancel(cancelConfirm.id)}
          onCancel={() => setCancelConfirm(null)}
        />
      )}
    </div>
  );
}