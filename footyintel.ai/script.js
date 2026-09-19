// ============================================================
//  FootyIntel AI — script.js  (homepage only)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ── Hamburger nav ──────────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // ── League chips ───────────────────────────────────────────
  const chipsEl = document.getElementById('league-chips');
  if (chipsEl && typeof LEAGUES !== 'undefined') {
    LEAGUES.filter(l => l.id !== 'all').forEach(l => {
      const chip = document.createElement('div');
      chip.className = 'filter-chip';
      chip.innerHTML = `<span>${l.flag}</span> ${l.name}`;
      chip.addEventListener('click', () => {
        sessionStorage.setItem('fi_league', l.id);
        location.href = 'pages/matches.html';
      });
      chipsEl.appendChild(chip);
    });
  }

  // ── Live ticker ────────────────────────────────────────────
  const tickerEl = document.getElementById('ticker-wrap');
  if (tickerEl && typeof TICKER_SCORES !== 'undefined') {
    const items = [...TICKER_SCORES, ...TICKER_SCORES].map(s => `
      <div class="ticker-item">
        <span class="ticker-team">${s.home}</span>
        <span class="ticker-score">${s.score}</span>
        <span class="ticker-team">${s.away}</span>
        ${s.status === 'LIVE'
          ? `<span class="ticker-live">LIVE</span><span class="ticker-time">${s.time}</span>`
          : `<span class="ticker-ft">FT</span>`}
      </div>`).join('');
    tickerEl.innerHTML = `<div class="ticker-track">${items}</div>`;
  }

  // ── Animated counters ──────────────────────────────────────
  if (typeof UI !== 'undefined') {
    UI.animateCounter(document.getElementById('acc-counter'),  87,     '%');
    UI.animateCounter(document.getElementById('pred-counter'), 12847,  '+');
  }

  // ── Greeting (if element exists) ──────────────────────────
  const greeting = document.getElementById('greeting');
  if (greeting) {
    const h = new Date().getHours();
    greeting.textContent = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  }

});
