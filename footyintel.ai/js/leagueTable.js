// ============================================================
//  FootyIntel AI — leagueTable.js  (v6)
//  API-Football standings work for ALL seasons on free plan.
//  Pass year only (2024) not full "2024-2025" string.
// ============================================================

const LeagueTable = (() => {

  const ZONES = {
    epl:    { cl: 4, el: 6, ecl: 7, rel: 18 },
    laliga: { cl: 4, el: 6, ecl: 7, rel: 18 },
    serie:  { cl: 4, el: 6, ecl: 7, rel: 18 },
    bund:   { cl: 4, el: 6, ecl: 7, rel: 16 },
    ligue:  { cl: 3, el: 5, ecl: 6, rel: 17 },
  };

  function _pill(r) {
    const c = {
      W: { bg: 'rgba(29,158,117,.22)', br: 'rgba(29,158,117,.45)', col: '#1D9E75' },
      D: { bg: 'rgba(239,159,39,.18)', br: 'rgba(239,159,39,.4)',  col: '#EF9F27' },
      L: { bg: 'rgba(226,75,74,.18)',  br: 'rgba(226,75,74,.4)',   col: '#f87171' },
    }[r] || { bg: 'var(--elevated)', br: 'var(--border)', col: 'var(--muted)' };
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;background:${c.bg};border:1px solid ${c.br};color:${c.col};font-size:9px;font-weight:800">${r}</span>`;
  }

  function _pos(pos, lid) {
    const z = ZONES[lid] || ZONES.epl;
    if (pos <= z.cl)  return 'background:rgba(29,158,117,.15);color:#1D9E75;font-weight:700;';
    if (pos <= z.el)  return 'background:rgba(239,159,39,.12);color:#EF9F27;font-weight:700;';
    if (pos <= z.ecl) return 'background:rgba(99,179,237,.12);color:#63b3ed;font-weight:700;';
    if (pos >= z.rel) return 'background:rgba(226,75,74,.12);color:#f87171;font-weight:700;';
    return 'color:var(--muted);';
  }

  async function render(containerId, leagueId, season) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted)">
      <div style="display:inline-block;width:22px;height:22px;border:2px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite"></div>
      <div style="margin-top:.75rem;font-size:12px">Loading standings…</div>
    </div>`;

    let rows = [];
    let errorMsg = null;
    try {
      rows = await Api.getStandings(leagueId, season);
    } catch (err) {
      errorMsg = err.message;
    }

    if (errorMsg || !rows?.length) {
      el.innerHTML = `<div style="text-align:center;padding:3rem">
        <div style="font-size:2.2rem;margin-bottom:.75rem">⚠️</div>
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:.5rem">Could not load standings</div>
        <div style="font-size:12px;color:var(--muted);max-width:320px;margin:0 auto;line-height:1.7">
          ${errorMsg || 'No data available for this league and season.'}
          <br><br>
          <span style="color:var(--muted2)">Check your API key in js/apiFootball.js or try a different season.</span>
        </div>
      </div>`;
      return;
    }

    const mob = window.innerWidth <= 600;
    const seasonLabel = season ? season.replace('-', '/') : 'Current';

    el.innerHTML = `
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:${mob ? '400px' : '520px'}">
          <thead><tr style="border-bottom:2px solid var(--border)">
            <th style="padding:9px 6px;text-align:left;width:30px;color:var(--muted);font-size:10px;font-weight:600">#</th>
            <th style="padding:9px 8px;text-align:left;color:var(--muted);font-size:10px;font-weight:600">CLUB</th>
            <th style="padding:9px 5px;text-align:center;color:var(--muted);font-size:10px;font-weight:600" title="Played">P</th>
            <th style="padding:9px 5px;text-align:center;color:var(--green);font-size:10px;font-weight:600" title="Won">W</th>
            <th style="padding:9px 5px;text-align:center;color:#EF9F27;font-size:10px;font-weight:600" title="Drawn">D</th>
            <th style="padding:9px 5px;text-align:center;color:#f87171;font-size:10px;font-weight:600" title="Lost">L</th>
            <th style="padding:9px 5px;text-align:center;color:var(--muted);font-size:10px;font-weight:600" title="Goals For">GF</th>
            <th style="padding:9px 5px;text-align:center;color:var(--muted);font-size:10px;font-weight:600" title="Goals Against">GA</th>
            <th style="padding:9px 5px;text-align:center;color:var(--muted);font-size:10px;font-weight:600" title="Goal Difference">GD</th>
            <th style="padding:9px 8px;text-align:center;color:var(--text);font-size:11px;font-weight:700" title="Points">Pts</th>
            ${!mob ? '<th style="padding:9px 8px;text-align:center;color:var(--muted);font-size:10px;font-weight:600">Form</th>' : ''}
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr style="border-bottom:1px solid rgba(255,255,255,.03);cursor:default"
                  onmouseover="this.style.background='rgba(255,255,255,.035)'"
                  onmouseout="this.style.background=''">
                <td style="padding:9px 6px"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;font-size:10px;${_pos(r.position, leagueId)}">${r.position}</span></td>
                <td style="padding:9px 8px"><div style="display:flex;align-items:center;gap:8px">
                  ${r.crest ? `<img src="${r.crest}" width="18" height="18" style="object-fit:contain;flex-shrink:0" onerror="this.style.display='none'" loading="lazy">` : '<span style="width:18px;text-align:center;font-size:12px">⚽</span>'}
                  <span style="font-weight:600;color:var(--text)">${r.team}</span>
                </div></td>
                <td style="padding:9px 5px;text-align:center;color:var(--muted)">${r.played}</td>
                <td style="padding:9px 5px;text-align:center;color:var(--green);font-weight:600">${r.won}</td>
                <td style="padding:9px 5px;text-align:center;color:#EF9F27">${r.draw}</td>
                <td style="padding:9px 5px;text-align:center;color:#f87171">${r.lost}</td>
                <td style="padding:9px 5px;text-align:center;color:var(--muted)">${r.goalsFor}</td>
                <td style="padding:9px 5px;text-align:center;color:var(--muted)">${r.goalsAgainst}</td>
                <td style="padding:9px 5px;text-align:center;font-weight:600;color:${r.goalDiff > 0 ? 'var(--green)' : r.goalDiff < 0 ? '#f87171' : 'var(--muted)'}">${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}</td>
                <td style="padding:9px 8px;text-align:center;font-weight:800;font-size:15px;color:var(--text)">${r.points}</td>
                ${!mob ? `<td style="padding:9px 8px"><div style="display:flex;gap:3px;justify-content:center">${(r.form || []).slice(-5).map(_pill).join('')}</div></td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="display:flex;gap:14px;padding:10px 8px 6px;font-size:10px;color:var(--muted);flex-wrap:wrap">
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(29,158,117,.3);margin-right:4px;vertical-align:middle"></span>UCL</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(239,159,39,.25);margin-right:4px;vertical-align:middle"></span>UEL</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(99,179,237,.2);margin-right:4px;vertical-align:middle"></span>UECL</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:rgba(226,75,74,.2);margin-right:4px;vertical-align:middle"></span>Relegation</span>
        </div>
        <div style="padding:4px 8px 2px;font-size:10px;color:var(--muted2);text-align:right">
          ${seasonLabel} · API-Football · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>`;
  }

  return { render };
})();
