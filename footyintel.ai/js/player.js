const AF_BASE = 'https://v3.football.api-sports.io';
const AF_KEY  = 'eec767bad597f40533403e9166be3257';

const headers = {
  'x-apisports-key': AF_KEY
};

async function afFetch(path) {
  const res = await fetch(`${AF_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) {
    throw new Error(Object.values(data.errors).join(', '));
  }
  return data.response;
}

// Search players by name, returns array of player objects
async function searchPlayers(query) {
  // API requires at least 3 chars
  if (!query || query.trim().length < 3) return [];
  const encoded = encodeURIComponent(query.trim());
  const season = new Date().getFullYear();
  return afFetch(`/players?search=${encoded}&season=${season}`);
}

// Get full stats for a specific player across all leagues in a season
async function getPlayerStats(playerId, season) {
  const yr = season ? season.split('-')[0] : new Date().getFullYear();
  return afFetch(`/players?id=${playerId}&season=${yr}`);
}

// Get trophies for a player
async function getPlayerTrophies(playerId) {
  try {
    return afFetch(`/trophies?player=${playerId}`);
  } catch {
    return [];
  }
}

// Get transfers for a player
async function getPlayerTransfers(playerId) {
  try {
    return afFetch(`/transfers?player=${playerId}`);
  } catch {
    return [];
  }
}

window.PlayerAPI = {
  searchPlayers,
  getPlayerStats,
  getPlayerTrophies,
  getPlayerTransfers
};
