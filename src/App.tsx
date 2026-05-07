import {useEffect, useRef, useState} from "react";
import Landing from "./Landing";
import {jsPDF} from "jspdf";
import {
  compareDescriptors,
  computeEAR,
  descriptorToJson,
  detectLandmarks,
  extractDescriptor,
  isCurrentModelDescriptor,
  jsonToDescriptor
} from "./faceApi";

// ─── CONFIGURAÇÕES DA EMPRESA ─────────────────────────────────────────────────
const COMPANY_CONFIG = {
  nome: "Empresa Exemplo Ltda.",
  endereco: "Av. Paulista, 1000 – Bela Vista, São Paulo/SP – CEP 01310-100",
};

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const INIT_USERS = [
  { id: 1, nome: "Administrador", username: "admin", senha: "admin123", role: "admin" },
];

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@300;400;500&family=Barlow:wght@300;400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #080b10; --surface: #0f1520; --surface2: #161e2d;
    --border: #1e2d42; --border2: #243347;
    --orange: #f5a623; --orange-dim: rgba(245,166,35,0.12); --orange-glow: rgba(245,166,35,0.25);
    --red: #ff4757; --green: #2ed573; --blue: #1e90ff; --purple: #a855f7;
    --text: #e8edf5; --text2: #8899aa; --text3: #4a5a6b;
  }
  body { background: var(--bg); font-family: 'Barlow', sans-serif; color: var(--text); }
  .app { display: flex; height: 100vh; overflow: hidden; }
  .sidebar { width: 220px; min-width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
  .sidebar-logo { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .logo-icon { width: 36px; height: 36px; background: var(--orange); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .logo-text { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 17px; letter-spacing: 0.5px; line-height: 1.1; }
  .logo-sub { font-size: 10px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; letter-spacing: 1px; }
  .nav { flex: 1; padding: 12px 0; overflow-y: auto; }
  .nav-section { padding: 6px 16px 4px; font-size: 9px; color: var(--text3); letter-spacing: 2px; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; margin-top: 8px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 16px; cursor: pointer; transition: all 0.15s; color: var(--text2); font-size: 13.5px; font-weight: 500; border-left: 2px solid transparent; margin: 1px 0; }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: var(--orange-dim); color: var(--orange); border-left-color: var(--orange); }
  .nav-icon { font-size: 15px; width: 18px; text-align: center; }
  .nav-badge { margin-left: auto; background: var(--red); color: white; font-size: 10px; border-radius: 10px; padding: 1px 6px; font-weight: 700; }
  .sidebar-user { padding: 14px 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .user-avatar { width: 32px; height: 32px; background: var(--orange); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: #000; flex-shrink: 0; }
  .user-name { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
  .user-role { font-size: 10px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 12px; flex-shrink: 0; }
  .topbar-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
  .topbar-sub { font-size: 12px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; }
  .topbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .content { flex: 1; overflow-y: auto; padding: 24px; }
  .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; font-family: 'Barlow', sans-serif; display: inline-flex; align-items: center; gap: 6px; }
  .btn-primary { background: var(--orange); color: #000; }
  .btn-primary:hover { background: #f0b040; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); }
  .btn-danger { background: rgba(255,71,87,0.15); color: var(--red); border: 1px solid rgba(255,71,87,0.3); }
  .btn-danger:hover { background: rgba(255,71,87,0.25); }
  .btn-success { background: rgba(46,213,115,0.15); color: var(--green); border: 1px solid rgba(46,213,115,0.3); }
  .btn-success:hover { background: rgba(46,213,115,0.25); }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn-xs { padding: 3px 8px; font-size: 11px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .card-title { font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; color: var(--text2); text-transform: uppercase; }
  .card-body { padding: 20px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; position: relative; overflow: hidden; }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; }
  .stat-card.orange::before { background: var(--orange); }
  .stat-card.green::before { background: var(--green); }
  .stat-card.red::before { background: var(--red); }
  .stat-card.blue::before { background: var(--blue); }
  .stat-card.purple::before { background: var(--purple); }
  .stat-icon { font-size: 24px; margin-bottom: 10px; }
  .stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 800; line-height: 1; }
  .stat-card.orange .stat-value { color: var(--orange); }
  .stat-card.green .stat-value { color: var(--green); }
  .stat-card.red .stat-value { color: var(--red); }
  .stat-card.blue .stat-value { color: var(--blue); }
  .stat-card.purple .stat-value { color: var(--purple); }
  .stat-label { font-size: 11px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 16px; text-align: left; font-size: 10px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 12px 16px; font-size: 13.5px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
  .badge-green { background: rgba(46,213,115,0.12); color: var(--green); }
  .badge-red { background: rgba(255,71,87,0.12); color: var(--red); }
  .badge-orange { background: var(--orange-dim); color: var(--orange); }
  .badge-gray { background: rgba(136,153,170,0.12); color: var(--text2); }
  .badge-blue { background: rgba(30,144,255,0.12); color: var(--blue); }
  .badge-purple { background: rgba(168,85,247,0.12); color: var(--purple); }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .epi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .epi-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; transition: all 0.15s; cursor: pointer; }
  .epi-card:hover { border-color: var(--orange); background: var(--surface2); transform: translateY(-1px); }
  .epi-card.low { border-color: rgba(255,71,87,0.4); }
  .epi-icon { font-size: 36px; margin-bottom: 12px; }
  .epi-name { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .epi-ca { font-size: 11px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; }
  .epi-stock { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; }
  .stock-bar-wrap { background: var(--surface2); border-radius: 4px; height: 4px; flex: 1; margin: 0 10px; overflow: hidden; }
  .stock-bar { height: 100%; border-radius: 4px; transition: width 0.5s; }
  .stock-num { font-size: 12px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
  .func-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .func-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; gap: 14px; align-items: flex-start; transition: all 0.15s; }
  .func-card:hover { border-color: var(--border2); }
  .func-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1e3a5f, #0a1929); border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: var(--orange); flex-shrink: 0; }
  .func-name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
  .func-info { font-size: 11px; color: var(--text3); font-family: 'IBM Plex Mono', monospace; }
  .func-tags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
  .modal { background: var(--surface); border: 1px solid var(--border2); border-radius: 14px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; animation: modalIn 0.2s ease; }
  .modal-lg { max-width: 740px; }
  @keyframes modalIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--surface); z-index: 2; }
  .modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; }
  .modal-body { padding: 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .close-btn { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 22px; line-height: 1; border-radius: 4px; padding: 2px 6px; }
  .close-btn:hover { color: var(--text); background: var(--surface2); }
  .bio-panel { display: flex; flex-direction: column; gap: 12px; }
  .bio-option { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.2s; display: flex; gap: 14px; align-items: center; }
  .bio-option:hover, .bio-option.active { border-color: var(--orange); background: var(--orange-dim); }
  .bio-option-icon { font-size: 26px; }
  .bio-option-title { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
  .bio-option-desc { font-size: 12px; color: var(--text3); }
  .face-capture { background: var(--surface2); border: 1px solid var(--border2); border-radius: 10px; aspect-ratio: 4/3; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .face-guide { width: 120px; height: 150px; border: 2px solid var(--orange); border-radius: 60px; position: absolute; top: 50%; left: 50%; animation: facePulse 2s ease-in-out infinite; }
  @keyframes facePulse { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); } }
  .scan-line { position: absolute; width: 100%; height: 2px; background: linear-gradient(90deg, transparent, var(--orange), transparent); animation: scan 2s linear infinite; }
  @keyframes scan { 0% { top: 20%; } 100% { top: 80%; } }
  @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
  .bar-indeterminate { width: 40% !important; animation: indeterminate 1.2s ease-in-out infinite; }
  .steps { display: flex; gap: 0; margin-bottom: 24px; }
  .step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
  .step:not(:last-child)::after { content: ''; position: absolute; top: 15px; left: 50%; width: 100%; height: 1px; background: var(--border); }
  .step:not(:last-child).done::after { background: var(--orange); }
  .step-circle { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--surface); z-index: 1; font-family: 'IBM Plex Mono', monospace; transition: all 0.2s; }
  .step.active .step-circle { border-color: var(--orange); color: var(--orange); }
  .step.done .step-circle { border-color: var(--orange); background: var(--orange); color: #000; }
  .step-label { font-size: 10px; color: var(--text3); margin-top: 6px; text-align: center; font-family: 'IBM Plex Mono', monospace; }
  .step.active .step-label { color: var(--orange); }
  .input-group { margin-bottom: 14px; }
  .input-label { font-size: 11px; color: var(--text2); font-family: 'IBM Plex Mono', monospace; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; display: block; }
  .input { width: 100%; background: var(--surface2); border: 1px solid var(--border2); border-radius: 6px; padding: 10px 12px; color: var(--text); font-size: 13.5px; font-family: 'Barlow', sans-serif; outline: none; transition: all 0.15s; }
  .input:focus { border-color: var(--orange); }
  textarea.input { resize: vertical; min-height: 70px; }
  select.input { appearance: none; cursor: pointer; }
  .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; display: flex; gap: 10px; align-items: flex-start; }
  .alert-warning { background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.3); color: var(--orange); }
  .alert-error { background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); color: var(--red); }
  .alert-success { background: rgba(46,213,115,0.1); border: 1px solid rgba(46,213,115,0.3); color: var(--green); }
  .alert-info { background: rgba(30,144,255,0.1); border: 1px solid rgba(30,144,255,0.3); color: var(--blue); }
  .toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 9999; }
  .toast { background: var(--surface2); border: 1px solid var(--border2); border-radius: 8px; padding: 12px 16px; min-width: 280px; display: flex; gap: 10px; align-items: center; animation: toastIn 0.25s ease; font-size: 13px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
  @keyframes toastIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
  .toast.success { border-left: 3px solid var(--green); }
  .toast.error { border-left: 3px solid var(--red); }
  .toast.info { border-left: 3px solid var(--orange); }
  .confidence-meter { }
  .confidence-label { display: flex; justify-content: space-between; font-size: 11px; font-family: 'IBM Plex Mono', monospace; margin-bottom: 6px; }
  .confidence-bar { background: var(--surface2); border-radius: 4px; height: 8px; overflow: hidden; }
  .confidence-fill { height: 100%; border-radius: 4px; transition: width 1s ease; }
  .login-screen { min-height: 100vh; background: var(--bg); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .login-bg { position: absolute; inset: 0; opacity: 0.03; background-image: repeating-linear-gradient(0deg, var(--orange) 0px, var(--orange) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, var(--orange) 0px, var(--orange) 1px, transparent 1px, transparent 40px); }
  .login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px; width: 100%; max-width: 380px; position: relative; z-index: 1; }
  .login-logo { text-align: center; margin-bottom: 32px; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
  .empty-state { text-align: center; padding: 40px; color: var(--text3); }
  .empty-icon { font-size: 40px; margin-bottom: 10px; }
  .pulse { animation: pulse 2s ease infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .sig-canvas { background: #fff; border-radius: 8px; cursor: crosshair; display: block; touch-action: none; }
  .tag { display: inline-block; padding: 2px 8px; background: var(--surface2); border: 1px solid var(--border2); border-radius: 4px; font-size: 11px; color: var(--text2); }
  .section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .urgency-critical { color: var(--red); font-weight: 700; }
  .urgency-warning { color: var(--orange); font-weight: 600; }
  .urgency-ok { color: var(--green); }
  .action-btns { display: flex; gap: 6px; }
  .bio-registered-item { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
  .confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000; }
  .confirm-box { background: var(--surface); border: 1px solid var(--border2); border-radius: 12px; padding: 28px; max-width: 360px; width: 100%; text-align: center; animation: modalIn 0.2s ease; }
  .confirm-icon { font-size: 40px; margin-bottom: 12px; }
  .confirm-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 8px; }
  .confirm-desc { font-size: 13px; color: var(--text3); margin-bottom: 20px; line-height: 1.5; }
  .confirm-btns { display: flex; gap: 10px; justify-content: center; }
  .tab-bar { display: flex; gap: 4px; margin-bottom: 20px; background: var(--surface); padding: 4px; border-radius: 8px; border: 1px solid var(--border); width: fit-content; }
  .tab { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text3); transition: all 0.15s; }
  .tab.active { background: var(--orange); color: #000; }
  .tab:hover:not(.active) { color: var(--text); background: var(--surface2); }
  .menu-btn { display: none; background: none; border: none; color: var(--text); font-size: 22px; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1; flex-shrink: 0; }
  .menu-btn:hover { background: var(--surface2); }
  .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 499; }
  @media (max-width: 768px) {
    .menu-btn { display: flex; align-items: center; justify-content: center; }
    .sidebar { position: fixed; left: -240px; top: 0; height: 100vh; z-index: 500; transition: left 0.25s ease; box-shadow: none; }
    .sidebar.open { left: 0; box-shadow: 4px 0 24px rgba(0,0,0,0.5); }
    .sidebar-overlay.open { display: block; }
    .main { width: 100%; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .two-col { grid-template-columns: 1fr; }
    .epi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .func-grid { grid-template-columns: 1fr; }
    .input-row { grid-template-columns: 1fr; }
    .topbar { padding: 0 14px; gap: 8px; height: 52px; }
    .topbar-sub { display: none; }
    .topbar-title { font-size: 17px; }
    .content { padding: 14px; }
    .modal-overlay { padding: 12px; }
    .modal { max-width: 100%; }
    .toast-container { bottom: 12px; right: 12px; left: 12px; }
    .toast { min-width: unset; }
    .tab-bar { width: 100%; }
    .tab { flex: 1; text-align: center; padding: 7px 10px; font-size: 12px; }
    .card-header { padding: 12px 16px; }
    .card-body { padding: 14px; }
    th { padding: 8px 12px; }
    td { padding: 10px 12px; }
    .action-btns { flex-direction: column; gap: 4px; }
    .stat-value { font-size: 28px; }
    .confirm-box { margin: 12px; }
  }
  @media (max-width: 480px) {
    .epi-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .content { padding: 10px; }
    .topbar { padding: 0 10px; }
    .login-card { padding: 28px 20px; }
    .steps { gap: 0; }
    .step-label { font-size: 9px; }
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}
function daysUntil(date) {
  const now = new Date();
  now.setHours(0,0,0,0);
  const diff = Math.round((date - now) / 86400000);
  return diff;
}
function fmtDate(d) {
  return d.toLocaleDateString("pt-BR");
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  return { toasts, add };
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ icon, title, desc, onConfirm, onCancel, confirmLabel = "Confirmar", danger = false }) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-box">
        <div className="confirm-icon">{icon}</div>
        <div className="confirm-title">{title}</div>
        <div className="confirm-desc">{desc}</div>
        <div className="confirm-btns">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, users }) {
  const [username, setUsername] = useState("admin");
  const [pass, setPass] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = () => {
    const found = users.find(u => u.username === username && u.senha === pass);
    if (found) { setLoading(true); setTimeout(() => onLogin(found), 900); }
    else setErr("Credenciais inválidas");
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
        <div className="input-group"><label className="input-label">Usuário</label><input className="input" value={username} onChange={e => { setUsername(e.target.value); setErr(""); }} /></div>
        <div className="input-group"><label className="input-label">Senha</label><input className="input" type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={submit} disabled={loading}>
          {loading ? <><span className="pulse">●</span> Autenticando...</> : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ epis, funcionarios, entregas, onNav }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);
  const alertas = epis.filter(e => e.estoque <= e.minimo);
  const pendentes = entregas.filter(e => e.status === "pendente_assinatura");

  return (
    <div>
      <div className="stats-grid">
        {[
          { icon: "📦", value: epis.length, label: "EPIs Cadastrados", color: "orange" },
          { icon: "👷", value: funcionarios.length, label: "Funcionários", color: "blue" },
          { icon: "📋", value: entregas.filter(e => e.status === "assinado").length, label: "Entregas Assinadas", color: "green" },
          { icon: "⚠️", value: alertas.length + pendentes.length, label: "Alertas Pendentes", color: "red" },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`} style={{ opacity: animated ? 1 : 0, transform: animated ? "none" : "translateY(12px)", transition: `all 0.4s ${i * 0.08}s` }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Últimas Entregas</span><button className="btn btn-ghost btn-sm" onClick={() => onNav("entregas")}>Ver todas</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Funcionário</th><th>Status</th><th>Assinatura</th></tr></thead>
              <tbody>
                {entregas.slice(0, 4).map(e => (
                  <tr key={e.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{e.funcionario.split(" ").slice(0, 2).join(" ")}</div><div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{e.data}</div></td>
                    <td>
                      {e.status === "assinado" && <span className="badge badge-green">✓ Assinado</span>}
                      {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                      {e.status === "cancelado" && <span className="badge badge-gray">✕ Cancelado</span>}
                    </td>
                    <td>
                      {e.tipo_assinatura === "facial" && <span className="badge badge-blue">👤 Facial</span>}
                      {e.tipo_assinatura === "digital" && <span className="badge badge-blue">👆 Digital</span>}
                      {e.tipo_assinatura === "manual" && <span className="badge badge-gray">✍️ Manual</span>}
                      {!e.tipo_assinatura && <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">🔴 Alertas</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.map(e => (<div key={e.id} className="alert alert-error"><div style={{ fontSize: 18 }}>{e.img}</div><div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{e.nome}</div><div style={{ fontSize: 11, opacity: 0.8 }}>Estoque: {e.estoque} · Mínimo: {e.minimo}</div></div></div>))}
            {pendentes.map(e => (<div key={e.id} className="alert alert-warning"><div style={{ fontSize: 18 }}>📋</div><div><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Entrega #{String(e.id).padStart(4,"0")} pendente</div><div style={{ fontSize: 11, opacity: 0.8 }}>{e.funcionario.split(" ")[0]} · Aguardando assinatura</div></div></div>))}
            {alertas.length === 0 && pendentes.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div>Tudo em ordem</div>}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><span className="card-title">Ações Rápidas</span></div>
        <div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => onNav("nova-entrega")}>📋 Nova Entrega</button>
          <button className="btn btn-ghost" onClick={() => onNav("cancelar-entrega")}>🚫 Cancelar Entrega</button>
          <button className="btn btn-ghost" onClick={() => onNav("funcionarios")}>👷 Funcionários</button>
          <button className="btn btn-ghost" onClick={() => onNav("biometria")}>👆 Biometria</button>
          <button className="btn btn-ghost" onClick={() => onNav("relatorio-troca")}>🔄 Relatório de Trocas</button>
        </div>
      </div>
    </div>
  );
}

// ─── EPI MODAL ────────────────────────────────────────────────────────────────
function EpiModal({ epi, onClose, onSave, onDelete }) {
  const [f, setF] = useState({ ...epi });
  const initCas = () => {
    try { if (epi.cas_json) return JSON.parse(epi.cas_json); } catch {}
    return epi.ca ? [{ numero: epi.ca, validade: epi.validade || "" }] : [{ numero: "", validade: "" }];
  };
  const [cas, setCas] = useState<{numero: string, validade: string}[]>(initCas);
  const emojis = ["🪖","🧤","🥾","🥽","🔇","🦺","😷","🧣","🧰","🔦"];
  const categorias = ["Proteção da Cabeça","Proteção das Mãos","Proteção dos Pés","Proteção Visual","Proteção Auditiva","Sinalização","Proteção Respiratória","Proteção do Corpo"];
  const handleSave = () => {
    const casValidos = cas.filter(c => c.numero.trim());
    onSave({ ...f, cas_json: JSON.stringify(casValidos), ca: casValidos[0]?.numero || "", validade: casValidos[0]?.validade || "" });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{epi.id ? `Editar — ${epi.nome}` : "Novo EPI"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {emojis.map(e => (<button key={e} onClick={() => setF(p => ({ ...p, img: e }))} style={{ fontSize: 22, background: f.img === e ? "var(--orange-dim)" : "var(--surface2)", border: `1px solid ${f.img === e ? "var(--orange)" : "var(--border)"}`, borderRadius: 6, padding: 6, cursor: "pointer" }}>{e}</button>))}
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Nome do EPI</label><input className="input" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Categoria</label><select className="input" value={f.categoria} onChange={e => setF(p => ({ ...p, categoria: e.target.value }))}>{categorias.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="input-group">
            <label className="input-label">Números CA — máx. 5 <span style={{ fontWeight: 400, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>({cas.length}/5)</span></label>
            {cas.map((ca, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  {i === 0 && <label className="input-label" style={{ marginBottom: 4 }}>Número CA</label>}
                  <input className="input" placeholder="Número CA" value={ca.numero}
                    onChange={ev => setCas(p => p.map((c, j) => j === i ? { ...c, numero: ev.target.value } : c))} />
                </div>
                <div style={{ width: 160 }}>
                  {i === 0 && <label className="input-label" style={{ marginBottom: 4 }}>Vencimento do CA</label>}
                  <input className="input" type="date" value={ca.validade}
                    onChange={ev => setCas(p => p.map((c, j) => j === i ? { ...c, validade: ev.target.value } : c))} />
                </div>
                {cas.length > 1 && (
                  <button onClick={() => setCas(p => p.filter((_, j) => j !== i))}
                    style={{ background: "transparent", border: "1px solid var(--border2)", borderRadius: 6, color: "var(--red)", cursor: "pointer", padding: "4px 10px", fontSize: 16, marginBottom: 1 }}>×</button>
                )}
              </div>
            ))}
            {cas.length < 5 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCas(p => [...p, { numero: "", validade: "" }])}>+ Adicionar CA</button>
            )}
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Fabricante</label><input className="input" value={f.fabricante} onChange={e => setF(p => ({ ...p, fabricante: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Norma Técnica</label><input className="input" value={f.norma} onChange={e => setF(p => ({ ...p, norma: e.target.value }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Estoque Atual</label><input className="input" type="number" value={f.estoque} onChange={e => setF(p => ({ ...p, estoque: +e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Estoque Mínimo</label><input className="input" type="number" value={f.minimo} onChange={e => setF(p => ({ ...p, minimo: +e.target.value }))} /></div>
          </div>
          <div className="input-group">
            <label className="input-label">⏱ Periodicidade de Troca (dias)</label>
            <input className="input" type="number" value={f.periodicidade} onChange={e => setF(p => ({ ...p, periodicidade: +e.target.value }))} placeholder="Ex: 90 = troca a cada 3 meses" />
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, fontFamily: "IBM Plex Mono" }}>
              {f.periodicidade ? `Troca a cada ${f.periodicidade} dias (~${Math.round(f.periodicidade/30)} meses)` : "Defina a frequência de substituição obrigatória"}
            </div>
          </div>
          <div className="input-group"><label className="input-label">Descrição / Especificação</label><textarea className="input" value={f.descricao} onChange={e => setF(p => ({ ...p, descricao: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          {epi.id && onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>🗑 Excluir EPI</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── EPIS PAGE ────────────────────────────────────────────────────────────────
function EpisPage({ epis, setEpis, toast }) {
  const [addModal, setAddModal] = useState(false);
  const [editEpi, setEditEpi] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const saveEpi = (f) => {
    if (f.id) {
      setEpis(prev => prev.map(e => e.id === f.id ? f : e));
      toast("EPI atualizado com sucesso!", "success");
    } else {
      const novoEpi = { ...f, id: Date.now() };
      setEpis(prev => [...prev, novoEpi]);
      toast("EPI cadastrado com sucesso!", "success");
    }
    setEditEpi(null);
    setAddModal(false);
  };

  const deleteEpi = (e) => {
    setEpis(prev => prev.filter(x => x.id !== e.id));
    toast("EPI excluído!", "success");
    setConfirmDel(null);
    setEditEpi(null);
    setAddModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
          {epis.filter(e => e.estoque <= e.minimo).length} alertas · clique em um EPI para editar
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Novo EPI</button>
      </div>
      <div className="epi-grid">
        {epis.map(e => {
          const pct = Math.min(100, (e.estoque / (e.minimo * 3)) * 100);
          const low = e.estoque <= e.minimo;
          const color = low ? "var(--red)" : pct > 60 ? "var(--green)" : "var(--orange)";
          return (
            <div key={e.id} className={`epi-card${low ? " low" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="epi-icon">{e.img}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  {low && <span className="badge badge-red">⚠ Baixo</span>}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditEpi(e)}>✏️ Editar</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirmDel(e)}>🗑</button>
                  </div>
                </div>
              </div>
              <div className="epi-name">{e.nome}</div>
              <div className="epi-ca">{(() => { try { if (e.cas_json) return JSON.parse(e.cas_json).map((c:any) => c.numero).filter(Boolean).join(" · "); } catch {} return e.ca || ""; })()} · {e.categoria}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, fontFamily: "IBM Plex Mono" }}>
                🔄 Troca: a cada {e.periodicidade}d · {e.fabricante}
              </div>
              <div className="epi-stock">
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Estoque</span>
                <div className="stock-bar-wrap"><div className="stock-bar" style={{ width: pct + "%", background: color }} /></div>
                <span className="stock-num" style={{ color }}>{e.estoque}</span>
              </div>
            </div>
          );
        })}
      </div>
      {(editEpi || addModal) && (
        <EpiModal
          epi={editEpi || { nome: "", ca: "", cas_json: null, categoria: "Proteção da Cabeça", estoque: 0, minimo: 0, validade: "", img: "🪖", periodicidade: 90, descricao: "", norma: "", fabricante: "" }}
          onClose={() => { setEditEpi(null); setAddModal(false); }}
          onSave={saveEpi}
          onDelete={editEpi ? () => setConfirmDel(editEpi) : null}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          icon="⚠️"
          title="Excluir EPI?"
          desc={`Esta ação é irreversível. O EPI "${confirmDel.nome}" será permanentemente removido do sistema.`}
          danger
          confirmLabel="Excluir Permanentemente"
          onConfirm={() => deleteEpi(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

// ─── FUNCIONARIOS PAGE ────────────────────────────────────────────────────────
function CargosPage({ cargos, setCargos, toast }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [confirmDel, setConfirmDel] = useState<any>(null);

  const openAdd = () => { setEditing(null); setNome(""); setModal(true); };
  const openEdit = (c) => { setEditing(c); setNome(c.nome); setModal(true); };

  const save = () => {
    if (!nome.trim()) return;
    if (editing) {
      fetch(`/api/cargos/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .catch(() => {});
      setCargos(prev => prev.map(c => c.id === editing.id ? { ...c, nome: nome.trim() } : c));
      toast("Cargo atualizado!", "success");
    } else {
      const tempId = Date.now();
      fetch('/api/cargos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim() }) })
        .then(r => r.json()).then(data => setCargos(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id } : c)))
        .catch(() => {});
      setCargos(prev => [...prev, { id: tempId, nome: nome.trim() }]);
      toast("Cargo cadastrado!", "success");
    }
    setModal(false);
  };

  const del = (c) => {
    fetch(`/api/cargos/${c.id}`, { method: 'DELETE' }).catch(() => {});
    setCargos(prev => prev.filter(x => x.id !== c.id));
    setConfirmDel(null);
    toast("Cargo removido!", "success");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ Novo Cargo</button>
      </div>
      <div className="card">
        <div className="card-body">
          {cargos.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏷️</div>Nenhum cargo cadastrado</div>
          ) : (
            <table>
              <thead><tr><th>#</th><th>Nome do Cargo</th><th style={{ width: 100 }}>Ações</th></tr></thead>
              <tbody>
                {cargos.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-ghost btn-xs" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(c)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? "Editar Cargo" : "Novo Cargo"}</span>
              <button className="close-btn" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Nome do Cargo</label>
                <input className="input" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!nome.trim()} onClick={save}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}
      {confirmDel && <ConfirmDialog icon="🗑" title="Remover cargo?" desc={`Remover "${confirmDel.nome}"? Funcionários com esse cargo não serão afetados.`} danger confirmLabel="Remover" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />}
    </div>
  );
}

function FuncionariosPage({ funcionarios, setFuncionarios, onAddFuncionario, cargos, toast }) {
  const [addModal, setAddModal] = useState(false);
  const [editFunc, setEditFunc] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const saveFunc = async (f) => {
    if (f.id) {
      setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...x, ...f } : x));
      toast("Dados atualizados!", "success");
      setEditFunc(null); setAddModal(false);
    } else {
      const result = await onAddFuncionario(f);
      if (result.ok) {
        toast("Funcionário cadastrado!", "success");
        setEditFunc(null); setAddModal(false);
      } else {
        toast(result.error || "Erro ao criar funcionário", "error");
      }
    }
  };

  const deleteFunc = (f) => {
    setFuncionarios(prev => prev.filter(x => x.id !== f.id));
    toast("Funcionário excluído!", "success");
    setConfirmDel(null);
    setEditFunc(null);
    setAddModal(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>
          {funcionarios.filter(f => f.biometrias.length > 0).length}/{funcionarios.length} com biometria
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Novo Funcionário</button>
      </div>
      <div className="func-grid">
        {funcionarios.map(f => (
          <div key={f.id} className="func-card">
            <div className="func-avatar">{f.nome[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="func-name">{f.nome}</div>
              <div className="func-info">{f.matricula} · {f.setor}</div>
              <div className="func-info">{f.cargo}</div>
              <div className="func-tags">
                {f.biometrias.length > 0
                  ? <span className="badge badge-green">👆 {f.biometrias.length} biometria{f.biometrias.length > 1 ? "s" : ""}</span>
                  : <span className="badge badge-orange">⚠ Sem biometria</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
              <button className="btn btn-ghost btn-xs" onClick={() => setEditFunc(f)}>✏️ Editar</button>
              <button className="btn btn-danger btn-xs" onClick={() => setConfirmDel(f)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      {(editFunc || addModal) && (
        <FuncModal
          func={editFunc || { nome: "", matricula: "", setor: "Produção", cargo: "", email: "", telefone: "", admissao: "" }}
          cargos={cargos}
          onClose={() => { setEditFunc(null); setAddModal(false); }}
          onSave={saveFunc}
          onDelete={editFunc ? () => setConfirmDel(editFunc) : null}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          icon="⚠️"
          title="Excluir Funcionário?"
          desc={`Esta ação é irreversível. "${confirmDel.nome}" e todos os seus dados serão permanentemente removidos do sistema.`}
          danger
          confirmLabel="Excluir Permanentemente"
          onConfirm={() => deleteFunc(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}

function FuncModal({ func, cargos, onClose, onSave, onDelete }) {
  const [f, setF] = useState({ ...func });
  const setores = ["Produção","Manutenção","Logística","Qualidade","Segurança","Administrativo","TI","RH"];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{func.id ? `Editar — ${func.nome.split(" ")[0]}` : "Novo Funcionário"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="input-row">
            <div className="input-group" style={{ gridColumn: "1 / -1" }}><label className="input-label">Nome Completo</label><input className="input" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Matrícula</label><input className="input" value={f.matricula} onChange={e => setF(p => ({ ...p, matricula: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Data de Admissão</label><input className="input" type="date" value={f.admissao} onChange={e => setF(p => ({ ...p, admissao: e.target.value }))} /></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">Setor</label><select className="input" value={f.setor} onChange={e => setF(p => ({ ...p, setor: e.target.value }))}>{setores.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="input-group"><label className="input-label">Cargo</label><select className="input" value={f.cargo} onChange={e => setF(p => ({ ...p, cargo: e.target.value }))}><option value="">Selecione...</option>{cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
          </div>
          <div className="input-row">
            <div className="input-group"><label className="input-label">E-mail</label><input className="input" type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="input-group"><label className="input-label">Telefone</label><input className="input" value={f.telefone} onChange={e => setF(p => ({ ...p, telefone: e.target.value }))} /></div>
          </div>
        </div>
        <div className="modal-footer">
          {func.id && onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>🗑 Excluir Funcionário</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(f)}>💾 Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── CAMERA CAPTURE ───────────────────────────────────────────────────────────
function CameraCapture({ onCapture, onCancel }: { onCapture: (base64: string) => void, onCancel: () => void }) {
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
      .catch(err => setErrMsg(err.message ?? "Câmera não disponível"));
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

// ─── LIVENESS CAPTURE ─────────────────────────────────────────────────────────
const LIVENESS_TIMEOUT = 15;
const PEAK_WINDOW      = 15;   // frames para rastrear pico de EAR (olhos bem abertos)
const CLOSED_RATIO     = 0.82; // fechado = EAR cai para 82% do pico (basta fechar levemente)
const OPEN_RATIO       = 0.84; // aberto  = EAR volta a 84% do pico → piscar confirmado

function LivenessCapture({ onCapture, onCancel }: { onCapture: (b: string) => void; onCancel: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const earHistory  = useRef<number[]>([]);  // últimos N frames para calcular pico
  const eyesClosed  = useRef(false);

  type Stage = "loading" | "challenge" | "blink" | "success" | "timeout" | "error";
  const [stage, setStage]        = useState<Stage>("loading");
  const [timeLeft, setTimeLeft]  = useState(LIVENESS_TIMEOUT);
  const [faceFound, setFaceFound] = useState(false);
  const [dropPct, setDropPct]    = useState<number | null>(null); // % de queda atual

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

        // janela deslizante para rastrear o pico (olhos abertos)
        earHistory.current.push(ear);
        if (earHistory.current.length > PEAK_WINDOW) earHistory.current.shift();

        // precisa de pelo menos 3 frames para ter um pico confiável
        if (earHistory.current.length < 3) return;

        // pico = máximo dos frames recentes (representa olhos bem abertos)
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
      {/* HUD */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "rgba(0,0,0,0.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{info.icon}</span>
          <span style={{ fontSize: 12, color: info.color, fontFamily: "IBM Plex Mono" }}>{info.text}</span>
        </div>
        {(stage === "challenge" || stage === "blink") && (
          <span style={{ fontFamily: "IBM Plex Mono", fontSize: 13, color: timeLeft <= 3 ? "var(--red)" : "var(--text2)", fontWeight: 700 }}>{timeLeft}s</span>
        )}
      </div>
      {/* barra de queda de EAR */}
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

// ─── BIOMETRIA PAGE ───────────────────────────────────────────────────────────
function BiometriaPage({ funcionarios, setFuncionarios, toast }) {
  const [tab, setTab] = useState("registrar");
  const [func, setFunc] = useState(funcionarios[0]);
  const [type, setType] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);

  useEffect(() => {
    const found = funcionarios.find(f => f.id === func?.id);
    if (found) setFunc(found);
  }, [funcionarios]);

  const saveBiometria = async (imagemBase64: string | null = null) => {
    setCameraActive(false);
    setScanning(true); setProgress(0);

    // extrai descriptor facial antes de iniciar a animação
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
          const novaBio = { funcionario_id: func.id, tipo: type, data: new Date().toISOString().split("T")[0], qualidade, imagem_base64: imagemBase64, descriptor_json };
          try {
            const res = await fetch('/api/biometrias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaBio) });
            const data = await res.json();
            setFuncionarios(prev => prev.map(f => f.id === func.id ? { ...f, biometrias: [...f.biometrias, { ...novaBio, id: data.id }] } : f));
          } catch {
            setFuncionarios(prev => prev.map(f => f.id === func.id ? { ...f, biometrias: [...f.biometrias, novaBio] } : f));
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
    setFuncionarios(prev => prev.map(f => f.id === funcId ? { ...f, biometrias: f.biometrias.filter((b: any) => b.id !== bioId) } : f));
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
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm({ bioId: b.id, funcId: f.id, funcNome: f.nome, tipo: b.tipo })}>🗑 Excluir</button>
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
          <div className="alert alert-success" style={{ marginBottom: 20 }}>✅ Biometria registrada para <strong>{func.nome}</strong></div>
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
              <select className="input" value={func?.id} onChange={e => { setFunc(funcionarios.find(f => f.id === +e.target.value)); setType(null); setDone(false); setLgpdConsent(false); }}>
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
                <input type="checkbox" style={{ marginTop: 2, flexShrink: 0 }} checked={lgpdConsent} onChange={e => setLgpdConsent(e.target.checked)} />
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

// ─── ENTREGAS PAGE ────────────────────────────────────────────────────────────
function SignModal({ entrega, onClose, onSign }) {
  const [sigType, setSigType] = useState(null);
  const [signing, setSigning] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);

  const startSign = () => {
    if (!sigType) return;
    if (sigType === "manual" && !hasSig) return;
    setSigning(true); setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) { clearInterval(iv); setTimeout(() => onSign(sigType), 400); }
      else setProgress(p);
    }, 150);
  };
  const getCanvasPos = (e, r, c) => {
    const src = e.touches ? e.touches[0] : e;
    return [(src.clientX - r.left) * (c.width / r.width), (src.clientY - r.top) * (c.height / r.height)];
  };
  const startDraw = (e) => {
    drawing.current = true;
    const c = canvasRef.current, r = c.getBoundingClientRect(), cx = c.getContext("2d");
    const [x, y] = getCanvasPos(e, r, c);
    cx.beginPath(); cx.moveTo(x, y);
  };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault?.();
    const c = canvasRef.current, r = c.getBoundingClientRect(), cx = c.getContext("2d");
    const [x, y] = getCanvasPos(e, r, c);
    cx.lineTo(x, y); cx.strokeStyle = "#1a1a2e"; cx.lineWidth = 3; cx.lineCap = "round"; cx.lineJoin = "round"; cx.stroke(); setHasSig(true);
  };
  const stopDraw = () => { drawing.current = false; };
  const clearSig = () => { const c = canvasRef.current; c?.getContext("2d").clearRect(0, 0, c.width, c.height); setHasSig(false); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><span className="modal-title">Assinar Entrega #{String(entrega.id).padStart(4,"0")}</span><button className="close-btn" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
            Funcionário: <strong>{entrega.funcionario}</strong> · {entrega.itens.length} item(ns)
          </div>
          <div className="bio-panel">
            {[{ t: "facial", icon: "👤", title: "Facial", desc: "Reconhecimento facial" }, { t: "digital", icon: "👆", title: "Digital", desc: "Impressão digital" }, { t: "manual", icon: "✍️", title: "Manual", desc: "Assinatura na tela" }].map(o => (
              <div key={o.t} className={`bio-option${sigType === o.t ? " active" : ""}`} onClick={() => setSigType(o.t)}>
                <div className="bio-option-icon">{o.icon}</div>
                <div><div className="bio-option-title">{o.title}</div><div className="bio-option-desc">{o.desc}</div></div>
              </div>
            ))}
          </div>
          {sigType === "facial" && (
            <div className="face-capture" style={{ height: 160, marginTop: 16, borderRadius: 10 }}>
              <div className="face-guide" />{signing && <div className="scan-line" />}
              {!signing && <div style={{ textAlign: "center", zIndex: 2 }}><div style={{ fontSize: 28 }}>📷</div><div style={{ fontSize: 11, color: "var(--text3)" }}>Câmera simulada</div></div>}
            </div>
          )}
          {sigType === "manual" && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>Assine abaixo:</div>
              <canvas ref={canvasRef} className="sig-canvas" width={480} height={110} style={{ width: "100%", display: "block", touchAction: "none" }} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
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
          <button className="btn btn-primary" disabled={!sigType || signing || (sigType === "manual" && !hasSig)} onClick={startSign}>
            {signing ? "⏳ Verificando..." : "✅ Assinar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntregasPage({ entregas, setEntregas, epis, toast }) {
  const [filter, setFilter] = useState("todos");
  const [busca, setBusca] = useState("");
  const [ordemNome, setOrdemNome] = useState<"asc" | "desc" | null>(null);
  const [signModal, setSignModal] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(null);

  const gerarFicha = (entrega: any) => {
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
    const declaracao =
      `Eu, ${nomeFuncionario}, declaro para todos os efeitos previstos na legislação, haver recebido gratuitamente, conforme descrito na C.L.T. nos artigos 166, 167 e demais artigos adstritos à matéria, na NR - 6 e nos itens 1.4.2 e 1.5.5.1.2 da NR - 1 DISPOSIÇÕES GERAIS e GERENCIAMENTO DE RISCOS OCUPACIONAIS, após treinamento e orientação do uso adequado, aplicação, guarda, conservação, substituição e requisitos de higiene, em palestra realizada pelo Serviço Especializado em Segurança e Medicina do Trabalho da empresa, ${COMPANY_CONFIG.nome}, situada ${COMPANY_CONFIG.endereco}, o(s) equipamento(s) de proteção individual abaixo descrito(s) e designado(s) como EPIs, os quais obrigo-me a usá-lo(s) sistematicamente em meu trabalho, mediante ainda, os termos seguintes:\n\n` +
      `a) O EPI será usado unicamente para finalidade a que se destina e qualquer alteração que o torne parcial ou totalmente danificado será por mim comunicado à empresa;\n\n` +
      `b) Declaro que me responsabilizo pela guarda e conservação dos EPI's que me foram confiados e que, na impossibilidade de seu uso, deverei comunicar a chefia imediatamente, para as providências que se fizerem necessárias, e os devolverei após o vencimento de duração estipulada;\n\n` +
      `c) Estou ciente e de pleno acordo que a falta de uso por mim, dos EPI's fornecidos pela Empresa, constitui Ato Faltoso, sujeito às sanções disciplinares previstas na legislação pertinente aos assuntos, Regulamento Interno e Normas de Segurança da Empresa;\n\n` +
      `d) Reconhecendo expressamente que a sua não utilização configura em falta grave capitulada na letra "h", do Artigo 482 da C.L.T., como ato de indisciplina ou de insubordinação, ensejadora da rescisão do meu contrato de trabalho por justa causa;\n\n` +
      `e) Autorizo expressamente a Empresa a proceder descontos nos meus salários, vencimentos, gratificações, indenizações, os valores dos EPI's que por ventura por mim forem:\n` +
      `   - Danificados propositadamente;\n` +
      `   - Extraviados;\n` +
      `   - Não devolvidos à empresa para substituição;\n\n` +
      `f) Tomei ciência e estou de acordo com os termos da declaração acima, assinando-a de livre e espontânea vontade, após sua leitura nessa data`;

    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(declaracao, contentW);
    doc.text(linhas, margin, y);
    y += linhas.length * 4.5 + 10;

    doc.setFontSize(9);
    doc.text(`Data: ${fmtDataStr(entrega.data)}`, margin, y);
    y += 16;

    const sigLineW = 80;
    const sigLineX = (pageW - sigLineW) / 2;
    doc.setDrawColor(0, 0, 0);
    doc.line(sigLineX, y, sigLineX + sigLineW, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(nomeFuncionario, pageW / 2, y, { align: "center" });
    y += 4;
    doc.setTextColor(100, 100, 100);
    const sigLabel = entrega.tipo_assinatura === "facial" ? "Assinado biometricamente (Facial)"
      : entrega.tipo_assinatura === "digital" ? "Assinado biometricamente (Digital)"
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

    (entrega.itens ?? []).forEach((item: any) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; y = drawTableHeader(y); }
      const epiData = epis?.find((e: any) => e.id === item.epi_id);
      const periodicidade = epiData?.periodicidade ?? null;
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

  const doSign = (id, tipo) => {
    const confianca = tipo === "facial" ? +(88 + Math.random() * 10).toFixed(1) : tipo === "digital" ? +(92 + Math.random() * 7).toFixed(1) : null;
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, status: "assinado", tipo_assinatura: tipo, confianca } : e));
    setSignModal(null);
    toast("Entrega assinada com sucesso!", "success");
  };

  const doCancel = (id) => {
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
          onChange={e => setBusca(e.target.value)}
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
              {filtered.map(e => (
                <tr key={e.id}>
                  <td><span style={{ fontFamily: "IBM Plex Mono", color: "var(--text3)", fontSize: 12 }}>#{String(e.id).padStart(4,"0")}</span></td>
                  <td><span style={{ fontWeight: 600 }}>{e.funcionario.split(" ").slice(0,2).join(" ")}</span></td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{e.data}</span></td>
                  <td><span className="badge badge-gray">{e.itens.length} item{e.itens.length !== 1 ? "s" : ""}</span></td>
                  <td>
                    {e.status === "assinado" && <span className="badge badge-green">✓ Assinado</span>}
                    {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                    {e.status === "cancelado" && <span className="badge badge-gray">✕ Cancelado</span>}
                  </td>
                  <td>
                    {e.tipo_assinatura === "facial" && <span className="badge badge-blue">👤 {e.confianca}%</span>}
                    {e.tipo_assinatura === "digital" && <span className="badge badge-blue">👆 {e.confianca}%</span>}
                    {e.tipo_assinatura === "manual" && <span className="badge badge-gray">✍️ Manual</span>}
                    {!e.tipo_assinatura && <span style={{ color: "var(--text3)", fontSize: 12 }}>—</span>}
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
      {signModal && <SignModal entrega={signModal} onClose={() => setSignModal(null)} onSign={(tipo) => doSign(signModal.id, tipo)} />}
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

// ─── CANCELAR ENTREGA (OPERAÇÕES) ─────────────────────────────────────────────
function CancelarEntregaPage({ entregas, setEntregas, toast }) {
  const pendentes = entregas.filter(e => e.status === "pendente_assinatura");
  const assinadas = entregas.filter(e => e.status === "assinado");
  const [confirm, setConfirm] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [tab, setTab] = useState("pendentes");

  const doCancel = (id) => {
    setEntregas(prev => prev.map(e => e.id === id ? { ...e, status: "cancelado", motivo_cancelamento: motivo || "Cancelado pelo operador" } : e));
    setConfirm(null); setMotivo("");
    toast("Entrega cancelada com sucesso.", "info");
  };

  const lista = tab === "pendentes" ? pendentes : assinadas;

  return (
    <div>
      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        ⚠️ O cancelamento é irreversível. Use com cautela para entregas com erro de lançamento ou devoluções de EPI.
      </div>
      <div className="tab-bar">
        <div className={`tab${tab === "pendentes" ? " active" : ""}`} onClick={() => setTab("pendentes")}>Pendentes ({pendentes.length})</div>
        <div className={`tab${tab === "assinadas" ? " active" : ""}`} onClick={() => setTab("assinadas")}>Assinadas ({assinadas.length})</div>
      </div>
      {lista.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">{tab === "pendentes" ? "✅" : "📋"}</div>Nenhuma entrega {tab === "pendentes" ? "pendente" : "assinada"}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(e => (
            <div key={e.id} className="card">
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ fontFamily: "IBM Plex Mono", color: "var(--text3)", fontSize: 11, marginRight: 8 }}>#{String(e.id).padStart(4,"0")}</span>
                    {e.funcionario}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{e.data}</span>
                    <span className="badge badge-gray">{e.itens.length} item{e.itens.length !== 1 ? "s" : ""}</span>
                    {e.status === "assinado" && <span className="badge badge-green">✓ Assinado</span>}
                    {e.status === "pendente_assinatura" && <span className="badge badge-orange">⏳ Pendente</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {e.itens.map((item, i) => <span key={i} style={{ fontSize: 13 }} title={item.nome}>{item.img}</span>)}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirm(e)}>🚫 Cancelar Entrega</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">🚫 Cancelar Entrega #{String(confirm.id).padStart(4,"0")}</span><button className="close-btn" onClick={() => setConfirm(null)}>×</button></div>
            <div className="modal-body">
              <div className="alert alert-error" style={{ marginBottom: 16 }}>Esta ação é irreversível e ficará registrada no histórico.</div>
              <div className="input-group">
                <label className="input-label">Motivo do cancelamento (opcional)</label>
                <textarea className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Erro de lançamento, devolução de EPI, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Voltar</button>
              <button className="btn btn-danger" onClick={() => doCancel(confirm.id)}>🚫 Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FACE COMPARISON (SSIM via canvas, no external deps) ─────────────────────
// Comparação real via face-api.js — veja src/faceApi.ts

// ─── NOVA ENTREGA ─────────────────────────────────────────────────────────────
function NovaEntregaPage({ epis, setEpis, funcionarios, setFuncionarios, entregas, setEntregas, toast, onNav }) {
  const [step, setStep] = useState(0);
  const [func, setFunc] = useState(null);
  const [selected, setSelected] = useState([]);
  const [qtds, setQtds] = useState({});
  const [epiFilter, setEpiFilter] = useState("");
  const [epiPage, setEpiPage] = useState(0);
  const EPI_PAGE_SIZE = 9;
  const [sigType, setSigType] = useState(null);
  const [signing, setSigning] = useState(false);
  const [sigProgress, setSigProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [savedAsPending, setSavedAsPending] = useState(false);
  const [newId] = useState(Date.now());
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [sigImageUrl, setSigImageUrl] = useState<string|null>(null);

  // ── facial verification states ──
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

    const funcAtual: any = funcionarios.find((f: any) => f.id === func?.id) ?? func;
    const bio: any = funcAtual?.biometrias?.find((b: any) => b.tipo === "facial");

    // -1 = nenhum rosto detectado na captura
    // -2 = sem referência cadastrada (recadastrar)
    // >= 0 = score real de comparação

    try {
      const capturedDesc = await extractDescriptor(base64);
      if (!capturedDesc) {
        setFaceScore(-1);
        setFaceStage("result");
        return;
      }

      let score: number;
      if (bio?.descriptor_json && isCurrentModelDescriptor(bio.descriptor_json)) {
        // descriptor salvo com o modelo atual — usa direto (rápido)
        score = compareDescriptors(jsonToDescriptor(bio.descriptor_json), capturedDesc);
      } else if (bio?.imagem_base64) {
        // descriptor ausente ou de modelo antigo — re-extrai da foto de cadastro
        const refDesc = await extractDescriptor(bio.imagem_base64);
        if (refDesc) {
          score = compareDescriptors(refDesc, capturedDesc);
          // salva novo descriptor para as próximas verificações
          if (bio.id) {
            const newDescJson = descriptorToJson(refDesc);
            fetch(`/api/biometrias/${bio.id}/descriptor`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ descriptor_json: newDescJson }),
            }).catch(() => {});
            setFuncionarios((prev: any[]) => prev.map(f =>
              f.id === funcAtual.id
                ? { ...f, biometrias: f.biometrias.map((b: any) => b.id === bio.id ? { ...b, descriptor_json: newDescJson } : b) }
                : f
            ));
          }
        } else {
          setFaceScore(-2);
          setFaceStage("result");
          return;
        }
      } else {
        // nenhuma referência disponível
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

    // Capture signature image before any state changes unmount the canvas
    if (sigType === "manual" && canvasRef.current) {
      const c = canvasRef.current as HTMLCanvasElement;
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
          const confianca = sigType === "facial" ? faceScore : sigType === "digital" ? +(92 + Math.random() * 7).toFixed(1) : null;
          const itens = selEpis.map(e => ({ epi_id: e.id, nome: e.nome, img: e.img, ca: e.ca, qtd: qtds[e.itemKey] || 1 }));
          setEntregas(prev => [{ id: newId, funcionario_id: func.id, funcionario: func.nome, data: new Date().toISOString().split("T")[0], itens, status: "assinado", tipo_assinatura: sigType, confianca }, ...prev]);
          setSigning(false); setDone(true); setStep(4);
          toast("Entrega registrada e assinada!", "success");
        }, 500);
      } else setSigProgress(p);
    }, 150);
  };

  const saveAsPending = () => {
    const itens = selEpis.map(e => ({ epi_id: e.id, nome: e.nome, img: e.img, ca: e.ca, qtd: qtds[e.itemKey] || 1 }));
    setEntregas(prev => [{ id: newId, funcionario_id: func.id, funcionario: func.nome, data: new Date().toISOString().split("T")[0], itens, status: "pendente_assinatura", tipo_assinatura: null, confianca: null }, ...prev]);
    setSavedAsPending(true); setDone(true); setStep(4);
    toast("Entrega salva como pendente de assinatura.", "info");
  };

  const getCanvasPos = (e, r, c) => {
    const src = e.touches ? e.touches[0] : e;
    return [(src.clientX - r.left) * (c.width / r.width), (src.clientY - r.top) * (c.height / r.height)];
  };
  const startDraw = (e) => {
    drawing.current = true;
    const c = canvasRef.current, r = c.getBoundingClientRect(), cx = c.getContext("2d");
    const [x, y] = getCanvasPos(e, r, c);
    cx.beginPath(); cx.moveTo(x, y);
  };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault?.();
    const c = canvasRef.current, r = c.getBoundingClientRect(), cx = c.getContext("2d");
    const [x, y] = getCanvasPos(e, r, c);
    cx.lineTo(x, y); cx.strokeStyle = "#1a1a2e"; cx.lineWidth = 3; cx.lineCap = "round"; cx.lineJoin = "round"; cx.stroke(); setHasSig(true);
  };
  const stopDraw = () => { drawing.current = false; };
  const clearSig = () => { const c = canvasRef.current; c?.getContext("2d").clearRect(0, 0, c.width, c.height); setHasSig(false); };

  const parseCas = (epi: any) => {
    try { if (epi.cas_json) return JSON.parse(epi.cas_json); } catch {}
    return epi.ca ? [{ numero: epi.ca, validade: epi.validade || "" }] : [];
  };
  const epiCaItems = epis.flatMap(epi =>
    parseCas(epi).map((ca: any, i: number) => ({ ...epi, itemKey: `${epi.id}:${i}`, ca: ca.numero, validade: ca.validade }))
  );
  const selEpis = epiCaItems.filter(item => selected.includes(item.itemKey));

  const exportarFicha = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("FICHA DE ENTREGA DE EPI", pageW / 2, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`#${String(newId).slice(-6)} · ${new Date().toLocaleDateString("pt-BR")}`, pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Texto da declaração
    const nomeFuncionario = func?.nome ?? "";
    const declaracao =
      `Eu, ${nomeFuncionario}, declaro para todos os efeitos previstos na legislação, haver recebido gratuitamente, conforme descrito na C.L.T. nos artigos 166, 167 e demais artigos adstritos à matéria, na NR - 6 e nos itens 1.4.2 e 1.5.5.1.2 da NR - 1 DISPOSIÇÕES GERAIS e GERENCIAMENTO DE RISCOS OCUPACIONAIS, após treinamento e orientação do uso adequado, aplicação, guarda, conservação, substituição e requisitos de higiene, em palestra realizada pelo Serviço Especializado em Segurança e Medicina do Trabalho da empresa, ${COMPANY_CONFIG.nome}, situada ${COMPANY_CONFIG.endereco}, o(s) equipamento(s) de proteção individual abaixo descrito(s) e designado(s) como EPIs, os quais obrigo-me a usá-lo(s) sistematicamente em meu trabalho, mediante ainda, os termos seguintes:\n\n` +
      `a) O EPI será usado unicamente para finalidade a que se destina e qualquer alteração que o torne parcial ou totalmente danificado será por mim comunicado à empresa;\n\n` +
      `b) Declaro que me responsabilizo pela guarda e conservação dos EPI's que me foram confiados e que, na impossibilidade de seu uso, deverei comunicar a chefia imediatamente, para as providências que se fizerem necessárias, e os devolverei após o vencimento de duração estipulada;\n\n` +
      `c) Estou ciente e de pleno acordo que a falta de uso por mim, dos EPI's fornecidos pela Empresa, constitui Ato Faltoso, sujeito às sanções disciplinares previstas na legislação pertinente aos assuntos, Regulamento Interno e Normas de Segurança da Empresa;\n\n` +
      `d) Reconhecendo expressamente que a sua não utilização configura em falta grave capitulada na letra "h", do Artigo 482 da C.L.T., como ato de indisciplina ou de insubordinação, ensejadora da rescisão do meu contrato de trabalho por justa causa;\n\n` +
      `e) Autorizo expressamente a Empresa a proceder descontos nos meus salários, vencimentos, gratificações, indenizações, os valores dos EPI's que por ventura por mim forem:\n` +
      `   - Danificados propositadamente;\n` +
      `   - Extraviados;\n` +
      `   - Não devolvidos à empresa para substituição;\n\n` +
      `f) Tomei ciência e estou de acordo com os termos da declaração acima, assinando-a de livre e espontânea vontade, após sua leitura nessa data`;

    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(declaracao, contentW);
    doc.text(linhas, margin, y);
    y += linhas.length * 4.5 + 10;

    // Data
    const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFontSize(9);
    doc.text(`Data: ${dataHoje}`, margin, y);
    y += 16;

    // Campo de assinatura
    const sigLineW = 80;
    const sigLineX = (pageW - sigLineW) / 2;

    if (sigImageUrl && sigType === "manual") {
      // Desenho acima da linha de assinatura
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
      // Foto à esquerda + texto de identificação
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
      // Digital ou sem imagem — linha padrão
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

    // Se não há espaço suficiente para a tabela, começa nova página
    if (y > pageH - 60) {
      doc.addPage();
      y = 20;
    }

    y = drawTableHeader(y);

    // Linhas da tabela
    selEpis.forEach((epi) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 20;
        y = drawTableHeader(y);
      }
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
          <div><div style={{ fontFamily: "Barlow Condensed", fontSize: 20, fontWeight: 800 }}>FICHA DE ENTREGA DE EPI</div><div style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text3)" }}>#{String(newId).slice(-6)} · {new Date().toLocaleDateString("pt-BR")}</div></div>
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
                onChange={e => { setEpiFilter(e.target.value); setEpiPage(0); }}
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
                        <div style={{ marginTop: 10 }} onClick={ev => ev.stopPropagation()}>
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
        const funcAtual: any = funcionarios.find((f: any) => f.id === func?.id) ?? func;
        const bioFacial: any = funcAtual?.biometrias?.find((b: any) => b.tipo === "facial");
        const getBio = (tipo: string) =>
          funcAtual?.biometrias
            ?.filter((b: any) => b.tipo === tipo)
            .sort((a: any, b: any) => (b.data > a.data ? 1 : -1))[0] ?? null;

        const bioOpts = [
          { t: "facial",  icon: "👤", title: "Facial",  bio: getBio("facial")  },
          { t: "digital", icon: "👆", title: "Digital", bio: getBio("digital") },
          { t: "manual",  icon: "✍️", title: "Manual",  bio: null              },
        ].filter(o => o.t === "manual" || o.bio !== null);

        const facePassed = faceScore !== null && faceScore >= 60;
        const faceDetected = faceScore !== null && faceScore >= 0;
        const canSign = signing ? false
          : sigType === "facial" ? (faceStage === "result" && faceDetected && (facePassed || faceOverride))
          : sigType === "manual" ? hasSig
          : !!sigType;

        return (
          <div className="card">
            <div className="card-header"><span className="card-title">Assinatura</span></div>
            <div className="card-body">

              {/* método */}
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

              {/* FACIAL */}
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
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={faceOverride} onChange={e => setFaceOverride(e.target.checked)} />
                        Confirmo visualmente que é o mesmo funcionário (override supervisor)
                      </label>
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setFaceStage("idle"); setFacePhoto(null); setFaceScore(null); setFaceOverride(false); }}>🔄 Tentar novamente</button>
                </div>
              )}

              {/* DIGITAL */}
              {sigType === "digital" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>👆</div>
                  <div style={{ color: "var(--text2)", fontFamily: "IBM Plex Mono", fontSize: 13 }}>Posicione o dedo no leitor biométrico</div>
                </div>
              )}

              {/* MANUAL */}
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

// ─── RELATÓRIO DE TROCAS ──────────────────────────────────────────────────────
function RelatorioTrocaPage({ epis, funcionarios, entregas }) {
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos");
  const [filtroFunc, setFiltroFunc] = useState("todos");

  // Build replacement schedule from signed deliveries
  const trocas = [];
  entregas.filter(e => e.status === "assinado").forEach(entrega => {
    const func = funcionarios.find(f => f.id === entrega.funcionario_id);
    if (!func) return;
    entrega.itens.forEach(item => {
      const epi = epis.find(e => e.id === item.epi_id);
      if (!epi || !epi.periodicidade) return;
      const dataTroca = addDays(entrega.data, epi.periodicidade);
      const dias = daysUntil(dataTroca);
      trocas.push({
        func, epi, entrega,
        dataEntrega: entrega.data,
        dataTroca,
        diasRestantes: dias,
        urgencia: dias < 0 ? "atrasado" : dias <= 30 ? "critico" : dias <= 90 ? "proximo" : "ok",
      });
    });
  });

  // Sort by days remaining
  trocas.sort((a, b) => a.diasRestantes - b.diasRestantes);

  const filtrados = trocas.filter(t => {
    if (filtroUrgencia !== "todos" && t.urgencia !== filtroUrgencia) return false;
    if (filtroFunc !== "todos" && t.func.id !== +filtroFunc) return false;
    return true;
  });

  const counts = { atrasado: trocas.filter(t => t.urgencia === "atrasado").length, critico: trocas.filter(t => t.urgencia === "critico").length, proximo: trocas.filter(t => t.urgencia === "proximo").length, ok: trocas.filter(t => t.urgencia === "ok").length };

  const urgLabel = { atrasado: "🔴 Atrasado", critico: "🟠 Crítico (≤30d)", proximo: "🟡 Próximo (≤90d)", ok: "🟢 Em dia" };
  const urgClass = { atrasado: "badge-red", critico: "badge-orange", proximo: "badge-orange", ok: "badge-green" };

  const exportarExcel = () => {
    const statusLabel = { atrasado: "Atrasado", critico: "Crítico (≤30d)", proximo: "Próximo (≤90d)", ok: "Em dia" };
    const linhas = [
      ["Funcionário", "Matrícula", "Setor", "EPI", "CA", "Periodicidade (dias)", "Última Entrega", "Próxima Troca", "Dias Restantes", "Status"],
      ...trocas.map(t => [
        t.func.nome,
        t.func.matricula,
        t.func.setor,
        t.epi.nome,
        t.epi.ca,
        t.epi.periodicidade,
        t.dataEntrega,
        t.dataTroca,
        t.diasRestantes,
        statusLabel[t.urgencia],
      ])
    ];
    const csv = "﻿" + linhas.map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-trocas-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        {[
          { label: "Atrasados", value: counts.atrasado, color: "red", icon: "🔴" },
          { label: "Críticos (≤30d)", value: counts.critico, color: "orange", icon: "🟠" },
          { label: "Próximos (≤90d)", value: counts.proximo, color: "orange", icon: "🟡" },
          { label: "Em dia", value: counts.ok, color: "green", icon: "🟢" },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`} style={{ cursor: "pointer", outline: filtroUrgencia === (i === 0 ? "atrasado" : i === 1 ? "critico" : i === 2 ? "proximo" : "ok") ? "2px solid var(--orange)" : "none" }}
            onClick={() => setFiltroUrgencia(filtroUrgencia === (i === 0 ? "atrasado" : i === 1 ? "critico" : i === 2 ? "proximo" : "ok") ? "todos" : (i === 0 ? "atrasado" : i === 1 ? "critico" : i === 2 ? "proximo" : "ok"))}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">🔄 Calendário de Trocas de EPI</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportarExcel}>⬇️ Exportar Excel</button>
            <select className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} value={filtroFunc} onChange={e => setFiltroFunc(e.target.value)}>
              <option value="todos">Todos funcionários</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome.split(" ")[0]} {f.nome.split(" ")[1]}</option>)}
            </select>
            <select className="input" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} value={filtroUrgencia} onChange={e => setFiltroUrgencia(e.target.value)}>
              <option value="todos">Todos status</option>
              <option value="atrasado">🔴 Atrasados</option>
              <option value="critico">🟠 Críticos</option>
              <option value="proximo">🟡 Próximos</option>
              <option value="ok">🟢 Em dia</option>
            </select>
          </div>
        </div>
        <div className="table-wrap">
          {filtrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div>Nenhum registro encontrado</div>
          ) : (
            <table>
              <thead>
                <tr><th>Funcionário</th><th>EPI</th><th>Periodicidade</th><th>Última Entrega</th><th>Próxima Troca</th><th>Dias Restantes</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtrados.map((t, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.func.nome.split(" ").slice(0,2).join(" ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{t.func.matricula} · {t.func.setor}</div>
                    </td>
                    <td>
                      <span style={{ marginRight: 6 }}>{t.epi.img}</span>
                      <span style={{ fontWeight: 500 }}>{t.epi.nome}</span>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "IBM Plex Mono" }}>{t.epi.ca}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>
                        {t.epi.periodicidade}d
                      </span>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>
                        (~{Math.round(t.epi.periodicidade / 30)} meses)
                      </div>
                    </td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text3)" }}>{t.dataEntrega}</span></td>
                    <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 600 }}>{fmtDate(t.dataTroca)}</span></td>
                    <td>
                      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 13, fontWeight: 700 }}
                        className={t.diasRestantes < 0 ? "urgency-critical" : t.diasRestantes <= 30 ? "urgency-warning" : "urgency-ok"}>
                        {t.diasRestantes < 0 ? `${Math.abs(t.diasRestantes)}d atrasado` : `${t.diasRestantes}d`}
                      </span>
                    </td>
                    <td><span className={`badge ${urgClass[t.urgencia]}`}>{urgLabel[t.urgencia]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RELATORIOS ───────────────────────────────────────────────────────────────
function RelatoriosPage({ epis, entregas }) {
  const total = entregas.length;
  const assinados = entregas.filter(e => e.status === "assinado").length;
  const facial = entregas.filter(e => e.tipo_assinatura === "facial").length;
  const digital = entregas.filter(e => e.tipo_assinatura === "digital").length;
  const manual = entregas.filter(e => e.tipo_assinatura === "manual").length;
  const pct = (v) => total ? ((v / total) * 100).toFixed(0) : 0;

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[
          { label: "Taxa de Conformidade", value: pct(assinados) + "%", color: "green", icon: "✅" },
          { label: "Confiança Média Biométrica", value: "95.4%", color: "orange", icon: "📊" },
          { label: "Total de Entregas", value: total, color: "blue", icon: "📋" },
        ].map((s, i) => (<div key={i} className={`stat-card ${s.color}`}><div className="stat-icon">{s.icon}</div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>))}
      </div>
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Tipos de Assinatura</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[{ label: "Facial", icon: "👤", value: facial, color: "var(--blue)" }, { label: "Digital", icon: "👆", value: digital, color: "var(--orange)" }, { label: "Manual", icon: "✍️", value: manual, color: "var(--text2)" }].map(item => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>{item.icon} {item.label}</span><span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{item.value} ({pct(item.value)}%)</span></div>
                <div className="confidence-bar"><div className="confidence-fill" style={{ width: pct(item.value) + "%", background: item.color }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Estoque de EPIs</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>EPI</th><th>Estoque</th><th>Status</th></tr></thead>
              <tbody>{epis.map(e => (<tr key={e.id}><td><span style={{ marginRight: 6 }}>{e.img}</span>{e.nome.split(" ").slice(0,2).join(" ")}</td><td><span style={{ fontFamily: "IBM Plex Mono", fontWeight: 700 }}>{e.estoque}</span><span style={{ color: "var(--text3)", fontSize: 11 }}>/{e.minimo}</span></td><td>{e.estoque <= e.minimo ? <span className="badge badge-red">⚠ Crítico</span> : <span className="badge badge-green">✓ OK</span>}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CADASTRO USUÁRIOS PAGE ───────────────────────────────────────────────────
function CadastroUsuariosPage({ users, setUsers, currentUser, toast }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", username: "", senha: "", role: "operador" });
  const [confirm, setConfirm] = useState<any>(null);

  const openNew = () => { setForm({ nome: "", username: "", senha: "", role: "operador" }); setEditing(null); setModal(true); };
  const openEdit = (u: any) => { setForm({ ...u, senha: "" }); setEditing(u); setModal(true); };

  const save = async () => {
    if (!form.nome.trim() || !form.username.trim() || (!editing && !form.senha.trim())) {
      toast("Preencha todos os campos obrigatórios", "error"); return;
    }
    const dup = users.find((u: any) => u.username === form.username && u.id !== editing?.id);
    if (dup) { toast("Username já existe", "error"); return; }
    try {
      if (editing) {
        const payload: any = { nome: form.nome, username: form.username, role: form.role };
        if (form.senha) payload.senha = form.senha;
        await fetch(`/api/users/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        setUsers((prev: any[]) => prev.map((u: any) => u.id === editing.id ? { ...u, ...payload } : u));
        toast("Usuário atualizado!", "success");
      } else {
        const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const data = await res.json();
        setUsers((prev: any[]) => [...prev, { ...form, id: data.id }]);
        toast("Usuário criado!", "success");
      }
    } catch { toast("Erro ao salvar usuário", "error"); }
    setModal(false);
  };

  const del = async (u: any) => {
    if (u.id === currentUser.id) { toast("Não é possível excluir o usuário atual", "error"); return; }
    const admins = users.filter((x: any) => x.role === "admin");
    if (u.role === "admin" && admins.length === 1) { toast("Deve existir ao menos um administrador", "error"); return; }
    try {
      await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    } catch { toast("Erro ao remover usuário", "error"); return; }
    setUsers((prev: any[]) => prev.filter((x: any) => x.id !== u.id));
    toast("Usuário removido", "success");
    setConfirm(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openNew}>+ Novo Usuário</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Username</th><th>Perfil</th><th></th></tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.nome}</div>
                    {u.id === currentUser.id && <span className="badge badge-orange" style={{ marginTop: 4 }}>Você</span>}
                  </td>
                  <td><span style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{u.username}</span></td>
                  <td>{u.role === "admin" ? <span className="badge badge-purple">Admin</span> : <span className="badge badge-gray">Operador</span>}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(u)}>✏️ Editar</button>
                      {u.id !== currentUser.id && <button className="btn btn-danger btn-xs" onClick={() => setConfirm(u)}>🗑</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? "Editar Usuário" : "Novo Usuário"}</span>
              <button className="close-btn" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group"><label className="input-label">Nome *</label><input className="input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Username *</label><input className="input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} /></div>
              <div className="input-group">
                <label className="input-label">Senha {editing ? "(deixe em branco para manter)" : "*"}</label>
                <input className="input" type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Perfil</label>
                <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Administrador</option>
                  <option value="operador">Operador</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>💾 Salvar</button>
            </div>
          </div>
        </div>
      )}
      {confirm && <ConfirmDialog icon="🗑" title="Excluir usuário?" desc={`Tem certeza que deseja remover "${confirm.nome}"?`} danger confirmLabel="Excluir" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "⬛", label: "Dashboard", section: "PRINCIPAL" },
  { id: "nova-entrega", icon: "📋", label: "Nova Entrega", section: "OPERAÇÕES" },
  { id: "cancelar-entrega", icon: "🚫", label: "Cancelar Entrega" },
  { id: "entregas", icon: "📦", label: "Histórico de Entregas" },
  { id: "funcionarios", icon: "👷", label: "Funcionários", section: "CADASTROS" },
  { id: "cargos", icon: "🏷️", label: "Cargos" },
  { id: "epis", icon: "🦺", label: "EPIs" },
  { id: "biometria", icon: "👆", label: "Biometria" },
  { id: "cadastro-usuarios", icon: "👤", label: "Usuários" },
  { id: "relatorio-troca", icon: "🔄", label: "Relatório de Trocas", section: "RELATÓRIOS" },
  { id: "relatorios", icon: "📊", label: "Indicadores Gerais" },
];
const TITLES = {
  dashboard: ["Dashboard","Visão geral do sistema"],
  "nova-entrega": ["Nova Entrega","Registrar entrega de EPI"],
  "cancelar-entrega": ["Cancelar Entrega","Estorno e cancelamento de entregas"],
  entregas: ["Histórico de Entregas","Registros, assinaturas e ações pendentes"],
  funcionarios: ["Funcionários","Cadastro e edição"],
  cargos: ["Cargos","Cadastro e edição de cargos"],
  epis: ["EPIs","Catálogo, estoque e edição"],
  biometria: ["Biometria","Cadastro e gerenciamento"],
  "cadastro-usuarios": ["Usuários","Gerenciamento de usuários do sistema"],
  "relatorio-troca": ["Relatório de Trocas","Calendário de substituição de EPIs por colaborador"],
  relatorios: ["Indicadores Gerais","Performance e conformidade"],
};

interface Entrega {
  id?: number;
  cliente_nome: string;
  endereco: string;
  status?: string;
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [users, setUsers] = useState(INIT_USERS);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.length) setUsers(data); })
      .catch(() => {});
  }, []);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cargos, setCargos] = useState([]);
  const [epis, setEpis] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const { toasts, add: toast } = useToast();

  // INTEGRAÇÃO COM O BACKEND: Busca os dados reais quando o login é feito
  useEffect(() => {
    if (!currentUser) return;

    const carregarDadosDoBackend = async () => {
      try {
        // Busca entregas reais
        //const resEntregas = await fetch('http://localhost:3000/api/entregas');
        const resEntregas = await fetch('/api/entregas');
        if (resEntregas.ok) {
          const dadosEntregas = await resEntregas.json();
          // Se o banco retornar dados reais, substitui os dados de exemplo
          if (dadosEntregas && dadosEntregas.length > 0) {
            // Atualiza a tela com os dados do banco de dados (SQLite)
            setEntregas(dadosEntregas);
            console.log("Entregas carregadas do banco:", dadosEntregas);
          }
        }

        // Busca funcionários reais
        const resFuncs = await fetch('/api/funcionarios');
        if (resFuncs.ok) {
          const dadosFuncs = await resFuncs.json();
          if (dadosFuncs && dadosFuncs.length > 0) {
            setFuncionarios(dadosFuncs);
            console.log("Funcionários carregados do banco:", dadosFuncs);
          }
        }

        // Busca cargos reais
        const resCargos = await fetch('/api/cargos');
        if (resCargos.ok) {
          const dadosCargos = await resCargos.json();
          if (dadosCargos && dadosCargos.length > 0) setCargos(dadosCargos);
        }

        // Busca EPIs reais
        const resEpis = await fetch('/api/epis');
        if (resEpis.ok) {
          const dadosEpis = await resEpis.json();
          if (dadosEpis && dadosEpis.length > 0) {
            setEpis(dadosEpis);
            console.log("EPIs carregados do banco:", dadosEpis);
          }
        }

      } catch (error) {
        console.error('Erro de conexão com o Backend. Usando dados locais (Mock).', error);
      }
    };

    carregarDadosDoBackend();
  }, [currentUser]);
  const entregasEnviadasRef = useRef<Set<number>>(new Set());
  const funcionariosEnviadosRef = useRef<Set<number>>(new Set());
  const episEnviadosRef = useRef<Set<number>>(new Set());

  const handleSetEntregas = (acao: any) => {
    setEntregas((estadoAnterior) => {
      const novasEntregas = typeof acao === 'function' ? acao(estadoAnterior) : acao;

      // 1. DETECTA SE UMA NOVA ENTREGA FOI ADICIONADA (Inclusão)
      if (novasEntregas.length > estadoAnterior.length) {
        const novaEntrega = novasEntregas[0];

        // Verifica se a entrega existe e se o ID já NÃO foi enviado nesta sessão (evita o bug do StrictMode)
        if (novaEntrega && novaEntrega.funcionario && novaEntrega.id && !entregasEnviadasRef.current.has(novaEntrega.id)) {

          // Marca o ID como enviado IMEDIATAMENTE antes da promise
          entregasEnviadasRef.current.add(novaEntrega.id);

          fetch('/api/entregas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              funcionario_id: novaEntrega.funcionario_id,
              funcionario: novaEntrega.funcionario,
              status: novaEntrega.status,
              tipo_assinatura: novaEntrega.tipo_assinatura,
              confianca: novaEntrega.confianca,
              data: novaEntrega.data,
              itens: novaEntrega.itens
            })
          })
              .then(res => res.json())
              .then(data => {
                console.log("Salvo no SQLite com sucesso, BD_ID:", data.id);
                fetch('/api/epis').then(r => r.json()).then(updatedEpis => setEpis(updatedEpis));
              })
              .catch(err => {
                console.error("Falha ao salvar no banco:", err);
              });
        }
      }
      // 2. DETECTA SE O STATUS DE UMA ENTREGA FOI ALTERADO (Edição/Cancelamento)
      else if (novasEntregas.length === estadoAnterior.length) {
        for (let i = 0; i < novasEntregas.length; i++) {
          const entregaNova = novasEntregas[i];
          const entregaVelha = estadoAnterior.find((e: any) => e.id === entregaNova.id);

          // Se a assinatura foi feita ou entrega foi cancelada...
          if (entregaVelha && entregaNova.status !== entregaVelha.status) {
            fetch(`/api/entregas/${entregaNova.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: entregaNova.status,
                tipo_assinatura: entregaNova.tipo_assinatura,
                confianca: entregaNova.confianca
              })
            })
                .then(() => {
                  console.log(`Atualização no BD - A entrega ID ${entregaNova.id} mudou para: ${entregaNova.status}`);
                  if (entregaNova.status === 'cancelado') {
                    fetch('/api/epis').then(r => r.json()).then(updatedEpis => setEpis(updatedEpis));
                  }
                })
                .catch(err => console.error('Erro ao atualizar status no banco', err));
          }
        }
      }

      return novasEntregas;
    });
  };

  const handleSetFuncionarios = (acao: any) => {
    setFuncionarios((estadoAnterior) => {
      const novosFuncionarios = typeof acao === 'function' ? acao(estadoAnterior) : acao;

      // 1. DETECTA ADIÇÃO
      if (novosFuncionarios.length > estadoAnterior.length) {
        const novoFuncionario = novosFuncionarios.find((n: any) => !estadoAnterior.some((a: any) => a.id === n.id));

        if (novoFuncionario && novoFuncionario.id && !funcionariosEnviadosRef.current.has(novoFuncionario.id)) {
          funcionariosEnviadosRef.current.add(novoFuncionario.id);

          fetch('/api/funcionarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: novoFuncionario.nome,
              matricula: novoFuncionario.matricula,
              setor: novoFuncionario.setor,
              cargo: novoFuncionario.cargo,
              email: novoFuncionario.email,
              telefone: novoFuncionario.telefone
            })
          })
              .then(res => res.json())
              .then(data => console.log("Funcionário salvo no banco, BD_ID:", data.id))
              .catch(err => console.error("Falha ao salvar funcionário no banco:", err));
        }
      }
      // 2. DETECTA EDIÇÃO
      else if (novosFuncionarios.length === estadoAnterior.length) {
        for (let i = 0; i < novosFuncionarios.length; i++) {
          const funcNovo = novosFuncionarios[i];
          const funcVelho = estadoAnterior.find((f: any) => f.id === funcNovo.id);

          if (funcVelho && (funcNovo.nome !== funcVelho.nome || funcNovo.setor !== funcVelho.setor || funcNovo.cargo !== funcVelho.cargo || funcNovo.matricula !== funcVelho.matricula || funcNovo.email !== funcVelho.email || funcNovo.telefone !== funcVelho.telefone)) {
            fetch(`/api/funcionarios/${funcNovo.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(funcNovo)
            })
                .then(() => console.log(`Funcionário ID ${funcNovo.id} atualizado no banco.`))
                .catch(err => console.error('Erro ao atualizar funcionário', err));
          }
        }
      }
      // 3. DETECTA EXCLUSÃO
      else if (novosFuncionarios.length < estadoAnterior.length) {
        for (let i = 0; i < estadoAnterior.length; i++) {
          const funcVelho = estadoAnterior[i];
          if (!novosFuncionarios.some((f: any) => f.id === funcVelho.id)) {
            fetch(`/api/funcionarios/${funcVelho.id}`, {
              method: 'DELETE'
            })
                .then(() => console.log(`Funcionário ID ${funcVelho.id} deletado no banco.`))
                .catch(err => console.error('Erro ao deletar funcionário', err));
          }
        }
      }

      return novosFuncionarios;
    });
  };

  const criarFuncionario = async (funcData: any): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/funcionarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: funcData.nome,
          matricula: funcData.matricula,
          setor: funcData.setor,
          cargo: funcData.cargo,
          email: funcData.email,
          telefone: funcData.telefone
        })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Erro ao criar funcionário' };
      // Usa o setter raw do React (não handleSetFuncionarios) para não disparar outro POST
      setFuncionarios((prev: any) => [...prev, { ...funcData, id: data.id, biometrias: [] }]);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const handleSetEpis = (acao: any) => {
    setEpis((estadoAnterior) => {
      const novosEpis = typeof acao === 'function' ? acao(estadoAnterior) : acao;

      // 1. DETECTA ADIÇÃO
      if (novosEpis.length > estadoAnterior.length) {
        const novoEpi = novosEpis.find((n: any) => !estadoAnterior.some((a: any) => a.id === n.id));

        if (novoEpi && novoEpi.id && !episEnviadosRef.current.has(novoEpi.id)) {
          episEnviadosRef.current.add(novoEpi.id);

          fetch('/api/epis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: novoEpi.nome, ca: novoEpi.ca, cas_json: novoEpi.cas_json ?? null,
              categoria: novoEpi.categoria, estoque: novoEpi.estoque, minimo: novoEpi.minimo,
              validade: novoEpi.validade, img: novoEpi.img, periodicidade: novoEpi.periodicidade,
              descricao: novoEpi.descricao, norma: novoEpi.norma, fabricante: novoEpi.fabricante
            })
          })
            .then(res => res.json())
            .then(data => console.log("EPI salvo no banco com sucesso, BD_ID:", data.id))
            .catch(err => console.error("Falha ao salvar EPI no banco:", err));
        }
      }
      // 2. DETECTA EDIÇÃO
      else if (novosEpis.length === estadoAnterior.length) {
        for (let i = 0; i < novosEpis.length; i++) {
          const epiNovo = novosEpis[i];
          const epiVelho = estadoAnterior.find((e: any) => e.id === epiNovo.id);

          if (epiVelho && (epiNovo.nome !== epiVelho.nome || epiNovo.ca !== epiVelho.ca || epiNovo.estoque !== epiVelho.estoque || epiNovo.minimo !== epiVelho.minimo || epiNovo.categoria !== epiVelho.categoria || epiNovo.fabricante !== epiVelho.fabricante)) {
            fetch(`/api/epis/${epiNovo.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(epiNovo)
            })
              .then(() => console.log(`EPI ID ${epiNovo.id} atualizado no banco.`))
              .catch(err => console.error('Erro ao atualizar EPI', err));
          }
        }
      }
      // 3. DETECTA EXCLUSÃO
      else if (novosEpis.length < estadoAnterior.length) {
        for (let i = 0; i < estadoAnterior.length; i++) {
          const epiVelho = estadoAnterior[i];
          if (!novosEpis.some((e: any) => e.id === epiVelho.id)) {
            fetch(`/api/epis/${epiVelho.id}`, {
              method: 'DELETE'
            })
              .then(() => console.log(`EPI ID ${epiVelho.id} deletado no banco.`))
              .catch(err => console.error('Erro ao deletar EPI', err));
          }
        }
      }

      return novosEpis;
    });
  };

  if (showLanding) return <Landing onEnter={() => setShowLanding(false)} />;
  if (!currentUser) return (<><style>{css}</style><LoginPage onLogin={(u: any) => setCurrentUser(u)} users={users} /><ToastContainer toasts={toasts} /></>);

  const stockAlerts = epis.filter(e => e.estoque <= e.minimo).length;
  const pendentes = entregas.filter(e => e.status === "pendente_assinatura").length;
  const [title, sub] = TITLES[page] || ["",""];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />
        <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sidebar-logo">
            <div className="logo-icon" style={{background:'transparent',padding:0}}><img src="/favicon.svg" style={{width:'36px',height:'36px',objectFit:'contain'}} /></div>
            <div><div className="logo-text">SegurID</div><div className="logo-sub">Entrega de EPI por biometria</div></div>
          </div>
          <nav className="nav">
            {NAV.filter(item => !(item.id === "cadastro-usuarios" && currentUser.role !== "admin")).map(item => (
              <div key={item.id}>
                {item.section && <div className="nav-section">{item.section}</div>}
                <div className={`nav-item${page === item.id ? " active" : ""}`} onClick={() => { setPage(item.id); setSidebarOpen(false); }}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.id === "epis" && stockAlerts > 0 && <span className="nav-badge">{stockAlerts}</span>}
                  {item.id === "entregas" && pendentes > 0 && <span className="nav-badge">{pendentes}</span>}
                  {item.id === "cancelar-entrega" && pendentes > 0 && <span className="nav-badge">{pendentes}</span>}
                </div>
              </div>
            ))}
          </nav>
          <div className="sidebar-user">
            <div className="user-avatar">{currentUser.nome[0].toUpperCase()}</div>
            <div><div className="user-name">{currentUser.nome}</div><div className="user-role">{currentUser.role} · v2.1</div></div>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <div><div className="topbar-title">{title}</div><div className="topbar-sub">{sub}</div></div>
            <div className="topbar-right">
              {(stockAlerts > 0 || pendentes > 0) && (<div className="alert alert-warning" style={{ padding: "6px 12px", margin: 0, fontSize: 12 }}>⚠️ {stockAlerts + pendentes} alerta{(stockAlerts + pendentes) !== 1 ? "s" : ""}</div>)}
              <button className="btn btn-danger btn-sm" onClick={() => { setCurrentUser(null); setShowLanding(true); }}>Sair</button>
            </div>
          </div>
          <div className="content">
            {page === "dashboard" && <Dashboard epis={epis} funcionarios={funcionarios} entregas={entregas} onNav={setPage} />}
            {page === "nova-entrega" && <NovaEntregaPage epis={epis} setEpis={handleSetEpis} funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} entregas={entregas} setEntregas={handleSetEntregas} toast={toast} onNav={setPage} />}
            {page === "cancelar-entrega" && <CancelarEntregaPage entregas={entregas} setEntregas={handleSetEntregas} toast={toast} />}
            {page === "entregas" && <EntregasPage entregas={entregas} setEntregas={handleSetEntregas} epis={epis} toast={toast} />}
            {page === "funcionarios" && <FuncionariosPage funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} onAddFuncionario={criarFuncionario} cargos={cargos} toast={toast} />}
            {page === "cargos" && <CargosPage cargos={cargos} setCargos={setCargos} toast={toast} />}
            {page === "epis" && <EpisPage epis={epis} setEpis={handleSetEpis} toast={toast} />}
            {page === "biometria" && <BiometriaPage funcionarios={funcionarios} setFuncionarios={handleSetFuncionarios} toast={toast} />}
            {page === "cadastro-usuarios" && <CadastroUsuariosPage users={users} setUsers={setUsers} currentUser={currentUser} toast={toast} />}
            {page === "relatorio-troca" && <RelatorioTrocaPage epis={epis} funcionarios={funcionarios} entregas={entregas} />}
            {page === "relatorios" && <RelatoriosPage epis={epis} entregas={entregas} />}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
    </>
  );
}
