// ============================================================
//  FootyIntel AI — planGate.js
//  Controls feature access by plan level
//  BASIC=1  PRO=2  PREMIUM=3
// ============================================================

const PlanGate = (() => {

  // ── What each plan can access ──────────────────────────
  const GATES = {
    // Tabs locked for BASIC users (need PRO+)
    proTabs: ['dtab-h2h', 'dtab-lineup', 'dtab-stats', 'dtab-form',
              'dtab-homeaway', 'dtab-squad', 'dtab-manager',
              'dtab-injuries', 'dtab-suspensions', 'dtab-friendlies'],

    // Tabs locked even for PRO (need PREMIUM)
    premiumTabs: [],

    // European leagues locked for BASIC
    proLeagues: ['ucl', 'uel', 'uecl'],

    // Overview sections locked for BASIC
    basicHides: ['btts-box', 'over25-box', 'ai-analysis-box'],
  };

  const LEVELS = { BASIC: 1, PRO: 2, PREMIUM: 3 };

  function _level() {
    const plan = (typeof Auth !== 'undefined' ? Auth.getPlan() : 'BASIC').toUpperCase();
    return LEVELS[plan] || 1;
  }

  function isPro()     { return _level() >= 2; }
  function isPremium() { return _level() >= 3; }
  function plan()      { return Object.keys(LEVELS).find(k => LEVELS[k] === _level()) || 'BASIC'; }

  // ── Lock overlay HTML ───────────────────────────────────
  function _lockHTML(requiredPlan, featureName) {
    const isPrem = requiredPlan === 'PREMIUM';
    const color  = isPrem ? 'var(--gold)' : 'var(--green)';
    const badge  = isPrem ? '⭐ PREMIUM' : '⚡ PRO';
    return `
      <div class="gate-lock" style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:3rem 1.5rem;text-align:center;
        background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);
        min-height:180px;
      ">
        <div style="font-size:36px;margin-bottom:12px">🔒</div>
        <div style="
          display:inline-block;padding:3px 12px;border-radius:20px;
          background:${isPrem?'var(--gold-dim)':'var(--green-dim)'};
          border:1px solid ${isPrem?'rgba(239,159,39,.35)':'var(--green-border)'};
          color:${color};font-size:11px;font-weight:700;letter-spacing:.5px;margin-bottom:10px;
        ">${badge}</div>
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">
          ${featureName} requires ${requiredPlan}
        </div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px;max-width:280px;line-height:1.5">
          Upgrade your plan to unlock this feature and get the full edge.
        </div>
        <button onclick="location.href='pricing.html'" style="
          background:${color};color:#000;border:none;
          padding:9px 22px;border-radius:var(--radius-xl);
          font-size:13px;font-weight:700;cursor:pointer;
          font-family:var(--font-body);transition:opacity .2s;
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          Upgrade Now →
        </button>
      </div>`;
  }

  // ── Lock a tab pane immediately when clicked ────────────
  function applyTabGates() {
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
      const tabId = btn.dataset.tab;
      if (!tabId) return;

      const needsPro     = GATES.proTabs.includes(tabId);
      const needsPremium = GATES.premiumTabs.includes(tabId);

      if ((needsPremium && !isPremium()) || (needsPro && !isPro())) {
        const req = needsPremium ? 'PREMIUM' : 'PRO';
        // Add lock icon to tab button
        if (!btn.querySelector('.tab-lock-icon')) {
          btn.insertAdjacentHTML('beforeend', '<span class="tab-lock-icon" style="margin-left:5px;font-size:10px">🔒</span>');
        }
        btn.addEventListener('click', (e) => {
          // Allow the tab to switch but show lock content
          const pane = document.getElementById(tabId);
          if (pane) {
            const names = {
              'dtab-h2h':          'Head-to-Head History',
              'dtab-lineup':       'Team Lineups',
              'dtab-stats':        'Detailed Stats',
              'dtab-form':         'Form Guide',
              'dtab-homeaway':     'Home/Away Analysis',
              'dtab-squad':        'Squad Info',
              'dtab-manager':      'Manager Analysis',
              'dtab-injuries':     'Injury Report',
              'dtab-suspensions':  'Suspensions',
              'dtab-friendlies':   'Friendlies',
            };
            pane.innerHTML = _lockHTML(req, names[tabId] || tabId);
          }
        }, { capture: true }); // capture so we run before the tab loader
      }
    });
  }

  // ── Lock BTTS / Over2.5 / AI Analysis on match cards ───
  function applyOverviewGates(matchEl) {
    if (isPro()) return; // PRO+ sees everything

    // Blur and overlay BTTS + Over 2.5 boxes
    matchEl.querySelectorAll('[data-gate="pro"]').forEach(el => {
      el.style.position   = 'relative';
      el.style.userSelect = 'none';
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:absolute;inset:0;backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);
        background:rgba(13,13,13,.6);
        border-radius:inherit;
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;z-index:2;
      `;
      overlay.innerHTML = `<span style="font-size:18px">🔒</span>`;
      overlay.addEventListener('click', e => {
        e.stopPropagation();
        location.href = 'pricing.html';
      });
      el.appendChild(overlay);
    });
  }

  // ── Block European leagues for BASIC ───────────────────
  function applyLeagueGates() {
    if (isPro()) return;
    document.querySelectorAll('.league-filter-btn').forEach(btn => {
      const league = btn.dataset.league;
      if (GATES.proLeagues.includes(league)) {
        if (!btn.querySelector('.tab-lock-icon')) {
          btn.insertAdjacentHTML('beforeend', '<span class="tab-lock-icon" style="margin-left:4px;font-size:10px">🔒</span>');
        }
        btn.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          _showUpgradeToast('European leagues require PRO');
          return false;
        }, { capture: true });
      }
    });
  }

  // ── Show a non-intrusive toast ──────────────────────────
  function _showUpgradeToast(msg) {
    const existing = document.getElementById('gate-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gate-toast';
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:var(--card);border:1px solid var(--green-border);
      color:var(--text);padding:12px 20px;border-radius:var(--radius-xl);
      font-size:13px;font-weight:500;z-index:9999;
      display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 32px rgba(0,0,0,.4);
      animation:toastIn .25s ease;
    `;
    toast.innerHTML = `
      <span>🔒 ${msg}</span>
      <button onclick="location.href='pricing.html'" style="
        background:var(--green);color:#000;border:none;
        padding:5px 14px;border-radius:var(--radius-xl);
        font-size:12px;font-weight:700;cursor:pointer;
        font-family:var(--font-body);
      ">Upgrade</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity .3s'; setTimeout(()=>toast.remove(), 300); }, 3500);
  }

  // ── Show plan banner at top of page ────────────────────
  function showPlanBanner() {
    if (isPro()) return; // no banner for PRO+
    const banner = document.createElement('div');
    banner.id = 'plan-banner';
    banner.style.cssText = `
      background:linear-gradient(90deg,var(--green-dim),rgba(29,158,117,.08));
      border-bottom:1px solid var(--green-border);
      padding:10px 5%;
      display:flex;align-items:center;justify-content:space-between;
      gap:12px;flex-wrap:wrap;
      font-size:13px;
      position:sticky;top:var(--nav-h);z-index:90;
    `;
    banner.innerHTML = `
      <span style="color:var(--text)">
        ⚡ You're on the <strong>BASIC</strong> plan — H2H, Lineups, BTTS &amp; European leagues are locked.
      </span>
      <button onclick="location.href='pricing.html'" style="
        background:var(--green);color:#000;border:none;
        padding:6px 16px;border-radius:var(--radius-xl);
        font-size:12px;font-weight:700;cursor:pointer;
        font-family:var(--font-body);white-space:nowrap;
      ">Upgrade to PRO →</button>
    `;
    // Insert after nav
    const nav = document.querySelector('nav');
    if (nav && nav.nextSibling) {
      nav.parentNode.insertBefore(banner, nav.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  // ── Init — call once on page load ──────────────────────
  function init() {
    applyLeagueGates();
    showPlanBanner();
    // Tab gates applied when detail view opens (called from showDetail)
  }

  return {
    init,
    isPro,
    isPremium,
    plan,
    applyTabGates,
    applyOverviewGates,
    applyLeagueGates,
  };

})();
