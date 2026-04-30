/**
 * Safely extracts title defenses count from a player object
 * @param {Object} player - Player object with optional titleDefenses property
 * @returns {number} - Title defenses count, defaults to 0 if invalid
 */
function toTitleDefenses(player = {}) {
  const parsed = Number(player?.titleDefenses);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Checks if a player owns a specific team
 * @param {Object} player - Player object with optional teams array
 * @param {string} teamAbbrev - Team abbreviation to check
 * @returns {boolean} - True if player owns the team
 */
function ownsTeam(player = {}, teamAbbrev = '') {
  if (!teamAbbrev) return false;
  return Array.isArray(player?.teams) && player.teams.includes(teamAbbrev);
}

/**
 * Selects the season champion from a list of players using a tie-breaking hierarchy
 *
 * Tie-breaking order:
 * 1. Highest title defenses wins outright
 * 2. If tied, prefer the current champion team owner
 * 3. If still tied, sort alphabetically by name
 *
 * @param {Array} players - Array of player objects with titleDefenses, teams, and name properties
 * @param {string} currentChampionTeam - Current champion team abbreviation for tie-breaking
 * @returns {Object|null} - Winning player object or null if no valid candidates
 *
 * @example
 * // Player with most defenses wins
 * selectSeasonChampion([
 *   { name: 'Alice', titleDefenses: 5, teams: ['BOS'] },
 *   { name: 'Bob', titleDefenses: 3, teams: ['TOR'] }
 * ], 'BOS') // Returns Alice
 *
 * @example
 * // Tie-break by champion team owner
 * selectSeasonChampion([
 *   { name: 'Alice', titleDefenses: 5, teams: ['BOS'] },
 *   { name: 'Bob', titleDefenses: 5, teams: ['TOR'] }
 * ], 'TOR') // Returns Bob (owns champion team)
 */
export function selectSeasonChampion(players = [], currentChampionTeam = null) {
  if (!Array.isArray(players) || players.length === 0) return null;

  // Start with -Infinity to handle case where all players have 0 defenses
  let maxTitleDefenses = -Infinity;
  players.forEach((player) => {
    const defenses = toTitleDefenses(player);
    if (defenses > maxTitleDefenses) {
      maxTitleDefenses = defenses;
    }
  });

  const contenders = players.filter(
    (player) => toTitleDefenses(player) === maxTitleDefenses
  );
  if (contenders.length === 1) return contenders[0];

  const championOwner = contenders.find((player) =>
    ownsTeam(player, currentChampionTeam)
  );
  if (championOwner) return championOwner;

  return [...contenders].sort((a, b) =>
    String(a?.name || '').localeCompare(String(b?.name || ''))
  )[0];
}
