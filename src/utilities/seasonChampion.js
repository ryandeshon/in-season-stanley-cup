function toTitleDefenses(player = {}) {
  const parsed = Number(player?.titleDefenses);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ownsTeam(player = {}, teamAbbrev = '') {
  if (!teamAbbrev) return false;
  return Array.isArray(player?.teams) && player.teams.includes(teamAbbrev);
}

export function selectSeasonChampion(players = [], currentChampionTeam = null) {
  if (!Array.isArray(players) || players.length === 0) return null;

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
