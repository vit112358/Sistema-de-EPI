import { useEffect, useRef, useState } from "react";
import { apiFetch, logout, onUnauthorized } from "./api";
import Landing from "./Landing";
import { css } from "./styles";
import { useToast } from "./hooks/useToast";
import type { Epi, Funcionario, Entrega, Cargo, Usuario } from "./types";
import {
  getEntregas, getFuncionarios, getCargos, getEpis, getUsuarios,
  criarEntregaOffline, atualizarStatusEntregaOffline,
  criarFuncionarioOffline, atualizarFuncionarioOffline, deletarFuncionarioOffline,
  criarEpiOffline, atualizarEpiOffline, deletarEpiOffline,
} from "./offline/dataLayer";
import { isReachable } from "./offline/reachability";
import { cacheSession, readCachedSession, clearCachedSession, type SessionUser } from "./offline/session";

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
import { AuditLogPage } from "./components/AuditLogPage";
import { TrocarSenhaPage } from "./components/TrocarSenhaPage";

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
  { id: "audit-log",              icon: "🔍", label: "Auditoria"                                     },
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
  "audit-log":              ["Auditoria",                "Histórico de ações: assinaturas, cancelamentos e alterações"],
};

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
  const [showLanding, setShowLanding] = useState(true);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [resolvingSession, setResolvingSession] = useState(true);
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
      setCurrentUser(null);
      setShowLanding(true);
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (await isReachable()) {
          const res = await apiFetch('/api/auth/me');
          if (res.ok) {
            const user: SessionUser = await res.json();
            setCurrentUser(user);
            cacheSession(user, user.exp);
            setShowLanding(false);
          } else if (res.status === 401) {
            clearCachedSession();
          }
        } else {
          const cached = readCachedSession();
          if (cached) {
            setCurrentUser(cached.user);
            setShowLanding(false);
          }
        }
      } catch {
        const cached = readCachedSession();
        if (cached) {
          setCurrentUser(cached.user);
          setShowLanding(false);
        }
      } finally {
        setResolvingSession(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      // offline: sem rede/servidor, cada get* cai para o IndexedDB local (Fase 2)
      const [e, f, c, ep, u] = await Promise.all([
        getEntregas(), getFuncionarios(), getCargos(), getEpis(), getUsuarios(),
      ]);
      setEntregas(e); setFuncionarios(f); setCargos(c); setEpis(ep); setUsers(u);
    })();
  }, [currentUser]);

  // ── Backend-synced setters ──────────────────────────────────────────────────

  const handleSetEntregas = (acao: React.SetStateAction<Entrega[]>) => {
    const prev = entregasRef.current;
    const next = typeof acao === 'function' ? acao(prev) : acao;

    if (next.length > prev.length) {
      const nova = next.find(n => !prev.some(a => a.id === n.id));
      if (nova?.funcionario && nova.id && !entregasEnviadasRef.current.has(nova.id)) {
        entregasEnviadasRef.current.add(nova.id);
        criarEntregaOffline(nova).catch(err => console.error("Falha ao salvar entrega:", err));
        setEpis(prev => prev.map(e => {
          const item = nova.itens.find(i => i.epi_id === e.id);
          return item ? { ...e, estoque: Math.max(0, e.estoque - item.qtd) } : e;
        }));
      }
    } else if (next.length === prev.length) {
      for (const nova of next) {
        const velha = prev.find(e => e.id === nova.id);
        if (velha && nova.status !== velha.status) {
          atualizarStatusEntregaOffline(nova).catch(err => console.error('Erro ao atualizar status da entrega', err));
          if (nova.status === 'cancelado') {
            setEpis(prev => prev.map(e => {
              const item = nova.itens.find(i => i.epi_id === e.id);
              return item ? { ...e, estoque: e.estoque + item.qtd } : e;
            }));
          }
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
        criarFuncionarioOffline(novo).catch(err => console.error("Falha ao salvar funcionário:", err));
      }
    } else if (next.length === prev.length) {
      for (const novo of next) {
        const velho = prev.find(f => f.id === novo.id);
        if (velho && (novo.nome !== velho.nome || novo.setor !== velho.setor || novo.cargo !== velho.cargo || novo.matricula !== velho.matricula || novo.email !== velho.email || novo.telefone !== velho.telefone)) {
          atualizarFuncionarioOffline(novo).catch(err => console.error('Erro ao atualizar funcionário', err));
        }
      }
    } else {
      for (const velho of prev) {
        if (!next.some(f => f.id === velho.id) && velho.id != null) {
          deletarFuncionarioOffline(velho.id).catch(err => console.error('Erro ao deletar funcionário', err));
        }
      }
    }

    setFuncionarios(next);
  };

  const criarFuncionario = async (funcData: Omit<Funcionario, 'id' | 'biometrias'>): Promise<{ ok: boolean; error?: string }> => {
    const { ok, id, error } = await criarFuncionarioOffline(funcData);
    if (!ok) return { ok: false, error };
    funcionariosEnviadosRef.current.add(id!);
    setFuncionarios(prev => [...prev, { ...funcData, id, biometrias: [] }]);
    return { ok: true };
  };

  const handleSetEpis = (acao: React.SetStateAction<Epi[]>) => {
    const prev = episRef.current;
    const next = typeof acao === 'function' ? acao(prev) : acao;

    if (next.length > prev.length) {
      const novo = next.find(n => !prev.some(a => a.id === n.id));
      if (novo?.id && !episEnviadosRef.current.has(novo.id)) {
        episEnviadosRef.current.add(novo.id);
        criarEpiOffline(novo).catch(err => console.error("Falha ao salvar EPI:", err));
      }
    } else if (next.length === prev.length) {
      for (const novo of next) {
        const velho = prev.find(e => e.id === novo.id);
        if (velho && (novo.nome !== velho.nome || novo.ca !== velho.ca || novo.estoque !== velho.estoque || novo.minimo !== velho.minimo || novo.categoria !== velho.categoria || novo.fabricante !== velho.fabricante)) {
          atualizarEpiOffline(novo).catch(err => console.error('Erro ao atualizar EPI', err));
        }
      }
    } else {
      for (const velho of prev) {
        if (!next.some(e => e.id === velho.id) && velho.id != null) {
          deletarEpiOffline(velho.id).catch(err => console.error('Erro ao deletar EPI', err));
        }
      }
    }

    setEpis(next);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (resolvingSession) return (
    <>
      <style>{css}</style>
      <div className="login-screen">
        <div className="login-bg" />
        <span className="pulse">●</span>
      </div>
    </>
  );

  if (showLanding) return <Landing onEnter={() => setShowLanding(false)} />;

  if (!currentUser) return (
    <>
      <style>{css}</style>
      <LoginPage onLogin={(user) => {
        setCurrentUser(user);
        cacheSession(user, user.exp);
        if (user.role === 'colaborador') setPage('entregas');
      }} />
      <ToastContainer toasts={toasts} />
    </>
  );

  if (currentUser.trocar_senha === 1) return (
    <>
      <style>{css}</style>
      <TrocarSenhaPage onSuccess={(user) => {
        setCurrentUser(user);
        cacheSession(user, user.exp);
      }} />
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
              <img src="/favicon.svg" style={{ width: "60px", height: "60px", objectFit: "contain" }} />
            </div>
            <div>
              <div className="logo-text">SegurID</div>
              <div className="logo-sub">Entrega de EPI por biometria</div>
            </div>
          </div>
          <nav className="nav">
            {NAV
              .filter(item => {
                if (currentUser.role === 'colaborador') return item.id === 'entregas';
                if (currentUser.role !== 'admin') return item.id !== 'cadastro-usuarios' && item.id !== 'audit-log';
                return true;
              })
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
              <div className="user-role">{currentUser.role} · v0.0.1</div>
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
              <button className="btn btn-danger btn-sm" onClick={() => { logout(); clearCachedSession(); setCurrentUser(null); setShowLanding(true); }}>Sair</button>
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
            {page === "audit-log"            && <AuditLogPage />}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}