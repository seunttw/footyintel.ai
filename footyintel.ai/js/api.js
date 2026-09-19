// ============================================================
//  FootyIntel AI — api.js  (v4)
//  Thin wrapper: real data via FootballApi, mock fallback
// ============================================================

const Api = (() => {

  const LIVE = typeof FootballApi !== 'undefined';
  console.info(LIVE ? '[Api] LIVE — FootballApi loaded' : '[Api] MOCK — FootballApi missing');

  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function _try(realFn, mockFn) {
    if (!LIVE) return mockFn();
    try { return await realFn(); }
    catch (err) {
      console.warn('[Api] live failed → mock:', err.message);
      return mockFn();
    }
  }

  async function getLeagues() {
    if (LIVE) return [{ id: 'all', name: 'All Leagues', flag: '🌍' }, ...FootballApi.LEAGUES];
    return LEAGUES;
  }

  async function getMatches(leagueId = 'all') {
    return _try(
      () => FootballApi.getFixtures(leagueId),
      async () => { await _delay(200); return leagueId === 'all' ? MATCHES : MATCHES.filter(m => m.league === leagueId); }
    );
  }

  // Season passed as "2024-2025" — FootballApi converts internally to year
  async function getResults(leagueId = 'all', season) {
    return _try(
      () => FootballApi.getResults(leagueId, season),
      async () => {
        await _delay(200);
        const mock = leagueId === 'all' ? MATCHES : MATCHES.filter(m => m.league === leagueId);
        return mock.map(m => ({ ...m, isFT: true, status: 'FT', score: m.mockScore || '1–0' }));
      }
    );
  }

  // Season passed as "2024-2025" — FootballApi converts internally to year 2024
  async function getStandings(leagueId, season) {
    return _try(
      () => FootballApi.getStandings(leagueId, season),
      async () => {
        await _delay(150);
        const teams = {
          epl:    [['Arsenal','🔴'],['Liverpool','🔴'],['Man City','🔵'],['Chelsea','🔵'],['Tottenham','⚪'],['Aston Villa','🟣'],['Newcastle','⚫'],['Brighton','🔵'],['West Ham','🔵'],['Everton','🔵'],['Fulham','⚪'],['Brentford','🟡'],['Wolves','🟡'],['Crystal Palace','🔵'],['Nottm Forest','🔴'],['Bournemouth','🔴'],['Leicester','🔵'],['Southampton','🔴'],['Ipswich','🔵'],['Man United','🔴']],
          laliga: [['Real Madrid','⚪'],['Barcelona','🔵'],['Atletico','🔴'],['Athletic Club','🔴'],['Real Sociedad','🔵'],['Villarreal','🟡'],['Valencia','🟠'],['Sevilla','🔴'],['Real Betis','🟢'],['Osasuna','🔴'],['Getafe','🔵'],['Rayo Vallecano','🔴'],['Alaves','🔵'],['Girona','🔴'],['Celta Vigo','🔵'],['Las Palmas','🟡'],['Leganes','🔵'],['Mallorca','🔴'],['Espanyol','🔵'],['Valladolid','🟣']],
          serie:  [['Inter','⚫'],['Napoli','🔵'],['AC Milan','🔴'],['Juventus','⚫'],['Atalanta','⚫'],['Lazio','🔵'],['Fiorentina','🟣'],['Bologna','🔴'],['Roma','🟡'],['Torino','🔴'],['Udinese','⚫'],['Genoa','🔴'],['Cagliari','🔴'],['Lecce','🟡'],['Como','🔵'],['Parma','🟡'],['Empoli','🔵'],['Verona','🟡'],['Monza','🔴'],['Venezia','🟠']],
          bund:   [['Bayern','🔴'],['Leverkusen','⚫'],['Dortmund','🟡'],['Leipzig','🔴'],['Frankfurt','⚫'],['Freiburg','⚫'],['Wolfsburg','🟢'],['Hoffenheim','🔵'],['Werder','🟢'],['Stuttgart','🔴'],['Augsburg','🔴'],['Mainz','🔴'],['Union Berlin','🔴'],['Bochum','🔵'],['Köln','🟡'],['Heidenheim','🔴'],['Kiel','🔵'],['St. Pauli','🟤']],
          ligue:  [['PSG','🔵'],['Monaco','🟢'],['Marseille','🔵'],['Lyon','🔴'],['Lille','🔴'],['Nice','🔴'],['Lens','🟡'],['Rennes','🔴'],['Reims','🔴'],['Strasbourg','🔵'],['Toulouse','🟣'],['Montpellier','🟠'],['Brest','🔵'],['Auxerre','🔴'],['Nantes','🟡'],['Le Havre','🔵'],['Angers','⚪'],['Saint-Étienne','🟢']],
        };
        return (teams[leagueId] || teams.epl).map(([name], i) => {
          const pos = i + 1, pg = 34, won = Math.max(0, Math.round(pg * (0.72 - pos * 0.028)));
          const lost = Math.max(0, Math.round(pg * (0.08 + pos * 0.022)));
          const draw = pg - won - lost, gf = won * 2 + draw, ga = lost * 2 + Math.round(draw * 0.5);
          return { position: pos, team: name, played: pg, won, draw, lost, goalsFor: gf, goalsAgainst: ga, goalDiff: gf - ga, points: won * 3 + draw, form: ['W','D','W','L','W'].slice(0, 5 - Math.floor(pos / 5)), crest: null };
        });
      }
    );
  }

  async function getMatchById(id) {
    return _try(
      async () => { const f = await FootballApi.getFixtures('all'); return f.find(m => m.id === id || m.fdId === id) || null; },
      async () => { await _delay(100); return MATCHES.find(m => m.id === id) || null; }
    );
  }

  async function getMatchDetail(id) {
    const match = await getMatchById(id);
    if (!match) return null;
    if (!LIVE) return match;
    return FootballApi.enrichMatch(match);
  }

  async function getH2H(homeTeam, awayTeam, fdMatchId) {
    return _try(
      () => FootballApi.getH2H(fdMatchId),
      async () => { await _delay(150); const m = MATCHES.find(m => m.home === homeTeam && m.away === awayTeam); return m ? { matches: m.h2h, aggregates: {} } : { matches: [], aggregates: {} }; }
    );
  }

  async function getLineups(matchId) {
    return _try(
      () => FootballApi.getLineups(matchId),
      async () => { await _delay(150); const m = MATCHES.find(m => m.id === matchId); return m ? { home: m.lineupHome, away: m.lineupAway } : { home: [], away: [] }; }
    );
  }

  async function getLiveTicker() {
    return _try(
      () => FootballApi.getLiveScores(),
      async () => { await _delay(50); return TICKER_SCORES; }
    );
  }

  async function getAIPrediction(matchId) {
    const match = await getMatchById(matchId);
    if (!match) return null;
    return {
      matchId, pred: match.pred, predType: match.predType, confidence: match.conf,
      homeProb: match.homeProb, drawProb: match.drawProb, awayProb: match.awayProb,
      btts: match.btts, over25: match.over25, reasoning: match.reasoning,
    };
  }

  async function getTopPicksToday() {
    const m = await getMatches('all');
    return m.filter(m => m.aiPick).slice(0, 3);
  }

  async function getOdds(matchId) { const m = await getMatchById(matchId); return m ? m.odds : null; }
  async function getUserProfile() { await _delay(100); return MOCK_USER; }
  async function updateUserPlan(planId) { await _delay(300); MOCK_USER.plan = planId.toUpperCase(); return { success: true, plan: MOCK_USER.plan }; }

  return {
    USE_REAL_API: LIVE,
    getLeagues, getMatches, getResults, getStandings, getMatchById, getMatchDetail,
    getH2H, getLineups, getLiveTicker, getAIPrediction, getTopPicksToday, getOdds,
    getUserProfile, updateUserPlan,
  };
})();
