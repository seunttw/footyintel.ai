// ============================================================
//  FootyIntel AI — apiFootball.js
//  Premium data adapter for API-Football (api-sports.io v3)
//
//  Provides data that Football-Data.org's free tier does NOT:
//    • Player injuries
//    • Suspensions (derived from injuries + sidelined records)
//    • Club friendlies (pre-season / mid-season)
//    • National-team friendlies for the team's country
//    • Richer manager / coach information
//
//  SETUP (one-time):
//   1. Create a free account at https://www.api-football.com/
//      (or via RapidAPI — but the DIRECT api-sports.io host below
//       is what supports browser requests).
//   2. Copy your API key from the dashboard.
//   3. Paste it into AF_API_KEY below, OR add it from the app UI
//      (the Injuries / Suspensions / Friendlies tabs show a
//       "Connect API-Football" button that stores it in
//       localStorage under the key 'fi_af_key').
//
//  Free plan: 100 requests/day. Results are cached for 30 min
//  to stay well within the limit.
// ============================================================

const AF_API_KEY = 'eec767bad597f40533403e9166be3257'; // <-- paste your API-Football key here (optional if set via UI)
const AF_BASE    = 'https://v3.football.api-sports.io';

// ── Key resolution (constant OR localStorage) ───────────────
function _afKey() {
  try {
    const ls = localStorage.getItem('fi_af_key');
    if (ls && ls.trim()) return ls.trim();
  } catch (e) { /* ignore */ }
  return (AF_API_KEY || '').trim();
}

// ── Cache (30-min TTL, persisted to localStorage) ───────────
const _afMem = {};
function _afCacheGet(key) {
  if (_afMem[key] && Date.now() - _afMem[key].ts < 30 * 60 * 1000) return _afMem[key].data;
  try {
    const raw = localStorage.getItem('fi_afc_' + key);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts < 30 * 60 * 1000) { _afMem[key] = obj; return obj.data; }
    }
  } catch (e) { /* ignore */ }
  return null;
}
function _afCacheSet(key, data) {
  const obj = { ts: Date.now(), data };
  _afMem[key] = obj;
  try { localStorage.setItem('fi_afc_' + key, JSON.stringify(obj)); } catch (e) { /* quota */ }
}

// ── Core fetch (returns the .response array) ────────────────
async function _af(path) {
  const key = _afKey();
  if (!key) throw new Error('NO_AF_KEY');
  const cached = _afCacheGet(path);
  if (cached) return cached;
  const res = await fetch(`${AF_BASE}${path}`, {
    headers: { 'x-apisports-key': key },
  });
  if (res.status === 429 || res.status === 499) throw new Error('AF_RATE_LIMIT');
  if (!res.ok) throw new Error(`AF_ERROR_${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    // API-Football returns 200 with an errors object on auth/plan problems
    const msg = Object.values(json.errors).join('; ');
    throw new Error(`AF_API: ${msg}`);
  }
  const data = json.response || [];
  _afCacheSet(path, data);
  return data;
}

// ── Date helpers ─────────────────────────────────────────────
function _afFmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function _afCurrentSeason() {
  const d = new Date();
  // European season rolls over in July
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

// ── Team-name normalisation (Football-Data names → AF search) ─
// Football-Data uses names like "Bayern München", "FC Barcelona".
// We strip common prefixes/suffixes to improve AF search hits.
function _afCleanName(name) {
  if (!name) return '';
  return name
    .replace(/\bFC\b/gi, '')
    .replace(/\bCF\b/gi, '')
    .replace(/\bAFC\b/gi, '')
    .replace(/\bSC\b/gi, '')
    .replace(/\b1899\b/g, '')
    .replace(/\bCalcio\b/gi, '')
    .replace(/München/gi, 'Munich')
    .replace(/\s+/g, ' ')
    .trim();
}

// ════════════════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════════════════
const ApiFootball = (() => {

  function isEnabled() { return !!_afKey(); }

  function setKey(k) {
    try { localStorage.setItem('fi_af_key', (k || '').trim()); } catch (e) {}
  }

  // ── Resolve a Football-Data team name → API-Football team id ─
  const _teamIdCache = {};
  async function resolveTeamId(teamName, country) {
    const clean = _afCleanName(teamName);
    const cacheKey = (clean + '|' + (country || '')).toLowerCase();
    if (_teamIdCache[cacheKey] !== undefined) return _teamIdCache[cacheKey];

    let id = null;
    try {
      const res = await _af(`/teams?search=${encodeURIComponent(clean)}`);
      if (res && res.length) {
        // Prefer a non-national club; if country given, match it.
        let best = res.find(t => country && t.team.country &&
          t.team.country.toLowerCase() === country.toLowerCase() && !t.team.national);
        best = best || res.find(t => !t.team.national) || res[0];
        id = best.team.id;
      }
    } catch (e) {
      console.warn('[AF] resolveTeamId failed for', teamName, e.message);
    }
    _teamIdCache[cacheKey] = id;
    return id;
  }

  // ── Resolve a country's NATIONAL team id ────────────────────
  const _natIdCache = {};
  async function resolveNationalTeamId(country) {
    if (!country) return null;
    const key = country.toLowerCase();
    if (_natIdCache[key] !== undefined) return _natIdCache[key];
    let id = null;
    try {
      const res = await _af(`/teams?name=${encodeURIComponent(country)}`);
      const nat = (res || []).find(t => t.team.national) ||
                  (res || []).find(t => t.team.name.toLowerCase() === key);
      if (nat) id = nat.team.id;
    } catch (e) {
      console.warn('[AF] resolveNationalTeamId failed for', country, e.message);
    }
    _natIdCache[key] = id;
    return id;
  }

  // ── Get the team's country (used for national friendlies) ───
  const _teamCountryCache = {};
  async function getTeamCountry(teamName) {
    const clean = _afCleanName(teamName);
    if (_teamCountryCache[clean] !== undefined) return _teamCountryCache[clean];
    let country = null;
    try {
      const res = await _af(`/teams?search=${encodeURIComponent(clean)}`);
      const club = (res || []).find(t => !t.team.national) || (res || [])[0];
      if (club) country = club.team.country;
    } catch (e) { /* ignore */ }
    _teamCountryCache[clean] = country;
    return country;
  }

  // ── INJURIES ────────────────────────────────────────────────
  // Returns { injuries:[], suspensions:[] } split by reason/type.
  async function getTeamAvailability(teamName, country) {
    const id = await resolveTeamId(teamName, country);
    if (!id) return { injuries: [], suspensions: [], teamId: null };
    const season = _afCurrentSeason();
    let rows = [];
    try {
      rows = await _af(`/injuries?team=${id}&season=${season}`);
    } catch (e) {
      console.warn('[AF] getTeamAvailability failed:', e.message);
      return { injuries: [], suspensions: [], teamId: id, error: e.message };
    }

    // De-duplicate by player (keep most recent fixture entry)
    const seen = {};
    const items = [];
    rows.forEach(r => {
      const pid = r.player?.id;
      if (pid && seen[pid]) return;
      if (pid) seen[pid] = true;
      items.push({
        playerId: pid,
        name: r.player?.name || 'Unknown',
        photo: r.player?.photo || null,
        type: r.player?.type || '—',            // "Missing Fixture" | "Questionable"
        reason: r.player?.reason || '—',         // e.g. "Knee Injury", "Suspended", "Coach Decision"
        fixtureDate: r.fixture?.date ? _afFmtDate(r.fixture.date) : '—',
        league: r.league?.name || '—',
      });
    });

    const isSuspension = it => /suspend|red card|ban/i.test(it.reason);
    return {
      teamId: id,
      injuries: items.filter(it => !isSuspension(it)),
      suspensions: items.filter(isSuspension),
    };
  }

  // ── Additional sidelined / suspension history per player ────
  async function getPlayerSidelined(playerId) {
    if (!playerId) return [];
    try {
      const rows = await _af(`/sidelined?player=${playerId}`);
      return (rows || []).map(r => ({
        type: r.type || '—',
        start: r.start ? _afFmtDate(r.start) : '—',
        end: r.end ? _afFmtDate(r.end) : 'Ongoing',
      }));
    } catch (e) { return []; }
  }

  // ── FRIENDLIES (club) — past + upcoming ─────────────────────
  function _fmtFixture(f, teamId) {
    const home = f.teams.home, away = f.teams.away;
    const finished = ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
    const score = (f.goals.home != null && f.goals.away != null)
      ? `${f.goals.home}\u2013${f.goals.away}` : 'vs';
    return {
      id: f.fixture.id,
      date: _afFmtDate(f.fixture.date),
      utcDate: f.fixture.date,
      league: f.league?.name || 'Friendly',
      home: home.name,
      away: away.name,
      homeLogo: home.logo,
      awayLogo: away.logo,
      score: finished ? score : 'vs',
      status: finished ? 'FINISHED' : (f.fixture.status.short === 'NS' ? 'SCHEDULED' : f.fixture.status.short),
      finished,
    };
  }

  // API-Football league ids for friendly competitions
  const FRIENDLY_LEAGUE_IDS = [667 /*Friendlies Clubs*/, 10 /*Friendlies (Nat)*/, 666 /*Premier League Asia Trophy etc*/];

  async function getClubFriendlies(teamName, country) {
    const id = await resolveTeamId(teamName, country);
    if (!id) return { past: [], upcoming: [], teamId: null };
    const season = _afCurrentSeason();
    let fixtures = [];
    try {
      // Pull the whole season for this team, then filter to friendlies.
      const cur = await _af(`/fixtures?team=${id}&season=${season}`);
      const prev = await _af(`/fixtures?team=${id}&season=${season - 1}`);
      fixtures = [...(cur || []), ...(prev || [])];
    } catch (e) {
      console.warn('[AF] getClubFriendlies failed:', e.message);
      return { past: [], upcoming: [], teamId: id, error: e.message };
    }
    const friendlies = fixtures.filter(f =>
      FRIENDLY_LEAGUE_IDS.includes(f.league?.id) ||
      /friendl/i.test(f.league?.name || '')
    );
    const mapped = friendlies.map(f => _fmtFixture(f, id));
    return {
      teamId: id,
      upcoming: mapped.filter(m => !m.finished).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
      past: mapped.filter(m => m.finished).sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)),
    };
  }

  // ── FRIENDLIES (national team of the team's country) ────────
  async function getNationalFriendlies(teamName, country) {
    const ctry = country || await getTeamCountry(teamName);
    if (!ctry) return { past: [], upcoming: [], country: null, natId: null };
    const natId = await resolveNationalTeamId(ctry);
    if (!natId) return { past: [], upcoming: [], country: ctry, natId: null };
    const season = _afCurrentSeason();
    let fixtures = [];
    try {
      const cur = await _af(`/fixtures?team=${natId}&season=${season}`);
      const prev = await _af(`/fixtures?team=${natId}&season=${season - 1}`);
      fixtures = [...(cur || []), ...(prev || [])];
    } catch (e) {
      console.warn('[AF] getNationalFriendlies failed:', e.message);
      return { past: [], upcoming: [], country: ctry, natId, error: e.message };
    }
    const friendlies = fixtures.filter(f =>
      FRIENDLY_LEAGUE_IDS.includes(f.league?.id) ||
      /friendl/i.test(f.league?.name || '')
    );
    const mapped = friendlies.map(f => _fmtFixture(f, natId));
    return {
      country: ctry,
      natId,
      upcoming: mapped.filter(m => !m.finished).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
      past: mapped.filter(m => m.finished).sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)),
    };
  }

  // ── COACH / MANAGER (richer than Football-Data) ─────────────
  async function getCoach(teamName, country) {
    const id = await resolveTeamId(teamName, country);
    if (!id) return null;
    try {
      const rows = await _af(`/coachs?team=${id}`);
      // The current coach is the one without an end date on the team career.
      const current = (rows || []).find(c =>
        (c.career || []).some(car => car.team?.id === id && !car.end)
      ) || (rows || [])[0];
      if (!current) return null;
      const career = (current.career || []).map(car => ({
        team: car.team?.name || '—',
        logo: car.team?.logo || null,
        start: car.start || '—',
        end: car.end || 'Present',
      }));
      return {
        name: current.name,
        firstname: current.firstname,
        lastname: current.lastname,
        age: current.age,
        nationality: current.nationality || '—',
        photo: current.photo || null,
        birthDate: current.birth?.date ? _afFmtDate(current.birth.date) : '—',
        birthPlace: current.birth?.place || '—',
        career,
      };
    } catch (e) {
      console.warn('[AF] getCoach failed:', e.message);
      return null;
    }
  }

  return {
    isEnabled,
    setKey,
    resolveTeamId,
    resolveNationalTeamId,
    getTeamCountry,
    getTeamAvailability,
    getPlayerSidelined,
    getClubFriendlies,
    getNationalFriendlies,
    getCoach,
  };
})();
