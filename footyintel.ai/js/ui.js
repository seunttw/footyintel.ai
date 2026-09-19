// ============================================================
//  FootyIntel AI — ui.js
//  Reusable DOM helpers, animations, toast, tabs, donut chart
// =======================================
const UI = (() => {

  // ---------- Toast ----------

  let _toastTimer = null;

  function showToast(msg, type = 'green') {
    let toast = document.getElementById('fi-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fi-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.borderColor = type === 'gold' ? 'rgba(239,159,39,.5)'
                           : type === 'red'  ? 'rgba(226,75,74,.5)'
                           :                   'rgba(29,158,117,.5)';
    toast.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ---------- Loading spinner ----------

  function setLoading(el, state) {
    if (!el) return;
    if (state) {
      el.dataset.origText = el.textContent;
      el.disabled = true;
      el.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite"></span>';
    } else {
      el.disabled = false;
      el.textContent = el.dataset.origText || el.textContent;
    }
  }

  // ---------- Tabs ----------

  function initTabs(tabsSelector, panesSelector, onChange) {
    const tabs  = document.querySelectorAll(tabsSelector);
    const panes = document.querySelectorAll(panesSelector);

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t  => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add('active');
        if (typeof onChange === 'function') onChange(tab.dataset.tab);
      });
    });
  }

  // ---------- Confidence bar animation ----------

  function animateConfBars(scope = document) {
    const bars = scope.querySelectorAll('.conf-fill[data-target]');
    requestAnimationFrame(() => {
      bars.forEach(bar => {
        bar.style.width = '0%';
        setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 200);
      });
    });
  }

  // ---------- Counter animation ----------

  function animateCounter(el, target, suffix = '', duration = 1200) {
    if (!el) return;
    const start = performance.now();
    const startVal = 0;
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(startVal + ease * (target - startVal)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- Donut chart (SVG) ----------

  function renderDonut(svgEl, homeP, drawP, awayP) {
    if (!svgEl) return;
    const r    = 60;
    const circ = 2 * Math.PI * r;

    const homeArc = (homeP / 100) * circ;
    const drawArc = (drawP / 100) * circ;
    const awayArc = (awayP / 100) * circ;

    const homeCirc = svgEl.querySelector('#donut-home');
    const drawCirc = svgEl.querySelector('#donut-draw');
    const awayCirc = svgEl.querySelector('#donut-away');

    // reset then animate
    [homeCirc, drawCirc, awayCirc].forEach(c => {
      if (c) c.style.strokeDasharray = `0 ${circ}`;
    });

    setTimeout(() => {
      if (homeCirc) {
        homeCirc.style.strokeDasharray = `${homeArc} ${circ}`;
        homeCirc.style.strokeDashoffset = '94';
      }
      if (drawCirc) {
        drawCirc.style.strokeDasharray = `${drawArc} ${circ}`;
        drawCirc.style.strokeDashoffset = String(94 - homeArc);
      }
      if (awayCirc) {
        awayCirc.style.strokeDasharray = `${awayArc} ${circ}`;
        awayCirc.style.strokeDashoffset = String(94 - homeArc - drawArc);
      }
    }, 120);
  }

  // ---------- FAQ accordion ----------

  function initFaq(selector = '.faq-item') {
    document.querySelectorAll(selector).forEach(item => {
      item.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll(selector).forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  // ---------- Betslip bar ----------

  const betslip = { selections: [] };

  function addToBetslip(matchId, betType, odds, label) {
    const existing = betslip.selections.findIndex(s => s.matchId === matchId);
    if (existing > -1) betslip.selections.splice(existing, 1);
    betslip.selections.push({ matchId, betType, odds, label });
    _renderBetslipBar();
    showToast(`✅ Added: ${label} @ ${odds}`);
  }

  function removeFromBetslip(matchId) {
    betslip.selections = betslip.selections.filter(s => s.matchId !== matchId);
    _renderBetslipBar();
  }

  function _renderBetslipBar() {
    const bar = document.getElementById('betslip-bar');
    if (!bar) return;
    if (betslip.selections.length === 0) {
      bar.classList.remove('visible');
      return;
    }
    bar.classList.add('visible');
    const totalOdds = betslip.selections.reduce((acc, s) => acc * s.odds, 1).toFixed(2);
    const slipEl = bar.querySelector('#betslip-slots');
    if (slipEl) {
      slipEl.innerHTML = betslip.selections.map(s => `
        <span style="display:inline-flex;align-items:center;gap:8px;background:var(--elevated);padding:5px 12px;border-radius:20px;font-size:12px;border:1px solid var(--border)">
          ${s.label} <strong style="color:var(--gold)">${s.odds}</strong>
          <button onclick="UI.removeFromBetslip(${s.matchId})" style="background:none;border:none;color:var(--muted2);font-size:15px;line-height:1;cursor:pointer" title="Remove">&times;</button>
        </span>
      `).join('');
    }
    const totalEl = bar.querySelector('#betslip-total');
    if (totalEl) totalEl.textContent = `Total odds: ${totalOdds}`;
  }

  // ---------- Navbar active link ----------

  function setActiveNavLink(page) {
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });
  }

  // ---------- Scroll to top ----------

  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ---------- Public ----------

  return {
    showToast,
    setLoading,
    initTabs,
    animateConfBars,
    animateCounter,
    renderDonut,
    initFaq,
    addToBetslip,
    removeFromBetslip,
    setActiveNavLink,
    scrollTop,
  };

})();