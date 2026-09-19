// ============================================================
//  FootyIntel AI — footballApi.js  (v8 — Definitive)
//
//  API TRUTH TABLE (what actually works for free in browser):
//
//  API-Football  (key: eec767bad597f40533403e9166be3257)
//    ✅ /standings?league=X&season=YYYY   — ALL seasons (year only, e.g. 2024)
//    ✅ /fixtures?status=NS               — upcoming, current season
//    ✅ /fixtures?status=FT&last=N        — recent results, current season
//    ✅ /fixtures/headtohead              — H2H
//    ✅ /fixtures/lineups                 — lineups
//    ✅ /fixtures?live=all               — live
//    ✅ PAST seasons standings            — YES works free (season=2023, 2022 etc)
//    ❌ Past season fixtures              — empty on free plan
//
//  TheSportsDB  (free, key=3)
//    ✅ eventsseason.php?id=X&s=YYYY-YYYY — past match results, ALL seasons
//    ✅ eventsnextleague.php?id=X         — next 15 upcoming per league
//    ✅ eventsround.php?id=X&r=N&s=YYYY-YYYY — by round, fallback
//    ✅ lookupteam.php / lookup_all_players.php — squad info
//    ❌ lookuptable.php                   — needs paid Patreon key
//
//  STRATEGY:
//    STANDINGS   → API-Football (works for ALL seasons, use YYYY year)
//    RESULTS     → TheSportsDB eventsseason (free, all seasons)
//    FIXTURES    → API-Football NS (current) + TSDB eventsnextleague fallback
//    LIVE        → API-Football
//    H2H/LINEUPS → API-Football
// ============================================================

const FD_LEAGUE_MAP = {
  epl:    { afId: 39,  tsdbId: '4328', name: 'Premier League',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rounds: 38 },
  laliga: { afId: 140, tsdbId: '4335', name: 'La Liga',          flag: '🇪🇸',        rounds: 38 },
  serie:  { afId: 135, tsdbId: '4332', name: 'Serie A',          flag: '🇮🇹',        rounds: 38 },
  bund:   { afId: 78,  tsdbId: '4331', name: 'Bundesliga',       flag: '🇩🇪',        rounds: 34 },
  ligue:  { afId: 61,  tsdbId: '4334', name: 'Ligue 1',          flag: '🇫🇷',        rounds: 34 },
  ucl:    { afId: 2,   tsdbId: '4480', name: 'Champions League', flag: '⭐',         rounds: 8  },
  uel:    { afId: 3,   tsdbId: '4481', name: 'Europa League',    flag: '🟠',         rounds: 8  },
};

// Convert "2024-2025" → 2024  or  "2025" → 2025
function _seasonYear(s) {
  if (!s) return _curYear();
  const str = String(s);
  return parseInt(str.split('-')[0]);
}
function _curYear() {
  const d = new Date();
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}
function _curSeason() {
  const y = _curYear();
  return `${y}-${y + 1}`;
}

const ALL_SEASONS = [
  '2025-2026','2024-2025','2023-2024','2022-2023','2021-2022','2020-2021',
  '2019-2020','2018-2019','2017-2018','2016-2017','2015-2016','2014-2015',
  '2013-2014','2012-2013','2011-2012','2010-2011',
];

// ── TheSportsDB (free) ──────────────────────────────────────────
const _TSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const _tsdbCache = {};
async function _tsdb(path) {
  if (_tsdbCache[path] && Date.now() - _tsdbCache[path].ts < 30 * 60 * 1000) return _tsdbCache[path].d;
  const r = await fetch(_TSDB + path);
  if (!r.ok) throw new Error(`TSDB_${r.status}`);
  const j = await r.json();
  _tsdbCache[path] = { ts: Date.now(), d: j };
  return j;
}

// ── API-Football ────────────────────────────────────────────────
async function _afGet(path) {
  try { return await _af(path) || []; }
  catch (e) { console.warn('[FA]', path, e.message); return []; }
}

// ── Helpers ─────────────────────────────────────────────────────
function _fmtDate(s) {
  return s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
const _EMO = {
  'Arsenal': '🔴','Chelsea': '🔵','Liverpool': '🔴','Manchester City': '🔵',
  'Manchester United': '🔴','Tottenham': '⚪','Newcastle': '⚫','Aston Villa': '🟣',
  'West Ham': '🔵','Brighton': '🔵','Everton': '🔵','Real Madrid': '⚪',
  'Barcelona': '🔵','Atletico Madrid': '🔴','Inter': '⚫','AC Milan': '🔴',
  'Juventus': '⚫','Napoli': '🔵','Roma': '🟡','Bayern Munich': '🔴',
  'Borussia Dortmund': '🟡','Bayer Leverkusen': '⚫','Paris Saint Germain': '🔵',
  'Paris Saint-Germain': '🔵','Marseille': '🔵','Monaco': '🟢',
};
function _emo(n) {
  if (!n) return '⚽';
  const k = Object.keys(_EMO).find(k => n.toLowerCase().includes(k.toLowerCase()));
  return k ? _EMO[k] : '⚽';
}

// ── xG / prediction math ────────────────────────────────────────
function _poi(k, l) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
function _probs(hx, ax) {
  let hw = 0, d = 0, aw = 0;
  for (let h = 0; h <= 8; h++) for (let a = 0; a <= 8; a++) {
    const p = _poi(h, hx) * _poi(a, ax);
    if (h > a) hw += p; else if (h === a) d += p; else aw += p;
  }
  const t = hw + d + aw;
  return { hp: Math.round(hw / t * 100), dp: Math.round(d / t * 100), ap: Math.round(aw / t * 100) };
}
function _btts(h, a) { return Math.round((1 - Math.exp(-h)) * (1 - Math.exp(-a)) * 100); }
function _o25(h, a) { const l = h + a; return Math.round((1 - _poi(0, l) - _poi(1, l) - _poi(2, l)) * 100); }

function _statsFrom(rows) {
  const m = {};
  (rows || []).forEach(r => {
    const pg = r.played || 1;
    m[r.team] = { gpg: (r.goalsFor || 0) / pg, gapg: (r.goalsAgainst || 0) / pg, form: r.form || [] };
  });
  return m;
}

function _predict(hName, aName, sm, lk, meta, base) {
  const hs = sm[hName] || { gpg: 1.4, gapg: 1.2, form: [] };
  const as = sm[aName] || { gpg: 1.2, gapg: 1.4, form: [] };
  const hx = (hs.gpg + as.gapg) / 2, ax = (as.gpg + hs.gapg) / 2;
  const { hp, dp, ap } = _probs(hx, ax);
  const conf = Math.min(95, Math.round(50 + (Math.max(hp, dp, ap) - 33) * 1.5));
  const btts = _btts(hx, ax), o25 = _o25(hx, ax);
  const m = 1.10;
  let pt, pred;
  if (hp >= ap && hp >= dp) { pt = 'home'; pred = `${hName} to Win`; }
  else if (ap >= hp && ap >= dp) { pt = 'away'; pred = `${aName} to Win`; }
  else { pt = 'draw'; pred = 'Draw'; }
  return {
    ...base, league: lk, leagueName: meta.name, leagueFlag: meta.flag,
    home: hName, homeEmoji: _emo(hName), homeForm: hs.form,
    away: aName, awayEmoji: _emo(aName), awayForm: as.form,
    homeProb: hp, drawProb: dp, awayProb: ap, pred, predType: pt, conf, btts, over25: o25,
    aiPick: conf >= 78,
    odds: { home: +((1 / (hp / 100)) * m).toFixed(2), draw: +((1 / (dp / 100)) * m).toFixed(2), away: +((1 / (ap / 100)) * m).toFixed(2) },
    reasoning: `<strong>${hName}</strong> avg ${hx.toFixed(1)} xG · <strong>${aName}</strong> avg ${ax.toFixed(1)} xG · BTTS ${btts}% · O2.5 ${o25}%`,
    stats: [
      { label: 'Avg goals scored',   home: hs.gpg.toFixed(1), avg: '—', away: as.gpg.toFixed(1) },
      { label: 'Avg goals conceded', home: hs.gapg.toFixed(1), avg: '—', away: as.gapg.toFixed(1) },
      { label: 'xG this match',      home: hx.toFixed(2), avg: '—', away: ax.toFixed(2) },
      { label: 'BTTS %',             home: `${btts}%`, avg: '—', away: `${btts}%` },
      { label: 'Over 2.5 goals %',   home: `${o25}%`, avg: '—', away: `${o25}%` },
    ],
    h2h: [], lineupHome: [], lineupAway: [],
  };
}

function _fromTSDB(ev, lk, meta, sm = {}) {
  const hn = ev.strHomeTeam || 'Home', an = ev.strAwayTeam || 'Away';
  const hgRaw = ev.intHomeScore, agRaw = ev.intAwayScore;
  const hg = (hgRaw !== null && hgRaw !== '' && hgRaw !== undefined && hgRaw !== 'null') ? parseInt(hgRaw) : null;
  const ag = (agRaw !== null && agRaw !== '' && agRaw !== undefined && agRaw !== 'null') ? parseInt(agRaw) : null;
  const isFT = hg !== null && ag !== null;
  const utcDate = ev.strTimestamp || (ev.dateEvent ? `${ev.dateEvent}T${ev.strTime || '15:00:00'}Z` : null);
  return _predict(hn, an, sm, lk, meta, {
    id: ev.idEvent, fdId: ev.idEvent,
    gameweek: ev.intRound ? `Round ${ev.intRound}` : 'Match',
    time: ev.strTime ? ev.strTime.slice(0, 5) + ' GMT' : '—', utcDate,
    venue: ev.strVenue || '', status: isFT ? 'FT' : 'NS', isFT, isLive: false,
    score: isFT ? `${hg}–${ag}` : null,
    homeId: ev.idHomeTeam, awayId: ev.idAwayTeam,
    homeCrest: ev.strHomeTeamBadge || null, awayCrest: ev.strAwayTeamBadge || null,
  });
}

function _fromAF(f, lk, meta, sm = {}) {
  const hn = f.teams?.home?.name || 'Home', an = f.teams?.away?.name || 'Away';
  const hg = f.goals?.home, ag = f.goals?.away;
  const isFT = hg != null && ag != null;
  const st = f.fixture?.status?.short || 'NS';
  const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(st);
  const utcDate = f.fixture?.date || null;
  const d = utcDate ? new Date(utcDate) : null;
  return _predict(hn, an, sm, lk, meta, {
    id: f.fixture?.id, fdId: f.fixture?.id,
    gameweek: f.league?.round ? f.league.round.replace('Regular Season - ', 'Round ') : 'Match',
    time: d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT' : '—', utcDate,
    venue: f.fixture?.venue?.name || '', status: isFT && !isLive ? 'FT' : isLive ? 'LIVE' : 'NS',
    isFT, isLive, score: isFT ? `${hg}–${ag}` : null,
    liveMinute: f.fixture?.status?.elapsed ? `${f.fixture.status.elapsed}'` : null,
    homeId: f.teams?.home?.id, awayId: f.teams?.away?.id,
    homeCrest: f.teams?.home?.logo || null, awayCrest: f.teams?.away?.logo || null,
  });
}

// ════════════════════════════════════════════════════════════════
const FootballApi = (() => {

  const _stCache = {};

  // ── STANDINGS — API-Football works for ALL seasons ─────────────
  // KEY: Use just the year (2024) not "2024-2025". Free plan supports all seasons.
  async function getStandings(lk, season) {
    const meta = FD_LEAGUE_MAP[lk];
    if (!meta) throw new Error(`Unknown league: ${lk}`);
    const yr = _seasonYear(season);
    const ck = `${lk}:${yr}`;
    if (_stCache[ck]) return _stCache[ck];

    const data = await _afGet(`/standings?league=${meta.afId}&season=${yr}`);
    if (!data.length) throw new Error(`No standings data for ${lk} ${yr}`);

    const rows = data[0]?.league?.standings?.[0] || [];
    if (!rows.length) throw new Error(`Empty standings for ${lk} ${yr}`);

    const result = rows.map(r => ({
      position: r.rank, team: r.team?.name || '—', teamId: r.team?.id,
      crest: r.team?.logo || null, played: r.all?.played || 0,
      won: r.all?.win || 0, draw: r.all?.draw || 0, lost: r.all?.lose || 0,
      goalsFor: r.all?.goals?.for || 0, goalsAgainst: r.all?.goals?.against || 0,
      goalDiff: r.goalsDiff || 0, points: r.points || 0,
      form: (r.form || '').slice(-5).split('').filter(Boolean),
    }));
    _stCache[ck] = result;
    return result;
  }

  // ── RESULTS — TheSportsDB eventsseason (all seasons, free) ──────
  async function getResults(lk, season) {
    const leagues = lk === 'all'
      ? Object.entries(FD_LEAGUE_MAP).filter(([k]) => !['ucl', 'uel'].includes(k))
      : [[lk, FD_LEAGUE_MAP[lk]]].filter(([, v]) => v);
    const s = season || _curSeason();
    const out = [];

    for (const [key, meta] of leagues) {
      try {
        let events = [];

        // Primary: eventsseason.php — one call, all results for the season
        try {
          const d = await _tsdb(`/eventsseason.php?id=${meta.tsdbId}&s=${s}`);
          if (d.events?.length > 0) events = d.events;
        } catch (e) {
          console.warn('[FA] eventsseason failed:', key, e.message);
        }

        // Fallback: round-by-round if season endpoint returned nothing
        if (events.length < 3) {
          const rounds = meta.rounds || 38;
          const batchSize = 6;
          for (let i = 1; i <= rounds && events.length < 10; i += batchSize) {
            const batch = [];
            for (let r = i; r < i + batchSize && r <= rounds; r++) {
              batch.push(
                _tsdb(`/eventsround.php?id=${meta.tsdbId}&r=${r}&s=${s}`)
                  .then(d => { if (d?.events) events.push(...d.events); })
                  .catch(() => {})
              );
            }
            await Promise.all(batch);
          }
        }

        const finished = events.filter(ev => {
          const sc = ev.intHomeScore;
          return sc !== null && sc !== '' && sc !== undefined && sc !== 'null';
        });

        // Try to get standings for this season to power predictions
        let sm = {};
        try { const st = await getStandings(key, s); sm = _statsFrom(st); } catch (e) {}

        finished.sort((a, b) => new Date(b.dateEvent) - new Date(a.dateEvent));
        out.push(...finished.map(ev => _fromTSDB(ev, key, meta, sm)));
      } catch (err) {
        console.warn('[FA] results', key, err.message);
      }
    }
    out.sort((a, b) => new Date(b.utcDate || 0) - new Date(a.utcDate || 0));
    return out;
  }

  // ── FIXTURES — API-Football upcoming + TSDB fallback ───────────
  async function getFixtures(lk) {
    const leagues = lk === 'all'
      ? Object.entries(FD_LEAGUE_MAP)
      : [[lk, FD_LEAGUE_MAP[lk]]].filter(([, v]) => v);
    const today = new Date().toISOString().slice(0, 10);
    const ahead = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const yr = _curYear();
    const out = [];

    for (const [key, meta] of leagues) {
      try {
        let sm = {};
        try { const st = await getStandings(key); sm = _statsFrom(st); } catch (e) {}

        // API-Football for upcoming fixtures
        const fixes = await _afGet(`/fixtures?league=${meta.afId}&season=${yr}&from=${today}&to=${ahead}&status=NS`);
        if (fixes.length) { out.push(...fixes.map(f => _fromAF(f, key, meta, sm))); continue; }

        // Fallback: TheSportsDB next events
        try {
          const d = await _tsdb(`/eventsnextleague.php?id=${meta.tsdbId}`);
          const evs = (d.events || []).filter(ev => ev.dateEvent >= today && ev.dateEvent <= ahead);
          out.push(...evs.map(ev => _fromTSDB(ev, key, meta, sm)));
        } catch (e) {}
      } catch (err) {
        console.warn('[FA] fixtures', key, err.message);
      }
    }
    out.sort((a, b) => new Date(a.utcDate || 0) - new Date(b.utcDate || 0));
    return out;
  }

  // ── LIVE ────────────────────────────────────────────────────────
  async function getLiveScores() {
    try {
      const d = await _afGet('/fixtures?live=all');
      return (d || []).slice(0, 8).map(f => ({
        home: f.teams?.home?.name || '?', away: f.teams?.away?.name || '?',
        score: `${f.goals?.home ?? '?'}–${f.goals?.away ?? '?'}`,
        status: 'LIVE', time: f.fixture?.status?.elapsed ? `${f.fixture.status.elapsed}'` : '',
      }));
    } catch (e) { return []; }
  }

  // ── H2H ──────────────────────────────────────────────────────────
  async function getH2H(matchId) {
    try {
      const fx = await _afGet(`/fixtures?id=${matchId}`);
      const f = fx?.[0]; if (!f) return { matches: [], aggregates: {} };
      const hId = f.teams?.home?.id, aId = f.teams?.away?.id;
      const h2h = await _afGet(`/fixtures/headtohead?h2h=${hId}-${aId}&last=10`);
      return {
        matches: (h2h || []).map(m => {
          const hg = m.goals?.home, ag = m.goals?.away;
          const homeIsOurs = m.teams?.home?.id === hId;
          return {
            result: hg > ag ? (homeIsOurs ? 'W' : 'L') : hg < ag ? (homeIsOurs ? 'L' : 'W') : 'D',
            teams: `${m.teams?.home?.name} vs ${m.teams?.away?.name}`,
            score: `${hg ?? '?'}–${ag ?? '?'}`, date: _fmtDate(m.fixture?.date),
            competition: m.league?.name || '—',
          };
        }), aggregates: {},
      };
    } catch (e) { return { matches: [], aggregates: {} }; }
  }

  // ── LINEUPS ──────────────────────────────────────────────────────
  async function getLineups(matchId) {
    const empty = { home: [], away: [], homeSubs: [], awaySubs: [], homeFormation: '—', awayFormation: '—', referees: '—' };
    try {
      const d = await _afGet(`/fixtures/lineups?fixture=${matchId}`);
      if (!d || d.length < 2) return empty;
      const [h, a] = d;
      const fmt = (p, i) => ({ num: p.player?.number || i + 1, name: p.player?.name || '?', pos: p.player?.pos || '?' });
      return {
        home: (h.startXI || []).map(fmt), away: (a.startXI || []).map(fmt),
        homeSubs: (h.substitutes || []).map(fmt), awaySubs: (a.substitutes || []).map(fmt),
        homeFormation: h.formation || '—', awayFormation: a.formation || '—', referees: '—',
      };
    } catch { return empty; }
  }

  // ── TEAM MATCHES ─────────────────────────────────────────────────
  async function getTeamMatches(teamId, _, limit = 10) {
    try {
      const yr = _curYear();
      const [past, next] = await Promise.all([
        _afGet(`/fixtures?team=${teamId}&season=${yr}&status=FT&last=${limit}`),
        _afGet(`/fixtures?team=${teamId}&season=${yr}&status=NS&next=${limit}`),
      ]);
      const fmt = f => ({
        id: f.fixture?.id, date: _fmtDate(f.fixture?.date), utcDate: f.fixture?.date,
        competition: f.league?.name || '—', home: f.teams?.home?.name, away: f.teams?.away?.name,
        homeId: f.teams?.home?.id, awayId: f.teams?.away?.id,
        score: f.goals?.home != null ? `${f.goals.home}–${f.goals.away}` : 'vs',
        status: f.goals?.home != null ? 'FT' : 'NS',
      });
      return { past: (past || []).map(fmt).reverse(), upcoming: (next || []).map(fmt) };
    } catch { return { past: [], upcoming: [] }; }
  }

  // ── TEAM SEASON STATS ────────────────────────────────────────────
  async function getTeamSeasonStats(teamId) {
    for (const [key] of Object.entries(FD_LEAGUE_MAP).slice(0, 5)) {
      try {
        const st = await getStandings(key);
        const r = st.find(r => r.teamId === teamId);
        if (!r) continue;
        const pg = r.played || 1;
        return {
          played: pg, won: r.won, drawn: r.draw, lost: r.lost,
          goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, goalDiff: r.goalDiff, points: r.points,
          ppg: (r.points / pg).toFixed(2), gpg: (r.goalsFor / pg).toFixed(2), gapg: (r.goalsAgainst / pg).toFixed(2), form: r.form,
          home: { played: '—', won: '—', drawn: '—', lost: '—', gf: '—', ga: '—', pts: '—' },
          away: { played: '—', won: '—', drawn: '—', lost: '—', gf: '—', ga: '—', pts: '—' },
        };
      } catch (e) {}
    }
    return null;
  }

  // ── TEAM SQUAD (TSDB) ────────────────────────────────────────────
  async function getTeamSquad(teamId) {
    try {
      const [info, players] = await Promise.all([
        _tsdb(`/lookupteam.php?id=${teamId}`),
        _tsdb(`/lookup_all_players.php?id=${teamId}`),
      ]);
      const t = (info.teams || [])[0] || {};
      return {
        id: t.idTeam, name: t.strTeam, shortName: t.strTeamShort || t.strTeam,
        crest: t.strTeamBadge || null, founded: t.intFormedYear || '—',
        venue: t.strStadium || '—', coach: t.strManager || null,
        squad: (players.player || []).map(p => ({
          id: p.idPlayer, name: p.strPlayer, position: p.strPosition,
          nationality: p.strNationality || '—', dateOfBirth: p.dateBorn || '—', shirtNumber: p.strNumber || '—',
        })),
      };
    } catch { return null; }
  }

  // ── FORM GUIDE ───────────────────────────────────────────────────
  async function getTeamFormGuide(teamId) {
    try {
      const yr = _curYear();
      const d = await _afGet(`/fixtures?team=${teamId}&season=${yr}&status=FT&last=10`);
      return (d || []).reverse().map(f => {
        const isH = f.teams?.home?.id === teamId;
        const hg = f.goals?.home, ag = f.goals?.away;
        const res = isH ? (hg > ag ? 'W' : hg < ag ? 'L' : 'D') : (ag > hg ? 'W' : ag < hg ? 'L' : 'D');
        return {
          date: _fmtDate(f.fixture?.date), competition: f.league?.name || '—',
          opponent: isH ? f.teams?.away?.name : f.teams?.home?.name,
          homeAway: isH ? 'H' : 'A', result: res, score: `${hg}–${ag}`,
          scored: isH ? hg : ag, conceded: isH ? ag : hg,
        };
      });
    } catch { return []; }
  }

  // ── ENRICH ───────────────────────────────────────────────────────
  async function enrichMatch(match) {
    const [h2hData, lineups] = await Promise.all([getH2H(match.fdId), getLineups(match.fdId)]);
    const e = { ...match };
    if (h2hData.matches.length) {
      e.h2h = h2hData.matches;
      e.h2hSummary = `${match.home} won ${h2hData.matches.filter(h => h.result === 'W').length} of the last ${h2hData.matches.length} meetings.`;
    }
    if (lineups.home.length) {
      e.lineupHome = lineups.home; e.lineupAway = lineups.away;
      e.homeFormation = lineups.homeFormation; e.awayFormation = lineups.awayFormation;
    }
    return e;
  }

  return {
    getFixtures, getResults, getStandings, getTeamMatches, getH2H,
    getTeamSeasonStats, getTeamSquad, getLineups, getLiveScores,
    getTeamStats: getTeamSeasonStats, getTeamFormGuide, enrichMatch,
    clearCache: () => {
      Object.keys(_stCache).forEach(k => delete _stCache[k]);
      Object.keys(_tsdbCache).forEach(k => delete _tsdbCache[k]);
    },
    LEAGUES: Object.entries(FD_LEAGUE_MAP).map(([id, v]) => ({ id, name: v.name, flag: v.flag })),
    ALL_SEASONS,
  };
})();
