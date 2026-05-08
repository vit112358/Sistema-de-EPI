import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import type { Epi, Funcionario, Entrega, EntregaItem, Toast, TipoAssinatura } from "../types";
import { declaracaoCompletaEpi, addDays, fmtDate } from "../helpers";
import {
  compareDescriptors, descriptorToJson, extractDescriptor,
  isCurrentModelDescriptor, jsonToDescriptor
} from "../faceApi";
import { LivenessCapture } from "./BiometriaPage";

interface Props {
  epis: Epi[];
  setEpis: (action: React.SetStateAction<Epi[]>) => void;
  funcionarios: Funcionario[];
  setFuncionarios: (action: React.SetStateAction<Funcionario[]>) => void;
  entregas: Entrega[];
  setEntregas: (action: React.SetStateAction<Entrega[]>) => void;
  toast: (msg: string, type?: Toast['type']) => void;
  onNav: (page: string) => void;
  currentUserRole: string;
}

type EpiCaItem = Epi & { itemKey: string; ca: string; validade: string };

export function NovaEntregaPage({ epis, setEpis: _setEpis, funcionarios, setFuncionarios, entregas, setEntregas, toast, onNav, currentUserRole }: Props) {
  const isAdmin = currentUserRole === "admin";
  const [step, setStep] = useState(0);
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [epiFilter, setEpiFilter] = useState("");
  const [epiPage, setEpiPage] = useState(0);
  const EPI_PAGE_SIZE = 9;
  const [sigType, setSigType] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [sigProgress, setSigProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [savedAsPending, setSavedAsPending] = useState(false);
  const [newId] = useState(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [sigImageUrl, setSigImageUrl] = useState<string|null>(null);

  const [faceStage, setFaceStage] = useState<"idle"|"capture"|"verifying"|"result">("idle");
  const [facePhoto, setFacePhoto] = useState<string|null>(null);
  const [faceScore, setFaceScore] = useState<number|null>(null);
  const [faceOverride, setFaceOverride] = useState(false);

  useEffect(() => {
    if (func) {
      const updated = funcionarios.find(f => f.id === func.id);
      if (updated) setFunc(updated);
    }
  }, [funcionarios]);

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

    const funcAtual = funcionarios.find(f => f.id === func?.id) ?? func;
    const bio = funcAtual?.biometrias?.find(b => b.tipo === "facial");

    try {
      const capturedDesc = await extractDescriptor(base64);
      if (!capturedDesc) {
        setFaceScore(-1);
        setFaceStage("result");
        return;
      }

      let score: number;
      if (bio?.descriptor_json && isCurrentModelDescriptor(bio.descriptor_json)) {
        score = compareDescriptors(jsonToDescriptor(bio.descriptor_json), capturedDesc);
      } else if (bio?.imagem_base64) {
        const refDesc = await extractDescriptor(bio.imagem_base64);
        if (refDesc) {
          score = compareDescriptors(refDesc, capturedDesc);
          if (bio.id) {
            const newDescJson = descriptorToJson(refDesc);
            fetch(`/api/biometrias/${bio.id}/descriptor`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ descriptor_json: newDescJson }),
            }).catch(() => {});
            setFuncionarios((prev) => prev.map(f =>
              f.id === funcAtual!.id
                ? { ...f, biometrias: f.biometrias.map(b => b.id === bio.id ? { ...b, descriptor_json: newDescJson } : b) }
                : f
            ));
          }
        } else {
          setFaceScore(-2);
          setFaceStage("result");
          return;
        }
      } else {
        setFaceScore(-2);
        setFaceStage("result");
        return;
      }

      setFaceScore(score);
    } catch (e) {
      console.error("Erro na verificação facial:", e);
      setFaceScore(-2);
    }

    setFaceStage("result");
  };

  const steps = ["Funcionário","Itens","Confirmar","Assinar","Recibo"];

  const toggleEpi = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
    setQtds(prev => ({ ...prev, [key]: prev[key] || 1 }));
  };

  const startSign = () => {
    if (sigType === "facial" && faceStage !== "result") return;
    if (!sigType || (sigType === "manual" && !hasSig)) return;

    if (sigType === "manual" && canvasRef.current) {
      const c = canvasRef.current;
      const tmp = document.createElement("canvas");
      tmp.width = c.width; tmp.height = c.height;
      const ctx = tmp.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(c, 0, 0);
      setSigImageUrl(tmp.toDataURL("image/png"));
    } else if (sigType === "facial") {
      setSigImageUrl(facePhoto);
    } else {
      setSigImageUrl(null);
    }

    setSigning(true); setSigProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        clearInterval(iv); setSigProgress(100);
        setTimeout(() => {
          const confianca = sigType === "facial" ? faceScore : null;
          const itens: EntregaItem[] = selEpis.map(e => ({ epi_id: e.id!, nome: e.nome, img: e.img ?? "", ca: e.ca, qtd: qtds[e.itemKey] || 1 }));
          setEntregas(prev => [{ id: newId, funcionario_id: func!.id!, funcionario: func!.nome, data: new Date().toISOString().split("T")[0], itens, status: "assinado", tipo_assinatura: sigType as TipoAssinatura | null, confianca }, ...prev]);
          setSigning(false); setDone(true); setStep(4);
          toast("Entrega registrada e assinada!", "success");
        }, 500);
      } else setSigProgress(p);
    }, 150);
  };

  const saveAsPending = () => {
    const itens: EntregaItem[] = selEpis.map(e => ({ epi_id: e.id!, nome: e.nome, img: e.img ?? "", ca: e.ca, qtd: qtds[e.itemKey] || 1 }));
    setEntregas(prev => [{ id: newId, funcionario_id: func!.id!, funcionario: func!.nome, data: new Date().toISOString().split("T")[0], itens, status: "pendente_assinatura", tipo_assinatura: null, confianca: null }, ...prev]);
    setSavedAsPending(true); setDone(true); setStep(4);
    toast("Entrega salva como pendente de assinatura.", "info");
  };

  const getCanvasPos = (e: MouseEvent | TouchEvent, r: DOMRect, c: HTMLCanvasElement): [number, number] => {
    const src = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent);
    return [(src.clientX - r.left) * (c.width / r.width), (src.clientY - r.top) * (c.height / r.height)];
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const cx = c.getContext("2d")!;
    const [x, y] = getCanvasPos(e.nativeEvent, r, c);
    cx.beginPath(); cx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault?.();
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const cx = c.getContext("2d")!;
    const [x, y] = getCanvasPos(e.nativeEvent, r, c);
    cx.lineTo(x, y); cx.strokeStyle = "#1a1a2e"; cx.lineWidth = 3; cx.lineCap = "round"; cx.lineJoin = "round"; cx.stroke(); setHasSig(true);
  };
  const stopDraw = () => { drawing.current = false; };
  const clearSig = () => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setHasSig(false); };

  const parseCas = (epi: Epi): { numero: string; validade: string }[] => {
    try { if (epi.cas_json) return JSON.parse(epi.cas_json); } catch {}
    return epi.ca ? [{ numero: epi.ca, validade: epi.validade || "" }] : [];
  };
  const epiCaItems: EpiCaItem[] = epis.flatMap(epi =>
    parseCas(epi).map((ca, i) => ({ ...epi, itemKey: `${epi.id}:${i}`, ca: ca.numero, validade: ca.validade }))
  );
  const selEpis = epiCaItems.filter(item => selected.includes(item.itemKey));

  const exportarFicha = () => {
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
    const fichaId = entregas[0]?.id ?? newId;
    doc.text(`#${String(fichaId).padStart(4, "0")} · ${new Date().toLocaleDateString("pt-BR")}`, pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const nomeFuncionario = func?.nome ?? "";
    const declaracao = declaracaoCompletaEpi(nomeFuncionario);

    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(declaracao, contentW);
    doc.text(linhas, margin, y);
    y += linhas.length * 4.5 + 10;

    const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFontSize(9);
    doc.text(`Data: ${dataHoje}`, margin, y);
    y += 16;

    const sigLineW = 80;
    const sigLineX = (pageW - sigLineW) / 2;

    if (sigImageUrl && sigType === "manual") {
      const imgH = Math.round(sigLineW * 110 / 480);
      doc.addImage(sigImageUrl, "PNG", sigLineX, y, sigLineW, imgH);
      y += imgH;
      doc.setDrawColor(0, 0, 0);
      doc.line(sigLineX, y, sigLineX + sigLineW, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(nomeFuncionario, pageW / 2, y, { align: "center" });
      y += 4;
      doc.setTextColor(100, 100, 100);
      doc.text("Assinatura do Funcionário", pageW / 2, y, { align: "center" });
      doc.setTextColor(0, 0, 0);
      y += 14;
    } else if (sigImageUrl && sigType === "facial") {
      const photoSize = 16;
      doc.addImage(sigImageUrl, "JPEG", sigLineX, y, photoSize, photoSize);
      const textX = sigLineX + photoSize + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Assinado biometricamente por", textX, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(nomeFuncionario, textX, y + 12);
      doc.setFont("helvetica", "normal");
      y += photoSize + 3;
      doc.setDrawColor(0, 0, 0);
      doc.line(sigLineX, y, sigLineX + sigLineW, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Assinatura do Funcionário", pageW / 2, y, { align: "center" });
      doc.setTextColor(0, 0, 0);
      y += 14;
    } else {
      doc.setDrawColor(0, 0, 0);
      doc.line(sigLineX, y, sigLineX + sigLineW, y);
      y += 5;
      doc.setFontSize(9);
      doc.text(nomeFuncionario, pageW / 2, y, { align: "center" });
      y += 4;
      doc.setTextColor(100, 100, 100);
      doc.text("Assinatura do Funcionário", pageW / 2, y, { align: "center" });
      doc.setTextColor(0, 0, 0);
      y += 14;
    }

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

    selEpis.forEach(epi => {
      if (y > pageH - 20) { doc.addPage(); y = 20; y = drawTableHeader(y); }
      const proxTroca = fmtDate(addDays(new Date().toISOString().split("T")[0], epi.periodicidade));
      const row = [epi.nome, epi.ca, `${qtds[epi.itemKey] || 1} un`, proxTroca];
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y + 3, pageW - margin, y + 3);
      let colX = margin;
      row.forEach((cell, i) => {
        doc.setFontSize(8);
        const wrapped = doc.splitTextToSize(cell, colW[i] - 4);
        doc.text(wrapped, colX + 2, y);
        colX += colW[i];
      });
      y += 7;
    });

    doc.save(`ficha_epi_${nomeFuncionario.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (done) return (
    <div>
      {savedAsPending
        ? <div className="alert alert-warning" style={{ marginBottom: 20 }}>⏳ Entrega registrada — assinatura pendente. Acesse o histórico para assinar.</div>
        : <div className="alert alert-success" style={{ marginBottom: 20 }}>✅ Entrega registrada e assinada com sucesso!</div>}
      <div className="card">
        <div className="card-header" style={{ background: "var(--surface2)" }}>
          <div><div style={{ fontFamily: "Barlow Condensed", fontSize: 20, fontWeight: 800 }}>FICHA DE ENTREGA DE EPI</div><div style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text3)" }}>#{String(entregas[0]?.id ?? newId).padStart(4, "0")} · {new Date().toLocaleDateString("pt-BR")}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!savedAsPending && <button className="btn btn-ghost btn-sm" onClick={exportarFicha}>⬇️ Exportar Ficha</button>}
            {savedAsPending
              ? <span className="badge badge-orange" style={{ fontSize: 13 }}>⏳ PENDENTE</span>
              : <span className="badge badge-green" style={{ fontSize: 13 }}>✓ ASSINADO</span>}
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div><div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 4 }}>FUNCIONÁRIO</div><div style={{ fontWeight: 600 }}>{func?.nome}</div><div style={{ fontSize: 12, color: "var(--text3)" }}>{func?.matricula} · {func?.setor}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 4 }}>ASSINATURA</div><div style={{ fontWeight: 600 }}>{savedAsPending ? "⏳ Pendente" : sigType === "facial" ? "👤 Facial" : sigType === "digital" ? "👆 Digital" : "✍️ Manual"}</div></div>
          </div>
          <table><thead><tr><th>EPI</th><th>CA</th><th>Qtd</th><th>Próxima Troca</th></tr></thead>
            <tbody>{selEpis.map(e => (<tr key={e.itemKey}><td><span style={{ marginRight: 6 }}>{e.img}</span>{e.nome}</td><td><span className="tag">{e.ca}</span></td><td>{qtds[e.itemKey] || 1} un</td><td style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "var(--orange)" }}>{fmtDate(addDays(new Date().toISOString().split("T")[0], e.periodicidade))}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => { setStep(0); setFunc(null); setSelected([]); setSigType(null); setDone(false); setHasSig(false); setSigImageUrl(null); }}>Nova Entrega</button>
        <button className="btn btn-ghost" onClick={() => onNav("entregas")}>Ver Histórico</button>
      </div>
    </div>
  );

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

      {step === 1 && (() => {
        const filtered = epiCaItems.filter(item =>
          !epiFilter || item.ca?.toLowerCase().includes(epiFilter.toLowerCase())
        );
        const totalPages = Math.max(1, Math.ceil(filtered.length / EPI_PAGE_SIZE));
        const pageItems = filtered.slice(epiPage * EPI_PAGE_SIZE, (epiPage + 1) * EPI_PAGE_SIZE);
        return (
          <div>
            <div style={{ marginBottom: 14 }}>
              <input
                className="input"
                style={{ maxWidth: 260 }}
                placeholder="Filtrar por CA..."
                value={epiFilter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEpiFilter(e.target.value); setEpiPage(0); }}
              />
            </div>
            <div className="epi-grid">
              {pageItems.map(item => {
                const sel = selected.includes(item.itemKey);
                const semEstoque = Number(item.estoque) <= 0;
                return (
                  <div key={item.itemKey} className="epi-card" style={{ border: sel ? "1px solid var(--orange)" : undefined, background: sel ? "var(--orange-dim)" : semEstoque ? "rgba(255,255,255,0.02)" : undefined, opacity: semEstoque ? 0.45 : 1, cursor: semEstoque ? "not-allowed" : "pointer", pointerEvents: semEstoque ? "none" : undefined }} onClick={() => !semEstoque && toggleEpi(item.itemKey)}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><div className="epi-icon">{item.img}</div>{sel && <span className="badge badge-orange">✓</span>}</div>
                    <div className="epi-name">{item.nome}</div>
                    <div className="epi-ca">{item.ca}</div>
                    <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 4, fontFamily: "IBM Plex Mono" }}>🔄 Troca: {item.periodicidade}d</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginTop: 2 }}>📦 Estoque: {item.estoque ?? 0}</div>
                    {sel && (() => {
                      const estoque = Number(item.estoque) || 0;
                      const qtd = qtds[item.itemKey] || 1;
                      return (
                        <div style={{ marginTop: 10 }} onClick={(ev: React.MouseEvent) => ev.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setQtds(p => ({ ...p, [item.itemKey]: Math.max(1, qtd - 1) }))}>−</button>
                            <span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{qtd}</span>
                            <button className="btn btn-ghost btn-sm"
                              disabled={qtd >= estoque}
                              style={{ opacity: qtd >= estoque ? 0.4 : 1 }}
                              onClick={() => { if (qtd < estoque) setQtds(p => ({ ...p, [item.itemKey]: qtd + 1 })); }}>+</button>
                          </div>
                          {qtd >= estoque && estoque > 0 && (
                            <div style={{ fontSize: 10, color: "var(--orange)", fontFamily: "IBM Plex Mono", marginTop: 2 }}>máx. estoque ({estoque})</div>
                          )}
                          {estoque <= 0 && (
                            <div style={{ fontSize: 10, color: "var(--red)", fontFamily: "IBM Plex Mono", marginTop: 2 }}>⚠ sem estoque</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {pageItems.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "var(--text3)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>
                  Nenhum EPI encontrado para CA "{epiFilter}"
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm" disabled={epiPage === 0} onClick={() => setEpiPage(p => p - 1)}>← Anterior</button>
                <span style={{ fontSize: 12, fontFamily: "IBM Plex Mono", color: "var(--text3)" }}>Página {epiPage + 1} de {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={epiPage >= totalPages - 1} onClick={() => setEpiPage(p => p + 1)}>Próximo →</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Voltar</button>
              <button className="btn btn-primary" disabled={selected.length === 0} onClick={() => setStep(2)}>Próximo ({selected.length}) →</button>
            </div>
          </div>
        );
      })()}

      {step === 2 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Confirmação</span></div>
          <div className="card-body">
            <table><thead><tr><th>EPI</th><th>CA</th><th>Qtd</th><th>Próx. Troca</th></tr></thead>
              <tbody>{selEpis.map(e => (<tr key={e.itemKey}><td><span style={{ marginRight: 6 }}>{e.img}</span>{e.nome}</td><td><span className="tag">{e.ca}</span></td><td>{qtds[e.itemKey]||1} un</td><td style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "var(--orange)" }}>{fmtDate(addDays(new Date().toISOString().split("T")[0], e.periodicidade))}</td></tr>))}</tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Editar</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Confirmar →</button>
          </div>
        </div>
      )}

      {step === 3 && (() => {
        const funcAtual = funcionarios.find(f => f.id === func?.id) ?? func;
        const bioFacial = funcAtual?.biometrias?.find(b => b.tipo === "facial");
        const getBio = (tipo: string) =>
          funcAtual?.biometrias
            ?.filter(b => b.tipo === tipo)
            .sort((a, b) => (b.data > a.data ? 1 : -1))[0] ?? null;

        const bioOpts = [
          { t: "facial",  icon: "👤", title: "Facial",  bio: getBio("facial")  },
          { t: "digital", icon: "👆", title: "Digital", bio: getBio("digital") },
          { t: "manual",  icon: "✍️", title: "Manual",  bio: null              },
        ].filter(o => o.t === "manual" || o.bio !== null);

        const facePassed = faceScore !== null && faceScore >= 60;
        const faceDetected = faceScore !== null && faceScore >= 0;
        const canSign = signing ? false
          : sigType === "facial" ? (faceStage === "result" && faceDetected && (facePassed || (isAdmin && faceOverride)))
          : sigType === "manual" ? hasSig
          : !!sigType;

        return (
          <div className="card">
            <div className="card-header"><span className="card-title">Assinatura</span></div>
            <div className="card-body">

              <div className="bio-panel" style={{ marginBottom: 20 }}>
                {bioOpts.map(o => (
                  <div key={o.t} className={`bio-option${sigType === o.t ? " active" : ""}`} onClick={() => selectSigType(o.t)}
                    style={{ alignItems: "flex-start", gap: 10 }}>
                    {o.t === "facial" && (o.bio as any)?.imagem_base64
                      ? <img src={(o.bio as any).imagem_base64} alt="bio" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border2)" }} />
                      : <div className="bio-option-icon" style={{ flexShrink: 0 }}>{o.icon}</div>}
                    <div style={{ minWidth: 0 }}>
                      <div className="bio-option-title">{o.title}</div>
                      {o.bio
                        ? <div className="bio-option-desc">
                          Cadastrada em {(o.bio as any).data}
                          {(o.bio as any).qualidade ? ` · ${(o.bio as any).qualidade}% qualidade` : ""}
                        </div>
                        : <div className="bio-option-desc" style={{ color: "var(--text3)" }}>Assinatura manuscrita</div>}
                      </div>
                    </div>
                ))}
              </div>

              {sigType === "facial" && faceStage === "idle" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
                  <div style={{ color: "var(--text2)", marginBottom: 6 }}>Posicione o rosto do funcionário na câmera</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "IBM Plex Mono", marginBottom: 20 }}>
                    {bioFacial?.imagem_base64 ? "Foto de referência disponível — comparação real será realizada" : "Sem foto de referência — comparação simulada"}
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
                  <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: 8 }}>Nenhum rosto detectado na captura</div>
                  <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>Centralize o rosto do funcionário e garanta boa iluminação.</div>
                  <button className="btn btn-primary" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); }}>Tentar novamente</button>
                </div>
              )}

              {sigType === "facial" && faceStage === "result" && faceScore === -2 && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                  <div style={{ fontWeight: 600, color: "var(--orange)", marginBottom: 8 }}>Sem biometria de referência</div>
                  <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16 }}>
                    A biometria cadastrada não possui um descriptor facial válido.<br/>
                    Recadastre a biometria deste funcionário na tela de Biometria para ativar a verificação real.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn btn-ghost" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); }}>Tentar novamente</button>
                    <button className="btn btn-ghost" onClick={() => selectSigType("manual")}>Usar assinatura manual</button>
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
                          Apenas administradores podem aprovar com confiança abaixo do limite. Use assinatura manual ou tente novamente.
                        </div>
                      )}
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); setFaceOverride(false); }}>🔄 Tentar novamente</button>
                </div>
              )}

              {sigType === "digital" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>👆</div>
                  <div style={{ color: "var(--text2)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>Posicione o dedo no leitor biométrico</div>
                </div>
              )}

              {sigType === "manual" && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>Assine no campo abaixo:</div>
                  <canvas ref={canvasRef} width={460} height={120} style={{ background: "#fff", border: "1px solid var(--border2)", borderRadius: 8, cursor: "crosshair", display: "block", width: "100%", touchAction: "none" }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                  <button className="btn btn-ghost btn-xs" style={{ marginTop: 6 }} onClick={clearSig}>Limpar</button>
                </div>
              )}

              {signing && (
                <div className="confidence-meter" style={{ marginTop: 16 }}>
                  <div className="confidence-label"><span>Registrando assinatura...</span><span>{sigProgress.toFixed(0)}%</span></div>
                  <div className="confidence-bar"><div className="confidence-fill" style={{ width: sigProgress + "%", background: "var(--orange)" }} /></div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Voltar</button>
              <button className="btn btn-ghost" disabled={signing} onClick={saveAsPending} title="Salva a entrega sem assinatura para assinar depois">⏳ Salvar como Pendente</button>
              <button className="btn btn-primary" disabled={!canSign} onClick={startSign}>{signing ? "⏳ Registrando..." : "✅ Assinar"}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}