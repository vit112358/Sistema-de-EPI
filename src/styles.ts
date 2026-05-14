export const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@300;400;500&family=Barlow:wght@300;400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #080b10; --surface: #0f1520; --surface2: #161e2d;
    --border: #1e2d42; --border2: #243347;
    --orange: #f5a623; --orange-dim: rgba(245,166,35,0.12); --orange-glow: rgba(245,166,35,0.25);
    --red: #ff4757; --green: #2ed573; --blue: #1e90ff; --purple: #a855f7;
    --text: #e8edf5; --text2: #8899aa; --text3: #4a5a6b;
  }
  html.light-mode {
    --bg: #EEEEEE; --surface: #FFFFFF; --surface2: #E2E2E2;
    --border: #D0D5DD; --border2: #B0BAC9;
    --orange-dim: rgba(245,166,35,0.10); --orange-glow: rgba(245,166,35,0.20);
    --text: #111827; --text2: #374151; --text3: #6B7280;
  }
  body { background: var(--bg); font-family: 'Barlow', sans-serif; color: var(--text); }
  .app { display: flex; height: 100vh; overflow: hidden; }
  .sidebar { width: 220px; min-width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
  .sidebar-logo { padding: 20px 20px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .logo-icon { width: 60px; height: 60px; background: transparent; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
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