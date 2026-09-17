import fallbackPlayers from '../../playerTeams.json';

const TEAM_ABBREV_ALIASES = Object.freeze({
  WIN: 'WPG',
});

function normalizeTeamAbbrev(team) {
  const normalized = String(team || '')
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  return TEAM_ABBREV_ALIASES[normalized] || normalized;
}

function normalizeTeams(teams) {
  if (!Array.isArray(teams)) return [];
  const uniqueTeams = new Set();
  teams.forEach((team) => {
    const normalized = normalizeTeamAbbrev(team);
    if (normalized) {
      uniqueTeams.add(normalized);
    }
  });
  return Array.from(uniqueTeams);
}

function createFallbackLookup(players) {
  const byId = new Map();
  const byName = new Map();

  (Array.isArray(players) ? players : []).forEach((player) => {
    const teams = normalizeTeams(player?.teams);
    if (!teams.length) return;

    if (player?.id !== undefined && player?.id !== null) {
      byId.set(String(player.id), teams);
    }

    const normalizedName = String(player?.name || '')
      .trim()
      .toLowerCase();
    if (normalizedName) {
      byName.set(normalizedName, teams);
    }
  });

  return { byId, byName };
}

const fallbackLookup = createFallbackLookup(fallbackPlayers);

function getFallbackTeams(player) {
  if (!player || typeof player !== 'object') return [];

  if (player.id !== undefined && player.id !== null) {
    const byIdTeams = fallbackLookup.byId.get(String(player.id));
    if (Array.isArray(byIdTeams) && byIdTeams.length) return byIdTeams;
  }

  const normalizedName = String(player.name || '')
    .trim()
    .toLowerCase();
  if (!normalizedName) return [];

  const byNameTeams = fallbackLookup.byName.get(normalizedName);
  return Array.isArray(byNameTeams) ? byNameTeams : [];
}

export function hydratePlayerTeam(player, season) {
  if (!player || typeof player !== 'object') return player;

  player = {
    ...player,
    ...(player.id !== null &&
    player.id !== undefined &&
    Number.isFinite(Number(player.id))
      ? { id: Number(player.id) }
      : {}),
  };
  const apiTeams = normalizeTeams(player.teams);
  if (Array.isArray(player.teams) || season !== 'season1') {
    return { ...player, teams: apiTeams };
  }

  return { ...player, teams: getFallbackTeams(player) };
}

export function hydratePlayerTeams(players, season) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => hydratePlayerTeam(player, season));
}
