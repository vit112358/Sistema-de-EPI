import { useEffect, useRef, useState } from "react";
import { apiFetch, setToken, onUnauthorized } from "./api";
import Landing from "./Landing";
import { css } from "./styles";
import { useToast } from "./hooks/useToast";
import type { Epi, Funcionario, Entrega, Cargo, Usuario } from "./types";

import { LoginPage } from "./components/LoginPage";
import { ToastContainer } from "./components/ToastContainer";
import { Dashboard } from "./components/Dashboard";
import { NovaEntregaPage } from "./components/NovaEntregaPage";
import { CancelarEntregaPage } from "./components/CancelarEntregaPage";
import { EntregasPage } from "./components/EntregasPage";
import { FuncionariosPage } from "./components/FuncionariosPage";
import { CargosPage } from "./components/CargosPage";
import { EpisPage } from "./components/EpisPage";
import { BiometriaPage } from "./components/BiometriaPage";
import { CadastroUsuariosPage } from "./components/CadastroUsuariosPage";
import { RelatorioTrocaPage } from "./components/RelatorioTrocaPage";
import { RelatoriosPage } from "./components/RelatoriosPage";
import { EpisPorFuncionarioPage } from "./components/EpisPorFuncionarioPage";

const NAV = [
  { id: "dashboard",          icon: "⬛", label: "Dashboard",            section: "PRINCIPAL"   },
  { id: "nova-entrega",       icon: "📋", label: "Nova Entrega",          section: "OPERAÇÕES"   },
  { id: "cancelar-entrega",   icon: "🚫", label: "Cancelar Entrega"                              },
  { id: "entregas",           icon: "📦", label: "Histórico de Entregas"                         },
  { id: "funcionarios",       icon: "👷", label: "Funcionários",          section: "CADASTROS"   },
  { id: "cargos",             icon: "🏷️", label: "Cargos"                                        },
  { id: "epis",               icon: "🦺", label: "EPIs"                                          },
  { id: "biometria",          icon: "👆", label: "Biometria"                                     },
  { id: "cadastro-usuarios",  icon: "👤", label: "Usuários"                                      },
  { id: "relatorio-troca",        icon: "🔄", label: "Relatório de Trocas",      section: "RELATÓRIOS"  },
  { id: "relatorios",             icon: "📊", label: "Indicadores Gerais"                            },
  { id: "epis-por-funcionario",   icon: "📄", label: "EPIs por Funcionário"                          },
] as const;

type PageId = typeof NAV[number]['id'];

const TITLES: Record<PageId, [string, string]> = {
  "dashboard":          ["Dashboard",               "Visão geral do sistema"],
  "nova-entrega":       ["Nova Entrega",             "Registrar entrega de EPI"],
  "cancelar-entrega":   ["Cancelar Entrega",         "Estorno e cancelamento de entregas"],
  "entregas":           ["Histórico de Entregas",    "Registros, assinaturas e ações pendentes"],
  "funcionarios":       ["Funcionários",             "Cadastro e edição"],
  "cargos":             ["Cargos",                   "Cadastro e edição de cargos"],
  "epis":               ["EPIs",                     "Catálogo, estoque e edição"],
  "biometria":          ["Biometria",                "Cadastro e gerenciamento"],
  "cadastro-usuarios":  ["Usuários",                 "Gerenciamento de usuários do sistema"],
  "relatorio-troca":        ["Relatório de Trocas",      "Calendário de substituição de EPIs por colaborador"],
  "relatorios":             ["Indicadores Gerais",       "Performance e conformidade"],
  "epis-por-funcionario":   ["EPIs por Funcionário",     "Fichas de entrega consolidadas por colaborador"],
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [showLanding, setShowLanding] = useState(true);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [page, setPage] = useState<PageId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [epis, setEpis] = useState<Epi[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const { toasts, add: toast } = useToast();

  const entregasEnviadasRef    = useRef<Set<number>>(new Set());
  const funcionariosEnviadosRef = useRef<Set<number>>(new Set());
  const episEnviadosRef        = useRef<Set<number>>(new Set());

  // Refs that mirror state so handlers can compute diffs outside setState callbacks
  const entregasRef    = useRef<Entrega[]>([]);
  const funcionariosRef = useRef<Funcionario[]>([]);
  const episRef        = useRef<Epi[]>([]);
  entregasRef.current    = entregas;
  funcionariosRef.current = funcionarios;
  episRef.current        = epis;

  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', !darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    onUnauthorized(() => {
      setToken(null);
      setCurrentUser(null);
      setShowLanding(true);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const [resE, resF, resC, resEp, resU] = await Promise.all([
          apiFetch('/api/entregas'),
          apiFetch('/api/funcionarios'),
          apiFetch('/api/cargos'),
          apiFetch('/api/epis'),
          apiFetch('/api/users'),
        ]);
        if (resE.ok)  { const d: Entrega[]     = await resE.json();  if (d?.length)  setEntregas(d); }
        if (resF.ok)  { const d: Funcionario[]  = await resF.json();  if (d?.length)  setFuncionarios(d); }
        if (resC.ok)  { const d: Cargo[]        = await resC.json();  if (d?.length)  setCargos(d); }
        if (resEp.ok) { const d: Epi[]          = await resEp.json(); if (d?.length)  setEpis(d); }
        if (resU.ok)  { const d: Usuario[]      = await resU.json();  if (d?.length)  setUsers(d); }
      } catch (err) {
        console.error('Erro de conexão com o Backend. Usando dados locais.', err);
      }
    })();
  }, [currentUser]);

  // ── Backend-synced setters ──────────────────────────────────────────────────

  const handleSetEntregas = (acao: React.SetStateAction<Entrega[]>) => {
    const prev = entregasRef.current;
    const next = typeof acao === 'function' ? acao(prev) : acao;

    if (next.length > prev.length) {
      const nova = next[0];
      if (nova?.funcionario && nova.id && !entregasEnviadasRef.current.has(nova.id)) {
        entregasEnviadasRef.current.add(nova.id);
        const tempId = nova.id;
        apiFetch('/api/entregas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funcionario_id: nova.funcionario_id, funcionario: nova.funcionario,
            status: nova.status, tipo_assinatura: nova.tipo_assinatura,
            confianca: nova.confianca, data: nova.data, itens: nova.itens,
          }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.id && data.id !== tempId)
              setEntregas(prev => prev.map(e => e.id === tempId ? { ...e, id: data.id } : e));
            apiFetch('/api/epis').then(r => r.json()).then((updated: Epi[]) => setEpis(updated));
          })
          .catch(err => console.error("Falha ao salvar no banco:", err));
      }
    } else if (next.length === prev.length) {
      for (const nova of next) {
        const velha = prev.find(e => e.id === nova.id);
        if (velha && nova.status !== velha.status) {
          apiFetch(`/api/entregas/${nova.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nova.status, tipo_assinatura: nova.tipo_assinatura, confianca: nova.confianca }),
          })
            .then(() => {
              if (nova.status === 'cancelado')
                apiFetch('/api/epis').then(r => r.json()).then((updated: Epi[]) => setEpis(updated));
            })
            .catch(err => console.error('Erro ao atualizar status no banco', err));
        }
      }
    }

    setEntregas(next);
  };

  const handleSetFuncionarios = (acao: React.SetStateAction<Funcionario[]>) => {
    const prev = funcionariosRef.current;
    const next = typeof acao === 'function' ? acao(prev) : acao;

    if (next.length > prev.length) {
      const novo = next.find(n => !prev.some(a => a.id === n.id));
      if (novo?.id && !funcionariosEnviadosRef.current.has(novo.id)) {
        funcionariosEnviadosRef.current.add(novo.id);
        apiFetch('/api/funcionarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: novo.nome, matricula: novo.matricula, setor: novo.setor, cargo: novo.cargo, email: novo.email, telefone: novo.telefone }),
        })
          .then(r => r.json())
          .then(data => console.log("Funcionário salvo no banco, BD_ID:", data.id))
          .catch(err => console.error("Falha ao salvar funcionário no banco:", err));
      }
    } else if (next.length === prev.length) {
      for (const novo of next) {
        const velho = prev.find(f => f.id === novo.id);
        if (velho && (novo.nome !== velho.nome || novo.setor !== velho.setor || novo.cargo !== velho.cargo || novo.matricula !== velho.matricula || novo.email !== velho.email || novo.telefone !== velho.telefone)) {
          apiFetch(`/api/funcionarios/${novo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novo),
          })
            .then(() => console.log(`Funcionário ID ${novo.id} atualizado no banco.`))
            .catch(err => console.error('Erro ao atualizar funcionário', err));
        }
      }
    } else {
      for (const velho of prev) {
        if (!next.some(f => f.id === velho.id)) {
          apiFetch(`/api/funcionarios/${velho.id}`, { method: 'DELETE' })
            .then(() => console.log(`Funcionário ID ${velho.id} deletado no banco.`))
            .catch(err => console.error('Erro ao deletar funcionário', err));
        }
      }
    }

    setFuncionarios(next);
  };

  const criarFuncionario = async (funcData: Omit<Funcionario, 'id' | 'biometrias'>): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: funcData.nome, matricula: funcData.matricula, setor: funcData.setor, cargo: funcData.cargo, email: funcData.email, telefone: funcData.telefone }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Erro ao criar funcionário' };
      funcionariosEnviadosRef.current.add(data.id);
      setFuncionarios(prev => [...prev, { ...funcData, id: data.id, biometrias: [] }]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const handleSetEpis = (acao: React.SetStateAction<Epi[]>) => {
    const prev = episRef.current;
    const next = typeof acao === 'function' ? acao(prev) : acao;

    if (next.length > prev.length) {
      const novo = next.find(n => !prev.some(a => a.id === n.id));
      if (novo?.id && !episEnviadosRef.current.has(novo.id)) {
        episEnviadosRef.current.add(novo.id);
        apiFetch('/api/epis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: novo.nome, ca: novo.ca, cas_json: novo.cas_json ?? null, categoria: novo.categoria, estoque: novo.estoque, minimo: novo.minimo, validade: novo.validade, img: novo.img, periodicidade: novo.periodicidade, descricao: novo.descricao, norma: novo.norma, fabricante: novo.fabricante }),
        })
          .then(r => r.json())
          .then(data => console.log("EPI salvo no banco com sucesso, BD_ID:", data.id))
          .catch(err => console.error("Falha ao salvar EPI no banco:", err));
      }
    } else if (next.length === prev.length) {
      for (const novo of next) {
        const velho = prev.find(e => e.id === novo.id);
        if (velho && (novo.nome !== velho.nome || novo.ca !== velho.ca || novo.estoque !== velho.estoque || novo.minimo !== velho.minimo || novo.categoria !== velho.categoria || novo.fabricante !== velho.fabricante)) {
          apiFetch(`/api/epis/${novo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novo),
          })
            .then(() => console.log(`EPI ID ${novo.id} atualizado no banco.`))
            .catch(err => console.error('Erro ao atualizar EPI', err));
        }
      }
    } else {
      for (const velho of prev) {
        if (!next.some(e => e.id === velho.id)) {
          apiFetch(`/api/epis/${velho.id}`, { method: 'DELETE' })
            .then(() => console.log(`EPI ID ${velho.id} deletado no banco.`))
            .catch(err => console.error('Erro ao deletar EPI', err));
        }
      }
    }

    setEpis(next);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (showLanding) return <Landing onEnter={() => setShowLanding(false)} />;

  if (!currentUser) return (
    <>
      <style>{css}</style>
      <LoginPage onLogin={setCurrentUser} />
      <ToastContainer toasts={toasts} />
    </>
  );

  const stockAlerts = epis.filter(e => e.estoque <= e.minimo).length;
  const pendentes   = entregas.filter(e => e.status === "pendente_assinatura").length;
  const [title, sub] = TITLES[page];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sidebar-logo">
            <div className="logo-icon" style={{ background: "transparent", padding: 0 }}>
              <img src="/favicon.svg" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
            </div>
            <div>
              <div className="logo-text">SegurID</div>
              <div className="logo-sub">Entrega de EPI por biometria</div>
            </div>
          </div>
          <nav className="nav">
            {NAV
              .filter(item => !(item.id === "cadastro-usuarios" && currentUser.role !== "admin"))
              .map(item => (
                <div key={item.id}>
                  {"section" in item && item.section && <div className="nav-section">{item.section}</div>}
                  <div
                    className={`nav-item${page === item.id ? " active" : ""}`}
                    onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                    {item.id === "epis"           && stockAlerts > 0 && <span className="nav-badge">{stockAlerts}</span>}
                    {item.id === "entregas"        && pendentes > 0   && <span className="nav-badge">{pendentes}</span>}
                    {item.id === "cancelar-entrega" && pendentes > 0   && <span className="nav-badge">{pendentes}</span>}
                  </div>
                </div>
              ))}
          </nav>
          <div className="sidebar-user">
            <div className="user-avatar">{currentUser.nome[0].toUpperCase()}</div>
            <div>
              <div className="user-name">{currentUser.nome}</div>
              <div className="user-role">{currentUser.role} · v2.1</div>
            </div>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <div><div className="topbar-title">{title}</div><div className="topbar-sub">{sub}</div></div>
            <div className="topbar-right">
              <button className="btn btn-ghost btn-sm" onClick={() => setDarkMode(d => !d)} title={darkMode ? "Modo claro" : "Modo escuro"}>
                {darkMode ? "☀️" : "🌙"}
              </button>
              {(stockAlerts > 0 || pendentes > 0) && (
                <div className="alert alert-warning" style={{ padding: "6px 12px", margin: 0, fontSize: 12 }}>
                  ⚠️ {stockAlerts + pendentes} alerta{(stockAlerts + pendentes) !== 1 ? "s" : ""}
                </div>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => { setToken(null); setCurrentUser(null); setShowLanding(true); }}>Sair</button>
            </div>
          </div>
          <div className="content">
            {page === "dashboard"         && <Dashboard          epis={epis} funcionarios={funcionarios} entregas={entregas} onNav={(p) => setPage(p as PageId)} />}
            {page === "nova-entrega"      && <NovaEntregaPage    epis={epis} setEpis={handleSetEpis} funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} entregas={entregas} setEntregas={handleSetEntregas} toast={toast} onNav={(p) => setPage(p as PageId)} currentUserRole={currentUser.role} />}
            {page === "cancelar-entrega"  && <CancelarEntregaPage entregas={entregas} setEntregas={handleSetEntregas} toast={toast} />}
            {page === "entregas"          && <EntregasPage       entregas={entregas} setEntregas={handleSetEntregas} epis={epis} funcionarios={funcionarios} currentUserRole={currentUser.role} toast={toast} />}
            {page === "funcionarios"      && <FuncionariosPage   funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} onAddFuncionario={criarFuncionario} cargos={cargos} toast={toast} />}
            {page === "cargos"            && <CargosPage         cargos={cargos} setCargos={setCargos} toast={toast} />}
            {page === "epis"              && <EpisPage           epis={epis} setEpis={handleSetEpis} toast={toast} />}
            {page === "biometria"         && <BiometriaPage      funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} toast={toast} />}
            {page === "cadastro-usuarios" && <CadastroUsuariosPage users={users} setUsers={setUsers} currentUser={currentUser} toast={toast} />}
            {page === "relatorio-troca"   && <RelatorioTrocaPage epis={epis} funcionarios={funcionarios} entregas={entregas} />}
            {page === "relatorios"        && <RelatoriosPage           epis={epis} entregas={entregas} />}
            {page === "epis-por-funcionario" && <EpisPorFuncionarioPage entregas={entregas} funcionarios={funcionarios} />}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}