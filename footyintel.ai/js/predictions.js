// ============================================================
//  FootyIntel AI — predictions.js
//  Renders match cards, detail view, and filters
// ============================================================

const Predictions = (() => {

  let _currentMatches = [];
  let _activeLeague   = 'all';

  // ---------- Match Card HTML ----------

  function _buildFormPills(form) {
    return form.map(r => `<span class="form-pill ${r}">${r}</span>`).join('');
  }

  function _confColor(conf) {
    if (conf >= 80) return 'var(--green)';
    if (conf >= 65) return 'var(--gold)';
    return 'var(--muted)';
  }

  function _predClass(type) {
    if (type === 'home') return 'home';
    if (type === 'away') return 'away';
    return 'draw';
  }

  function buildMatchCard(match) {
    const color = _confColor(match.conf);
    return `
      <article class="match-card ${match.aiPick ? 'ai-pick' : ''}" data-id="${match.id}" data-league="${match.league}" role="button" tabindex="0" aria-label="View analysis for ${match.home} vs ${match.away}">
        <div class="mc-header">
          <div class="mc-league">${match.leagueFlag} ${match.leagueName} · ${match.gameweek}</div>
          <div style="display:flex;align-items:center;gap:8px">
            ${match.aiPick ? '<span class="badge badge-green" style="font-size:10px;letter-spacing:.5px">⚡ AI PICK</span>' : ''}
            <span class="mc-time">${match.time}</span>
          </div>
        </div>

        <div class="mc-teams">
          <div class="team-block">
            <span class="team-emoji">${match.homeEmoji}</span>
            <div class="team-name">${match.home}</div>
            <div class="team-form">${_buildFormPills(match.homeForm)}</div>
          </div>
          <div class="vs-block">
            <div class="vs-text">VS</div>
            <div class="mc-venue">🏠 <span class="home">${match.home}</span></div>
          </div>
          <div class="team-block">
            <span class="team-emoji">${match.awayEmoji}</span>
            <div class="team-name">${match.away}</div>
            <div class="team-form">${_buildFormPills(match.awayForm)}</div>
          </div>
        </div>

        <div class="prob-wrap">
          <div class="prob-labels"><span>Home ${match.homeProb}%</span><span>Draw ${match.drawProb}%</span><span>Away ${match.awayProb}%</span></div>
          <div class="prob-bar">
            <div class="prob-seg home" style="width:${match.homeProb}%"></div>
            <div class="prob-seg draw" style="width:${match.drawProb}%"></div>
            <div class="prob-seg away" style="width:${match.awayProb}%"></div>
          </div>
        </div>

        <div class="conf-row">
          <span class="conf-label">AI Confidence</span>
          <div class="conf-bar"><div class="conf-fill" data-target="${match.conf}" style="width:0%;background:${color}"></div></div>
          <span class="conf-val" style="color:${color}">${match.conf}%</span>
        </div>

        <div class="mc-footer">
          <span class="pred-badge ${_predClass(match.predType)}">🎯 ${match.pred}</span>
          <div class="odds-boxes">
            <div class="odd-box"><div class="odd-label">HOME</div><div class="odd-val">${match.odds.home}</div></div>
            <div class="odd-box"><div class="odd-label">DRAW</div><div class="odd-val">${match.odds.draw}</div></div>
            <div class="odd-box"><div class="odd-label">AWAY</div><div class="odd-val">${match.odds.away}</div></div>
          </div>
          <button class="btn btn-ghost btn-sm view-analysis-btn" data-id="${match.id}">Analysis →</button>
        </div>
      </article>`;
  }

  // ---------- Render list ----------

  async function renderMatchList(containerId, leagueId = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = Array(4).fill(0).map(() => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:1.25rem;margin-bottom:12px;overflow:hidden;position:relative">
        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent);animation:shimmer 1.4s infinite;transform:translateX(-100%)"></div>
        <div style="height:12px;width:140px;background:var(--elevated);border-radius:6px;margin-bottom:16px"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="text-align:center">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--elevated);margin:0 auto 8px"></div>
            <div style="height:10px;width:70px;background:var(--elevated);border-radius:4px"></div>
          </div>
          <div style="height:20px;width:30px;background:var(--elevated);border-radius:4px"></div>
          <div style="text-align:center">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--elevated);margin:0 auto 8px"></div>
            <div style="height:10px;width:70px;background:var(--elevated);border-radius:4px"></div>
          </div>
        </div>
        <div style="height:6px;background:var(--elevated);border-radius:3px;margin-bottom:12px"></div>
        <div style="height:10px;width:200px;background:var(--elevated);border-radius:4px"></div>
      </div>`).join('') + `<style>@keyframes shimmer{to{transform:translateX(100%)}}</style>`;

    _currentMatches = await Api.getMatches(leagueId);
    _activeLeague   = leagueId;

    if (!_currentMatches.length) {
      container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted)">No matches found for this league today.</div>`;
      return;
    }

    container.innerHTML = _currentMatches.map(buildMatchCard).join('');

    // Attach click listeners
    container.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', e => {
        const id = parseInt(card.dataset.id);
        openDetail(id);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter') card.click();
      });
    });

    container.querySelectorAll('.view-analysis-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openDetail(parseInt(btn.dataset.id));
      });
    });

    UI.animateConfBars(container);
  }

  // ---------- Filter ----------

  function filterByLeague(leagueId) {
    const cards = document.querySelectorAll('.match-card');
    cards.forEach(card => {
      const show = leagueId === 'all' || card.dataset.league === leagueId;
      card.style.display = show ? 'block' : 'none';
    });
    _activeLeague = leagueId;
  }

  // ---------- Detail View ----------

  async function openDetail(matchId) {
    const match = await Api.getMatchById(matchId);
    if (!match) { UI.showToast('Match not found', 'red'); return; }
    // Store match and navigate to matches.html which handles detail rendering on load
    sessionStorage.setItem('fi_detail_match', JSON.stringify(match));
    // If already on matches.html, show detail directly without redirect
    if (window.location.pathname.includes('matches.html')) {
      if (typeof showDetail === 'function') {
        showDetail(match);
      }
    } else {
      window.location.href = 'pages/matches.html';
    }
  }

  // ---------- Render Detail (called on matches.html) ----------

  function renderDetail(match) {
    // Header
    const headerEl = document.getElementById('detail-header-content');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="detail-match-grid">
          <div class="team-block">
            <span class="detail-team-emoji">${match.homeEmoji}</span>
            <div class="detail-team-name">${match.home}</div>
          </div>
          <div class="detail-vs">VS</div>
          <div class="team-block">
            <span class="detail-team-emoji">${match.awayEmoji}</span>
            <div class="detail-team-name">${match.away}</div>
          </div>
        </div>
        <div class="detail-meta">
          <span class="detail-meta-pill">${match.leagueFlag} ${match.leagueName}</span>
          <span class="detail-meta-pill">🕐 ${match.time}</span>
          <span class="detail-meta-pill">📍 ${match.venue}</span>
          <span class="detail-meta-pill">🏠 <span class="accent">Home: ${match.home}</span></span>
          <span class="detail-meta-pill badge-green">⚡ AI Confidence: ${match.conf}%</span>
        </div>`;
    }

    // Overview tab
    const overviewEl = document.getElementById('tab-overview');
    if (overviewEl) {
      overviewEl.innerHTML = `
        <div class="donut-wrap">
          <svg class="donut-svg" viewBox="0 0 160 160" id="donut-svg" aria-label="Win probability donut chart">
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--elevated)" stroke-width="22"/>
            <circle id="donut-home" cx="80" cy="80" r="60" fill="none" stroke="var(--green)" stroke-width="22" stroke-dasharray="0 377" style="transition:stroke-dasharray 1s ease;transform-origin:center;transform:rotate(-90deg)"/>
            <circle id="donut-draw" cx="80" cy="80" r="60" fill="none" stroke="var(--gold)"  stroke-width="22" stroke-dasharray="0 377" style="transition:stroke-dasharray 1s ease .3s;transform-origin:center;transform:rotate(-90deg)"/>
            <circle id="donut-away" cx="80" cy="80" r="60" fill="none" stroke="var(--red)"   stroke-width="22" stroke-dasharray="0 377" style="transition:stroke-dasharray 1s ease .6s;transform-origin:center;transform:rotate(-90deg)"/>
            <text x="80" y="76" text-anchor="middle" fill="var(--text)" font-family="'Bebas Neue'" font-size="20" letter-spacing="1">${match.homeProb}%</text>
            <text x="80" y="94" text-anchor="middle" fill="var(--muted)" font-size="10">HOME WIN</text>
          </svg>
          <div class="donut-legend">
            <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div><span class="legend-label">${match.home} win</span><span class="legend-pct green">${match.homeProb}%</span></div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--gold)"></div><span class="legend-label">Draw</span><span class="legend-pct gold">${match.drawProb}%</span></div>
            <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div><span class="legend-label">${match.away} win</span><span class="legend-pct red">${match.awayProb}%</span></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
          <div class="card-elevated" style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">BTTS Probability</div><div style="font-size:26px;font-weight:700;color:var(--gold)">${match.btts}%</div></div>
          <div class="card-elevated" style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Over 2.5 Goals</div><div style="font-size:26px;font-weight:700;color:var(--green)">${match.over25}%</div></div>
        </div>
        <div class="ai-box"><strong>AI Analysis:</strong> ${match.reasoning}</div>`;

      setTimeout(() => UI.renderDonut(document.getElementById('donut-svg'), match.homeProb, match.drawProb, match.awayProb), 100);
    }

    // H2H
    const h2hEl = document.getElementById('tab-h2h');
    if (h2hEl) {
      h2hEl.innerHTML = `
        <div class="h2h-list">
          ${match.h2h.map(h => `
            <div class="h2h-row">
              <div class="h2h-badge ${h.result}">${h.result}</div>
              <span class="h2h-teams">${h.teams}</span>
              <span class="h2h-score">${h.score}</span>
              <span class="h2h-date">${h.date}</span>
            </div>`).join('')}
        </div>
        <div class="h2h-summary">${match.h2hSummary}</div>`;
    }

    // Lineup
    const lineupEl = document.getElementById('tab-lineup');
    if (lineupEl) {
      const playerRow = p => `
        <div class="lineup-player">
          <div class="player-num">${p.num}</div>
          <span class="player-name">${p.name}</span>
          <span class="player-pos">${p.pos}</span>
        </div>`;
      lineupEl.innerHTML = `
        <div class="lineup-container">
          <div>
            <div class="lineup-team-title">${match.homeEmoji} ${match.home}</div>
            <div class="lineup-grid">${match.lineupHome.map(playerRow).join('')}</div>
          </div>
          <div>
            <div class="lineup-team-title">${match.awayEmoji} ${match.away}</div>
            <div class="lineup-grid">${match.lineupAway.map(playerRow).join('')}</div>
          </div>
        </div>`;
    }

    // Stats
    const statsEl = document.getElementById('tab-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <table class="stats-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th class="col-home">${match.home}</th>
              <th class="col-avg">League Avg</th>
              <th class="col-away">${match.away}</th>
            </tr>
          </thead>
          <tbody>
            ${match.stats.map(s => `
              <tr>
                <td class="col-stat">${s.label}</td>
                <td class="col-home">${s.home}</td>
                <td class="col-avg">${s.avg}</td>
                <td class="col-away">${s.away}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    }

    // Betslip bar odds
    const betHome = document.getElementById('bet-home-val');
    const betDraw = document.getElementById('bet-draw-val');
    const betAway = document.getElementById('bet-away-val');
    if (betHome) betHome.textContent = match.odds.home;
    if (betDraw) betDraw.textContent = match.odds.draw;
    if (betAway) betAway.textContent = match.odds.away;

    // Bet selection
    document.querySelectorAll('.betslip-bar .odd-box').forEach(box => {
      box.addEventListener('click', () => {
        document.querySelectorAll('.betslip-bar .odd-box').forEach(b => b.classList.remove('selected'));
        box.classList.add('selected');
        const type  = box.dataset.type;
        const oddsV = match.odds[type];
        const label = `${type === 'home' ? match.home : type === 'away' ? match.away : 'Draw'} (${match.home} vs ${match.away})`;
        UI.addToBetslip(match.id, type, oddsV, label);
      });
    });
  }

  // ---------- Sidebar best pick ----------

  async function renderBestPick(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const picks = await Api.getTopPicksToday();
    if (!picks.length) return;
    const top = picks[0];
    el.innerHTML = `
      <div class="best-pick-teams">${top.home} vs ${top.away}</div>
      <div class="best-pick-meta">${top.leagueFlag} ${top.leagueName} · ${top.gameweek} · ${top.time}</div>
      <div class="best-pick-pred">🎯 ${top.pred}</div>
      <div class="flex gap-8" style="align-items:center">
        <span style="font-size:11px;color:var(--muted)">Confidence</span>
        <div class="mini-conf-bar"><div class="mini-conf-fill" style="width:${top.conf}%"></div></div>
        <span style="font-size:11px;font-weight:700;color:var(--green)">${top.conf}%</span>
      </div>`;
  }

  // ---------- Public ----------

  return {
    buildMatchCard,
    renderMatchList,
    filterByLeague,
    openDetail,
    renderDetail,
    renderBestPick,
  };

})();