export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token");
  const AUTH_TOKEN = context.env.AUTH_TOKEN;
  if (!AUTH_TOKEN || token !== AUTH_TOKEN) {
    return new Response("未授权访问", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(dashboardHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

const dashboardHtml = `<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RikkaHub 数据看板</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>
  :root {
    --bg: #08080c;
    --bg-grad: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99, 102, 241, 0.08), transparent 70%);
    --surface: rgba(255, 255, 255, 0.025);
    --surface-hover: rgba(255, 255, 255, 0.04);
    --border: rgba(255, 255, 255, 0.06);
    --border-strong: rgba(255, 255, 255, 0.1);
    --text: #fafafa;
    --text-muted: #a1a1aa;
    --text-dim: #71717a;
    --indigo: #818cf8;
    --indigo-dim: rgba(129, 140, 248, 0.15);
    --emerald: #34d399;
    --emerald-dim: rgba(52, 211, 153, 0.15);
    --amber: #fbbf24;
    --amber-dim: rgba(251, 191, 36, 0.15);
    --rose: #fb7185;
    --rose-dim: rgba(251, 113, 133, 0.15);
    --sky: #38bdf8;
    --sky-dim: rgba(56, 189, 248, 0.15);
    --violet: #a78bfa;
    --violet-dim: rgba(167, 139, 250, 0.15);
    --pink: #f472b6;
    --pink-dim: rgba(244, 114, 182, 0.15);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-feature-settings: 'cv11', 'ss01', 'ss03';
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
  body::before { content: ''; position: fixed; inset: 0; background: var(--bg-grad); pointer-events: none; z-index: 0; }
  .container { max-width: 1320px; margin: 0 auto; padding: 36px 32px 64px; position: relative; z-index: 1; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 34px; height: 34px; border-radius: 9px; overflow: hidden; box-shadow: 0 8px 24px -8px rgba(129,140,248,0.4), 0 0 0 1px rgba(255,255,255,0.06); background: #1a1a28; display: flex; align-items: center; justify-content: center; }
  .brand-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .brand-text { display: flex; flex-direction: column; line-height: 1.1; }
  .brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
  .brand-sub { font-size: 12px; color: var(--text-dim); font-weight: 500; }

  .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .updated { font-size: 12px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 8px var(--emerald); animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
  .icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
  .icon-btn:hover { color: var(--text); border-color: var(--border-strong); }
  .icon-btn svg { width: 15px; height: 15px; stroke-width: 2.2; }
  .icon-btn.spinning svg { animation: spin 0.7s linear infinite; }
  .range { display: inline-flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
  .range button { background: transparent; border: 0; color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
  .range button:hover { color: var(--text); }
  .range button.active { background: var(--surface-hover); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }

  /* Filter bar */
  .filterbar { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; }
  .filter-group { display: flex; align-items: center; gap: 8px; }
  .filter-label { font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; }
  .seg { display: inline-flex; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 7px; padding: 2px; gap: 1px; }
  .seg button { background: transparent; border: 0; color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 500; padding: 5px 11px; border-radius: 5px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
  .seg button:hover { color: var(--text); }
  .seg button.active { background: var(--indigo-dim); color: var(--indigo); }
  .filterbar select { background: rgba(255,255,255,0.03); color: var(--text); border: 1px solid var(--border); border-radius: 7px; padding: 6px 28px 6px 11px; font-family: inherit; font-size: 12px; cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>"); background-repeat: no-repeat; background-position: right 9px center; }
  .filterbar select:hover { border-color: var(--border-strong); }
  .filter-summary { margin-left: auto; font-size: 11.5px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }

  /* Stat cards */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px 22px; position: relative; overflow: hidden; transition: all 0.2s ease; }
  .stat:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .stat::after { content: ''; position: absolute; top: 0; left: 20px; right: 20px; height: 1px; background: linear-gradient(90deg, transparent, var(--stat-color, var(--indigo)), transparent); opacity: 0.6; }
  .stat-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .stat-label { font-size: 11.5px; font-weight: 600; color: var(--text-dim); letter-spacing: 0.04em; text-transform: uppercase; }
  .stat-icon { width: 24px; height: 24px; border-radius: 6px; background: var(--stat-bg, var(--indigo-dim)); color: var(--stat-color, var(--indigo)); display: flex; align-items: center; justify-content: center; }
  .stat-icon svg { width: 13px; height: 13px; stroke-width: 2.5; }
  .stat-value { font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .stat-split { display: flex; gap: 10px; margin-top: 8px; font-size: 12px; }
  .stat-split .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 5px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stat-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--text-dim); }
  .delta { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
  .delta.up { background: var(--emerald-dim); color: var(--emerald); }
  .delta.down { background: var(--rose-dim); color: var(--rose); }
  .delta.flat { background: rgba(255,255,255,0.05); color: var(--text-dim); }

  /* Mini cards */
  .secondary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 12px; }
  .mini { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .mini-label { font-size: 11px; color: var(--text-dim); font-weight: 500; margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
  .mini-value { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .mini-sub { font-size: 11px; color: var(--text-dim); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
  .badge-tag { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.06); color: var(--text-dim); font-weight: 600; letter-spacing: 0.04em; }

  /* Chart cards */
  .grid { display: grid; gap: 12px; margin-bottom: 12px; }
  .grid.two { grid-template-columns: 1fr 1fr; }
  .grid.full { grid-template-columns: 1fr; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 22px 24px; transition: all 0.2s ease; }
  .card:hover { border-color: var(--border-strong); }
  .card-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
  .card-title { display: flex; flex-direction: column; gap: 2px; }
  .card-title h3 { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .card-title .desc { font-size: 12px; color: var(--text-dim); font-weight: 400; }
  .card-legend { display: flex; gap: 14px; font-size: 12px; flex-wrap: wrap; }
  .card-legend .item { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
  .card-legend .dot { width: 8px; height: 8px; border-radius: 50%; }
  .chart-wrap { position: relative; height: 280px; }
  .chart-wrap.tall { height: 320px; }
  .chart-wrap canvas { width: 100% !important; height: 100% !important; }

  /* Tabs */
  .tabs { display: inline-flex; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; padding: 3px; gap: 2px; }
  .tabs button { background: transparent; border: 0; color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
  .tabs button:hover { color: var(--text); }
  .tabs button.active { background: var(--surface-hover); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,0.2); }

  /* Retention table */
  .retention-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; font-variant-numeric: tabular-nums; }
  .retention-table thead th { padding: 10px 12px; text-align: center; color: var(--text-dim); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); }
  .retention-table thead th:first-child { text-align: left; }
  .retention-table tbody td { padding: 10px 12px; text-align: center; color: var(--text-muted); border-bottom: 1px solid var(--border); }
  .retention-table tbody tr:last-child td { border-bottom: 0; }
  .retention-table tbody td:first-child { text-align: left; color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 500; }
  .retention-table tbody td:nth-child(2) { color: var(--text); font-weight: 600; font-family: 'JetBrains Mono', monospace; }
  .ret-cell { display: inline-flex; align-items: center; justify-content: center; min-width: 50px; padding: 4px 8px; border-radius: 5px; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 11px; }

  /* Users table */
  .users-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
  .users-table thead th { padding: 10px 14px; text-align: left; color: var(--text-dim); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border); }
  .users-table thead th.num { text-align: right; }
  .users-table tbody td { padding: 11px 14px; color: var(--text-muted); border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  .users-table tbody td.num { text-align: right; font-family: 'JetBrains Mono', monospace; color: var(--text); }
  .users-table tbody tr:last-child td { border-bottom: 0; }
  .users-table tbody tr { transition: background 0.15s ease; }
  .users-table tbody tr:hover { background: rgba(255,255,255,0.02); }
  .device-id { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
  .device-id .copy-icon { width: 12px; height: 12px; color: var(--text-dim); opacity: 0; transition: opacity 0.15s ease; }
  .device-id:hover .copy-icon { opacity: 1; }
  .device-id.copied .copy-icon { opacity: 1; color: var(--emerald); }
  .os-tag { display: inline-block; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
  .os-tag.win { background: var(--sky-dim); color: var(--sky); }
  .os-tag.mac { background: var(--violet-dim); color: var(--violet); }
  .os-tag.linux { background: var(--amber-dim); color: var(--amber); }
  .ver-tag { display: inline-block; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

  .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 120px 0; color: var(--text-dim); }
  .spinner { width: 28px; height: 28px; border: 2.5px solid var(--border); border-top-color: var(--indigo); border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 13px; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 0; color: var(--text-dim); }
  .empty-icon { width: 40px; height: 40px; color: var(--text-dim); opacity: 0.5; }
  .empty-text { font-size: 13px; }
  .error { text-align: center; padding: 80px 0; color: var(--rose); font-size: 14px; }
  .fade-in { animation: fadeIn 0.4s ease-out backwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  @media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .secondary { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 768px) { .container { padding: 24px 16px 48px; } .grid.two { grid-template-columns: 1fr; } .header { flex-direction: column; align-items: flex-start; } .stat-value { font-size: 26px; } .secondary { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px) { .stats-grid { grid-template-columns: 1fr; } .range button { padding: 5px 9px; font-size: 11px; } }
</style>
</head>
<body>
<div class="container">
  <div class="header fade-in">
    <div class="brand">
      <div class="brand-mark"><img src="/icon.png" alt="RikkaHub" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#818cf8,#a78bfa)'"></div>
      <div class="brand-text">
        <div class="brand-name">RikkaHub 数据看板</div>
        <div class="brand-sub">用户活跃度与留存分析</div>
      </div>
    </div>
    <div class="toolbar">
      <div class="updated"><span class="live-dot"></span><span id="updated">--:--</span></div>
      <button class="icon-btn" id="refresh-btn" title="刷新"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></button>
      <div class="range" id="range">
        <button data-d="7">7 天</button>
        <button data-d="14">14 天</button>
        <button data-d="30" class="active">30 天</button>
        <button data-d="90">90 天</button>
        <button data-d="180">180 天</button>
      </div>
    </div>
  </div>

  <!-- 分群筛选:OS + 版本 -->
  <div class="filterbar fade-in">
    <div class="filter-group">
      <span class="filter-label">系统</span>
      <div class="seg" id="os-seg">
        <button data-os="all" class="active">全部</button>
        <button data-os="win">Windows</button>
        <button data-os="linux">Linux</button>
        <button data-os="mac">macOS</button>
      </div>
    </div>
    <div class="filter-group">
      <span class="filter-label">版本</span>
      <select id="ver-select"><option value="all">全部版本</option></select>
    </div>
    <div class="filter-summary" id="filter-summary"></div>
  </div>

  <div id="content">
    <div class="loading"><div class="spinner"></div><div class="loading-text">正在加载数据…</div></div>
  </div>
</div>

<script>
const TOKEN = new URL(location.href).searchParams.get('token');
const BASE  = location.origin;

const ICONS = {
  dau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>',
  effective: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
  monthly: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  new: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
};

const fmt = n => (n ?? 0).toLocaleString('zh-CN');
const fmtPct = n => (n != null ? n + '%' : '—');

function delta(cur, prev) {
  if (prev == null || prev === 0) return '<span class="delta flat">— —</span>';
  const pct = ((cur - prev) / prev * 100);
  const cls = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
  const arrow = pct > 0 ? '↑' : (pct < 0 ? '↓' : '·');
  return '<span class="delta ' + cls + '">' + arrow + ' ' + Math.abs(pct).toFixed(1) + '%</span>';
}

function retentionStyle(pct) {
  if (pct >= 60) return { bg: 'rgba(52,211,153,0.18)', color: '#6ee7b7' };
  if (pct >= 40) return { bg: 'rgba(52,211,153,0.12)', color: '#34d399' };
  if (pct >= 20) return { bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' };
  if (pct > 0)   return { bg: 'rgba(251,113,133,0.12)', color: '#fb7185' };
  return { bg: 'rgba(255,255,255,0.03)', color: '#71717a' };
}

// ── 全局筛选状态(同步到 URL hash,刷新页面不丢) ──
let currentDays = 30, currentOs = 'all', currentVer = 'all';
let allVersions = null;      // 版本下拉缓存(取无版本筛选时的全集,避免筛某版本后下拉只剩一项)
let activeRetentionTab = 'new';

function readStateFromHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  currentDays = parseInt(h.get('d') || '30', 10);
  currentOs = h.get('os') || 'all';
  currentVer = h.get('v') || 'all';
}
function writeStateToHash() {
  location.hash = 'd=' + currentDays + '&os=' + currentOs + '&v=' + encodeURIComponent(currentVer);
}

async function fetchData(days, os, version) {
  const p = new URLSearchParams({ token: TOKEN, days: String(days), os, version });
  const r = await fetch(BASE + '/api/stats?' + p.toString());
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function statCard(label, icon, value, foot, color, bg, split) {
  let s = '<div class="stat" style="--stat-color:' + color + ';--stat-bg:' + bg + '">';
  s += '<div class="stat-header"><div class="stat-label">' + label + '</div><div class="stat-icon">' + icon + '</div></div>';
  s += '<div class="stat-value">' + value + '</div>';
  if (split) s += '<div class="stat-split">' + split + '</div>';
  else if (foot) s += '<div class="stat-foot">' + foot + '</div>';
  s += '</div>';
  return s;
}

function miniCard(label, value, sub) {
  return '<div class="mini"><div class="mini-label">' + label + '</div><div class="mini-value">' + value + '</div><div class="mini-sub">' + (sub || '') + '</div></div>';
}

function card(title, desc, legend, body, extra) {
  const legendHtml = legend ? '<div class="card-legend">' + legend.map(l => '<div class="item"><div class="dot" style="background:' + l.color + '"></div>' + l.label + '</div>').join('') + '</div>' : '';
  let s = '<div class="card fade-in">';
  s += '<div class="card-head"><div class="card-title"><h3>' + title + '</h3>' + (desc ? '<div class="desc">' + desc + '</div>' : '') + '</div>' + (extra || legendHtml) + '</div>';
  s += body;
  s += '</div>';
  return s;
}

function emptyState(msg) {
  return '<div class="empty"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div class="empty-text">' + msg + '</div></div>';
}

function render(data) {
  const trends = data.trends || [];
  const today = trends[trends.length - 1] || {};
  const yesterday = trends[trends.length - 2] || {};
  const dauPct = today.dau ? Math.round((today.eff_dau ?? 0) / today.dau * 100) : 0;

  let html = '';

  // ── 顶层指标 ──
  const newU = today.new_users ?? 0;
  const retU = today.returning_users ?? 0;
  const dauSplit = today.dau
    ? '<span class="chip" style="background:var(--pink-dim);color:var(--pink)">新增 ' + newU + '</span>' +
      '<span class="chip" style="background:var(--sky-dim);color:var(--sky)">回访 ' + retU + '</span>'
    : '';
  html += '<div class="stats-grid">';
  html += statCard('日活用户', ICONS.dau, fmt(today.dau), '较昨日 ' + delta(today.dau ?? 0, yesterday.dau ?? 0), 'var(--indigo)', 'var(--indigo-dim)', dauSplit);
  html += statCard('有效日活', ICONS.effective, fmt(today.eff_dau), today.dau ? '占日活 ' + dauPct + '%' : '当日无对话', 'var(--emerald)', 'var(--emerald-dim)');
  html += statCard('周活 / 月活', ICONS.monthly, fmt(data.wau) + ' <span style="font-weight:400;color:var(--text-dim);font-size:18px"> / </span>' + fmt(data.mau), 'DAU/MAU ' + fmtPct(data.stickinessMau ?? data.stickiness) + ' · DAU/WAU ' + fmtPct(data.stickinessWau), 'var(--amber)', 'var(--amber-dim)');
  html += statCard('新增用户', ICONS.new, fmt(newU), '较昨日 ' + delta(newU, yesterday.new_users ?? 0), 'var(--rose)', 'var(--rose-dim)');
  html += '</div>';

  // ── 二级指标 ──
  const ar = data.avgRetention || {};
  html += '<div class="secondary fade-in">';
  html += miniCard('累计用户', fmt(data.totalUsers), '历史出现过的全部设备');
  html += miniCard('历史峰值 DAU', fmt(data.peakDau), data.peakDate ? '于 ' + data.peakDate : '—');
  html += miniCard('次日留存', ar.d1 != null ? ar.d1 + '%' : '—', '<span class="badge-tag">D+1</span> 新用户加权');
  html += miniCard('7 日留存', ar.d7 != null ? ar.d7 + '%' : '—', '<span class="badge-tag">D+7</span> 新用户加权');
  html += miniCard('30 日留存', ar.d30 != null ? ar.d30 + '%' : '—', '<span class="badge-tag">D+30</span> 新用户加权');
  html += miniCard('日均消息/有效用户', data.avgMsgsPerActive ?? 0, '当日有效用户人均');
  html += '</div>';

  // ── DAU 趋势(全宽) ──
  html += '<div class="grid full">';
  html += card('日活趋势', '过去 ' + trends.length + ' 天的总日活与有效日活',
    [{ label: '日活', color: '#818cf8' }, { label: '有效日活', color: '#34d399' }],
    '<div class="chart-wrap tall"><canvas id="dau-chart"></canvas></div>');
  html += '</div>';

  // ── 新增 vs 回访(堆叠) + 每日消息 ──
  html += '<div class="grid two">';
  html += card('新增 vs 回访', '当日日活拆成新用户与回访用户',
    [{ label: '新增', color: '#f472b6' }, { label: '回访', color: '#38bdf8' }],
    '<div class="chart-wrap"><canvas id="split-chart"></canvas></div>');
  html += card('每日消息总数', '所有有效用户当日累计',
    null, '<div class="chart-wrap"><canvas id="msg-chart"></canvas></div>');
  html += '</div>';

  // ── 累计增长 + 会话深度 ──
  const growth = data.growth || [];
  const d = data.depth || {};
  const depthTotal = (d.b0||0)+(d.b1_5||0)+(d.b6_20||0)+(d.b20p||0);
  html += '<div class="grid two">';
  html += card('累计用户增长', '按设备首次出现日累计的总用户数',
    null, growth.length ? '<div class="chart-wrap"><canvas id="growth-chart"></canvas></div>' : emptyState('无数据'));
  html += card('会话深度分布', '过去 7 天按当日消息数分桶',
    null, depthTotal > 0 ? '<div class="chart-wrap"><canvas id="depth-chart"></canvas></div>' : emptyState('过去 7 天无数据'));
  html += '</div>';

  // ── 版本 + 系统 ──
  const hasVersionData = data.versions && data.versions.length;
  const hasOsData = (today.win_users||0)+(today.linux_users||0)+(today.mac_users||0) > 0;
  html += '<div class="grid two">';
  html += card('版本分布', '当前最新日的活跃版本',
    null, hasVersionData ? '<div class="chart-wrap"><canvas id="version-chart"></canvas></div>' : emptyState('暂无版本数据'));
  html += card('系统分布', '当日活跃用户的操作系统',
    null, hasOsData ? '<div class="chart-wrap"><canvas id="os-chart"></canvas></div>' : emptyState('暂无系统数据'));
  html += '</div>';

  // ── 留存矩阵(新用户 cohort / 全量滚动 双视图) ──
  const newCohorts = (data.retention && data.retention.cohorts) || [];
  const rollCohorts = (data.rollingRetention && data.rollingRetention.cohorts) || [];
  if (newCohorts.length || rollCohorts.length) {
    const tabs = '<div class="tabs" id="ret-tabs">' +
      '<button data-tab="new" class="' + (activeRetentionTab==='new'?'active':'') + '">新用户 cohort</button>' +
      '<button data-tab="rolling" class="' + (activeRetentionTab==='rolling'?'active':'') + '">全量滚动留存</button>' +
      '</div>';
    html += '<div class="grid full">';
    html += card('留存矩阵', '不同 cohort 在 D+N 的回访率',
      null,
      '<div id="ret-new" style="margin-top:6px;display:' + (activeRetentionTab==='new'?'block':'none') + '">' + retentionTable(newCohorts, [1,3,7,14,30]) + '</div>' +
      '<div id="ret-rolling" style="margin-top:6px;display:' + (activeRetentionTab==='rolling'?'block':'none') + '">' + (rollCohorts.length ? retentionTable(rollCohorts, [1,3,7,14]) : emptyState('近期样本不足')) + '</div>' +
      '<div style="font-size:11px;color:var(--text-dim);margin-top:10px">全量滚动留存:cohort = 当日全部活跃设备(不限新用户)</div>',
      tabs);
    html += '</div>';
  }

  // ── 用户列表 ──
  if (data.recentUsers && data.recentUsers.length) {
    let ut = '<table class="users-table"><thead><tr>';
    ut += '<th>设备 ID</th><th>系统</th><th>版本</th><th>首次出现</th><th>最近活跃</th>';
    ut += '<th class="num">活跃天数</th><th class="num">累计消息</th></tr></thead><tbody>';
    for (const u of data.recentUsers) {
      const short = (u.device_id || '').slice(0, 8);
      const osLabel = u.os === 'win' ? 'Windows' : u.os === 'mac' ? 'macOS' : u.os === 'linux' ? 'Linux' : '—';
      const osClass = u.os === 'win' ? 'win' : u.os === 'mac' ? 'mac' : u.os === 'linux' ? 'linux' : '';
      ut += '<tr>';
      ut += '<td><span class="device-id" data-full="' + (u.device_id||'') + '" title="点击复制完整 ID">' + short + '… <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></span></td>';
      ut += '<td>' + (osLabel==='—' ? '<span style="color:var(--text-dim)">—</span>' : '<span class="os-tag '+osClass+'">'+osLabel+'</span>') + '</td>';
      ut += '<td>' + (u.version ? '<span class="ver-tag">'+u.version+'</span>' : '<span style="color:var(--text-dim)">—</span>') + '</td>';
      ut += '<td>' + (u.first_date || '—') + '</td>';
      ut += '<td>' + (u.last_date || '—') + '</td>';
      ut += '<td class="num">' + (u.active_days || 0) + '</td>';
      ut += '<td class="num">' + fmt(u.total_msgs || 0) + '</td>';
      ut += '</tr>';
    }
    ut += '</tbody></table>';
    html += '<div class="grid full">';
    html += card('用户列表', '最近活跃的前 ' + data.recentUsers.length + ' 个设备(按最近一次活跃排序)', null, ut);
    html += '</div>';
  }

  document.getElementById('content').innerHTML = html;
  drawCharts(data, trends);
  bindCopyButtons();
  bindRetentionTabs();

  // 筛选摘要
  const f = data.filter || {};
  const osTxt = f.os && f.os !== 'all' ? ({win:'Windows',linux:'Linux',mac:'macOS'}[f.os]) : '全部系统';
  const verTxt = f.version && f.version !== 'all' ? f.version : '全部版本';
  document.getElementById('filter-summary').textContent = osTxt + ' · ' + verTxt + ' · 数据截至 ' + (f.asOf || '—');
  document.getElementById('updated').textContent = new Date().toTimeString().slice(0, 8) + ' 已更新';

  // 缓存版本下拉(只在无版本筛选时取全集)
  if ((!f.version || f.version === 'all') && data.versions && data.versions.length) {
    allVersions = data.versions;
    populateVersionSelect();
  }
}

function retentionTable(cohorts, offsets) {
  const head = offsets.map(o => '<th>D+' + o + '</th>').join('');
  let t = '<table class="retention-table"><thead><tr><th>日期</th><th>样本</th>' + head + '</tr></thead><tbody>';
  for (const c of cohorts.slice(0, 20)) {
    t += '<tr><td>' + c.date + '</td><td>' + (c.size ?? 0) + '</td>';
    for (const o of offsets) {
      const val = c.retention[o];
      if (val == null) t += '<td><span class="ret-cell" style="background:rgba(255,255,255,0.02);color:var(--text-dim)">—</span></td>';
      else { const s = retentionStyle(val); t += '<td><span class="ret-cell" style="background:'+s.bg+';color:'+s.color+'">'+val+'%</span></td>'; }
    }
    t += '</tr>';
  }
  t += '</tbody></table>';
  return t;
}

function bindCopyButtons() {
  document.querySelectorAll('.device-id').forEach(el => {
    el.addEventListener('click', () => {
      const full = el.dataset.full; if (!full) return;
      navigator.clipboard?.writeText(full).then(() => { el.classList.add('copied'); setTimeout(() => el.classList.remove('copied'), 1200); }).catch(() => {});
    });
  });
}

function bindRetentionTabs() {
  const tabs = document.getElementById('ret-tabs');
  if (!tabs) return;
  tabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRetentionTab = btn.dataset.tab;
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('ret-new').style.display = activeRetentionTab === 'new' ? 'block' : 'none';
      const roll = document.getElementById('ret-rolling');
      if (roll) roll.style.display = activeRetentionTab === 'rolling' ? 'block' : 'none';
    });
  });
}

function populateVersionSelect() {
  const sel = document.getElementById('ver-select');
  if (!sel || !allVersions) return;
  const cur = currentVer;
  let opts = '<option value="all">全部版本</option>';
  for (const v of allVersions) opts += '<option value="' + (v.version||'') + '"' + ((v.version||'')===cur?' selected':'') + '>' + (v.version||'(unknown)') + ' · ' + v.count + '</option>';
  sel.innerHTML = opts;
}

function drawCharts(data, trends) {
  const labels = trends.map(t => t.date.slice(5).replace('-', '/'));
  const fam = "'Inter','JetBrains Mono','Noto Sans SC',sans-serif";
  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(20,20,30,0.95)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, boxPadding: 6, titleColor: '#fafafa', bodyColor: '#a1a1aa', titleFont: { family: fam, weight: 600, size: 12 }, bodyFont: { family: fam, size: 12 }, cornerRadius: 8 },
    },
    scales: {
      x: { ticks: { color: '#71717a', font: { family: fam, size: 10.5 }, maxRotation: 0, padding: 8 }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: '#71717a', font: { family: fam, size: 10.5 }, padding: 8 }, grid: { color: 'rgba(255,255,255,0.04)', drawTicks: false }, border: { display: false }, beginAtZero: true },
    },
  };

  // DAU 趋势
  const dauC = document.getElementById('dau-chart');
  if (dauC) {
    const ctx = dauC.getContext('2d');
    const g1 = ctx.createLinearGradient(0,0,0,320); g1.addColorStop(0,'rgba(129,140,248,0.25)'); g1.addColorStop(1,'rgba(129,140,248,0)');
    const g2 = ctx.createLinearGradient(0,0,0,320); g2.addColorStop(0,'rgba(52,211,153,0.20)'); g2.addColorStop(1,'rgba(52,211,153,0)');
    new Chart(dauC, { type: 'line', data: { labels, datasets: [
      { label: '日活', data: trends.map(t=>t.dau), borderColor: '#818cf8', backgroundColor: g1, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#818cf8', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2 },
      { label: '有效日活', data: trends.map(t=>t.eff_dau), borderColor: '#34d399', backgroundColor: g2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#34d399', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2 },
    ]}, options: baseOpts });
  }

  // 新增 vs 回访(堆叠柱)
  const splitC = document.getElementById('split-chart');
  if (splitC) {
    new Chart(splitC, { type: 'bar', data: { labels, datasets: [
      { label: '新增', data: trends.map(t=>t.new_users), backgroundColor: 'rgba(244,114,182,0.75)', hoverBackgroundColor: 'rgba(244,114,182,0.95)', borderRadius: 3, stack: 'a', barPercentage: 0.7, categoryPercentage: 0.75 },
      { label: '回访', data: trends.map(t=>t.returning_users), backgroundColor: 'rgba(56,189,248,0.75)', hoverBackgroundColor: 'rgba(56,189,248,0.95)', borderRadius: 3, stack: 'a', barPercentage: 0.7, categoryPercentage: 0.75 },
    ]}, options: { ...baseOpts, scales: { ...baseOpts.scales, x: { ...baseOpts.scales.x, stacked: true }, y: { ...baseOpts.scales.y, stacked: true } } } });
  }

  // 每日消息
  const msgC = document.getElementById('msg-chart');
  if (msgC) {
    new Chart(msgC, { type: 'bar', data: { labels, datasets: [
      { label: '消息数', data: trends.map(t=>t.total_msgs), backgroundColor: 'rgba(56,189,248,0.7)', hoverBackgroundColor: 'rgba(56,189,248,0.95)', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.75 },
    ]}, options: baseOpts });
  }

  // 累计增长(全期,窗口只影响点数密度;曲线展示全历史)
  const growC = document.getElementById('growth-chart');
  if (growC) {
    const g = data.growth || [];
    const ctx = growC.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,280); grad.addColorStop(0,'rgba(167,139,250,0.28)'); grad.addColorStop(1,'rgba(167,139,250,0)');
    // 稀疏 x 轴标签:点太多时只显示每隔 N 个
    const step = Math.max(1, Math.ceil(g.length / 12));
    new Chart(growC, { type: 'line', data: { labels: g.map(p=>p.date.slice(5).replace('-','/')), datasets: [
      { label: '累计用户', data: g.map(p=>p.total), borderColor: '#a78bfa', backgroundColor: grad, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
    ]}, options: { ...baseOpts, scales: { ...baseOpts.scales, x: { ...baseOpts.scales.x, ticks: { ...baseOpts.scales.x.ticks, callback: function(v,i){ return i % step === 0 ? this.getLabelForValue(v) : ''; } } } } } });
  }

  // 会话深度
  const depthC = document.getElementById('depth-chart');
  if (depthC && data.depth) {
    const d = data.depth;
    new Chart(depthC, { type: 'bar', data: { labels: ['0 条(仅启动)','1–5 条(轻度)','6–20 条(常规)','20+ 条(深度)'], datasets: [{
      data: [d.b0||0, d.b1_5||0, d.b6_20||0, d.b20p||0],
      backgroundColor: ['rgba(113,113,122,0.6)','rgba(251,191,36,0.7)','rgba(52,211,153,0.7)','rgba(129,140,248,0.8)'],
      hoverBackgroundColor: ['rgba(113,113,122,0.9)','rgba(251,191,36,0.95)','rgba(52,211,153,0.95)','rgba(129,140,248,1)'],
      borderRadius: 4, barPercentage: 0.7,
    }]}, options: { ...baseOpts, indexAxis: 'y', scales: { x: baseOpts.scales.y, y: { ticks: { color: '#a1a1aa', font: { family: fam, size: 11 }, padding: 8 }, grid: { display: false }, border: { display: false } } } } });
  }

  // 版本分布
  const verC = document.getElementById('version-chart');
  if (verC && data.versions && data.versions.length) {
    const pal = ['#818cf8','#34d399','#fbbf24','#fb7185','#38bdf8','#a78bfa','#f472b6','#fb923c'];
    new Chart(verC, { type: 'doughnut', data: { labels: data.versions.map(v=>v.version||'未知'), datasets: [{ data: data.versions.map(v=>v.count), backgroundColor: pal.slice(0,data.versions.length), borderWidth: 0, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: fam, size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8 } }, tooltip: baseOpts.plugins.tooltip } } });
  }

  // 系统分布
  const osC = document.getElementById('os-chart');
  const latest = trends[trends.length - 1] || {};
  const osData = [{label:'Windows',value:latest.win_users||0,color:'#38bdf8'},{label:'macOS',value:latest.mac_users||0,color:'#a78bfa'},{label:'Linux',value:latest.linux_users||0,color:'#fbbf24'}].filter(d=>d.value>0);
  if (osC && osData.length) {
    new Chart(osC, { type: 'doughnut', data: { labels: osData.map(d=>d.label), datasets: [{ data: osData.map(d=>d.value), backgroundColor: osData.map(d=>d.color), borderWidth: 0, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: fam, size: 12 }, usePointStyle: true, pointStyle: 'circle', padding: 12, boxWidth: 8 } }, tooltip: baseOpts.plugins.tooltip } } });
  }
}

async function load() {
  try {
    const data = await fetchData(currentDays, currentOs, currentVer);
    render(data);
  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="error">数据加载失败:' + e.message + '</div>';
  }
}

function syncControls() {
  document.querySelectorAll('#range button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.d,10) === currentDays));
  document.querySelectorAll('#os-seg button').forEach(b => b.classList.toggle('active', b.dataset.os === currentOs));
  populateVersionSelect();
}

// ── 事件绑定 ──
document.getElementById('range').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  currentDays = parseInt(b.dataset.d, 10); writeStateToHash(); syncControls(); reload();
});
document.getElementById('os-seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  currentOs = b.dataset.os; writeStateToHash(); syncControls(); reload();
});
document.getElementById('ver-select').addEventListener('change', e => {
  currentVer = e.target.value; writeStateToHash(); reload();
});
document.getElementById('refresh-btn').addEventListener('click', () => { reload(true); });

function reload(fromBtn) {
  document.getElementById('content').innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading-text">正在加载数据…</div></div>';
  if (fromBtn) {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 700);
  }
  load();
}

readStateFromHash();
syncControls();
load();
// 自动刷新拉长到 2 分钟,降低 D1 读次数;手动刷新按钮随时可用
setInterval(load, 120000);
<\/script>
</body>
</html>`;
